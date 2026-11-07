import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuthAny } from "@/lib/auth/guard";
import { can } from "@/lib/auth/rbac";

/**
 * GET /api/scans — assessment history.
 * SUPER_ADMIN sees all scans; tenant users see only their organization's.
 */
export async function GET(req: NextRequest) {
  const guard = await requireAuthAny(req, ["scans:view-org", "scans:view-all"]);
  if (guard.error) return guard.error;
  const { user } = guard;

  const isSuper = can(user.role, "scans:view-all");
  const scans = await db.scan.findMany({
    where: isSuper ? {} : { organizationId: user.orgId ?? "__none__" },
    orderBy: { startedAt: "desc" },
    include: {
      organization: { select: { id: true, name: true, nameAm: true, sector: true, tier: true } },
      framework: { select: { code: true, name: true, instrumentNo: true } },
    },
  });
  return NextResponse.json({ scans });
}

/** POST /api/scans — start an assessment (tenant-scoped, framework-scoped). */
export async function POST(req: NextRequest) {
  const guard = await requireAuthAny(req, ["scans:run-org", "scans:run-any-org"]);
  if (guard.error) return guard.error;
  const { user } = guard;

  const body = await req.json();
  const organizationId = body.organizationId;
  if (!organizationId) {
    return NextResponse.json({ error: "organizationId is required" }, { status: 400 });
  }

  // Tenant isolation: non-super users may only assess their own organization.
  const isSuper = can(user.role, "scans:run-any-org");
  if (!isSuper && organizationId !== user.orgId) {
    return NextResponse.json(
      { error: "You can only run assessments for your own organization" },
      { status: 403 }
    );
  }

  const org = await db.organization.findUnique({ where: { id: organizationId } });
  if (!org) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  // Framework scoping (default: first active framework).
  const framework = body.frameworkCode
    ? await db.framework.findFirst({ where: { code: body.frameworkCode, isActive: true } })
    : await db.framework.findFirst({ where: { isActive: true }, orderBy: { sortOrder: "asc" } });
  if (!framework) {
    return NextResponse.json({ error: "Framework not found" }, { status: 404 });
  }

  const rules = await db.rule.findMany({
    where: { isActive: true, frameworkId: framework.id },
    orderBy: { sortOrder: "asc" },
  });
  if (rules.length === 0) {
    return NextResponse.json({ error: "Framework has no active rules" }, { status: 409 });
  }

  const count = await db.scan.count({ where: { organizationId, frameworkId: framework.id } });
  const scan = await db.scan.create({
    data: {
      organizationId,
      frameworkId: framework.id,
      name: body.name?.trim() || `${framework.name} assessment #${count + 1} — ${rules.length} obligations`,
      status: "in_progress",
    },
  });
  // Create empty result rows for every active rule of the framework
  await db.scanResult.createMany({
    data: rules.map((r) => ({ scanId: scan.id, ruleId: r.id, answer: "na", score: 0 })),
  });
  return NextResponse.json({ scan }, { status: 201 });
}
