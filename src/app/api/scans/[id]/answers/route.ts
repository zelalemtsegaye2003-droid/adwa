import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuthAny } from "@/lib/auth/guard";
import { can } from "@/lib/auth/rbac";
import { apiError, invalidJson } from "@/lib/api-error";

const VALID_ANSWERS = new Set(["yes", "partial", "no", "na"]);
const NOTE_MAX = 2000;

/**
 * POST /api/scans/[id]/answers — save draft answers for an in-progress
 * assessment. Lets a compliance officer fill the 47-obligation questionnaire
 * across sessions: answers + evidence notes are persisted incrementally and
 * reloaded on resume. Scores stay 0 until the engine runs (submit).
 *
 * Drafts MAY be partial (submit is the gate that demands completeness), but
 * every saved answer is EXPLICIT: `answeredAt` is stamped so an intentional
 * N/A is distinguishable from an untouched placeholder (answer "na").
 *
 * Body: { answers: [{ ruleCode, answer, evidenceNote? }] }
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireAuthAny(req, ["scans:run-org", "scans:run-any-org"]);
  if (guard.error) return guard.error;
  const { user } = guard;
  const { id } = await ctx.params;

  let body: { answers?: { ruleCode?: string; answer?: string; evidenceNote?: string }[] };
  try {
    body = await req.json();
  } catch {
    return invalidJson();
  }
  const answers = Array.isArray(body.answers) ? body.answers : null;
  if (!answers) {
    return apiError(400, "VALIDATION", "An `answers` array is required.");
  }

  const scan = await db.scan.findUnique({
    where: { id },
    include: { results: { select: { id: true, answer: true, evidenceNote: true, rule: { select: { code: true } } } } },
  });
  if (!scan) return apiError(404, "NOT_FOUND", "Scan not found.");

  // Tenant isolation.
  const isSuper = can(user.role, "scans:run-any-org");
  if (!isSuper && scan.organizationId !== user.orgId) {
    return apiError(403, "CROSS_TENANT", "This assessment belongs to another organization.");
  }

  // Drafts can only be saved while the assessment is running.
  if (scan.status !== "in_progress") {
    return apiError(409, "CONFLICT", "This assessment is complete — answers can no longer be changed.");
  }

  // Validate against the scan's own rule set. Drafts may be partial and a
  // repeated ruleCode simply overwrites (last wins) — submit is the strict gate.
  const byCode = new Map(scan.results.map((r) => [r.rule.code, r]));
  const updates = new Map<string, { id: string; answer: string; evidenceNote?: string }>();
  for (const a of answers) {
    const code = (a.ruleCode ?? "").trim();
    if (!code) continue;
    const result = byCode.get(code);
    if (!result) {
      return apiError(400, "UNKNOWN_RULE", `Rule "${code}" is not part of this assessment.`, undefined, {
        ruleCode: code,
      });
    }
    if (!a.answer || !VALID_ANSWERS.has(a.answer)) {
      return apiError(400, "INVALID_ANSWER", `Invalid answer for ${code}: must be yes, partial, no or na.`, undefined, {
        ruleCode: code,
      });
    }
    if (typeof a.evidenceNote === "string" && a.evidenceNote.length > NOTE_MAX) {
      return apiError(400, "VALIDATION", `Evidence note for ${code} is too long (max ${NOTE_MAX} characters).`);
    }
    updates.set(result.id, {
      id: result.id,
      answer: a.answer,
      evidenceNote: a.evidenceNote?.slice(0, NOTE_MAX),
    });
  }

  const stamp = new Date();
  for (const u of updates.values()) {
    await db.scanResult.update({
      where: { id: u.id },
      data: { answer: u.answer, evidenceNote: u.evidenceNote, answeredAt: stamp },
    });
  }

  // Answered = explicitly answered (answeredAt), never `answer != "na"`:
  // an intentional N/A is an answer; an untouched placeholder is not.
  const answeredCount = await db.scanResult.count({
    where: { scanId: id, answeredAt: { not: null } },
  });

  return NextResponse.json({ saved: updates.size, answeredCount });
}
