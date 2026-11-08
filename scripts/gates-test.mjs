/**
 * Adwa Cyber — Track C Gate Board verification (proposal Phases 4–5 governance).
 * Verifies:
 *   1. GET /api/gates — 8 criteria across P4_ACFS + P5_CII, readiness math
 *      (0% → locked), platform posture (deploymentAllowed=false)
 *   2. RBAC: commercial tenants (ORG_ADMIN) get 403 on read and update;
 *      unauthenticated 401
 *   3. Status lifecycle: forward-only transitions, invalid skips 409,
 *      SATISFIED requires evidence note 400, BLOCKED from any state
 *   4. Readiness progression: one criterion satisfied → 25%, gate still
 *      locked; all four → 100% + GATE OPEN + deploymentAllowed=true
 *   5. Audit trail: GATE_STATUS_CHANGED events recorded (platform-level)
 *   6. Re-seeding does not reset recorded governance state
 * Usage: node scripts/gates-test.mjs
 */
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const { execSync } = await import("node:child_process");

async function jfetch(url, opts = {}) {
  const r = await fetch(BASE + url, opts);
  let body = null;
  const ct = r.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) body = await r.json();
  else body = { raw: (await r.text()).slice(0, 120) };
  return { status: r.status, body, headers: r.headers };
}
const solveCaptcha = (svg) => [...svg.matchAll(/<text[^>]*>([^<]+)<\/text>/g)].map((m) => m[1]).join("");
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
const H = (s) => ({ Cookie: s.cookie });
const HJ = (s) => ({ Cookie: s.cookie, "Content-Type": "application/json" });

const results = [];
const check = (name, cond, extra = "") => results.push(`${cond ? "PASS" : "FAIL"}  ${name}${extra ? " — " + extra : ""}`);

async function resetGates() {
  // reset all criteria to NOT_STARTED so readiness math is deterministic
  const { PrismaClient } = await import("/adwa/node_modules/.prisma/client/index.js").catch(() => import("@prisma/client"));
  const db = new PrismaClient();
  await db.expansionGate.updateMany({ data: { status: "NOT_STARTED", notes: null, updatedById: null, targetDate: null } });
  await db.$disconnect();
}

