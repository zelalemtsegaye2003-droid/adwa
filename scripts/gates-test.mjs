/**
 * Adwa Cyber — Track C Gate Board verification (proposal Phases 4–5 governance).
 * Verifies:
 *   1. GET /api/gates — 8 criteria across P4_ACFS + P5_CII, readiness math
 *      (0% → locked), platform posture (deploymentAllowed=false), evidence[]
 *      + eventCount exposed per criterion
 *   2. RBAC: commercial tenants (ORG_ADMIN) get 403 on read, update, evidence
 *      upload and timeline; unauthenticated 401
 *   3. Status lifecycle: forward-only transitions, invalid skips 409,
 *      SATISFIED requires note (400) AND ≥1 evidence artefact (409
 *      EVIDENCE_REQUIRED), BLOCKED from any state
 *   4. Evidence: upload validates type allow-list (400), SHA-256 seals the
 *      bytes, download re-verifies checksum (X-Checksum-Sha256 + byte match),
 *      attachment lands in the timeline + AuthEvent log
 *   5. Timeline: GET /api/gates/[id]/events returns STATUS_CHANGE and
 *      EVIDENCE_ATTACHED entries with actors
 *   6. Readiness progression: all four P4 criteria satisfied with evidence →
 *      100% + GATE OPEN + deploymentAllowed=true
 *   7. Dossier: GET /api/gates/dossier → PDF (magic bytes), posture reflected
 *   8. Re-seeding does not reset recorded governance state
 * Usage: node scripts/gates-test.mjs
 */
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const { execSync } = await import("node:child_process");
const { createHash } = await import("node:crypto");

async function jfetch(url, opts = {}) {
  const r = await fetch(BASE + url, opts);
  let body = null;
  const ct = r.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) body = await r.json();
  else body = { raw: (await r.text()).slice(0, 120) };
  return { status: r.status, body, headers: r.headers };
}
async function rawfetch(url, opts = {}) {
  const r = await fetch(BASE + url, opts);
  return { status: r.status, buf: Buffer.from(await r.arrayBuffer()), headers: r.headers };
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
  // reset all criteria to NOT_STARTED so readiness math is deterministic;
  // clear the accountability tables so counts are deterministic too
  const { PrismaClient } = await import("/home/z/my-project/node_modules/.prisma/client/index.js").catch(() => import("@prisma/client"));
  const db = new PrismaClient();
  await db.gateEvent.deleteMany();
  await db.gateEvidence.deleteMany();
  await db.expansionGate.updateMany({ data: { status: "NOT_STARTED", notes: null, updatedById: null, targetDate: null } });
  await db.$disconnect();
}

const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");

