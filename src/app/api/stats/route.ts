import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const [orgs, rules, scans, results] = await Promise.all([
    db.organization.findMany({ include: { scans: { orderBy: { startedAt: "desc" } } } }),
    db.rule.findMany({ where: { isActive: true } }),
    db.scan.findMany({
      orderBy: { startedAt: "desc" },
      include: { organization: { select: { name: true, sector: true } } },
    }),
    db.scanResult.findMany({ where: { scan: { status: "complete" } }, include: { rule: true } }),
  ]);

  const completed = scans.filter((s) => s.status === "complete");
  const avgScore =
    completed.length > 0
      ? Math.round((completed.reduce((s, x) => s + (x.overallScore ?? 0), 0) / completed.length) * 10) / 10
      : 0;

  // Findings by severity (only from completed scans)
  const findings = results.filter((r) => r.answer === "no" || r.answer === "partial");
  const bySeverity = { critical: 0, high: 0, medium: 0 };
  for (const f of findings) bySeverity[f.rule.severity as keyof typeof bySeverity]++;

  // Status mix
  const byStatus = { open: 0, in_progress: 0, remediated: 0, waived: 0 };
  for (const f of findings) byStatus[f.status as keyof typeof byStatus]++;

  // Rule coverage: unique rules with at least one finding across completed scans (risk heatmap)
  const articleMap = new Map<string, { total: number; flagged: Set<string> }>();
  for (const r of rules) {
    articleMap.set(r.article, { total: 0, flagged: new Set() });
    articleMap.get(r.article)!.total++;
  }
  for (const f of findings) {
    articleMap.get(f.rule.article)?.flagged.add(f.rule.id);
  }
  const coverage = [...articleMap.entries()].map(([article, v]) => ({
    article,
    total: v.total,
    flagged: v.flagged.size,
    rate: Math.round((v.flagged.size / v.total) * 100),
  }));

  const avgDuration =
    completed.length > 0
      ? Math.round((completed.reduce((s, x) => s + (x.durationMinutes ?? 0), 0) / completed.length) * 10) / 10
      : 0;

  return NextResponse.json({
    organizations: orgs.length,
    sectors: [...new Set(orgs.map((o) => o.sector))],
    rules: rules.length,
    articles: new Set(rules.map((r) => r.article)).size,
    scansTotal: scans.length,
    scansCompleted: completed.length,
    avgScore,
    avgDurationMinutes: avgDuration,
    bySeverity,
    byStatus,
    coverage,
    recentScans: completed.slice(0, 5).map((s) => ({
      id: s.id, name: s.name, score: s.overallScore, org: s.organization.name,
      completedAt: s.completedAt, findings: s.findingsCount, critical: s.criticalFindings,
    })),
  });
}
