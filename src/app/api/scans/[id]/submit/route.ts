import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { evaluate, auditTimeComparison, pillarConfFromJson, type Answer } from "@/lib/engine";
import { slaDueDate } from "@/lib/sla";
import { requireAuthAny } from "@/lib/auth/guard";
import { can } from "@/lib/auth/rbac";
import { audit } from "@/lib/auth/audit";
import { clientIp } from "@/lib/auth/rate-limit";

// POST /api/scans/[id]/submit — run the compliance engine over collected answers
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireAuthAny(req, ["scans:run-org", "scans:run-any-org"]);
  if (guard.error) return guard.error;
  const { user } = guard;
  const { id } = await ctx.params;
  const body = await req.json();
  const answers: { ruleCode: string; answer: Answer; evidenceNote?: string }[] = body.answers ?? [];

  const scan = await db.scan.findUnique({
    where: { id },
    include: { results: { include: { rule: true } }, framework: true },
  });
  if (!scan) return NextResponse.json({ error: "Scan not found" }, { status: 404 });

  // Tenant isolation.
  const isSuper = can(user.role, "scans:run-any-org");
  if (!isSuper && scan.organizationId !== user.orgId) {
    return NextResponse.json({ error: "This assessment belongs to another organization" }, { status: 403 });
  }

  if (scan.status === "complete") {
    return NextResponse.json({ error: "Scan already completed" }, { status: 409 });
  }

  const answerMap = new Map(answers.map((a) => [a.ruleCode, a]));
  const engineRules = scan.results.map((r) => ({
    code: r.rule.code, article: r.rule.article, titleEn: r.rule.titleEn, titleAm: r.rule.titleAm,
    statementEn: r.rule.statementEn, statementAm: r.rule.statementAm,
    remediationEn: r.rule.remediationEn, remediationAm: r.rule.remediationAm,
    pillar: r.rule.pillar, severity: r.rule.severity, penaltyRef: r.rule.penaltyRef, weight: r.rule.weight,
  }));
  const engineAnswers = scan.results.map((r) => ({
    ruleCode: r.rule.code,
    answer: answerMap.get(r.rule.code)?.answer ?? "na",
  }));

  const out = evaluate(engineRules, engineAnswers, pillarConfFromJson(scan.framework?.pillars));

  const now = new Date();

  // Persist per-rule results
  for (const r of scan.results) {
    const res = out.results.find((x) => x.ruleCode === r.rule.code);
    const input = answerMap.get(r.rule.code);
    if (!res) continue;
    const isFinding = res.answer === "no" || res.answer === "partial";
    await db.scanResult.update({
      where: { id: r.id },
      data: {
        answer: res.answer,
        evidenceNote: input?.evidenceNote ?? r.evidenceNote,
        score: res.score,
        riskRank: res.riskRank,
        findingEn: res.findingEn,
        findingAm: res.findingAm,
        // Stamp the remediation deadline exactly once, when the finding is
        // born at scan completion: severity policy × now (Procl. 1426/2026 SLAs).
        ...(isFinding && r.status === "open" && !r.dueAt
          ? { dueAt: slaDueDate(r.rule.severity, now) }
          : {}),
      },
    });
  }

  const minutes = Math.max(0.5, (now.getTime() - scan.startedAt.getTime()) / 60000);
  const updated = await db.scan.update({
    where: { id },
    data: {
      status: "complete",
      completedAt: now,
      durationMinutes: Math.round(minutes * 10) / 10,
      overallScore: out.overallScore,
      pillarScores: JSON.stringify(out.pillarScores),
      findingsCount: out.findingsCount,
      criticalFindings: out.criticalFindings,
      auditorName: user.name, // who actually submitted the assessment
    },
  });

  await audit({
    type: "SCAN_COMPLETED",
    userId: user.id,
    email: user.email,
    organizationId: scan.organizationId,
    ip: clientIp(req.headers),
    userAgent: req.headers.get("user-agent"),
    detail: `Assessment "${scan.name}" completed — score ${out.overallScore}%, ${out.findingsCount} findings (${out.criticalFindings} critical), ${Math.round(minutes * 10) / 10} min.`,
  });

  return NextResponse.json({
    scan: updated,
    engine: out,
    time: auditTimeComparison(minutes),
  });
}
