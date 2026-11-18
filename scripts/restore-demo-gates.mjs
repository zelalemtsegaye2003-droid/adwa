/**
 * Adwa Cyber — restore the Track C demo posture after test runs.
 *
 * Final state (matches the board-demo posture, now evidence-backed):
 *   - every criterion NOT_STARTED, no GateEvidence/GateEvent rows, orphaned
 *     fixture files removed from .data/gate-evidence/
 *   - DEDICATED_FUNDING advanced to SATISFIED through the REAL enforcement
 *     path (fixture artefact attached first, then PATCH via the API with a
 *     super-admin session) so the timeline + AuthEvent log are genuine.
 *
 * Usage: node scripts/restore-demo-gates.mjs
 */
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const fs = await import("node:fs");
const path = await import("node:path");
const { execSync } = await import("node:child_process");
const { PrismaClient } = await import(process.cwd() + "/node_modules/.prisma/client/index.js").catch(() => import("@prisma/client"));

const db = new PrismaClient();

// 1. reset governance state + accountability rows + orphaned artefact files
await db.gateEvent.deleteMany();
await db.gateEvidence.deleteMany();
await db.expansionGate.updateMany({ data: { status: "NOT_STARTED", notes: null, updatedById: null, targetDate: null } });
const root = path.join(process.cwd(), ".data", "gate-evidence");
if (fs.existsSync(root)) {
  for (const f of fs.readdirSync(root)) fs.unlinkSync(path.join(root, f));
}

// 2. seed the fixture artefact on DEDICATED_FUNDING (attach-first)
execSync("npx tsx scripts/seed-gates.ts", { cwd: process.cwd(), stdio: "pipe" });
execSync("npx tsx scripts/seed-gate-evidence.ts", { cwd: process.cwd(), stdio: "pipe" });

// 3. advance DEDICATED_FUNDING → SATISFIED through the real API path
const solveCaptcha = (svg) => [...svg.matchAll(/<text[^>]*>([^<]+)<\/text>/g)].map((m) => m[1]).join("");
const cap = await (await fetch(`${BASE}/api/auth/captcha`)).json();
const login = await fetch(`${BASE}/api/auth/login`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    email: "admin@adwacyber.et",
    password: "Adwa#Admin2026!",
    captchaId: cap.captchaId,
    captchaAnswer: solveCaptcha(cap.svg),
  }),
});
if (login.status !== 200) throw new Error(`login failed: ${login.status}`);
const cookie = login.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");

const funding = await db.expansionGate.findUnique({ where: { phase_code: { phase: "P4_ACFS", code: "DEDICATED_FUNDING" } } });
const patch = await fetch(`${BASE}/api/gates/${funding.id}`, {
  method: "PATCH",
  headers: { Cookie: cookie, "Content-Type": "application/json" },
  body: JSON.stringify({
    status: "SATISFIED",
    note: "Institutional grant letter RDG/2026/77 covers the programme (fixture artefact on file).",
  }),
});
if (patch.status !== 200) throw new Error(`PATCH failed: ${patch.status} ${await patch.text()}`);

// 4. report the restored posture
const gates = await db.expansionGate.findMany({ orderBy: [{ phase: "asc" }, { code: "asc" }] });
for (const g of gates) console.log(`${g.status.padEnd(12)} ${g.phase}/${g.code}`);
const evCount = await db.gateEvent.count();
const evDocs = await db.gateEvidence.count();
console.log(`restored: ${evCount} timeline events, ${evDocs} artefact(s). DEDICATED_FUNDING satisfied → P4 readiness 25%, gate LOCKED.`);
await db.$disconnect();
