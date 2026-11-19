/**
 * Adwa Cyber — Awareness Platform demo seed (proposal Phase 3, Track B).
 *
 * Seeds the five-school Addis Ababa pilot (proposal §4.4, Table 4 "Phase 3
 * school pilot running in 5 Addis Ababa schools — pre/post knowledge
 * assessments administered per RQ2 design"):
 *
 *  1. Eight bilingual curriculum modules with quiz banks (awareness-data.ts).
 *  2. Five public secondary schools, each with one TREATMENT and one CONTROL
 *     class (RQ2 control-group design; evaluation = ANOVA on gains).
 *  3. ~30 pseudonymised learners per class (codes only — never names), with
 *     parental-consent states (GRANTED / PENDING / DENIED).
 *  4. PRE assessments for all consented learners; curriculum progress for
 *     TREATMENT learners; POST assessments for most consented learners —
 *     control classes show a small maturation gain, treatment classes a
 *     clear curriculum effect, so the ANOVA contrast is realistic.
 *
 * Deterministic (seeded RNG) so repeated runs give the same pilot data.
 * Idempotent — clears previous awareness seed data before re-creating.
 *
 * Usage: node scripts/seed-awareness.cjs [--heal]
 *   --heal : only insert missing rows (school/module skeletons), keep data.
 */
const { PrismaClient } = require("@prisma/client");
const db = new PrismaClient();

// D6 guard — refuses to seed a production DB without explicit opt-in
if (process.env.NODE_ENV === "production") {
  var bootstrapOk = process.env.SEED_ON_BOOT === "1" || process.env.ALLOW_DEMO_SEED === "1";
  var guardOk = "demo" === "bootstrap" ? bootstrapOk : process.env.ALLOW_DEMO_SEED === "1";
  if (!guardOk) {
    var needed = "demo" === "bootstrap" ? "SEED_ON_BOOT=1" : "ALLOW_DEMO_SEED=1";
    console.error("[seed-guard] " + "demo" + " seeding refused: NODE_ENV=production without " + needed + " (decision D6 — docs/DECISIONS.md).");
    process.exit(1);
  }
}

// Curriculum corpus (shared with the app through a tiny TS→JS bridge):
const path = require("path");
const fs = require("fs");
function loadArrays() {
  const src = fs.readFileSync(path.join(__dirname, "..", "src", "lib", "awareness", "awareness-data.ts"), "utf8");
  // Strip TS types/exports and evaluate the array literal. The array body is
  // plain data (no imports), so a parenthesised eval is safe here.
  function loadOne(name) {
    const marker = `export const ${name}: ModuleSeed[] =`;
    const modStart = src.indexOf(marker) + marker.length;
    if (modStart < marker.length) return [];
    const modEnd = src.indexOf("];", modStart) + 1; // first "];" closes the array
    return eval(`(${src.slice(modStart, modEnd).trim()})`);
  }
  return [
    ...loadOne("AWARENESS_MODULES"),        // KIDS pilot curriculum (RQ2)
    ...loadOne("AWARENESS_MODULES_TEENS"),  // CyberSmart Teens (Table 22)
    ...loadOne("AWARENESS_MODULES_PRO"),    // CyberPro (Table 22)
    ...loadOne("AWARENESS_MODULES_AWARE"),  // CyberAware (Table 22)
  ];
}
const MODULES = loadArrays();

// ── Deterministic RNG (mulberry32) ────────────────────────────────────────
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(13212024);
const randn = () => {
  // Box–Muller
  const u = Math.max(1e-9, rand());
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand());
};
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const round1 = (x) => Math.round(x * 10) / 10;

// Codes without confusable characters (0/O, 1/I).
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function code(prefix, len) {
  let s = "";
  for (let i = 0; i < len; i++) s += ALPHABET[Math.floor(rand() * ALPHABET.length)];
  return `${prefix}-${s}`;
}

const DAY = 24 * 60 * 60 * 1000;
const now = Date.now();
const daysAgo = (d, jitterH = 0) => new Date(now - d * DAY - Math.floor(rand() * jitterH) * 60 * 60 * 1000);

