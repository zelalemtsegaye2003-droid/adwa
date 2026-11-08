/**
 * Adwa Cyber — AI Enhancement Lab engine verification (proposal Phase 3,
 * Table 23). Unit-tests the six client-side engines directly (no dev server):
 *
 *   1. Password analyser: common/name/phone/short patterns scored down;
 *      long passphrases and Amharic characters scored up; bilingual tips.
 *   2. Phishing classifier: transparent feature model agrees with the
 *      documented verdict of every specimen in the Ethiopian corpus.
 *   3. Sextortion scenario: three INTERPOL-pattern steps, each with a
 *      safe/risky/unsafe choice; five-step response protocol.
 *   4. Footprint visualiser: all-safest → low band, all-riskiest → high
 *      band, personalised tips target the weakest categories.
 *   5. Flagging exercise: protected speech vs reportable harm across all
 *      eight posts (incl. Proclamation 1185/2020 hate-speech boundary).
 *   6. Reporting guide: a bilingual checklist for every incident type,
 *      with the official Ethio-CERT / 991 / 994 channels.
 *
 * Usage: bun scripts/awareness-tools-engine-test.ts
 */
import {
  AWARENESS_TOOLS,
  scorePassword,
  PHISH_SPECIMENS, phishiness, classifySpecimen,
  SEXTORTION_SCENARIO,
  FOOTPRINT_QUESTIONS, scoreFootprint,
  FLAG_POSTS,
  INCIDENT_TYPES, buildReportChecklist,
} from "../src/lib/awareness-tools";

const results: string[] = [];
const check = (name: string, cond: boolean, extra = "") =>
  results.push(`${cond ? "PASS" : "FAIL"}  ${name}${extra ? " — " + extra : ""}`);

// ── 0. Catalogue ─────────────────────────────────────────────────────────────
console.log("── 0. Catalogue ──");
check("six tools (one per proposal Table 23 row)", AWARENESS_TOOLS.length === 6);
check("tool ids unique", new Set(AWARENESS_TOOLS.map((t) => t.id)).size === 6);
check("every tool is fully bilingual", AWARENESS_TOOLS.every((t) => t.nameEn.length > 3 && t.nameAm.length > 3 && t.descEn.length > 10 && t.descAm.length > 10));
check("every tool maps to a curriculum unit", AWARENESS_TOOLS.every((t) => typeof t.moduleCode === "string" && /^AW-\d+$/.test(t.moduleCode)));

// ── 1. Password analyser ─────────────────────────────────────────────────────
console.log("── 1. Password analyser ──");
const weak = scorePassword("password");
check("'password' is critical/very weak", weak.score < 25 && weak.findings.some((f) => f.code === "common" && f.severity === "critical"), `score=${weak.score}`);
const namePw = scorePassword("abebe123");
check("Ethiopian name + digits scored down", namePw.findings.some((f) => f.code === "name"), namePw.findings.map((f) => f.code).join(","));
const phonePw = scorePassword("0911223344");
check("phone-number pattern detected", phonePw.findings.some((f) => f.code === "phone"), phonePw.findings.map((f) => f.code).join(","));
const seqPw = scorePassword("Qwerty123456");
check("keyboard/sequence pattern detected", seqPw.findings.some((f) => f.code === "sequence"), seqPw.findings.map((f) => f.code).join(","));
const shortPw = scorePassword("Ab1!");
check("short password flagged critical", shortPw.findings.some((f) => f.code === "short" && f.severity === "critical"));
const strongPw = scorePassword("Blue-Donkey-7-Coffee!x");
check("long passphrase scores strong+", strongPw.score >= 70, `score=${strongPw.score}`);
const amPw = scorePassword("ሰላም-ዓለም-Blue-92!");
check("Amharic characters recognised and rewarded", amPw.findings.some((f) => f.code === "am" && f.severity === "good") && amPw.entropyBits > 50, `bits=${amPw.entropyBits}`);
check("bilingual tips always present", strongPw.tipsEn.length >= 2 && strongPw.tipsAm.length === strongPw.tipsEn.length);
check("empty input handled safely", scorePassword("").score === 0);
check("crack-time is bilingual and human", strongPw.crackTimeEn.length > 3 && strongPw.crackTimeAm.length > 3, `${strongPw.crackTimeEn} / ${strongPw.crackTimeAm}`);

