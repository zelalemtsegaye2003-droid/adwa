import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth/guard";
import { audit } from "@/lib/auth/audit";
import { clientIp } from "@/lib/auth/rate-limit";
import { ACFS_STATUSES } from "@/lib/governance/acfs-gates";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/**
 * PATCH /api/acfs/items/[id] — update a precondition requirement's status,
 * evidence reference, owner, due date or notes. Every transition is audited
 * so the gate register doubles as the governance audit trail.
 */
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const guard = await requireAuth(req, "acfs:manage");
  if (guard.error) return guard.error;
  const { user } = guard;
  const { id } = await ctx.params;

  const existing = await db.acfsGateItem.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Gate item not found." } }, { status: 404 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: { code: "INVALID_JSON", message: "Request body must be valid JSON." } }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  if (typeof body.status === "string" && (ACFS_STATUSES as readonly string[]).includes(body.status)) data.status = body.status;
  if (typeof body.evidenceRef === "string") data.evidenceRef = body.evidenceRef.trim() || null;
  if (typeof body.owner === "string") data.owner = body.owner.trim() || null;
  if (typeof body.notes === "string") data.notes = body.notes.trim() || null;
  if (typeof body.dueDate === "string") data.dueDate = body.dueDate ? new Date(body.dueDate) : null;
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: { code: "EMPTY_UPDATE", message: "No updatable fields supplied." } }, { status: 400 });
  }

  // SATISFIED requires an evidence reference — governance hygiene.
  if (data.status === "SATISFIED") {
    const ref = (data.evidenceRef ?? existing.evidenceRef ?? "").toString().trim();
    if (!ref) {
      return NextResponse.json(
        { error: { code: "EVIDENCE_REQUIRED", message: "A precondition can only be marked SATISFIED with an evidence reference." } },
        { status: 400 }
      );
    }
  }

  const item = await db.acfsGateItem.update({ where: { id }, data });

  if (data.status && data.status !== existing.status) {
    await audit({
      type: "ACFS_ITEM_STATUS_CHANGED",
      userId: user.id,
      email: user.email,
      organizationId: user.orgId,
      ip: clientIp(req.headers),
      userAgent: req.headers.get("user-agent"),
      detail: `ACFS precondition ${existing.code}: ${existing.status} → ${data.status}${data.evidenceRef ? ` (evidence: ${String(data.evidenceRef).slice(0, 80)})` : ""}`,
    });
  }

  return NextResponse.json({ item });
}

/**
 * DELETE /api/acfs/items/[id] — intentionally not permitted. The proposal's
 * verbatim preconditions are immutable governance records: the register may
 * only grow, never shrink.
 */
export async function DELETE(req: NextRequest, ctx: Ctx) {
  const guard = await requireAuth(req, "acfs:manage");
  if (guard.error) return guard.error;

  const existing = await db.acfsGateItem.findUnique({ where: { id: (await ctx.params).id } });
  if (!existing) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Gate item not found." } }, { status: 404 });
  }

  return NextResponse.json(
    { error: { code: "REGISTER_IMMUTABLE", message: "Precondition register items are permanent governance records and cannot be deleted." } },
    { status: 403 }
  );
}
