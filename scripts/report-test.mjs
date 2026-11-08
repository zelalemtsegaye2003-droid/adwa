/**
 * Adwa Cyber — Report PDF export verification.
 * Logs in via the API (solving the SVG captcha) and verifies:
 *   1. GET /api/scans/[id]/report → 200, application/pdf, %PDF magic, pages
 *   2. Amharic variant (lang=am) renders Ethiopic strings in the PDF text
 *   3. Content-Disposition filename pattern
 *   4. Content hash header matches a fresh export (deterministic payload hash)
 *   5. RBAC: cross-tenant 403, unauthenticated 401, in-progress scan 409,
 *      missing scan 404
 *   6. Audit trail: REPORT_EXPORTED recorded with hash
 *   7. PDF text contains score, SLA states, footer hash (spot checks)
 *
 * Usage: node scripts/report-test.mjs
 */
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const { PrismaClient } = await import("/adwa/node_modules/.prisma/client/index.js").catch(() => import("@prisma/client"));
const db = new PrismaClient();

async function jfetch(url, opts = {}) {
  const r = await fetch(BASE + url, opts);
  const ct = r.headers.get("content-type") ?? "";
  let body = null;
  if (ct.includes("application/json")) body = await r.json();
  else if (ct.includes("application/pdf")) body = await r.arrayBuffer();
  else body = { raw: (await r.text()).slice(0, 120) };
  return { status: r.status, body, headers: r.headers, ct };
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

// pdftotext helper (poppler-utils)
import { execSync } from "child_process";
import { writeFileSync } from "fs";
function pdfText(buf, name) {
  writeFileSync(`/tmp/${name}`, Buffer.from(buf));
  return execSync(`pdftotext /tmp/${name} -`).toString();
}

try {
  const cbe = await db.organization.findFirst({ where: { name: { contains: "Commercial" } } });
  const wasasa = await db.organization.findFirst({ where: { name: { contains: "Wasasa" } } });
  const cbeScan = await db.scan.findFirst({
    where: { status: "complete", organizationId: cbe.id },
    orderBy: { completedAt: "desc" },
  });
  

  // ── 1. Basic export (EN) ───────────────────────────────────────────────────
  const cbeAdmin = await login("admin@cbe.com.et", "Adwa#Demo2026!");
  let r = await jfetch(`/api/scans/${cbeScan.id}/report`, authed(cbeAdmin));
  check("export EN returns 200", r.status === 200);
  check("content-type application/pdf", r.ct.includes("application/pdf"));
  const bytes = new Uint8Array(r.body);
  check("%PDF magic bytes", bytes[0] === 0x25 && String.fromCharCode(...bytes.slice(0, 4)) === "%PDF", `${bytes.length} bytes`);
  const pages = r.headers.get("x-report-pages");
  check("page count header present", /^\d+$/.test(pages ?? ""), `pages=${pages}`);
  const hash1 = r.headers.get("x-report-hash") ?? "";
  check("content hash header (16 hex)", /^[0-9a-f]{16}$/.test(hash1), hash1);
  const cd = r.headers.get("content-disposition") ?? "";
  check("filename pattern", /attachment; filename="Adwa_Report_.*\.pdf"/.test(cd), cd.slice(0, 70));

  const textEn = pdfText(r.body, "report-e2e-en.pdf");
  check("EN: org name in PDF", textEn.includes("Commercial Bank of Ethiopia"));
  check("EN: score present", textEn.includes(String(Math.round(cbeScan.overallScore * 10) / 10)) || textEn.includes(String(cbeScan.overallScore)), cbeScan.overallScore.toString());
  check("EN: SLA states present", /On track|Due soon|Overdue|Closed/.test(textEn));
  check("EN: footer hash in PDF", textEn.includes(hash1));
  check("EN: page numbers", /Page 1\/\d+/.test(textEn));

  // ── 2. Amharic variant ─────────────────────────────────────────────────────
  r = await jfetch(`/api/scans/${cbeScan.id}/report?lang=am`, authed(cbeAdmin));
  check("export AM returns 200", r.status === 200);
  const textAm = pdfText(r.body, "report-e2e-am.pdf");
  check("AM: Ethiopic title rendered", textAm.includes("የቅጥ ሪፖርት") || textAm.includes("የሥራ አመራር"), textAm.slice(0, 40).replace(/\n/g, " "));
  check("AM: SLA label in Amharic", textAm.includes("በጊዜው ላይ") || textAm.includes("ዘግያል") || textAm.includes("በወቅቱ"));
  check("AM: hash matches EN (payload-based)", r.headers.get("x-report-hash") === hash1);

  // ── 3. Deterministic hash across exports ──────────────────────────────────
  r = await jfetch(`/api/scans/${cbeScan.id}/report`, authed(cbeAdmin));
  check("re-export hash identical", r.headers.get("x-report-hash") === hash1);

  // ── 4. RBAC ────────────────────────────────────────────────────────────────
  r = await jfetch(`/api/scans/${cbeScan.id}/report`);
  check("unauthenticated → 401", r.status === 401);

  const auditor = await login("auditor@dashen.com.et", "Adwa#Demo2026!");
  r = await jfetch(`/api/scans/${cbeScan.id}/report`, authed(auditor));
  check("cross-tenant (Dashen auditor on CBE scan) → 403", r.status === 403);

  // viewer within tenant CAN export (view permission suffices)
  const auditorUser = await db.user.findUnique({ where: { email: "auditor@dashen.com.et" } });
  const dashenScan = await db.scan.findFirst({
    where: { status: "complete", organizationId: auditorUser.organizationId },
    orderBy: { completedAt: "desc" },
  });
  if (dashenScan) {
    const r2 = await jfetch(`/api/scans/${dashenScan.id}/report`, authed(auditor));
    check("viewer within own tenant can export (200)", r2.status === 200, `scan=${dashenScan.name.slice(0, 30)}`);
  } else {
    check("viewer within own tenant can export (200)", false, "no completed Dashen scan");
  }

  // in-progress scan → 409 (create a throwaway draft so the path is exercised)
  const draftScan = await db.scan.create({
    data: {
      organizationId: cbe.id,
      name: "E2E draft (report 409 probe)",
      mode: "full",
      status: "in_progress",
    },
  });
  r = await jfetch(`/api/scans/${draftScan.id}/report`, authed(cbeAdmin));
  check("in-progress scan → 409", r.status === 409, `status=${r.status}`);
  await db.scan.delete({ where: { id: draftScan.id } });
  r = await jfetch(`/api/scans/nonexistent/report`, authed(cbeAdmin));
  check("missing scan → 404", r.status === 404);

  // ── 5. Audit trail ─────────────────────────────────────────────────────────
  const evt = await db.authEvent.findFirst({
    where: { type: "REPORT_EXPORTED", organizationId: cbe.id },
    orderBy: { createdAt: "desc" },
  });
  check("REPORT_EXPORTED audit event recorded", !!evt);
  check("audit detail includes hash & language", !!evt && evt.detail.includes(hash1) && /EN|AM/.test(evt.detail), evt.detail?.slice(0, 90));

  // ── 6. Wasasa overdue scan export (super admin, org param) ────────────────
  const superAdmin = await login("admin@adwacyber.et", "Adwa#Admin2026!");
  const histScan = await db.scan.findFirst({ where: { name: { contains: "historical" } } });
  if (histScan) {
    r = await jfetch(`/api/scans/${histScan.id}/report`, authed(superAdmin));
    check("super admin exports Wasasa historical scan", r.status === 200);
    const t = pdfText(r.body, "report-e2e-wasasa.pdf");
    check("Wasasa PDF shows OVERDUE row", t.includes("OVERDUE"), t.match(/OVERDUE \d+d over/)?.[0]);
  } else {
    check("historical scan exists", false, "not found");
  }
} finally {
  await db.$disconnect();
}

console.log("\n═══ Report PDF export verification ═══");
results.forEach((l) => console.log(l));
const fails = results.filter((l) => l.startsWith("FAIL")).length;
console.log(`\n${results.length - fails}/${results.length} passed`);
process.exit(fails ? 1 : 0);
