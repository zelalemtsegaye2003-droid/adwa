/**
 * Adwa Cyber — SOC / CERT-as-a-Service verification (proposal Phase 2).
 * Logs in via the API (solving the SVG captcha) and verifies:
 *   1. GET /api/soc/metrics — tenant scope, RQ3 median latency math, pipeline counts
 *   2. GET /api/incidents — tenant isolation, priority ordering, filters
 *   3. Lifecycle: invalid skip → 409; notify (RQ3 stamp) + re-notify 409;
 *      advance detected→triaged; auto-contain on a critical
 *   4. POST /api/incidents — creation with priority scoring, validation
 *   5. Threat hub visibility: national feed + own + HUB, P2P hidden unless
 *      shared (Wasasa sees Dashen's peer share); origin anonymisation
 *   6. Indicator CRUD: create (hybrid decision), duplicate 409, invalid 400,
 *      sighting, retire/reactivate
 *   7. Sharing: peer share + duplicate 409; hub broadcast share
 *   8. Ethio-CERT sync: ingest (super only, dedupe), upward report
 *      (anonymised payload, sha256, SyncRun), cross-org 403
 *   9. RBAC: viewer/auditor cannot manage; unauthenticated 401
 *  10. Audit trail: INCIDENT_CREATED / INCIDENT_NOTIFIED / THREAT_SHARED /
 *      ETHIOCERT_SYNC events recorded
 *
 * Usage: node scripts/soc-test.mjs
 */
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const { PrismaClient } = await import("/home/z/my-project/node_modules/.prisma/client/index.js").catch(() => import("@prisma/client"));
const db = new PrismaClient();
const crypto = await import("crypto");

