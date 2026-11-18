/**
 * Adwa Cyber — Scan Lifecycle verification (roadmap item 5).
 * Logs in via the API (solving the SVG captcha) and verifies:
 *   1.  POST /api/scans           → 201 + SCAN_STARTED audit event
 *   2.  POST /api/scans/[id]/answers → draft save, answeredCount, validation (bad answer, foreign rule)
 *   3.  GET  /api/scans/[id]      → answers + evidence notes round-trip (resume data source)
 *   4.  GET  /api/scans           → answeredCount on in_progress drafts
 *   5.  RBAC: VIEWER/AUDITOR cannot run or draft-save (403)
 *   6.  Cross-tenant draft save → 403
 *   7.  Submit hardening (WS-2): malformed JSON → 400; non-array → 400;
 *       partial answers → 400 INCOMPLETE (missing codes listed — a partial
 *       submission can never inflate the score); invalid answer → 400;
 *       unknown rule → 400; duplicate rule → 400; unjustified N/A → 400;
 *       full explicit set → 200, score, audit; re-submit → 409
 *   8.  Draft save after completion → 409 (immutable record)
 *   9.  Findings: waiver without note → 400; with note → 200 + FINDING_STATUS_CHANGED audit
 *  10.  DELETE completed scan as ORG_ADMIN → 409; in_progress → 200 + SCAN_DELETED audit
 *  11.  Super admin may delete a completed scan (record removal on request)
 *
 * Usage: node scripts/scan-lifecycle-test.mjs
 */
const BASE = process.env.BASE_URL ?? "http://localhost:3000";

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

const authed = (s) => ({ headers: { Cookie: s.cookie, "Content-Type": "application/json" } });
const results = [];
const check = (name, cond, extra = "") => results.push(`${cond ? "PASS" : "FAIL"}  ${name}${extra ? " — " + extra : ""}`);

async function recentAudit(session, type, contains) {
  const r = await jfetch("/api/auth/audit?page=1", authed(session));
  const events = r.body.events ?? [];
  return events.filter((e) => e.type === type && (!contains || (e.detail ?? "").includes(contains)));
}

// ── Setup ────────────────────────────────────────────────────────────────────
const { PrismaClient } = await import("@prisma/client").catch(() => import(process.cwd() + "/node_modules/.prisma/client/index.js"));
const db = new PrismaClient();
const cbe = await db.organization.findFirst({ where: { name: { contains: "Commercial" } } });
await db.$disconnect();
if (!cbe) { console.error("CBE org not found — seed first."); process.exit(1); }

const cbeAdmin = await login("admin@cbe.com.et", "Adwa#Demo2026!");
const ethViewer = await login("viewer@ethiotelecom.et", "Adwa#Demo2026!");
const dashenAuditor = await login("auditor@dashen.com.et", "Adwa#Demo2026!");
const superAdmin = await login("admin@adwacyber.et", "Adwa#Admin2026!");

// ── 1. Start an assessment ──────────────────────────────────────────────────
let r = await jfetch("/api/scans", {
  method: "POST", ...authed(cbeAdmin),
  body: JSON.stringify({ organizationId: cbe.id, frameworkCode: "PD-1321", name: "Lifecycle E2E — draft & resume" }),
});
check("start scan (201)", r.status === 201, `status=${r.status}`);
const scan = r.body.scan;

r = await recentAudit(cbeAdmin, "SCAN_STARTED", scan.name);
check("SCAN_STARTED audit event recorded", r.length >= 1);

// ── 2. Draft save ───────────────────────────────────────────────────────────
r = await jfetch(`/api/scans/${scan.id}/answers`, {
  method: "POST", ...authed(cbeAdmin),
  body: JSON.stringify({ answers: [
    { ruleCode: "ART22-01", answer: "yes", evidenceNote: "DPIA on file" },
    { ruleCode: "ART22-02", answer: "no" },
    { ruleCode: "ART52-01", answer: "partial", evidenceNote: "Training records cover HQ only" },
  ]}),
});
check("draft save (200)", r.status === 200, `status=${r.status}`);
check("draft save reports answeredCount=3", r.body.answeredCount === 3, `answeredCount=${r.body.answeredCount}`);

r = await jfetch(`/api/scans/${scan.id}/answers`, {
  method: "POST", ...authed(cbeAdmin),
  body: JSON.stringify({ answers: [{ ruleCode: "ART22-01", answer: "maybe" }] }),
});
check("invalid answer value → 400", r.status === 400, `status=${r.status}`);

r = await jfetch(`/api/scans/${scan.id}/answers`, {
  method: "POST", ...authed(cbeAdmin),
  body: JSON.stringify({ answers: [{ ruleCode: "NBE-99", answer: "yes" }] }),
});
check("rule outside this assessment → 400", r.status === 400, `status=${r.status}`);

