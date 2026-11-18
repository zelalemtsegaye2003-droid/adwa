import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuthAny, parseBody } from "@/lib/auth/guard";
import { audit } from "@/lib/auth/audit";
import { clientIp } from "@/lib/auth/rate-limit";
import { appendVaptAudit } from "@/lib/vapt-audit";
import { scopeIsLive } from "@/lib/vapt-scope";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

/** GET /api/vapt/scopes/[id] — scope detail with live/four-eyes state. */
export async function GET(req: NextRequest, { params }: Params) {
  const guard = await requireAuthAny(req, ["vapt:view-org", "vapt:view-all"]);
  if (guard.error) return guard.error;
  const { user } = guard;
  const { id } = await params;

  const scope = await db.vaptScope.findUnique({
    where: { id },
    include: {
      requestedBy: { select: { id: true, email: true, name: true } },
      approvedBy: { select: { id: true, email: true, name: true } },
      organization: { select: { id: true, name: true } },
    },
  });
  if (!scope) return NextResponse.json({ error: "Scope not found" }, { status: 404 });
  const isSuper = user.role === "SUPER_ADMIN";
  if (!isSuper && user.orgId !== scope.organizationId) {
    return NextResponse.json({ error: "Not your organization's scope" }, { status: 403 });
  }
  return NextResponse.json({
    scope: { ...scope, fourEyes: !!scope.approvedById && scope.approvedById !== scope.requestedById, live: scopeIsLive(scope) },
  });
}

interface PatchBody {
  action?: string; // "approve" | "reject"
  reason?: string;
  intrusiveAllowed?: boolean;
}

function patchSchema(data: unknown): PatchBody | null {
  if (typeof data !== "object" || data === null) return null;
  const d = data as Record<string, unknown>;
  if (d.action !== "approve" && d.action !== "reject") return null;
  return {
    action: d.action,
    reason: typeof d.reason === "string" ? d.reason.trim().slice(0, 400) : undefined,
    intrusiveAllowed: d.intrusiveAllowed === true,
  };
}

/**
 * PATCH /api/vapt/scopes/[id] — four-eyes decision on a DRAFT scope.
 *
 *  approve: only a DIFFERENT user than the requester may approve (plan §1:
 *  "explicit approval from a second user"). The approver may also grant the
 *  intrusive opt-in — the only place that flag can be set.
 *  reject:  any second user (or the requester withdrawing their own request).
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  const guard = await requireAuthAny(req, ["vapt:manage-org", "vapt:manage-all"]);
  if (guard.error) return guard.error;
  const { user } = guard;
  const { id } = await params;

  const parsed = await parseBody(req, patchSchema);
  if (parsed.error) return parsed.error;
  const body = parsed.data;

  const scope = await db.vaptScope.findUnique({ where: { id } });
  if (!scope) return NextResponse.json({ error: "Scope not found" }, { status: 404 });
  const isSuper = user.role === "SUPER_ADMIN";
  if (!isSuper && user.orgId !== scope.organizationId) {
    return NextResponse.json({ error: "Not your organization's scope" }, { status: 403 });
  }
  if (scope.status !== "DRAFT") {
    return NextResponse.json({ error: `Scope is already ${scope.status}` }, { status: 409 });
  }

  if (body.action === "approve") {
    // ── FOUR-EYES: the approver must differ from the requester ──────────
    if (scope.requestedById === user.id) {
      await appendVaptAudit({
        type: "SCOPE_REJECTED",
        actorId: user.id,
        actorEmail: user.email,
        organizationId: scope.organizationId,
        target: scope.name,
        action: `Self-approval attempt on scope "${scope.name}" blocked`,
        result: "rejected — four-eyes requires a different approver",
        payload: { scopeId: scope.id },
      });
      return NextResponse.json(
        { error: "Four-eyes rule: you cannot approve a scope you requested — a second user must approve it." },
        { status: 403 }
      );
    }
    const updated = await db.vaptScope.update({
      where: { id },
      data: {
        status: "APPROVED",
        approvedById: user.id,
        approvedAt: new Date(),
        ...(body.intrusiveAllowed === true ? { intrusiveAllowed: true } : {}),
      },
    });
    await appendVaptAudit({
      type: "SCOPE_APPROVED",
      actorId: user.id,
      actorEmail: user.email,
      organizationId: scope.organizationId,
      target: scope.name,
      action: `Authorization scope "${scope.name}" approved by a second user (four-eyes satisfied)`,
      result: `APPROVED${body.intrusiveAllowed ? " with the intrusive opt-in" : ""}`,
      payload: { scopeId: scope.id, approver: user.email, intrusiveAllowed: body.intrusiveAllowed === true },
    });
    await audit({
      type: "VAPT_SCOPE_APPROVED",
      userId: user.id,
      email: user.email,
      organizationId: scope.organizationId,
      ip: clientIp(req.headers),
      userAgent: req.headers.get("user-agent"),
      detail: `VAPT scope "${scope.name}" approved by ${user.email} (four-eyes).`,
    });
    return NextResponse.json({ scope: updated });
  }

  // reject
  if (scope.requestedById !== user.id && !isSuper) {
    return NextResponse.json({ error: "Only the requesting user or a platform admin may withdraw a draft scope." }, { status: 403 });
  }
  const updated = await db.vaptScope.update({
    where: { id },
    data: { status: "REJECTED", rejectReason: body.reason ?? "withdrawn" },
  });
  await appendVaptAudit({
    type: "SCOPE_REJECTED",
    actorId: user.id,
    actorEmail: user.email,
    organizationId: scope.organizationId,
    target: scope.name,
    action: `Authorization scope "${scope.name}" rejected/withdrawn`,
    result: body.reason ?? "withdrawn",
    payload: { scopeId: scope.id },
  });
  await audit({
    type: "VAPT_SCOPE_REJECTED",
    userId: user.id,
    email: user.email,
    organizationId: scope.organizationId,
    ip: clientIp(req.headers),
    userAgent: req.headers.get("user-agent"),
    detail: `VAPT scope "${scope.name}" rejected/withdrawn by ${user.email}.`,
  });
  return NextResponse.json({ scope: updated });
}
