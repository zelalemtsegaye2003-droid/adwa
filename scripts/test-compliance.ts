/**
 * Adwa Cyber — compliance engine end-to-end tests (module B catalogue + engine).
 * Covers: 47-rule catalogue integrity (bilingual fields, pillars, penalties,
 * filters), full scan lifecycle (create → answer → evaluate → findings → stats),
 * and RBAC / tenant isolation on the compliance routes.
 *
 * Run: bun scripts/test-compliance.ts   (dev server on :3000 required)
 */
const BASE = "http://localhost:3000";

const SUPER = { email: "admin@adwacyber.et", password: "Adwa#Admin2026!" };
const ORG_ADMIN_CBE = { email: "admin@cbe.com.et", password: "Adwa#Demo2026!" };
const AUDITOR_DASHEN = { email: "auditor@dashen.com.et", password: "Adwa#Demo2026!" };
const VIEWER_ETC = { email: "viewer@ethiotelecom.et", password: "Adwa#Demo2026!" };

const PILLAR_WEIGHTS: Record<string, number> = {
  Legal: 0.35, Technical: 0.3, Organisational: 0.2, Awareness: 0.15,
};

let passed = 0, failed = 0;
function ok(name: string, cond: boolean, extra = "") {
  if (cond) { passed++; console.log(`  ✓ ${name}${extra ? " — " + extra : ""}`); }
  else { failed++; console.error(`  ✗ ${name}${extra ? " — " + extra : ""}`); }
}

// ── helpers (same pattern as test-auth.ts) ─────────────────────────────────
function parseCaptchaSvg(svg: string): string {
  return [...svg.matchAll(/<text[^>]*>([^<])<\/text>/g)].map((m) => m[1]).join("");
}
async function getCaptcha(ip: string) {
  const res = await fetch(`${BASE}/api/auth/captcha`, { headers: { "X-Forwarded-For": ip } });
  const dto = await res.json();
  if (!dto.captchaId) throw new Error(`captcha fetch failed: ${JSON.stringify(dto)}`);
  return { captchaId: dto.captchaId, captchaAnswer: parseCaptchaSvg(dto.svg) };
}
function parseCookies(res: Response): Record<string, string> {
  const jar: Record<string, string> = {};
  for (const raw of res.headers.getSetCookie?.() ?? []) {
    const [pair] = raw.split(";");
    const eq = pair.indexOf("=");
    jar[pair.slice(0, eq)] = pair.slice(eq + 1);
  }
  return jar;
}
const cookieHeader = (jar: Record<string, string>) =>
  Object.entries(jar).map(([k, v]) => `${k}=${v}`).join("; ");

const ips = new Map<string, string>();
function ipFor(email: string): string {
  if (!ips.has(email)) {
    const h = [...email].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
    ips.set(email, `10.77.${(h >> 8) & 255}.${h & 255}`);
  }
  return ips.get(email)!;
}

