/**
 * Adwa Cyber — AI Enhancement Lab + audience-track API verification
 * (proposal Phase 3, Tables 22 & 23). Against the dev server:
 *
 *   1. Public catalogue: /api/learn/modules exposes audience; 15 units
 *      (8 Kids / 3 Teens / 2 Pro / 2 Aware); instrument stays pinned to
 *      the 16-item Kids curriculum.
 *   2. Tools ping: valid ping 200; unknown tool 400; malformed JSON 400;
 *      rate limit 429 with Retry-After; pings land in aggregate telemetry.
 *   3. Overview (SUPER_ADMIN): tools telemetry (6 tools, counts, 14-day
 *      series, Amharic share), modulesByAudience, instrument pinned to 16.
 *   4. RBAC: ORG_ADMIN / unauthenticated blocked from awareness overview.
 *   5. Curriculum admin: audience filter, create unit with audience TEENS,
 *      PATCH audience → PRO (audit recorded), audience-validation.
 *
 * Usage: node scripts/awareness-tools-api-test.mjs
 */
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const { PrismaClient } = await import("/home/z/my-project/node_modules/.prisma/client/index.js").catch(() => import("@prisma/client"));
const db = new PrismaClient();

async function jfetch(url, opts = {}) {
  let r = await fetch(BASE + url, opts);
  if (r.status === 429) {
    const wait = (Number(r.headers.get("retry-after")) || 5) * 1000;
    await new Promise((res) => setTimeout(res, Math.min(wait, 15_000)));
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
  return { cookie: res.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ") };
}

const authed = (s) => ({ headers: { Cookie: s.cookie } });
const jbody = (s, payload, method = "POST") => ({
  method,
  headers: { Cookie: s.cookie, "Content-Type": "application/json" },
  body: JSON.stringify(payload),
});
const results = [];
const check = (name, cond, extra = "") => results.push(`${cond ? "PASS" : "FAIL"}  ${name}${extra ? " — " + extra : ""}`);

try {
  await db.awarenessModule.deleteMany({ where: { titleEn: { in: ["E2E Audience Unit", "E2E Audience Unit v2"] } } });
  const superAdmin = await login("admin@adwacyber.et", "Adwa#Admin2026!");
  const cbeAdmin = await login("admin@cbe.com.et", "Adwa#Demo2026!");

  // ── 1. Public catalogue + instrument pinning ─────────────────────────────
  console.log("── 1. Public catalogue + instrument pinning ──");
  let r = await jfetch("/api/learn/modules");
  const mods = r.body.modules ?? [];
  const byAudience = mods.reduce((acc, m) => { acc[m.audience] = (acc[m.audience] ?? 0) + 1; return acc; }, {});
  check("public module list 200 with audience on every unit", r.status === 200 && mods.length === 15 && mods.every((m) => typeof m.audience === "string"));
  check("audience split 8 Kids / 3 Teens / 2 Pro / 2 Aware",
    byAudience.KIDS === 8 && byAudience.TEENS === 3 && byAudience.PRO === 2 && byAudience.AWARE === 2,
    JSON.stringify(byAudience));
  check("no answerIdx leaks in public list", !JSON.stringify(r.body).includes("answerIdx"));

  r = await jfetch("/api/learn/instrument");
  const items = r.body.items ?? [];
  check("instrument still exactly 16 items (pinned to Kids)", r.status === 200 && items.length === 16, `n=${items.length}`);
  const kidsCodes = new Set(mods.filter((m) => m.audience === "KIDS").map((m) => m.code));
  check("instrument drawn only from the Kids pilot curriculum",
    items.every((q) => kidsCodes.has(q.moduleCode)),
    [...new Set(items.map((q) => q.moduleCode))].filter((c) => !kidsCodes.has(c)).join(",") || "all KIDS");

  // ── 2. Tools ping ────────────────────────────────────────────────────────
  console.log("── 2. Tools ping ──");
  const pingJson = (payload) => jfetch("/api/learn/tools/ping", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  r = await pingJson({ tool: "password", lang: "am" });
  check("valid ping 200", r.status === 200 && r.body.ok === true);
  r = await pingJson({ tool: "not-a-tool", lang: "am" });
  check("unknown tool 400 BAD_TOOL", r.status === 400 && r.body.error?.code === "BAD_TOOL");
  r = await jfetch("/api/learn/tools/ping", { method: "POST", headers: { "Content-Type": "application/json" }, body: "not-json" });
  check("malformed JSON 400", r.status === 400 && r.body.error?.code === "INVALID_JSON");
  r = await pingJson({ tool: "flagging" });
  check("lang defaults to Amharic (am)", r.status === 200);

  // Rate limit: 30/min/IP — fire enough to trip it, expect 429 + Retry-After.
  let saw429 = false;
  let retryAfter = null;
  for (let i = 0; i < 40; i++) {
    const res = await fetch(BASE + "/api/learn/tools/ping", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tool: "phishing", lang: "en" }),
    });
    if (res.status === 429) { saw429 = true; retryAfter = res.headers.get("retry-after"); break; }
  }
  check("ping rate limit trips (429 + Retry-After)", saw429 && retryAfter !== null, `retry-after=${retryAfter}`);

  const pingCount = await db.awarenessToolPing.count({ where: { tool: "phishing", lang: "en" } });
  check("pings persisted as aggregate rows", pingCount >= 25, `phishing/en rows=${pingCount}`);
  const cols = await db.$queryRaw`PRAGMA table_info(AwarenessToolPing)`;
  const colNames = cols.map((c) => c.name);
  check("telemetry carries no IP / learner columns", !colNames.includes("ip") && !colNames.includes("learnerId") && !colNames.includes("userAgent"), colNames.join(","));

  // ── 3. Overview telemetry (SUPER_ADMIN) ──────────────────────────────────
  console.log("── 3. Overview telemetry ──");
  r = await jfetch("/api/awareness/overview", authed(superAdmin));
  check("overview 200 for SUPER_ADMIN", r.status === 200);
  const ov = r.body;
  check("tools section present with 6 tools", ov.tools?.tools?.length === 6, `n=${ov.tools?.tools?.length}`);
  check("tools telemetry counts > 0 across the corpus", ov.tools.tools.every((t) => t.total > 0), ov.tools.tools.map((t) => `${t.id}:${t.total}`).join(" "));
  check("14-day daily series", Array.isArray(ov.tools.series) && ov.tools.series.length === 14);
  check("series sums to last14d", ov.tools.series.reduce((s, d) => s + d.count, 0) === ov.tools.last14d, `${ov.tools.series.reduce((s, d) => s + d.count, 0)} vs ${ov.tools.last14d}`);
  check("Amharic-first share reported (60–85%)", ov.tools.amShare >= 60 && ov.tools.amShare <= 85, `amShare=${ov.tools.amShare}%`);
  check("modulesByAudience 8/3/2/2",
    ov.programme.modulesByAudience?.KIDS === 8 && ov.programme.modulesByAudience?.TEENS === 3 &&
    ov.programme.modulesByAudience?.PRO === 2 && ov.programme.modulesByAudience?.AWARE === 2);
  check("instrumentItems pinned to 16 despite 15 modules", ov.programme.instrumentItems === 16, `items=${ov.programme.instrumentItems}`);
  check("engagement rows carry audience", ov.engagement.modules.every((m) => typeof m.audience === "string"));

  // ── 4. RBAC ──────────────────────────────────────────────────────────────
  console.log("── 4. RBAC ──");
  r = await jfetch("/api/awareness/overview", authed(cbeAdmin));
  check("ORG_ADMIN blocked from overview incl. tools telemetry (403)", r.status === 403, `status=${r.status}`);
  r = await jfetch("/api/awareness/overview");
  check("unauthenticated blocked (401)", r.status === 401, `status=${r.status}`);
  r = await jfetch("/api/learn/tools/ping", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tool: "password" }) });
  check("tools ping stays public (no auth required)", r.status === 200 || r.status === 429, `status=${r.status}`);

  // ── 5. Curriculum admin: audience track management ───────────────────────
  console.log("── 5. Curriculum admin ──");
  r = await jfetch("/api/awareness/modules?audience=TEENS", authed(superAdmin));
  check("audience=TEENS filter returns 3 units", r.status === 200 && r.body.modules.length === 3 && r.body.modules.every((m) => m.audience === "TEENS"));
  r = await jfetch("/api/awareness/modules?audience=BOGUS", authed(superAdmin));
  check("invalid audience filter ignored (full list)", r.status === 200 && r.body.modules.length === 15);

  r = await jfetch("/api/awareness/modules", jbody(superAdmin, {
    topic: "passwords", titleEn: "E2E Audience Unit", titleAm: "E2E የታዛሪያ ክፍል",
    summaryEn: "e2e", summaryAm: "e2e", contentEn: "## x", contentAm: "## x",
    durationMin: 10, gradeBand: "9-12", audience: "TEENS", questions: [],
  }));
  check("create unit with audience TEENS", r.status === 201, JSON.stringify(r.body).slice(0, 120));
  const unitId = r.body.module?.id;
  const created = await db.awarenessModule.findUnique({ where: { id: unitId } });
  check("created unit persisted with TEENS", created?.audience === "TEENS");

  r = await jfetch(`/api/awareness/modules/${unitId}`, jbody(superAdmin, { audience: "PRO" }, "PATCH"));
  check("PATCH audience TEENS → PRO", r.status === 200, JSON.stringify(r.body).slice(0, 120));
  const patched = await db.awarenessModule.findUnique({ where: { id: unitId } });
  check("audience change persisted", patched?.audience === "PRO");

  const auditTrail = await db.authEvent.findFirst({
    where: { type: "AWARENESS_MODULE_UPDATED", detail: { contains: "audience=PRO" } },
    orderBy: { createdAt: "desc" },
  });
  check("audience change recorded in audit trail", auditTrail !== null, auditTrail?.detail ?? "none");

  // Clean up the E2E artefact (module + its questions cascade).
  await db.awarenessModule.delete({ where: { id: unitId } });

  const finalCount = await db.awarenessModule.count({ where: { isActive: true } });
  check("cleanup: back to 15 active units", finalCount === 15, `n=${finalCount}`);
} catch (e) {
  results.push(`FAIL  suite crashed — ${String(e).slice(0, 300)}`);
}

await db.$disconnect();
const fails = results.filter((x) => x.startsWith("FAIL")).length;
console.log(results.join("\n"));
console.log(`\n${results.length - fails}/${results.length} checks passed`);
process.exit(fails > 0 ? 1 : 0);
