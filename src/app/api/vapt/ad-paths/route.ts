import { NextRequest, NextResponse } from "next/server";
import { requireAuthAny } from "@/lib/auth/guard";
import { can } from "@/lib/auth/rbac";
import { AD_EDGES, AD_NODES, AD_DOMAIN } from "@/lib/vapt/vapt-ad-paths";
import { computeAdAttackPaths } from "@/lib/vapt/vapt-ad-engine";

export const runtime = "nodejs";

/**
 * GET /api/vapt/ad-paths — AD attack-path analysis (LOT4 §G).
 *
 * Returns the reference directory graph (nodes + edges with relation and
 * exploitation notes, EN/AM) and the computed multi-hop attack paths from
 * every breach entry point to the tier-0 targets, with risk scoring,
 * chokepoints, misconfiguration KPIs and remediation guidance.
 *
 * Query params:
 *  - include=graph|paths|all (default all): trim payload for polling.
 *  - entry=<nodeId> / target=<nodeId>: filter computed paths.
 *
 * RBAC: any VAPT viewer (vapt:view-org / vapt:view-all). Reference
 * topology — identical across tenants; per-tenant live graphs arrive with
 * the enterprise identity connector.
 */
export async function GET(req: NextRequest) {
  const guard = await requireAuthAny(req, ["vapt:view-org", "vapt:view-all"]);
  if (guard.error) return guard.error;

  const include = (req.nextUrl.searchParams.get("include") || "all").toLowerCase();
  const entry = req.nextUrl.searchParams.get("entry") || "";
  const target = req.nextUrl.searchParams.get("target") || "";

  const analysis = computeAdAttackPaths();
  let paths = analysis.paths;
  if (entry) paths = paths.filter((p) => p.entryId === entry);
  if (target) paths = paths.filter((p) => p.targetId === target);

  const isSuper = can(guard.user.role, "vapt:view-all");
  const body: Record<string, unknown> = {
    scope: isSuper ? "platform" : "tenant",
    domain: AD_DOMAIN,
    generatedAt: new Date().toISOString(),
    stats: { ...analysis.stats, paths: paths.length },
    remediations: analysis.remediations,
  };
  if (include === "all" || include === "graph") {
    body.nodes = AD_NODES;
    body.edges = AD_EDGES;
  }
  if (include === "all" || include === "paths") {
    body.paths = paths;
  }
  return NextResponse.json(body);
}