try {
  console.log("═══ Track C Gate Board verification (accountability layer) ═══");
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
  check("criteria expose evidence[] + eventCount", p4.criteria.every((c) => Array.isArray(c.evidence) && typeof c.eventCount === "number"));

  // ── 2. RBAC (read, update, evidence, timeline, dossier) ────────────────────
  const anyId = p4.criteria[0].id;
  r = await jfetch("/api/gates", { headers: H(cbeAdmin) });
  check("ORG_ADMIN read → 403 (platform-level governance)", r.status === 403, JSON.stringify(r.body.error?.code ?? ""));
  r = await jfetch(`/api/gates/${anyId}`, { method: "PATCH", headers: HJ(cbeAdmin), body: JSON.stringify({ status: "SATISFIED", note: "tenant attempt" }) });
  check("ORG_ADMIN update → 403", r.status === 403);
  const tenantFd = new FormData();
  tenantFd.append("file", new File([new Blob(["nope"])], "x.txt", { type: "text/plain" }));
  r = await jfetch(`/api/gates/${anyId}/evidence`, { method: "POST", headers: { ...H(cbeAdmin) }, body: tenantFd });
  check("ORG_ADMIN evidence upload → 403", r.status === 403);
  r = await jfetch(`/api/gates/${anyId}/events`, { headers: H(cbeAdmin) });
  check("ORG_ADMIN timeline → 403", r.status === 403);
  r = await rawfetch("/api/gates/dossier", { headers: H(cbeAdmin) });
  check("ORG_ADMIN dossier → 403", r.status === 403);
  r = await jfetch("/api/gates");
  check("unauthenticated → 401", r.status === 401);

  // ── 3. Lifecycle validation ────────────────────────────────────────────────
  const ema = p4.criteria.find((c) => c.code === "EMA_PARTNERSHIP");
  r = await jfetch(`/api/gates/${ema.id}`, { method: "PATCH", headers: HJ(superAdmin), body: JSON.stringify({ status: "SATISFIED" }) });
  check("SATISFIED without note → 400", r.status === 400, JSON.stringify(r.body.error?.code));
  r = await jfetch(`/api/gates/${ema.id}`, { method: "PATCH", headers: HJ(superAdmin), body: JSON.stringify({ status: "SATISFIED", note: "Signed EMA partnership letter, ref EMA/2026/114" }) });
  check("SATISFIED with note but no artefact → 409 EVIDENCE_REQUIRED", r.status === 409, JSON.stringify(r.body.error?.code));
  r = await jfetch(`/api/gates/${ema.id}`, { method: "PATCH", headers: HJ(superAdmin), body: JSON.stringify({ status: "WEIRD" }) });
  check("invalid status → 400", r.status === 400);

  // ── 4. Evidence: upload validation, sealing, download verification ─────────
  const badFd = new FormData();
  badFd.append("file", new File([new Blob([Buffer.from("MZfake")])], "letter.exe", { type: "application/octet-stream" }));
  r = await jfetch(`/api/gates/${ema.id}/evidence`, { method: "POST", headers: H(superAdmin), body: badFd });
  check("upload of .exe → 400 (allow-list)", r.status === 400, JSON.stringify(r.body.error?.code));

  const letterBytes = Buffer.from("EMA PARTNERSHIP LETTER (test artefact)\nRef EMA/2026/114 — signed partnership between Adwa Cyber and the Ethiopian Media Authority.\n", "utf8");
  const letterFd = new FormData();
  letterFd.append("file", new File([letterBytes], "ema-partnership-letter.txt", { type: "text/plain" }));
  letterFd.append("description", "Signed EMA partnership letter, ref EMA/2026/114");
  r = await jfetch(`/api/gates/${ema.id}/evidence`, { method: "POST", headers: H(superAdmin), body: letterFd });
  check("evidence upload → 201", r.status === 201, JSON.stringify(r.body.error ?? "ok"));
  const emaDoc = r.body.evidence;
  check("upload seals SHA-256 of exact bytes", emaDoc?.checksum === sha256(letterBytes), `${emaDoc?.checksum?.slice(0, 12)}…`);

  r = await rawfetch(`/api/gates/${ema.id}/evidence/${emaDoc.id}`, { headers: H(superAdmin) });
  check("evidence download → 200", r.status === 200);
  check("downloaded bytes match sealed checksum", sha256(r.buf) === emaDoc.checksum);
  check("X-Checksum-Sha256 header present", r.headers.get("x-checksum-sha256") === emaDoc.checksum);
  r = await jfetch(`/api/gates/${ema.id}/evidence/doesnotexist`, { headers: H(superAdmin) });
  check("download of unknown artefact → 404", r.status === 404);

  // now the gate can be satisfied
  r = await jfetch(`/api/gates/${ema.id}`, { method: "PATCH", headers: HJ(superAdmin), body: JSON.stringify({ status: "SATISFIED", note: "Signed EMA partnership letter, ref EMA/2026/114" }) });
  check("SATISFIED with note + artefact → 200", r.status === 200);
  r = await jfetch(`/api/gates/${ema.id}`, { method: "PATCH", headers: HJ(superAdmin), body: JSON.stringify({ status: "IN_PROGRESS" }) });
  check("SATISFIED → IN_PROGRESS rejected 409 (terminal)", r.status === 409, JSON.stringify(r.body.error?.code));
  r = await jfetch(`/api/gates/${ema.id}`, { method: "PATCH", headers: HJ(superAdmin), body: JSON.stringify({ status: "BLOCKED", note: "EMA negotiations suspended pending board decision" }) });
  check("SATISFIED → BLOCKED allowed (any state)", r.status === 200);
  r = await jfetch(`/api/gates/${ema.id}`, { method: "PATCH", headers: HJ(superAdmin), body: JSON.stringify({ status: "IN_PROGRESS", note: "Talks resumed with new EMA leadership" }) });
  check("BLOCKED → IN_PROGRESS (cleared)", r.status === 200);

  // ── 5. Timeline ────────────────────────────────────────────────────────────
  r = await jfetch(`/api/gates/${ema.id}/events`, { headers: H(superAdmin) });
  check("GET timeline → 200", r.status === 200);
  const kinds = new Set(r.body.events.map((e) => e.kind));
  check("timeline has EVIDENCE_ATTACHED + STATUS_CHANGE", kinds.has("EVIDENCE_ATTACHED") && kinds.has("STATUS_CHANGE"), [...kinds].join(","));
  check("timeline entries name the actor", r.body.events.every((e) => e.actor === null || e.actor.name));

  // ── 6. Readiness progression (evidence-backed) ─────────────────────────────
  r = await jfetch("/api/gates", { headers: H(superAdmin) });
  let cur = r.body.phases.find((p) => p.phase === "P4_ACFS");
  check("1 in_progress → 25% not yet (only SATISFIED counts)", cur.readiness.readinessPct === 0);

  const notes = {
    EMA_PARTNERSHIP: "Signed EMA partnership letter, ref EMA/2026/114",
    EHRC_DUE_DILIGENCE: "Published HRDD report with EHRC engagement, Nov 2026",
    TRANSPARENCY_FRAMEWORK: "Appeal tiers + judicial oversight + quarterly audit + 90-day retention adopted by board",
    DEDICATED_FUNDING: "Institutional grant letter RDG/2026/77 covers the programme",
  };
  for (const c of cur.criteria) {
    // attach an artefact to every criterion first (satisfaction requires it)
    const fd = new FormData();
    fd.append("file", new File([Buffer.from(`${c.code} governance artefact (test)`)], `${c.code.toLowerCase()}.txt`, { type: "text/plain" }));
    fd.append("description", notes[c.code] ?? "Evidence on file");
    const up = await jfetch(`/api/gates/${c.id}/evidence`, { method: "POST", headers: H(superAdmin), body: fd });
    check(`${c.code} artefact attached`, up.status === 201);
    const pr = await jfetch(`/api/gates/${c.id}`, { method: "PATCH", headers: HJ(superAdmin), body: JSON.stringify({ status: "SATISFIED", note: notes[c.code] ?? "Evidence on file" }) });
    check(`${c.code} → SATISFIED (evidence-backed)`, pr.status === 200);
  }
  r = await jfetch("/api/gates", { headers: H(superAdmin) });
  cur = r.body.phases.find((p) => p.phase === "P4_ACFS");
  check("P4 4/4 satisfied → 100% + GATE OPEN", cur.readiness.readinessPct === 100 && cur.readiness.open === true);
  check("P5 still locked (0%)", r.body.phases.find((p) => p.phase === "P5_CII").readiness.open === false);
  check("Track C deploymentAllowed=true once P4 opens", r.body.trackC.deploymentAllowed === true);
  check("updatedBy recorded on each criterion", cur.criteria.every((c) => c.updatedBy?.name));
  check("every satisfied criterion carries ≥1 artefact", cur.criteria.every((c) => c.evidence.length >= 1));

  // ── 7. Dossier PDF ─────────────────────────────────────────────────────────
  r = await rawfetch("/api/gates/dossier", { headers: H(superAdmin) });
  check("GET /api/gates/dossier → 200 PDF", r.status === 200 && r.headers.get("content-type") === "application/pdf");
  check("PDF magic bytes", r.buf.subarray(0, 5).toString("latin1") === "%PDF-", r.buf.subarray(0, 5).toString("latin1"));
  check("dossier has content (multi-page governance record)", r.buf.length > 20_000, `${r.buf.length} bytes`);
  const pages = (r.buf.toString("latin1").match(/\/Type[\s]*\/Page[^s]/g) ?? []).length;
  check("dossier spans ≥2 pages (posture + criteria + evidence register)", pages >= 2, `${pages} pages`);
  r = await rawfetch("/api/gates/dossier?lang=am", { headers: H(superAdmin) });
  check("Amharic dossier renders (Ethiopic font embedded)", r.status === 200 && r.buf.length > 20_000);

  // ── 8. Audit trail (platform AuthEvent log) ────────────────────────────────
  const { PrismaClient } = await import("/home/z/my-project/node_modules/.prisma/client/index.js").catch(() => import("@prisma/client"));
  const db = new PrismaClient();
  const events = await db.authEvent.findMany({
    where: { type: { in: ["GATE_STATUS_CHANGED", "GATE_EVIDENCE_ATTACHED", "GATE_DOSSIER_EXPORTED"] }, createdAt: { gte: new Date(Date.now() - 10 * 60_000) } },
    orderBy: { createdAt: "desc" },
  });
  check("GATE_* audit events recorded", events.length >= 10, `n=${events.length}`);
  check("gate audit names criterion + transition", /P4_ACFS\/EMA_PARTNERSHIP: (NOT_STARTED|IN_PROGRESS|BLOCKED) → (SATISFIED|BLOCKED|IN_PROGRESS)/.test(events.find((e) => e.detail.includes("EMA_PARTNERSHIP"))?.detail ?? ""));
  check("evidence attachment audit-logged with checksum prefix", /sha256 [0-9a-f]{12}…/.test(events.find((e) => e.type === "GATE_EVIDENCE_ATTACHED")?.detail ?? ""));
  check("gate audit is platform-level (organizationId=null)", events.every((e) => e.organizationId === null));
  const gateEvents = await db.gateEvent.count();
  check("per-criterion timeline entries written (≥2 per touched criterion)", gateEvents >= 12, `n=${gateEvents}`);

  // ── 9. Re-seed preserves governance state ──────────────────────────────────
  execSync("npx tsx scripts/seed-gates.ts", { cwd: "/home/z/my-project", stdio: "pipe" });
  r = await jfetch("/api/gates", { headers: H(superAdmin) });
  const after = r.body.phases.find((p) => p.phase === "P4_ACFS");
  check("re-seed does NOT reset satisfied criteria", after.criteria.every((c) => c.status === "SATISFIED"));
  check("re-seed preserves evidence register", after.criteria.every((c) => c.evidence.length >= 1));
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
