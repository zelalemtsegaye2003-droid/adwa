import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth/guard";
import { audit } from "@/lib/auth/audit";
import { clientIp } from "@/lib/auth/rate-limit";
import { GATE_STATUSES, canTransitionGate } from "@/lib/governance/gates";

export const runtime = "nodejs";

/**
 * PATCH /api/gates/[id] — advance a Track C gate criterion.
 * Body: { status, note?, targetDate? }
 * Status progression is forward-only (NOT_STARTED → IN_PROGRESS → SATISFIED);
 * BLOCKED can be set from (and cleared back to IN_PROGRESS from) any state.
 * Accountability layer: SATISFIED requires ≥1 evidence artefact attached to
 * the criterion (a note alone is self-declared), and every change is written
 * to the per-criterion GateEvent timeline in addition to the platform
 * AuthEvent log — exactly the record a funder, regulator, or university
 * partner would ask to see.
 */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireAuth(req, "governance:manage");
  if (guard.error) return guard.error;
  const { user } = guard;
  const { id } = await ctx.params;

  const body = await req.json().catch(() => ({}));
  const status = String(body.status ?? "");
  if (!(GATE_STATUSES as readonly string[]).includes(status)) {
    return NextResponse.json(
      { error: { code: "BAD_STATUS", message: `status must be one of ${GATE_STATUSES.join(" | ")}.` } },
      { status: 400 }
    );
  }
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 1000) : null;
  const targetDate = body.targetDate && !isNaN(new Date(body.targetDate).getTime()) ? new Date(body.targetDate) : undefined;

  const gate = await db.expansionGate.findUnique({ where: { id } });
  if (!gate) return NextResponse.json({ error: { code: "NOT_FOUND", message: "Gate criterion not found." } }, { status: 404 });

  if (!canTransitionGate(gate.status, status)) {
    return NextResponse.json(
      {
        error: {
          code: "BAD_TRANSITION",
          message: `Invalid transition ${gate.status} → ${status}. Progression is forward-only (NOT_STARTED → IN_PROGRESS → SATISFIED); BLOCKED may be set or cleared at any time.`,
        },
      },
      { status: 409 }
    );
  }
  // Marking a criterion SATISFIED requires a note naming the evidence.
  if (status === "SATISFIED" && (!note || note.length < 10)) {
    return NextResponse.json(
      { error: { code: "NOTE_REQUIRED", message: "Satisfying a gate criterion requires a note (≥10 chars) naming the evidence: signed instrument, report reference, or funding letter." } },
      { status: 400 }
    );
  }
  // …and the artefact itself: self-declared satisfaction is not verifiable.
  if (status === "SATISFIED") {
    const evidenceCount = await db.gateEvidence.count({ where: { gateId: id } });
    if (evidenceCount < 1) {
      return NextResponse.json(
        {
          error: {
            code: "EVIDENCE_REQUIRED",
            message: `Satisfying a gate criterion requires at least one evidence artefact to be attached first (signed instrument, published report, or funding letter). ${gate.phase}/${gate.code} has none.`,
          },
        },
        { status: 409 }
      );
    }
  }

  const updated = await db.expansionGate.update({
    where: { id },
    data: {
      status,
      ...(note !== null ? { notes: note } : {}),
      ...(targetDate ? { targetDate } : {}),
      updatedById: user.id,
    },
  });

  // Append-only per-criterion timeline entry.
  await db.gateEvent.create({
    data: {
      gateId: id,
      actorId: user.id,
      kind: "STATUS_CHANGE",
      fromStatus: gate.status,
      toStatus: status,
      ...(note ? { note } : {}),
    },
  });

  await audit({
    type: "GATE_STATUS_CHANGED",
    userId: user.id,
    email: user.email,
    organizationId: null, // platform-level governance record
    ip: clientIp(req.headers),
    userAgent: req.headers.get("user-agent"),
    detail: `Track C gate ${gate.phase}/${gate.code}: ${gate.status} → ${status}${note ? ` — ${note.slice(0, 160)}` : ""}`,
  });

  return NextResponse.json({ gate: updated });
}
