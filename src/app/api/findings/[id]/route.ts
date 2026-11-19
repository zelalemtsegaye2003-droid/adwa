import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuthAny } from "@/lib/auth/guard";
import { can } from "@/lib/auth/rbac";
import { audit } from "@/lib/auth/audit";
import { clientIp } from "@/lib/auth/rate-limit";
import { slaInfo, slaClosureNote } from "@/lib/compliance/sla";

const VALID = ["open", "in_progress", "remediated", "waived"];

/**
 * PATCH /api/findings/[id] — update remediation status (tenant-isolated).
 * A waiver is an accountability event: it requires a justification note,
 * and every transition is written to the audit trail with old → new status.
 *
 * Body: { status, note? } — note REQUIRED when status = "waived".
 */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireAuthAny(req, ["findings:manage-org", "findings:manage-all"]);
  if (guard.error) return guard.error;
  const { user } = guard;

  const { id } = await ctx.params;
  const body = await req.json();
  if (!VALID.includes(body.status)) {
    return NextResponse.json({ error: `status must be one of ${VALID.join(", ")}` }, { status: 400 });
  }

  const note = typeof body.note === "string" ? body.note.trim().slice(0, 500) : "";
  if (body.status === "waived" && note.length < 5) {
    return NextResponse.json(
      { error: "A waiver requires a justification note (at least 5 characters)." },
      { status: 400 }
    );
  }

  const existing = await db.scanResult.findUnique({
    where: { id },
    include: {
      rule: { select: { code: true, titleEn: true, severity: true } },
      scan: { select: { organizationId: true, name: true } },
    },
  });
  if (!existing) return NextResponse.json({ error: "Finding not found" }, { status: 404 });

  const isSuper = can(user.role, "findings:manage-all");
  if (!isSuper && existing.scan.organizationId !== user.orgId) {
    return NextResponse.json({ error: "This finding belongs to another organization" }, { status: 403 });
  }

  const now = new Date();
  // SLA bookkeeping:
  //  - closing as remediated stamps remediatedAt (on-time vs late is then provable)
  //  - reopening clears the stamp so a fresh closure re-measures honestly
  const patch: { status: string; remediatedAt?: Date | null } = { status: body.status };
  if (body.status === "remediated" && existing.status !== "remediated") {
    patch.remediatedAt = now;
  } else if (body.status !== "remediated" && existing.status === "remediated") {
    patch.remediatedAt = null;
  }

  const result = await db.scanResult.update({
    where: { id },
    data: patch,
    include: { rule: true, scan: { include: { organization: true } } },
  });

  // VAPT Center reverse sync: when this row mirrors a promoted VAPT
  // vulnerability, the vulnerability record follows the supervisor's status
  // change here (waived ↔ risk-accepted) so both queues always agree.
  if (existing.vaptVulnerabilityId) {
    await db.vaptVulnerability
      .update({
        where: { id: existing.vaptVulnerabilityId },
        data: {
          status: body.status === "waived" ? "accepted" : body.status,
          ...(patch.remediatedAt !== undefined ? { remediatedAt: patch.remediatedAt } : {}),
        },
      })
      .catch(() => { /* the VAPT record may have been deleted with its asset */ });
  }

  if (existing.status !== body.status) {
    const sla = slaInfo({
      status: body.status,
      dueAt: result.dueAt,
      remediatedAt: result.remediatedAt,
      now,
    });
    await audit({
      type: "FINDING_STATUS_CHANGED",
      userId: user.id,
      email: user.email,
      organizationId: existing.scan.organizationId,
      ip: clientIp(req.headers),
      userAgent: req.headers.get("user-agent"),
      detail: `Finding ${existing.rule.code} (${existing.rule.titleEn}) on "${existing.scan.name}": ${existing.status} → ${body.status}`
        + (body.status === "remediated" ? ` — ${slaClosureNote(sla)}` : "")
        + (note ? ` — note: ${note}` : ""),
    });
  }

  return NextResponse.json({ result });
}

/** GET /api/findings/[id] — finding detail (tenant-isolated). */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireAuthAny(req, ["findings:view-org", "findings:view-all"]);
  if (guard.error) return guard.error;
  const { user } = guard;

  const { id } = await ctx.params;
  const result = await db.scanResult.findUnique({
    where: { id },
    include: { rule: true, scan: { include: { organization: true } } },
  });
  if (!result) return NextResponse.json({ error: "Finding not found" }, { status: 404 });

  const isSuper = can(user.role, "findings:view-all");
  if (!isSuper && result.scan.organizationId !== user.orgId) {
    return NextResponse.json({ error: "This finding belongs to another organization" }, { status: 403 });
  }

  return NextResponse.json({ result });
}
