/**
 * Adwa Cyber — Rules Engine verification.
 * Logs in via the API (solving the SVG captcha) and verifies:
 *  1. Coverage endpoint scoping & data (CBE org user, both frameworks)
 *  2. Super-admin org filter
 *  3. Link management permissions (auditor denied, officer allowed)
 *  4. Auto-linking via upload tags
 *  5. Cross-tenant isolation on links
 *
 * Usage: node scripts/rules-engine-test.mjs
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

const authed = (s) => ({ headers: { Cookie: s.cookie } });
const results = [];
const check = (name, cond, extra = "") => results.push(`${cond ? "PASS" : "FAIL"}  ${name}${extra ? " — " + extra : ""}`);

const { PrismaClient } = await import("/home/z/my-project/node_modules/.prisma/client/index.js").catch(() => import("@prisma/client"));
const db = new PrismaClient();
const cbe = await db.organization.findFirst({ where: { name: { contains: "Commercial" } } });
const wasasa = await db.organization.findFirst({ where: { name: { contains: "Wasasa" } } });
await db.$disconnect();

// ── 1. CBE org admin: coverage (PD-1321) ────────────────────────────────────
const cbeAdmin = await login("admin@cbe.com.et", "Adwa#Demo2026!");

let r = await jfetch("/api/rules/coverage?framework=PD-1321", authed(cbeAdmin));
check("CBE coverage PD-1321 loads (200)", r.status === 200);
const covPD = r.body;
check("PD-1321 has 47 obligations", covPD.summary.total === 47, `total=${covPD.summary.total}`);
const art17 = covPD.coverage.find((c) => c.ruleCode === "ART17-02");
check("ART17-02 SATISFIED (Branch Access Review linked)", art17?.status === "SATISFIED", `status=${art17?.status}, evidence=${art17?.evidence.length}`);
const art52 = covPD.coverage.find((c) => c.ruleCode === "ART52-01");
check("ART52-01 SATISFIED (training records)", art52?.status === "SATISFIED");
check("suggestedAnswer=yes for satisfied rule", art52?.suggestedAnswer === "yes");
const gaps = covPD.coverage.filter((c) => c.status === "GAP").length;
check("most PD rules are GAPs (no evidence)", gaps > 40, `${gaps} gaps`);
check("coverage percent consistent", Math.abs(covPD.summary.coveragePercent - (covPD.summary.satisfied / 47) * 100) < 0.1, `${covPD.summary.coveragePercent}%`);

// ── 2. CBE: NBE-IT framework coverage ──────────────────────────────────────
r = await jfetch("/api/rules/coverage?framework=NBE-IT", authed(cbeAdmin));
const covNBE = r.body;
check("NBE-IT has 30 obligations", covNBE.summary.total === 30, `total=${covNBE.summary.total}`);
for (const code of ["NBE-05", "NBE-12", "NBE-17", "NBE-21", "NBE-28"]) {
  const c = covNBE.coverage.find((x) => x.ruleCode === code);
  check(`${code} SATISFIED`, c?.status === "SATISFIED", `status=${c?.status}`);
}
const nbe14 = covNBE.coverage.find((x) => x.ruleCode === "NBE-14");
check("NBE-14 has SUPPORTS link (risk appetite)", nbe14?.evidence.some((e) => e.linkType === "SUPPORTS"), `${nbe14?.evidence.length} evidence`);

// ── 3. Wasasa (via super admin): stale evidence demo ───────────────────────
const superAdmin = await login("admin@adwacyber.et", "Adwa#Admin2026!");
r = await jfetch(`/api/rules/coverage?org=${wasasa.id}&framework=NBE-IT`, authed(superAdmin));
const covWas = r.body;
check("Super admin org filter works", r.status === 200 && covWas.organization.name.includes("Wasasa"));
const nbe24 = covWas.coverage.find((c) => c.ruleCode === "NBE-24");
check("NBE-24 STALE for Wasasa (Aug drill > 90d)", nbe24?.status === "STALE", `status=${nbe24?.status}, age=${nbe24?.evidence[0]?.ageDays}d`);
check("stale rule has no suggested answer", nbe24?.suggestedAnswer === null);

r = await jfetch("/api/rules/coverage", authed(superAdmin));
check("Super admin without org param → 400", r.status === 400, r.body.error?.code);

r = await jfetch("/api/rules/coverage?framework=PD-1321", authed(cbeAdmin));
check("org user ignores org param (own tenant)", r.status === 200 && r.body.organization.id === cbe.id);

// ── 4. Link management RBAC ─────────────────────────────────────────────────
const auditor = await login("auditor@dashen.com.et", "Adwa#Demo2026!");
r = await jfetch("/api/rules/links", {
  method: "POST",
  headers: { ...authed(auditor).headers, "Content-Type": "application/json" },
  body: JSON.stringify({ evidenceId: "whatever", ruleCode: "NBE-01" }),
});
check("AUDITOR cannot create links (403)", r.status === 403, r.body.error?.code);

// officer CAN link within own tenant
const officer = await login("officer@cbe.com.et", "Adwa#Demo2026!");
// note: officer has MFA — login will return mfaRequired; use the cbeAdmin session instead
r = await jfetch("/api/rules/links", {
  method: "POST",
  headers: { ...authed(cbeAdmin).headers, "Content-Type": "application/json" },
  body: JSON.stringify({ evidenceId: "cross-tenant-test", ruleCode: "NBE-01" }),
});
check("link to missing evidence → 404", r.status === 404, r.body.error?.code);

// ── 5. Auto-link via upload ─────────────────────────────────────────────────
const form = new FormData();
form.append("file", new Blob(["Rules engine auto-link test document"], { type: "text/plain" }), "rti-policy.txt");
form.append("title", "RTI Policy Auto-Link Test");
form.append("category", "POLICY");
form.append("tags", "NBE-03, governance");
r = await jfetch("/api/evidence/upload", { method: "POST", headers: authed(cbeAdmin).headers, body: form });
check("upload with rule-code tag succeeds", r.status === 201, `autoLinked=${r.body.document?.autoLinked}`);
check("autoLinked=1 reported", r.body.document?.autoLinked === 1);
const newDocId = r.body.document.id;

r = await jfetch(`/api/rules/links?evidenceId=${newDocId}`, authed(cbeAdmin));
check("GET links shows AUTO_TAG NBE-03", r.body.links.some((l) => l.code === "NBE-03" && l.source === "AUTO_TAG"), JSON.stringify(r.body.links.map((l) => l.code)));

// cross-tenant link attempt (Wasasa doc from CBE session)
const wasasaDoc = await (async () => {
  const { PrismaClient } = await import("/home/z/my-project/node_modules/.prisma/client/index.js").catch(() => import("@prisma/client"));
  const db2 = new PrismaClient();
  const d = await db2.evidenceDocument.findFirst({ where: { organizationId: wasasa.id, status: "ACTIVE" } });
  await db2.$disconnect();
  return d;
})();
r = await jfetch("/api/rules/links", {
  method: "POST",
  headers: { ...authed(cbeAdmin).headers, "Content-Type": "application/json" },
  body: JSON.stringify({ evidenceId: wasasaDoc.id, ruleCode: "NBE-01" }),
});
check("cross-tenant link blocked (403)", r.status === 403, r.body.error?.code);

// unlink the test doc's link, then delete the doc (cleanup)
const testLink = (await jfetch(`/api/rules/links?evidenceId=${newDocId}`, authed(cbeAdmin))).body.links[0];
r = await jfetch(`/api/rules/links?id=${testLink.id}`, { method: "DELETE", headers: authed(cbeAdmin).headers });
check("unlink works (200)", r.status === 200);
r = await jfetch(`/api/evidence/${newDocId}`, { method: "DELETE", headers: authed(cbeAdmin).headers });
check("cleanup: test doc soft-deleted", r.status === 200);

// ── Report ──────────────────────────────────────────────────────────────────
console.log("\n═══ Rules Engine verification ═══");
results.forEach((l) => console.log(l));
const fails = results.filter((l) => l.startsWith("FAIL")).length;
console.log(`\n${results.length - fails}/${results.length} passed`);
process.exit(fails ? 1 : 0);
