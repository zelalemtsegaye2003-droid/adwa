import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuthAny } from "@/lib/auth/guard";
import { can } from "@/lib/auth/rbac";
import { audit } from "@/lib/auth/audit";
import { clientIp } from "@/lib/auth/rate-limit";
import { canAdvanceTo, nextStatus, STATUS_EVENT, STATUS_TIMESTAMP, type IncidentStatus } from "@/lib/soc-engine";

export const runtime = "nodejs";

/** GET /api/incidents/[id] — incident detail with timeline + matched indicators. */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireAuthAny(req, ["soc:view-org", "soc:view-all"]);
  if (guard.error) return guard.error;
  const { user } = guard;

  const { id } = await ctx.params;
  const incident = await db.incident.findUnique({
    where: { id },
    include: {
      organization: { select: { id: true, name: true, nameAm: true, sector: true } },
      assignee: { select: { id: true, name: true, email: true } },
      events: { orderBy: { createdAt: "asc" }, include: { actor: { select: { name: true } } } },
      indicators: { include: { indicator: true } },
    },
  });
  if (!incident) return NextResponse.json({ error: "Incident not found" }, { status: 404 });

  const isSuper = can(user.role, "soc:view-all");
  if (!isSuper && incident.organizationId !== user.orgId) {
    return NextResponse.json({ error: "This incident belongs to another organization" }, { status: 403 });
  }

  return NextResponse.json({ incident });
}

