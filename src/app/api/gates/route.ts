import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth/guard";
import { GATE_PHASES, phaseReadiness, type GatePhase } from "@/lib/governance/gates";

export const runtime = "nodejs";

const PHASE_META: Record<GatePhase, { label: string; labelAm: string; instrument: string }> = {
  P4_ACFS: {
    label: "Phase 4 — ACFS (content filtering)",
    labelAm: "ምዕራፍ 4 — ACFS (የይዘት ማጣሪያ)",
    instrument: "Advanced Content Filtering System — gated expansion (roadmap risk R11)",
  },
  P5_CII: {
    label: "Phase 5 — CII protection",
    labelAm: "ምዕራፍ 5 — የCII ጥበቃ",
    instrument: "Critical-infrastructure monitoring for EEP, Ethiopian Airlines, Ethio Telecom, CBE",
  },
};

/**
 * GET /api/gates — Track C gate-criteria board (proposal Phases 4–5).
 * Platform-level governance: SUPER_ADMIN only. Commercial tenants get 403 —
 * gate state is the venture's institutional posture, not tenant data.
 */
export async function GET(req: NextRequest) {
  const guard = await requireAuth(req, "governance:view");
  if (guard.error) return guard.error;

  const gates = await db.expansionGate.findMany({
    where: { phase: { in: [...GATE_PHASES] } },
    orderBy: [{ phase: "asc" }, { code: "asc" }],
    include: {
      updatedBy: { select: { name: true, email: true } },
      evidence: {
        orderBy: { createdAt: "desc" },
        include: { uploadedBy: { select: { name: true } } },
      },
      _count: { select: { events: true } },
    },
  });

  const phases = GATE_PHASES.map((p) => {
    const criteria = gates.filter((g) => g.phase === p);
    return {
      phase: p,
      ...PHASE_META[p],
      readiness: phaseReadiness(p, criteria),
      criteria: criteria.map((g) => ({
        id: g.id,
        code: g.code,
        titleEn: g.titleEn,
        titleAm: g.titleAm,
        detailEn: g.detailEn,
        detailAm: g.detailAm,
        category: g.category,
        status: g.status,
        blocking: g.blocking,
        notes: g.notes,
        targetDate: g.targetDate,
        updatedBy: g.updatedBy ? { name: g.updatedBy.name } : null,
        updatedAt: g.updatedAt,
        evidence: g.evidence.map((e) => ({
          id: e.id,
          fileName: e.fileName,
          description: e.description,
          mimeType: e.mimeType,
          fileSize: e.fileSize,
          checksum: e.checksum,
          uploadedBy: e.uploadedBy ? { name: e.uploadedBy.name } : null,
          createdAt: e.createdAt,
        })),
        eventCount: g._count.events,
      })),
    };
  });

  // Track C posture: nothing deploys while any phase gate is closed.
  const anyOpen = phases.some((p) => p.readiness.open);
  return NextResponse.json({
    scope: "platform",
    phases,
    trackC: {
      anyGateOpen: anyOpen,
      deploymentAllowed: anyOpen,
      policy:
        "No ACFS deployment without the EMA partnership, EHRC-engaged due diligence, and the transparency framework verbatim; no CII monitoring without operator MOUs, confirmed authorisation, and insurance.",
    },
  });
}
