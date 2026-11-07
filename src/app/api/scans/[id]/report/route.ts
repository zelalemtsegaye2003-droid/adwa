import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuthAny } from "@/lib/auth/guard";
import { can } from "@/lib/auth/rbac";
import { audit } from "@/lib/auth/audit";
import { clientIp } from "@/lib/auth/rate-limit";
import { generateReportPdf, type ReportScanLite } from "@/lib/report-pdf";

export const runtime = "nodejs"; // pdfkit + font files need the Node runtime

/**
 * GET /api/scans/[id]/report — server-side executive report PDF.
 * Query: lang=en|am (default en).
 *
 * RBAC: same visibility as the scan itself (scans:view-org / scans:view-all),
 * tenant-isolated; only completed assessments can be exported.
 * Every export is recorded in the audit trail with the report's content hash.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireAuthAny(req, ["scans:view-org", "scans:view-all"]);
  if (guard.error) return guard.error;
  const { user } = guard;
  const { id } = await ctx.params;

  const lang = req.nextUrl.searchParams.get("lang") === "am" ? "am" : "en";

  const scan = await db.scan.findUnique({
    where: { id },
    include: {
      organization: { select: { name: true, nameAm: true, sector: true } },
      framework: { select: { code: true, name: true, nameAm: true, instrumentNo: true, issuer: true } },
      results: {
        include: {
          rule: {
            select: {
              code: true, titleEn: true, titleAm: true, remediationEn: true, remediationAm: true,
              severity: true, article: true, penaltyRef: true, pillar: true,
            },
          },
        },
        orderBy: { riskRank: "desc" },
      },
    },
  });
  if (!scan) return NextResponse.json({ error: "Scan not found" }, { status: 404 });

  const isSuper = can(user.role, "scans:view-all");
  if (!isSuper && scan.organizationId !== user.orgId) {
    return NextResponse.json({ error: "This assessment belongs to another organization" }, { status: 403 });
  }

  if (scan.status !== "complete") {
    return NextResponse.json(
      { error: "Only completed assessments can be exported as a report." },
      { status: 409 }
    );
  }

  const { buffer, hash, pages } = await generateReportPdf(scan as unknown as ReportScanLite, lang);

  await audit({
    type: "REPORT_EXPORTED",
    userId: user.id,
    email: user.email,
    organizationId: scan.organizationId,
    ip: clientIp(req.headers),
    userAgent: req.headers.get("user-agent"),
    detail: `Executive report exported for "${scan.name}" (${scan.framework?.code ?? "?"}) — ${pages} page(s), ${lang.toUpperCase()}, integrity hash ${hash}.`,
  });

  const orgSlug = scan.organization.name.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 32);
  const dateStr = scan.completedAt ? new Date(scan.completedAt).toISOString().slice(0, 10) : "draft";
  const fileName = `Adwa_Report_${orgSlug}_${dateStr}_${lang.toUpperCase()}.pdf`;

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Content-Length": String(buffer.length),
      "X-Report-Hash": hash,
      "X-Report-Pages": String(pages),
      "Cache-Control": "no-store", // reports reflect live remediation state
    },
  });
}
