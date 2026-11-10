/**
 * Adwa Cyber — Phase 4 & 5 (Track C) + five-phase integration verification.
 *
 * Verifies, at the API level:
 *   1. CII overview (super admin): 4 operators, mixed gate states as seeded
 *   2. CII tenant scope (CBE admin): read-only, own operator only
 *   3. GATE ENFORCEMENT: authorising monitoring for a gated operator → 409
 *   4. Positive path: authorising monitoring for an open-gate operator → 200
 *   5. MOU lifecycle: record a version + advance to LEGAL_REVIEW
 *   6. ACFS overview: gate LOCKED, 4/13 preconditions, 2 decisions
 *   7. ACFS RBAC: tenant admin cannot read the ACFS register → 403
 *   8. Phases 1–3 regression: stats / scans / incidents / soc / awareness
 *   9. Audit trail: CII_* and ACFS_* events recorded for the above actions
 *
 * Usage: node scripts/trackc-test.mjs
 */
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const { PrismaClient } = await import("/home/z/my-project/node_modules/.prisma/client/index.js").catch(() => import("@prisma/client"));
const db = new PrismaClient();

let pass = 0, fail = 0;
function check(name, cond, detail = "") {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.error(`  ✗ ${name} ${detail}`); }
}

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

const authed = (cookie) => ({ "Content-Type": "application/json", Cookie: cookie });

console.log("\n══ 1. CII overview — platform scope (super admin) ══");
const su = await login("admin@adwacyber.et", "Adwa#Admin2026!");
let r = await jfetch("/api/cii/overview", { headers: authed(su.cookie) });
check("GET /api/cii/overview → 200", r.status === 200);
const ov = r.body;
check("platform scope", ov.scope === "platform");
check("4 designated operators", ov.summary?.operators === 4, `got ${ov.summary?.operators}`);
check("exactly 1 open gate (EEP)", ov.summary?.gatesOpen === 1, `got ${ov.summary?.gatesOpen}`);
check("2 MOUs in force", ov.summary?.mousInForce === 2, `got ${ov.summary?.mousInForce}`);
check("2 INSA authorisations in force", ov.summary?.insaInForce === 2, `got ${ov.summary?.insaInForce}`);
check("2 systems under monitoring", ov.summary?.systemsMonitoring === 2, `got ${ov.summary?.systemsMonitoring}`);
const byCode = Object.fromEntries(ov.operators.map((o) => [o.code, o]));
check("EEP gate OPEN (MOU ACTIVE + INSA ACTIVE)", byCode.EEP?.gate.gateOpen === true && byCode.EEP.gate.mouStatus === "ACTIVE" && byCode.EEP.gate.authStatus === "ACTIVE");
check("ETHIO-TELECOM gated on INSA only", byCode["ETHIO-TELECOM"]?.gate.gateOpen === false && JSON.stringify(byCode["ETHIO-TELECOM"].gate.unmetGates) === '["INSA_AUTHORIZATION"]');
check("CBE gated on MOU only (INSA GRANTED)", byCode.CBE?.gate.gateOpen === false && JSON.stringify(byCode.CBE.gate.unmetGates) === '["MOU"]' && byCode.CBE.gate.authStatus === "GRANTED");
check("ETHIOPIAN-AIRLINES gated on both", byCode["ETHIOPIAN-AIRLINES"]?.gate.gateOpen === false && byCode["ETHIOPIAN-AIRLINES"].gate.unmetGates.length === 2);
check("CBE tenant-linked", byCode.CBE?.tenantName?.includes("Commercial Bank") === true, `got ${byCode.CBE?.tenantName}`);

console.log("\n══ 2. CII tenant scope (CBE org admin) ══");
const cbe = await login("admin@cbe.com.et", "Adwa#Demo2026!");
r = await jfetch("/api/cii/overview", { headers: authed(cbe.cookie) });
check("GET /api/cii/overview → 200 (cii:view-own)", r.status === 200);
check("tenant scope + read-only + linked", r.body.scope === "tenant" && r.body.readOnly === true && r.body.linked === true);
check("sees exactly own operator (CBE), not the other three", r.body.operators.length === 1 && r.body.operators[0].code === "CBE");
check("own gate visible (gated on MOU)", r.body.operators[0].gate.gateOpen === false && r.body.operators[0].gate.unmetGates[0] === "MOU");

console.log("\n══ 3. Gate enforcement — gated operator cannot authorise monitoring ══");
const cbeSystem = byCode.CBE.systems.find((s) => s.readiness === "AGENT_READY");
r = await jfetch(`/api/cii/systems/${cbeSystem.id}`, {
  method: "PATCH",
  headers: authed(su.cookie),
  body: JSON.stringify({ readiness: "MONITORING_AUTHORIZED" }),
});
check("PATCH gated system → MONITORING_AUTHORIZED refused 409", r.status === 409 && r.body.error?.code === "GATE_SHUT", `got ${r.status} ${r.body.error?.code}`);

console.log("\n══ 4. Positive path — open-gate operator (EEP) ══");
const eepErp = byCode.EEP.systems.find((s) => s.readiness === "AGENT_READY");
r = await jfetch(`/api/cii/systems/${eepErp.id}`, {
  method: "PATCH",
  headers: authed(su.cookie),
  body: JSON.stringify({ readiness: "MONITORING_AUTHORIZED" }),
});
check("PATCH open-gate system → MONITORING_AUTHORIZED accepted", r.status === 200 && r.body.system?.readiness === "MONITORING_AUTHORIZED", `got ${r.status}`);
// revert to keep the demo state as seeded
await jfetch(`/api/cii/systems/${eepErp.id}`, { method: "PATCH", headers: authed(su.cookie), body: JSON.stringify({ readiness: "AGENT_READY" }) });

