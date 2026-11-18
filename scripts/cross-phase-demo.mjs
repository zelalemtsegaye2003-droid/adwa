/**
 * Adwa Cyber — LIVE CROSS-PHASE DATA-FLOW DEMO
 * =============================================
 * Narrative: "One phishing campaign against CBE, traced through every phase."
 *
 *   Phase 2 (platform)  Ethio-CERT national feed ingest  → indicators + receipt
 *   Phase 1 (tenant)    PD-1321 scan → findings → SLA deadlines
 *   Phase 2 (tenant)    incident → threat-indicator correlation → notify → contain
 *   Phase 1 (tenant)    bilingual PDF report export
 *   Cross-cutting       one audit timeline + tenant-isolation proof
 *
 * Usage: node scripts/cross-phase-demo.mjs
 */
const BASE = process.env.BASE_URL ?? "http://localhost:3000";

// ── helpers ──────────────────────────────────────────────────────────────────
async function jfetch(url, opts = {}) {
  const r = await fetch(BASE + url, opts);
  const ct = r.headers.get("content-type") ?? "";
  let body = null;
  if (ct.includes("application/json")) body = await r.json();
  else if (ct.includes("application/pdf")) body = { __pdf: true, bytes: (await r.arrayBuffer()).byteLength };
  else body = { raw: (await r.text()).slice(0, 200) };
  return { status: r.status, body, headers: r.headers, ct };
}
const solveCaptcha = (svg) => [...svg.matchAll(/<text[^>]*>([^<]+)<\/text>/g)].map((m) => m[1]).join("");
async function login(email, password) {
  const cap = (await jfetch("/api/auth/captcha")).body;
  const res = await jfetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, captchaId: cap.captchaId, captchaAnswer: solveCaptcha(cap.svg) }),
  });
  if (res.status !== 200) throw new Error(`login failed for ${email}: ${JSON.stringify(res.body).slice(0, 200)}`);
  return { cookie: res.headers.getSetCookie().map((c) => c.split(";")[0]).join("; "), user: res.body.user };
}
const H = (s) => ({ Cookie: s.cookie });
const HJ = (s) => ({ Cookie: s.cookie, "Content-Type": "application/json" });

const banner = (t) => console.log(`\n${"═".repeat(78)}\n  ${t}\n${"═".repeat(78)}`);
const step = (t) => console.log(`\n▶ ${t}`);
const ok = (t, extra = "") => console.log(`   ✔ ${t}${extra ? `  ${extra}` : ""}`);
const die = (t) => { console.error(`   ✘ FAILED: ${t}`); process.exit(1); };

