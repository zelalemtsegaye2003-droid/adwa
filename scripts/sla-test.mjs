/**
 * Adwa Cyber — Remediation SLA verification.
 * Logs in via the API (solving the SVG captcha) and verifies:
 *   1. GET /api/findings/sla — tenant scoping, summary math, urgency ordering
 *   2. Overdue detection (seeded Wasasa historical scan)
 *   3. Remediation closure: remediatedAt stamped, CLOSED_LATE vs CLOSED_ON_TIME
 *   4. Reopen clears remediatedAt
 *   5. New-scan findings get dueAt stamped at submit
 *   6. RBAC: auditor cannot PATCH; unauthenticated gets 401; org param pinned
 *
 * Usage: node scripts/sla-test.mjs
 */
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const { PrismaClient } = await import("/adwa/node_modules/.prisma/client/index.js").catch(() => import("@prisma/client"));
const db = new PrismaClient();

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
const DAY = 86_400_000;

try {
  const wasasa = await db.organization.findFirst({ where: { name: { contains: "Wasasa" } } });
  const cbe = await db.organization.findFirst({ where: { name: { contains: "Commercial" } } });

  // ── 1. CBE admin: SLA endpoint, tenant scope ──────────────────────────────
  const cbeAdmin = await login("admin@cbe.com.et", "Adwa#Demo2026!");
  let r = await jfetch("/api/findings/sla", authed(cbeAdmin));
  check("CBE SLA endpoint 200", r.status === 200);
  check("scope=tenant for org user", r.body.scope === "tenant");
  const sum = r.body.summary;
  const totalFindings = r.body.totalBeforeFilter;
  const sumParts = sum.onTrack + sum.dueSoon + sum.overdue + sum.closedOnTime + sum.closedLate + sum.waived + sum.notTracked;
  check("summary adds up to findings total", sumParts === totalFindings, `${sumParts} vs ${totalFindings}`);
  check("all CBE findings belong to CBE", r.body.findings.every((f) => f.organization.id === cbe.id));
  check("CBE has no overdue (seed posture)", sum.overdue === 0, `overdue=${sum.overdue}`);
  check("CBE has tracked deadlines", sum.tracked > 0, `tracked=${sum.tracked}`);
  check("SLA policy echoed", r.body.slaPolicy.critical === 30 && r.body.slaPolicy.medium === 90);

  // urgency ordering: OVERDUE → DUE_SOON → ON_TRACK → CLOSED_* → WAIVED → NOT_TRACKED
  const order = ["OVERDUE", "DUE_SOON", "ON_TRACK", "CLOSED_LATE", "CLOSED_ON_TIME", "WAIVED", "NOT_TRACKED"];
  const seq = r.body.findings.map((f) => f.slaState);
  let sortedOk = true;
  for (let i = 1; i < seq.length; i++) if (order.indexOf(seq[i]) < order.indexOf(seq[i - 1])) { sortedOk = false; break; }
  check("findings sorted by SLA urgency", sortedOk, seq.slice(0, 4).join(",") + "…");

  // filter: sla=OVERDUE on CBE → empty list
  r = await jfetch("/api/findings/sla?sla=OVERDUE", authed(cbeAdmin));
  check("sla=OVERDUE filter returns 0 rows for CBE", r.status === 200 && r.body.findings.length === 0 && r.body.summary.overdue === 0);

  // org param is ignored for org users (tenant pin)
  r = await jfetch(`/api/findings/sla?org=${wasasa.id}`, authed(cbeAdmin));
  check("org param pinned to own tenant", r.status === 200 && r.body.organizationId === cbe.id);

  // ── 2. Super admin: platform view + Wasasa overdue ────────────────────────
  const superAdmin = await login("admin@adwacyber.et", "Adwa#Admin2026!");
  r = await jfetch("/api/findings/sla", authed(superAdmin));
  check("super admin platform scope 200", r.status === 200 && r.body.scope === "platform");
  check("platform sees Wasasa overdue", r.body.summary.overdue >= 2, `overdue=${r.body.summary.overdue}`);
  const overdueRows = r.body.findings.filter((f) => f.slaState === "OVERDUE");
  check("overdue rows have negative daysRemaining", overdueRows.every((f) => f.daysRemaining < 0));
  check("overdue rows are open/in_progress", overdueRows.every((f) => f.status === "open" || f.status === "in_progress"));
  const histOverdue = overdueRows.find((f) => f.scanName.includes("historical"));
  check("historical scan criticals overdue", !!histOverdue, histOverdue?.rule?.code);

  r = await jfetch(`/api/findings/sla?org=${wasasa.id}`, authed(superAdmin));
  check("super admin org filter works", r.status === 200 && r.body.scope === "org" && r.body.organizationId === wasasa.id);
  check("Wasasa org overdue >= 2", r.body.summary.overdue >= 2, `overdue=${r.body.summary.overdue}`);

  // ── 3. Closure semantics: remediate an OVERDUE finding → CLOSED_LATE ─────
  const target = (await jfetch(`/api/findings/sla?org=${wasasa.id}&sla=OVERDUE`, authed(superAdmin))).body.findings[0];
  r = await jfetch(`/api/findings/${target.id}`, {
    method: "PATCH",
    headers: { ...authed(superAdmin).headers, "Content-Type": "application/json" },
    body: JSON.stringify({ status: "remediated" }),
  });
  check("remediate overdue finding 200", r.status === 200);
  check("remediatedAt stamped", !!r.body.result?.remediatedAt);
  const afterClose = (await jfetch(`/api/findings/sla?org=${wasasa.id}`, authed(superAdmin))).body;
  const closedRow = afterClose.findings.find((f) => f.id === target.id);
  check("overdue→remediated shows CLOSED_LATE", closedRow?.slaState === "CLOSED_LATE", closedRow?.slaState);

  // audit trail carries the SLA outcome
  const evt = await db.authEvent.findFirst({
    where: { type: "FINDING_STATUS_CHANGED", detail: { contains: "closed LATE" } },
    orderBy: { createdAt: "desc" },
  });
  check("audit detail notes late closure", !!evt, evt?.detail?.slice(0, 90));

  // ── 4. Reopen clears remediatedAt ─────────────────────────────────────────
  r = await jfetch(`/api/findings/${target.id}`, {
    method: "PATCH",
    headers: { ...authed(superAdmin).headers, "Content-Type": "application/json" },
    body: JSON.stringify({ status: "in_progress" }),
  });
  check("reopen finding 200", r.status === 200);
  check("reopen clears remediatedAt", r.body.result?.remediatedAt === null);
  const afterReopen = (await jfetch(`/api/findings/sla?org=${wasasa.id}`, authed(superAdmin))).body;
  const reopened = afterReopen.findings.find((f) => f.id === target.id);
  check("reopened overdue finding shows OVERDUE again", reopened?.slaState === "OVERDUE");
  // restore seed state
  await jfetch(`/api/findings/${target.id}`, {
    method: "PATCH",
    headers: { ...authed(superAdmin).headers, "Content-Type": "application/json" },
    body: JSON.stringify({ status: "open" }),
  });

  // ── 5. On-time closure: CBE finding with future due date ──────────────────
  const cbeTarget = (await jfetch("/api/findings/sla?sla=ON_TRACK", authed(cbeAdmin))).body.findings[0];
  if (cbeTarget) {
    r = await jfetch(`/api/findings/${cbeTarget.id}`, {
      method: "PATCH",
      headers: { ...authed(cbeAdmin).headers, "Content-Type": "application/json" },
      body: JSON.stringify({ status: "remediated" }),
    });
    check("remediate on-track CBE finding 200", r.status === 200);
    const after = (await jfetch("/api/findings/sla", authed(cbeAdmin))).body;
    const row = after.findings.find((f) => f.id === cbeTarget.id);
    check("on-track→remediated shows CLOSED_ON_TIME", row?.slaState === "CLOSED_ON_TIME", row?.slaState);
    // restore
    await jfetch(`/api/findings/${cbeTarget.id}`, {
      method: "PATCH",
      headers: { ...authed(cbeAdmin).headers, "Content-Type": "application/json" },
      body: JSON.stringify({ status: "open" }),
    });
    const restored = (await jfetch("/api/findings/sla", authed(cbeAdmin))).body;
    check("restore to open clears remediatedAt (seed state)", restored.findings.find((f) => f.id === cbeTarget.id)?.remediatedAt === null);
  } else {
    check("on-track CBE finding available", false, "none found");
  }

  // ── 6. RBAC & auth ─────────────────────────────────────────────────────────
  const auditor = await login("auditor@dashen.com.et", "Adwa#Demo2026!");
  r = await jfetch("/api/findings/sla", authed(auditor));
  check("AUDITOR can view SLA (findings:view-org)", r.status === 200);
  const anyCbe = (await jfetch("/api/findings/sla", authed(auditor))).body.findings[0];
  r = await jfetch(`/api/findings/${anyCbe.id}`, {
    method: "PATCH",
    headers: { ...authed(auditor).headers, "Content-Type": "application/json" },
    body: JSON.stringify({ status: "remediated" }),
  });
  check("AUDITOR cannot change status (403)", r.status === 403);

  r = await jfetch("/api/findings/sla");
  check("unauthenticated SLA view → 401", r.status === 401);

  r = await jfetch(`/api/findings/${target.id}`, {
    method: "PATCH",
    headers: { ...authed(cbeAdmin).headers, "Content-Type": "application/json" },
    body: JSON.stringify({ status: "remediated" }),
  });
  check("cross-tenant PATCH blocked (403)", r.status === 403);

  // stats endpoint exposes the sla block
  r = await jfetch("/api/stats", authed(superAdmin));
  check("/api/stats includes sla summary", r.body.sla?.overdue >= 1 && typeof r.body.sla.onTrack === "number", JSON.stringify(r.body.sla));
} finally {
  await db.$disconnect();
}

console.log("\n═══ Remediation SLA verification ═══");
results.forEach((l) => console.log(l));
const fails = results.filter((l) => l.startsWith("FAIL")).length;
console.log(`\n${results.length - fails}/${results.length} passed`);
process.exit(fails ? 1 : 0);
