import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth/guard";
import { audit } from "@/lib/auth/audit";
import { clientIp } from "@/lib/auth/rate-limit";
import { GATE_PHASES, phaseReadiness, type GatePhase } from "@/lib/gates";
import { generateGateDossierPdf, type DossierPhase } from "@/lib/gate-dossier-pdf";

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
 * GET /api/gates/dossier?lang=en|am — the Track C Gate Dossier PDF.
 * The funder/regulator-facing governance record: posture, per-phase
 * readiness, every criterion with status + note, and the SHA-256 sealed
 * evidence register. Governance viewers (SUPER_ADMIN); every download is
 * audit-logged.
 */
export async function GET(req: NextRequest) {
  const guard = await requireAuth(req, "governance:view");
  if (guard.error) return guard.error;
  const { user } = guard;

  const lang = new URL(req.url).searchParams.get("lang") === "am" ? "am" : "en";

  const gates = await db.expansionGate.findMany({
    where: { phase: { in: [...GATE_PHASES] } },
    orderBy: [{ phase: "asc" }, { code: "asc" }],
    include: {
      updatedBy: { select: { name: true } },
      evidence: { orderBy: { createdAt: "desc" }, include: { uploadedBy: { select: { name: true } } } },
    },
  });

  const phases: DossierPhase[] = GATE_PHASES.map((p) => {
    const criteria = gates.filter((g) => g.phase === p);
    const readiness = phaseReadiness(p, criteria);
    return {
      phase: p,
      ...PHASE_META[p],
      readinessPct: readiness.readinessPct,
      satisfied: readiness.satisfied,
      total: readiness.total,
      open: readiness.open,
      criteria: criteria.map((g) => ({
        code: g.code,
        titleEn: g.titleEn,
        titleAm: g.titleAm,
        status: g.status,
        category: g.category,
        notes: g.notes,
        updatedAt: g.updatedAt,
        updatedByName: g.updatedBy?.name ?? null,
        evidence: g.evidence.map((e) => ({
          fileName: e.fileName,
          fileSize: e.fileSize,
          checksum: e.checksum,
          uploadedByName: e.uploadedBy?.name ?? null,
          createdAt: e.createdAt,
        })),
      })),
    };
  });

  const deploymentAllowed = phases.some((p) => p.open);
  const payload = {
    phases,
    policy:
      "No ACFS deployment without the EMA partnership, EHRC-engaged due diligence, and the transparency framework verbatim; no CII monitoring without operator MOUs, confirmed authorisation, and insurance.",
    deploymentAllowed,
    generatedAt: new Date(),
  };

  const { buffer } = await generateGateDossierPdf(payload, lang);

  await audit({
    type: "GATE_DOSSIER_EXPORTED",
    userId: user.id,
    email: user.email,
    organizationId: null, // platform-level governance record
    ip: clientIp(req.headers),
    userAgent: req.headers.get("user-agent"),
    detail: `Track C gate dossier exported (lang=${lang}, posture=${deploymentAllowed ? "OPEN" : "LOCKED"}).`,
  });

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="adwa-trackc-gate-dossier-${new Date().toISOString().slice(0, 10)}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
