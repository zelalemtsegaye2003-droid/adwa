import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuthAny } from "@/lib/auth/guard";
import { can } from "@/lib/auth/rbac";
import { slaInfo, summarizeSla, type SlaState } from "@/lib/compliance/sla";

export const runtime = "nodejs";

/**
 * GET /api/findings/sla — remediation SLA dashboard for one organization
 * (org users always see their tenant; SUPER_ADMIN may pass ?org=<id>, and
 * without it gets the platform-wide view across all tenants).
 * Query: sla=OVERDUE|DUE_SOON|ON_TRACK|CLOSED_LATE|CLOSED_ON_TIME (optional),
 *        severity=critical|high|medium (optional), scan=<id> (optional).
 */
export async function GET(req: NextRequest) {
  const guard = await requireAuthAny(req, ["findings:view-org", "findings:view-all"]);
  if (guard.error) return guard.error;
  const { user } = guard;

  const isSuper = can(user.role, "findings:view-all");
  const sp = req.nextUrl.searchParams;
  const orgParam = sp.get("org") || "";
  const slaFilter = sp.get("sla") || "";
  const severityFilter = sp.get("severity") || "";
  const scanFilter = sp.get("scan") || "";

  // Tenant scoping: org users are pinned to their own organization.
  const organizationId = isSuper ? orgParam || null : user.orgId; // null → all orgs (super admin)
  if (!isSuper && !organizationId) {
    return NextResponse.json(
      { error: { code: "ORG_REQUIRED", message: "Your account has no organization." } },
      { status: 400 }
    );
  }

  const results = await db.scanResult.findMany({
    where: {
      OR: [{ answer: "no" }, { answer: "partial" }],
      scan: {
        status: "complete",
        ...(organizationId ? { organizationId } : {}),
        ...(scanFilter ? { id: scanFilter } : {}),
      },
      ...(severityFilter ? { rule: { severity: severityFilter } } : {}),
    },
    include: {
      rule: { select: { code: true, titleEn: true, titleAm: true, severity: true, article: true, pillar: true } },
      scan: {
        select: { id: true, name: true, completedAt: true, organizationId: true, organization: { select: { id: true, name: true } } },
      },
    },
  });

  const now = new Date();
  const enriched = results.map((r) => {
    const sla = slaInfo({ status: r.status, dueAt: r.dueAt, remediatedAt: r.remediatedAt, now });
    return {
      id: r.id,
      scanId: r.scan.id,
      scanName: r.scan.name,
      organization: r.scan.organization,
      rule: r.rule,
      answer: r.answer,
      status: r.status,
      riskRank: r.riskRank,
      findingEn: r.findingEn,
      findingAm: r.findingAm,
      dueAt: r.dueAt,
      remediatedAt: r.remediatedAt,
      slaState: sla.state,
      daysRemaining: sla.daysRemaining,
    };
  });

  const summary = summarizeSla(
    enriched.map((e) => slaInfo({ status: e.status, dueAt: e.dueAt, remediatedAt: e.remediatedAt, now }))
  );

  // Urgency order: OVERDUE → DUE_SOON → ON_TRACK → CLOSED_LATE → CLOSED_ON_TIME → WAIVED → NOT_TRACKED
  const order: Record<SlaState, number> = {
    OVERDUE: 0, DUE_SOON: 1, ON_TRACK: 2,
    CLOSED_LATE: 3, CLOSED_ON_TIME: 4, WAIVED: 5, NOT_TRACKED: 6,
  };
  enriched.sort((a, b) => {
    const s = order[a.slaState] - order[b.slaState];
    if (s !== 0) return s;
    if (a.slaState === "OVERDUE" || a.slaState === "DUE_SOON") {
      // most overdue / least time left first
      const d = (a.daysRemaining ?? 0) - (b.daysRemaining ?? 0);
      if (d !== 0) return d;
    }
    return (b.riskRank ?? 0) - (a.riskRank ?? 0);
  });

  const filtered = slaFilter ? enriched.filter((e) => e.slaState === slaFilter) : enriched;

  return NextResponse.json({
    scope: isSuper ? (organizationId ? "org" : "platform") : "tenant",
    organizationId: organizationId ?? null,
    generatedAt: now,
    slaPolicy: { critical: 30, high: 60, medium: 90, dueSoonWindowDays: 7 },
    summary,
    findings: filtered,
    totalBeforeFilter: enriched.length,
  });
}
