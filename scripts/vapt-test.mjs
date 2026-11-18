/**
 * Adwa Cyber — VAPT Center API test suite (NBE/NCB/S/02/2026/27 LOT4).
 *
 * Verifies the full hybrid-engine loop against the running dev server:
 *  1. Overview KPIs + tenant scope (CBE admin sees only CBE).
 *  2. Attack-surface registry CRUD + duplicate guard + RBAC (auditor/viewer 403).
 *  3. Tenant isolation (Dashen admin cannot touch CBE records).
 *  4. REAL DAST scan against the platform itself (http://localhost:3000 —
 *     live web checks, honest engine labels) + dedup on re-scan.
 *  5. Remediation workflow: in_progress → remediated (SLA stamps),
 *     risk acceptance requires a justification note.
 *  6. Promotion into the Findings module: NBE-anchored mirror scan +
 *     ScanResult with the shared SLA clock; /api/findings/sla sees it;
 *     /api/stats excludes mirror scans from compliance aggregates.
 *  7. Bidirectional status sync (Findings PATCH mirrors back into VAPT).
 *
 * Usage: node scripts/vapt-test.mjs   (requires the seeded dev stack)
 */
const BASE = "http://localhost:3000";
const results = [];
const check = (name, cond, extra = "") => results.push(`${cond ? "PASS" : "FAIL"}  ${name}${extra ? " — " + extra : ""}`);

function solveCaptcha(svg) {
  return [...svg.matchAll(/<text[^>]*>([^<]+)<\/text>/g)].map((m) => m[1]).join("");
}

async function jfetch(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", ...(opts.headers ?? {}) },
  });
  let body = null;
  try { body = await res.json(); } catch { /* non-JSON */ }
  return { status: res.status, body, headers: res.headers };
}

async function login(email, password) {
  const cap = (await jfetch("/api/auth/captcha")).body;
  const res = await jfetch("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password, captchaId: cap.captchaId, captchaAnswer: solveCaptcha(cap.svg) }),
  });
  if (res.status !== 200) throw new Error(`login failed for ${email}: ${JSON.stringify(res.body).slice(0, 200)}`);
  return { cookie: res.headers.getSetCookie().map((c) => c.split(";")[0]).join("; "), user: res.body.user };
}

const authed = (s) => ({ headers: { Cookie: s.cookie } });
const jbody = (s, payload, method = "POST") => ({ method, headers: { Cookie: s.cookie, "Content-Type": "application/json" }, body: JSON.stringify(payload) });

