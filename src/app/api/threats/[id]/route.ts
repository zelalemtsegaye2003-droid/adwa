import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuthAny } from "@/lib/auth/guard";
import { can } from "@/lib/auth/rbac";
import { audit } from "@/lib/auth/audit";
import { clientIp } from "@/lib/auth/rate-limit";

export const runtime = "nodejs";

/**
 * PATCH /api/threats/[id] — update an indicator (owner org or SUPER_ADMIN).
 * Updatable: isActive (retire/reactivate), severity, confidence, description,
 * and `sighting: true` records a new sighting (refreshes lastSeenAt).
 */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireAuthAny(req, ["threats:contribute"]);
  if (guard.error) return guard.error;
  const { user } = guard;

  const { id } = await ctx.params;
  const body = await req.json();

  const existing = await db.threatIndicator.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Indicator not found" }, { status: 404 });

  const isSuper = can(user.role, "soc:manage-all");
  const isOwner = existing.organizationId === user.orgId;
  // National-feed indicators may only be edited by the platform (SUPER_ADMIN).
  if (!isSuper && (!isOwner || existing.organizationId === null)) {
    return NextResponse.json({ error: "Only the contributing organisation or the platform can edit this indicator." }, { status: 403 });
  }

  const patch: Record<string, unknown> = {};
  const changes: string[] = [];

  if (typeof body.isActive === "boolean" && body.isActive !== existing.isActive) {
    patch.isActive = body.isActive;
    changes.push(body.isActive ? "reactivated" : "retired");
  }
  if (["critical", "high", "medium", "low"].includes(body.severity) && body.severity !== existing.severity) {
    patch.severity = body.severity;
    changes.push(`severity ${existing.severity} → ${body.severity}`);
  }
  if (typeof body.confidence === "number") {
    const c = Math.max(0, Math.min(100, Math.round(body.confidence)));
    if (c !== existing.confidence) {
      patch.confidence = c;
      changes.push(`confidence ${existing.confidence} → ${c}`);
    }
  }
  if (typeof body.descriptionEn === "string" && body.descriptionEn.trim() && body.descriptionEn.trim() !== existing.descriptionEn) {
    patch.descriptionEn = body.descriptionEn.trim().slice(0, 1000);
    changes.push("description updated");
  }

  if (body.sighting === true) {
    patch.sightings = { increment: 1 };
    patch.lastSeenAt = new Date();
    changes.push("sighting recorded");
  }

  if (!Object.keys(patch).length) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const indicator = await db.threatIndicator.update({ where: { id }, data: patch });

  await audit({
    type: "THREAT_UPDATED",
    userId: user.id,
    email: user.email,
    organizationId: existing.organizationId,
    ip: clientIp(req.headers),
    userAgent: req.headers.get("user-agent"),
    detail: `Indicator ${existing.type} ${existing.value}: ${changes.join("; ") || "updated"}`,
  });

  return NextResponse.json({ indicator });
}

/** GET /api/threats/[id] — indicator detail with its share records. */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireAuthAny(req, ["threats:view"]);
  if (guard.error) return guard.error;
  const { user } = guard;

  const { id } = await ctx.params;
  const indicator = await db.threatIndicator.findUnique({
    where: { id },
    include: {
      organization: { select: { id: true, name: true } },
      shares: { include: { targetOrg: { select: { name: true } }, sharedBy: { select: { name: true } } }, orderBy: { createdAt: "desc" } },
      incidents: { include: { incident: { select: { ref: true, title: true, status: true, severity: true } } } },
    },
  });
  if (!indicator) return NextResponse.json({ error: "Indicator not found" }, { status: 404 });

  const isSuper = can(user.role, "soc:view-all");
  const isOwner = indicator.organizationId === user.orgId;
  if (!isSuper) {
    const visible =
      indicator.organizationId === null ||
      isOwner ||
      indicator.sharing === "HUB" ||
      indicator.shares.some((s) => s.mode === "PEER_DIRECT" && s.targetOrgId === user.orgId);
    if (!visible) {
      return NextResponse.json({ error: "This indicator is not visible to your organization." }, { status: 403 });
    }
  }

  // Anonymise the origin for non-owners on hub shares.
  const revealOrigin = isSuper || isOwner || !indicator.organizationId;
  return NextResponse.json({
    indicator: {
      ...indicator,
      organizationId: revealOrigin ? indicator.organizationId : null,
      organization: revealOrigin ? indicator.organization : null,
      origin: revealOrigin ? (indicator.organization?.name ?? "Ethio-CERT national feed") : "A member organisation",
    },
  });
}
