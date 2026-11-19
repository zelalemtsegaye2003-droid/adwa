import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { learnRateLimit, learnerByCodes, publicQuestion, scoreAnswers } from "@/lib/awareness/awareness-server";

export const runtime = "nodejs";

/**
 * POST /api/learn/progress — record lesson engagement for a participant.
 * Body: { joinCode, learnerCode, moduleId, quizAnswers?: [{qId, picked}] }
 *
 *  - Consent gate: only GRANTED learners may submit (403 otherwise).
 *  - First touch marks the lesson in_progress; submitting quizAnswers scores
 *    the module quiz server-side (answer keys never leave the server) and
 *    marks the lesson completed.
 */
export async function POST(req: NextRequest) {
  const rl = learnRateLimit(req, "progress", 30, 60_000);
  if (rl) return rl as unknown as NextResponse;

  let body: {
    joinCode?: string;
    learnerCode?: string;
    moduleId?: string;
    quizAnswers?: { qId: string; picked: number }[];
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: { code: "INVALID_JSON", message: "Request body must be valid JSON." } }, { status: 400 });
  }

  const learner = await learnerByCodes(body.joinCode ?? "", body.learnerCode ?? "");
  if (!learner) {
    return NextResponse.json({ error: { code: "LEARNER_NOT_FOUND", message: "Participant code not recognised for this class." } }, { status: 404 });
  }
  if (learner.consent !== "GRANTED") {
    return NextResponse.json(
      { error: { code: "CONSENT_REQUIRED", message: "Parental consent has not been recorded for this participant code yet." } },
      { status: 403 }
    );
  }
  if (!body.moduleId) {
    return NextResponse.json({ error: { code: "BAD_BODY", message: "moduleId is required." } }, { status: 400 });
  }

  const mod = await db.awarenessModule.findUnique({
    where: { id: body.moduleId },
    include: { questions: { where: { isActive: true }, orderBy: { sortOrder: "asc" } } },
  });
  if (!mod || !mod.isActive) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Lesson not found." } }, { status: 404 });
  }

  const existing = await db.awarenessProgress.findUnique({
    where: { learnerId_moduleId: { learnerId: learner.id, moduleId: mod.id } },
  });
  if (existing?.status === "completed" && !body.quizAnswers) {
    return NextResponse.json({ progress: { status: "completed", quizScore: existing.quizScore } });
  }

  if (Array.isArray(body.quizAnswers) && body.quizAnswers.length > 0) {
    const valid = body.quizAnswers.filter(
      (a) => mod.questions.some((q) => q.id === a.qId) && Number.isInteger(a.picked) && a.picked >= 0 && a.picked <= 3
    );
    if (valid.length !== mod.questions.length) {
      return NextResponse.json(
        { error: { code: "BAD_ANSWERS", message: `Answer all ${mod.questions.length} questions of this lesson quiz.` } },
        { status: 400 }
      );
    }
    const result = scoreAnswers(mod.questions, valid);
    const row = await db.awarenessProgress.upsert({
      where: { learnerId_moduleId: { learnerId: learner.id, moduleId: mod.id } },
      create: {
        learnerId: learner.id,
        moduleId: mod.id,
        status: "completed",
        quizScore: result.score,
        startedAt: existing?.startedAt ?? new Date(),
        completedAt: new Date(),
      },
      update: { status: "completed", quizScore: result.score, completedAt: new Date() },
    });
    return NextResponse.json({
      progress: { status: row.status, quizScore: row.quizScore },
      quiz: {
        score: result.score,
        correct: result.correct,
        total: result.total,
        detail: result.detail.map((d, i) => ({
          question: publicQuestion(mod.questions.find((q) => q.id === d.qId) ?? mod.questions[i]),
          picked: d.picked,
          correct: d.correct,
          answerIdx: d.answerIdx,
          explainEn: d.explainEn,
          explainAm: d.explainAm,
        })),
      },
    });
  }

  const row = await db.awarenessProgress.upsert({
    where: { learnerId_moduleId: { learnerId: learner.id, moduleId: mod.id } },
    create: { learnerId: learner.id, moduleId: mod.id, status: "in_progress" },
    update: {},
  });
  return NextResponse.json({ progress: { status: row.status, quizScore: row.quizScore } });
}
