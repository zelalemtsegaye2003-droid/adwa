import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuthAny } from "@/lib/auth/guard";
import { can } from "@/lib/auth/rbac";

const VALID = ["open", "in_progress", "remediated", "waived"];

/** PATCH /api/findings/[id] — update remediation status (tenant-isolated). */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireAuthAny(req, ["findings:manage-org", "findings:manage-all"]);
  if (guard.error) return guard.error;
  const { user } = guard;

  const { id } = await ctx.params;
  const body = await req.json();
  if (!VALID.includes(body.status)) {
    return NextResponse.json({ error: `status must be one of ${VALID.join(", ")}` }, { status: 400 });
  }

  const existing = await db.scanResult.findUnique({
    where: { id },
    include: { scan: { select: { organizationId: true } } },
  });
  if (!existing) return NextResponse.json({ error: "Finding not found" }, { status: 404 });

  const isSuper = can(user.role, "findings:manage-all");
  if (!isSuper && existing.scan.organizationId !== user.orgId) {
    return NextResponse.json({ error: "This finding belongs to another organization" }, { status: 403 });
  }

  const result = await db.scanResult.update({
    where: { id },
    data: { status: body.status },
    include: { rule: true, scan: { include: { organization: true } } },
  });
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