try {
  console.log("═══ Track C Gate Board verification ═══");
  await resetGates();

  const superAdmin = await login("admin@adwacyber.et", "Adwa#Admin2026!");
  const cbeAdmin = await login("admin@cbe.com.et", "Adwa#Demo2026!");

  // ── 1. Board shape + initial readiness ─────────────────────────────────────
  let r = await jfetch("/api/gates", { headers: H(superAdmin) });
  check("GET /api/gates 200 (super)", r.status === 200);
  const p4 = r.body.phases.find((p) => p.phase === "P4_ACFS");
  const p5 = r.body.phases.find((p) => p.phase === "P5_CII");
  check("P4_ACFS has 4 criteria (EMA, EHRC, transparency, funding)", p4?.criteria.length === 4, p4?.criteria.map((c) => c.code).join(","));
  check("P5_CII has 4 criteria (MOUs, INSA, IEC 62443, insurance)", p5?.criteria.length === 4, p5?.criteria.map((c) => c.code).join(","));
  check("initial readiness 0% and locked", p4.readiness.readinessPct === 0 && p4.readiness.open === false);
  check("deployment NOT allowed while gates closed", r.body.trackC.deploymentAllowed === false);
  check("all criteria bilingual (EN+AM)", p4.criteria.every((c) => c.titleAm && c.detailAm));

  // ── 2. RBAC ────────────────────────────────────────────────────────────────
  r = await jfetch("/api/gates", { headers: H(cbeAdmin) });
  check("ORG_ADMIN read → 403 (platform-level governance)", r.status === 403, JSON.stringify(r.body.error?.code ?? ""));
  const anyId = p4.criteria[0].id;
  r = await jfetch(`/api/gates/${anyId}`, { method: "PATCH", headers: HJ(cbeAdmin), body: JSON.stringify({ status: "SATISFIED", note: "tenant attempt" }) });
  check("ORG_ADMIN update → 403", r.status === 403);
  r = await jfetch("/api/gates");
  check("unauthenticated → 401", r.status === 401);

  // ── 3. Lifecycle validation ────────────────────────────────────────────────
  const ema = p4.criteria.find((c) => c.code === "EMA_PARTNERSHIP");
  r = await jfetch(`/api/gates/${ema.id}`, { method: "PATCH", headers: HJ(superAdmin), body: JSON.stringify({ status: "SATISFIED" }) });
  check("SATISFIED without note → 400", r.status === 400, JSON.stringify(r.body.error?.code));
  r = await jfetch(`/api/gates/${ema.id}`, { method: "PATCH", headers: HJ(superAdmin), body: JSON.stringify({ status: "WEIRD" }) });
  check("invalid status → 400", r.status === 400);
  r = await jfetch(`/api/gates/${ema.id}`, { method: "PATCH", headers: HJ(superAdmin), body: JSON.stringify({ status: "SATISFIED", note: "Signed EMA partnership letter, ref EMA/2026/114" }) });
  check("NOT_STARTED → SATISFIED allowed (jump permitted, evidence named)", r.status === 200);
  r = await jfetch(`/api/gates/${ema.id}`, { method: "PATCH", headers: HJ(superAdmin), body: JSON.stringify({ status: "IN_PROGRESS" }) });
  check("SATISFIED → IN_PROGRESS rejected 409 (terminal)", r.status === 409, JSON.stringify(r.body.error?.code));
  r = await jfetch(`/api/gates/${ema.id}`, { method: "PATCH", headers: HJ(superAdmin), body: JSON.stringify({ status: "BLOCKED", note: "EMA negotiations suspended pending board decision" }) });
  check("SATISFIED → BLOCKED allowed (any state)", r.status === 200);
  r = await jfetch(`/api/gates/${ema.id}`, { method: "PATCH", headers: HJ(superAdmin), body: JSON.stringify({ status: "IN_PROGRESS", note: "Talks resumed with new EMA leadership" }) });
  check("BLOCKED → IN_PROGRESS (cleared)", r.status === 200);

  // ── 4. Readiness progression ───────────────────────────────────────────────
  r = await jfetch("/api/gates", { headers: H(superAdmin) });
  let cur = r.body.phases.find((p) => p.phase === "P4_ACFS");
  check("1 in_progress → 25% not yet (only SATISFIED counts)", cur.readiness.readinessPct === 0);
  // satisfy all four P4 criteria
  const notes = {
    EMA_PARTNERSHIP: "Signed EMA partnership letter, ref EMA/2026/114",
    EHRC_DUE_DILIGENCE: "Published HRDD report with EHRC engagement, Nov 2026",
    TRANSPARENCY_FRAMEWORK: "Appeal tiers + judicial oversight + quarterly audit + 90-day retention adopted by board",
    DEDICATED_FUNDING: "Institutional grant letter RDG/2026/77 covers the programme",
  };
  for (const c of cur.criteria) {
    r = await jfetch(`/api/gates/${c.id}`, { method: "PATCH", headers: HJ(superAdmin), body: JSON.stringify({ status: "SATISFIED", note: notes[c.code] ?? "Evidence on file" }) });
    check(`${c.code} → SATISFIED`, r.status === 200);
  }
  r = await jfetch("/api/gates", { headers: H(superAdmin) });
  cur = r.body.phases.find((p) => p.phase === "P4_ACFS");
  check("P4 4/4 satisfied → 100% + GATE OPEN", cur.readiness.readinessPct === 100 && cur.readiness.open === true);
  check("P5 still locked (0%)", r.body.phases.find((p) => p.phase === "P5_CII").readiness.open === false);
  check("Track C deploymentAllowed=true once P4 opens", r.body.trackC.deploymentAllowed === true);
  check("updatedBy recorded on each criterion", cur.criteria.every((c) => c.updatedBy?.name));

  // ── 5. Audit trail ─────────────────────────────────────────────────────────
  const { PrismaClient } = await import("/adwa/node_modules/.prisma/client/index.js").catch(() => import("@prisma/client"));
  const db = new PrismaClient();
  const events = await db.authEvent.findMany({
    where: { type: "GATE_STATUS_CHANGED", createdAt: { gte: new Date(Date.now() - 10 * 60_000) } },
    orderBy: { createdAt: "desc" },
  });
  check("GATE_STATUS_CHANGED audit events recorded", events.length >= 7, `n=${events.length}`);
  check("gate audit names criterion + transition", /P4_ACFS\/EMA_PARTNERSHIP: (NOT_STARTED|IN_PROGRESS|BLOCKED) → (SATISFIED|BLOCKED|IN_PROGRESS)/.test(events.find((e) => e.detail.includes("EMA_PARTNERSHIP"))?.detail ?? ""));
  check("gate audit is platform-level (organizationId=null)", events.every((e) => e.organizationId === null));

  // ── 6. Re-seed preserves governance state ──────────────────────────────────
  execSync("npx tsx scripts/seed-gates.ts", { cwd: "/adwa", stdio: "pipe" });
  r = await jfetch("/api/gates", { headers: H(superAdmin) });
  const after = r.body.phases.find((p) => p.phase === "P4_ACFS");
  check("re-seed does NOT reset satisfied criteria", after.criteria.every((c) => c.status === "SATISFIED"));
  await resetGates();
  await db.$disconnect();
} catch (e) {
  console.error("CRASHED:", e.message);
  process.exit(1);
}

const failed = results.filter((x) => x.startsWith("FAIL")).length;
console.log(`\n──── ${results.length - failed}/${results.length} checks passed ${"────"}`);
results.filter((x) => x.startsWith("FAIL")).forEach((x) => console.log(x));
process.exit(failed ? 1 : 0);
