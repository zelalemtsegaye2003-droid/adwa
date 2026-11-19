import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth/guard";
import { can } from "@/lib/auth/rbac";
import { getCoverageForOrg } from "@/lib/compliance/rules-engine";

/**
 * GET /api/rules/coverage — evidence coverage per obligation for one org.
 * Query: framework (code, optional), org (super admin only, required for
 * super admins since coverage is inherently per-tenant).
 */
export async function GET(req: NextRequest) {
  const guard = await requireAuth(req, "catalogue:view");
  if (guard.error) return guard.error;
  const { user } = guard;

  const isSuper = can(user.role, "evidence:view-all");
  const sp = req.nextUrl.searchParams;
  const framework = sp.get("framework") || null;
  const orgParam = sp.get("org") || "";

  const organizationId = isSuper ? orgParam : user.orgId;
  if (!organizationId) {
    return NextResponse.json(
      { error: { code: "ORG_REQUIRED", message: "Select an organization to view evidence coverage." } },
      { status: 400 }
    );
  }

  const org = await db.organization.findUnique({
    where: { id: organizationId },
    select: { id: true, name: true },
  });
  if (!org) {
    return NextResponse.json({ error: { code: "ORG_NOT_FOUND", message: "Organization not found." } }, { status: 404 });
  }

  const { coverage, summary } = await getCoverageForOrg(organizationId, framework);

  return NextResponse.json({
    organization: org,
    framework,
    summary,
    coverage,
  });
}
