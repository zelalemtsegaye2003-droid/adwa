import { NextRequest, NextResponse } from "next/server";
import { requireAuthAny } from "@/lib/auth/guard";
import { BID_REQUIREMENTS, BID_SECTIONS, bidMatrixCsv, bidMatrixSummary } from "@/lib/vapt/vapt-bid-matrix";

export const runtime = "nodejs";

/**
 * GET /api/vapt/bid-matrix — NBE LOT4 capability response matrix.
 *
 * Query params:
 *  - format=json (default) : { summary, sections, requirements }
 *  - format=csv            : CSV export shaped for the tender's Vendor
 *                            Response table (Content-Disposition attachment).
 *  - section=<A..M>        : filter requirements by tender section letter.
 *  - status=full|partial|roadmap : filter by compliance status.
 *
 * RBAC: any VAPT viewer (vapt:view-org / vapt:view-all). The matrix is
 * reference data (same content for every tenant) — no tenant filtering.
 */
export async function GET(req: NextRequest) {
  const guard = await requireAuthAny(req, ["vapt:view-org", "vapt:view-all"]);
  if (guard.error) return guard.error;

  const format = (req.nextUrl.searchParams.get("format") || "json").toLowerCase();
  const section = req.nextUrl.searchParams.get("section") || "";
  const status = req.nextUrl.searchParams.get("status") || "";

  if (format === "csv") {
    const csv = bidMatrixCsv();
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="adwa-cyber-nbe-lot4-bid-matrix.csv"`,
      },
    });
  }

  let requirements = BID_REQUIREMENTS;
  if (section) requirements = requirements.filter((r) => r.section === section.toUpperCase());
  if (status) requirements = requirements.filter((r) => r.status === status.toLowerCase());

  return NextResponse.json({
    summary: bidMatrixSummary(),
    sections: BID_SECTIONS,
    requirements,
    filtered: Boolean(section || status),
  });
}