// ── 2. Phishing classifier ───────────────────────────────────────────────────
console.log("── 2. Phishing classifier ──");
check("ten Ethiopian specimens", PHISH_SPECIMENS.length === 10);
const phishy = PHISH_SPECIMENS.filter((s) => s.verdict === "PHISHING");
const legit = PHISH_SPECIMENS.filter((s) => s.verdict === "LEGIT");
check("corpus mixes phishing (6) and legitimate (4) specimens", phishy.length === 6 && legit.length === 4, `${phishy.length}/${legit.length}`);
let agree = 0;
for (const s of PHISH_SPECIMENS) {
  if (classifySpecimen(s) === s.verdict) agree++;
}
check("classifier verdict agrees with every documented verdict", agree === PHISH_SPECIMENS.length, `${agree}/${PHISH_SPECIMENS.length}`);
check("every phishing specimen scores ≥ threshold", phishy.every((s) => phishiness(s) >= 40), phishy.map((s) => phishiness(s)).join(","));
check("every legitimate specimen scores well below threshold", legit.every((s) => phishiness(s) < 40), legit.map((s) => phishiness(s)).join(","));
check("corpus covers documented Ethiopian lures (CBE, telebirr, Fayda, Ethio Telecom, BEC)",
  PHISH_SPECIMENS.some((s) => s.body.includes("CBE")) &&
  PHISH_SPECIMENS.some((s) => s.body.includes("telebirr")) &&
  PHISH_SPECIMENS.some((s) => s.sender.includes("Fayda")) &&
  PHISH_SPECIMENS.some((s) => s.body.includes("Ethio Telecom")) &&
  PHISH_SPECIMENS.some((s) => s.body.includes("bit.ly")));
check("every specimen explains itself bilingually", PHISH_SPECIMENS.every((s) => s.whyEn.length > 30 && s.whyAm.length > 10));

// ── 3. Sextortion scenario ───────────────────────────────────────────────────
console.log("── 3. Sextortion scenario ──");
check("three decision points", SEXTORTION_SCENARIO.steps.length === 3);
check("every step offers safe / risky / unsafe choices",
  SEXTORTION_SCENARIO.steps.every((st) => {
    const outcomes = new Set(st.choices.map((c) => c.outcome));
    return outcomes.has("safe") && outcomes.has("risky") && outcomes.has("unsafe") && st.choices.length === 3;
  }));
check("every choice gives bilingual feedback",
  SEXTORTION_SCENARIO.steps.every((st) => st.choices.every((c) => c.feedbackEn.length > 40 && c.feedbackAm.length > 10)));
check("five-step INTERPOL response protocol", SEXTORTION_SCENARIO.protocolEn.length === 5 && SEXTORTION_SCENARIO.protocolAm.length === 5);
check("protocol: never pay + tell an adult + report to Ethio-CERT",
  /never pay/i.test(SEXTORTION_SCENARIO.protocolEn[0]) && /trusted adult/i.test(SEXTORTION_SCENARIO.protocolEn[2]) && /Ethio-CERT/i.test(SEXTORTION_SCENARIO.protocolEn[3]));
check("scenario is third-person (no personal immersion)", /tigist/i.test(SEXTORTION_SCENARIO.introEn));

