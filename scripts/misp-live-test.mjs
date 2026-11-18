/**
 * Adwa Cyber — self-hosted MISP private-exchange binding verification
 * (Real-Data Roadmap Phase 2, §5.1).
 * ---------------------------------------------------------------------
 * Verifies the live binding of the MISP connector against the development
 * mock of a self-hosted MISP instance (:3030 — mini-services/mock-misp,
 * started separately; the dev server must run with
 * MISP_URL=http://localhost:3030 MISP_API_KEY=adwa-dev-misp-key):
 *
 *   1. Mock contract: raw-key Authorization on /events/restSearch
 *   2. GET /api/threats/intel — MISP chip flips to configured with the
 *      mock endpoint recorded
 *   3. POST /api/threats/intel {source:"misp"} — LIVE run: 7 indicators
 *      ingested (sha1 honestly skipped, cross-event duplicate deduped),
 *      SyncRun LIVE, audit entry written
 *   4. Hub rows: MISP_FEED source, TLP:AMBER row hub-shareable, TLP:RED
 *      row kept inside the tenant (P2P sharing — never hub broadcast)
 *   5. Dedupe: second run refreshes (0 new), never duplicates
 *   6. RBAC: VIEWER cannot trigger the sync
 *
 * Usage: node scripts/misp-live-test.mjs   (dev server + mock on :3030)
 */
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const MOCK = process.env.MISP_MOCK_URL ?? "http://localhost:3030";
const MOCK_KEY = process.env.MISP_API_KEY ?? "adwa-dev-misp-key";

async function jfetch(url, opts = {}) {
  const r = await fetch(url, opts);
  let body = null;
  const ct = r.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) body = await r.json();
  else body = { raw: (await r.text()).slice(0, 120) };
  return { status: r.status, body, headers: r.headers };
}

function solveCaptcha(svg) {
  return [...svg.matchAll(/<text[^>]*>([^<]+)<\/text>/g)].map((m) => m[1]).join("");
}

async function login(email, password) {
  const cap = await jfetch(`${BASE}/api/auth/captcha`);
  const res = await jfetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, captchaId: cap.body.captchaId, captchaAnswer: solveCaptcha(cap.body.svg) }),
  });
  if (res.status !== 200) throw new Error(`login failed for ${email}: ${JSON.stringify(res.body).slice(0, 200)}`);
  return { cookie: res.headers.getSetCookie().map((c) => c.split(";")[0]).join("; "), user: res.body.user };
}

const authed = (s) => ({ headers: { Cookie: s.cookie } });
const jbody = (s, payload) => ({
  headers: { Cookie: s.cookie, "Content-Type": "application/json" },
  body: JSON.stringify(payload),
});

const results = [];
const check = (name, cond, extra = "") => results.push(`${cond ? "PASS" : "FAIL"}  ${name}${extra ? " — " + extra : ""}`);

