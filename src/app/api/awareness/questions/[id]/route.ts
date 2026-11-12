import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, parseBody } from "@/lib/auth/guard";
import { audit } from "@/lib/auth/audit";

export const runtime = "nodejs";

/** PATCH /api/awareness/questions/[id] — edit or retire (isActive=false) a bank item. */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireAuth(req, "awareness:manage");
  if (guard.error) return guard.error;
  const { user } = guard;
  const { id } = await ctx.params;

  const q = await db.awarenessQuestion.findUnique({ where: { id }, include: { module: true } });
  if (!q) return NextResponse.json({ error: "Question not found" }, { status: 404 });

  const parsed = await parseBody(req, (raw) => {
    const b = raw as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    const str = (v: unknown) => typeof v === "string" && v.trim().length > 0;
    if (str(b.promptEn)) out.promptEn = String(b.promptEn).trim();
    if (str(b.promptAm)) out.promptAm = String(b.promptAm).trim();
    if (Array.isArray(b.optionsEn) && b.optionsEn.length === 4 && (b.optionsEn as unknown[]).every(str)) out.optionsEn = JSON.stringify(b.optionsEn);
    if (Array.isArray(b.optionsAm) && b.optionsAm.length === 4 && (b.optionsAm as unknown[]).every(str)) out.optionsAm = JSON.stringify(b.optionsAm);
    if (Number.isInteger(b.answerIdx) && (b.answerIdx as number) >= 0 && (b.answerIdx as number) <= 3) out.answerIdx = b.answerIdx;
    if (str(b.explainEn)) out.explainEn = String(b.explainEn).trim();
    if (str(b.explainAm)) out.explainAm = String(b.explainAm).trim();
    if (typeof b.isActive === "boolean") out.isActive = b.isActive;
    return Object.keys(out).length > 0 ? out : null;
  });
  if ("error" in parsed) return parsed.error;

  const updated = await db.awarenessQuestion.update({ where: { id }, data: parsed.data });

  await audit({
    type: "AWARENESS_QUESTION_UPDATED",
    userId: user.id,
    email: user.email,
    organizationId: null,
    detail: `Question ${updated.sortOrder} of ${q.module.code} updated`,
  });

  return NextResponse.json({ question: { id: updated.id } });
}
