import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuthAny, parseBody } from "@/lib/auth/guard";
import { can } from "@/lib/auth/rbac";
import { audit } from "@/lib/auth/audit";
import { clientIp } from "@/lib/auth/rate-limit";
import {
  buildSimulatedFindings,
  runDastScan,
  dastVulnsFromReport,
  prioritise,
  severityFromCvss,
  vaptSlaDueDate,
  summariseVulns,
  type VulnDraft,
} from "@/lib/vapt-engine";

export const runtime = "nodejs";

const SCAN_TYPES = ["DISCOVERY", "INFRA", "DAST", "FULL"];

interface ScanBody {
  organizationId?: string;
  name?: string;
  scanType?: string;
  assetIds?: string[];
}

function scanSchema(data: unknown): ScanBody | null {
  if (typeof data !== "object" || data === null) return null;
  const d = data as Record<string, unknown>;
  if (d.scanType !== undefined && !SCAN_TYPES.includes(d.scanType as string)) return null;
  if (d.assetIds !== undefined && !Array.isArray(d.assetIds)) return null;
  return {
    organizationId: typeof d.organizationId === "string" ? d.organizationId : undefined,
    name: typeof d.name === "string" ? d.name.trim().slice(0, 120) : undefined,
    scanType: (d.scanType as string) ?? "FULL",
    assetIds: Array.isArray(d.assetIds) ? d.assetIds.filter((x) => typeof x === "string") : undefined,
  };
}

/**
 * GET /api/vapt/scans — scan history with summaries (tenant-scoped).
 */
export async function GET(req: NextRequest) {
  const guard = await requireAuthAny(req, ["vapt:view-org", "vapt:view-all"]);
  if (guard.error) return guard.error;
  const { user } = guard;

  const isSuper = can(user.role, "vapt:view-all");
  const orgParam = req.nextUrl.searchParams.get("org") || "";
  const organizationId = isSuper ? orgParam || null : user.orgId;

  const scans = await db.vaptScan.findMany({
    where: organizationId ? { organizationId } : {},
    orderBy: { startedAt: "desc" },
    take: 50,
    include: { organization: { select: { id: true, name: true } } },
  });
  return NextResponse.json({
    scope: isSuper ? (organizationId ? "org" : "platform") : "tenant",
    scans: scans.map((s) => ({ ...s, summary: s.summary ? JSON.parse(s.summary) : null })),
  });
}

/**
 * POST /api/vapt/scans — orchestrate a hybrid scan run.
 *
 *  DAST  → REAL non-destructive HTTP checks against every WEBAPP/API asset
 *          (throttled, GET-only — production-safe by design).
 *  INFRA → deterministic simulated findings from the bundled NVD/CISA
 *          reference catalogue (decision D3 — honestly labelled).
 *  FULL  → both engines.
 *  DISCOVERY → asset refresh only (lastSeenAt touch, no findings).
 *
 * Dedup: an already-tracked finding (same CVE/title + asset, any status) is
 * counted as `known`, never duplicated — the register is monotone.
 */