try {
  const super_admin = await login("admin@adwacyber.et", "Adwa#Admin2026!");
  const viewer = await login("viewer@ethiotelecom.et", "Adwa#Demo2026!");

  // ── 1. Mock contract ──────────────────────────────────────────────────────
  const unauth = await jfetch(`${MOCK}/events/restSearch`, { method: "POST", body: "{}", headers: { "Content-Type": "application/json" } });
  check("1. mock rejects missing raw-key Authorization → 401", unauth.status === 401, `status ${unauth.status}`);
  const authedMock = await jfetch(`${MOCK}/events/restSearch`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: MOCK_KEY },
    body: JSON.stringify({ returnformat: "json", published: true, timestamp: 0, limit: 25, page: 1 }),
  });
  check("1a. mock serves restSearch fixture with raw key", authedMock.status === 200 && Array.isArray(authedMock.body?.response), `status ${authedMock.status}`);
  const ev101 = authedMock.body?.response?.[0]?.Event;
  check("1b. fixture: TLP:AMBER banking phishing event", ev101?.Tag?.some((t) => t.name === "tlp:amber") && /phishing/.test(ev101?.info ?? ""));

  // ── 2. Connector registry flips to configured ───────────────────────────
  const st = await jfetch(`${BASE}/api/threats/intel`, authed(super_admin));
  const mispChip = (st.body.feeds ?? []).find((f) => f.id === "misp");
  check("2. MISP chip configured against the mock endpoint", mispChip?.configured === true && mispChip?.endpoint === `${MOCK}/events/restSearch`, JSON.stringify(mispChip ?? null));

  // ── 3. LIVE ingest ────────────────────────────────────────────────────────
  const r1 = await jfetch(`${BASE}/api/threats/intel`, { ...jbody(super_admin, { source: "misp" }), method: "POST" });
  const misp1 = r1.body?.summary?.misp ?? {};
  check("3. POST sync (misp) as SUPER_ADMIN → 200", r1.status === 200, `status ${r1.status} ${JSON.stringify(r1.body).slice(0, 160)}`);
  check("3a. LIVE mode with 7 indicators (sha1 skipped, duplicate deduped)", misp1.mode === "live" && misp1.ingested === 7, `mode=${misp1.mode} ingested=${misp1.ingested}`);
  check("3b. run recorded against the mock endpoint", (r1.body.runs ?? []).some((run) => run.source === "LIVE" && run.endpoint === `${MOCK}/events/restSearch`));

  // ── 4. Hub rows + TLP honouring ───────────────────────────────────────────
  const hub = await jfetch(`${BASE}/api/threats`, authed(super_admin));
  const mispRows = (hub.body.indicators ?? []).filter((i) => i.source === "MISP_FEED");
  check("4. MISP indicators in the hub", mispRows.length === 7, `${mispRows.length} rows`);
  const amberRow = mispRows.find((r) => r.value === "cbe-secure-verify.example.net");
  check("4a. TLP:AMBER row present (banking phishing domain)", amberRow?.tlp === "TLP:AMBER" && amberRow?.category === "phishing" && amberRow?.type === "domain", `${amberRow?.tlp}/${amberRow?.category}/${amberRow?.type}`);
  const redRow = mispRows.find((r) => r.tlp === "TLP:RED");
  check("4b. TLP:RED row present (restricted sector malware)", redRow?.type === "hash_sha256" && redRow?.category === "malware");
  check("4c. TLP:RED row never hub-broadcast (P2P inside the tenant)", redRow?.sharing === "P2P", `sharing=${redRow?.sharing}`);
  check("4d. TLP:AMBER row hub-broadcastable", amberRow?.sharing === "HUB", `sharing=${amberRow?.sharing}`);
  const toIdsRow = mispRows.find((r) => r.value === "https://cbe-secure-verify.example.net/login?id=ebf8");
  check("4e. to_ids attribute → confidence 90", toIdsRow?.confidence === 90, `confidence=${toIdsRow?.confidence}`);
  const emailRow = mispRows.find((r) => r.type === "email");
  check("4f. email indicator mapped", emailRow?.value === "cbe.kyc.desk@example.org");
  const filenameRow = mispRows.find((r) => r.type === "filename");
  check("4g. filename|sha256 → filename indicator", filenameRow?.value?.startsWith("update_kyc.exe|") === true, filenameRow?.value);
  const auditRes = await jfetch(`${BASE}/api/auth/audit?take=50`, authed(super_admin));
  const auditRows = (auditRes.body.events ?? auditRes.body.rows ?? auditRes.body.audit ?? []);
  check("4h. PUBLIC_INTEL_SYNC audit entry for the MISP run", auditRows.some((e) => /PUBLIC_INTEL_SYNC/.test(String(e.type)) && /MISP/i.test(String(e.detail))));

  // ── 5. Dedupe ────────────────────────────────────────────────────────────
  const r2 = await jfetch(`${BASE}/api/threats/intel`, { ...jbody(super_admin, { source: "misp" }), method: "POST" });
  check("5. second sync → 0 new, 7 refreshed", r2.status === 200 && r2.body.totals?.ingested === 0 && r2.body.totals?.updated === 7, `ingested=${r2.body.totals?.ingested} updated=${r2.body.totals?.updated}`);
  const hub2 = await jfetch(`${BASE}/api/threats`, authed(super_admin));
  const mispRows2 = (hub2.body.indicators ?? []).filter((i) => i.source === "MISP_FEED");
  check("5a. no duplicates created", mispRows2.length === mispRows.length, `${mispRows.length} → ${mispRows2.length}`);

  // ── 6. RBAC ──────────────────────────────────────────────────────────────
  const rViewer = await jfetch(`${BASE}/api/threats/intel`, { ...jbody(viewer, { source: "misp" }), method: "POST" });
  check("6. VIEWER POST → 403", rViewer.status === 403, `status ${rViewer.status}`);

  console.log(`\nHub now carries ${mispRows.length} MISP indicators from the private exchange binding.`);
} catch (err) {
  results.push(`FAIL  suite crashed — ${err instanceof Error ? err.message : err}`);
}

console.log(results.join("\n"));
const failed = results.filter((r) => r.startsWith("FAIL")).length;
console.log(`\n${failed === 0 ? "ALL CHECKS PASSED" : `${failed} CHECK(S) FAILED`} (${results.length} checks)`);
process.exit(failed === 0 ? 0 : 1);
