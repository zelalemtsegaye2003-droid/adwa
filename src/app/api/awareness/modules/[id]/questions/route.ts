import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, parseBody } from "@/lib/auth/guard";
import { audit } from "@/lib/auth/audit";

export const runtime = "nodejs";

/** POST /api/awareness/modules/[id]/questions — append a quiz item to the bank. */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireAuth(req, "awareness:manage");
  if (guard.error) return guard.error;
  const { user } = guard;
  const { id } = await ctx.params;

  const mod = await db.awarenessModule.findUnique({ where: { id }, include: { questions: true } });
  if (!mod) return NextResponse.json({ error: "Module not found" }, { status: 404 });

  const parsed = await parseBody(req, (raw) => {
    const b = raw as Record<string, unknown>;
    const str = (v: unknown) => typeof v === "string" && v.trim().length > 0;
    if (
      !str(b.promptEn) || !str(b.promptAm) ||
      !Array.isArray(b.optionsEn) || b.optionsEn.length !== 4 || !(b.optionsEn as unknown[]).every(str) ||
      !Array.isArray(b.optionsAm) || b.optionsAm.length !== 4 || !(b.optionsAm as unknown[]).every(str) ||
      !Number.isInteger(b.answerIdx) || (b.answerIdx as number) < 0 || (b.answerIdx as number) > 3
    ) return null;
    return {
      promptEn: String(b.promptEn).trim(),
      promptAm: String(b.promptAm).trim(),
      optionsEn: b.optionsEn as string[],
      optionsAm: b.optionsAm as string[],
      answerIdx: b.answerIdx as number,
      explainEn: typeof b.explainEn === "string" && b.explainEn.trim() ? b.explainEn.trim() : null,
      explainAm: typeof b.explainAm === "string" && b.explainAm.trim() ? b.explainAm.trim() : null,
    };
  });
  if ("error" in parsed) return parsed.error;

  const maxOrder = mod.questions.reduce((acc, q) => Math.max(acc, q.sortOrder), 0);
  const q = await db.awarenessQuestion.create({
    data: {
      moduleId: mod.id,
      sortOrder: maxOrder + 1,
      promptEn: parsed.data.promptEn,
      promptAm: parsed.data.promptAm,
      optionsEn: JSON.stringify(parsed.data.optionsEn),
      optionsAm: JSON.stringify(parsed.data.optionsAm),
      answerIdx: parsed.data.answerIdx,
      explainEn: parsed.data.explainEn,
      explainAm: parsed.data.explainAm,
    },
  });

  await audit({
    type: "AWARENESS_QUESTION_ADDED",
    userId: user.id,
    email: user.email,
    organizationId: null,
    detail: `Question ${q.sortOrder} added to ${mod.code} (bank now ${mod.questions.length + 1} items)`,
  });

  return NextResponse.json({ question: { id: q.id, sortOrder: q.sortOrder } }, { status: 201 });
}
