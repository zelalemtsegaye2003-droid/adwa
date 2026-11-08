import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, parseBody } from "@/lib/auth/guard";
import { audit } from "@/lib/auth/audit";

export const runtime = "nodejs";

/** Valid audience tracks (proposal Table 22 module architecture). */
const AUDIENCES = new Set(["KIDS", "TEENS", "PRO", "AWARE"]);

/** GET /api/awareness/modules — curriculum list with question counts. */
export async function GET(req: NextRequest) {
  const guard = await requireAuth(req, "awareness:manage");
  if (guard.error) return guard.error;

  const includeInactive = req.nextUrl.searchParams.get("all") === "1";
  const audienceFilter = req.nextUrl.searchParams.get("audience");
  const where: Record<string, unknown> = includeInactive ? {} : { isActive: true };
  if (audienceFilter && AUDIENCES.has(audienceFilter)) where.audience = audienceFilter;
  const modules = await db.awarenessModule.findMany({
    where,
    orderBy: { sortOrder: "asc" },
    include: { questions: { orderBy: { sortOrder: "asc" } } },
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
      contentEn: m.contentEn,
      contentAm: m.contentAm,
      durationMin: m.durationMin,
      gradeBand: m.gradeBand,
      audience: m.audience,
      version: m.version,
      isActive: m.isActive,
      updatedAt: m.updatedAt,
      questions: m.questions.map((q) => ({
        id: q.id,
        sortOrder: q.sortOrder,
        promptEn: q.promptEn,
        promptAm: q.promptAm,
        optionsEn: JSON.parse(q.optionsEn) as string[],
        optionsAm: JSON.parse(q.optionsAm) as string[],
        answerIdx: q.answerIdx,
        explainEn: q.explainEn,
        explainAm: q.explainAm,
        isActive: q.isActive,
      })),
    })),
  });
}

interface QuestionInput {
  promptEn: string;
  promptAm: string;
  optionsEn: string[];
  optionsAm: string[];
  answerIdx: number;
  explainEn?: string;
  explainAm?: string;
}

/** POST /api/awareness/modules — publish a new curriculum unit. */
export async function POST(req: NextRequest) {
  const guard = await requireAuth(req, "awareness:manage");
  if (guard.error) return guard.error;
  const { user } = guard;

  const parsed = await parseBody(req, (raw) => {
    const b = raw as Record<string, unknown>;
    const str = (v: unknown) => typeof v === "string" && v.trim().length > 0;
    const qs = Array.isArray(b.questions) ? (b.questions as QuestionInput[]) : [];
    const validQs = qs.every(
      (q) =>
        str(q.promptEn) && str(q.promptAm) &&
        Array.isArray(q.optionsEn) && q.optionsEn.length === 4 && q.optionsEn.every(str) &&
        Array.isArray(q.optionsAm) && q.optionsAm.length === 4 && q.optionsAm.every(str) &&
        Number.isInteger(q.answerIdx) && q.answerIdx >= 0 && q.answerIdx <= 3
    );
    if (
      !str(b.titleEn) || !str(b.titleAm) || !str(b.summaryEn) || !str(b.summaryAm) ||
      !str(b.contentEn) || !str(b.contentAm) || !str(b.topic) || !validQs
    ) return null;
    return {
      topic: String(b.topic),
      titleEn: String(b.titleEn).trim(),
      titleAm: String(b.titleAm).trim(),
      summaryEn: String(b.summaryEn).trim(),
      summaryAm: String(b.summaryAm).trim(),
      contentEn: String(b.contentEn).trim(),
      contentAm: String(b.contentAm).trim(),
      durationMin: Number(b.durationMin) || 15,
      gradeBand: String(b.gradeBand ?? "7-10"),
      audience: AUDIENCES.has(b.audience as string) ? String(b.audience) : "KIDS",
      questions: qs,
    };
  });
  if ("error" in parsed) return parsed.error;
  const { questions, ...data } = parsed.data;

  const maxOrder = await db.awarenessModule.aggregate({ _max: { sortOrder: true } });
  const sortOrder = (maxOrder._max.sortOrder ?? 0) + 1;
  const code = `AW-${String(sortOrder).padStart(2, "0")}`;

  const mod = await db.awarenessModule.create({
    data: {
      ...data,
      code,
      sortOrder,
      questions: {
        create: questions.map((q, i) => ({
          sortOrder: i + 1,
          promptEn: q.promptEn, promptAm: q.promptAm,
          optionsEn: JSON.stringify(q.optionsEn), optionsAm: JSON.stringify(q.optionsAm),
          answerIdx: q.answerIdx, explainEn: q.explainEn ?? null, explainAm: q.explainAm ?? null,
        })),
      },
    },
    include: { questions: true },
  });

  await audit({
    type: "AWARENESS_MODULE_CREATED",
    userId: user.id,
    email: user.email,
    organizationId: null,
    detail: `Module ${mod.code} (${mod.titleEn}) with ${mod.questions.length} questions`,
  });

  return NextResponse.json({ module: { id: mod.id, code: mod.code } }, { status: 201 });
}