// ── 4. Footprint visualiser ──────────────────────────────────────────────────
console.log("── 4. Footprint visualiser ──");
check("ten self-audit questions across four categories", FOOTPRINT_QUESTIONS.length === 10);
const cats = new Set(FOOTPRINT_QUESTIONS.map((q) => q.category));
check("categories: exposure / accounts / sharing / network", cats.size === 4 && [...cats].sort().join(",") === "accounts,exposure,network,sharing");
const allSafe: Record<string, number> = {};
const allRisky: Record<string, number> = {};
for (const q of FOOTPRINT_QUESTIONS) {
  allSafe[q.id] = q.options.findIndex((o) => o.points === 0);
  allRisky[q.id] = q.options.findIndex((o) => o.points === Math.max(...q.options.map((o) => o.points)));
}
const safeRes = scoreFootprint(allSafe);
const riskyRes = scoreFootprint(allRisky);
check("all-safest answers → low exposure", safeRes.band === "low" && safeRes.risk === 0, `risk=${safeRes.risk}`);
check("all-riskiest answers → high exposure", riskyRes.band === "high" && riskyRes.risk === 100, `risk=${riskyRes.risk}`);
check("riskiest answers generate personalised tips", riskyRes.tipsEn.length >= 1 && riskyRes.tipsAm.length === riskyRes.tipsEn.length);
const empty = scoreFootprint({});
check("empty answer sheet handled safely", empty.risk === 0);
const mixed: Record<string, number> = { f1: 2, f2: 1, f3: 0, f4: 2, f5: 1, f6: 3, f7: 0, f8: 2, f9: 1, f10: 1 };
const mixedRes = scoreFootprint(mixed);
check("mixed answers land between the extremes", mixedRes.risk > safeRes.risk && mixedRes.risk < riskyRes.risk, `risk=${mixedRes.risk}`);

// ── 5. Flagging exercise ─────────────────────────────────────────────────────
console.log("── 5. Flagging exercise ──");
check("eight moderation posts", FLAG_POSTS.length === 8);
check("protected speech stays up (criticism, culture, satire)",
  FLAG_POSTS.filter((p) => p.correct === "KEEP").length === 3 &&
  FLAG_POSTS.every((p) => p.correct === "KEEP" ? ["protected_speech"].includes(p.basis) : true));
check("reportable harms flagged (scam, harassment, hate speech, doxxing, misinformation)",
  FLAG_POSTS.filter((p) => p.correct === "REPORT").every((p) => ["scam", "harassment", "hate_speech", "privacy", "misinformation"].includes(p.basis)));
const hatePost = FLAG_POSTS.find((p) => p.basis === "hate_speech");
check("hate-speech verdict cites Proclamation 1185/2020", !!hatePost && hatePost.whyEn.includes("1185/2020"), hatePost?.whyEn.slice(0, 60));
check("every verdict is explained bilingually", FLAG_POSTS.every((p) => p.whyEn.length > 40 && p.whyAm.length > 10));

// ── 6. Reporting guide ───────────────────────────────────────────────────────
console.log("── 6. Reporting guide ──");
check("six incident types", INCIDENT_TYPES.length === 6);
check("every incident builds a checklist", INCIDENT_TYPES.every((t) => buildReportChecklist(t.id) !== null));
check("unknown incident returns null", buildReportChecklist("not-a-thing") === null);
const sxt = buildReportChecklist("sextortion")!;
check("checklist = evidence → first response → report", sxt.steps.length === 3 && sxt.steps[0].titleEn.includes("evidence") && sxt.steps[2].titleEn.toLowerCase().includes("report"));
check("sextortion response: never pay (INTERPOL pattern)", sxt.steps[1].itemsEn.some((i) => /never pay/i.test(i)));
check("official channels include Ethio-CERT, 991 and telebirr 994",
  sxt.channelsEn.some((c) => c.includes("Ethio-CERT")) &&
  sxt.channelsEn.some((c) => c.includes("991")) &&
  sxt.channelsEn.some((c) => c.includes("994")));
check("data-breach guide carries the 72-hour window",
  buildReportChecklist("data_breach")!.steps[1].itemsEn.some((i) => i.includes("72")) &&
  buildReportChecklist("data_breach")!.steps[1].itemsAm.some((i) => i.includes("72")));
check("every type is fully bilingual",
  INCIDENT_TYPES.every((t) => {
    const c = buildReportChecklist(t.id)!;
    return c.steps.every((s) => s.itemsAm.length === s.itemsEn.length) && c.channelsAm.length === c.channelsEn.length;
  }));

// ── Report ───────────────────────────────────────────────────────────────────
const fails = results.filter((r) => r.startsWith("FAIL")).length;
console.log(results.join("\n"));
console.log(`\n${results.length - fails}/${results.length} checks passed`);
process.exit(fails > 0 ? 1 : 0);