// ── The five Addis Ababa public pilot schools (illustrative names) ─────────
const SCHOOLS = [
  { name: "Menelik II Secondary School", nameAm: "ሜኔሊክ ሁለተኛ ደረጃ ትምህርት ቤት", subCity: "Arada", contactPerson: "W/ro Genet Tesfaye", contactPhone: "+251 11 111 0101" },
  { name: "Tegbareid Secondary School", nameAm: "ጠጋበሬድ ሁለተኛ ደረጃ ትምህርት ቤት", subCity: "Nifas Silk-Lafto", contactPerson: "Ato Hailu Abera", contactPhone: "+251 11 111 0202" },
  { name: "Ayer Tena Secondary School", nameAm: "አየር ጤና ሁለተኛ ደረጃ ትምህርት ቤት", subCity: "Kolfe Keranio", contactPerson: "W/ro Almaz Kebede", contactPhone: "+251 11 111 0303" },
  { name: "Ginfel Secondary School", nameAm: "ጊንፌል ሁለተኛ ደረጃ ትምህርት ቤት", subCity: "Yeka", contactPerson: "Ato Dawit Wolde", contactPhone: "+251 11 111 0404" },
  { name: "Saris Secondary School", nameAm: "ሳሪስ ሁለተኛ ደረጃ ትምህርት ቤት", subCity: "Akaki Kality", contactPerson: "W/ro Rome Bekele", contactPhone: "+251 11 111 0505" },
];

// A few fixed join codes so the demo/E2E can rely on them; the rest random.
const FIXED_JOIN_CODES = ["ADWA-M2S-9A", "ADWA-M2S-9B"];

