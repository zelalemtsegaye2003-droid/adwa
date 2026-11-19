import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth/guard";
import { evaluateAcfsGate, ACFS_DOMAIN_META } from "@/lib/governance/acfs-gates";

export const runtime = "nodejs";

/**
 * GET /api/acfs/overview — the ACFS gating dashboard feed (proposal Phase 4).
 * SUPER_ADMIN only: governance records are never exposed to tenants.
 * Returns the precondition register grouped by the four gate domains, the
 * evaluated gate state, and the recent gate decisions.
 */
export async function GET(req: NextRequest) {
  const guard = await requireAuth(req, "acfs:manage");
  if (guard.error) return guard.error;

  const [items, decisions] = await Promise.all([
    db.acfsGateItem.findMany({ orderBy: [{ domain: "asc" }, { sortOrder: "asc" }] }),
    db.acfsGateDecision.findMany({ orderBy: { createdAt: "desc" }, take: 10 }),
  ]);

  const evaluation = evaluateAcfsGate(items);

  const domains = evaluation.domains.map((d) => ({
    ...d,
    meta: ACFS_DOMAIN_META[d.domain],
    items: items
      .filter((i) => i.domain === d.domain)
      .map((i) => ({
        id: i.id,
        code: i.code,
        titleEn: i.titleEn,
        titleAm: i.titleAm,
        description: i.description,
        status: i.status,
        owner: i.owner,
        evidenceRef: i.evidenceRef,
        dueDate: i.dueDate,
        notes: i.notes,
        updatedAt: i.updatedAt,
      })),
  }));

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    gate: {
      verdict: evaluation.verdict,
      gateOpen: evaluation.gateOpen,
      progressPct: evaluation.progressPct,
      satisfiedItems: evaluation.satisfiedItems,
      totalItems: evaluation.totalItems,
      missingDomains: evaluation.missingDomains,
    },
    domains,
    decisions,
  });
}
