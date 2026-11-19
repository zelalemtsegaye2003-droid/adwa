import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { learnRateLimit, learnerByCodes, publicQuestion, resolveInstrument, scoreAnswers } from "@/lib/awareness/awareness-server";

export const runtime = "nodejs";

/**
 * POST /api/learn/assessment — sit the RQ2 pre/post knowledge test.
 * Body: { joinCode, learnerCode, kind: "PRE" | "POST", answers: [{qId, picked}] }
 *
 *  - Consent gate (403 unless GRANTED).
 *  - One sitting per learner per kind (409 on retake) — keeps the paired
 *    pre/post design clean for the ANOVA evaluation.
 *  - Server-side scoring only; the response returns score, per-item
 *    correctness and explanations AFTER submission.
 *  - A POST sitting also reports the gain against the learner's PRE score.
 */
export async function POST(req: NextRequest) {
  const rl = learnRateLimit(req, "assessment", 10, 60_000);
  if (rl) return rl as unknown as NextResponse;

  let body: {
    joinCode?: string;
    learnerCode?: string;
    kind?: string;
    answers?: { qId: string; picked: number }[];
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: { code: "INVALID_JSON", message: "Request body must be valid JSON." } }, { status: 400 });
  }

  if (body.kind !== "PRE" && body.kind !== "POST") {
    return NextResponse.json({ error: { code: "BAD_KIND", message: "kind must be PRE or POST." } }, { status: 400 });
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

  const existing = await db.awarenessAssessment.findFirst({ where: { learnerId: learner.id, kind: body.kind } });
  if (existing) {
    return NextResponse.json(
      { error: { code: "ALREADY_SAT", message: `You have already completed the ${body.kind === "PRE" ? "first" : "final"} test. One sitting per participant keeps the study fair.` } },
      { status: 409 }
    );
  }

  // POST must come after PRE (paired design).
  if (body.kind === "POST") {
    const pre = await db.awarenessAssessment.findFirst({ where: { learnerId: learner.id, kind: "PRE" } });
    if (!pre) {
      return NextResponse.json(
        { error: { code: "PRE_REQUIRED", message: "Please complete the first test before the final test." } },
        { status: 409 }
      );
    }
  }

  const instrument = await resolveInstrument();
  if (!Array.isArray(body.answers) || body.answers.length !== instrument.length) {
    return NextResponse.json(
      { error: { code: "BAD_ANSWERS", message: `Answer all ${instrument.length} questions.` } },
      { status: 400 }
    );
  }
  const idSet = new Set(instrument.map((q) => q.id));
  const valid = body.answers.filter((a) => idSet.has(a.qId) && Number.isInteger(a.picked) && a.picked >= 0 && a.picked <= 3);
  if (valid.length !== instrument.length) {
    return NextResponse.json(
      { error: { code: "BAD_ANSWERS", message: "Some answers were invalid. Please retry the test." } },
      { status: 400 }
    );
  }

  const result = scoreAnswers(instrument, valid);
  const row = await db.awarenessAssessment.create({
    data: {
      learnerId: learner.id,
      kind: body.kind,
      total: result.total,
      correct: result.correct,
      score: result.score,
      answers: JSON.stringify(valid.map((a) => ({ qId: a.qId, picked: a.picked }))),
    },
  });

  let gain: number | null = null;
  if (body.kind === "POST") {
    const pre = await db.awarenessAssessment.findFirst({ where: { learnerId: learner.id, kind: "PRE" } });
    if (pre) gain = Math.round((result.score - pre.score) * 10) / 10;
  }

  return NextResponse.json({
    assessment: {
      kind: row.kind,
      score: row.score,
      correct: row.correct,
      total: row.total,
      takenAt: row.takenAt,
      gain,
    },
    detail: result.detail.map((d, i) => ({
      question: publicQuestion(instrument.find((q) => q.id === d.qId) ?? instrument[i]),
      picked: d.picked,
      correct: d.correct,
      answerIdx: d.answerIdx,
      explainEn: d.explainEn,
      explainAm: d.explainAm,
    })),
  });
}
