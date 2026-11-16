import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuthAny } from "@/lib/auth/guard";
import { can } from "@/lib/auth/rbac";

export const runtime = "nodejs";

/** GET /api/vapt/scans/[id] — scan detail with its detected findings. */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireAuthAny(req, ["vapt:view-org", "vapt:view-all"]);
  if (guard.error) return guard.error;
  const { user } = guard;
  const { id } = await ctx.params;

  const scan = await db.vaptScan.findUnique({
    where: { id },
    include: {
      organization: { select: { id: true, name: true } },
      createdBy: { select: { name: true, email: true } },
      vulnerabilities: {
        orderBy: { priorityScore: "desc" },
        include: { asset: { select: { id: true, name: true, kind: true, identifier: true, criticality: true, surface: true } } },
      },
    },
  });
  if (!scan) return NextResponse.json({ error: "Scan not found" }, { status: 404 });

  const isSuper = can(user.role, "vapt:view-all");
  if (!isSuper && scan.organizationId !== user.orgId) {
    return NextResponse.json({ error: "This scan belongs to another organization" }, { status: 403 });
  }
  return NextResponse.json({
    scan: {
      ...scan,
      summary: scan.summary ? JSON.parse(scan.summary) : null,
      vulnerabilities: scan.vulnerabilities.map((v) => ({ ...v, evidence: v.evidence ? JSON.parse(v.evidence) : null })),
    },
  });
}
