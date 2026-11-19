import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth/guard";
import { audit } from "@/lib/auth/audit";
import { clientIp } from "@/lib/auth/rate-limit";
import { CII_AUTH_STATUSES } from "@/lib/governance/cii-engine";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/**
 * PATCH /api/cii/authorizations/[id] — advance an INSA authorisation through
 * its lifecycle (SUPER_ADMIN). GRANTED/ACTIVE stamp issuedAt; every status
 * transition is audited.
 */
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const guard = await requireAuth(req, "cii:manage");
  if (guard.error) return guard.error;
  const { user } = guard;
  const { id } = await ctx.params;

  const existing = await db.ciiAuthorization.findUnique({ where: { id }, include: { operator: true } });
  if (!existing) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Authorisation not found." } }, { status: 404 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: { code: "INVALID_JSON", message: "Request body must be valid JSON." } }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  if (typeof body.status === "string" && (CII_AUTH_STATUSES as readonly string[]).includes(body.status)) data.status = body.status;
  if (typeof body.reference === "string") data.reference = body.reference.trim() || null;
  if (typeof body.notes === "string") data.notes = body.notes.trim() || null;
  if (typeof body.issuedAt === "string") data.issuedAt = body.issuedAt ? new Date(body.issuedAt) : null;
  if (typeof body.expiresAt === "string") data.expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;

  // Licence hygiene: an issue date is required to GRANT/ACTIVATE.
  if ((data.status === "GRANTED" || data.status === "ACTIVE") && !existing.issuedAt && !data.issuedAt) {
    return NextResponse.json(
      { error: { code: "ISSUE_DATE_REQUIRED", message: "Provide the INSA issue date to mark this authorisation GRANTED/ACTIVE." } },
      { status: 400 }
    );
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: { code: "EMPTY_UPDATE", message: "No updatable fields supplied." } }, { status: 400 });
  }

  const authorization = await db.ciiAuthorization.update({ where: { id }, data });

  if (data.status && data.status !== existing.status) {
    await audit({
      type: "CII_AUTH_STATUS_CHANGED",
      userId: user.id,
      email: user.email,
      organizationId: user.orgId,
      ip: clientIp(req.headers),
      userAgent: req.headers.get("user-agent"),
      detail: `CII INSA auth ${existing.operator.code}: ${existing.status} → ${String(data.status)}`,
    });
  }

  return NextResponse.json({ authorization });
}
