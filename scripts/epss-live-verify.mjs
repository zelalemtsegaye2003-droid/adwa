/**
 * Adwa Cyber — live-EPSS persist-path verification (Real-Data Roadmap §5.3).
 * ---------------------------------------------------------------------
 * Creates a throwaway lab asset (vsftpd 2.3.4 on 127.0.0.1:3021), runs a
 * REAL INFRA scan on it, and asserts the engine's new EPSS path end-to-end:
 *   - every new CVE finding gets a LIVE FIRST score at scan time;
 *   - its evidence bundle carries the "EPSS live from FIRST (as of …)"
 *     provenance label;
 *   - the scan detail discloses the EPSS provenance split
 *     (live / bundled snapshot / heuristic prior);
 *   - dedupe: a second scan re-detects nothing new.
 * The throwaway asset is deleted afterwards (the API's own DELETE).
 *
 * Usage: node scripts/epss-live-verify.mjs   (dev stack + vuln-lab running)
 */
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
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
  const cap = await jfetch("/api/auth/captcha");
  const res = await jfetch("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password, captchaId: cap.body.captchaId, captchaAnswer: solveCaptcha(cap.body.svg) }),
  });
  if (res.status !== 200) throw new Error(`login failed: ${JSON.stringify(res.body).slice(0, 200)}`);
  return { cookie: res.headers.getSetCookie().map((c) => c.split(";")[0]).join("; "), user: res.body.user };
}

const admin = await login("admin@cbe.com.et", "Adwa#Demo2026!");
const authed = { headers: { Cookie: admin.cookie } };
const jbody = (payload) => ({ headers: { Cookie: admin.cookie, "Content-Type": "application/json" }, body: JSON.stringify(payload) });

try {
  // 1. throwaway asset on the lab's vsftpd port — no tracked history → new findings
  const created = await jfetch("/api/vapt/assets", {
    ...jbody({
      name: "EPSS live-path verification target (throwaway)",
      kind: "SERVER",
      identifier: "127.0.0.1:3021",
      environment: "DMZ",
      surface: "EXTERNAL",
      criticality: "HIGH",
      osOrPlatform: "Ubuntu 22.04",
      tags: ["throwaway"],
      notes: "created by epss-live-verify",
    }),
    method: "POST",
  });
  const asset = created.body.asset ?? created.body;
  check("1. throwaway asset created", created.status === 201 && !!asset?.id, `status ${created.status}`);

  // 2. REAL INFRA scan on it (four-eyes scope auto-resolved in dev)
  const scan = await jfetch("/api/vapt/scans", {
    ...jbody({ scanType: "INFRA", assetIds: [asset.id], ports: [3021], name: "EPSS live-path verification" }),
    method: "POST",
  });
  check("2. INFRA scan accepted", scan.status === 201, `status ${scan.status}`);
  const detail = scan.body?.scan?.detail ?? "";
  const epssNote = detail.match(/EPSS: [^.]+\./)?.[0] ?? "no EPSS note";
  check("2a. scan detail discloses the EPSS provenance split", /EPSS: \d+ live from FIRST, \d+ from the bundled snapshot/.test(detail), epssNote);
  check("2b. at least one LIVE FIRST score in the run", /EPSS: [1-9]/.test(detail), epssNote);

  // 3. the new finding carries the live score + labelled provenance
  const vulns = await jfetch("/api/vapt/vulnerabilities?q=CVE-2011-2523", authed);
  const vulnList = Array.isArray(vulns.body) ? vulns.body : (vulns.body.vulnerabilities ?? []);
  const finding = vulnList.find((v) => v.cveId === "CVE-2011-2523" && v.assetId === asset.id);
  check("3. vsftpd backdoor re-detected on the new asset", !!finding);
  const evRaw = finding?.evidence ?? {};
  const ev = typeof evRaw === "string" ? JSON.parse(evRaw) : evRaw;
  check("3a. evidence carries the live-FIRST provenance label", /EPSS live from FIRST \(as of \d{4}-\d{2}-\d{2}\)/.test(ev.epssProvenance ?? ""), ev.epssProvenance ?? "no label");
  check("3b. epss is the live FIRST score (0.9+ for the vsftpd backdoor)", finding?.epss >= 0.9, `epss=${finding?.epss}`);

  // 4. dedupe — a second scan of the same asset re-detects nothing new
  const scan2 = await jfetch("/api/vapt/scans", {
    ...jbody({ scanType: "INFRA", assetIds: [asset.id], ports: [3021], name: "EPSS live-path verification (rescan)" }),
    method: "POST",
  });
  check("4. rescan deduped (known, not re-created)", scan2.status === 201 && (scan2.body?.scan?.newCount ?? 1) === 0, `newCount=${scan2.body?.scan?.newCount}`);

  // 5. clean up the throwaway asset (its findings cascade)
  const del = await jfetch(`/api/vapt/assets/${asset.id}`, { ...authed, method: "DELETE" });
  check("5. throwaway asset deleted (findings cascade)", del.status === 200 || del.status === 204, `status ${del.status}`);
} catch (err) {
  results.push(`FAIL  suite crashed — ${err instanceof Error ? err.message : err}`);
}

console.log(results.join("\n"));
const failed = results.filter((r) => r.startsWith("FAIL")).length;
console.log(`\n${failed === 0 ? "ALL CHECKS PASSED" : `${failed} CHECK(S) FAILED`} (${results.length} checks)`);
process.exit(failed === 0 ? 0 : 1);