// ── 3. Round-trip (resume data source) ─────────────────────────────────────
r = await jfetch(`/api/scans/${scan.id}`, authed(cbeAdmin));
check("scan detail loads (200)", r.status === 200);
const det = r.body.scan;
const a22 = det.results.find((x) => x.rule.code === "ART22-01");
const a52 = det.results.find((x) => x.rule.code === "ART52-01");
check("ART22-01 answer persisted", a22?.answer === "yes", `answer=${a22?.answer}`);
check("ART22-01 evidence note persisted", a22?.evidenceNote === "DPIA on file", `note=${a22?.evidenceNote}`);
check("ART52-01 partial persisted", a52?.answer === "partial");
check("unanswered rules stay na", det.results.find((x) => x.rule.code === "ART17-01")?.answer === "na");

// ── 4. List shows draft progress ────────────────────────────────────────────
r = await jfetch("/api/scans", authed(cbeAdmin));
const listed = (r.body.scans ?? []).find((s) => s.id === scan.id);
check("scans list includes answeredCount", listed?.answeredCount === 3, `answeredCount=${listed?.answeredCount}`);

// ── 5. RBAC ─────────────────────────────────────────────────────────────────
r = await jfetch("/api/scans", {
  method: "POST", ...authed(ethViewer),
  body: JSON.stringify({ organizationId: cbe.id, frameworkCode: "PD-1321" }),
});
check("VIEWER cannot start a scan (403)", r.status === 403, `status=${r.status}`);

r = await jfetch(`/api/scans/${scan.id}/answers`, {
  method: "POST", ...authed(dashenAuditor),
  body: JSON.stringify({ answers: [{ ruleCode: "ART22-01", answer: "yes" }] }),
});
check("AUDITOR cannot save drafts (403)", r.status === 403, `status=${r.status}`);

r = await jfetch(`/api/scans/${scan.id}/answers`, {
  method: "POST", ...authed(ethViewer),
  body: JSON.stringify({ answers: [{ ruleCode: "ART22-01", answer: "yes" }] }),
});
check("VIEWER cannot save drafts (403)", r.status === 403, `status=${r.status}`);

// ── 6. Cross-tenant ─────────────────────────────────────────────────────────
const dashen = await (async () => {
  const p = new PrismaClient();
  const o = await p.organization.findFirst({ where: { name: { contains: "Dashen" } } });
  await p.$disconnect();
  return o;
})();
r = await jfetch("/api/scans", {
  method: "POST", ...authed(superAdmin),
  body: JSON.stringify({ organizationId: dashen.id, frameworkCode: "PD-1321", name: "Lifecycle E2E — cross-tenant probe" }),
});
check("super admin starts scan for Dashen (201)", r.status === 201, `status=${r.status}`);
const dashenScan = r.body.scan;
r = await jfetch(`/api/scans/${dashenScan.id}/answers`, {
  method: "POST", ...authed(cbeAdmin),
  body: JSON.stringify({ answers: [{ ruleCode: "ART22-01", answer: "yes" }] }),
});
check("cross-tenant draft save blocked (403)", r.status === 403, `status=${r.status}`);
r = await jfetch(`/api/scans/${dashenScan.id}`, { method: "DELETE", ...authed(cbeAdmin) });
check("cross-tenant delete blocked (403)", r.status === 403, `status=${r.status}`);
// cleanup probe
await jfetch(`/api/scans/${dashenScan.id}`, { method: "DELETE", ...authed(superAdmin) });

// ── 7. Submit hardening (WS-2: scores must be trustworthy) ───────────────
const { rules: pdRules } = (await jfetch("/api/rules?framework=PD-1321", authed(cbeAdmin))).body;

// 7a. Malformed JSON → 400 (never a 500)
r = await jfetch(`/api/scans/${scan.id}/submit`, {
  method: "POST", ...authed(cbeAdmin),
  headers: { ...authed(cbeAdmin).headers },
  body: "this is not json{",
});
check("malformed JSON → 400 INVALID_JSON", r.status === 400 && r.body?.error?.code === "INVALID_JSON", `status=${r.status} body=${JSON.stringify(r.body).slice(0, 80)}`);

// 7b. answers must be an array
r = await jfetch(`/api/scans/${scan.id}/submit`, {
  method: "POST", ...authed(cbeAdmin),
  body: JSON.stringify({ answers: { "ART22-01": "yes" } }),
});
check("non-array answers → 400", r.status === 400, `status=${r.status}`);

