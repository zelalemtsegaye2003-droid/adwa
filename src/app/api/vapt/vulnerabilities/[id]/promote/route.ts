import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuthAny } from "@/lib/auth/guard";
import { can } from "@/lib/auth/rbac";
import { audit } from "@/lib/auth/audit";
import { clientIp } from "@/lib/auth/rate-limit";
import { vaptSlaDueDate } from "@/lib/vapt/vapt-engine";

export const runtime = "nodejs";

/**
 * Promotable severities — the Findings module tracks corrective actions for
 * critical/high/medium obligations; low-severity observations stay in the
 * VAPT queue with their own 180-day clock.
 */
const PROMOTABLE = ["critical", "high", "medium"];

/**
 * POST /api/vapt/vulnerabilities/[id]/promote — sync a vulnerability into the
 * existing Findings module as an NBE-anchored corrective action.
 *
 * What this creates:
 *  - a mirror Scan ("VAPT ▸ <CVE> — <asset>", mode "vapt", complete,
 *    framework NBE-IT) — excluded from compliance score aggregates,
 *    visible in the Findings view;
 *  - one ScanResult bound to the severity-matched anchor rule
 *    (critical → NBE-22 corrective actions, high → NBE-16 risk register,
 *    medium → NBE-18 findings-driven revision) carrying findingEn/findingAm,
 *    riskRank = the VAPT dynamic priority score, and the SLA due date from
 *    the SAME policy engine (30/60/90 days) the compliance findings use;
 *  - a bidirectional link (vaptVulnerabilityId ↔ promotedFindingId) so a
 *    status change in either module propagates to the other.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireAuthAny(req, [
    "vapt:manage-org", "vapt:manage-all",
    "findings:manage-org", "findings:manage-all",
  ]);
  if (guard.error) return guard.error;
  const { user } = guard;
  const { id } = await ctx.params;

  const existing = await db.vaptVulnerability.findUnique({
    where: { id },
    include: { asset: { select: { id: true, name: true, identifier: true, kind: true } } },
  });
  if (!existing) return NextResponse.json({ error: "Vulnerability not found" }, { status: 404 });
  const isSuper = can(user.role, "vapt:manage-all") || can(user.role, "findings:manage-all");
  if (!isSuper && existing.organizationId !== user.orgId) {
    return NextResponse.json({ error: "This vulnerability belongs to another organization" }, { status: 403 });
  }
  if (existing.promotedFindingId) {
    return NextResponse.json(
      { error: "Already synced into the Findings module.", findingId: existing.promotedFindingId },
      { status: 409 }
    );
  }
  if (!PROMOTABLE.includes(existing.severity)) {
    return NextResponse.json(
      { error: `Only ${PROMOTABLE.join("/")} severity vulnerabilities are promoted into corrective actions (low stays in the VAPT queue).` },
      { status: 422 }
    );
  }

  // Severity-matched anchor rules (the compliance obligations this finding
  // becomes evidence against).
  const ANCHOR_CODES: Record<string, string> = {
    critical: "NBE-22", // Corrective actions within prescribed timeframes
    high: "NBE-16", // IT risk register, updated quarterly
    medium: "NBE-18", // Periodic revision from assessment findings
  };
  const anchorCode = ANCHOR_CODES[existing.severity];
  const rule = await db.rule.findFirst({ where: { code: anchorCode, isActive: true } });
  if (!rule) {
    return NextResponse.json({ error: `Anchor rule ${anchorCode} not found in the catalogue` }, { status: 500 });
  }
  const framework = await db.framework.findUnique({ where: { id: rule.frameworkId ?? "" } });
  const org = await db.organization.findUnique({ where: { id: existing.organizationId } });
  if (!org) return NextResponse.json({ error: "Organization not found" }, { status: 404 });

  const now = new Date();
  const label = existing.cveId ?? existing.title.slice(0, 48);
  const findingEn = `VAPT ${label} — ${existing.title} (asset: ${existing.asset.name}, CVSS ${existing.cvssScore.toFixed(1)}, priority ${existing.priorityScore.toFixed(1)}/100${existing.kev ? ", CISA KEV" : ""})`;
  const findingAm = `VAPT ${label} — በ${existing.asset.name} ላይ የተገኘ የደህንነት ብልሽት (CVSS ${existing.cvssScore.toFixed(1)})`;

  // Mirror scan: one per promotion (ScanResult is unique per scanId+ruleId).
  const mirrorScan = await db.scan.create({
    data: {
      organizationId: existing.organizationId,
      frameworkId: rule.frameworkId ?? null,
      name: `VAPT ▸ ${label} — ${existing.asset.name}`,
      mode: "vapt", // excluded from compliance aggregates; a findings container
      status: "complete",
      auditorName: "Adwa VAPT Engine",
      overallScore: null,
      pillarScores: null,
      findingsCount: 1,
      criticalFindings: existing.severity === "critical" ? 1 : 0,
      startedAt: now,
      completedAt: now,
      durationMinutes: 0,
    },
  });

  const finding = await db.scanResult.create({
    data: {
      scanId: mirrorScan.id,
      ruleId: rule.id,
      answer: "no",
      answeredAt: now,
      score: 0,
      riskRank: existing.priorityScore,
      findingEn,
      findingAm,
      status: existing.status === "accepted" ? "waived" : existing.status,
      // Inherit the vulnerability's own SLA clock so the VAPT queue and the
      // Findings banner agree on the deadline (never two clocks for one bug).
      dueAt: existing.dueAt ?? vaptSlaDueDate(existing.severity, now),
      remediatedAt: existing.remediatedAt,
      vaptVulnerabilityId: existing.id,
    },
    include: { rule: { select: { code: true, titleEn: true, severity: true } } },
  });

  const updated = await db.vaptVulnerability.update({
    where: { id: existing.id },
    data: { promotedFindingId: finding.id },
  });

  await audit({
    type: "VAPT_VULN_PROMOTED",
    userId: user.id,
    email: user.email,
    organizationId: existing.organizationId,
    ip: clientIp(req.headers),
    userAgent: req.headers.get("user-agent"),
    detail: `VAPT ${label} on "${existing.asset.name}" promoted into the Findings module as ${rule.code} (${rule.titleEn}) for ${org.name} — deadline ${new Date(finding.dueAt ?? now).toISOString().slice(0, 10)}.`,
  });

  return NextResponse.json(
    {
      vulnerability: updated,
      finding: { id: finding.id, scanId: mirrorScan.id, rule: finding.rule, dueAt: finding.dueAt, status: finding.status },
    },
    { status: 201 }
  );
}
