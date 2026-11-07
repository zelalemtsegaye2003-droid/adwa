import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuthAny } from "@/lib/auth/guard";
import { can } from "@/lib/auth/rbac";

const PAGE_SIZE = 50;

/** GET /api/auth/audit — authentication audit trail (tenant-scoped / platform-wide). */
export async function GET(req: NextRequest) {
  const guard = await requireAuthAny(req, ["audit:view-org", "audit:view-all"]);
  if (guard.error) return guard.error;
  const { user } = guard;

  const isSuper = can(user.role, "audit:view-all");
  const where = isSuper ? {} : { organizationId: user.orgId ?? "__none__" };

  const page = Math.max(1, Number(req.nextUrl.searchParams.get("page") ?? "1") || 1);

  const [events, total] = await Promise.all([
    db.authEvent.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
    }),
    db.authEvent.count({ where }),
  ]);

  return NextResponse.json({
    events: events.map((e) => ({
      id: e.id,
      type: e.type,
      email: e.email,
      organizationId: e.organizationId,
      ip: e.ip,
      userAgent: e.userAgent,
      detail: e.detail,
      createdAt: e.createdAt,
    })),
    page,
    pageSize: PAGE_SIZE,
    total,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  });
}