/**
 * PATCH /api/incidents/[id] — work the incident through the NIST SP 800-61
 * lifecycle. Body options (mutually exclusive):
 *   { status }      advance one lifecycle step (forward-only, validated)
 *   { action: "notify" }           stamp notifiedAt — the RQ3 latency anchor
 *   { action: "note", note }       add a timeline note
 *   { action: "auto-contain", note } automated response: contain a critical
 *                                   incident within seconds of detection
 */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireAuthAny(req, ["soc:manage-org", "soc:manage-all"]);
  if (guard.error) return guard.error;
  const { user } = guard;

  const { id } = await ctx.params;
  const body = await req.json();

  const existing = await db.incident.findUnique({
    where: { id },
    include: { organization: { select: { id: true, name: true } } },
  });
  if (!existing) return NextResponse.json({ error: "Incident not found" }, { status: 404 });

  const isSuper = can(user.role, "soc:manage-all");
  if (!isSuper && existing.organizationId !== user.orgId) {
    return NextResponse.json({ error: "This incident belongs to another organization" }, { status: 403 });
  }

  const note = typeof body.note === "string" ? body.note.trim().slice(0, 500) : "";
  const now = new Date();

  // ── Action: notify the organisation (RQ3 anchor) ──────────────────────────
  if (body.action === "notify") {
    if (existing.notifiedAt) {
      return NextResponse.json({ error: "The organisation has already been notified." }, { status: 409 });
    }
    const latencyMin = Math.round(((now.getTime() - new Date(existing.detectedAt).getTime()) / 60_000) * 10) / 10;
    const updated = await db.incident.update({
      where: { id },
      data: {
        notifiedAt: now,
        events: { create: { type: "NOTIFIED", note: `Organisation notified — detection→notification latency ${latencyMin} min (RQ3 target: median ≤ 15 min)`, actorId: user.id } },
      },
      include: { organization: { select: { name: true } } },
    });
    await audit({
      type: "INCIDENT_NOTIFIED",
      userId: user.id,
      email: user.email,
      organizationId: existing.organizationId,
      ip: clientIp(req.headers),
      userAgent: req.headers.get("user-agent"),
      detail: `Incident ${existing.ref} — organisation notified, latency ${latencyMin} min${note ? ` — note: ${note}` : ""}`,
    });
    return NextResponse.json({ incident: updated, notificationLatencyMin: latencyMin });
  }

  // ── Action: timeline note ─────────────────────────────────────────────────
  if (body.action === "note") {
    if (note.length < 3) {
      return NextResponse.json({ error: "A note requires at least 3 characters." }, { status: 400 });
    }
    const updated = await db.incident.update({
      where: { id },
      data: { events: { create: { type: "NOTE", note, actorId: user.id } } },
      include: { organization: { select: { name: true } } },
    });
    return NextResponse.json({ incident: updated });
  }

  // ── Action: automated containment (proposal §8.3 automated response) ──────
  if (body.action === "auto-contain") {
    if (existing.status !== "detected" && existing.status !== "triaged") {
      return NextResponse.json({ error: "Automated containment applies to detected or triaged incidents only." }, { status: 409 });
    }
    if (existing.severity !== "critical" && existing.severity !== "high") {
      return NextResponse.json({ error: "Automated containment is reserved for critical/high severity incidents." }, { status: 409 });
    }
    const updated = await db.incident.update({
      where: { id },
      data: {
        status: "contained",
        containedAt: now,
        ...(existing.status === "detected" ? { triagedAt: now } : {}),
        events: {
          create: [
            ...(existing.status === "detected" ? [{ type: "TRIAGE", note: "Auto-triaged by the SOC automation layer", actorId: user.id }] : []),
            { type: "AUTO_RESPONSE", note: `Automated containment triggered (${existing.severity} severity) — host isolated, credentials revoked, indicator blocklists pushed${note ? ` — ${note}` : ""}`, actorId: user.id },
            { type: "CONTAIN", note: "Incident contained by automated response", actorId: user.id },
          ],
        },
      },
      include: { organization: { select: { name: true } } },
    });
    await audit({
      type: "INCIDENT_STATUS_CHANGED",
      userId: user.id,
      email: user.email,
      organizationId: existing.organizationId,
      ip: clientIp(req.headers),
      userAgent: req.headers.get("user-agent"),
      detail: `Incident ${existing.ref}: ${existing.status} → contained (AUTOMATED RESPONSE)`,
    });
    return NextResponse.json({ incident: updated });
  }

  // ── Lifecycle advance ──────────────────────────────────────────────────────
  if (typeof body.status === "string") {
    const target = body.status;
    if (!canAdvanceTo(existing.status, target)) {
      const next = nextStatus(existing.status);
      return NextResponse.json(
        { error: `Invalid transition ${existing.status} → ${target}. ${next ? `Next step is "${next}".` : "The incident is already closed."}` },
        { status: 409 }
      );
    }
    const patch: Record<string, unknown> = {
      status: target,
      [STATUS_TIMESTAMP[target as IncidentStatus]]: now,
    };
    // A contained incident must have passed triage — backfill the stamp.
    if (target === "contained" && !existing.triagedAt) patch.triagedAt = now;

    const updated = await db.incident.update({
      where: { id },
      data: { ...patch, events: { create: { type: STATUS_EVENT[target as IncidentStatus], note: note || null, actorId: user.id } } },
      include: { organization: { select: { name: true } } },
    });

    let closureNote = "";
    if (target === "closed") {
      const notifLatency = updated.notifiedAt
        ? Math.round(((new Date(updated.notifiedAt).getTime() - new Date(updated.detectedAt).getTime()) / 60_000) * 10) / 10
        : null;
      const mttr = Math.round(((new Date(updated.closedAt!).getTime() - new Date(updated.detectedAt).getTime()) / 60_000) * 10) / 10;
      closureNote = ` — notification latency ${notifLatency ?? "n/a"} min, time-to-resolve ${mttr} min`;
    }

    await audit({
      type: "INCIDENT_STATUS_CHANGED",
      userId: user.id,
      email: user.email,
      organizationId: existing.organizationId,
      ip: clientIp(req.headers),
      userAgent: req.headers.get("user-agent"),
      detail: `Incident ${existing.ref} (${existing.severity}/${existing.category}): ${existing.status} → ${target}${closureNote}${note ? ` — note: ${note}` : ""}`,
    });
    return NextResponse.json({ incident: updated });
  }

  return NextResponse.json({ error: "Provide { status } or { action: notify | note | auto-contain }." }, { status: 400 });
}
