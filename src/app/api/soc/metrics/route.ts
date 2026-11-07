import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuthAny } from "@/lib/auth/guard";
import { can } from "@/lib/auth/rbac";
import {
  notificationLatency, lifecycleTimes, predictThreats, RQ3_TARGET_MINUTES,
} from "@/lib/soc-engine";

export const runtime = "nodejs";

/**
 * GET /api/soc/metrics — the 24/7 SOC dashboard feed.
 * Tenant users get their organisation; SUPER_ADMIN gets the platform-wide
 * view (optionally ?org=<id>). Carries the RQ3 commitment (median
 * detection→notification < 15 min for financial institutions) and the RQ4
 * availability posture of the pilot.
 */
export async function GET(req: NextRequest) {
  const guard = await requireAuthAny(req, ["soc:view-org", "soc:view-all"]);
  if (guard.error) return guard.error;
  const { user } = guard;

  const isSuper = can(user.role, "soc:view-all");
  const sp = req.nextUrl.searchParams;
  const orgParam = sp.get("org") || "";
  const organizationId = isSuper ? orgParam || null : user.orgId;
  if (!isSuper && !organizationId) {
    return NextResponse.json({ error: { code: "ORG_REQUIRED", message: "Your account has no organization." } }, { status: 400 });
  }

  const orgScope = organizationId
    ? await db.organization.findUnique({ where: { id: organizationId }, select: { id: true, name: true, sector: true } })
    : null;

  const [incidents, activeIndicators, recentSyncs, shareCounts] = await Promise.all([
    db.incident.findMany({
      where: organizationId ? { organizationId } : {},
      select: {
        id: true, ref: true, status: true, severity: true, category: true,
        detectedAt: true, notifiedAt: true, triagedAt: true, containedAt: true, closedAt: true,
        priorityScore: true, priorityLabel: true,
      },
    }),
    db.threatIndicator.findMany({
      where: { isActive: true },
      select: { category: true, severity: true, source: true, sharing: true, organizationId: true },
    }),
    db.syncRun.findMany({
      where: organizationId ? { organizationId } : {},
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, direction: true, ingested: true, updated: true, reported: true, createdAt: true, detail: true },
    }),
    db.indicatorShare.groupBy({
      by: ["mode"],
      _count: { _all: true },
    }),
  ]);

  // Indicator visibility mirrors the hybrid sharing model for org users.
  const visibleIndicators = isSuper
    ? activeIndicators
    : activeIndicators.filter((i) => !i.organizationId || i.organizationId === user.orgId || i.sharing === "HUB");

  const open = incidents.filter((i) => i.status !== "closed");
  const byStatus: Record<string, number> = {};
  const bySeverityOpen: Record<string, number> = {};
  for (const i of incidents) byStatus[i.status] = (byStatus[i.status] ?? 0) + 1;
  for (const i of open) bySeverityOpen[i.severity] = (bySeverityOpen[i.severity] ?? 0) + 1;

  const latency = notificationLatency(incidents);
  const times = lifecycleTimes(incidents);
  const forecast = predictThreats(
    orgScope?.sector ?? "Banking",
    visibleIndicators,
    incidents.slice(0, 50)
  );

  // Share pipeline: hub broadcasts vs peer-direct grants.
  const shares = { hub: 0, peer: 0 };
  for (const g of shareCounts) {
    if (g.mode === "HUB_BROADCAST") shares.hub = g._count._all;
    if (g.mode === "PEER_DIRECT") shares.peer = g._count._all;
  }

  // Sources feeding the hub right now.
  const bySource: Record<string, number> = {};
  for (const i of visibleIndicators) bySource[i.source] = (bySource[i.source] ?? 0) + 1;

  return NextResponse.json({
    scope: isSuper ? (organizationId ? "org" : "platform") : "tenant",
    organization: orgScope,
    generatedAt: new Date().toISOString(),
    incidents: {
      total: incidents.length,
      open: open.length,
      byStatus,
      openBySeverity: bySeverityOpen,
      immediate: open.filter((i) => i.priorityLabel === "IMMEDIATE").length,
    },
    rq3: {
      target: "Median detection→notification < 15 minutes (financial institutions)",
      targetMinutes: RQ3_TARGET_MINUTES,
      latency,
      financialSector: (orgScope?.sector ?? "Banking") === "Banking" || (orgScope?.sector ?? "") === "Microfinance",
    },
    lifecycle: times,
    threatIntel: {
      activeIndicators: visibleIndicators.length,
      bySource,
      shares,
    },
    forecast: forecast.slice(0, 5),
    recentSyncs,
  });
}
