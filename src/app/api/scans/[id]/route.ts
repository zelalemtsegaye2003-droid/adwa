import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuthAny } from "@/lib/auth/guard";
import { can } from "@/lib/auth/rbac";

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
