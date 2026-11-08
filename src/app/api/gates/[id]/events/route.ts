import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth/guard";

export const runtime = "nodejs";

/**
 * GET /api/gates/[id]/events — the per-criterion governance timeline.
 * Append-only record of every status change and evidence attachment, with
 * the acting user. Readable by governance viewers (SUPER_ADMIN): this is
 * what a funder, regulator, or university partner audits.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireAuth(req, "governance:view");
  if (guard.error) return guard.error;
  const { id } = await ctx.params;

  const gate = await db.expansionGate.findUnique({
    where: { id },
    select: { id: true, phase: true, code: true, titleEn: true, titleAm: true, status: true },
  });
  if (!gate) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Gate criterion not found." } }, { status: 404 });
  }

  const events = await db.gateEvent.findMany({
    where: { gateId: id },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      actor: { select: { name: true, email: true, role: true } },
    },
  });

  return NextResponse.json({
    gate,
    events: events.map((e) => ({
      id: e.id,
      kind: e.kind,
      fromStatus: e.fromStatus,
      toStatus: e.toStatus,
      note: e.note,
      evidenceId: e.evidenceId,
      actor: e.actor ? { name: e.actor.name, role: e.actor.role } : null,
      createdAt: e.createdAt,
    })),
  });
}
