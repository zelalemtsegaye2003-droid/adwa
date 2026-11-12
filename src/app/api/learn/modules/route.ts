import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";

/**
 * GET /api/learn/modules — public curriculum listing for the learner portal
 * (no authentication: the awareness platform is the public-interest face of
 * Track B). Answer keys are never included.
 */
export async function GET() {
  const modules = await db.awarenessModule.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true, code: true, sortOrder: true, topic: true,
      titleEn: true, titleAm: true, summaryEn: true, summaryAm: true,
      durationMin: true, gradeBand: true, audience: true,
      questions: { where: { isActive: true }, select: { id: true } },
    },
  });

  return NextResponse.json({
    modules: modules.map((m) => ({
      id: m.id,
      code: m.code,
      sortOrder: m.sortOrder,
      topic: m.topic,
      titleEn: m.titleEn,
      titleAm: m.titleAm,
      summaryEn: m.summaryEn,
      summaryAm: m.summaryAm,
      durationMin: m.durationMin,
      gradeBand: m.gradeBand,
      audience: m.audience,
      questions: m.questions.length,
    })),
  });
}
