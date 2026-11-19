import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { learnRateLimit, learnerByCodes } from "@/lib/awareness/awareness-server";

export const runtime = "nodejs";

/**
 * POST /api/learn/learner — identify a participant by class code + personal
 * participant code. Returns the consent state and learning status. The
 * consent state is data (the portal shows the gate), but every submission
 * endpoint rejects non-GRANTED learners with 403.
 */
export async function POST(req: NextRequest) {
  const rl = learnRateLimit(req, "learner", 20, 60_000);
  if (rl) return rl as unknown as NextResponse;

  let body: { joinCode?: string; learnerCode?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: { code: "INVALID_JSON", message: "Request body must be valid JSON." } }, { status: 400 });
  }

  const learner = await learnerByCodes(body.joinCode ?? "", body.learnerCode ?? "");
  if (!learner) {
    return NextResponse.json(
      { error: { code: "LEARNER_NOT_FOUND", message: "Participant code not recognised for this class." } },
      { status: 404 }
    );
  }

  const [assessments, progress] = await Promise.all([
    db.awarenessAssessment.findMany({
      where: { learnerId: learner.id },
      select: { kind: true, score: true, correct: true, total: true, takenAt: true },
    }),
    db.awarenessProgress.findMany({
      where: { learnerId: learner.id },
      select: { moduleId: true, status: true, quizScore: true, completedAt: true },
    }),
  ]);

  const pre = assessments.find((a) => a.kind === "PRE") ?? null;
  const post = assessments.find((a) => a.kind === "POST") ?? null;

  return NextResponse.json({
    learner: {
      code: learner.code,
      grade: learner.grade,
      consent: learner.consent,
      className: learner.class.name,
      schoolName: learner.class.school.name,
      schoolNameAm: learner.class.school.nameAm,
    },
    assessments: {
      pre: pre ? { score: pre.score, correct: pre.correct, total: pre.total, takenAt: pre.takenAt } : null,
      post: post ? { score: post.score, correct: post.correct, total: post.total, takenAt: post.takenAt } : null,
    },
    progress: progress.map((p) => ({ moduleId: p.moduleId, status: p.status, quizScore: p.quizScore, completedAt: p.completedAt })),
  });
}