async function main() {
  const heal = process.argv.includes("--heal");

  if (!heal) {
    console.log("── Awareness seed: clearing previous data ──");
    await db.awarenessToolPing.deleteMany();
    await db.awarenessProgress.deleteMany();
    await db.awarenessAssessment.deleteMany();
    await db.awarenessLearner.deleteMany();
    await db.awarenessClass.deleteMany();
    await db.awarenessSchool.deleteMany();
    await db.awarenessQuestion.deleteMany();
    await db.awarenessModule.deleteMany();
  }

  // ── 1. Curriculum modules + question banks ───────────────────────────────
  const audienceCounts = {};
  for (const m of MODULES) audienceCounts[m.audience] = (audienceCounts[m.audience] || 0) + 1;
  console.log(`── Curriculum: ${MODULES.length} modules (KIDS ${audienceCounts.KIDS}, TEENS ${audienceCounts.TEENS}, PRO ${audienceCounts.PRO}, AWARE ${audienceCounts.AWARE}) ──`);
  const modIds = {};
  const modQuestionIds = {}; // code -> [questionId by sortOrder]
  for (const m of MODULES) {
    let mod = await db.awarenessModule.findUnique({ where: { code: m.code } });
    if (mod) {
      // Keep audience in step with the corpus (heal/backfill path).
      if (mod.audience !== m.audience || mod.gradeBand !== m.gradeBand) {
        mod = await db.awarenessModule.update({ where: { id: mod.id }, data: { audience: m.audience, gradeBand: m.gradeBand } });
      }
    } else {
      mod = await db.awarenessModule.create({
        data: {
          code: m.code, sortOrder: m.sortOrder, topic: m.topic,
          titleEn: m.titleEn, titleAm: m.titleAm,
          summaryEn: m.summaryEn, summaryAm: m.summaryAm,
          contentEn: m.contentEn, contentAm: m.contentAm,
          durationMin: m.durationMin, gradeBand: m.gradeBand, audience: m.audience,
        },
      });
      console.log(`  + module ${m.code} [${m.audience}] — ${m.titleEn}`);
    }
    modIds[m.code] = mod.id;
    modQuestionIds[m.code] = {};
    for (const [qi, q] of m.questions.entries()) {
      const sortOrder = qi + 1;
      let ex = await db.awarenessQuestion.findFirst({
        where: { moduleId: mod.id, sortOrder },
      });
      if (!ex) {
        ex = await db.awarenessQuestion.create({
          data: {
            moduleId: mod.id, sortOrder,
            promptEn: q.promptEn, promptAm: q.promptAm,
            optionsEn: JSON.stringify(q.optionsEn), optionsAm: JSON.stringify(q.optionsAm),
            answerIdx: q.answerIdx, explainEn: q.explainEn, explainAm: q.explainAm,
          },
        });
      }
      modQuestionIds[m.code][sortOrder] = ex.id;
    }
  }

  if (heal) {
    // Heal also restores lost AI-tool ping telemetry (aggregate data only).
    const pingCount = await db.awarenessToolPing.count();
    if (pingCount === 0) {
      console.log("  (heal mode: tool pings missing — reseeding telemetry)");
      const TOOLS = ["password", "phishing", "sextortion", "footprint", "flagging", "report-guide"];
      const rows = [];
      for (let i = 0; i < 2610; i++) {
        rows.push({
          tool: TOOLS[Math.floor(rand() * TOOLS.length)],
          lang: rand() < 0.72 ? "am" : "en",
          createdAt: new Date(now - Math.floor(rand() * 14) * DAY - Math.floor(rand() * 24) * 60 * 60 * 1000),
        });
      }
      await db.awarenessToolPing.createMany({ data: rows });
    }
    console.log("  (heal mode: curriculum ensured, pilot data untouched)");
    return;
  }

  // ── 2. Schools + classes (treatment/control per RQ2 design) ──────────────
  console.log("── Five Addis Ababa pilot schools, TREATMENT + CONTROL classes ──");
  const classList = [];
  let fixedIdx = 0;
  for (const s of SCHOOLS) {
    const school = await db.awarenessSchool.create({ data: s });
    console.log(`  + ${school.name} (${school.subCity})`);
    for (const groupType of ["TREATMENT", "CONTROL"]) {
      const grade = rand() < 0.5 ? 9 : 10;
      const section = groupType === "TREATMENT" ? "A" : "B";
      const joinCode =
        fixedIdx < FIXED_JOIN_CODES.length ? FIXED_JOIN_CODES[fixedIdx++] : code("ADWA", 8);
      const klass = await db.awarenessClass.create({
        data: {
          schoolId: school.id,
          name: `Grade ${grade} — Section ${section}`,
          grade,
          groupType,
          joinCode,
          teacherName: groupType === "TREATMENT" ? "Ato Yonas Girma" : "W/ro Hiwot Alemu",
        },
      });
      classList.push(klass);
      console.log(`    · ${klass.name} [${groupType}] join=${joinCode}`);
    }
  }

  // ── 3. Learners (pseudonymised codes) + parental consent ─────────────────
  console.log("── Learners + parental consent register ──");
  let consentGranted = 0, consentPending = 0, consentDenied = 0;
  for (const klass of classList) {
    const n = 28 + Math.floor(rand() * 5); // 28–32 learners
    for (let i = 0; i < n; i++) {
      const roll = rand();
      let consent = "GRANTED";
      if (roll > 0.92) consent = "DENIED";
      else if (roll > 0.84) consent = "PENDING";
      if (consent === "GRANTED") consentGranted++;
      else if (consent === "PENDING") consentPending++;
      else consentDenied++;
      await db.awarenessLearner.create({
        data: {
          classId: klass.id,
          code: code("AW", 6),
          grade: klass.grade,
          consent,
          consentAt: consent === "PENDING" ? null : daysAgo(70, 24),
          consentRef: consent === "PENDING" ? null : `FORM-${klass.joinCode}-${100 + i}`,
        },
      });
    }
  }
  console.log(`  consent: ${consentGranted} granted / ${consentPending} pending / ${consentDenied} denied`);

  // ── 4. RQ2 pilot data: PRE, curriculum progress, POST ────────────────────
  console.log("── RQ2 assessments (pre/post) + curriculum progress ──");
  const learners = await db.awarenessLearner.findMany({ include: { class: true } });
  // RQ2 instrument + pilot curriculum are pinned to the KIDS programme:
  // TEENS/PRO/AWARE units are supplementary learning for other audiences and
  // never enter the fixed 16-item instrument (proposal Table 22 module
  // architecture; evaluation design RQ2).
  const allModules = await db.awarenessModule.findMany({
    orderBy: { sortOrder: "asc" },
    include: { questions: { orderBy: { sortOrder: "asc" }, where: { isActive: true } } },
  });
  const modules = allModules.filter((m) => m.audience === "KIDS");

  // The fixed 16-item instrument: questions 1 and 3 of each KIDS module.
  const instrument = [];
  for (const m of modules) {
    instrument.push(m.questions[0]);
    if (m.questions.length >= 3) instrument.push(m.questions[2]);
  }
  const INSTRUMENT_N = instrument.length;
  if (INSTRUMENT_N !== 16) {
    throw new Error(`Expected the fixed 16-item KIDS instrument, found ${INSTRUMENT_N} — refusing to seed inconsistent RQ2 data`);
  }

  let preN = 0, postN = 0, progressN = 0;
  const answersJson = (score) => {
    // Build a plausible answer sheet for the recorded score.
    const arr = [];
    const target = Math.round((score / 100) * INSTRUMENT_N);
    let correctLeft = target;
    for (let i = 0; i < INSTRUMENT_N; i++) {
      const q = instrument[i];
      const correct = correctLeft > 0 && (correctLeft >= INSTRUMENT_N - i || rand() < 0.62);
      if (correct) correctLeft--;
      const answerIdx = JSON.parse(q.optionsEn).length ? JSON.parse(q.optionsAm).length : 4;
      const wrongs = [0, 1, 2, 3].filter((x) => x !== q.answerIdx);
      arr.push({ qId: q.id, picked: correct ? q.answerIdx : wrongs[Math.floor(rand() * wrongs.length)], correct });
    }
    return JSON.stringify(arr);
  };

  for (const l of learners) {
    if (l.consent !== "GRANTED") continue;
    const isTreatment = l.class.groupType === "TREATMENT";

    // PRE: baseline knowledge ~ N(50, 11), floor 15
    const pre = clamp(Math.round(50 + randn() * 11), 15, 85);
    // POST gains: control ~ N(3.5, 6) maturation; treatment ~ N(16.5, 8)
    const gain = isTreatment ? randn() * 8 + 16.5 : randn() * 6 + 3.5;
    const post = clamp(Math.round(pre + gain), 10, 100);

    await db.awarenessAssessment.create({
      data: {
        learnerId: l.id, kind: "PRE",
        total: INSTRUMENT_N, correct: Math.round((pre / 100) * INSTRUMENT_N),
        score: pre, answers: answersJson(pre), takenAt: daysAgo(58, 12),
      },
    });
    preN++;

    // Curriculum engagement for treatment learners (staggered over 6 weeks).
    if (isTreatment) {
      const completed = modules.filter(() => rand() < 0.87);
      for (const m of completed) {
        const quiz = clamp(Math.round(post - 8 + randn() * 9), 20, 100);
        await db.awarenessProgress.create({
          data: {
            learnerId: l.id, moduleId: m.id, status: "completed",
            quizScore: round1(quiz),
            startedAt: daysAgo(46, 24), completedAt: daysAgo(40 - m.sortOrder * 3, 24),
          },
        });
        progressN++;
      }
      // ~9% of treatment learners have not sat the POST yet (still in window)
      if (rand() < 0.09) continue;
    } else if (rand() < 0.04) {
      continue; // a few control absences on post day
    }

    await db.awarenessAssessment.create({
      data: {
        learnerId: l.id, kind: "POST",
        total: INSTRUMENT_N, correct: Math.round((post / 100) * INSTRUMENT_N),
        score: post, answers: answersJson(post), takenAt: daysAgo(9, 24),
      },
    });
    postN++;
  }
  console.log(`  PRE sittings: ${preN}, POST sittings: ${postN}, lesson completions: ${progressN}`);

  // ── 4b. Fixed demo participants for the browser E2E ──────────────────────
  // Created AFTER the RQ2 generation so their journey is fresh: AW-BR001 is
  // consented with no sittings (full PRE → lesson → POST walkthrough),
  // AW-BR002 stays PENDING (consent-gate check). Attached to the fixed
  // treatment class ADWA-M2S-9A.
  const fixedClass = await db.awarenessClass.findUnique({ where: { joinCode: "ADWA-M2S-9A" } });
  if (fixedClass) {
    for (const [demoCode, consent] of [["AW-DEMO01", "GRANTED"], ["AW-DEMO02", "PENDING"]]) {
      const existing = await db.awarenessLearner.findUnique({ where: { code: demoCode } });
      if (!existing) {
        await db.awarenessLearner.create({
          data: {
            classId: fixedClass.id,
            code: demoCode,
            grade: fixedClass.grade,
            consent,
            consentAt: consent === "GRANTED" ? daysAgo(65, 24) : null,
            consentRef: consent === "GRANTED" ? `FORM-${fixedClass.joinCode}-DEMO` : null,
          },
        });
        console.log(`  + demo participant ${demoCode} (${consent})`);
      }
    }
  }

  // ── 5. AI Enhancement Lab usage telemetry (aggregate, no personal data) ──
  console.log("── AI tool usage pings (last 14 days, aggregate only) ──");
  const TOOLS = [
    { id: "password", weight: 26 },
    { id: "phishing", weight: 24 },
    { id: "sextortion", weight: 12 },
    { id: "footprint", weight: 14 },
    { id: "flagging", weight: 10 },
    { id: "report-guide", weight: 14 },
  ];
  const totalWeight = TOOLS.reduce((s, t) => s + t.weight, 0);
  const PINGS = 2610;
  const pingRows = [];
  for (let i = 0; i < PINGS; i++) {
    // Adoption ramps up over the two weeks (soft launch → school rollout).
    const dayBack = Math.floor(Math.pow(rand(), 1.45) * 14);
    let pickTool = rand() * totalWeight;
    let tool = TOOLS[TOOLS.length - 1].id;
    for (const t of TOOLS) {
      if ((pickTool -= t.weight) <= 0) { tool = t.id; break; }
    }
    pingRows.push({
      tool,
      lang: rand() < 0.72 ? "am" : "en",
      createdAt: new Date(now - dayBack * DAY - Math.floor(rand() * 24) * 60 * 60 * 1000),
    });
  }
  await db.awarenessToolPing.createMany({ data: pingRows });
  const perTool = {};
  for (const r of pingRows) perTool[r.tool] = (perTool[r.tool] || 0) + 1;
  console.log(`  ${PINGS} pings — ` + TOOLS.map((t) => `${t.id}:${perTool[t.id]}`).join(" "));

  console.log("── Awareness seed complete ──");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