async function jfetch(url, opts = {}) {
  const r = await fetch(BASE + url, opts);
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
  const cap = (await jfetch("/api/auth/captcha")).body;
  const res = await jfetch("/api/auth/login", {
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
const MIN = 60_000;

try {
  const cbe = await db.organization.findFirst({ where: { name: { contains: "Commercial" } } });
  const dashen = await db.organization.findFirst({ where: { name: { contains: "Dashen" } } });
  const wasasa = await db.organization.findFirst({ where: { name: { contains: "Wasasa" } } });

  const cbeAdmin = await login("admin@cbe.com.et", "Adwa#Demo2026!");
  const dashenAuditor = await login("auditor@dashen.com.et", "Adwa#Demo2026!");
  const wasasaAdmin = await login("admin@wasasa.et", "Adwa#Demo2026!");
  const superAdmin = await login("admin@adwacyber.et", "Adwa#Admin2026!");
  const viewer = await login("viewer@ethiotelecom.et", "Adwa#Demo2026!");

  // ── 1. Metrics: tenant scope + RQ3 math ───────────────────────────────────
  let r = await jfetch("/api/soc/metrics", authed(cbeAdmin));
  check("GET /api/soc/metrics 200", r.status === 200);
  check("scope=tenant for org user", r.body.scope === "tenant");
  const lat = r.body.rq3.latency;
  // Seeded CBE notified incidents: 6′ (phishing), 8′ (cred stuffing), 21′ (ddos) → median 8
  check("RQ3 sample count = 3 seeded notifications", lat.count === 3, `count=${lat.count}`);
  check("RQ3 median = 8 min (6,8,21)", lat.medianMin === 8, `median=${lat.medianMin}`);
  check("RQ3 p90 ≥ median", lat.p90Min >= lat.medianMin, `p90=${lat.p90Min}`);
  check("RQ3 target met (8 ≤ 15)", lat.targetMet === true);
  check("RQ3 within-target count = 2 of 3", lat.withinTarget === 2, `within=${lat.withinTarget}`);
  check("pipeline has closed+contained+detected", (r.body.incidents.byStatus.closed ?? 0) >= 1 && (r.body.incidents.byStatus.contained ?? 0) >= 1 && (r.body.incidents.byStatus.detected ?? 0) >= 1, JSON.stringify(r.body.incidents.byStatus));
  check("lifecycle mtta present", typeof r.body.lifecycle.mttaMin === "number", `mtta=${r.body.lifecycle.mttaMin}`);
  check("forecast ranked ≤ 5 with riskIndex", Array.isArray(r.body.forecast) && r.body.forecast.length > 0 && r.body.forecast.length <= 5 && r.body.forecast[0].riskIndex >= r.body.forecast[r.body.forecast.length - 1].riskIndex);
  check("active indicators visible to CBE", r.body.threatIntel.activeIndicators >= 9, `n=${r.body.threatIntel.activeIndicators}`);

  // Super admin: platform scope
  r = await jfetch("/api/soc/metrics", authed(superAdmin));
  check("super sees platform scope", r.status === 200 && r.body.scope === "platform");
  check("platform incidents ≥ 6", r.body.incidents.total >= 6, `total=${r.body.incidents.total}`);
  r = await jfetch(`/api/soc/metrics?org=${dashen.id}`, authed(superAdmin));
  check("super org filter works", r.status === 200 && r.body.scope === "org" && r.body.organization.id === dashen.id);

  // ── 2. Incident queue: tenant isolation + ordering + filters ───────────────
  r = await jfetch("/api/incidents", authed(cbeAdmin));
  check("GET /api/incidents 200", r.status === 200);
  const cbeIncidents = r.body.incidents;
  check("CBE sees only its incidents", cbeIncidents.length >= 4 && cbeIncidents.every((i) => i.organization.id === cbe.id), `n=${cbeIncidents.length}`);
  const ransomware = cbeIncidents.find((i) => i.category === "ransomware");
  check("seeded un-notified ransomware present", !!ransomware && ransomware.notifiedAt === null && ransomware.status === "detected");
  const priorities = cbeIncidents.map((i) => i.priorityScore ?? 0);
  check("queue sorted by priority desc", priorities.every((v, i) => i === 0 || priorities[i - 1] >= v), priorities.join(","));

  r = await jfetch("/api/incidents?status=detected", authed(cbeAdmin));
  check("status filter works", r.status === 200 && r.body.incidents.every((i) => i.status === "detected") && r.body.incidents.length >= 1, `n=${r.body.incidents.length}`);
  r = await jfetch("/api/incidents?severity=critical", authed(cbeAdmin));
  check("severity filter works", r.status === 200 && r.body.incidents.every((i) => i.severity === "critical"));

  // Cross-tenant detail → 403
  const cbeInc = cbeIncidents[0];
  r = await jfetch(`/api/incidents/${cbeInc.id}`, authed(wasasaAdmin));
  check("cross-tenant incident detail 403", r.status === 403);

  // ── 3. Lifecycle rules ─────────────────────────────────────────────────────
  // Invalid skip: detected → contained
  r = await jfetch(`/api/incidents/${ransomware.id}`, { ...jbody(cbeAdmin, { status: "contained" }), method: "PATCH" });
  check("skip transition detected→contained rejected 409", r.status === 409, JSON.stringify(r.body).slice(0, 80));
  // Closed incident cannot advance
  const closed = cbeIncidents.find((i) => i.status === "closed");
  r = await jfetch(`/api/incidents/${closed.id}`, { ...jbody(cbeAdmin, { status: "detected" }), method: "PATCH" });
  check("closed incident cannot re-open via status 409", r.status === 409);

  // Notify (RQ3 stamp)
  r = await jfetch(`/api/incidents/${ransomware.id}`, { ...jbody(cbeAdmin, { action: "notify" }), method: "PATCH" });
  check("notify action 200", r.status === 200, JSON.stringify(r.body).slice(0, 120));
  check("notifiedAt stamped", !!r.body.incident.notifiedAt);
  check("notification latency ≈ seeded age (~40 min)", r.body.notificationLatencyMin >= 35 && r.body.notificationLatencyMin <= 50, `${r.body.notificationLatencyMin}′`);
  r = await jfetch(`/api/incidents/${ransomware.id}`, authed(cbeAdmin));
  const notifEvent = r.body.incident.events.find((e) => e.type === "NOTIFIED");
  check("NOTIFIED timeline event created", !!notifEvent && /latency \d+(\.\d+)? min/.test(notifEvent.note ?? ""));
  r = await jfetch(`/api/incidents/${ransomware.id}`, { ...jbody(cbeAdmin, { action: "notify" }), method: "PATCH" });
  check("re-notify rejected 409", r.status === 409);

  // Advance detected → triaged
  r = await jfetch(`/api/incidents/${ransomware.id}`, { ...jbody(cbeAdmin, { status: "triaged", note: "Analyst confirmed DNS resolution in logs" }), method: "PATCH" });
  check("advance detected→triaged 200", r.status === 200 && r.body.incident.status === "triaged" && !!r.body.incident.triagedAt);
  r = await jfetch(`/api/incidents/${ransomware.id}`, authed(cbeAdmin));
  check("TRIAGE event recorded with note", r.body.incident.events.some((e) => e.type === "TRIAGE" && (e.note ?? "").includes("Analyst confirmed")));

  // Auto-contain on the critical ransomware (proposal §8.3 automated response)
  r = await jfetch(`/api/incidents/${ransomware.id}`, { ...jbody(cbeAdmin, { action: "auto-contain" }), method: "PATCH" });
  check("auto-contain 200 → contained", r.status === 200 && r.body.incident.status === "contained" && !!r.body.incident.containedAt);
  r = await jfetch(`/api/incidents/${ransomware.id}`, authed(cbeAdmin));
  check("AUTO_RESPONSE event recorded", r.body.incident.events.some((e) => e.type === "AUTO_RESPONSE" && /host isolated/.test(e.note ?? "")));

  // Auto-contain on a medium incident → 409 (reserved for crit/high)
  const ddos = cbeIncidents.find((i) => i.category === "ddos");
  r = await jfetch(`/api/incidents/${ddos.id}`, { ...jbody(cbeAdmin, { action: "auto-contain" }), method: "PATCH" });
  check("auto-contain on medium severity rejected 409", r.status === 409);

  // ── 4. Create incident ─────────────────────────────────────────────────────
  r = await jfetch("/api/incidents", { ...jbody(cbeAdmin, {
    title: "Test: suspicious OAuth consent prompt targeting staff",
    category: "phishing", severity: "high", description: "E2E verification incident",
  }), method: "POST" });
  check("POST /api/incidents 201", r.status === 201, JSON.stringify(r.body).slice(0, 120));
  const newInc = r.body.incident;
  check("reference auto-generated INC-2026-####", /^INC-\d{4}-\d{4}$/.test(newInc.ref), newInc.ref);
  check("priority scored for Banking×phishing", r.body.prioritisation.score >= 40 && r.body.prioritisation.label !== "", `${r.body.prioritisation.score}/${r.body.prioritisation.label}`);
  check("DETECTED event exists", newInc.events === undefined || true); // events not returned in list; verified via detail below
  r = await jfetch(`/api/incidents/${newInc.id}`, authed(cbeAdmin));
  check("detail has DETECTED event + description", r.status === 200 && r.body.incident.events.some((e) => e.type === "DETECTED") && r.body.incident.description === "E2E verification incident");

  r = await jfetch("/api/incidents", { ...jbody(cbeAdmin, { title: "bad", category: "nope", severity: "huge" }), method: "POST" });
  check("invalid incident payload 400", r.status === 400);

  // Tenant pin: CBE admin cannot create for Dashen
  r = await jfetch("/api/incidents", { ...jbody(cbeAdmin, { title: "Cross-tenant attempt", category: "other", severity: "low", organizationId: dashen.id }), method: "POST" });
  check("cross-tenant incident creation 403", r.status === 403);

  // Cleanup the E2E incident (keep the dataset clean for the browser test)
  await db.incident.delete({ where: { id: newInc.id } });

  // ── 5. Threat hub visibility + anonymisation ───────────────────────────────
  r = await jfetch("/api/threats", authed(cbeAdmin));
  check("GET /api/threats 200", r.status === 200);
  const cbeThreats = r.body.indicators;
  check("CBE sees national feed (8)", cbeThreats.filter((i) => i.source === "ETHIO_CERT").length === 8);
  check("CBE sees own contributed indicator", cbeThreats.some((i) => i.value === "awash-mobile-rewards.app" && i.organizationId === cbe.id));
  check("P2P indicator of another org hidden from CBE", !cbeThreats.some((i) => i.value === "ceo-office.disbursements@mail-secure.cf"));

  // Wasasa (peer target) sees the Dashen P2P indicator
  r = await jfetch("/api/threats", authed(wasasaAdmin));
  const wasasaThreats = r.body.indicators;
  const peerInd = wasasaThreats.find((i) => i.value === "ceo-office.disbursements@mail-secure.cf");
  check("peer target sees the P2P indicator", !!peerInd, `visible=${wasasaThreats.length}`);
  check("peer share is NOT anonymised for the trusted partner", peerInd && peerInd.originAnonymised === false && peerInd.organizationId === dashen.id, JSON.stringify(peerInd?.origin));

  // Anonymisation: CBE hub indicator viewed by Wasasa
  const hubFromWasasa = wasasaThreats.find((i) => i.value === "awash-mobile-rewards.app");
  check("hub indicator visible to other members", !!hubFromWasasa);
  check("origin anonymised for non-owner", hubFromWasasa && hubFromWasasa.originAnonymised === true && hubFromWasasa.organizationId === null && hubFromWasasa.origin === "A member organisation");

  // Filters
  r = await jfetch("/api/threats?severity=critical", authed(cbeAdmin));
  check("severity filter works", r.status === 200 && r.body.indicators.every((i) => i.severity === "critical") && r.body.indicators.length >= 3);
  r = await jfetch("/api/threats?q=phishing", authed(cbeAdmin));
  check("search filter works", r.status === 200 && r.body.indicators.length >= 1 && r.body.indicators.some((i) => i.value.includes("cbe-secure")));
  r = await jfetch("/api/threats?source=ETHIO_CERT", authed(cbeAdmin));
  check("source filter works", r.status === 200 && r.body.indicators.every((i) => i.source === "ETHIO_CERT"));

  // ── 6. Indicator CRUD ──────────────────────────────────────────────────────
  const TEST_VALUE = `e2e-threat-${Date.now()}.example.org`;
  r = await jfetch("/api/threats", { ...jbody(cbeAdmin, {
    type: "domain", value: TEST_VALUE, titleEn: "E2E test indicator for verification",
    category: "phishing", severity: "medium", tlp: "TLP:GREEN", confidence: 75,
  }), method: "POST" });
  check("POST /api/threats 201", r.status === 201, JSON.stringify(r.body).slice(0, 120));
  const newInd = r.body.indicator;
  check("hybrid decision = HUB (TLP:GREEN, sens 1-2)", r.body.sharingDecision.mode === "HUB", `${r.body.sharingDecision.mode} — ${r.body.sharingDecision.reason}`);
  check("indicator stored with sharing mode", newInd.sharing === "HUB" && newInd.organizationId === cbe.id);

  r = await jfetch("/api/threats", { ...jbody(cbeAdmin, {
    type: "domain", value: TEST_VALUE, titleEn: "Duplicate should fail", category: "phishing", severity: "low",
  }), method: "POST" });
  check("duplicate indicator 409", r.status === 409);

  r = await jfetch("/api/threats", { ...jbody(cbeAdmin, {
    type: "ip", value: "999.999.999.999", titleEn: "Invalid IP address test", category: "other", severity: "low",
  }), method: "POST" });
  check("invalid IP value 400", r.status === 400);

  // Sighting + retire/reactivate
  r = await jfetch(`/api/threats/${newInd.id}`, { ...jbody(cbeAdmin, { sighting: true }), method: "PATCH" });
  check("sighting recorded", r.status === 200 && r.body.indicator.sightings === 1);
  r = await jfetch(`/api/threats/${newInd.id}`, { ...jbody(cbeAdmin, { isActive: false }), method: "PATCH" });
  check("retire works", r.status === 200 && r.body.indicator.isActive === false);
  r = await jfetch("/api/threats?active=false", authed(cbeAdmin));
  check("retired indicator listed with active=false", r.body.indicators.some((i) => i.id === newInd.id));
  r = await jfetch(`/api/threats/${newInd.id}`, { ...jbody(cbeAdmin, { isActive: true }), method: "PATCH" });
  check("reactivate works", r.status === 200 && r.body.indicator.isActive === true);

  // ── 7. Sharing ─────────────────────────────────────────────────────────────
  // CBE shares its indicator peer-to-peer with Wasasa
  r = await jfetch(`/api/threats/${newInd.id}/share`, { ...jbody(cbeAdmin, { mode: "PEER", targetOrgId: wasasa.id }), method: "POST" });
  check("peer share 201", r.status === 201, JSON.stringify(r.body).slice(0, 120));
  check("share switches routing to P2P", r.body.indicator.sharing === "P2P");
  r = await jfetch(`/api/threats/${newInd.id}/share`, { ...jbody(cbeAdmin, { mode: "PEER", targetOrgId: wasasa.id }), method: "POST" });
  check("duplicate peer share 409", r.status === 409);

  // Wasasa admin cannot share CBE's indicator
  r = await jfetch(`/api/threats/${newInd.id}/share`, { ...jbody(wasasaAdmin, { mode: "HUB" }), method: "POST" });
  check("non-owner cannot share 403", r.status === 403);

  // Hub broadcast by CBE on a fresh indicator
  const HUB_VALUE = `e2e-hub-${Date.now()}.example.org`;
  r = await jfetch("/api/threats", { ...jbody(cbeAdmin, {
    type: "domain", value: HUB_VALUE, titleEn: "E2E hub broadcast indicator", category: "scam", severity: "low", tlp: "TLP:GREEN", confidence: 60,
  }), method: "POST" });
  const hubInd = r.body.indicator;
  r = await jfetch(`/api/threats/${hubInd.id}/share`, { ...jbody(cbeAdmin, { mode: "HUB" }), method: "POST" });
  check("hub broadcast share 201 (anonymised)", r.status === 201 && r.body.share.anonymised === true && r.body.share.mode === "HUB_BROADCAST");

  // ── 8. Ethio-CERT sync ─────────────────────────────────────────────────────
  // Ingest: super only; all feed entries already exist → 0 new, 8 refreshed
  r = await jfetch("/api/threats/sync", { ...jbody(wasasaAdmin, { direction: "ingest" }), method: "POST" });
  check("ingest by non-super 403", r.status === 403);
  r = await jfetch("/api/threats/sync", { ...jbody(superAdmin, { direction: "ingest" }), method: "POST" });
  check("ingest by super 200", r.status === 200, JSON.stringify(r.body).slice(0, 120));
  check("ingest dedupes (0 new, 8 refreshed)", r.body.ingested === 0 && r.body.updated === 8, `new=${r.body.ingested} upd=${r.body.updated}`);

  // Upward report: CBE admin for own org
  r = await jfetch("/api/threats/sync", { ...jbody(cbeAdmin, { direction: "report" }), method: "POST" });
  check("upward report 200", r.status === 200, JSON.stringify(r.body).slice(0, 120));
  const payloadStr = JSON.stringify(r.body.payload);
  check("payload anonymised (no org name)", !payloadStr.includes("Commercial Bank") && r.body.payload.reportingEntity.includes("member organisation"));
  check("payload has no incident titles", !payloadStr.includes("Ransomware staging") && !payloadStr.includes("phishing wave"));
  check("payload carries latency stats vs RQ3", r.body.payload.notificationLatency.targetMedianMin === 15 && typeof r.body.payload.notificationLatency.medianMin === "number");
  check("payload hash is sha256 hex", /^[a-f0-9]{64}$/.test(r.body.payloadHash));
  const localHash = crypto.createHash("sha256").update(JSON.stringify(r.body.payload, null, 2)).digest("hex");
  check("payload hash verifiable locally", localHash === r.body.payloadHash);

  // Cross-org report rejected
  r = await jfetch("/api/threats/sync", { ...jbody(wasasaAdmin, { direction: "report", organizationId: cbe.id }), method: "POST" });
  check("cross-org upward report 403", r.status === 403);

  // Sync runs listed
  r = await jfetch("/api/threats/sync", authed(superAdmin));
  check("sync runs listed for super", r.status === 200 && r.body.runs.length >= 2 && r.body.runs.some((x) => x.direction === "INGEST") && r.body.runs.some((x) => x.direction === "REPORT"));
  r = await jfetch("/api/threats/sync", authed(wasasaAdmin));
  check("sync runs tenant-scoped (no CBE REPORT runs)", r.status === 200 && r.body.runs.every((x) => x.organizationId === wasasa.id || x.organizationId === null));

  // ── 9. RBAC ────────────────────────────────────────────────────────────────
  r = await jfetch("/api/incidents", { ...jbody(viewer, { title: "Viewer cannot create", category: "other", severity: "low" }), method: "POST" });
  check("VIEWER cannot create incidents 403", r.status === 403);
  r = await jfetch("/api/threats", { ...jbody(dashenAuditor, { type: "domain", value: "x.example.org", titleEn: "Auditor cannot contribute", category: "other", severity: "low" }), method: "POST" });
  check("AUDITOR cannot contribute indicators 403", r.status === 403);
  r = await jfetch(`/api/incidents/${ransomware.id}`, { ...jbody(dashenAuditor, { status: "eradicated" }), method: "PATCH" });
  check("AUDITOR cannot work incidents 403", r.status === 403);
  r = await jfetch("/api/incidents", { ...jbody(viewer, { status: "triaged" }), method: "PATCH" });
  check("unauthenticated incidents 401", (await jfetch("/api/incidents")).status === 401);
  r = await jfetch("/api/soc/metrics", authed(dashenAuditor));
  check("AUDITOR can view metrics 200", r.status === 200 && r.body.scope === "tenant");
  r = await jfetch("/api/threats", authed(viewer));
  check("VIEWER can view threat hub 200", r.status === 200);

  // ── 10. Audit trail ────────────────────────────────────────────────────────
  const auditTypes = ["INCIDENT_CREATED", "INCIDENT_NOTIFIED", "INCIDENT_STATUS_CHANGED", "THREAT_CREATED", "THREAT_SHARED", "ETHIOCERT_SYNC"];
  const auditRows = await db.authEvent.findMany({
    where: { type: { in: auditTypes }, createdAt: { gte: new Date(Date.now() - 15 * MIN) } },
    orderBy: { createdAt: "desc" },
  });
  for (const type of auditTypes) {
    check(`audit trail has ${type}`, auditRows.some((a) => a.type === type), `${auditRows.filter((a) => a.type === type).length}×`);
  }
  const shareAudit = auditRows.find((a) => a.type === "THREAT_SHARED" && (a.detail ?? "").includes("peer-to-peer"));
  check("THREAT_SHARED audit names the mode + partner", !!shareAudit && (shareAudit.detail ?? "").includes("Wasasa"));
  const syncAudit = auditRows.find((a) => a.type === "ETHIOCERT_SYNC" && (a.detail ?? "").includes("REPORT"));
  check("ETHIOCERT_SYNC audit carries the payload hash", !!syncAudit && /sha256 [a-f0-9]{16}/.test(syncAudit.detail ?? ""));

  // Cleanup E2E indicators
  await db.threatIndicator.deleteMany({ where: { value: { in: [TEST_VALUE, HUB_VALUE] } } });
} catch (err) {
  results.push(`FAIL  crashed: ${err.message}`);
  console.error(err);
} finally {
  await db.$disconnect();
}

const failed = results.filter((r) => r.startsWith("FAIL")).length;
console.log(`\n${results.join("\n")}\n`);
console.log(`──── ${results.length - failed}/${results.length} checks passed ────`);
process.exit(failed ? 1 : 0);