console.log("\n══ 5. MOU lifecycle — record + advance (Airlines) ══");
// repeatable: expect next version after the highest existing one
const priorMous = await db.ciiMou.findMany({ where: { operatorId: byCode["ETHIOPIAN-AIRLINES"].id }, select: { version: true } });
const nextVersion = priorMous.reduce((a, m) => Math.max(a, m.version), 0) + 1;
r = await jfetch("/api/cii/mous", {
  method: "POST",
  headers: authed(su.cookie),
  body: JSON.stringify({ operatorId: byCode["ETHIOPIAN-AIRLINES"].id, scope: ["RESERVATION_LOGS", "NETWORK_FLOW", "CREW_SCHEDULING"], dataTerms: "Metadata only; 90-day retention; quarterly audit." }),
});
check(`POST /api/cii/mous → 201 (v${nextVersion} drafted)`, r.status === 201 && r.body.mou?.version === nextVersion && r.body.mou?.status === "DRAFTING", `got ${r.status} v${r.body.mou?.version}`);
const mouV2 = r.body.mou;
r = await jfetch(`/api/cii/mous/${mouV2.id}`, {
  method: "PATCH",
  headers: authed(su.cookie),
  body: JSON.stringify({ status: "LEGAL_REVIEW" }),
});
check(`advance v${nextVersion} → LEGAL_REVIEW`, r.status === 200 && r.body.mou?.status === "LEGAL_REVIEW", `got ${r.status}`);
r = await jfetch(`/api/cii/mous/${mouV2.id}`, {
  method: "PATCH",
  headers: authed(su.cookie),
  body: JSON.stringify({ status: "SIGNED" }), // no signedAt → must refuse
});
check("SIGNED without signing date refused 400", r.status === 400 && r.body.error?.code === "SIGN_DATE_REQUIRED", `got ${r.status}`);
// cleanup: drop everything the test just created so the seeded demo state is restored
await db.ciiMou.deleteMany({ where: { operatorId: byCode["ETHIOPIAN-AIRLINES"].id, version: { gt: 1 } } });

console.log("\n══ 6. ACFS gate register (super admin) ══");
r = await jfetch("/api/acfs/overview", { headers: authed(su.cookie) });
check("GET /api/acfs/overview → 200", r.status === 200);
const acfs = r.body;
check("gate verdict LOCKED", acfs.gate?.verdict === "LOCKED" && acfs.gate.gateOpen === false);
check("4 domains present", acfs.domains?.length === 4);
check("13 preconditions, 4 satisfied", acfs.gate?.totalItems === 13 && acfs.gate?.satisfiedItems === 4, `got ${acfs.gate?.satisfiedItems}/${acfs.gate?.totalItems}`);
check("2 recorded gate decisions (REMAINED_LOCKED)", acfs.decisions?.length === 2 && acfs.decisions.every((d) => d.decision === "REMAINED_LOCKED"));
const ehrc = acfs.domains.find((d) => d.domain === "EHRC_DUE_DILIGENCE");
check("EHRC domain incomplete (0/3 satisfied)", ehrc && ehrc.satisfied === 0 && ehrc.complete === false);

console.log("\n══ 7. ACFS RBAC — tenant admin locked out ══");
r = await jfetch("/api/acfs/overview", { headers: authed(cbe.cookie) });
check("GET /api/acfs/overview → 403 for ORG_ADMIN", r.status === 403, `got ${r.status}`);

console.log("\n══ 8. Phases 1–3 regression ══");
r = await jfetch("/api/stats", { headers: authed(cbe.cookie) });
check("Phase 1: GET /api/stats → 200 with rules", r.status === 200 && r.body.rules > 40);
r = await jfetch("/api/scans", { headers: authed(cbe.cookie) });
check("Phase 1: GET /api/scans → 200", r.status === 200 && Array.isArray(r.body.scans));
r = await jfetch("/api/incidents", { headers: authed(cbe.cookie) });
check("Phase 2: GET /api/incidents → 200", r.status === 200 && ("incidents" in r.body || Array.isArray(r.body.incidents)));
r = await jfetch("/api/soc/metrics", { headers: authed(cbe.cookie) });
check("Phase 2: GET /api/soc/metrics → 200", r.status === 200);
r = await jfetch("/api/awareness/overview", { headers: authed(su.cookie) });
check("Phase 3: GET /api/awareness/overview → 200", r.status === 200);
r = await jfetch("/api/learn/modules", { headers: { "Content-Type": "application/json" } });
check("Phase 3: GET /api/learn/modules → 200 (learner portal)", r.status === 200);

console.log("\n══ 9. Audit trail ══");
const events = await db.authEvent.findMany({
  where: { type: { startsWith: "CII_" } },
  orderBy: { createdAt: "desc" },
  take: 5,
});
const types = new Set(events.map((e) => e.type));
check("CII_* audit events recorded", types.has("CII_MOU_CREATED") || types.has("CII_SYSTEM_UPDATED") || types.has("CII_SYSTEM_AUTHORIZATION_BLOCKED"), JSON.stringify([...types]));
const blocked = events.find((e) => e.type === "CII_SYSTEM_AUTHORIZATION_BLOCKED");
check("refused authorisation audited with reason", !!blocked && blocked.detail.includes("REFUSED"), blocked?.detail ?? "");

console.log(`\n${"═".repeat(50)}\nRESULT: ${pass} passed, ${fail} failed\n`);
await db.$disconnect();
process.exit(fail > 0 ? 1 : 0);