// 7c. Partial submission → 400 INCOMPLETE with the missing codes.
//     (10 explicit answers + 37 unanswered can no longer inflate a score.)
const partial = pdRules.slice(0, 10).map((rule, i) => ({
  ruleCode: rule.code,
  answer: i % 3 === 0 ? "yes" : i % 3 === 1 ? "no" : "partial",
}));
r = await jfetch(`/api/scans/${scan.id}/submit`, {
  method: "POST", ...authed(cbeAdmin),
  body: JSON.stringify({ answers: partial }),
});
check("partial submission → 400 INCOMPLETE", r.status === 400 && r.body?.error?.code === "INCOMPLETE", `status=${r.status} body=${JSON.stringify(r.body).slice(0, 100)}`);
check("missing codes are listed", Array.isArray(r.body?.error?.missing) && r.body.error.missing.length === pdRules.length - 10, `missing=${r.body?.error?.missing?.length}`);

// 7d. Invalid answer value
r = await jfetch(`/api/scans/${scan.id}/submit`, {
  method: "POST", ...authed(cbeAdmin),
  body: JSON.stringify({ answers: [{ ruleCode: "ART22-01", answer: "maybe" }] }),
});
check("invalid answer value → 400 INVALID_ANSWER", r.status === 400 && r.body?.error?.code === "INVALID_ANSWER", `status=${r.status} body=${JSON.stringify(r.body).slice(0, 80)}`);

// 7e. Unknown rule code
r = await jfetch(`/api/scans/${scan.id}/submit`, {
  method: "POST", ...authed(cbeAdmin),
  body: JSON.stringify({ answers: [{ ruleCode: "NBE-99", answer: "yes" }] }),
});
check("unknown rule code → 400 UNKNOWN_RULE", r.status === 400 && r.body?.error?.code === "UNKNOWN_RULE", `status=${r.status} body=${JSON.stringify(r.body).slice(0, 80)}`);

// 7f. Duplicate rule in one payload
r = await jfetch(`/api/scans/${scan.id}/submit`, {
  method: "POST", ...authed(cbeAdmin),
  body: JSON.stringify({ answers: [
    { ruleCode: "ART22-01", answer: "yes" },
    { ruleCode: "ART22-01", answer: "no" },
  ] }),
});
check("duplicate rule → 400 DUPLICATE_RULE", r.status === 400 && r.body?.error?.code === "DUPLICATE_RULE", `status=${r.status} body=${JSON.stringify(r.body).slice(0, 80)}`);

// 7g. Full set but an unjustified N/A → 400 (D1: N/A is a legal claim)
const naCodes = [pdRules[4].code, pdRules[9].code, pdRules[14].code, pdRules[19].code, pdRules[24].code];
const fullAnswers = pdRules.map((rule, i) => {
  if (naCodes.includes(rule.code)) return { ruleCode: rule.code, answer: "na", evidenceNote: "No such processing at this organisation" };
  return {
    ruleCode: rule.code,
    answer: i % 3 === 0 ? "yes" : i % 3 === 1 ? "no" : "partial",
    evidenceNote: i === 0 ? "Kept from draft" : undefined,
  };
});
const unjustified = fullAnswers.map((a) => ({ ...a }));
unjustified.find((a) => a.ruleCode === naCodes[0]).evidenceNote = "x"; // < 5 chars
r = await jfetch(`/api/scans/${scan.id}/submit`, {
  method: "POST", ...authed(cbeAdmin),
  body: JSON.stringify({ answers: unjustified }),
});
check("unjustified N/A → 400 NA_JUSTIFICATION_REQUIRED", r.status === 400 && r.body?.error?.code === "NA_JUSTIFICATION_REQUIRED", `status=${r.status} body=${JSON.stringify(r.body).slice(0, 100)}`);

// 7h. Full explicit set (justified N/A included) → 200
r = await jfetch(`/api/scans/${scan.id}/submit`, {
  method: "POST", ...authed(cbeAdmin),
  body: JSON.stringify({ answers: fullAnswers }),
});
check("submit full explicit set (200)", r.status === 200, `status=${r.status}, body=${JSON.stringify(r.body).slice(0, 160)}`);
check("scan completed", r.body.scan?.status === "complete");
check("overall score computed", typeof r.body.scan?.overallScore === "number", `score=${r.body.scan?.overallScore}`);
check("auditorName records submitting user", r.body.scan?.auditorName === cbeAdmin.user.name, `auditorName=${r.body.scan?.auditorName}`);
check("engine findings > 0", r.body.engine?.findingsCount > 0, `findings=${r.body.engine?.findingsCount}`);

r = await recentAudit(cbeAdmin, "SCAN_COMPLETED", scan.name);
check("SCAN_COMPLETED audit event recorded", r.length >= 1);

