import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuthAny } from "@/lib/auth/guard";
import { can } from "@/lib/auth/rbac";

const VALID_ANSWERS = new Set(["yes", "partial", "no", "na"]);

/**
 * POST /api/scans/[id]/answers — save draft answers for an in-progress
 * assessment. Lets a compliance officer fill the 47-obligation questionnaire
 * across sessions: answers + evidence notes are persisted incrementally and
 * reloaded on resume. Scores stay 0 until the engine runs (submit).
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
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  const answers = Array.isArray(body.answers) ? body.answers : null;
  if (!answers) {
    return NextResponse.json({ error: "answers array is required." }, { status: 400 });
  }

  const scan = await db.scan.findUnique({
    where: { id },
    include: { results: { select: { id: true, answer: true, evidenceNote: true, rule: { select: { code: true } } } } },
  });
  if (!scan) return NextResponse.json({ error: "Scan not found" }, { status: 404 });

  // Tenant isolation.
  const isSuper = can(user.role, "scans:run-any-org");
  if (!isSuper && scan.organizationId !== user.orgId) {
    return NextResponse.json({ error: "This assessment belongs to another organization" }, { status: 403 });
  }

  // Drafts can only be saved while the assessment is running.
  if (scan.status !== "in_progress") {
    return NextResponse.json(
      { error: "This assessment is complete — answers can no longer be changed." },
      { status: 409 }
    );
  }

  // Validate against the scan's own rule set.
  const byCode = new Map(scan.results.map((r) => [r.rule.code, r]));
  const updates: { id: string; answer: string; evidenceNote?: string }[] = [];
  for (const a of answers) {
    const code = (a.ruleCode ?? "").trim();
    if (!code) continue;
    const result = byCode.get(code);
    if (!result) {
      return NextResponse.json(
        { error: `Rule "${code}" is not part of this assessment.` },
        { status: 400 }
      );
    }
    if (!a.answer || !VALID_ANSWERS.has(a.answer)) {
      return NextResponse.json(
        { error: `Invalid answer for ${code}: must be yes, partial, no or na.` },
        { status: 400 }
      );
    }
    updates.push({
      id: result.id,
      answer: a.answer,
      evidenceNote: a.evidenceNote?.slice(0, 2000),
    });
  }

  for (const u of updates) {
    await db.scanResult.update({
      where: { id: u.id },
      data: { answer: u.answer, evidenceNote: u.evidenceNote },
    });
  }

  const answeredCount = await db.scanResult.count({
    where: { scanId: id, answer: { not: "na" } },
  });

  return NextResponse.json({ saved: updates.length, answeredCount });
}
