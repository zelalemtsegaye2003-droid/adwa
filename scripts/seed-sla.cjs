/**
 * Adwa Cyber — Remediation SLA backfill & demo seed.
 *
 * 1. Backfill: stamp dueAt on every existing finding (scan completion +
 *    severity policy: critical 30d / high 60d / medium 90d) and remediatedAt
 *    on already-remediated findings (realistic short closure, on time).
 * 2. Demo: create one historical scan for Wasasa MFI (Q3 baseline, completed
 *    45 days ago) whose critical/high findings are now genuinely OVERDUE, so
 *    the SLA dashboard has overdue rows to show. Deleted first if re-run.
 *
 * Idempotent — safe to run repeatedly.
 * Usage: node scripts/seed-sla.cjs
 */
const { PrismaClient } = require("@prisma/client");
const db = new PrismaClient();

const SLA_DAYS = { critical: 30, high: 60, medium: 90 };
const DAY = 86_400_000;
const slaDue = (severity, from) => new Date(from.getTime() + (SLA_DAYS[severity] ?? 90) * DAY);

async function main() {
  console.log("── SLA backfill ──");

  const findings = await db.scanResult.findMany({
    where: { OR: [{ answer: "no" }, { answer: "partial" }] },
    include: { rule: { select: { severity: true } }, scan: { select: { completedAt: true } } },
  });

  let stampedDue = 0, stampedClosed = 0;
  for (const f of findings) {
    if (!f.scan.completedAt) continue;
    const patch = {};
    if (!f.dueAt) {
      patch.dueAt = slaDue(f.rule.severity, f.scan.completedAt);
      stampedDue++;
    }
    // Already-remediated findings: give a realistic closure time (well within
    // the deadline) so they show as CLOSED_ON_TIME rather than untracked.
    if (f.status === "remediated" && !f.remediatedAt) {
      const due = patch.dueAt ?? f.dueAt;
      const base = f.scan.completedAt.getTime();
      patch.remediatedAt = due
        ? new Date(Math.min(base + 5 * DAY, due.getTime())) // 5 days after completion, never past due
        : new Date(base + 5 * DAY);
      stampedClosed++;
    }
    if (Object.keys(patch).length) await db.scanResult.update({ where: { id: f.id }, data: patch });
  }
  console.log(`  + dueAt stamped on ${stampedDue} finding(s); remediatedAt on ${stampedClosed}`);

  console.log("── Demo: Wasasa Q3 historical scan with overdue findings ──");
  const wasasa = await db.organization.findFirst({ where: { name: { contains: "Wasasa" } } });
  if (!wasasa) { console.log("  ? Wasasa MFI not found — skipping demo scan"); return; }

  const HIST_NAME = "Q3 2026 baseline assessment (historical)";
  await db.scan.deleteMany({ where: { organizationId: wasasa.id, name: HIST_NAME } });

  const pd = await db.framework.findUnique({ where: { code: "PD-1321" } });
  const rules = await db.rule.findMany({
    where: { isActive: true, frameworkId: pd.id },
    orderBy: { sortOrder: "asc" },
    take: 6,
  });
  const officer = await db.user.findFirst({ where: { organizationId: wasasa.id, role: "ORG_ADMIN" } })
    ?? await db.user.findFirst({ where: { role: "SUPER_ADMIN" } });

  const completedAt = new Date(Date.now() - 45 * DAY); // 45 days ago
  const startedAt = new Date(completedAt.getTime() - 2 * 24 * 60 * 60 * 1000);

  // 6 rules: 2 no (critical, high → both overdue), 2 partial (medium → overdue
  // at 45d? medium=90d so on track), 2 yes. Realistic mixed posture.
  const answers = ["no", "no", "partial", "partial", "yes", "yes"];
  const score = (a) => (a === "yes" ? 100 : a === "partial" ? 50 : 0);
  const risk = (a, w) => (a === "yes" ? 0 : Math.round(w * (a === "partial" ? 0.6 : 1) * 10) / 10);

  await db.scan.create({
    data: {
      organizationId: wasasa.id,
      frameworkId: pd.id,
      name: HIST_NAME,
      mode: "full",
      status: "complete",
      auditorName: "Adwa Compliance Engine",
      overallScore: 50,
      pillarScores: "{}",
      findingsCount: 4,
      criticalFindings: rules.filter((r, i) => answers[i] === "no" && r.severity === "critical").length,
      startedAt,
      completedAt,
      durationMinutes: 41.5,
      results: {
        create: rules.map((r, i) => {
          const a = answers[i];
          const isFinding = a === "no" || a === "partial";
          return {
            ruleId: r.id,
            answer: a,
            score: score(a),
            riskRank: isFinding ? risk(a, r.weight) : 0,
            findingEn: isFinding ? `${r.titleEn}: gaps identified in the Q3 baseline.` : null,
            findingAm: isFinding ? `${r.titleAm}፦ በQ3 መነሻ ግምገማ ላይ ጉድለቶች ተለይተዋል።` : null,
            status: "open",
            // Due dates counted from the historical completion → genuinely overdue
            dueAt: isFinding ? slaDue(r.severity, completedAt) : null,
          };
        }),
      },
    },
  });

  const overdue = rules.filter((r, i) => {
    const a = answers[i];
    return (a === "no" || a === "partial") && slaDue(r.severity, completedAt).getTime() < Date.now();
  });
  console.log(`  + "${HIST_NAME}" created (${completedAt.toISOString().slice(0, 10)}), ${overdue.length} finding(s) now overdue:`);
  overdue.forEach((r) => console.log(`      ${r.code} (${r.severity}) — due ${slaDue(r.severity, completedAt).toISOString().slice(0, 10)}`));

  const total = await db.scanResult.count({ where: { dueAt: { not: null } } });
  console.log(`\nDone. ${total} tracked deadline(s) in total.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