// 7i. Explicit N/A survives: answeredAt stamped, answer stays "na"
r = await jfetch(`/api/scans/${scan.id}`, authed(cbeAdmin));
const naRow = r.body.scan.results.find((x) => x.rule.code === naCodes[0]);
check("explicit na persisted with answeredAt", naRow?.answer === "na" && Boolean(naRow?.answeredAt), `answer=${naRow?.answer} answeredAt=${naRow?.answeredAt}`);
r = await jfetch("/api/scans", authed(cbeAdmin));
const completedRow = (r.body.scans ?? []).find((s) => s.id === scan.id);
check("completed scan answeredCount === all rules", completedRow?.answeredCount === pdRules.length, `answeredCount=${completedRow?.answeredCount}/${pdRules.length}`);

// 7j. Re-submission → 409
r = await jfetch(`/api/scans/${scan.id}/submit`, {
  method: "POST", ...authed(cbeAdmin),
  body: JSON.stringify({ answers: fullAnswers }),
});
check("re-submit → 409", r.status === 409, `status=${r.status}`);

// ── 8. Immutable after completion ───────────────────────────────────────────
r = await jfetch(`/api/scans/${scan.id}/answers`, {
  method: "POST", ...authed(cbeAdmin),
  body: JSON.stringify({ answers: [{ ruleCode: "ART22-01", answer: "no" }] }),
});
check("draft save after completion → 409", r.status === 409, `status=${r.status}`);

// ── 9. Findings lifecycle ───────────────────────────────────────────────────
r = await jfetch(`/api/scans/${scan.id}`, authed(cbeAdmin));
const finding = r.body.scan.results.find((x) => x.answer === "no" || x.answer === "partial");
check("finding exists from submit", Boolean(finding));

r = await jfetch(`/api/findings/${finding.id}`, {
  method: "PATCH", ...authed(cbeAdmin),
  body: JSON.stringify({ status: "waived" }),
});
check("waiver without note → 400", r.status === 400, `status=${r.status}`);

r = await jfetch(`/api/findings/${finding.id}`, {
  method: "PATCH", ...authed(cbeAdmin),
  body: JSON.stringify({ status: "waived", note: "Risk accepted by CISO until Q3 budget cycle" }),
});
check("waiver with note (200)", r.status === 200, `status=${r.status}`);
check("finding status is waived", r.body.result?.status === "waived");

r = await recentAudit(cbeAdmin, "FINDING_STATUS_CHANGED", finding.rule.code);
check("FINDING_STATUS_CHANGED audit event recorded", r.length >= 1);

r = await jfetch(`/api/findings/${finding.id}`, {
  method: "PATCH", ...authed(ethViewer),
  body: JSON.stringify({ status: "remediated" }),
});
check("VIEWER cannot change findings (403)", r.status === 403, `status=${r.status}`);

// ── 10. Delete rules ────────────────────────────────────────────────────────
r = await jfetch(`/api/scans/${scan.id}`, { method: "DELETE", ...authed(cbeAdmin) });
check("completed scan not deletable by ORG_ADMIN (409)", r.status === 409, `status=${r.status}`);

r = await jfetch("/api/scans", {
  method: "POST", ...authed(cbeAdmin),
  body: JSON.stringify({ organizationId: cbe.id, frameworkCode: "PD-1321", name: "Lifecycle E2E — discard me" }),
});
const draft2 = r.body.scan;
await jfetch(`/api/scans/${draft2.id}/answers`, {
  method: "POST", ...authed(cbeAdmin),
  body: JSON.stringify({ answers: [{ ruleCode: "ART22-01", answer: "yes" }] }),
});
r = await jfetch(`/api/scans/${draft2.id}`, { method: "DELETE", ...authed(cbeAdmin) });
check("in-progress draft deletable (200)", r.status === 200, `status=${r.status}`);
r = await jfetch(`/api/scans/${draft2.id}`, authed(cbeAdmin));
check("deleted draft is gone (404)", r.status === 404, `status=${r.status}`);
r = await recentAudit(cbeAdmin, "SCAN_DELETED", draft2.name);
check("SCAN_DELETED audit event recorded", r.length >= 1);

// ── 11. Super admin cleanup of the completed record ─────────────────────────
r = await jfetch(`/api/scans/${scan.id}`, { method: "DELETE", ...authed(superAdmin) });
check("super admin may delete completed record (200)", r.status === 200, `status=${r.status}`);

// ── Summary ─────────────────────────────────────────────────────────────────
const failed = results.filter((x) => x.startsWith("FAIL"));
console.log("\n═══ Scan Lifecycle verification ═══");
for (const line of results) console.log(line);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) process.exit(1);
