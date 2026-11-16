import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuthAny, parseBody } from "@/lib/auth/guard";
import { can } from "@/lib/auth/rbac";
import { audit } from "@/lib/auth/audit";
import { clientIp } from "@/lib/auth/rate-limit";
import { slaInfo, slaClosureNote } from "@/lib/sla";

export const runtime = "nodejs";

const VALID = ["open", "in_progress", "remediated", "accepted"];

/** GET /api/vapt/vulnerabilities/[id] — finding detail with evidence bundle. */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireAuthAny(req, ["vapt:view-org", "vapt:view-all"]);
  if (guard.error) return guard.error;
  const { user } = guard;
  const { id } = await ctx.params;

  const v = await db.vaptVulnerability.findUnique({
    where: { id },
    include: {
      asset: { select: { id: true, name: true, kind: true, identifier: true, criticality: true, surface: true, environment: true, osOrPlatform: true } },
      organization: { select: { id: true, name: true } },
    },
  });
  if (!v) return NextResponse.json({ error: "Vulnerability not found" }, { status: 404 });
  const isSuper = can(user.role, "vapt:view-all");
  if (!isSuper && v.organizationId !== user.orgId) {
    return NextResponse.json({ error: "This vulnerability belongs to another organization" }, { status: 403 });
  }
  const mapped = v.status === "accepted" ? "waived" : v.status;
  const info = slaInfo({ status: mapped, dueAt: v.dueAt, remediatedAt: v.remediatedAt });
  return NextResponse.json({
    vulnerability: { ...v, evidence: v.evidence ? JSON.parse(v.evidence) : null },
    sla: info,
  });
}

interface PatchBody {
  status?: string;
  note?: string;
}

function patchSchema(data: unknown): PatchBody | null {
  if (typeof data !== "object" || data === null) return null;
  const d = data as Record<string, unknown>;
  if (d.status !== undefined && typeof d.status !== "string") return null;
  if (d.note !== undefined && typeof d.note !== "string") return null;
  return { status: d.status as string | undefined, note: typeof d.note === "string" ? d.note : undefined };
}

/**
 * PATCH /api/vapt/vulnerabilities/[id] — remediation workflow.
 * open → in_progress → remediated (stamps closure time)
 * accepted = risk acceptance — REQUIRES a justification note (like the
 * findings-module waiver: an accountability event, audited, never silent).
 * When the finding has been promoted into the Findings module, the mirror
 * ScanResult row is kept in sync (single source of truth for supervisors).
 */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireAuthAny(req, ["vapt:manage-org", "vapt:manage-all"]);
  if (guard.error) return guard.error;
  const { user } = guard;
  const { id } = await ctx.params;

  const parsed = await parseBody(req, patchSchema);
  if (parsed.error) return parsed.error;
  const body = parsed.data;

  if (!body.status || !VALID.includes(body.status)) {
    return NextResponse.json({ error: `status must be one of ${VALID.join(", ")}` }, { status: 400 });
  }
  const note = (body.note ?? "").trim().slice(0, 500);
  if (body.status === "accepted" && note.length < 5) {
    return NextResponse.json(
      { error: "Risk acceptance requires a justification note (at least 5 characters)." },
      { status: 400 }
    );
  }

  const existing = await db.vaptVulnerability.findUnique({
    where: { id },
    include: { asset: { select: { name: true } } },
  });
  if (!existing) return NextResponse.json({ error: "Vulnerability not found" }, { status: 404 });
  const isSuper = can(user.role, "vapt:manage-all");
  if (!isSuper && existing.organizationId !== user.orgId) {
    return NextResponse.json({ error: "This vulnerability belongs to another organization" }, { status: 403 });
  }

  const now = new Date();
  const patch: { status: string; remediatedAt?: Date | null } = { status: body.status };
  if (body.status === "remediated" && existing.status !== "remediated") patch.remediatedAt = now;
  else if (body.status !== "remediated" && existing.status === "remediated") patch.remediatedAt = null;

  const result = await db.vaptVulnerability.update({
    where: { id },
    data: patch,
    include: { asset: { select: { name: true } } },
  });

  // Keep the promoted Findings-mirror row in sync (waived ↔ accepted).
  if (existing.promotedFindingId) {
    const mirrorStatus = body.status === "accepted" ? "waived" : body.status;
    await db.scanResult
      .update({
        where: { id: existing.promotedFindingId },
        data: { status: mirrorStatus, ...(patch.remediatedAt !== undefined ? { remediatedAt: patch.remediatedAt } : {}) },
      })
      .catch(() => { /* mirror may have been deleted with its scan */ });
  }

  if (existing.status !== body.status) {
    const info = slaInfo({ status: body.status === "accepted" ? "waived" : body.status, dueAt: result.dueAt, remediatedAt: result.remediatedAt, now });
    await audit({
      type: "VAPT_VULN_STATUS_CHANGED",
      userId: user.id,
      email: user.email,
      organizationId: existing.organizationId,
      ip: clientIp(req.headers),
      userAgent: req.headers.get("user-agent"),
      detail: `VAPT ${existing.cveId ?? existing.title.slice(0, 40)} on "${existing.asset.name}": ${existing.status} → ${body.status}`
        + (body.status === "remediated" ? ` — ${slaClosureNote(info)}` : "")
        + (note ? ` — note: ${note}` : ""),
    });
  }

  return NextResponse.json({ result });
}
