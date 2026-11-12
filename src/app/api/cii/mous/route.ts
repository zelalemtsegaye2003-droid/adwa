import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, parseBody } from "@/lib/auth/guard";
import { audit } from "@/lib/auth/audit";
import { clientIp } from "@/lib/auth/rate-limit";
import { CII_MOU_STATUSES } from "@/lib/cii-engine";

export const runtime = "nodejs";

/**
 * POST /api/cii/mous — record a new MOU version for an operator
 * (SUPER_ADMIN). New versions start in DRAFTING unless a signed date is
 * supplied together with a signable status.
 */
export async function POST(req: NextRequest) {
  const guard = await requireAuth(req, "cii:manage");
  if (guard.error) return guard.error;
  const { user } = guard;

  const parsed = await parseBody(req, (raw) => {
    if (typeof raw !== "object" || raw === null) return null;
    const b = raw as Record<string, unknown>;
    if (typeof b.operatorId !== "string" || !b.operatorId) return null;
    if (!Array.isArray(b.scope) || b.scope.length === 0 || !b.scope.every((s) => typeof s === "string" && s.trim())) return null;
    return {
      operatorId: b.operatorId,
      scope: (b.scope as string[]).map((s) => s.trim()),
      dataTerms: typeof b.dataTerms === "string" ? b.dataTerms.trim() || null : null,
      notes: typeof b.notes === "string" ? b.notes.trim() || null : null,
    };
  });
  if (parsed.error) return parsed.error;
  const data = parsed.data;

  const operator = await db.ciiOperator.findUnique({ where: { id: data.operatorId } });
  if (!operator) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Operator not found." } }, { status: 404 });
  }

  const prior = await db.ciiMou.findMany({ where: { operatorId: operator.id }, select: { version: true } });
  const version = prior.reduce((a, m) => Math.max(a, m.version), 0) + 1;

  const mou = await db.ciiMou.create({
    data: {
      operatorId: operator.id,
      version,
      status: "DRAFTING",
      scope: JSON.stringify(data.scope),
      dataTerms: data.dataTerms,
      notes: data.notes,
    },
  });

  await audit({
    type: "CII_MOU_CREATED",
    userId: user.id,
    email: user.email,
    organizationId: user.orgId,
    ip: clientIp(req.headers),
    userAgent: req.headers.get("user-agent"),
    detail: `CII MOU v${version} drafted for ${operator.code} — scope: ${data.scope.join(", ")}`,
  });

  return NextResponse.json({ mou }, { status: 201 });
}