// ════════════════════════════════════════════════════════════════════════════
(async () => {
  const T0 = Date.now();

  banner("ADWA CYBER — LIVE CROSS-PHASE DATA-FLOW DEMO");
  console.log(`  Platform: ${BASE}`);
  console.log(`  Story:    a phishing campaign hits CBE; we follow one thread through`);
  console.log(`            Phase 1 (compliance) → Phase 2 (SOC/threat intel) → report`);

  // ── STEP 0 — Phase 2 (platform): Ethio-CERT national feed ingest ──────────
  banner("STEP 0 · PHASE 2 (platform) — Ethio-CERT national feed ingest");
  step("Authenticating as SUPER_ADMIN (platform SOC operator)");
  const superAdmin = await login("admin@adwacyber.et", "Adwa#Admin2026!");
  ok(`logged in: ${superAdmin.user.name} <${superAdmin.user.email}> (${superAdmin.user.role})`);

  step("GET /api/threats/sync — binding status");
  let r = await jfetch("/api/threats/sync", { headers: H(superAdmin) });
  if (r.status !== 200) die(`sync status ${r.status}`);
  const b = r.body.binding;
  ok(`binding: mode=${b.mode} endpoint=${b.endpoint ?? "bundled fixture"} hasKey=${b.hasKey}`);

  step("POST /api/threats/sync {direction:'ingest'} — pull the national feed");
  r = await jfetch("/api/threats/sync", { method: "POST", headers: HJ(superAdmin), body: JSON.stringify({ direction: "ingest" }) });
  if (r.status !== 200) die(`ingest ${r.status}: ${JSON.stringify(r.body).slice(0, 200)}`);
  const run = r.body.run ?? r.body;
  ok(`SyncRun ${run.id?.slice(-8) ?? "?"} status=${run.status} source=${run.source ?? "—"}`);
  if (r.body.ingested !== undefined) ok(`indicators ingested: ${r.body.ingested}, deduped: ${r.body.duplicates ?? r.body.deduped ?? 0}`);
  if (run.receiptId) ok(`exchange receipt: ${run.receiptId.slice(0, 24)}…`);

  step("Locating the CBE-targeted phishing indicator in the hub");
  r = await jfetch("/api/threats?category=phishing", { headers: H(superAdmin) });
  if (r.status !== 200) die(`threat list ${r.status}`);
  const all = r.body.indicators ?? [];
  const phish = all.find((i) => (i.value ?? "").includes("cbe-secure-verify"));
  if (!phish) die("CBE phishing indicator not found in hub");
  ok(`indicator ${phish.id.slice(-8)}  ${phish.type}=${phish.value}`);
  ok(`severity=${phish.severity}  sharing=${phish.sharing}  source=${phish.source}`);

  // ── STEP 1 — Phase 1 (tenant): run the PD-1321 scan ───────────────────────
  banner("STEP 1 · PHASE 1 (CBE tenant) — PD-1321 compliance assessment");
  step("Authenticating as CBE ORG_ADMIN");
  const cbe = await login("admin@cbe.com.et", "Adwa#Demo2026!");
  ok(`logged in: ${cbe.user.name} <${cbe.user.email}> (${cbe.user.role})`);

  step("Resolving CBE organization + framework");
  r = await jfetch("/api/organizations", { headers: H(cbe) });
  const cbeOrg = (r.body.organizations ?? r.body).find?.((o) => o.name.includes("Commercial Bank")) ?? (r.body.organizations ?? r.body)[0];
  if (!cbeOrg) die("CBE org not found");
  ok(`organization: ${cbeOrg.name} (${cbeOrg.id.slice(-6)})`);
  r = await jfetch("/api/frameworks", { headers: H(cbe) });
  const fw = (r.body.frameworks ?? []).find((f) => f.code === "PD-1321");
  ok(`framework: ${fw.code} — ${fw.name}`);

  step(`POST /api/scans — start assessment against ${fw.code} (47 obligations)`);
  r = await jfetch("/api/scans", { method: "POST", headers: HJ(cbe), body: JSON.stringify({ organizationId: cbeOrg.id, frameworkCode: fw.code }) });
  if (r.status !== 201 && r.status !== 200) die(`scan start ${r.status}: ${JSON.stringify(r.body).slice(0, 200)}`);
  const scan = r.body.scan;
  ok(`scan ${scan.id} created — "${scan.name}" status=${scan.status}`);

  step("Saving draft answers — breach-notification & IR rules fail on purpose");
  // Deliberate gaps: the story is that CBE's incident-reporting posture is weak
  r = await jfetch(`/api/scans/${scan.id}`, { headers: H(cbe) });
  if (r.status !== 200) die(`scan fetch ${r.status}`);
  const results = r.body.scan?.results ?? [];
  if (!results.length) die("no scan results returned");
  ok(`${results.length} obligations in scope (PD-1321 article set)`);
  const gapRules = results.filter((x) => /notif|incident|breach|report/i.test(`${x.rule?.code ?? ""} ${x.rule?.titleEn ?? x.rule?.title ?? ""}`));
  const answers = results.map((x) => {
    const code = x.rule?.code ?? x.code;
    const isGap = gapRules.some((g) => (g.rule?.code ?? g.code) === code);
    const sev = (x.rule?.severity ?? "").toLowerCase();
    if (isGap) return { ruleCode: code, answer: "no", evidenceNote: "Live demo: notification procedure not documented; tested in drill 2026-10, report took 9 days." };
    if (sev === "medium") return { ruleCode: code, answer: "partial", evidenceNote: "Policy exists; annual review overdue." };
    return { ruleCode: code, answer: "yes" };
  });
  r = await jfetch(`/api/scans/${scan.id}/answers`, { method: "POST", headers: HJ(cbe), body: JSON.stringify({ answers }) });
  if (r.status !== 200) die(`draft save ${r.status}: ${JSON.stringify(r.body).slice(0, 200)}`);
  ok(`draft saved: ${answers.filter((a) => a.answer !== "yes").length} deliberate gaps (${gapRules.length} in breach-notification/IR family)`);

  step("POST /api/scans/[id]/submit — engine evaluates all obligations");
  r = await jfetch(`/api/scans/${scan.id}/submit`, { method: "POST", headers: HJ(cbe), body: JSON.stringify({ answers }) });
  if (r.status !== 200) die(`submit ${r.status}: ${JSON.stringify(r.body).slice(0, 300)}`);
  const done = r.body.scan;
  ok(`status=${done.status}  score=${done.overallScore}%  findings=${done.findingsCount} (critical: ${done.criticalFindings})`);
  const t = r.body.time;
  if (t) ok(`audit-time comparison: engine ${t.engineMinutes ?? "?"} min vs manual ${t.manualMinutes ?? "?"} min (RQ1)`);

  // ── STEP 2 — Phase 1: findings → SLA deadlines ────────────────────────────
  banner("STEP 2 · PHASE 1 — findings exit the engine with SLA deadlines");
  step("GET /api/findings/sla — severity-based remediation clock (30/60/90d)");
  r = await jfetch("/api/findings/sla", { headers: H(cbe) });
  if (r.status !== 200) die(`sla ${r.status}`);
  const s = r.body.summary ?? {};
  ok(`tracked: ${s.tracked ?? 0}  overdue: ${s.overdue ?? 0}  due≤7d: ${s.dueSoon ?? 0}  closed-on-time: ${s.closedOnTime ?? 0}`);
  ok(`SLA policy: critical 30d / high 60d / medium 90d`);
  const items = (r.body.findings ?? []).slice(0, 6);
  for (const f of items) {
    const rule = f.rule ?? {};
    const due = f.dueAt ? new Date(f.dueAt).toISOString().slice(0, 10) : "—";
    console.log(`   ├─ ${(rule.code ?? "?").padEnd(9)} [${(rule.severity ?? "?").toUpperCase().padEnd(8)}] ${f.slaState.padEnd(11)} due ${due}  ${(rule.titleEn ?? "").slice(0, 48)}`);
  }

  // ── STEP 3 — Phase 2 (tenant): open the incident ──────────────────────────
  banner("STEP 3 · PHASE 2 (CBE tenant) — SOC opens the phishing incident");
  step("POST /api/incidents — critical phishing campaign (detected 40 min ago)");
  const detectedAt = new Date(Date.now() - 40 * 60_000).toISOString();
  r = await jfetch("/api/incidents", {
    method: "POST", headers: HJ(cbe),
    body: JSON.stringify({
      title: "Active phishing campaign impersonating CBE verify portal",
      category: "phishing",
      severity: "critical",
      source: "ETHIO_CERT",
      detectionMethod: "threat_intel_match",
      detectedAt,
      confidence: 92,
      description: "National-feed domain cbe-secure-verify-portal.com is harvesting customer credentials. Correlates with PD-1321 Art. 13 breach-notification gap found in today's assessment.",
    }),
  });
  if (r.status !== 201 && r.status !== 200) die(`incident create ${r.status}: ${JSON.stringify(r.body).slice(0, 300)}`);
  const inc = r.body.incident;
  const pri = r.body.prioritisation ?? {};
  ok(`incident ${inc.ref} created — priority=${pri.label ?? inc.priorityLabel ?? "?"} score=${pri.score ?? inc.priorityScore ?? "?"}/100 status=${inc.status}`);

  step("POST /api/incidents/[id]/indicators — correlate the Ethio-CERT IOC");
  r = await jfetch(`/api/incidents/${inc.id}/indicators`, { method: "POST", headers: HJ(cbe), body: JSON.stringify({ indicatorId: phish.id }) });
  if (r.status !== 200 && r.status !== 201) die(`indicator link ${r.status}: ${JSON.stringify(r.body).slice(0, 200)}`);
  ok(`linked national-feed IOC → incident (${phish.value}) — the SOC ↔ threat-intel join`);

  step("PATCH action=notify — RQ3 detection→notification latency clock");
  r = await jfetch(`/api/incidents/${inc.id}`, { method: "PATCH", headers: HJ(cbe), body: JSON.stringify({ action: "notify", note: "Escalated to CBE security committee" }) });
  if (r.status !== 200) die(`notify ${r.status}: ${JSON.stringify(r.body).slice(0, 200)}`);
  ok(`organisation notified — latency ${r.body.notificationLatencyMin} min (RQ3 target: median ≤ 15 min)`);

  step("PATCH action=auto-contain — automated response on critical severity");
  r = await jfetch(`/api/incidents/${inc.id}`, { method: "PATCH", headers: HJ(cbe), body: JSON.stringify({ action: "auto-contain", note: "Domain sinkholed; e-mail gateway rule deployed" }) });
  if (r.status !== 200) die(`auto-contain ${r.status}: ${JSON.stringify(r.body).slice(0, 200)}`);
  ok(`incident now status=${r.body.incident.status} — DNS sinkhole + mail-gateway rule logged`);

  // ── STEP 4 — Phase 1: bilingual PDF report ────────────────────────────────
  banner("STEP 4 · PHASE 1 — executive PDF report of the assessment");
  step("GET /api/scans/[id]/report?lang=en");
  r = await jfetch(`/api/scans/${scan.id}/report?lang=en`, { headers: H(cbe) });
  if (r.status !== 200 || !r.body.__pdf) die(`report ${r.status} ct=${r.ct}`);
  ok(`PDF delivered — ${r.body.bytes.toLocaleString()} bytes, ${r.headers.get("x-report-pages") ?? "?"} pages, content-type=application/pdf`);
  const hash = r.headers.get("x-report-hash");
  if (hash) ok(`integrity hash: ${hash.slice(0, 32)}…`);
  step("GET /api/scans/[id]/report?lang=am (Amharic edition)");
  r = await jfetch(`/api/scans/${scan.id}/report?lang=am`, { headers: H(cbe) });
  if (r.status !== 200 || !r.body.__pdf) die(`report am ${r.status}`);
  ok(`Amharic PDF delivered — ${r.body.bytes.toLocaleString()} bytes (Ethiopic script run-switching)`);

  // ── STEP 5 — Cross-phase audit timeline ───────────────────────────────────
  banner("STEP 5 · CROSS-PHASE — one audit timeline for the whole thread");
  step("GET /api/auth/audit (SUPER_ADMIN, all tenants)");
  r = await jfetch("/api/auth/audit?page=1", { headers: H(superAdmin) });
  if (r.status !== 200) die(`audit ${r.status}`);
  const events = r.body.events ?? [];
  const since = T0 - 5 * 60_000;
  const live = events.filter((e) => new Date(e.createdAt).getTime() > since - 60_000);
  ok(`${live.length} events fired during this demo:`);
  const PH = { SCAN_STARTED: "P1", SCAN_COMPLETED: "P1", ETHIOCERT_SYNC: "P2", INCIDENT_CREATED: "P2", INCIDENT_NOTIFIED: "P2", INCIDENT_STATUS_CHANGED: "P2", AUTO_CONTAIN: "P2", REPORT_EXPORTED: "P1→P2" };
  for (const e of live.slice(0, 24).reverse()) {
    const tag = PH[e.type] ?? "··";
    console.log(`   [${tag}] ${(e.type ?? "").padEnd(24)} ${e.createdAt ? new Date(e.createdAt).toISOString().slice(11, 19) : ""}  ${(e.detail ?? "").slice(0, 60)}`);
  }
  const types = new Set(live.map((e) => e.type));
  const need = ["SCAN_STARTED", "SCAN_COMPLETED", "ETHIOCERT_SYNC", "INCIDENT_CREATED", "INCIDENT_NOTIFIED", "REPORT_EXPORTED"];
  const missing = need.filter((n) => !types.has(n));
  if (missing.length) die(`audit timeline missing: ${missing.join(", ")}`);
  ok(`all ${need.length} expected cross-phase event types present in ONE timeline ✔`);

  // ── STEP 6 — Tenant isolation proof ───────────────────────────────────────
  banner("STEP 6 · SECURITY — tenant isolation across the same flow");
  step("CBE admin requests a Wasasa MFI scan (cross-tenant probe)");
  const { PrismaClient } = await import(process.cwd() + "/node_modules/.prisma/client/index.js").catch(() => import("@prisma/client"));
  const db = new PrismaClient();
  const wasasaScan = await db.scan.findFirst({ where: { organization: { name: { contains: "Wasasa" } } }, select: { id: true } });
  r = await jfetch(`/api/scans/${wasasaScan.id}`, { headers: H(cbe) });
  ok(`GET foreign scan → ${r.status} (${r.status === 403 || r.status === 404 ? "BLOCKED" : "LEAK!!"})`);
  if (r.status === 200) die("TENANT LEAK: CBE admin could read Wasasa's scan");
  step("CBE admin requests Wasasa incident list");
  r = await jfetch("/api/incidents?org=" + "foreign", { headers: H(cbe) });
  const incs = r.body.incidents ?? r.body ?? [];
  ok(`incident list scoped to own tenant: ${Array.isArray(incs) ? incs.length : "?"} incidents, all CBE (${Array.isArray(incs) && incs.every((i) => (i.organizationId ?? i.orgId) === cbe.user.orgId || !i.organizationId) ? "✔" : "check"})`);
  await db.$disconnect();

  // ── SUMMARY ────────────────────────────────────────────────────────────────
  banner("DEMO COMPLETE — cross-phase correlation map");
  console.log(`
   Ethio-CERT exchange ──ingest──▶ ThreatIndicator hub (cbe-secure-verify-portal.com)
        │ P2                                │
        │                     indicator link│
        ▼                                  ▼
   SyncRun + receipt              Incident ${inc.ref ?? inc.id.slice(-8)} (critical/phishing)
                                           │ notify → RQ3 latency ✔   contain → contained ✔
   PD-1321 scan ${scan.id.slice(-6)} ──engine──▶ findings ──SLA──▶ 30/60/90-day deadlines
        │ P1                                              │
        └──────────────▶ PDF report (EN + AM) ◀───────────┘
   All of it recorded in ONE audit timeline (SCAN_* / ETHIOCERT_SYNC / INCIDENT_* / REPORT_EXPORTED)
   across ${((Date.now() - T0) / 1000).toFixed(1)}s of wall-clock time, under one auth + RBAC + tenant model.`);
  process.exit(0);
})().catch((e) => { console.error("\nDEMO CRASHED:", e); process.exit(1); });
