import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { publicQuestion } from "@/lib/awareness/awareness-server";

export const runtime = "nodejs";

/** GET /api/learn/modules/[id] — lesson content + quiz bank (learner-safe DTO). */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const mod = await db.awarenessModule.findUnique({
    where: { id },
    include: { questions: { where: { isActive: true }, orderBy: { sortOrder: "asc" } } },
  });
  if (!mod || !mod.isActive) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Lesson not found." } }, { status: 404 });
  }
  return NextResponse.json({
    module: {
      id: mod.id,
      code: mod.code,
      sortOrder: mod.sortOrder,
      topic: mod.topic,
      titleEn: mod.titleEn,
      titleAm: mod.titleAm,
      contentEn: mod.contentEn,
      contentAm: mod.contentAm,
      durationMin: mod.durationMin,
      gradeBand: mod.gradeBand,
      questions: mod.questions.map((q) => ({ ...publicQuestion(q), moduleCode: mod.code })),
    },
  });
}