export async function POST(req: NextRequest) {
  const guard = await requireAuthAny(req, ["vapt:manage-org", "vapt:manage-all"]);
  if (guard.error) return guard.error;
  const { user } = guard;

  const parsed = await parseBody(req, scanSchema);
  if (parsed.error) return parsed.error;
  const body = parsed.data;

  const isSuper = can(user.role, "vapt:manage-all");
  const organizationId = isSuper ? body.organizationId : user.orgId;
  if (!organizationId) {
    return NextResponse.json({ error: "organizationId is required" }, { status: 400 });
  }
  if (!isSuper && body.organizationId && body.organizationId !== user.orgId) {
    return NextResponse.json({ error: "You can only scan your own organization's assets" }, { status: 403 });
  }
  const org = await db.organization.findUnique({ where: { id: organizationId } });
  if (!org) return NextResponse.json({ error: "Organization not found" }, { status: 404 });

  // Resolve targets (explicit subset or the whole registry).
  const assets = await db.vaptAsset.findMany({
    where: {
      organizationId,
      ...(body.assetIds?.length ? { id: { in: body.assetIds } } : {}),
    },
    orderBy: { createdAt: "asc" },
  });
  if (!assets.length) {
    return NextResponse.json(
      { error: "No assets to scan — register assets in the attack-surface registry first." },
      { status: 409 }
    );
  }

  const scanType = body.scanType ?? "FULL";
  const startedAt = Date.now();
  const scan = await db.vaptScan.create({
    data: {
      organizationId,
      name: body.name || `VAPT ${scanType} scan — ${assets.length} target(s)`,
      scanType,
      status: "RUNNING",
      targetCount: assets.length,
      createdById: user.id,
    },
  });

  // Existing tracked findings — the dedup base.
  const tracked = await db.vaptVulnerability.findMany({
    where: { organizationId },
    select: { assetId: true, cveId: true, title: true },
  });
  const trackedKeys = new Set(tracked.map((v) => `${v.assetId}|${v.cveId ?? "—"}|${v.title}`));

  let newCount = 0;
  let knownCount = 0;
  let dastReal = false;
  const unreachable: string[] = [];
  const dastReports: unknown[] = [];

  try {
    const now = new Date();
    for (const asset of assets) {
      await db.vaptAsset.update({ where: { id: asset.id }, data: { lastSeenAt: now } });

      const drafts: VulnDraft[] = [];
      const isWebKind = asset.kind === "WEBAPP" || asset.kind === "API";

      // ── REAL DAST engine ────────────────────────────────────────────────
      if (isWebKind && (scanType === "DAST" || scanType === "FULL")) {
        const report = await runDastScan(asset.identifier);
        dastReports.push({ asset: asset.name, target: report.target, reachable: report.reachable, checks: report.checks.map((c) => ({ id: c.id, result: c.result })) });
        if (!report.reachable) {
          unreachable.push(`${asset.name} (${report.error ?? "unreachable"})`);
        } else {
          dastReal = true;
          drafts.push(...dastVulnsFromReport(report));
        }
      }

      // ── Simulated infrastructure engine ─────────────────────────────────
      if (scanType === "INFRA" || scanType === "FULL" || (scanType === "DAST" && !isWebKind)) {
        drafts.push(...buildSimulatedFindings(asset, 1));
      }

      for (const draft of drafts) {
        const key = `${asset.id}|${draft.cveId ?? "—"}|${draft.title}`;
        if (trackedKeys.has(key)) {
          knownCount++;
          continue;
        }
        trackedKeys.add(key);
        const severity = severityFromCvss(draft.cvssScore);
        const { score, priorityClass } = prioritise({
          cvssScore: draft.cvssScore,
          epss: draft.epss,
          kev: draft.kev,
          assetCriticality: asset.criticality,
          assetSurface: asset.surface,
          assetEnvironment: asset.environment,
        });
        await db.vaptVulnerability.create({
          data: {
            organizationId,
            assetId: asset.id,
            scanId: scan.id,
            cveId: draft.cveId,
            title: draft.title,
            description: draft.description,
            remediation: draft.remediation,
            category: draft.category,
            severity,
            cvssScore: draft.cvssScore,
            cvssVector: draft.cvssVector,
            epss: draft.epss,
            kev: draft.kev,
            priorityScore: score,
            priorityClass,
            evidence: JSON.stringify(draft.evidence),
            status: "open",
            dueAt: vaptSlaDueDate(severity, now),
            detectedAt: draft.detectedAt,
          },
        });
        newCount++;
      }
    }

    const vulns = await db.vaptVulnerability.findMany({
      where: { scanId: scan.id },
    });
    const summary = summariseVulns(vulns, new Date());

    const completed = await db.vaptScan.update({
      where: { id: scan.id },
      data: {
        status: "COMPLETED",
        newCount,
        knownCount,
        dastReal,
        engineMode: dastReal ? "hybrid" : "simulated",
        summary: JSON.stringify(summary),
        completedAt: new Date(),
        durationMs: Date.now() - startedAt,
        detail: [
          `Engine: ${dastReal ? "hybrid (live DAST + reference catalogue)" : "reference catalogue simulation"}.`,
          unreachable.length ? `Unreachable target(s): ${unreachable.join(", ")}.` : "",
        ].filter(Boolean).join(" "),
      },
    });

    await audit({
      type: "VAPT_SCAN_COMPLETED",
      userId: user.id,
      email: user.email,
      organizationId,
      ip: clientIp(req.headers),
      userAgent: req.headers.get("user-agent"),
      detail: `VAPT ${scanType} scan "${completed.name}" for ${org.name}: ${assets.length} target(s), ${newCount} new, ${knownCount} known${dastReal ? ", live DAST" : ""}.`,
    });

    return NextResponse.json(
      { scan: { ...completed, summary }, dastReports },
      { status: 201 }
    );
  } catch (err) {
    const failed = await db.vaptScan.update({
      where: { id: scan.id },
      data: {
        status: "FAILED",
        detail: err instanceof Error ? err.message.slice(0, 400) : "engine error",
        completedAt: new Date(),
        durationMs: Date.now() - startedAt,
      },
    });
    return NextResponse.json({ error: "Scan failed", scan: failed }, { status: 502 });
  }
}
