import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, parseBody } from "@/lib/auth/guard";
import { audit } from "@/lib/auth/audit";
import { clientIp } from "@/lib/auth/rate-limit";
import { evaluateAcfsGate } from "@/lib/governance/acfs-gates";

export const runtime = "nodejs";

/**
 * POST /api/acfs/decision — record a governance decision on the ACFS gate.
 *
 *   decision = "REMAINED_LOCKED"  periodic review confirming the gate stays
 *                                  shut until preconditions are satisfied.
 *   decision = "UNLOCKED"         only accepted when EVERY precondition in
 *                                  ALL FOUR domains is SATISFIED. The server
 *                                  re-evaluates the register itself — an
 *                                  UNLOCKED decision can never be recorded
 *                                  while a single item is unmet.
 */
export async function POST(req: NextRequest) {
  const guard = await requireAuth(req, "acfs:manage");
  if (guard.error) return guard.error;
  const { user } = guard;

  const parsed = await parseBody(req, (raw) => {
    if (typeof raw !== "object" || raw === null) return null;
    const b = raw as Record<string, unknown>;
    if (b.decision !== "REMAINED_LOCKED" && b.decision !== "UNLOCKED") return null;
    if (typeof b.rationale !== "string" || b.rationale.trim().length < 10) return null;
    return { decision: b.decision as string, rationale: b.rationale.trim() };
  });
  if (parsed.error) return parsed.error;
  const { decision, rationale } = parsed.data;

  const items = await db.acfsGateItem.findMany({ select: { domain: true, status: true } });
  const evaluation = evaluateAcfsGate(items);

  // Server-side gate enforcement: an UNLOCKED decision is only valid when
  // the register itself evaluates to an open gate.
  if (decision === "UNLOCKED" && !evaluation.gateOpen) {
    await audit({
      type: "ACFS_UNLOCK_BLOCKED",
      userId: user.id,
      email: user.email,
      organizationId: user.orgId,
      ip: clientIp(req.headers),
      userAgent: req.headers.get("user-agent"),
      detail: `UNLOCKED decision rejected — unmet domains: ${evaluation.missingDomains.join(", ")} (${evaluation.satisfiedItems}/${evaluation.totalItems} satisfied)`,
    });
    return NextResponse.json(
      {
        error: {
          code: "GATE_NOT_OPEN",
          message: `The gate cannot be unlocked: ${evaluation.satisfiedItems} of ${evaluation.totalItems} preconditions are satisfied. Unmet domains: ${evaluation.missingDomains.join(", ")}.`,
        },
      },
      { status: 409 }
    );
  }

  const record = await db.acfsGateDecision.create({
    data: {
      decision,
      rationale,
      decidedBy: `${user.name} (${user.role})`,
    },
  });

  await audit({
    type: "ACFS_GATE_DECISION",
    userId: user.id,
    email: user.email,
    organizationId: user.orgId,
    ip: clientIp(req.headers),
    userAgent: req.headers.get("user-agent"),
    detail: `ACFS gate decision: ${decision} — ${evaluation.satisfiedItems}/${evaluation.totalItems} preconditions satisfied`,
  });

  return NextResponse.json({ decision: record, evaluation }, { status: 201 });
}
