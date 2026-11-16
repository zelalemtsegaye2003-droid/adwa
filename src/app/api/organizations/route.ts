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
    // VAPT mirror scans (mode "vapt") are findings containers, not assessments
    // — never presented as the organization's latest compliance scan.
    include: { scans: { where: { mode: { not: "vapt" } }, orderBy: { startedAt: "desc" }, take: 1 } },
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

  let body: Record<string, string | undefined>;
  try {
    body = (await req.json()) as Record<string, string | undefined>;
  } catch {
    return NextResponse.json({ error: { code: "INVALID_JSON", message: "Request body must be valid JSON." } }, { status: 400 });
  }
  const name = (typeof body.name === "string" ? body.name : "").trim();
  if (name.length < 2 || name.length > 120) {
    return NextResponse.json({ error: { code: "BAD_NAME", message: "Organization name is required (max 120 characters)." } }, { status: 400 });
  }
  const org = await db.organization.create({
    data: {
      name,
      nameAm: (typeof body.nameAm === "string" ? body.nameAm : "").trim().slice(0, 120),
      sector: (typeof body.sector === "string" ? body.sector : "Other").trim().slice(0, 40) || "Other",
      tier: (typeof body.tier === "string" ? body.tier : "mid-market").trim().slice(0, 40) || "mid-market",
      contactEmail: (typeof body.contactEmail === "string" ? body.contactEmail : "").trim().slice(0, 254) || null,
      notes: (typeof body.notes === "string" ? body.notes : "").trim().slice(0, 2000) || null,
      status: "onboarding",
    },
  });
  return NextResponse.json({ organization: org }, { status: 201 });
}
