import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuthAny } from "@/lib/auth/guard";
import { can } from "@/lib/auth/rbac";
import { slaInfo } from "@/lib/sla";

export const runtime = "nodejs";

const SEVERITIES = ["critical", "high", "medium", "low"];
const STATUSES = ["open", "in_progress", "remediated", "accepted"];
const SLA_STATES = ["OVERDUE", "DUE_SOON", "ON_TRACK", "CLOSED_ON_TIME", "CLOSED_LATE", "WAIVED"];

/**
 * GET /api/vapt/vulnerabilities — the prioritised remediation queue.
 * Query: severity, status, sla (state), kev=1, category, asset, q (title/CVE),
 * scan, promoted=1 (only promoted into Findings), org (super admin).
 */
export async function GET(req: NextRequest) {
  const guard = await requireAuthAny(req, ["vapt:view-org", "vapt:view-all"]);
  if (guard.error) return guard.error;
  const { user } = guard;

  const isSuper = can(user.role, "vapt:view-all");
  const sp = req.nextUrl.searchParams;
  const organizationId = isSuper ? sp.get("org") || null : user.orgId;
  if (!isSuper && !organizationId) {
    return NextResponse.json(
      { error: { code: "ORG_REQUIRED", message: "Your account has no organization." } },
      { status: 400 }
    );
  }

  const severity = sp.get("severity") || "";
  const status = sp.get("status") || "";
  const sla = sp.get("sla") || "";
  const kev = sp.get("kev") || "";
  const category = sp.get("category") || "";
  const asset = sp.get("asset") || "";
  const scan = sp.get("scan") || "";
  const q = (sp.get("q") || "").toLowerCase().trim();
  const promoted = sp.get("promoted") || "";

  const rows = await db.vaptVulnerability.findMany({
    where: {
      ...(organizationId ? { organizationId } : {}),
      ...(severity && SEVERITIES.includes(severity) ? { severity } : {}),
      ...(status && STATUSES.includes(status) ? { status } : {}),
      ...(kev === "1" ? { kev: true } : {}),
      ...(promoted === "1" ? { promotedFindingId: { not: null } } : {}),
      ...(category ? { category } : {}),
      ...(asset ? { assetId: asset } : {}),
      ...(scan ? { scanId: scan } : {}),
    },
    include: {
      asset: { select: { id: true, name: true, kind: true, identifier: true, criticality: true, surface: true, environment: true } },
      organization: { select: { id: true, name: true } },
    },
    orderBy: { priorityScore: "desc" },
    take: 300,
  });

  const now = new Date();
  const enriched = rows.map((v) => {
    // Map the VAPT status machine onto the platform SLA state machine
    // (accepted == waived for SLA semantics; remediated stamps closure).
    const mapped = v.status === "accepted" ? "waived" : v.status;
    const info = slaInfo({ status: mapped, dueAt: v.dueAt, remediatedAt: v.remediatedAt, now });
    return {
      id: v.id,
      assetId: v.assetId,
      scanId: v.scanId,
      cveId: v.cveId,
      title: v.title,
      description: v.description,
      remediation: v.remediation,
      category: v.category,
      severity: v.severity,
      cvssScore: v.cvssScore,
      cvssVector: v.cvssVector,
      epss: v.epss,
      kev: v.kev,
      priorityScore: v.priorityScore,
      priorityClass: v.priorityClass,
      evidence: v.evidence ? JSON.parse(v.evidence) : null,
      status: v.status,
      fingerprint: v.fingerprint,
      verified: v.verified,
      dueAt: v.dueAt,
      remediatedAt: v.remediatedAt,
      detectedAt: v.detectedAt,
      promotedFindingId: v.promotedFindingId,
      asset: v.asset,
      organization: v.organization,
      slaState: info.state,
      daysRemaining: info.daysRemaining,
    };
  });

  const filtered =
    sla && SLA_STATES.includes(sla)
      ? enriched.filter((v) => v.slaState === sla)
      : q
        ? enriched.filter((v) => v.title.toLowerCase().includes(q) || (v.cveId ?? "").toLowerCase().includes(q))
        : enriched;

  return NextResponse.json({
    scope: isSuper ? (organizationId ? "org" : "platform") : "tenant",
    slaPolicy: { critical: 30, high: 60, medium: 90, low: 180, dueSoonWindowDays: 7 },
    total: filtered.length,
    vulnerabilities: filtered,
  });
}
