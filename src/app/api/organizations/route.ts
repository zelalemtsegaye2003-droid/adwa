import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth/guard";
import { can } from "@/lib/auth/rbac";

/**
 * GET /api/organizations — tenant directory.
 * SUPER_ADMIN sees every organization; tenant users see only their own.
 */
export async function GET(req: NextRequest) {
  const guard = await requireAuth(req);
  if (guard.error) return guard.error;
  const { user } = guard;

  const isSuper = can(user.role, "orgs:view-all");
  const orgs = await db.organization.findMany({
    where: isSuper ? {} : { id: user.orgId ?? "__none__" },
    orderBy: { createdAt: "asc" },
    include: { scans: { orderBy: { startedAt: "desc" }, take: 1 } },
  });

  return NextResponse.json({
    organizations: orgs.map((o) => ({
      ...o,
      latestScan: o.scans[0] ?? null,
      scanCount: o.scans.length,
    })),
  });
}

/** POST /api/organizations — onboard a new tenant (SUPER_ADMIN only). */
export async function POST(req: NextRequest) {
  const guard = await requireAuth(req, "orgs:manage");
  if (guard.error) return guard.error;

  const body = await req.json();
  if (!body.name?.trim()) {
    return NextResponse.json({ error: "Organization name is required" }, { status: 400 });
  }
  const org = await db.organization.create({
    data: {
      name: body.name.trim(),
      nameAm: body.nameAm?.trim() ?? "",
      sector: body.sector ?? "Other",
      tier: body.tier ?? "mid-market",
      contactEmail: body.contactEmail?.trim() || null,
      notes: body.notes?.trim() || null,
      status: "onboarding",
    },
  });
  return NextResponse.json({ organization: org }, { status: 201 });
}
