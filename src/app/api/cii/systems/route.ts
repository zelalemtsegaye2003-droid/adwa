import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, parseBody } from "@/lib/auth/guard";
import { audit } from "@/lib/auth/audit";
import { clientIp } from "@/lib/auth/rate-limit";
import { CII_SYSTEM_CATEGORIES } from "@/lib/governance/cii-engine";

export const runtime = "nodejs";

/**
 * POST /api/cii/systems — register a critical system for an operator
 * (SUPER_ADMIN). Systems always start at REGISTERED; advancement to
 * MONITORING_AUTHORIZED is separately gated.
 */
export async function POST(req: NextRequest) {
  const guard = await requireAuth(req, "cii:manage");
  if (guard.error) return guard.error;
  const { user } = guard;

  const parsed = await parseBody(req, (raw) => {
    if (typeof raw !== "object" || raw === null) return null;
    const b = raw as Record<string, unknown>;
    if (typeof b.operatorId !== "string" || !b.operatorId) return null;
    if (typeof b.name !== "string" || b.name.trim().length < 3) return null;
    return {
      operatorId: b.operatorId,
      name: b.name.trim(),
      nameAm: typeof b.nameAm === "string" && b.nameAm.trim() ? b.nameAm.trim() : null,
      category:
        typeof b.category === "string" && (CII_SYSTEM_CATEGORIES as readonly string[]).includes(b.category) ? b.category : "OTHER",
      criticality: b.criticality === "HIGH" ? "HIGH" : "CRITICAL",
      notes: typeof b.notes === "string" ? b.notes.trim() || null : null,
    };
  });
  if (parsed.error) return parsed.error;
  const data = parsed.data;

  const operator = await db.ciiOperator.findUnique({ where: { id: data.operatorId } });
  if (!operator) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Operator not found." } }, { status: 404 });
  }

  const system = await db.ciiSystem.create({ data: { ...data, readiness: "REGISTERED" } });

  await audit({
    type: "CII_SYSTEM_CREATED",
    userId: user.id,
    email: user.email,
    organizationId: user.orgId,
    ip: clientIp(req.headers),
    userAgent: req.headers.get("user-agent"),
    detail: `CII system "${system.name}" registered for ${operator.code} (${system.category}, ${system.criticality})`,
  });

  return NextResponse.json({ system }, { status: 201 });
}