async function login(creds: { email: string; password: string }) {
  const ip = ipFor(creds.email);
  for (let attempt = 0; attempt < 4; attempt++) {
    const captcha = await getCaptcha(ip);
    const res = await fetch(`${BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Forwarded-For": ip },
      body: JSON.stringify({ ...creds, ...captcha }),
    });
    if (res.status === 429) { await new Promise((r) => setTimeout(r, 1500)); continue; }
    const body = await res.json().catch(() => null);
    if (!res.ok || !body?.user) throw new Error(`login failed for ${creds.email}: ${res.status} ${JSON.stringify(body)}`);
    return { jar: parseCookies(res), user: body.user };
  }
  throw new Error(`login kept being rate-limited for ${creds.email}`);
}

const authed = (jar: Record<string, string>, ip = "10.77.1.1") => ({
  "Content-Type": "application/json", Cookie: cookieHeader(jar), "X-Forwarded-For": ip,
});

function penaltyFactor(penaltyRef: string): number {
  if (penaltyRef.includes("4%")) return 3;
  if (penaltyRef.includes("5–10 years")) return 3;
  if (penaltyRef.includes("3–5 years")) return 2;
  if (penaltyRef.includes("1–3 years")) return 1.5;
  return 1;
}

// ── run ─────────────────────────────────────────────────────────────────────
const superS = await login(SUPER);
let scanId = "";
let testFindingId = "";
try {
  console.log("══ 1. Catalogue integrity (47 obligations) ══");
  const rulesRes = await fetch(`${BASE}/api/rules`, { headers: authed(superS.jar) });
  const rulesDto = await rulesRes.json();
  ok("GET /api/rules → 200", rulesRes.status === 200);
  const rules = rulesDto.rules ?? [];
  ok("catalogue returns exactly 47 rules", rules.length === 47 && rulesDto.total === 47, `got ${rules.length}/total ${rulesDto.total}`);
  ok("all codes unique", new Set(rules.map((r: any) => r.code)).size === 47);
  ok("sortOrder contiguous 1..47",
    rules.map((r: any) => r.sortOrder).every((s: number, i: number) => s === i + 1));
  ok("every rule has bilingual title/statement/question/remediation",
    rules.every((r: any) => [r.titleEn, r.titleAm, r.statementEn, r.statementAm, r.questionEn, r.questionAm, r.remediationEn, r.remediationAm]
      .every((f: string) => typeof f === "string" && f.trim().length > 0)));
  ok("pillars within the four defined", rules.every((r: any) =>
    ["Legal", "Technical", "Organisational", "Awareness"].includes(r.pillar)));
  ok("severity/priority/penalty present", rules.every((r: any) =>
    ["critical", "high", "medium"].includes(r.severity) && ["P0", "P1"].includes(r.priority) && !!r.penaltyRef && r.weight >= 1));
  const byPillar: Record<string, number> = {};
  for (const r of rules) byPillar[r.pillar] = (byPillar[r.pillar] ?? 0) + 1;
  console.log(`    pillar distribution: ${JSON.stringify(byPillar)}`);

  console.log("══ 2. Catalogue filters ══");
  const tech = rules.filter((r: any) => r.pillar === "Technical");
  const f1 = await (await fetch(`${BASE}/api/rules?pillar=Technical`, { headers: authed(superS.jar) })).json();
  ok("filter ?pillar=Technical", f1.rules.length === tech.length, `${f1.rules.length} vs ${tech.length}`);
  const art2 = rules.filter((r: any) => r.article === "Art. 2");
  const f2 = await (await fetch(`${BASE}/api/rules?article=${encodeURIComponent("Art. 2")}`, { headers: authed(superS.jar) })).json();
  ok("filter ?article=Art. 2", f2.rules.length === art2.length, `${f2.rules.length} rules`);
  const crit = rules.filter((r: any) => r.severity === "critical");
  const f3 = await (await fetch(`${BASE}/api/rules?severity=critical`, { headers: authed(superS.jar) })).json();
  ok("filter ?severity=critical", f3.rules.length === crit.length, `${f3.rules.length} rules`);
  const qHit = rules.filter((r: any) => `${r.code} ${r.titleEn} ${r.statementEn}`.toLowerCase().includes("breach"));
  const f4 = await (await fetch(`${BASE}/api/rules?q=breach`, { headers: authed(superS.jar) })).json();
  ok("free-text search ?q=breach", f4.rules.length === qHit.length, `${f4.rules.length} hits`);
  const combo = await (await fetch(`${BASE}/api/rules?pillar=Technical&severity=critical`, { headers: authed(superS.jar) })).json();
  ok("combined filters", combo.rules.every((r: any) => r.pillar === "Technical" && r.severity === "critical"));

  console.log("══ 3. Organizations directory ══");
  const orgsRes = await fetch(`${BASE}/api/organizations`, { headers: authed(superS.jar) });
  const orgsDto = await orgsRes.json();
  ok("GET /api/organizations → 200", orgsRes.status === 200);
  const orgs = orgsDto.organizations ?? [];
  ok("organizations present with scanCount", orgs.length >= 5 && orgs.every((o: any) => typeof o.scanCount === "number"), `${orgs.length} orgs`);
  const cbe = orgs.find((o: any) => /commercial/i.test(o.name) || /cbe/i.test(o.name)) ?? orgs[0];
  const dashen = orgs.find((o: any) => /dashen/i.test(o.name)) ?? orgs.find((o: any) => o.id !== cbe.id);

  console.log("══ 4. Scan lifecycle — create / answer / evaluate ══");
  const createRes = await fetch(`${BASE}/api/scans`, {
    method: "POST", headers: authed(superS.jar),
    body: JSON.stringify({ organizationId: cbe.id, name: "E2E compliance verification" }),
  });
  const createDto = await createRes.json();
  ok("POST /api/scans → 201", createRes.status === 201 && !!createDto.scan?.id);
  scanId = createDto.scan?.id ?? "";

  const detailRes = await fetch(`${BASE}/api/scans/${scanId}`, { headers: authed(superS.jar) });
  const detailDto = await detailRes.json();
  ok("scan detail: 47 initialised result rows", detailDto.scan?.results?.length === 47);
  ok("scan starts in_progress with na answers",
    detailDto.scan?.status === "in_progress" && detailDto.scan.results.every((r: any) => r.answer === "na"));

  // Answer plan: 25 yes / 12 partial / 8 no / 2 na (by sortOrder)
  const answers = rules.map((r: any, i: number) => ({
    ruleCode: r.code,
    answer: i < 25 ? "yes" : i < 37 ? "partial" : i < 45 ? "no" : "na",
    ...(i === 30 ? { evidenceNote: "Policy drafted, board approval pending." } : {}),
  }));
  const submitRes = await fetch(`${BASE}/api/scans/${scanId}/submit`, {
    method: "POST", headers: authed(superS.jar), body: JSON.stringify({ answers }),
  });
  const sub = await submitRes.json();
  ok("submit answers → 200", submitRes.status === 200, `status ${submitRes.status}`);
  const eng = sub.engine ?? {};
  ok("overall score in 0–100", typeof eng.overallScore === "number" && eng.overallScore >= 0 && eng.overallScore <= 100, `${eng.overallScore}`);
  ok("findings = 12 partial + 8 no", eng.findingsCount === 20, `got ${eng.findingsCount}`);
  const expectedCritical = rules.filter((r: any, i: number) => r.severity === "critical" && i >= 25 && i < 45).length;
  ok("critical findings match expectation", eng.criticalFindings === expectedCritical, `${eng.criticalFindings} vs ${expectedCritical}`);
  ok("four pillar scores reported", ["Legal", "Technical", "Organisational", "Awareness"]
    .every((p) => typeof eng.pillarScores?.[p] === "number"), JSON.stringify(eng.pillarScores));
  // Recompute overall from returned pillar scores + weights (all pillars applicable here)
  const expectedOverall = ["Legal", "Technical", "Organisational", "Awareness"]
    .reduce((s, p) => s + eng.pillarScores[p] * PILLAR_WEIGHTS[p], 0);
  ok("overall = pillar-weighted average", Math.abs(expectedOverall - eng.overallScore) < 0.15,
    `${eng.overallScore} vs ${expectedOverall.toFixed(1)}`);
  const plan = eng.remediationPlan ?? [];
  ok("remediation plan covers all 20 findings, bilingual", plan.length === 20 &&
    plan.every((p: any) => p.remediationEn && p.remediationAm && p.riskRank > 0));
  ok("plan sorted by descending risk", plan.every((p: any, i: number) => i === 0 || plan[i - 1].riskRank >= p.riskRank));
  ok("plan ranks are 1..n", plan.every((p: any, i: number) => p.rank === i + 1));
  const expectedPredictive = rules.filter((r: any, i: number) => i >= 25 && i < 37 && penaltyFactor(r.penaltyRef) >= 2).length;
  const gotPredictive = (eng.results ?? []).filter((r: any) => r.predictive).length;
  ok("predictive flags = partial + high penalty exposure", gotPredictive === expectedPredictive, `${gotPredictive} vs ${expectedPredictive}`);
  ok("RQ1 audit-time comparison reported", sub.time?.manualRangeHours?.[0] === 40 && sub.time?.manualRangeHours?.[1] === 80 && sub.time.rq1Target === 70,
    `manual ${sub.time?.manualRangeHours}h vs engine ${sub.time?.engineMinutes}min (-${sub.time?.reductionPercent}%)`);

  const persisted = await (await fetch(`${BASE}/api/scans/${scanId}`, { headers: authed(superS.jar) })).json();
  ok("scan persisted as complete with score", persisted.scan?.status === "complete" && persisted.scan?.overallScore === eng.overallScore);
  const persistedFindings = (persisted.scan?.results ?? []).filter((r: any) => r.answer === "partial" || r.answer === "no");
  ok("findings persisted with bilingual text + risk rank",
    persistedFindings.length === 20 && persistedFindings.every((r: any) => r.findingEn && r.findingAm && r.riskRank > 0));
  ok("compliant/na rows have zero risk rank",
    (persisted.scan?.results ?? []).filter((r: any) => r.answer === "yes" || r.answer === "na").every((r: any) => r.riskRank === 0));
  testFindingId = persistedFindings[0]?.id ?? "";
  const evidenceKept = (persisted.scan?.results ?? []).find((r: any) => r.rule?.code === rules[30].code);
  ok("evidence note persisted", evidenceKept?.evidenceNote === "Policy drafted, board approval pending.");

  const resubmit = await fetch(`${BASE}/api/scans/${scanId}/submit`, {
    method: "POST", headers: authed(superS.jar), body: JSON.stringify({ answers }) });
  ok("re-submitting a complete scan → 409", resubmit.status === 409);

  console.log("══ 5. Findings remediation workflow ══");
  const patch1 = await fetch(`${BASE}/api/findings/${testFindingId}`, {
    method: "PATCH", headers: authed(superS.jar), body: JSON.stringify({ status: "in_progress" }) });
  ok("PATCH finding → in_progress", patch1.status === 200);
  const patchBad = await fetch(`${BASE}/api/findings/${testFindingId}`, {
    method: "PATCH", headers: authed(superS.jar), body: JSON.stringify({ status: "bogus" }) });
  ok("invalid status → 400", patchBad.status === 400);
  const patch2 = await fetch(`${BASE}/api/findings/${testFindingId}`, {
    method: "PATCH", headers: authed(superS.jar), body: JSON.stringify({ status: "remediated" }) });
  const patch2dto = await patch2.json();
  ok("PATCH finding → remediated", patch2.status === 200 && patch2dto.result?.status === "remediated");

  console.log("══ 6. Stats ══");
  const statsRes = await fetch(`${BASE}/api/stats`, { headers: authed(superS.jar) });
  const stats = await statsRes.json();
  ok("GET /api/stats → 200 with payload", statsRes.status === 200 && typeof stats === "object" && Object.keys(stats).length > 0);

  console.log("══ 7. RBAC & tenant isolation on compliance routes ══");
  const unauth = await fetch(`${BASE}/api/rules`);
  ok("unauthenticated catalogue → 401", unauth.status === 401);

  const viewerS = await login(VIEWER_ETC);
  const viewerScan = await fetch(`${BASE}/api/scans`, {
    method: "POST", headers: authed(viewerS.jar, ipFor(VIEWER_ETC.email)),
    body: JSON.stringify({ organizationId: cbe.id }) });
  ok("VIEWER cannot start a scan → 403", viewerScan.status === 403);
  const viewerList = await (await fetch(`${BASE}/api/scans`, { headers: authed(viewerS.jar, ipFor(VIEWER_ETC.email)) })).json();
  ok("VIEWER sees only own-organization scans", (viewerList.scans ?? []).every((s: any) => s.organizationId === viewerS.user.organizationId) &&
    !(viewerList.scans ?? []).some((s: any) => s.id === scanId));

  const cbeAdminS = await login(ORG_ADMIN_CBE);
  const crossScan = await fetch(`${BASE}/api/scans`, {
    method: "POST", headers: authed(cbeAdminS.jar, ipFor(ORG_ADMIN_CBE.email)),
    body: JSON.stringify({ organizationId: dashen.id }) });
  ok("ORG_ADMIN cannot scan another tenant → 403", crossScan.status === 403);

  const dashenAudS = await login(AUDITOR_DASHEN);
  const crossView = await fetch(`${BASE}/api/scans/${scanId}`, { headers: authed(dashenAudS.jar, ipFor(AUDITOR_DASHEN.email)) });
  ok("AUDITOR cannot view another tenant's scan → 403", crossView.status === 403);
  const auditorPatch = await fetch(`${BASE}/api/findings/${testFindingId}`, {
    method: "PATCH", headers: authed(dashenAudS.jar, ipFor(AUDITOR_DASHEN.email)), body: JSON.stringify({ status: "open" }) });
  ok("AUDITOR cannot manage findings → 403", auditorPatch.status === 403);
} finally {
  console.log("══ 8. Cleanup ══");
  if (scanId) {
    const { PrismaClient } = await import("@prisma/client");
    const db = new PrismaClient();
    try {
      await db.scan.delete({ where: { id: scanId } });
      const gone = await db.scan.findUnique({ where: { id: scanId } });
      ok("test scan removed", gone === null);
    } finally { await db.$disconnect(); }
  }
}

console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log(`RESULT: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
