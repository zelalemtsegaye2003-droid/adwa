import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuthAny } from "@/lib/auth/guard";
import { can } from "@/lib/auth/rbac";
import { audit } from "@/lib/auth/audit";
import { clientIp } from "@/lib/auth/rate-limit";
import { hybridSharingDecision } from "@/lib/soc-engine";

export const runtime = "nodejs";

/**
 * POST /api/threats/[id]/share — distribute an indicator through the hybrid
 * sharing model (AAU Collaborative Framework).
 *
 * Body: { mode: "HUB" }              → anonymised broadcast to all members
 *       { mode: "PEER", targetOrgId } → direct encrypted share with one
 *                                       trusted partner (identity-protected)
 *
 * The engine's recommendation is returned alongside the result; an analyst may
 * override it (e.g. force P2P for an especially sensitive indicator).
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireAuthAny(req, ["threats:contribute"]);
  if (guard.error) return guard.error;
  const { user } = guard;

  const { id } = await ctx.params;
  const body = await req.json();
  const mode = String(body.mode || "");

  const existing = await db.threatIndicator.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Indicator not found" }, { status: 404 });

  const isSuper = can(user.role, "soc:manage-all");
  // Only the contributing org (or the platform) may distribute an indicator.
  if (!isSuper && existing.organizationId !== user.orgId) {
    return NextResponse.json({ error: "Only the contributing organisation can share this indicator." }, { status: 403 });
  }
  if (existing.organizationId === null && !isSuper) {
    return NextResponse.json({ error: "National-feed indicators are distributed by the platform." }, { status: 403 });
  }

  const recommendation = hybridSharingDecision({
    tlp: existing.tlp,
    sensitivity: existing.sensitivity,
    category: existing.category,
  });

  if (mode === "HUB") {
    // Privacy-preserving broadcast: the origin is stripped, every member sees it.
    const share = await db.indicatorShare.create({
      data: {
        indicatorId: existing.id,
        mode: "HUB_BROADCAST",
        targetOrgId: null,
        sharedById: user.id,
        anonymised: true,
      },
    });
    const indicator = await db.threatIndicator.update({
      where: { id: existing.id },
      data: { sharing: "HUB" },
    });
    await audit({
      type: "THREAT_SHARED",
      userId: user.id,
      email: user.email,
      organizationId: existing.organizationId,
      ip: clientIp(req.headers),
      userAgent: req.headers.get("user-agent"),
      detail: `Indicator ${existing.type} ${existing.value} broadcast through the hub (anonymised, all member organisations)${recommendation.mode !== "HUB" ? " — analyst override of engine recommendation (P2P)" : ""}`,
    });
    return NextResponse.json({ share, indicator, recommendation, overridden: recommendation.mode !== "HUB" }, { status: 201 });
  }

  if (mode === "PEER") {
    const targetOrgId = typeof body.targetOrgId === "string" ? body.targetOrgId : "";
    if (!targetOrgId) {
      return NextResponse.json({ error: "Peer sharing requires targetOrgId." }, { status: 400 });
    }
    if (targetOrgId === existing.organizationId) {
      return NextResponse.json({ error: "The originating organisation already owns this indicator." }, { status: 400 });
    }
    const target = await db.organization.findUnique({ where: { id: targetOrgId }, select: { id: true, name: true, status: true } });
    if (!target) {
      return NextResponse.json({ error: "Target organisation not found." }, { status: 404 });
    }
    const dup = await db.indicatorShare.findFirst({
      where: { indicatorId: existing.id, mode: "PEER_DIRECT", targetOrgId },
    });
    if (dup) {
      return NextResponse.json({ error: `Already shared with ${target.name}.` }, { status: 409 });
    }
    const share = await db.indicatorShare.create({
      data: {
        indicatorId: existing.id,
        mode: "PEER_DIRECT",
        targetOrgId,
        sharedById: user.id,
        anonymised: false, // the trusted partner sees who reported it
      },
    });
    const indicator = await db.threatIndicator.update({
      where: { id: existing.id },
      data: { sharing: "P2P" },
    });
    await audit({
      type: "THREAT_SHARED",
      userId: user.id,
      email: user.email,
      organizationId: existing.organizationId,
      ip: clientIp(req.headers),
      userAgent: req.headers.get("user-agent"),
      detail: `Indicator ${existing.type} ${existing.value} shared peer-to-peer with ${target.name} (identity-revealing, TLP ${existing.tlp})`,
    });
    return NextResponse.json({ share, indicator, recommendation, overridden: recommendation.mode !== "P2P" }, { status: 201 });
  }

  return NextResponse.json({ error: 'mode must be "HUB" or "PEER".' }, { status: 400 });
}
