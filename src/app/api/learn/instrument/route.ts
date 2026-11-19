import { NextRequest, NextResponse } from "next/server";
import { publicQuestion, resolveInstrument } from "@/lib/awareness/awareness-server";

export const runtime = "nodejs";

/**
 * GET /api/learn/instrument — the fixed RQ2 knowledge instrument (16 paired
 * items, identical for PRE and POST so gains are attributable to the
 * curriculum). Public DTO: no answerIdx.
 */
export async function GET() {
  const instrument = await resolveInstrument();
  return NextResponse.json({
    items: instrument.map((q) => ({ ...publicQuestion(q), moduleCode: q.module.code })),
  });
}
