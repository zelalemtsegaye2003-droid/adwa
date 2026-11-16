import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuthAny } from "@/lib/auth/guard";
import { can } from "@/lib/auth/rbac";
import { summariseVulns } from "@/lib/vapt-engine";

export const runtime = "nodejs";

/**
 * GET /api/vapt/overview — VAPT Center KPI block for one organization.
 * Org users always see their tenant; SUPER_ADMIN may pass ?org=<id> (default:
 * platform-wide aggregate across all tenants — the tender's management view).
 */
export async function GET(req: NextRequest) {
  const guard = await requireAuthAny(req, ["vapt:view-org", "vapt:view-all"]);
  if (guard.error) return guard.error;
  const { user } = guard;

  const isSuper = can(user.role, "vapt:view-all");
  const orgParam = req.nextUrl.searchParams.get("org") || "";
  const organizationId = isSuper ? orgParam || null : user.orgId;
  if (!isSuper && !organizationId) {
    return NextResponse.json(
      { error: { code: "ORG_REQUIRED", message: "Your account has no organization." } },
      { status: 400 }
    );
  }

  const scopeFilter = organizationId ? { organizationId } : {};
  const [assets, vulns, scans] = await Promise.all([
    db.vaptAsset.findMany({
      where: scopeFilter,
      select: {
        id: true, kind: true, environment: true, surface: true, criticality: true,
        managed: true, identifier: true, name: true, lastSeenAt: true,
      },
    }),
    db.vaptVulnerability.findMany({
      where: scopeFilter,
      include: { asset: { select: { id: true, name: true, kind: true, criticality: true, surface: true, environment: true } } },
    }),
    db.vaptScan.findMany({
      where: scopeFilter,
      orderBy: { startedAt: "desc" },
      take: 6,
      include: { organization: { select: { name: true } } },
    }),
  ]);

  const now = new Date();
  const summary = summariseVulns(vulns, now);
  const byKind: Record<string, number> = {};
  for (const a of assets) byKind[a.kind] = (byKind[a.kind] ?? 0) + 1;

  // Top risk register: open/in_progress, ordered by dynamic priority score.
  const open = vulns
    .filter((v) => v.status === "open" || v.status === "in_progress")
    .sort((a, b) => b.priorityScore - a.priorityScore)
    .slice(0, 10)
    .map((v) => ({
      id: v.id, cveId: v.cveId, title: v.title, severity: v.severity,
      cvssScore: v.cvssScore, epss: v.epss, kev: v.kev,
      priorityScore: v.priorityScore, priorityClass: v.priorityClass,
      status: v.status, dueAt: v.dueAt,
      asset: v.asset,
    }));

  const kevOpen = vulns.filter((v) => v.kev && (v.status === "open" || v.status === "in_progress"));

  return NextResponse.json({
    scope: isSuper ? (organizationId ? "org" : "platform") : "tenant",
    organizationId: organizationId ?? null,
    generatedAt: now,
    slaPolicy: { critical: 30, high: 60, medium: 90, low: 180, dueSoonWindowDays: 7 },
    assets: {
      total: assets.length,
      unmanaged: assets.filter((a) => !a.managed).length,
      external: assets.filter((a) => a.surface === "EXTERNAL").length,
      byKind,
    },
    vulnerabilities: summary,
    kevOpenCount: kevOpen.length,
    topRisk: open,
    recentScans: scans.map((s) => ({
      id: s.id, name: s.name, scanType: s.scanType, status: s.status,
      engineMode: s.engineMode, dastReal: s.dastReal,
      newCount: s.newCount, knownCount: s.knownCount, targetCount: s.targetCount,
      startedAt: s.startedAt, completedAt: s.completedAt,
      organization: s.organization?.name ?? null,
    })),
  });
}
