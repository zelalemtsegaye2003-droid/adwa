import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuthAny } from "@/lib/auth/guard";
import { can } from "@/lib/auth/rbac";
import { verifyVaptAuditChain } from "@/lib/vapt/vapt-audit";

export const runtime = "nodejs";

/**
 * GET /api/vapt/audit — the hash-chained VAPT audit trail.
 *
 *  ?verify=1 → walks the chain and recomputes every row hash (tamper check,
 *  plan §Phase 11 "Audit logging UI with search, filters, export and tamper
 *  check"). The verification result is computed server-side and returned
 *  with the listing so a tampered row cannot be hidden by editing the table.
 */
export async function GET(req: NextRequest) {
  const guard = await requireAuthAny(req, ["vapt:view-org", "vapt:view-all"]);
  if (guard.error) return guard.error;
  const { user } = guard;

  const verify = req.nextUrl.searchParams.get("verify") === "1";
  const type = req.nextUrl.searchParams.get("type") || "";
  const target = req.nextUrl.searchParams.get("target") || "";

  const isSuper = can(user.role, "vapt:view-all");
  const orgParam = req.nextUrl.searchParams.get("org") || "";
  const organizationId = isSuper ? orgParam || null : user.orgId;

  const rows = await db.vaptAuditChain.findMany({
    where: {
      ...(organizationId ? { organizationId } : {}),
      ...(type ? { type } : {}),
      ...(target ? { target: { contains: target } } : {}),
    },
    orderBy: { seq: "desc" },
    take: 200,
  });

  const verification = verify ? await verifyVaptAuditChain() : null;

  return NextResponse.json({
    chain: rows.map((r) => ({ ...r, payload: safeParse(r.payload) })),
    verification,
  });
}

function safeParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}