try {
  // ── Fixtures: logins ──────────────────────────────────────────────────────
  const cbeAdmin = await login("admin@cbe.com.et", "Adwa#Demo2026!");
  const dashenAuditor = await login("auditor@dashen.com.et", "Adwa#Demo2026!");
  const cbeViewer = await login("viewer@ethiotelecom.et", "Adwa#Demo2026!");

  // ── 1. Overview ──────────────────────────────────────────────────────────
  let r = await jfetch("/api/vapt/overview", authed(cbeAdmin));
  check("GET /api/vapt/overview 200", r.status === 200);
  check("overview scope=tenant", r.body.scope === "tenant");
  check("overview asset registry seeded", r.body.assets.total >= 20, `total=${r.body.assets.total}`);
  check("overview vulnerabilities seeded", r.body.vulnerabilities.total >= 100, `total=${r.body.vulnerabilities.total}`);
  check("overview KEV count present", r.body.vulnerabilities.kev >= 5, `kev=${r.body.vulnerabilities.kev}`);
  check("overview SLA policy mirrored (30/60/90/180)", r.body.slaPolicy.critical === 30 && r.body.slaPolicy.low === 180);
  check("overview top-risk register sorted by priority", (r.body.topRisk ?? []).every((x, i, a) => i === 0 || a[i - 1].priorityScore >= x.priorityScore));
  check("shadow-IT asset flagged in EASM", r.body.assets.unmanaged >= 1);
  const kevBefore = r.body.kevOpenCount;

  // ── 2. Registry CRUD ────────────────────────────────────────────────────
  r = await jfetch("/api/vapt/assets", authed(cbeAdmin));
  check("GET /api/vapt/assets 200", r.status === 200);
  const cbeAssets = r.body.assets;
  check("assets tenant-scoped to CBE", cbeAssets.every((a) => a.organization.name.includes("Commercial Bank")));
  const platformAsset = cbeAssets.find((a) => a.identifier === "http://localhost:3000");
  check("platform self-scan target registered", Boolean(platformAsset));
  check("asset rows carry open-vuln rollups", cbeAssets.every((a) => typeof a.openCount === "number" && typeof a.topPriority === "number"));

  r = await jfetch("/api/vapt/assets", jbody(cbeAdmin, {
    name: "Test jump host", kind: "SERVER", identifier: "10.99.99.99",
    environment: "PROD", surface: "INTERNAL", criticality: "high",
    osOrPlatform: "Ubuntu Server 22.04", tags: ["test", "throwaway"], notes: "created by vapt-test",
  }));
  check("POST /api/vapt/assets 201", r.status === 201, `status=${r.status}`);
  const testAssetId = r.body.asset?.id;

  r = await jfetch("/api/vapt/assets", jbody(cbeAdmin, {
    name: "Duplicate test", kind: "SERVER", identifier: "10.99.99.99",
  }));
  check("duplicate identifier rejected 409", r.status === 409);

  r = await jfetch("/api/vapt/assets", jbody(cbeAdmin, {
    name: "Bad web target", kind: "WEBAPP", identifier: "ftp://not-a-web-target",
  }));
  check("non-http web target rejected 400", r.status === 400);

  if (testAssetId) {
    // Promote criticality → re-score path executes cleanly.
    r = await jfetch(`/api/vapt/assets/${testAssetId}`, jbody(cbeAdmin, { criticality: "critical", managed: false }, "PATCH"));
    check("PATCH asset (criticality + shadow-IT) 200", r.status === 200);
    r = await jfetch(`/api/vapt/assets/${testAssetId}`, authed(cbeAdmin));
    check("PATCH persisted", r.status === 200 && r.body.asset.criticality === "critical" && r.body.asset.managed === false);
    r = await jfetch(`/api/vapt/assets/${testAssetId}`, { method: "DELETE", headers: { Cookie: cbeAdmin.cookie } });
    check("DELETE asset 200", r.status === 200);
  }

  // ── 3. RBAC + tenant isolation ───────────────────────────────────────────
  r = await jfetch("/api/vapt/overview", authed(dashenAuditor));
  check("auditor can view overview (read-only role)", r.status === 200 && r.body.scope === "tenant");
  r = await jfetch("/api/vapt/assets", jbody(dashenAuditor, { name: "nope", kind: "SERVER", identifier: "10.0.0.9" }));
  check("auditor write rejected 403", r.status === 403);
  r = await jfetch("/api/vapt/scans", jbody(dashenAuditor, { scanType: "FULL" }));
  check("auditor scan launch rejected 403", r.status === 403);
  r = await jfetch("/api/vapt/vulnerabilities?status=open", authed(cbeViewer));
  check("viewer can read vulnerability queue", r.status === 200);

  const cbeVulns = (await jfetch("/api/vapt/vulnerabilities", authed(cbeAdmin))).body.vulnerabilities;
  const cbeVulnId = cbeVulns[0]?.id;
  if (cbeVulnId) {
    const dashenAdmin = await login("admin@wasasa.et", "Adwa#Demo2026!");
    r = await jfetch(`/api/vapt/vulnerabilities/${cbeVulnId}`, authed(dashenAdmin));
    check("cross-tenant vuln detail 403", r.status === 403);
    r = await jfetch(`/api/vapt/vulnerabilities/${cbeVulnId}`, jbody(dashenAdmin, { status: "remediated" }, "PATCH"));
    check("cross-tenant vuln write 403", r.status === 403);
  }

  // ── 4. REAL DAST scan against the platform itself ───────────────────────
  check("DAST prerequisite: platform target present", Boolean(platformAsset));
  if (platformAsset) {
    r = await jfetch("/api/vapt/scans", jbody(cbeAdmin, {
      scanType: "DAST",
      name: "vapt-test live DAST on platform",
      assetIds: [platformAsset.id],
    }));
    check("POST /api/vapt/scans (DAST) 201", r.status === 201, `status=${r.status}`);
    check("scan COMPLETED", r.body.scan?.status === "COMPLETED");
    check("scan engineMode=live (real DAST ran)", r.body.scan?.engineMode === "live" && r.body.scan?.dastReal === true);
    const report = (r.body.dastReports ?? []).find((x) => x.target === "http://localhost:3000");
    check("live DAST report captured", Boolean(report) && report.reachable === true);
    check("live DAST checks executed (non-empty battery)", (report?.checks ?? []).length >= 5, `checks=${report?.checks?.length ?? 0}`);

    const dastVulns = (await jfetch("/api/vapt/vulnerabilities?q=DAST", authed(cbeAdmin))).body.vulnerabilities;
    check("DAST findings tracked with live evidence", dastVulns.length >= 1 && dastVulns.every((v) => v.evidence?.mode === "dast-live"));
    check("DAST findings carry CVSS + SLA clock", dastVulns.length > 0 && dastVulns.every((v) => v.cvssScore > 0 && v.dueAt !== null));
    // The platform itself is hardened (CSP/nosniff/framing set by next.config.ts),
    // so the honest live result on http://localhost:3000 is: passes recorded,
    // plus the transport finding for the plaintext dev target. The cookie-flag
    // (A07) finding appears whenever a Set-Cookie response lacks flags — e.g.
    // the dev session cookie without `Secure` (production-only flag).
    const transportFinding = dastVulns.find((v) => v.title.includes("Transport encryption"));
    check("no-TLS finding on plaintext http target (A02)", Boolean(transportFinding));
    const cspCheck = (report?.checks ?? []).find((c) => c.id === "csp");
    check("hardened platform PASSES live CSP check", cspCheck?.result === "pass", cspCheck?.detail?.slice(0, 60) ?? "—");

    // Re-scan → dedup: same asset+finding set is counted as known, not duplicated.
    const before = (await jfetch("/api/vapt/vulnerabilities?q=DAST", authed(cbeAdmin))).body.vulnerabilities.length;
    r = await jfetch("/api/vapt/scans", jbody(cbeAdmin, {
      scanType: "DAST", name: "vapt-test re-scan (dedup)", assetIds: [platformAsset.id],
    }));
    const after = (await jfetch("/api/vapt/vulnerabilities?q=DAST", authed(cbeAdmin))).body.vulnerabilities.length;
    check("re-scan dedups (known, not duplicated)", r.status === 201 && after === before, `before=${before} after=${after} known=${r.body.scan?.knownCount}`);

    // Unreachable target handled gracefully (marked, never a silent pass).
    const unreachable = cbeAssets.find((a) => a.identifier.includes("online-legacy"));
    if (unreachable) {
      r = await jfetch("/api/vapt/scans", jbody(cbeAdmin, { scanType: "DAST", name: "vapt-test unreachable", assetIds: [unreachable.id] }));
      check("unreachable target marked in scan detail", r.status === 201 && (r.body.scan?.detail ?? "").includes("Unreachable"));
    }
  }

  // ── 4b. REAL INFRA scan against the vulnerable lab target ─────────────
  //     (mini-services/vuln-lab — true-functionality acceptance: banners →
  //      live-fetched CVE feed → prioritised findings)
  const labUp = await fetch("http://127.0.0.1:3060/", { signal: AbortSignal.timeout(1500) }).then((x) => x.status < 500).catch(() => false);
  check("vuln-lab target running (bun mini-services/vuln-lab)", labUp, labUp ? "up" : "down — start with: bun mini-services/vuln-lab/index.ts");
  const labHost = cbeAssets.find((a) => a.identifier === "127.0.0.1");
  const labWeb = cbeAssets.find((a) => a.identifier === "http://127.0.0.1:3060");
  if (labUp && labHost && labWeb) {
    r = await jfetch("/api/vapt/scans", jbody(cbeAdmin, {
      scanType: "FULL", name: "vapt-test live INFRA on vuln-lab",
      assetIds: [labHost.id, labWeb.id],
      ports: [3021, 3022, 3060, 3061, 3062],
    }));
    check("POST /api/vapt/scans (FULL on lab) 201", r.status === 201, `status=${r.status}`);
    check("live INFRA probes ran (infraReal)", r.body.scan?.infraReal === true);
    check("scan scope recorded", Boolean(r.body.scan?.scopeId), `scopeId=${r.body.scan?.scopeId ?? null}`);

    const labVulns = (await jfetch("/api/vapt/vulnerabilities?q=vsftpd", authed(cbeAdmin))).body.vulnerabilities;
    check("vsftpd 2.3.4 banner → CVE-2011-2523 detected", labVulns.some((v) => v.cveId === "CVE-2011-2523" && v.evidence?.mode === "infra-live"), `n=${labVulns.length}`);
    const apacheVulns = (await jfetch("/api/vapt/vulnerabilities?q=Apache HTTP Server path traversal", authed(cbeAdmin))).body.vulnerabilities;
    check("Apache/2.4.49 header → CVE-2021-41773 + 42013 (KEV) detected", apacheVulns.filter((v) => ["CVE-2021-41773", "CVE-2021-42013"].includes(v.cveId)).length >= 2, `n=${apacheVulns.length}`);
    const sshVulns = (await jfetch("/api/vapt/vulnerabilities?q=OpenSSH ssh-agent", authed(cbeAdmin))).body.vulnerabilities;
    check("OpenSSH 7.2p2 banner → CVE-2023-38408 detected", sshVulns.some((v) => v.cveId === "CVE-2023-38408"), `n=${sshVulns.length}`);
    const hbVulns = (await jfetch("/api/vapt/vulnerabilities?q=Heartbleed", authed(cbeAdmin))).body.vulnerabilities;
    check("OpenSSL 1.0.1e banner → CVE-2014-0160 (KEV) detected", hbVulns.some((v) => v.cveId === "CVE-2014-0160" && v.kev === true), `n=${hbVulns.length}`);
    const redisVulns = (await jfetch("/api/vapt/vulnerabilities?q=Redis answers PING", authed(cbeAdmin))).body.vulnerabilities;
    check("unauthenticated Redis PING probe finding", redisVulns.length >= 1 && redisVulns.every((v) => v.evidence?.mode === "infra-live"), `n=${redisVulns.length}`);
    const proftpdVulns = (await jfetch("/api/vapt/vulnerabilities?q=ProFTPD", authed(cbeAdmin))).body.vulnerabilities;
    check("ProFTPD 1.3.3c banner → CVE-2010-20103 (not 4221 — fixed in 1.3.3c)", proftpdVulns.some((v) => v.cveId === "CVE-2010-20103") && proftpdVulns.every((v) => v.cveId !== "CVE-2010-4221"), `n=${proftpdVulns.length}`);
    const liveFindings = [labVulns, sshVulns, hbVulns].flat().filter((v) => v.evidence?.mode === "infra-live");
    check("live findings carry fingerprints (dedup identity)", liveFindings.length >= 3 && liveFindings.every((v) => v.fingerprint?.length === 64), `live=${liveFindings.length}`);
    check("live findings carry CVSS + EPSS + priority score", sshVulns.every((v) => v.cvssScore > 0 && v.epss > 0 && v.priorityScore > 0));

    // Re-scan → fingerprint dedup (known, not duplicated).
    const dedupBefore = (await jfetch("/api/vapt/vulnerabilities?q=vsftpd", authed(cbeAdmin))).body.vulnerabilities.length;
    r = await jfetch("/api/vapt/scans", jbody(cbeAdmin, {
      scanType: "FULL", name: "vapt-test re-scan (dedup)", assetIds: [labHost.id, labWeb.id],
      ports: [3021, 3022, 3060, 3061, 3062],
    }));
    const dedupAfter = (await jfetch("/api/vapt/vulnerabilities?q=vsftpd", authed(cbeAdmin))).body.vulnerabilities.length;
    check("INFRA re-scan dedups via fingerprint", r.status === 201 && dedupAfter === dedupBefore && r.body.scan?.knownCount > 0, `before=${dedupBefore} after=${dedupAfter} known=${r.body.scan?.knownCount}`);

    // Auto-close: rescan WITHOUT the Redis port → the Redis finding is not
    // re-observed by a FULL scan → verified-fixed (plan §4).
    const redisBefore = redisVulns.length;
    if (redisBefore > 0) {
      // Idempotency: a previous suite run may have auto-closed the labHost
      // Redis finding already — reset it to open so THIS run exercises the
      // auto-close path again (the suite is safe to re-run on a warm DB).
      for (const v of redisVulns.filter((x) => (x.asset?.name ?? "").includes("multi-service host") && x.status !== "open")) {
        await jfetch(`/api/vapt/vulnerabilities/${v.id}`, jbody(cbeAdmin, { status: "open" }, "PATCH"));
      }
      r = await jfetch("/api/vapt/scans", jbody(cbeAdmin, {
        scanType: "FULL", name: "vapt-test auto-close (port removed)", assetIds: [labHost.id],
        ports: [3021, 3022, 3060, 3061], // 3062 (Redis) intentionally absent
      }));
      check("auto-close runs on FULL rescan (redis gone)", r.status === 201 && (r.body.scan?.autoClosedCount ?? 0) >= 1, `autoClosed=${r.body.scan?.autoClosedCount}`);
      const redisAfter = (await jfetch("/api/vapt/vulnerabilities?q=Redis answers PING", authed(cbeAdmin))).body.vulnerabilities;
      // Only the RESCANNED asset's finding closes (labHost) — the labWeb copy was
      // not in this scan's asset set, so it stays open (correct plan §4 semantics).
      const hostClosed = redisAfter.filter((v) => v.asset?.name?.includes("multi-service host")).every((v) => v.status === "remediated" && v.remediatedAt !== null);
      check("Redis finding auto-closed as verified-fixed (scanned asset)", hostClosed, `hostCopies=${redisAfter.filter((v) => v.asset?.name?.includes("multi-service host")).length}`);
    }
  }

  // ── 4c. Authorization gate: out-of-scope rejection (plan §1 + §7) ──────
  const dashenAdm = await login("admin@wasasa.et", "Adwa#Demo2026!");
  r = await jfetch("/api/vapt/assets", jbody(dashenAdm, { name: "Out-of-scope probe", kind: "SERVER", identifier: "192.0.2.99", environment: "PROD", surface: "EXTERNAL", criticality: "low" }));
  const oosAsset = r.body.asset ?? (await jfetch("/api/vapt/assets", authed(dashenAdm))).body.assets.find((a) => a.identifier === "192.0.2.99");
  if (oosAsset) {
    r = await jfetch("/api/vapt/scans", jbody(dashenAdm, { scanType: "FULL", name: "out-of-scope attempt", assetIds: [oosAsset.id] }));
    check("out-of-scope scan REJECTED 403 at the API level", r.status === 403 && Array.isArray(r.body.unauthorized) && r.body.unauthorized.length === 1, `status=${r.status}`);
    const auditChain = (await jfetch("/api/vapt/audit?verify=1", authed(dashenAdm))).body;
    const rejection = (auditChain.chain ?? []).find((row) => row.type === "SCAN_REJECTED" && (row.target ?? "").includes("192.0.2.99"));
    check("rejection recorded in the hash-chained audit log", Boolean(rejection), `seq=${rejection?.seq ?? null}`);
    // cleanup
    await jfetch(`/api/vapt/assets/${oosAsset.id}`, { method: "DELETE", headers: { Cookie: dashenAdm.cookie } });
  }

  // ── 4d. Scope lifecycle: four-eyes ───────────────────────────────────────
  const iso = new Date().toISOString();
  const scopeBody = {
    name: "vapt-test lab scope",
    targets: [{ kind: "ip", value: "127.0.0.1" }],
    owner: "vapt-test",
    authorizationNote: "test written authorization",
    validFrom: iso, validUntil: new Date(Date.now() + 30 * 86400000).toISOString(),
  };
  r = await jfetch("/api/vapt/scopes", jbody(cbeAdmin, scopeBody));
  check("POST /api/vapt/scopes creates a DRAFT", r.status === 201 && r.body.scope?.status === "DRAFT", `status=${r.status}`);
  const draftScopeId = r.body.scope?.id;
  r = await jfetch(`/api/vapt/scopes/${draftScopeId}`, jbody(cbeAdmin, { action: "approve" }, "PATCH"));
  check("SELF-approval blocked (four-eyes) 403", r.status === 403, `status=${r.status}`);
  // officer@cbe.com.et carries MFA in the seed — use the platform SUPER_ADMIN
  // as the (distinct) second user; four-eyes requires different USERS, and the
  // gate accepts any permitted approver.
  const cbeSecondApprover = await login("admin@adwacyber.et", "Adwa#Admin2026!");
  r = await jfetch(`/api/vapt/scopes/${draftScopeId}`, jbody(cbeSecondApprover, { action: "approve" }, "PATCH"));
  check("SECOND-user approval 200 (four-eyes satisfied)", r.status === 200 && r.body.scope?.status === "APPROVED", `status=${r.status}`);
  r = await jfetch("/api/vapt/scopes", authed(cbeAdmin));
  const myScopes = (r.body.scopes ?? []).filter((sc) => sc.organizationId === (r.body.scopes?.[0]?.organizationId));
  check("scope register lists four-eyes state", myScopes.some((sc) => sc.fourEyes === true && sc.live === true), `scopes=${myScopes.length}`);
  // invalid targets rejected
  r = await jfetch("/api/vapt/scopes", jbody(cbeAdmin, { ...scopeBody, name: "bad", targets: [{ kind: "cidr", value: "300.1.2.3/40" }] }));
  check("invalid CIDR scope target rejected 400", r.status === 400);

  // ── 4e. Custom checks (declarative YAML, sandboxed) ─────────────────────
  r = await jfetch("/api/vapt/checks", jbody(cbeAdmin, { name: "bad", yaml: "name: x\nmatch: []\n" }));
  check("invalid check YAML rejected 400", r.status === 400);
  r = await jfetch("/api/vapt/checks", jbody(cbeAdmin, {
    name: "vapt-test lab FTP banner check",
    yaml: [
      "name: Lab FTP banner check",
      "severity: medium",
      "title: FTP greeting discloses version",
      "remediation: Strip banner.",
      "match:",
      "  - type: banner-regex",
      '    pattern: "220[ -].*vsFTPd [0-9.]+"',
    ].join("\n"),
  }));
  check("valid custom check created 201", r.status === 201, `status=${r.status}`);
  const checkId = r.body.check?.id;
  if (checkId) {
    r = await jfetch(`/api/vapt/checks/${checkId}/test`, jbody(cbeAdmin, { target: "8.8.8.8" }));
    check("check test-run out-of-scope target rejected 403", r.status === 403, `status=${r.status}`);
    if (labUp) {
      r = await jfetch(`/api/vapt/checks/${checkId}/test`, jbody(cbeAdmin, { target: "127.0.0.1", ports: [3021, 3060] }));
      check("check test-run (in-scope) evaluates live probes", r.status === 200 && r.body.result?.matched === true, `matched=${r.body.result?.matched} evidence=${(r.body.result?.evidence ?? "").slice(0, 60)}`);
    }
  }

  // ── 4f. Hash-chained audit log + tamper check ────────────────────────────
  r = await jfetch("/api/vapt/audit", authed(cbeAdmin));
  check("GET /api/vapt/audit returns the chain", r.status === 200 && (r.body.chain ?? []).length >= 3, `rows=${r.body.chain?.length ?? 0}`);
  check("chain rows carry prev-hash linkage", (r.body.chain ?? []).every((row) => typeof row.prevHash === "string" && row.prevHash.length > 0));
  r = await jfetch("/api/vapt/audit?verify=1", authed(cbeAdmin));
  check("tamper check: chain verifies end-to-end", r.status === 200 && r.body.verification?.valid === true, r.body.verification?.note?.slice(0, 80) ?? "");
  const types = new Set((r.body.chain ?? []).map((row) => row.type));
  check("audit chain records the full action spectrum", ["SCAN_STARTED", "SCAN_COMPLETED"].every((t) => types.has(t)) && (types.has("SCAN_REJECTED") || types.has("SCOPE_APPROVED") || types.has("CHECK_TESTED")), [...types].join(","));

  // ── 5. Remediation workflow + risk acceptance ────────────────────────────
  const openVulns = (await jfetch("/api/vapt/vulnerabilities?status=open&severity=medium", authed(cbeAdmin))).body.vulnerabilities;
  const work = openVulns.find((v) => !v.promotedFindingId) ?? openVulns[0];
  check("medium open finding available for workflow test", Boolean(work));
  if (work) {
    r = await jfetch(`/api/vapt/vulnerabilities/${work.id}`, jbody(cbeAdmin, { status: "in_progress" }, "PATCH"));
    check("PATCH → in_progress 200", r.status === 200 && r.body.result.status === "in_progress");
    r = await jfetch(`/api/vapt/vulnerabilities/${work.id}`, jbody(cbeAdmin, { status: "remediated" }, "PATCH"));
    check("PATCH → remediated stamps remediatedAt", r.status === 200 && r.body.result.remediatedAt !== null);

    const openHigh = (await jfetch("/api/vapt/vulnerabilities?status=open", authed(cbeAdmin))).body.vulnerabilities;
    const acc = openHigh.find((v) => v.severity === "low" || v.severity === "medium") ?? openHigh[0];
    if (acc) {
      r = await jfetch(`/api/vapt/vulnerabilities/${acc.id}`, jbody(cbeAdmin, { status: "accepted" }, "PATCH"));
      check("risk acceptance without note rejected 400", r.status === 400);
      r = await jfetch(`/api/vapt/vulnerabilities/${acc.id}`, jbody(cbeAdmin, { status: "accepted", note: "Compensating control in place (WAF rule); accepted for this cycle." }, "PATCH"));
      check("risk acceptance with note 200", r.status === 200 && r.body.result.status === "accepted");
      const detail = (await jfetch(`/api/vapt/vulnerabilities/${acc.id}`, authed(cbeAdmin))).body;
      check("accepted maps to WAIVED SLA semantics", detail.sla?.state === "WAIVED");
    }
  }

  // ── 6. Promotion into the Findings module ────────────────────────────────
  const openCrit = (await jfetch("/api/vapt/vulnerabilities?status=open&severity=critical&promoted=0", authed(cbeAdmin))).body.vulnerabilities
    .filter((v) => !v.promotedFindingId);
  const promoteTarget = openCrit[0];
  check("unpromoted critical available", Boolean(promoteTarget));
  let promotedFindingId = null;
  if (promoteTarget) {
    const beforeStats = (await jfetch("/api/stats", authed(cbeAdmin))).body;
    r = await jfetch(`/api/vapt/vulnerabilities/${promoteTarget.id}/promote`, { method: "POST", headers: { Cookie: cbeAdmin.cookie } });
    check("POST promote 201", r.status === 201, `status=${r.status} body=${JSON.stringify(r.body).slice(0, 120)}`);
    promotedFindingId = r.body.finding?.id;
    check("mirror finding carries SLA due date", Boolean(r.body.finding?.dueAt));
    check("mirror finding anchored to NBE-22", (r.body.finding?.rule?.code ?? "") === "NBE-22");
    r = await jfetch(`/api/vapt/vulnerabilities/${promoteTarget.id}/promote`, { method: "POST", headers: { Cookie: cbeAdmin.cookie } });
    check("second promote rejected 409", r.status === 409);

    const vulnDetail = (await jfetch(`/api/vapt/vulnerabilities/${promoteTarget.id}`, authed(cbeAdmin))).body.vulnerability;
    check("vuln carries promotedFindingId", vulnDetail.promotedFindingId === promotedFindingId);

    if (promotedFindingId) {
      // SLA dashboard sees the promoted corrective action.
      const sla = (await jfetch("/api/findings/sla", authed(cbeAdmin))).body;
      const inSla = (sla.findings ?? []).some((f) => f.id === promotedFindingId);
      check("promoted finding visible in /api/findings/sla", inSla);

      // Compliance aggregates exclude the mirror scan; findings/SLA include it.
      const afterStats = (await jfetch("/api/stats", authed(cbeAdmin))).body;
      check("stats: mirror scans excluded from scan counts", afterStats.scansCompleted === beforeStats.scansCompleted && afterStats.scansTotal === beforeStats.scansTotal, `before=${beforeStats.scansCompleted} after=${afterStats.scansCompleted}`);
      check("stats: avgScore unpolluted by mirror scans", Math.abs(afterStats.avgScore - beforeStats.avgScore) < 0.05, `before=${beforeStats.avgScore} after=${afterStats.avgScore}`);
      check("stats: recentScans free of VAPT mirrors", (afterStats.recentScans ?? []).every((s) => !s.name.startsWith("VAPT ▸")));
      check("stats: findings/SLA aggregation includes promoted vulns", afterStats.sla?.tracked >= (beforeStats.sla?.tracked ?? 0));
    }
  }

  // Seeded promotions exist (seed-vapt promotes four CBE criticals).
  const seededPromoted = (await jfetch("/api/vapt/vulnerabilities?promoted=1", authed(cbeAdmin))).body.vulnerabilities;
  check("seeded promotions present in queue", seededPromoted.length >= 4, `promoted=${seededPromoted.length}`);
  const seededSla = (await jfetch("/api/findings/sla", authed(cbeAdmin))).body;
  const seededVaptInFindings = (seededSla.findings ?? []).filter((f) => (f.findingEn ?? "").startsWith("VAPT"));
  check("seeded VAPT corrective actions in SLA dashboard", seededVaptInFindings.length >= 4, `found=${seededVaptInFindings.length}`);

  // ── 7. Bidirectional status sync ────────────────────────────────────────
  if (promotedFindingId) {
    r = await jfetch(`/api/findings/${promotedFindingId}`, jbody(cbeAdmin, { status: "in_progress" }, "PATCH"));
    check("PATCH promoted finding (Findings module) 200", r.status === 200);
    const synced = (await jfetch(`/api/vapt/vulnerabilities/${promoteTarget.id}`, authed(cbeAdmin))).body.vulnerability;
    check("VAPT record synced from Findings change", synced.status === "in_progress");
    r = await jfetch(`/api/findings/${promotedFindingId}`, jbody(cbeAdmin, { status: "remediated" }, "PATCH"));
    const synced2 = (await jfetch(`/api/vapt/vulnerabilities/${promoteTarget.id}`, authed(cbeAdmin))).body.vulnerability;
    check("remediation syncs with closure stamp", r.status === 200 && synced2.status === "remediated" && synced2.remediatedAt !== null);
  }

  // ── 8. Bid capability response matrix (NBE LOT4) ────────────────────────
  r = await jfetch("/api/vapt/bid-matrix", authed(cbeAdmin));
  check("GET /api/vapt/bid-matrix 200", r.status === 200);
  check("bid matrix carries 66 tender lines", r.body.summary?.total === 66, `total=${r.body.summary?.total}`);
  check("bid matrix statuses add up", (r.body.summary?.full ?? 0) + (r.body.summary?.partial ?? 0) + (r.body.summary?.roadmap ?? 0) === 66);
  check("bid matrix has 13 sections", r.body.sections?.length === 13, `sections=${r.body.sections?.length}`);
  check("bid matrix line G3 maps attack-path analysis", r.body.requirements?.some((x) => x.id === "G3" && x.status === "full" && /attack[- ]path/i.test(x.capability)));

  r = await jfetch("/api/vapt/bid-matrix?section=G&status=full", authed(cbeAdmin));
  check("bid matrix filter section+status works", r.status === 200 && r.body.requirements?.every((x) => x.section === "G" && x.status === "full") && r.body.requirements.length === 3, `n=${r.body.requirements?.length}`);

  const csvRes = await fetch(`${BASE}/api/vapt/bid-matrix?format=csv`, { headers: { Cookie: cbeAdmin.cookie } });
  const csvText = await csvRes.text();
  const csvLines = csvText.split("\n");
  check("bid matrix CSV export (66 rows + header)", csvRes.status === 200 && csvLines.length === 67 && (csvRes.headers.get("content-type") ?? "").includes("text/csv"), `lines=${csvLines.length}`);
  check("CSV includes tender line M3", csvLines.some((l) => l.includes("M3") && l.includes("Warranty")));

  r = await jfetch("/api/vapt/bid-matrix", authed({ cookie: "" }));
  check("bid matrix requires auth 401", r.status === 401);
  r = await jfetch("/api/vapt/bid-matrix", authed(dashenAuditor));
  check("bid matrix readable by VAPT viewer role", r.status === 200);

  // ── 9. AD attack paths (LOT4 §G) ────────────────────────────────────────
  r = await jfetch("/api/vapt/ad-paths", authed(cbeAdmin));
  check("GET /api/vapt/ad-paths 200", r.status === 200);
  check("ad graph domain is CBE.LOCAL", r.body.domain === "CBE.LOCAL");
  check("ad graph has 15 nodes / 19 edges", r.body.nodes?.length === 15 && r.body.edges?.length === 19, `n=${r.body.nodes?.length} e=${r.body.edges?.length}`);
  check("ad paths computed (multi-hop)", r.body.paths?.length >= 6, `paths=${r.body.paths?.length}`);
  check("ad shortest path is 4 hops", r.body.stats?.shortestHops === 4, `shortest=${r.body.stats?.shortestHops}`);
  const shortest = (r.body.paths ?? []).find((p) => p.shortest && p.targetId === "g-domain-admins");
  check("shortest path uses AS-REP roast technique", Boolean(shortest && shortest.techniques.includes("AsRepRoast")), shortest?.techniques?.join("+"));
  check("ad stats detect roastable accounts", (r.body.stats?.kerberoastable ?? []).includes("svc-sql") && (r.body.stats?.asrepRoastable ?? []).includes("svc-webapp"));
  check("ad tier-0 exposure covers both entries", r.body.stats?.tier0ExposurePct === 100, `${r.body.stats?.tier0ExposurePct}%`);
  check("chokepoint analysis present", (r.body.stats?.chokepoints ?? []).length >= 3 && r.body.stats.chokepoints[0].pathCount >= r.body.stats.chokepoints[1].pathCount);
  check("every path carries remediations", (r.body.paths ?? []).every((p) => p.remediations.length >= 4), `min=${Math.min(...(r.body.paths ?? [{ remediations: [] }]).map((p) => p.remediations.length))}`);

  r = await jfetch("/api/vapt/ad-paths?include=paths", authed(cbeAdmin));
  check("ad-paths include=paths omits graph payload", r.status === 200 && r.body.nodes === undefined && Array.isArray(r.body.paths));
  r = await jfetch("/api/vapt/ad-paths", authed(cbeViewer));
  check("ad-paths accessible to read-only viewer role", r.status === 200, `status=${r.status}`);
  r = await jfetch("/api/vapt/ad-paths", authed({ cookie: "" }));
  check("ad-paths requires auth 401", r.status === 401);

  // ── Wrap ─────────────────────────────────────────────────────────────────
  const overviewEnd = (await jfetch("/api/vapt/overview", authed(cbeAdmin))).body;
  check("KEV open count still exposes active exploitation risk", overviewEnd.kevOpenCount >= Math.max(1, kevBefore - 3), `kevOpen=${overviewEnd.kevOpenCount}`);

  // Audit trail recorded the VAPT events (most recent page).
  const auditEvents = (await jfetch("/api/auth/audit?page=1", authed(cbeAdmin))).body?.events ?? [];
  const vaptEventTypes = new Set(auditEvents.map((e) => e.type).filter((ty) => ty.startsWith("VAPT_")));
  check("VAPT operations audited", vaptEventTypes.size >= 3, [...vaptEventTypes].join(","));
} catch (err) {
  check("suite crashed", false, String(err).slice(0, 300));
}

const failed = results.filter((r) => r.startsWith("FAIL"));
console.log(results.join("\n"));
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) process.exit(1);
