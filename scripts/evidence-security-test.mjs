/**
 * Adwa Cyber — Evidence Vault cross-tenant security test.
 *
 * Logs in as three roles via the API (solving the SVG captcha by parsing
 * <text> nodes), then verifies tenant isolation, RBAC and super-admin scope.
 *
 * Usage: node scripts/evidence-security-test.mjs
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
  const answer = solveCaptcha(cap.svg);
  const res = await jfetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, captchaId: cap.captchaId, captchaAnswer: answer }),
  });
  if (res.status !== 200) throw new Error(`login failed for ${email}: ${JSON.stringify(res.body).slice(0, 200)}`);
  return {
    cookie: res.headers.getSetCookie().map((c) => c.split(";")[0]).join("; "),
    user: res.body.user,
  };
}

const authed = (session) => ({
  headers: { Cookie: session.cookie },
});

const results = [];
const check = (name, cond, extra = "") => {
  results.push(`${cond ? "PASS" : "FAIL"}  ${name}${extra ? " — " + extra : ""}`);
};

// ── Fixtures ─────────────────────────────────────────────────────────────────
const { PrismaClient } = await import("/home/z/my-project/node_modules/.prisma/client/index.js").catch(() => import("@prisma/client"));
const db = new PrismaClient();
const cbe = await db.organization.findFirst({ where: { name: { contains: "Commercial" } } });
const wasasa = await db.organization.findFirst({ where: { name: { contains: "Wasasa" } } });
const cbeDoc = await db.evidenceDocument.findFirst({ where: { organizationId: cbe.id, status: "ACTIVE" } });
const wasasaDoc = await db.evidenceDocument.findFirst({ where: { organizationId: wasasa.id, status: "ACTIVE" } });
await db.$disconnect();

// ── 1. Dashen AUDITOR: view-only, different tenant ──────────────────────────
const auditor = await login("auditor@dashen.com.et", "Adwa#Demo2026!");

// cross-tenant download must be blocked
let r = await jfetch(`/api/evidence/${cbeDoc.id}/download`, authed(auditor));
check("AUDITOR cross-tenant download blocked (403)", r.status === 403, JSON.stringify(r.body.error?.code));

// list must be scoped to Dashen (no CBE/Wasasa docs)
r = await jfetch("/api/evidence", authed(auditor));
const foreign = (r.body.documents ?? []).filter((d) => d.organizationId !== auditor.user.organizationId);
check("AUDITOR list scoped to own org", r.status === 200 && foreign.length === 0, `${r.body.documents?.length ?? 0} docs, 0 foreign`);

// upload must be denied (view-only role)
const form = new FormData();
form.append("file", new Blob(["test"], { type: "text/plain" }), "test.txt");
form.append("title", "Auditor should not upload");
form.append("category", "OTHER");
r = await jfetch("/api/evidence/upload", { method: "POST", headers: authed(auditor).headers, body: form });
check("AUDITOR upload denied (403)", r.status === 403, JSON.stringify(r.body.error?.code));

// ── 2. CBE ORG_ADMIN: own tenant ok, other tenant blocked ───────────────────
const cbeAdmin = await login("admin@cbe.com.et", "Adwa#Demo2026!");

r = await jfetch(`/api/evidence/${cbeDoc.id}/download`, authed(cbeAdmin));
check("ORG_ADMIN own-tenant download ok (200)", r.status === 200, `checksum-hdr ${r.headers.get("x-checksum-sha256")?.slice(0, 12)}`);

r = await jfetch(`/api/evidence/${wasasaDoc.id}/download`, authed(cbeAdmin));
check("ORG_ADMIN cross-tenant download blocked (403)", r.status === 403, JSON.stringify(r.body.error?.code));

// cross-tenant PATCH blocked
r = await jfetch(`/api/evidence/${wasasaDoc.id}`, {
  method: "PATCH",
  headers: { ...authed(cbeAdmin).headers, "Content-Type": "application/json" },
  body: JSON.stringify({ action: "archive" }),
});
check("ORG_ADMIN cross-tenant archive blocked (403)", r.status === 403, JSON.stringify(r.body.error?.code));

// ── 3. SUPER_ADMIN: global scope + org filter ───────────────────────────────
const superAdmin = await login("admin@adwacyber.et", "Adwa#Admin2026!");

r = await jfetch("/api/evidence", authed(superAdmin));
const orgs = new Set((r.body.documents ?? []).map((d) => d.organizationId));
check("SUPER_ADMIN sees all tenants", r.body.scope === "all" && orgs.size >= 2, `${r.body.documents?.length ?? 0} docs across ${orgs.size} orgs`);

r = await jfetch(`/api/evidence?org=${wasasa.id}`, authed(superAdmin));
const onlyWasasa = (r.body.documents ?? []).every((d) => d.organizationId === wasasa.id);
check("SUPER_ADMIN org filter works", r.status === 200 && onlyWasasa && r.body.documents.length > 0, `${r.body.documents?.length} Wasasa docs`);

r = await jfetch(`/api/evidence/${wasasaDoc.id}/download`, authed(superAdmin));
check("SUPER_ADMIN cross-tenant download ok (200)", r.status === 200);

// ── 4. Unauthenticated access ───────────────────────────────────────────────
r = await jfetch(`/api/evidence/${cbeDoc.id}/download`);
check("Unauthenticated download blocked (401)", r.status === 401, JSON.stringify(r.body.error?.code));

r = await jfetch("/api/evidence");
check("Unauthenticated list blocked (401)", r.status === 401);

// ── Report ──────────────────────────────────────────────────────────────────
console.log("\n═══ Evidence Vault security matrix ═══");
results.forEach((l) => console.log(l));
const fails = results.filter((l) => l.startsWith("FAIL")).length;
console.log(`\n${results.length - fails}/${results.length} passed`);
process.exit(fails ? 1 : 0);
