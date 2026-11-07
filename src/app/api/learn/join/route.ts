import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { learnRateLimit } from "@/lib/awareness-server";

export const runtime = "nodejs";

/**
 * POST /api/learn/join — the public learner-portal entry point.
 * Body: { joinCode }. Returns the class context and curriculum list.
 * Privacy: never lists learners, never reveals the RQ2 group assignment
 * (TREATMENT/CONTROL) so sittings cannot be biased.
 */
export async function POST(req: NextRequest) {
  const rl = learnRateLimit(req, "join", 10, 60_000);
  if (rl) return rl as unknown as NextResponse;

  let body: { joinCode?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: { code: "INVALID_JSON", message: "Request body must be valid JSON." } }, { status: 400 });
  }
  const joinCode = (body.joinCode ?? "").trim().toUpperCase();
  if (!/^[A-Z0-9-]{6,16}$/.test(joinCode)) {
    return NextResponse.json({ error: { code: "BAD_CODE", message: "Enter the class code your teacher gave you." } }, { status: 400 });
  }

  const klass = await db.awarenessClass.findUnique({
    where: { joinCode },
    include: { school: true },
  });
  if (!klass || !klass.isActive || !klass.school.isActive) {
    return NextResponse.json({ error: { code: "CLASS_NOT_FOUND", message: "This class code is not recognised." } }, { status: 404 });
  }

  const modules = await db.awarenessModule.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true, code: true, sortOrder: true, topic: true,
      titleEn: true, titleAm: true, summaryEn: true, summaryAm: true,
      durationMin: true, gradeBand: true,
      questions: { where: { isActive: true }, select: { id: true } },
    },
  });

  return NextResponse.json({
    class: {
      name: klass.name,
      grade: klass.grade,
      teacherName: klass.teacherName,
      schoolName: klass.school.name,
      schoolNameAm: klass.school.nameAm,
    },
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
      questions: m.questions.length,
    })),
  });
}
