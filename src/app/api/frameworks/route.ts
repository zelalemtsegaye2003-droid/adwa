import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth/guard";

/**
 * GET /api/frameworks — the regulatory frameworks this platform can assess
 * against, with rule counts and pillar definitions (any authenticated user).
 */
export async function GET(req: NextRequest) {
  const guard = await requireAuth(req, "catalogue:view");
  if (guard.error) return guard.error;

  const frameworks = await db.framework.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    include: { _count: { select: { rules: true, scans: true } } },
  });

  return NextResponse.json({
    frameworks: frameworks.map((f) => ({
      id: f.id,
      code: f.code,
      name: f.name,
      nameAm: f.nameAm,
      issuer: f.issuer,
      instrument: f.instrument,
      instrumentNo: f.instrumentNo,
      descriptionEn: f.descriptionEn,
      descriptionAm: f.descriptionAm,
      pillars: JSON.parse(f.pillars) as { name: string; nameAm: string; weight: number }[],
      sectorScope: f.sectorScope,
      sourceUrl: f.sourceUrl,
      ruleCount: f._count.rules,
      scanCount: f._count.scans,
    })),
  });
}
