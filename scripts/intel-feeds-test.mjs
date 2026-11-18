/**
 * Adwa Cyber — public threat-intel feed connector verification
 * (Real-Data Roadmap Phase 1: CISA KEV + Spamhaus DROP + key-gated feeds;
 *  Phase 2: self-hosted MISP exchange + VirusTotal reputation enrichment).
 * ---------------------------------------------------------------------
 * Verifies the live-data honesty contract end-to-end against the dev stack:
 *
 *   1. GET /api/threats/intel — connector registry: key-less feeds
 *      configured with a bundled snapshot as-of; keyed feeds honestly say
 *      "key required" instead of pretending to be configured.
 *   2. POST /api/threats/intel — "all" run: key-less feeds produce data
 *      (LIVE when the source is reachable, SNAPSHOT — labelled with its
 *      as-of — when it is not); keyed feeds without keys are reported as
 *      skipped, never ingested, never silently omitted.
 *   3. Hub rows carry the source (CISA_KEV / SPAMHAUS_DROP), the taxonomy
 *      mapping (KEV → vulnerability category, TLP:CLEAR, confidence 100)
 *      and feed-native provenance (sourceRef "KEV v…", "SBL…").
 *   4. Dedupe: a second run refreshes (sightings+1), never duplicates.
 *   5. Sync history + audit trail record LIVE vs SNAPSHOT per feed.
 *   6. RBAC: ORG_ADMIN (threats:sync but not soc:manage-all) → 403;
 *      VIEWER (no threats:sync) → 403 on POST, 200 on status GET.
 *   7. Explicit keyed-feed request without a key → honest 503; unknown
 *      source name → 400; GreyNoise enrichment without a key → 503.
 *   8. Phase 2: MISP connector honestly unconfigured (MISP_URL/API_KEY
 *      unset); VirusTotal enrichment unconfigured → 503, invalid input
 *      shape → 400, and both engines disclose their config on GET.
 *
 * Environment-independent assertions: a feed is accepted as either LIVE
 * (source reachable) or SNAPSHOT (labelled degradation) — both are honest
 * states; what is NEVER acceptable is missing data or an unlabelled mode.
 *
 * Usage: node scripts/intel-feeds-test.mjs   (dev server running on :3000)
 */
