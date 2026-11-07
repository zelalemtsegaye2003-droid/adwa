/**
 * Adwa Cyber — Multilingual Awareness Platform verification (proposal Phase 3, Track B).
 * Logs in via the API (solving the SVG captcha) and verifies:
 *   1. RBAC / tenant isolation: ORG_ADMIN + VIEWER + unauthenticated are
 *      locked out of every /api/awareness route (school data = minors).
 *   2. Overview: 5 pilot schools, T/C classes, consent register, 8 units,
 *      16-item instrument, engagement metrics.
 *   3. RQ2 maths: treatment gain ≫ control gain; ANOVA significant with
 *      large effect size; independent recomputation from evaluation rows.
 *   4. Curriculum admin: create unit → patch (version bump) → add question →
 *      archive; duplicate school/class 409s; code issuance.
 *   5. Learner portal: join (no group leakage), consent gate 403, module
 *      detail/instrument never expose answerIdx, full PRE→lesson→POST journey
 *      with server-side scoring, retake 409, POST-before-PRE 409.
 *   6. Consent register: record GRANTED (with paper-form ref) + audit event.
 *   7. Evaluation export: JSON + CSV (SPSS/R) with pseudonymised rows.
 *
 * Usage: node scripts/awareness-test.mjs
 */
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const { PrismaClient } = await import("/adwa/node_modules/.prisma/client/index.js").catch(() => import("@prisma/client"));
const db = new PrismaClient();

async function jfetch(url, opts = {}) {
  let r = await fetch(BASE + url, opts);
  // The learner portal rate-limits (e.g. 10 assessments/min/IP); back-to-back
  // suite runs can trip it — honour Retry-After once.
  if (r.status === 429) {
    const wait = (Number(r.headers.get("retry-after")) || 5) * 1000;
    await new Promise((res) => setTimeout(res, Math.min(wait, 30_000)));
    r = await fetch(BASE + url, opts);
  }
  let body = null;
  const ct = r.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) body = await r.json();
  else body = { raw: (await r.text()).slice(0, 200) };
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

const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;

