import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth/guard";
import { audit } from "@/lib/auth/audit";
import { clientIp } from "@/lib/auth/rate-limit";
import { CII_MOU_STATUSES } from "@/lib/cii-engine";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/**
 * PATCH /api/cii/mous/[id] — advance an MOU through its lifecycle
 * (SUPER_ADMIN). Transitions are audited; SIGNED/ACTIVE stamp signedAt;
 * EXPIRED/ACTIVE stamp/derive expiresAt when supplied.
 */
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const guard = await requireAuth(req, "cii:manage");
  if (guard.error) return guard.error;
  const { user } = guard;
  const { id } = await ctx.params;

  const existing = await db.ciiMou.findUnique({ where: { id }, include: { operator: true } });
  if (!existing) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "MOU not found." } }, { status: 404 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: { code: "INVALID_JSON", message: "Request body must be valid JSON." } }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  if (typeof body.status === "string" && (CII_MOU_STATUSES as readonly string[]).includes(body.status)) data.status = body.status;
  if (typeof body.dataTerms === "string") data.dataTerms = body.dataTerms.trim() || null;
  if (typeof body.notes === "string") data.notes = body.notes.trim() || null;
  if (typeof body.signedAt === "string") data.signedAt = body.signedAt ? new Date(body.signedAt) : null;
  if (typeof body.expiresAt === "string") data.expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;

  // Lifecycle hygiene: a signature needs a date; activation needs both dates.
  if (data.status === "SIGNED" && !existing.signedAt && !data.signedAt) {
    return NextResponse.json(
      { error: { code: "SIGN_DATE_REQUIRED", message: "Provide the signing date to mark this MOU SIGNED." } },
      { status: 400 }
    );
  }
  if (data.status === "ACTIVE") {
    const signedAt = (data.signedAt as Date | undefined) ?? existing.signedAt;
    if (!signedAt) {
      return NextResponse.json(
        { error: { code: "SIGN_DATE_REQUIRED", message: "An MOU can only be ACTIVATED after it is signed (with a signing date)." } },
        { status: 400 }
      );
    }
    if (!existing.signedAt && data.signedAt) data.status = "SIGNED"; // fall back one step: signed, not yet active
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: { code: "EMPTY_UPDATE", message: "No updatable fields supplied." } }, { status: 400 });
  }

  const mou = await db.ciiMou.update({ where: { id }, data });

  if (data.status && data.status !== existing.status) {
    await audit({
      type: "CII_MOU_STATUS_CHANGED",
      userId: user.id,
      email: user.email,
      organizationId: user.orgId,
      ip: clientIp(req.headers),
      userAgent: req.headers.get("user-agent"),
      detail: `CII MOU ${existing.operator.code} v${existing.version}: ${existing.status} → ${String(data.status)}`,
    });
  }

  return NextResponse.json({ mou });
}
