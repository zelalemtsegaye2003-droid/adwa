import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuthAny } from "@/lib/auth/guard";
import { can } from "@/lib/auth/rbac";
import { evaluateCiiGate } from "@/lib/cii-engine";

export const runtime = "nodejs";

/**
 * GET /api/cii/overview — the Phase 5 (Track C) readiness feed.
 *
 *  - SUPER_ADMIN (`cii:manage`): every CII operator with its evaluated gate
 *    (MOU × INSA), MOU versions, INSA authorisations and registered systems.
 *  - Tenant users (`cii:view-own`): strictly their own operator — matched via
 *    CiiOperator.orgId — and read-only. A tenant that is not a CII operator
 *    receives `linked: false` and no data.
 */
export async function GET(req: NextRequest) {
  const guard = await requireAuthAny(req, ["cii:manage", "cii:view-own"]);
  if (guard.error) return guard.error;
  const { user } = guard;

  const isManager = can(user.role, "cii:manage");

  if (!isManager) {
    // Tenant scope: only the operator linked to the caller's organization.
    if (!user.orgId) {
      return NextResponse.json({ scope: "tenant", readOnly: true, linked: false, operators: [] });
    }
    const own = await db.ciiOperator.findFirst({
      where: { orgId: user.orgId },
      include: {
        mous: { orderBy: [{ version: "desc" }] },
        authorizations: { orderBy: { createdAt: "desc" } },
        systems: { orderBy: { createdAt: "asc" } },
      },
    });
    if (!own) {
      return NextResponse.json({ scope: "tenant", readOnly: true, linked: false, operators: [] });
    }
    const gate = evaluateCiiGate({ id: own.id, code: own.code }, own.mous, own.authorizations);
    return NextResponse.json({
      scope: "tenant",
      readOnly: true,
      linked: true,
      operators: [serializeOperator(own, gate)],
    });
  }

  // Platform scope (SUPER_ADMIN).
  const operators = await db.ciiOperator.findMany({
    where: { isActive: true },
    orderBy: { createdAt: "asc" },
    include: {
      mous: { orderBy: [{ version: "desc" }] },
      authorizations: { orderBy: { createdAt: "desc" } },
      systems: { orderBy: { createdAt: "asc" } },
      // link name for operators onboarded as tenants
    },
  });

  const orgs = await db.organization.findMany({ select: { id: true, name: true } });
  const orgName = new Map(orgs.map((o) => [o.id, o.name]));

  const serialized = operators.map((op) => {
    const gate = evaluateCiiGate({ id: op.id, code: op.code }, op.mous, op.authorizations);
    const row = serializeOperator(op, gate);
    return { ...row, tenantName: op.orgId ? orgName.get(op.orgId) ?? null : null };
  });

  const now = new Date();
  return NextResponse.json({
    scope: "platform",
    readOnly: false,
    generatedAt: now.toISOString(),
    summary: {
      operators: serialized.length,
      gatesOpen: serialized.filter((o) => o.gate.gateOpen).length,
      systemsTotal: serialized.reduce((a, o) => a + o.systems.length, 0),
      systemsMonitoring: serialized.reduce(
        (a, o) => a + o.systems.filter((s) => s.readiness === "MONITORING_AUTHORIZED").length,
        0
      ),
      mousInForce: serialized.filter((o) => o.gate.mouGate).length,
      insaInForce: serialized.filter((o) => o.gate.insaGate).length,
    },
    operators: serialized,
  });
}

function serializeOperator(
  op: {
    id: string;
    code: string;
    name: string;
    nameAm: string;
    sector: string;
    tier: string;
    orgId: string | null;
    contactEmail: string | null;
    mous: { id: string; version: number; status: string; scope: string; dataTerms: string | null; signedAt: Date | null; expiresAt: Date | null; notes: string | null; createdAt: Date; updatedAt: Date }[];
    authorizations: { id: string; reference: string | null; status: string; issuedAt: Date | null; expiresAt: Date | null; scope: string | null; notes: string | null; createdAt: Date; updatedAt: Date }[];
    systems: { id: string; name: string; nameAm: string | null; category: string; criticality: string; readiness: string; notes: string | null; createdAt: Date; updatedAt: Date }[];
  },
  gate: ReturnType<typeof evaluateCiiGate>
) {
  return {
    id: op.id,
    code: op.code,
    name: op.name,
    nameAm: op.nameAm,
    sector: op.sector,
    tier: op.tier,
    orgId: op.orgId,
    contactEmail: op.contactEmail,
    gate,
    mous: op.mous,
    authorizations: op.authorizations,
    systems: op.systems.map((s) => ({
      ...s,
      // Effective readiness: a system can only be "under monitoring" while
      // its operator's gate is open — if the MOU or INSA licence lapses,
      // monitoring is effectively suspended even though the record stands.
      effectiveReadiness: s.readiness === "MONITORING_AUTHORIZED" && !gate.gateOpen ? "SUSPENDED_GATE_SHUT" : s.readiness,
    })),
  };
}