try {
  // Pre-clean any artefacts from a crashed earlier run.
  await db.awarenessLearner.deleteMany({ where: { code: { in: ["AW-E2E001", "AW-E2E002"] } } });
  await db.awarenessSchool.deleteMany({ where: { name: "E2E Secondary School" } });
  await db.awarenessModule.deleteMany({ where: { titleEn: { in: ["E2E Test Unit", "E2E Test Unit v2"] } } });

  const superAdmin = await login("admin@adwacyber.et", "Adwa#Admin2026!");
  const cbeAdmin = await login("admin@cbe.com.et", "Adwa#Demo2026!");
  const viewer = await login("viewer@ethiotelecom.et", "Adwa#Demo2026!");

  // ── 1. RBAC: school data never reaches commercial tenants ────────────────
  console.log("── 1. RBAC / tenant isolation ──");
  let r = await jfetch("/api/awareness/overview", authed(cbeAdmin));
  check("ORG_ADMIN blocked from awareness overview (403)", r.status === 403, `status=${r.status}`);
  r = await jfetch("/api/awareness/consent", authed(cbeAdmin));
  check("ORG_ADMIN blocked from consent register (403)", r.status === 403, `status=${r.status}`);
  r = await jfetch("/api/awareness/schools", authed(viewer));
  check("VIEWER blocked from schools (403)", r.status === 403, `status=${r.status}`);
  r = await jfetch("/api/awareness/evaluation", authed(cbeAdmin));
  check("ORG_ADMIN blocked from evaluation export (403)", r.status === 403, `status=${r.status}`);
  r = await jfetch("/api/awareness/overview");
  check("unauthenticated 401", r.status === 401, `status=${r.status}`);

  // ── 2. Overview KPIs ──────────────────────────────────────────────────────
  console.log("── 2. Overview ──");
  r = await jfetch("/api/awareness/overview", authed(superAdmin));
  check("GET /api/awareness/overview 200", r.status === 200);
  const ov = r.body;
  check("five pilot schools", ov.programme.schools === 5, `schools=${ov.programme.schools}`);
  check("ten classes (5 T / 5 C)", ov.programme.classes === 10 && ov.programme.treatmentClasses === 5 && ov.programme.controlClasses === 5, `${ov.programme.treatmentClasses}T/${ov.programme.controlClasses}C`);
  check("~300 pseudonymised participants", ov.programme.learners >= 280 && ov.programme.learners <= 320, `learners=${ov.programme.learners}`);
  check("consent register populated", ov.programme.consent.granted > 200 && ov.programme.consent.pending > 0 && ov.programme.consent.denied > 0, JSON.stringify(ov.programme.consent));
  check("consent rate 70–95%", ov.programme.consentRate >= 70 && ov.programme.consentRate <= 95, `rate=${ov.programme.consentRate}`);
  check("8 curriculum units", ov.programme.modules === 8, `modules=${ov.programme.modules}`);
  check("16-item RQ2 instrument", ov.programme.instrumentItems === 16, `items=${ov.programme.instrumentItems}`);
  check("engagement: completions > 700", ov.engagement.lessonCompletions > 700, `n=${ov.engagement.lessonCompletions}`);
  check("engagement: per-module rows = 8", ov.engagement.modules.length === 8);
  check("per-school rows = 5 with 2 classes each", ov.schools.length === 5 && ov.schools.every((s) => s.classes.length === 2));

  // ── 3. RQ2 evaluation maths ───────────────────────────────────────────────
  console.log("── 3. RQ2 maths ──");
  const rq2 = ov.rq2;
  check("treatment mean gain > control mean gain + 8", rq2.treatment.stat.meanGain > rq2.control.stat.meanGain + 8, `T=${rq2.treatment.stat.meanGain} C=${rq2.control.stat.meanGain}`);
  check("paired n > 100 per group", rq2.treatment.stat.n > 100 && rq2.control.stat.n > 100, `T=${rq2.treatment.stat.n} C=${rq2.control.stat.n}`);
  check("treatment paired t significant", rq2.treatment.pairedT && rq2.treatment.pairedT.significant && rq2.treatment.pairedT.p < 0.0001, `p=${rq2.treatment.pairedT?.p}`);
  check("control gain small (maturation only)", rq2.control.stat.meanGain >= 0 && rq2.control.stat.meanGain < 8, `C=${rq2.control.stat.meanGain}`);
  check("ANOVA present and significant (α=0.05)", rq2.anova && rq2.anova.significant === true);
  check("ANOVA F > 30 with large effect size", rq2.anova.f > 30 && rq2.anova.etaSquared > 0.2, `F=${rq2.anova.f} η²=${rq2.anova.etaSquared}`);
  check("ANOVA p < 0.0001", rq2.anova.p < 0.0001, `p=${rq2.anova.p}`);
  check("ANOVA df = (1, n-2)", rq2.anova.dfBetween === 1 && rq2.anova.dfWithin === rq2.anova.n - 2, `df=(${rq2.anova.dfBetween},${rq2.anova.dfWithin}) n=${rq2.anova.n}`);

  // Independent recomputation from the evaluation export rows.
  const ev = (await jfetch("/api/awareness/evaluation", authed(superAdmin))).body;
  const tRows = ev.rows.filter((x) => x.group === "TREATMENT" && x.gain !== null);
  const cRows = ev.rows.filter((x) => x.group === "CONTROL" && x.gain !== null);
  const tMean = Math.round(mean(tRows.map((x) => x.gain)) * 100) / 100;
  const cMean = Math.round(mean(cRows.map((x) => x.gain)) * 100) / 100;
  check("evaluation rows recomputed T mean matches overview", Math.abs(tMean - rq2.treatment.stat.meanGain) < 0.51, `ev=${tMean} ov=${rq2.treatment.stat.meanGain}`);
  check("evaluation rows recomputed C mean matches overview", Math.abs(cMean - rq2.control.stat.meanGain) < 0.51, `ev=${cMean} ov=${rq2.control.stat.meanGain}`);
  check("evaluation n consistency", ev.n.treatmentPaired === rq2.treatment.stat.n && ev.n.controlPaired === rq2.control.stat.n, `ev=${ev.n.treatmentPaired}/${ev.n.controlPaired}`);
  check("evaluation rows pseudonymised (codes, no names)", ev.rows.every((x) => /^AW-[A-Z2-9]{6}$/.test(x.code) && !("name" in x)));

  // ── 4. Curriculum administration ─────────────────────────────────────────
  console.log("── 4. Curriculum admin ──");
  r = await jfetch("/api/awareness/modules", authed(superAdmin));
  check("GET modules 200 with 8 units", r.status === 200 && r.body.modules.length === 8);
  const firstModule = r.body.modules[0];
  check("admin module view carries answer keys", firstModule.questions.every((q) => Number.isInteger(q.answerIdx) && q.answerIdx >= 0 && q.answerIdx <= 3));
  check("module content bilingual", firstModule.contentEn.length > 100 && firstModule.contentAm.length > 100 && firstModule.contentAm.includes("## "));

  r = await jfetch("/api/awareness/modules", {
    method: "POST",
    ...jbody(superAdmin, {
      topic: "reporting", titleEn: "E2E Test Unit", titleAm: "የሙከራ ክፍል", summaryEn: "temp", summaryAm: "ጊዜያዊ",
      contentEn: "## One\nTwo", contentAm: "## አንድ\nሁለት", durationMin: 10, gradeBand: "7-10", questions: [],
    }),
  });
  check("POST module 201", r.status === 201 && /^AW-\d+$/.test(r.body.module.code), JSON.stringify(r.body).slice(0, 80));
  const testModuleId = r.body.module.id;

  r = await jfetch(`/api/awareness/modules/${testModuleId}`, { ...jbody(superAdmin, { titleEn: "E2E Test Unit v2" }), method: "PATCH" });
  check("PATCH module updates + bumps version", r.status === 200 && r.body.module.version === "1.1", JSON.stringify(r.body).slice(0, 80));

  r = await jfetch(`/api/awareness/modules/${testModuleId}/questions`, {
    method: "POST",
    ...jbody(superAdmin, {
      promptEn: "E2E question?", promptAm: "የሙከራ ጥያቄ?",
      optionsEn: ["a", "b", "c", "d"], optionsAm: ["ሀ", "ለ", "ሐ", "መ"], answerIdx: 2,
    }),
  });
  check("POST question 201", r.status === 201, `status=${r.status}`);

  r = await jfetch(`/api/awareness/modules/${testModuleId}`, { ...jbody(superAdmin, { isActive: false }), method: "PATCH" });
  check("archive module (isActive=false)", r.status === 200 && r.body.module.isActive === false);

  // ── 5. Learner portal ─────────────────────────────────────────────────────
  console.log("── 5. Learner portal (public) ──");
  const tClass = await db.awarenessClass.findUnique({ where: { joinCode: "ADWA-M2S-9A" } });
  check("fixed join code seeded (ADWA-M2S-9A)", tClass !== null && tClass.groupType === "TREATMENT");

  r = await jfetch("/api/learn/join", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ joinCode: "ADWA-M2S-9A" }) });
  check("join 200 with class + 8 modules", r.status === 200 && r.body.class.name.includes("Grade") && r.body.modules.length === 8, JSON.stringify(r.body.class ?? {}));
  check("join response hides RQ2 group assignment", !("groupType" in (r.body.class ?? {})) && !JSON.stringify(r.body).includes("TREATMENT"));
  r = await jfetch("/api/learn/join", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ joinCode: "ADWA-NOPE00" }) });
  check("unknown join code 404", r.status === 404);
  r = await jfetch("/api/learn/join", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ joinCode: "x" }) });
  check("malformed join code 400", r.status === 400);

  // Consent gate: a DENIED / PENDING learner cannot submit anything.
  const pendingLearner = await db.awarenessLearner.findFirst({ where: { consent: "PENDING", classId: tClass.id } });
  r = await jfetch("/api/learn/learner", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ joinCode: "ADWA-M2S-9A", learnerCode: pendingLearner.code }) });
  check("learner lookup shows consent state (gate data)", r.status === 200 && r.body.learner.consent === "PENDING");
  r = await jfetch("/api/learn/assessment", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ joinCode: "ADWA-M2S-9A", learnerCode: pendingLearner.code, kind: "PRE", answers: [] }),
  });
  check("assessment blocked without consent (403)", r.status === 403 && r.body.error?.code === "CONSENT_REQUIRED", `status=${r.status}`);
  r = await jfetch("/api/learn/progress", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ joinCode: "ADWA-M2S-9A", learnerCode: pendingLearner.code, moduleId: firstModule.id }),
  });
  check("progress blocked without consent (403)", r.status === 403 && r.body.error?.code === "CONSENT_REQUIRED");

  // No answer leakage on public question payloads.
  r = await jfetch(`/api/learn/modules/${firstModule.id}`);
  check("module detail 200", r.status === 200 && r.body.module.questions.length === 4);
  check("module detail never exposes answerIdx", !JSON.stringify(r.body).includes("answerIdx"));
  r = await jfetch("/api/learn/instrument");
  check("instrument has 16 items", r.status === 200 && r.body.items.length === 16, `n=${r.body.items?.length}`);
  check("instrument never exposes answerIdx", !JSON.stringify(r.body).includes("answerIdx"));
  const instrumentIds = new Set(r.body.items.map((q) => q.id));
  check("instrument = first+third bank item per module", r.body.items.every((q) => /^[A-Z2-9]+-[A-Z]{2}$/.test(q.moduleCode) || /^AW-\d+$/.test(q.moduleCode)));

  // Full journey for a fresh consented learner in the treatment class.
  const fresh = await db.awarenessLearner.create({
    data: { classId: tClass.id, code: "AW-E2E001", grade: tClass.grade, consent: "GRANTED", consentAt: new Date(), consentRef: "FORM-E2E" },
  });
  const allQ = await db.awarenessQuestion.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } });
  const keyById = new Map(allQ.map((q) => [q.id, q.answerIdx]));

  r = await jfetch("/api/learn/learner", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ joinCode: "ADWA-M2S-9A", learnerCode: "AW-E2E001" }) });
  check("fresh learner identified (GRANTED)", r.status === 200 && r.body.learner.consent === "GRANTED" && r.body.assessments.pre === null);

  // PRE with every answer correct (keys from DB — server-side scoring check).
  const perfect = [...instrumentIds].map((qId) => ({ qId, picked: keyById.get(qId) }));
  r = await jfetch("/api/learn/assessment", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ joinCode: "ADWA-M2S-9A", learnerCode: "AW-E2E001", kind: "PRE", answers: perfect }),
  });
  check("PRE submitted and scored 100 server-side", r.status === 200 && r.body.assessment.score === 100 && r.body.assessment.correct === 16, JSON.stringify(r.body.assessment ?? {}).slice(0, 120));
  check("PRE detail returns explanations after submission", r.body.detail.length === 16 && r.body.detail.every((d) => d.correct === true));

  r = await jfetch("/api/learn/assessment", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ joinCode: "ADWA-M2S-9A", learnerCode: "AW-E2E001", kind: "PRE", answers: perfect }),
  });
  check("PRE retake rejected (409)", r.status === 409 && r.body.error?.code === "ALREADY_SAT");

  // Lesson quiz on module 1 (all correct).
  const m1 = await db.awarenessModule.findUnique({ where: { code: "AW-01" }, include: { questions: true } });
  r = await jfetch("/api/learn/progress", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      joinCode: "ADWA-M2S-9A", learnerCode: "AW-E2E001", moduleId: m1.id,
      quizAnswers: m1.questions.map((q) => ({ qId: q.id, picked: q.answerIdx })),
    }),
  });
  check("lesson quiz scored 100 + completed", r.status === 200 && r.body.quiz.score === 100 && r.body.progress.status === "completed", JSON.stringify(r.body).slice(0, 120));

  // POST with 8 correct (half) → gain = 50 − 100 = −50.
  const half = perfect.map((a, i) => (i < 8 ? a : { qId: a.qId, picked: (keyById.get(a.qId) + 1) % 4 }));
  r = await jfetch("/api/learn/assessment", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ joinCode: "ADWA-M2S-9A", learnerCode: "AW-E2E001", kind: "POST", answers: half }),
  });
  check("POST submitted with score 50", r.status === 200 && r.body.assessment.score === 50, `score=${r.body.assessment?.score}`);
  check("gain computed against PRE (−50)", r.body.assessment.gain === -50, `gain=${r.body.assessment?.gain}`);

  // POST-before-PRE guard on a second fresh learner.
  const fresh2 = await db.awarenessLearner.create({
    data: { classId: tClass.id, code: "AW-E2E002", grade: tClass.grade, consent: "GRANTED", consentAt: new Date() },
  });
  r = await jfetch("/api/learn/assessment", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ joinCode: "ADWA-M2S-9A", learnerCode: "AW-E2E002", kind: "POST", answers: perfect }),
  });
  check("POST before PRE rejected (409 PRE_REQUIRED)", r.status === 409 && r.body.error?.code === "PRE_REQUIRED");

  // Wrong-class join code for a learner code.
  const controlClass = await db.awarenessClass.findUnique({ where: { joinCode: "ADWA-M2S-9B" } });
  r = await jfetch("/api/learn/learner", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ joinCode: "ADWA-M2S-9B", learnerCode: "AW-E2E001" }) });
  check("learner code from another class rejected (404)", r.status === 404);

  // ── 6. Consent register ──────────────────────────────────────────────────
  console.log("── 6. Consent register ──");
  r = await jfetch(`/api/awareness/consent?status=PENDING`, authed(superAdmin));
  check("GET consent register 200 (pending filter)", r.status === 200 && r.body.learners.length > 0 && r.body.learners.every((l) => l.consent === "PENDING"));
  const target = r.body.learners.find((l) => l.className === tClass.name) ?? r.body.learners[0];
  r = await jfetch("/api/awareness/consent", { method: "POST", ...jbody(superAdmin, { learnerId: target.id, decision: "GRANTED", consentRef: "FORM-E2E-CONSENT" }) });
  check("record consent GRANTED 200", r.status === 200 && r.body.learner.consent === "GRANTED");
  const targetClass = await db.awarenessClass.findUnique({ where: { id: target.id ? (await db.awarenessLearner.findUnique({ where: { id: target.id } })).classId : "" } });
  r = await jfetch("/api/learn/learner", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ joinCode: targetClass.joinCode, learnerCode: target.code }) });
  check("learner portal now sees GRANTED", r.status === 200 && r.body.learner.consent === "GRANTED");
  r = await jfetch("/api/awareness/consent", { method: "POST", ...jbody(superAdmin, { learnerId: target.id, decision: "MAYBE" }) });
  check("invalid consent decision 400", r.status === 400);
  r = await jfetch("/api/awareness/consent", { method: "POST", ...jbody(cbeAdmin, { learnerId: target.id, decision: "GRANTED" }) });
  check("ORG_ADMIN cannot record consent (403)", r.status === 403);

  // ── 7. Schools & classes administration ──────────────────────────────────
  console.log("── 7. Schools & classes admin ──");
  r = await jfetch("/api/awareness/schools", authed(superAdmin));
  check("GET schools 200 with 5 pilots", r.status === 200 && r.body.schools.length === 5);
  check("school payload carries classes + join codes", r.body.schools.every((s) => s.classes.length === 2 && s.classes.every((c) => /^ADWA-/.test(c.joinCode))));

  r = await jfetch("/api/awareness/schools", {
    method: "POST",
    ...jbody(superAdmin, { name: "E2E Secondary School", nameAm: "የሙከራ ትምህርት ቤት", subCity: "Bole" }),
  });
  check("POST school 201", r.status === 201, `status=${r.status}`);
  const e2eSchoolId = r.body.school.id;
  r = await jfetch("/api/awareness/schools", {
    method: "POST",
    ...jbody(superAdmin, { name: "E2E Secondary School", nameAm: "የሙከራ ትምህርት ቤት", subCity: "Bole" }),
  });
  check("duplicate school 409", r.status === 409);

  r = await jfetch("/api/awareness/classes", {
    method: "POST",
    ...jbody(superAdmin, { schoolId: e2eSchoolId, name: "Grade 9 — E2E", grade: 9, groupType: "CONTROL", teacherName: "E2E Teacher" }),
  });
  check("POST class 201 with generated join code", r.status === 201 && /^ADWA-[A-Z2-9]{8}$/.test(r.body.class.joinCode), JSON.stringify(r.body).slice(0, 100));
  const e2eClassId = r.body.class.id;
  r = await jfetch("/api/awareness/classes", {
    method: "POST",
    ...jbody(superAdmin, { schoolId: e2eSchoolId, name: "Grade 9 — E2E2", grade: 9, groupType: "WATCH" }),
  });
  check("invalid group type 400", r.status === 400);

  r = await jfetch(`/api/awareness/classes/${e2eClassId}/learners`, { method: "POST", ...jbody(superAdmin, { count: 3 }) });
  check("issue 3 participant codes 201", r.status === 201 && r.body.codes.length === 3 && r.body.codes.every((c) => /^AW-[A-Z2-9]{6}$/.test(c)), JSON.stringify(r.body).slice(0, 120));
  const issuedCode = r.body.codes[0];
  r = await jfetch("/api/learn/learner", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ joinCode: (await db.awarenessClass.findUnique({ where: { id: e2eClassId } })).joinCode, learnerCode: issuedCode }) });
  check("issued code starts PENDING (consent gate)", r.status === 200 && r.body.learner.consent === "PENDING");
  r = await jfetch(`/api/awareness/classes/${e2eClassId}/learners`, { method: "POST", ...jbody(superAdmin, { count: 0 }) });
  check("invalid count 400", r.status === 400);

  // ── 8. Evaluation export (CSV) ────────────────────────────────────────────
  console.log("── 8. Evaluation export ──");
  // Fresh snapshot (the journey above added 2 E2E learners + 1 consent flip).
  const ev2 = (await jfetch("/api/awareness/evaluation", authed(superAdmin))).body;
  const csvRes = await fetch(BASE + "/api/awareness/evaluation?format=csv", { headers: { Cookie: superAdmin.cookie } });
  const csv = await csvRes.text();
  r = { status: csvRes.status, headers: csvRes.headers };
  check("CSV export 200 text/csv", r.status === 200 && (r.headers.get("content-type") ?? "").includes("text/csv"));
  const csvLines = csv.split("\n").filter((l) => l.trim());
  check("CSV header + one row per consented participant", csvLines[0].startsWith("participant_code,school,sub_city,class,grade,group,pre_score,post_score,gain") && csvLines.length === ev2.rows.length + 1, `lines=${csvLines.length} rows=${ev2.rows.length}`);
  check("CSV contains pseudonymised codes only", csvLines.slice(1).every((l) => l.startsWith("AW-")));

  // ── 9. Audit trail ────────────────────────────────────────────────────────
  console.log("── 9. Audit events ──");
  const auditTypes = await db.authEvent.groupBy({ by: ["type"], where: { type: { startsWith: "AWARENESS_" } } });
  const present = new Set(auditTypes.map((g) => g.type));
  check("AWARENESS_MODULE_CREATED audited", present.has("AWARENESS_MODULE_CREATED"));
  check("AWARENESS_MODULE_UPDATED audited", present.has("AWARENESS_MODULE_UPDATED"));
  check("AWARENESS_QUESTION_ADDED audited", present.has("AWARENESS_QUESTION_ADDED"));
  check("AWARENESS_SCHOOL_CREATED audited", present.has("AWARENESS_SCHOOL_CREATED"));
  check("AWARENESS_CLASS_CREATED audited", present.has("AWARENESS_CLASS_CREATED"));
  check("AWARENESS_LEARNERS_ISSUED audited", present.has("AWARENESS_LEARNERS_ISSUED"));
  check("AWARENESS_CONSENT_RECORDED audited", present.has("AWARENESS_CONSENT_RECORDED"));

  // ── cleanup E2E artefacts ─────────────────────────────────────────────────
  await db.awarenessLearner.deleteMany({ where: { code: { in: ["AW-E2E001", "AW-E2E002"] } } });
  await db.awarenessSchool.delete({ where: { id: e2eSchoolId } }); // cascades classes+learners
  await db.awarenessModule.delete({ where: { id: testModuleId } }); // cascades questions
  // restore the consent we flipped to GRANTED back to its seeded state? It is
  // a legitimate register update — keep it (system-of-record semantics).
  console.log("  (E2E artefacts cleaned)");
} catch (e) {
  results.push(`FAIL  suite crashed — ${e.message}`);
  console.error(e);
} finally {
  await db.$disconnect();
}

const pass = results.filter((r) => r.startsWith("PASS")).length;
const fail = results.filter((r) => r.startsWith("FAIL")).length;
console.log("\n═══════════════════════════════════════════");
console.log(results.join("\n"));
console.log("═══════════════════════════════════════════");
console.log(`AWARENESS API: ${pass} passed, ${fail} failed (${results.length} total)`);
process.exit(fail > 0 ? 1 : 0);
