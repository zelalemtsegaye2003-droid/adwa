import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth/guard";
import { can } from "@/lib/auth/rbac";
import { slaInfo, summarizeSla } from "@/lib/sla";

/**
 * GET /api/stats — platform or tenant analytics.
 * SUPER_ADMIN: platform-wide. Tenant users: scoped to their organization.
 */
export async function GET(req: NextRequest) {
  const guard = await requireAuth(req);
  if (guard.error) return guard.error;
  const { user } = guard;

  const isSuper = can(user.role, "orgs:view-all");
  const orgFilter = isSuper ? {} : { id: user.orgId ?? "__none__" };
  const scanFilter = isSuper ? {} : { organizationId: user.orgId ?? "__none__" };
  const resultScanFilter = isSuper
    ? { scan: { status: "complete" as const } }
    : { scan: { status: "complete" as const, organizationId: user.orgId ?? "__none__" } };

  const [orgs, rules, scans, results, frameworks] = await Promise.all([
    db.organization.findMany({ where: orgFilter, include: { scans: { orderBy: { startedAt: "desc" } } } }),
    db.rule.findMany({ where: { isActive: true } }),
    db.scan.findMany({
      where: scanFilter,
      orderBy: { startedAt: "desc" },
      include: {
        organization: { select: { name: true, sector: true } },
        results: { select: { answer: true } },
      },
    }),
    db.scanResult.findMany({ where: resultScanFilter, include: { rule: true } }),
    db.framework.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }),
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

  // Remediation SLA (Procl. 1426/2026 corrective-action timelines)
  const sla = summarizeSla(
    findings.map((f) => slaInfo({ status: f.status, dueAt: f.dueAt, remediatedAt: f.remediatedAt }))
  );

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

  // Per-framework posture (rule counts + completed scans + average score)
  const frameworkSummaries = frameworks.map((f) => {
    const fwCompleted = completed.filter((s) => s.frameworkId === f.id);
    const fwAvg =
      fwCompleted.length > 0
        ? Math.round((fwCompleted.reduce((s, x) => s + (x.overallScore ?? 0), 0) / fwCompleted.length) * 10) / 10
        : null;
    return {
      id: f.id,
      code: f.code,
      name: f.name,
      nameAm: f.nameAm,
      issuer: f.issuer,
      instrument: f.instrument,
      instrumentNo: f.instrumentNo,
      ruleCount: rules.filter((r) => r.frameworkId === f.id).length,
      scansCompleted: fwCompleted.length,
      avgScore: fwAvg,
    };
  });

  return NextResponse.json({
    scope: isSuper ? "platform" : "tenant",
    organizations: orgs.length,
    sectors: [...new Set(orgs.map((o) => o.sector))],
    rules: rules.length,
    articles: new Set(rules.map((r) => r.article)).size,
    frameworks: frameworkSummaries,
    scansTotal: scans.length,
    scansCompleted: completed.length,
    avgScore,
    avgDurationMinutes: avgDuration,
    bySeverity,
    byStatus,
    sla,
    coverage,
    inProgress: scans
      .filter((s) => s.status === "in_progress")
      .slice(0, 5)
      .map((s) => ({
        id: s.id, name: s.name, org: s.organization.name, organizationId: s.organizationId,
        startedAt: s.startedAt,
        answered: s.results.filter((r) => r.answer !== "na").length,
        total: s.results.length,
        frameworkCode: frameworks.find((f) => f.id === s.frameworkId)?.code ?? null,
      })),
    recentScans: completed.slice(0, 5).map((s) => ({
      id: s.id, name: s.name, score: s.overallScore, org: s.organization.name,
      completedAt: s.completedAt, findings: s.findingsCount, critical: s.criticalFindings,
      frameworkCode: frameworks.find((f) => f.id === s.frameworkId)?.code ?? null,
    })),
  });
}
