import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, parseBody } from "@/lib/auth/guard";
import { audit } from "@/lib/auth/audit";
import { clientIp } from "@/lib/auth/rate-limit";

export const runtime = "nodejs";

/**
 * POST /api/cii/authorizations — record an INSA authorisation application
 * for an operator (SUPER_ADMIN). Starts at PENDING.
 */
export async function POST(req: NextRequest) {
  const guard = await requireAuth(req, "cii:manage");
  if (guard.error) return guard.error;
  const { user } = guard;

  const parsed = await parseBody(req, (raw) => {
    if (typeof raw !== "object" || raw === null) return null;
    const b = raw as Record<string, unknown>;
    if (typeof b.operatorId !== "string" || !b.operatorId) return null;
    return {
      operatorId: b.operatorId,
      reference: typeof b.reference === "string" ? b.reference.trim() || null : null,
      scope: typeof b.scope === "string" ? b.scope.trim() || null : null,
      notes: typeof b.notes === "string" ? b.notes.trim() || null : null,
    };
  });
  if (parsed.error) return parsed.error;
  const data = parsed.data;

  const operator = await db.ciiOperator.findUnique({ where: { id: data.operatorId } });
  if (!operator) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Operator not found." } }, { status: 404 });
  }

  const authorization = await db.ciiAuthorization.create({
    data: { ...data, status: "PENDING" },
  });

  await audit({
    type: "CII_AUTH_CREATED",
    userId: user.id,
    email: user.email,
    organizationId: user.orgId,
    ip: clientIp(req.headers),
    userAgent: req.headers.get("user-agent"),
    detail: `CII INSA authorisation application recorded for ${operator.code}${data.reference ? ` (ref ${data.reference})` : ""}`,
  });

  return NextResponse.json({ authorization }, { status: 201 });
}
