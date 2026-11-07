import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuthAny } from "@/lib/auth/guard";
import { can } from "@/lib/auth/rbac";

export const runtime = "nodejs";

/**
 * GET /api/threats/peers — the sharing-community roster for peer-to-peer
 * targeting: every active organisation except the caller's own. Names only
 * (no contact data, no scan history) — the minimum needed to address a
 * direct encrypted share between trusted partners.
 */
export async function GET(req: NextRequest) {
  const guard = await requireAuthAny(req, ["threats:contribute"]);
  if (guard.error) return guard.error;
  const { user } = guard;

  const orgs = await db.organization.findMany({
    where: {
      status: { not: "onboarding" },
      ...(user.orgId ? { id: { not: user.orgId } } : {}),
    },
    select: { id: true, name: true, sector: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ peers: orgs });
}
