/**
 * Adwa Cyber — VAPT input/output demonstration (real data, real probes).
 *
 * Logs in as the CBE org admin and walks the REAL VAPT loop end to end,
 * printing the exact INPUT (request) and OUTPUT (response) of each step so
 * the console transcript doubles as the API contract reference:
 *
 *   1. FULL scan against the vulnerable lab target (real TCP/TLS/HTTP probes)
 *   2. Custom-check LIVE test-run — in scope (evaluates real banners)
 *   3. Custom-check test-run — out of scope (rejected at the gate, 403)
 *   4. A detected vulnerability with its full evidence bundle
 *
 * Usage: node scripts/vapt-io-demo.mjs   (seeded dev stack + vuln-lab up)
 */
const BASE = process.env.BASE_URL ?? "http://localhost:3000";

async function jfetch(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", ...(opts.headers ?? {}) },
  });
  let body = null;
  try { body = await res.json(); } catch { /* non-JSON */ }
  return { status: res.status, body, headers: res.headers };
}

function solveCaptcha(svg) {
  return [...svg.matchAll(/<text[^>]*>([^<]+)<\/text>/g)].map((m) => m[1]).join("");
}

async function login(email, password) {
  const cap = (await jfetch("/api/auth/captcha")).body;
  const res = await jfetch("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password, captchaId: cap.captchaId, captchaAnswer: solveCaptcha(cap.svg) }),
  });
  if (res.status !== 200) throw new Error(`login failed: ${JSON.stringify(res.body).slice(0, 200)}`);
  return res.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
}

const line = (t) => console.log(`\n${"═".repeat(78)}\n${t}\n${"═".repeat(78)}`);

// ── 0. Login ─────────────────────────────────────────────────────────────────
const cookie = await login("admin@cbe.com.et", "Adwa#Demo2026!");
const authed = { headers: { Cookie: cookie } };
const jbody = (payload, method = "POST") => ({
  method, headers: { Cookie: cookie, "Content-Type": "application/json" }, body: JSON.stringify(payload),
});

// Resolve the lab assets (registered by seed:vapt).
const assets = (await jfetch("/api/vapt/assets", authed)).body.assets;
const labHost = assets.find((a) => a.identifier === "127.0.0.1");
const labWeb = assets.find((a) => a.identifier === "http://127.0.0.1:3060");

// ── 1. FULL scan — the core INPUT → OUTPUT ──────────────────────────────────
line("1. POST /api/vapt/scans — FULL scan of the vulnerable lab target");
const scanInput = {
  scanType: "FULL", // DISCOVERY | INFRA | DAST | FULL
  profile: "SAFE", // SAFE (default) | INTRUSIVE (needs the scope's four-eyes opt-in)
  assetIds: [labHost.id, labWeb.id],
  ports: [3021, 3022, 3060, 3061, 3062],
  name: "VAPT I/O demo — live scan of the lab target",
};
console.log("INPUT:\n" + JSON.stringify({ ...scanInput, assetIds: `[${scanInput.assetIds.length} lab asset ids]` }, null, 2));
let r = await jfetch("/api/vapt/scans", jbody(scanInput));
const scan = r.body.scan;
console.log(`\nOUTPUT (HTTP ${r.status}):\n` + JSON.stringify({
  scan: {
    id: scan.id, name: scan.name, scanType: scan.scanType, profile: scan.profile,
    status: scan.status, engineMode: scan.engineMode,
    infraReal: scan.infraReal, dastReal: scan.dastReal,
    newCount: scan.newCount, knownCount: scan.knownCount, autoClosedCount: scan.autoClosedCount,
    scopeId: scan.scopeId, durationMs: scan.durationMs,
    summary: scan.summary,
  },
  infraReports: r.body.infraReports,
  dastReports: r.body.dastReports,
}, null, 2));

// ── 2. Custom-check live test-run (in scope) ────────────────────────────────
line("2. POST /api/vapt/checks/[id]/test — custom check, IN-SCOPE target");
let checks = (await jfetch("/api/vapt/checks", authed)).body.checks;
let check = checks[0];
if (!check) {
  r = await jfetch("/api/vapt/checks", jbody({
    name: "Lab FTP banner check (demo)",
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
  check = r.body.check;
}
const testInput = { target: "127.0.0.1", ports: [3021, 3060, 3062] };
console.log("INPUT:\n" + JSON.stringify({ endpoint: `/api/vapt/checks/${check.id}/test`, body: testInput }, null, 2));
r = await jfetch(`/api/vapt/checks/${check.id}/test`, jbody(testInput));
console.log(`\nOUTPUT (HTTP ${r.status}):\n` + JSON.stringify({
  check: r.body.check, scope: r.body.scope, target: r.body.target,
  reachable: r.body.reachable, openPorts: r.body.openPorts,
  probeError: r.body.probeError, result: r.body.result,
}, null, 2));

// ── 3. Custom-check test-run (out of scope → gate rejects) ──────────────────
line("3. POST /api/vapt/checks/[id]/test — out-of-scope target (authorization gate)");
const oosInput = { target: "8.8.8.8" };
console.log("INPUT:\n" + JSON.stringify({ endpoint: `/api/vapt/checks/${check.id}/test`, body: oosInput }, null, 2));
r = await jfetch(`/api/vapt/checks/${check.id}/test`, jbody(oosInput));
console.log(`\nOUTPUT (HTTP ${r.status}):\n` + JSON.stringify(r.body, null, 2));

// ── 4. A detected vulnerability — the tracked unit of work ───────────────────
line("4. GET /api/vapt/vulnerabilities?q=vsftpd — a detected finding (evidence bundle)");
r = await jfetch("/api/vapt/vulnerabilities?q=vsftpd", authed);
const v = r.body.vulnerabilities.find((x) => x.evidence?.mode === "infra-live") ?? r.body.vulnerabilities[0];
console.log("INPUT: GET /api/vapt/vulnerabilities?q=vsftpd  (filters: status, severity, promoted, q)\n");
console.log(`OUTPUT (HTTP ${r.status}) — one row of ${r.body.vulnerabilities.length}:\n` + JSON.stringify(v, null, 2));
