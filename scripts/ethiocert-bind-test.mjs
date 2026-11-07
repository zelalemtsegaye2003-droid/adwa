/**
 * Adwa Cyber — Ethio-CERT exchange binding verification (sync layer).
 * ---------------------------------------------------------------------
 * Verifies the live binding of the synchronisation layer to the national
 * exchange API (development mock on :3020 — mini-services/mock-ethiocert,
 * started by .devscripts/dev.sh):
 *
 *   1. Exchange mock contract: bearer auth on /feed, feed content
 *   2. GET /api/threats/sync — binding status (live, endpoint, key)
 *   3. GET /api/soc/metrics — binding surfaced to the SOC overview
 *   4. Ingest via the LIVE binding: run.source LIVE, endpoint recorded,
 *      dedupe against the 8 fixture-sourced indicators
 *   5. Upward report via the LIVE binding: receipt returned + stored,
 *      payload sha256 verifiable locally
 *   6. End-to-end integrity: the exchange received exactly the bytes the
 *      platform hashed (mock sha256 === platform payloadHash), sector-level
 *      attribution only
 *   7. RBAC: VIEWER cannot trigger sync
 *
 * Usage: node scripts/ethiocert-bind-test.mjs   (dev server + mock on :3020)
 */
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const MOCK = process.env.ETHIOCERT_MOCK_URL ?? "http://localhost:3020";
const MOCK_KEY = process.env.ETHIOCERT_API_KEY ?? "adwa-dev-ethiocert-key";

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
  const cap = (await jfetch(`${BASE}/api/auth/captcha`)).body;
  const res = await jfetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, captchaId: cap.captchaId, captchaAnswer: solveCaptcha(cap.svg) }),
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
  // ── 1. Exchange mock contract ──────────────────────────────────────────────
  let r = await jfetch(`${MOCK}/feed`);
  check("exchange rejects unauthenticated /feed (401)", r.status === 401);
  r = await jfetch(`${MOCK}/feed`, { headers: { Authorization: `Bearer ${MOCK_KEY}` } });
  check("exchange serves the national feed", r.status === 200 && Array.isArray(r.body.feed), `status=${r.status}`);
  check("exchange feed carries the 8 reference entries", r.status === 200 && r.body.feed.length === 8, `n=${r.body?.feed?.length}`);
  check(
    "feed entries satisfy the FeedEntry contract",
    r.status === 200 && r.body.feed.every((e) => ["ip", "domain", "url", "hash_sha256", "email", "filename"].includes(e.type) && e.value && ["critical", "high", "medium", "low"].includes(e.severity))
  );

  // ── 2. Platform binding status ─────────────────────────────────────────────
  const superAdmin = await login("admin@adwacyber.et", "Adwa#Admin2026!");
  const cbeAdmin = await login("admin@cbe.com.et", "Adwa#Demo2026!");
  const viewer = await login("viewer@ethiotelecom.et", "Adwa#Demo2026!");

  r = await jfetch(`${BASE}/api/threats/sync`, authed(superAdmin));
  check("GET /api/threats/sync 200", r.status === 200);
  check("binding reports live mode", r.body.binding?.mode === "live", JSON.stringify(r.body.binding));
  check("binding names the exchange endpoint", typeof r.body.binding?.endpoint === "string" && r.body.binding.endpoint.includes(":3020"), r.body.binding?.endpoint);
  check("binding reports a configured key", r.body.binding?.hasKey === true);

  // ── 3. Metrics carry the binding (SOC overview feed) ───────────────────────
  r = await jfetch(`${BASE}/api/soc/metrics`, authed(cbeAdmin));
  check("GET /api/soc/metrics carries binding", r.status === 200 && r.body.binding?.mode === "live" && typeof r.body.binding?.endpoint === "string");

  // ── 4. LIVE ingest ─────────────────────────────────────────────────────────
  r = await jfetch(`${BASE}/api/threats/sync`, { ...jbody(superAdmin, { direction: "ingest" }), method: "POST" });
  check("ingest via exchange 200", r.status === 200, JSON.stringify(r.body).slice(0, 140));
  check("ingest reports live feed mode", r.body.feed?.mode === "live" && typeof r.body.feed?.endpoint === "string");
  check("ingest run recorded as LIVE", r.body.run?.source === "LIVE" && typeof r.body.run?.endpoint === "string");
  check("ingest processed all 8 feed entries", r.body.ingested + r.body.updated === 8, `new=${r.body.ingested} upd=${r.body.updated}`);

  // Re-ingest is idempotent through the exchange (dedupe)
  r = await jfetch(`${BASE}/api/threats/sync`, { ...jbody(superAdmin, { direction: "ingest" }), method: "POST" });
  check("re-ingest dedupes via exchange (0 new)", r.status === 200 && r.body.ingested === 0 && r.body.updated === 8, `new=${r.body.ingested} upd=${r.body.updated}`);

  // ── 5. LIVE upward report ──────────────────────────────────────────────────
  r = await jfetch(`${BASE}/api/threats/sync`, { ...jbody(cbeAdmin, { direction: "report" }), method: "POST" });
  check("upward report delivered 200", r.status === 200, JSON.stringify(r.body).slice(0, 140));
  check("delivery reports live mode with receipt", r.body.delivery?.mode === "live" && /^EC-RCPT-[A-F0-9]{10}$/.test(r.body.delivery?.receiptId ?? ""), r.body.delivery?.receiptId);
  check("run stores receipt + LIVE source", r.body.run?.source === "LIVE" && r.body.run?.receiptId === r.body.delivery?.receiptId);
  check("run keeps the sha256 payload proof", /^[a-f0-9]{64}$/.test(r.body.payloadHash ?? ""));
  const payloadStr = JSON.stringify(r.body.payload);
  check("payload still anonymised (no org identity)", !payloadStr.includes("Commercial Bank") && r.body.payload.reportingEntity.includes("member organisation"));

  // ── 6. End-to-end integrity at the exchange ────────────────────────────────
  // (super admin sees the full payloadHash; org users only the 16-char prefix)
  r = await jfetch(`${BASE}/api/threats/sync`, authed(superAdmin));
  const reportRun = r.body.runs.find((x) => x.direction === "REPORT" && x.source === "LIVE");
  check("runs list shows the LIVE report with receipt", !!reportRun && !!reportRun.receiptId && reportRun.receiptId.startsWith("EC-RCPT-"), reportRun?.receiptId);
  r = await jfetch(`${MOCK}/reports`, { headers: { Authorization: `Bearer ${MOCK_KEY}` } });
  check("exchange received the report", r.status === 200 && r.body.count >= 1, `count=${r.body.count}`);
  const last = r.body.receipts[r.body.receipts.length - 1];
  check("exchange receipt matches the platform receipt", last?.receiptId === reportRun?.receiptId, `${last?.receiptId} vs ${reportRun?.receiptId}`);
  check("exchange saw exactly the hashed bytes (sha256)", typeof last?.sha256 === "string" && last.sha256.length === 64 && last.sha256 === reportRun?.payloadHash, `${(last?.sha256 ?? "").slice(0, 12)}…`);
  check("exchange saw sector-level attribution only", last?.sector === "Banking");

  // ── 7. RBAC ────────────────────────────────────────────────────────────────
  r = await jfetch(`${BASE}/api/threats/sync`, { ...jbody(viewer, { direction: "report" }), method: "POST" });
  check("VIEWER cannot trigger sync 403", r.status === 403);
  r = await jfetch(`${BASE}/api/threats/sync`);
  check("unauthenticated sync 401", r.status === 401);
} catch (err) {
  results.push(`FAIL  crashed: ${err.message}`);
}

const passed = results.filter((x) => x.startsWith("PASS")).length;
console.log(`\nEthio-CERT exchange binding — ${passed}/${results.length} checks passed\n`);
for (const line of results) console.log(line);
process.exit(passed === results.length ? 0 : 1);
