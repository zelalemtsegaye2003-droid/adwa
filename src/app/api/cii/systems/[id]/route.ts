import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth/guard";
import { audit } from "@/lib/auth/audit";
import { clientIp } from "@/lib/auth/rate-limit";
import { evaluateCiiGate, CII_SYSTEM_READINESS } from "@/lib/governance/cii-engine";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/**
 * PATCH /api/cii/systems/[id] — advance a registered system's readiness.
 *
 * ENFORCEMENT (the whole point of Phase 5's gating): advancing to
 * MONITORING_AUTHORIZED is only accepted when the operator's gate is OPEN —
 * i.e. an in-force MOU AND an in-force INSA authorisation. The server
 * re-evaluates both gates from the live register on every call; a request
 * to authorise monitoring for a gated operator is refused with 409 and
 * audited as CII_SYSTEM_AUTHORIZATION_BLOCKED.
 */
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const guard = await requireAuth(req, "cii:manage");
  if (guard.error) return guard.error;
  const { user } = guard;
  const { id } = await ctx.params;

  const existing = await db.ciiSystem.findUnique({ where: { id }, include: { operator: true } });
  if (!existing) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "System not found." } }, { status: 404 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: { code: "INVALID_JSON", message: "Request body must be valid JSON." } }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  if (typeof body.readiness === "string" && (CII_SYSTEM_READINESS as readonly string[]).includes(body.readiness)) {
    data.readiness = body.readiness;
  }
  if (typeof body.notes === "string") data.notes = body.notes.trim() || null;
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: { code: "EMPTY_UPDATE", message: "No updatable fields supplied." } }, { status: 400 });
  }

  // ── The gate ────────────────────────────────────────────────────────────
  if (data.readiness === "MONITORING_AUTHORIZED") {
    const [mous, auths] = await Promise.all([
      db.ciiMou.findMany({ where: { operatorId: existing.operatorId } }),
      db.ciiAuthorization.findMany({ where: { operatorId: existing.operatorId } }),
    ]);
    const gate = evaluateCiiGate({ id: existing.operatorId, code: existing.operator.code }, mous, auths);
    if (!gate.gateOpen) {
      await audit({
        type: "CII_SYSTEM_AUTHORIZATION_BLOCKED",
        userId: user.id,
        email: user.email,
        organizationId: user.orgId,
        ip: clientIp(req.headers),
        userAgent: req.headers.get("user-agent"),
        detail: `Monitoring authorisation for "${existing.name}" (${existing.operator.code}) REFUSED — unmet gates: ${gate.unmetGates.join(", ")}`,
      });
      return NextResponse.json(
        {
          error: {
            code: "GATE_SHUT",
            message: `Monitoring cannot be authorised for ${existing.operator.name}: unmet gates — ${gate.unmetGates.join(", ")}. An in-force MOU and an ACTIVE INSA authorisation are both required.`,
          },
        },
        { status: 409 }
      );
    }
  }

  const system = await db.ciiSystem.update({ where: { id }, data });

  if (data.readiness && data.readiness !== existing.readiness) {
    await audit({
      type: "CII_SYSTEM_UPDATED",
      userId: user.id,
      email: user.email,
      organizationId: user.orgId,
      ip: clientIp(req.headers),
      userAgent: req.headers.get("user-agent"),
      detail: `CII system "${existing.name}" (${existing.operator.code}): readiness ${existing.readiness} → ${String(data.readiness)}`,
    });
  }

  return NextResponse.json({ system });
}
