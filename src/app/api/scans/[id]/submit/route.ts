import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { evaluate, auditTimeComparison, pillarConfFromJson, type Answer } from "@/lib/engine";
import { slaDueDate } from "@/lib/sla";
import { requireAuthAny } from "@/lib/auth/guard";
import { can } from "@/lib/auth/rbac";
import { audit } from "@/lib/auth/audit";
import { clientIp } from "@/lib/auth/rate-limit";
import { apiError, invalidJson } from "@/lib/api-error";

const VALID_ANSWERS = new Set(["yes", "partial", "no", "na"]);
const NOTE_MAX = 2000;
const NA_NOTE_MIN = 5; // D1: an N/A is a legal claim — it must carry a justification

interface SubmitAnswer {
  ruleCode: string;
  answer: Answer;
  evidenceNote?: string;
}

/**
 * POST /api/scans/[id]/submit — run the compliance engine over collected
 * answers.
 *
 * Scoring integrity contract (MVP hardening WS-2):
 *  - the body must be JSON with an `answers` ARRAY
 *  - every entry must reference a rule of THIS scan (UNKNOWN_RULE) with a
 *    valid answer (INVALID_ANSWER); duplicates are rejected (DUPLICATE_RULE)
 *  - an `na` answer requires an evidence note of ≥5 chars — an unjustified
 *    N/A is unauditable in a compliance product (decision D1)
 *  - submission requires 100% explicit answers: unanswered obligations are
 *    returned as INCOMPLETE with the missing codes — they can never silently
 *    score as "na" and inflate the result
 *  - all writes run in one transaction so a mid-loop failure cannot leave a
 *    half-evaluated scan
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireAuthAny(req, ["scans:run-org", "scans:run-any-org"]);
  if (guard.error) return guard.error;
  const { user } = guard;
  const { id } = await ctx.params;

  // ── Parse + shape-check the body ─────────────────────────────────────────
  let body: { answers?: unknown };
  try {
    body = await req.json();
  } catch {
    return invalidJson();
  }
  if (!Array.isArray(body.answers)) {
    return apiError(400, "VALIDATION", "An `answers` array is required.");
  }
  const answers = body.answers as SubmitAnswer[];

  const scan = await db.scan.findUnique({
    where: { id },
    include: { results: { include: { rule: true } }, framework: true },
  });
  if (!scan) return apiError(404, "NOT_FOUND", "Scan not found");

  // Tenant isolation.
  const isSuper = can(user.role, "scans:run-any-org");
  if (!isSuper && scan.organizationId !== user.orgId) {
    return apiError(403, "CROSS_TENANT", "This assessment belongs to another organization.");
  }

  if (scan.status === "complete") {
    return apiError(409, "CONFLICT", "Scan already completed.");
  }

  // ── Validate every entry against the scan's own rule set ─────────────────
  const scanCodes = new Set(scan.results.map((r) => r.rule.code));
  const answerMap = new Map<string, SubmitAnswer>();
  const duplicates: string[] = [];
  for (const a of answers) {
    if (!a || typeof a !== "object") {
      return apiError(400, "VALIDATION", "Each answer must be an object with ruleCode and answer.");
    }
    const code = typeof a.ruleCode === "string" ? a.ruleCode.trim() : "";
    if (!code) {
      return apiError(400, "VALIDATION", "Each answer must carry a ruleCode.");
    }
    if (!scanCodes.has(code)) {
      return apiError(400, "UNKNOWN_RULE", `Rule "${code}" is not part of this assessment.`, undefined, { ruleCode: code });
    }
    if (answerMap.has(code)) duplicates.push(code);
    if (typeof a.evidenceNote === "string" && a.evidenceNote.length > NOTE_MAX) {
      return apiError(400, "VALIDATION", `Evidence note for ${code} is too long (max ${NOTE_MAX} characters).`);
    }
    answerMap.set(code, {
      ruleCode: code,
      answer: a.answer,
      evidenceNote: typeof a.evidenceNote === "string" ? a.evidenceNote : undefined,
    });
  }
  if (duplicates.length) {
    return apiError(
      400,
      "DUPLICATE_RULE",
      `Duplicate answer(s) for: ${[...new Set(duplicates)].join(", ")}.`,
      undefined,
      { duplicates: [...new Set(duplicates)] }
    );
  }
  for (const [code, a] of answerMap) {
    if (!VALID_ANSWERS.has(a.answer)) {
      return apiError(
        400,
        "INVALID_ANSWER",
        `Invalid answer for ${code}: must be yes, partial, no or na.`,
        undefined,
        { ruleCode: code }
      );
    }
  }
  // D1 — an N/A is a legal claim: justify it or the scan cannot be submitted.
  const unjustifiedNa = [...answerMap.entries()]
    .filter(([, a]) => a.answer === "na" && (a.evidenceNote ?? "").trim().length < NA_NOTE_MIN)
    .map(([code]) => code);
  if (unjustifiedNa.length) {
    return apiError(
      400,
      "NA_JUSTIFICATION_REQUIRED",
      `Justification required for not-applicable answers (min ${NA_NOTE_MIN} characters): ${unjustifiedNa.join(", ")}.`,
      undefined,
      { rules: unjustifiedNa }
    );
  }

  // ── Completeness: every obligation of the scan must be answered ──────────
  const missing = scan.results.map((r) => r.rule.code).filter((code) => !answerMap.has(code));
  if (missing.length) {
    return apiError(
      400,
      "INCOMPLETE",
      `Answer all obligations before submitting — ${missing.length} remaining.`,
      undefined,
      { missing }
    );
  }

  // ── Evaluate + persist atomically ────────────────────────────────────────
  const engineRules = scan.results.map((r) => ({
    code: r.rule.code, article: r.rule.article, titleEn: r.rule.titleEn, titleAm: r.rule.titleAm,
    statementEn: r.rule.statementEn, statementAm: r.rule.statementAm,
    remediationEn: r.rule.remediationEn, remediationAm: r.rule.remediationAm,
    pillar: r.rule.pillar, severity: r.rule.severity, penaltyRef: r.rule.penaltyRef, weight: r.rule.weight,
  }));
  const engineAnswers = scan.results.map((r) => ({
    ruleCode: r.rule.code,
    answer: answerMap.get(r.rule.code)!.answer,
  }));

  const out = evaluate(engineRules, engineAnswers, pillarConfFromJson(scan.framework?.pillars));
  const now = new Date();
  const minutes = Math.max(0.5, (now.getTime() - scan.startedAt.getTime()) / 60000);

  const updated = await db.$transaction(async (tx) => {
    // Persist per-rule results (explicit answers only — none default to "na").
    for (const r of scan.results) {
      const res = out.results.find((x) => x.ruleCode === r.rule.code);
      const input = answerMap.get(r.rule.code)!;
      if (!res) continue;
      const isFinding = res.answer === "no" || res.answer === "partial";
      await tx.scanResult.update({
        where: { id: r.id },
        data: {
          answer: res.answer,
          evidenceNote: input.evidenceNote?.slice(0, NOTE_MAX) ?? r.evidenceNote,
          answeredAt: now,
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

    return tx.scan.update({
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