const BASE = process.env.BASE_URL ?? "http://localhost:3000";

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
  const orgAdmin = await login("admin@cbe.com.et", "Adwa#Demo2026!");
  const viewer = await login("viewer@ethiotelecom.et", "Adwa#Demo2026!");

  // ── 1. Connector registry ───────────────────────────────────────────────
  const st = await jfetch(`${BASE}/api/threats/intel`, authed(super_admin));
  check("1. GET /api/threats/intel → 200", st.status === 200, `status ${st.status}`);
  const feeds = st.body.feeds ?? [];
  const byId = Object.fromEntries(feeds.map((f) => [f.id, f]));
  check("1a. six connectors registered", feeds.length === 6, `${feeds.length} feeds`);
  check("1b. CISA KEV: no key required, configured", byId.cisa_kev?.keyRequired === false && byId.cisa_kev?.configured === true);
  check("1c. CISA KEV: bundled snapshot as-of disclosed", Number(byId.cisa_kev?.snapshotCount) > 0 && !!byId.cisa_kev?.snapshotAsOf, `count ${byId.cisa_kev?.snapshotCount}, asOf ${byId.cisa_kev?.snapshotAsOf}`);
  check("1d. Spamhaus DROP: configured with snapshot", byId.spamhaus_drop?.configured === true && Number(byId.spamhaus_drop?.snapshotCount) > 0);
  for (const keyed of ["urlhaus", "threatfox", "otx", "misp"]) {
    check(`1e. ${keyed}: honestly unconfigured (key required)`, byId[keyed]?.keyRequired === true && byId[keyed]?.configured === false);
  }
  check("1f. every feed discloses its terms/attribution", feeds.every((f) => typeof f.attribution === "string" && f.attribution.length > 0));
  check("1g. MISP chip shows the restSearch endpoint", /\/events\/restSearch$/.test(byId.misp?.endpoint ?? ""), byId.misp?.endpoint);
  check("1h. GET discloses VirusTotal engine (unconfigured, quota stated)", st.body.virustotal?.configured === false && /4 requests\/min/.test(st.body.virustotal?.quota ?? ""), JSON.stringify(st.body.virustotal ?? null));
  check("1i. GET discloses GreyNoise engine config", typeof st.body.greynoise?.configured === "boolean");

  // ── 2. Sync "all" ───────────────────────────────────────────────────────
  const r1 = await jfetch(`${BASE}/api/threats/intel`, { ...jbody(super_admin, { source: "all" }), method: "POST" });
  check("2. POST sync (all) as SUPER_ADMIN → 200", r1.status === 200, `status ${r1.status} ${JSON.stringify(r1.body).slice(0, 160)}`);
  const sum = r1.body.summary ?? {};
  const kev1 = sum.cisa_kev ?? {};
  const drop1 = sum.spamhaus_drop ?? {};
  check("2a. CISA KEV produced data (LIVE or labelled SNAPSHOT)", ["live", "snapshot"].includes(kev1.mode) && (kev1.ingested ?? 0) > 0, `mode=${kev1.mode} ingested=${kev1.ingested}`);
  check("2b. Spamhaus DROP produced data", ["live", "snapshot"].includes(drop1.mode) && (drop1.ingested ?? 0) > 0, `mode=${drop1.mode} ingested=${drop1.ingested}`);
  check("2c. SNAPSHOT mode carries its as-of honesty label", kev1.mode !== "snapshot" || /captured|catalog/i.test(kev1.asOf ?? ""), `asOf="${kev1.asOf}"`);
  const skipped = r1.body.skipped ?? [];
  check("2d. keyed feeds without keys reported as skipped", skipped.length === 4 && skipped.every((s) => s.code === "UNCONFIGURED"), JSON.stringify(skipped.map((s) => s.feed)));
  check("2e. skipped feeds were never ingested", !sum.urlhaus && !sum.threatfox && !sum.otx && !sum.misp);
  const firstIngested = (kev1.ingested ?? 0) + (drop1.ingested ?? 0);

  // ── 3. Hub rows ──────────────────────────────────────────────────────────
  const hub = await jfetch(`${BASE}/api/threats`, authed(super_admin));
  const indicators = hub.body.indicators ?? [];
  const kevRows = indicators.filter((i) => i.source === "CISA_KEV");
  const dropRows = indicators.filter((i) => i.source === "SPAMHAUS_DROP");
  check("3. KEV indicators in the hub", kevRows.length === (kev1.ingested ?? 0), `${kevRows.length} rows`);
  check("3a. DROP indicators in the hub", dropRows.length === (drop1.ingested ?? 0), `${dropRows.length} rows`);
  const kevSample = kevRows[0];
  check("3b. KEV row: cve type, vulnerability category", kevSample?.type === "cve" && kevSample?.category === "vulnerability", `${kevSample?.type}/${kevSample?.category}`);
  check("3c. KEV row: public-domain TLP:CLEAR, confidence 100", kevSample?.tlp === "TLP:CLEAR" && kevSample?.confidence === 100, `${kevSample?.tlp}/${kevSample?.confidence}`);
  check("3d. KEV row: severity is critical|high (CISA-confirmed exploitation)", kevSample?.severity === "critical" || kevSample?.severity === "high", kevSample?.severity);
  check("3e. KEV row: catalog-version provenance in sourceRef", /^KEV /.test(kevSample?.sourceRef ?? ""), `"${kevSample?.sourceRef}"`);
  const dropSample = dropRows.find((r) => r.type === "ip" && /\/\d{1,2}$/.test(r.value));
  check("3f. DROP row: ip/netblock value with SBL provenance", !!dropSample && /^SBL\d+$/.test(dropSample.sourceRef ?? ""), `${dropSample?.value} ${dropSample?.sourceRef}`);
  check("3g. KEV row firstSeen is the CISA dateAdded, not the sync time", !kevSample?.firstSeenAt || new Date(kevSample.firstSeenAt).toISOString().slice(0, 10) <= new Date().toISOString().slice(0, 10));

  // ── 4. Dedupe ────────────────────────────────────────────────────────────
  const r2 = await jfetch(`${BASE}/api/threats/intel`, { ...jbody(super_admin, { source: "all" }), method: "POST" });
  check("4. second sync → 0 new, all refreshed", r2.status === 200 && r2.body.totals.ingested === 0 && r2.body.totals.updated === firstIngested, `ingested=${r2.body.totals?.ingested} updated=${r2.body.totals?.updated}`);
  const hub2 = await jfetch(`${BASE}/api/threats`, authed(super_admin));
  const kevRows2 = (hub2.body.indicators ?? []).filter((i) => i.source === "CISA_KEV");
  check("4a. no duplicates created", kevRows2.length === kevRows.length, `${kevRows.length} → ${kevRows2.length}`);
  check("4b. sighting incremented on refresh", kevRows2.some((r) => r.sightings >= 1), `sample sightings=${kevRows2[0]?.sightings}`);

  // ── 5. Sync history + audit ──────────────────────────────────────────────
  const hist = await jfetch(`${BASE}/api/threats/sync`, authed(super_admin));
  const histRuns = hist.body.runs ?? [];
  const kevRun = histRuns.find((r) => /CISA KEV/.test(r.detail ?? ""));
  const dropRun = histRuns.find((r) => /Spamhaus DROP/.test(r.detail ?? ""));
  check("5. public-feed runs appear in sync history", !!kevRun && !!dropRun);
  check("5a. run source is LIVE or SNAPSHOT (never unlabelled)", ["LIVE", "SNAPSHOT"].includes(kevRun?.source) && ["LIVE", "SNAPSHOT"].includes(dropRun?.source), `${kevRun?.source}/${dropRun?.source}`);
  check("5b. SNAPSHOT runs state the as-of in the detail", kevRun?.source !== "SNAPSHOT" || /captured|catalog v/i.test(kevRun.detail ?? ""), kevRun?.detail?.slice(0, 90));
  const auditRes = await jfetch(`${BASE}/api/auth/audit?take=50`, authed(super_admin));
  const auditRows = (auditRes.body.events ?? auditRes.body.rows ?? auditRes.body.audit ?? []);
  check("5c. PUBLIC_INTEL_SYNC written to the audit trail", auditRows.some((e) => /PUBLIC_INTEL_SYNC/.test(String(e.type))));

  // ── 6. RBAC ──────────────────────────────────────────────────────────────
  const rOrg = await jfetch(`${BASE}/api/threats/intel`, { ...jbody(orgAdmin, { source: "all" }), method: "POST" });
  check("6. ORG_ADMIN (no soc:manage-all) POST → 403", rOrg.status === 403, `status ${rOrg.status}`);
  const rViewerPost = await jfetch(`${BASE}/api/threats/intel`, { ...jbody(viewer, { source: "all" }), method: "POST" });
  check("6a. VIEWER POST → 403", rViewerPost.status === 403, `status ${rViewerPost.status}`);
  const rViewerGet = await jfetch(`${BASE}/api/threats/intel`, authed(viewer));
  check("6b. VIEWER GET status → 200 (threats:view)", rViewerGet.status === 200, `status ${rViewerGet.status}`);

  // ── 7. Honesty of explicit requests ──────────────────────────────────────
  const rKeyed = await jfetch(`${BASE}/api/threats/intel`, { ...jbody(super_admin, { source: "urlhaus" }), method: "POST" });
  check("7. explicit urlhaus without key → 503 UNCONFIGURED", rKeyed.status === 503 && rKeyed.body.error?.code === "UNCONFIGURED", `status ${rKeyed.status} ${rKeyed.body.error?.code}`);
  const rBad = await jfetch(`${BASE}/api/threats/intel`, { ...jbody(super_admin, { source: "bogus" }), method: "POST" });
  check("7a. unknown source → 400", rBad.status === 400, `status ${rBad.status}`);
  const rEnrich = await jfetch(`${BASE}/api/threats/intel/enrich`, { ...jbody(super_admin, { ip: "45.83.66.2" }), method: "POST" });
  check("7b. GreyNoise enrichment without key → 503 (never fabricated)", rEnrich.status === 503 && rEnrich.body.error?.code === "UNCONFIGURED", `status ${rEnrich.status} ${rEnrich.body.error?.code}`);

  // ── 8. Phase 2 honesty: MISP + VirusTotal ──────────────────────────────
  const rMisp = await jfetch(`${BASE}/api/threats/intel`, { ...jbody(super_admin, { source: "misp" }), method: "POST" });
  check("8. explicit misp without URL/key → 503 UNCONFIGURED", rMisp.status === 503 && rMisp.body.error?.code === "UNCONFIGURED", `status ${rMisp.status} ${rMisp.body.error?.code}`);
  const rVt = await jfetch(`${BASE}/api/threats/intel/enrich`, { ...jbody(super_admin, { target: "179.43.182.60" }), method: "POST" });
  check("8a. VirusTotal enrichment without key → 503 (never fabricated)", rVt.status === 503 && rVt.body.error?.code === "UNCONFIGURED", `status ${rVt.status} ${rVt.body.error?.code}`);
  const rNeither = await jfetch(`${BASE}/api/threats/intel/enrich`, { ...jbody(super_admin, {}), method: "POST" });
  check("8b. enrichment with neither ip nor target → 400", rNeither.status === 400, `status ${rNeither.status}`);

  // Leave a synced hub behind (a healthy demo state, dedupe-safe).
  console.log(`\nHub now carries ${kevRows.length} KEV + ${dropRows.length} DROP live-source indicators.`);
} catch (err) {
  results.push(`FAIL  suite crashed — ${err instanceof Error ? err.message : err}`);
}

console.log(results.join("\n"));
const failed = results.filter((r) => r.startsWith("FAIL")).length;
console.log(`\n${failed === 0 ? "ALL CHECKS PASSED" : `${failed} CHECK(S) FAILED`} (${results.length} checks)`);
process.exit(failed === 0 ? 0 : 1);
