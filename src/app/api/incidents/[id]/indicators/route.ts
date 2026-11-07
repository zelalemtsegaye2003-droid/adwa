import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuthAny } from "@/lib/auth/guard";
import { can } from "@/lib/auth/rbac";
import { audit } from "@/lib/auth/audit";
import { clientIp } from "@/lib/auth/rate-limit";

export const runtime = "nodejs";

/**
 * POST /api/incidents/[id]/indicators — link a threat indicator to an
 * incident (the SOC ↔ threat-intel join). Tenant-isolated.
 * Body: { indicatorId }
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireAuthAny(req, ["soc:manage-org", "soc:manage-all"]);
  if (guard.error) return guard.error;
  const { user } = guard;

  const { id } = await ctx.params;
  const body = await req.json();
  if (typeof body.indicatorId !== "string" || !body.indicatorId) {
    return NextResponse.json({ error: "indicatorId is required." }, { status: 400 });
  }

  const incident = await db.incident.findUnique({ where: { id }, select: { id: true, ref: true, organizationId: true } });
  if (!incident) return NextResponse.json({ error: "Incident not found" }, { status: 404 });

  const isSuper = can(user.role, "soc:manage-all");
  if (!isSuper && incident.organizationId !== user.orgId) {
    return NextResponse.json({ error: "This incident belongs to another organization" }, { status: 403 });
  }

  const indicator = await db.threatIndicator.findUnique({
    where: { id: body.indicatorId },
    select: { id: true, type: true, value: true, category: true, organizationId: true, sharing: true },
  });
  if (!indicator) return NextResponse.json({ error: "Indicator not found" }, { status: 404 });

  // Visibility: an org user may link (a) their own indicators, (b) indicators
  // visible through the hub/national feed or a peer share, never another
  // tenant's P2P-only indicators that were not shared with them.
  if (!isSuper && indicator.organizationId && indicator.organizationId !== user.orgId && indicator.sharing === "P2P") {
    const shared = await db.indicatorShare.findFirst({
      where: { indicatorId: indicator.id, targetOrgId: user.orgId },
    });
    if (!shared) {
      return NextResponse.json({ error: "This indicator is not visible to your organization." }, { status: 403 });
    }
  }

  const link = await db.incidentIndicator.upsert({
    where: { incidentId_indicatorId: { incidentId: incident.id, indicatorId: indicator.id } },
    create: { incidentId: incident.id, indicatorId: indicator.id },
    update: {},
  });

  // Matching an indicator is a sighting — it refreshes the indicator.
  await db.threatIndicator.update({
    where: { id: indicator.id },
    data: { sightings: { increment: 1 }, lastSeenAt: new Date() },
  });

  await audit({
    type: "INCIDENT_STATUS_CHANGED",
    userId: user.id,
    email: user.email,
    organizationId: incident.organizationId,
    ip: clientIp(req.headers),
    userAgent: req.headers.get("user-agent"),
    detail: `Incident ${incident.ref}: matched ${indicator.type} ${indicator.value} (${indicator.category}) from the threat-intel hub`,
  });

  return NextResponse.json({ link }, { status: 201 });
}
