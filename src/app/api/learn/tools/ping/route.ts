import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { learnRateLimit } from "@/lib/awareness/awareness-server";
import { AWARENESS_TOOLS } from "@/lib/awareness/awareness-tools";

export const runtime = "nodejs";

const TOOL_IDS = new Set<string>(AWARENESS_TOOLS.map((t) => t.id));

/**
 * POST /api/learn/tools/ping — anonymous AI-Enhancement-Lab usage telemetry
 * (proposal Table 23). Body: { tool, lang }.
 *
 * Privacy contract: the ping carries ONLY the tool id and the interface
 * language — no IP, no learner link, no answers typed into a tool (tool
 * engines run entirely on the learner's device). This is aggregate programme
 * KPI data for the pilot evaluation, never personal data.
 */
export async function POST(req: NextRequest) {
  const rl = learnRateLimit(req, "tools-ping", 30, 60_000);
  if (rl) return rl as unknown as NextResponse;

  let body: { tool?: string; lang?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: { code: "INVALID_JSON", message: "Request body must be valid JSON." } }, { status: 400 });
  }

  const tool = String(body.tool ?? "");
  if (!TOOL_IDS.has(tool)) {
    return NextResponse.json({ error: { code: "BAD_TOOL", message: "Unknown tool." } }, { status: 400 });
  }
  const lang = body.lang === "en" ? "en" : "am";

  await db.awarenessToolPing.create({ data: { tool, lang } });

  return NextResponse.json({ ok: true });
}
