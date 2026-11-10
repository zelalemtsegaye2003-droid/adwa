import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, parseBody } from "@/lib/auth/guard";
import { audit } from "@/lib/auth/audit";
import { clientIp } from "@/lib/auth/rate-limit";
import { CII_SECTORS } from "@/lib/cii-engine";

export const runtime = "nodejs";

/**
 * POST /api/cii/operators — designate a CII operator (SUPER_ADMIN).
 * orgId optionally links the operator to an onboarded tenant so that
 * tenant's users get the read-only `cii:view-own` feed.
 */
export async function POST(req: NextRequest) {
  const guard = await requireAuth(req, "cii:manage");
  if (guard.error) return guard.error;
  const { user } = guard;

  const parsed = await parseBody(req, (raw) => {
    if (typeof raw !== "object" || raw === null) return null;
    const b = raw as Record<string, unknown>;
    if (typeof b.code !== "string" || !/^[A-Z0-9-]{2,20}$/.test(b.code)) return null;
    if (typeof b.name !== "string" || b.name.trim().length < 3) return null;
    return {
      code: b.code.trim().toUpperCase(),
      name: b.name.trim(),
      nameAm: typeof b.nameAm === "string" && b.nameAm.trim() ? b.nameAm.trim() : b.name.trim(),
      sector: typeof b.sector === "string" && (CII_SECTORS as readonly string[]).includes(b.sector) ? b.sector : "Other",
      tier: b.tier === "TIER2" ? "TIER2" : "TIER1",
      orgId: typeof b.orgId === "string" && b.orgId ? b.orgId : null,
      contactEmail: typeof b.contactEmail === "string" ? b.contactEmail.trim() || null : null,
    };
  });
  if (parsed.error) return parsed.error;
  const data = parsed.data;

  if (data.orgId) {
    const org = await db.organization.findUnique({ where: { id: data.orgId }, select: { id: true } });
    if (!org) {
      return NextResponse.json({ error: { code: "ORG_NOT_FOUND", message: "Linked organization not found." } }, { status: 400 });
    }
  }

  const clash = await db.ciiOperator.findUnique({ where: { code: data.code } });
  if (clash) {
    return NextResponse.json({ error: { code: "CODE_TAKEN", message: `Operator code ${data.code} already exists.` } }, { status: 409 });
  }

  const operator = await db.ciiOperator.create({ data });

  await audit({
    type: "CII_OPERATOR_CREATED",
    userId: user.id,
    email: user.email,
    organizationId: user.orgId,
    ip: clientIp(req.headers),
    userAgent: req.headers.get("user-agent"),
    detail: `CII operator ${operator.code} (${operator.name}) designated — tier ${operator.tier}, sector ${operator.sector}`,
  });

  return NextResponse.json({ operator }, { status: 201 });
}
