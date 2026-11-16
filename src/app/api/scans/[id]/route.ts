import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuthAny } from "@/lib/auth/guard";
import { can } from "@/lib/auth/rbac";
import { audit } from "@/lib/auth/audit";
import { clientIp } from "@/lib/auth/rate-limit";

/** GET /api/scans/[id] — full scan detail (tenant-isolated). */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireAuthAny(req, ["scans:view-org", "scans:view-all"]);
  if (guard.error) return guard.error;
  const { user } = guard;
  const { id } = await ctx.params;

  const scan = await db.scan.findUnique({
    where: { id },
    include: {
      organization: true,
      framework: true,
      results: {
        include: { rule: { include: { framework: { select: { code: true } } } } },
        orderBy: { rule: { sortOrder: "asc" } },
      },
    },
  });
  if (!scan) return NextResponse.json({ error: "Scan not found" }, { status: 404 });

  const isSuper = can(user.role, "scans:view-all");
  if (!isSuper && scan.organizationId !== user.orgId) {
    return NextResponse.json({ error: "This assessment belongs to another organization" }, { status: 403 });
  }

  return NextResponse.json({ scan });
}

/**
 * DELETE /api/scans/[id] — abandon an in-progress assessment (draft discard).
 * Completed assessments are immutable supervisory records: only a SUPER_ADMIN
 * may delete them (e.g. on an explicit tenant request), org users get 409.
 */
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireAuthAny(req, ["scans:run-org", "scans:run-any-org"]);
  if (guard.error) return guard.error;
  const { user } = guard;
  const { id } = await ctx.params;

  const scan = await db.scan.findUnique({
    where: { id },
    include: {
      framework: { select: { code: true } },
      organization: { select: { name: true } },
      _count: { select: { results: true } },
    },
  });
  if (!scan) return NextResponse.json({ error: "Scan not found" }, { status: 404 });

  const isSuper = can(user.role, "scans:run-any-org");
  if (!isSuper && scan.organizationId !== user.orgId) {
    return NextResponse.json({ error: "This assessment belongs to another organization" }, { status: 403 });
  }

  if (scan.status === "complete" && !isSuper) {
    return NextResponse.json(
      { error: "Completed assessments are permanent records and cannot be deleted." },
      { status: 409 }
    );
  }

  await db.scan.delete({ where: { id } }); // results cascade

  await audit({
    type: "SCAN_DELETED",
    userId: user.id,
    email: user.email,
    organizationId: scan.organizationId,
    ip: clientIp(req.headers),
    userAgent: req.headers.get("user-agent"),
    detail: `Assessment "${scan.name}" (${scan.framework?.code ?? "?"}, ${scan._count.results} obligations) deleted by ${isSuper ? "super admin" : "org user"}.`,
  });

  return NextResponse.json({ ok: true });
}
