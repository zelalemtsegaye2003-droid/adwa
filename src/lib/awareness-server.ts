/**
 * Adwa Cyber — Awareness Platform server helpers (proposal Phase 3, Track B).
 *
 * Shared by the admin APIs (SUPER_ADMIN, `awareness:manage`) and the public
 * learner portal APIs (/api/learn/*). Centralises the privacy contract:
 *
 *  - Learner identification = joinCode (class) + pseudonymised participant
 *    code. Never names, never enumeration: codes are unguessable and the
 *    join endpoint never lists learners.
 *  - Every learning submission is gated on parental consent (GRANTED).
 *  - Question DTOs sent to learners never contain answerIdx — scoring and
 *    explanations are produced server-side only.
 *  - Learner-facing payloads hide the RQ2 group assignment (TREATMENT vs
 *    CONTROL) so participants cannot bias their own sittings.
 */
import { db } from "@/lib/db";
import { clientIp, rateLimit } from "@/lib/auth/rate-limit";
import type { NextRequest } from "next/server";
import type { AwarenessLearner, AwarenessClass, AwarenessSchool, AwarenessQuestion, AwarenessModule } from "@prisma/client";

export type LearnerWithClass = AwarenessLearner & {
  class: AwarenessClass & { school: AwarenessSchool };
};

/** Resolve a learner by class join code + participant code. Null when either is wrong. */
export async function learnerByCodes(joinCode: string, learnerCode: string): Promise<LearnerWithClass | null> {
  if (!joinCode || !learnerCode) return null;
  const learner = await db.awarenessLearner.findUnique({
    where: { code: learnerCode.trim().toUpperCase() },
    include: { class: { include: { school: true } } },
  });
  if (!learner) return null;
  if (learner.class.joinCode !== joinCode.trim().toUpperCase()) return null;
  if (!learner.class.isActive || !learner.class.school.isActive) return null;
  return learner;
}

/**
 * The fixed RQ2 instrument draw: first and third bank item of each module.
 *
 * Pinned to the CyberSafe Kids pilot curriculum (audience KIDS, proposal
 * Table 22): the supplementary TEENS/PRO/AWARE units extend the platform to
 * the other audiences but must never change the 16-item paired instrument
 * that RQ2's pre/post design depends on.
 */
export async function resolveInstrument(): Promise<(AwarenessQuestion & { module: AwarenessModule })[]> {
  const modules = await db.awarenessModule.findMany({
    where: { isActive: true, audience: "KIDS" },
    orderBy: { sortOrder: "asc" },
    include: { questions: { where: { isActive: true }, orderBy: { sortOrder: "asc" } } },
  });
  const out: (AwarenessQuestion & { module: AwarenessModule })[] = [];
  for (const m of modules) {
    if (m.questions[0]) out.push({ ...m.questions[0], module: m });
    if (m.questions.length >= 3 && m.questions[2]) out.push({ ...m.questions[2], module: m });
  }
  return out;
}

/** Learner-safe question DTO — no answerIdx, no internal ids beyond what scoring needs. */
export function publicQuestion(q: AwarenessQuestion) {
  return {
    id: q.id,
    moduleId: q.moduleId,
    moduleCode: "",
    sortOrder: q.sortOrder,
    promptEn: q.promptEn,
    promptAm: q.promptAm,
    optionsEn: JSON.parse(q.optionsEn) as string[],
    optionsAm: JSON.parse(q.optionsAm) as string[],
  };
}

/** Score an answer sheet against the instrument. Returns correctness + explanations. */
export function scoreAnswers(
  questions: { id: string; answerIdx: number; explainEn: string | null; explainAm: string | null }[],
  answers: { qId: string; picked: number }[]
) {
  const byId = new Map(questions.map((q) => [q.id, q]));
  const detail: { qId: string; picked: number; correct: boolean; answerIdx: number; explainEn: string | null; explainAm: string | null }[] = [];
  let correct = 0;
  for (const a of answers) {
    const q = byId.get(a.qId);
    if (!q) continue;
    const ok = a.picked === q.answerIdx;
    if (ok) correct++;
    detail.push({ qId: q.id, picked: a.picked, correct: ok, answerIdx: q.answerIdx, explainEn: q.explainEn, explainAm: q.explainAm });
  }
  return {
    total: questions.length,
    correct,
    score: questions.length > 0 ? Math.round((correct / questions.length) * 1000) / 10 : 0,
    detail,
  };
}

/** Learner-portal rate limiter (per IP). Returns a 429 Response when exceeded. */
export function learnRateLimit(req: NextRequest, bucket: string, limit = 30, windowMs = 60_000): Response | null {
  const rl = rateLimit(`learn:${bucket}:${clientIp(req.headers)}`, limit, windowMs);
  if (!rl.allowed) {
    return Response.json(
      { error: { code: "RATE_LIMITED", message: "Too many attempts. Please slow down." } },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } }
    );
  }
  return null;
}

/** Unguessable class join code / learner participant code alphabet (no 0/O/1/I). */
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export function randomCode(prefix: string, len: number): string {
  let s = "";
  for (let i = 0; i < len; i++) s += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  return `${prefix}-${s}`;
}
