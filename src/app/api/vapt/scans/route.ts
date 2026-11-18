import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuthAny, parseBody } from "@/lib/auth/guard";
import { can } from "@/lib/auth/rbac";
import { audit } from "@/lib/auth/audit";
import { clientIp } from "@/lib/auth/rate-limit";
import {
  runDastScan,
  dastVulnsFromReport,
  prioritise,
  severityFromCvss,
  vaptSlaDueDate,
  summariseVulns,
  type VulnDraft,
} from "@/lib/vapt-engine";
import { runInfraScan, infraVulnsFromReport, SAFE_DEFAULT, findingFingerprint } from "@/lib/vapt-netengine";
import { extractTarget, authorizingScope, scopeIsLive, targetMatches, parseScopeTargets } from "@/lib/vapt-scope";
import { runSnmpAudit, snmpVulnsFromReport } from "@/lib/vapt-snmp";
import { auditDatabase, dbVulnsFromReport, type DbCredentials } from "@/lib/vapt-db-audit";
import { decryptSecret } from "@/lib/auth/crypto";
import { appendVaptAudit } from "@/lib/vapt-audit";
import { createHash } from "crypto";

export const runtime = "nodejs";

const SCAN_TYPES = ["DISCOVERY", "INFRA", "DAST", "FULL"];
const MAX_PORTS = 64;

interface ScanBody {
  organizationId?: string;
  name?: string;
  scanType?: string;
  assetIds?: string[];
  ports?: number[];
  profile?: string;
  scopeId?: string;
}

function scanSchema(data: unknown): ScanBody | null {
  if (typeof data !== "object" || data === null) return null;
  const d = data as Record<string, unknown>;
  if (d.scanType !== undefined && !SCAN_TYPES.includes(d.scanType as string)) return null;
  if (d.assetIds !== undefined && !Array.isArray(d.assetIds)) return null;
  if (d.profile !== undefined && d.profile !== "SAFE" && d.profile !== "INTRUSIVE") return null;
  if (d.ports !== undefined) {
    if (!Array.isArray(d.ports) || d.ports.length > MAX_PORTS) return null;
    for (const p of d.ports) {
      if (typeof p !== "number" || !Number.isInteger(p) || p < 1 || p > 65535) return null;
    }
  }
  return {
    organizationId: typeof d.organizationId === "string" ? d.organizationId : undefined,
    name: typeof d.name === "string" ? d.name.trim().slice(0, 120) : undefined,
    scanType: (d.scanType as string) ?? "FULL",
    assetIds: Array.isArray(d.assetIds) ? d.assetIds.filter((x) => typeof x === "string") : undefined,
    ports: Array.isArray(d.ports) ? (d.ports as number[]) : undefined,
    profile: (d.profile as string) ?? "SAFE",
    scopeId: typeof d.scopeId === "string" ? d.scopeId : undefined,
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
    include: { organization: { select: { id: true, name: true } }, scope: { select: { id: true, name: true } } },
  });
  return NextResponse.json({
    scope: isSuper ? (organizationId ? "org" : "platform") : "tenant",
    scans: scans.map((s) => ({ ...s, summary: s.summary ? JSON.parse(s.summary) : null })),
  });
}

/**
 * POST /api/vapt/scans — orchestrate a REAL scan run behind the authorization gate.
 *
 *  Plan §1 hard rules enforced here:
 *   - Every asset must lie inside an APPROVED, in-window scope — otherwise the
 *     whole scan is REJECTED at the API level and the attempt is written to the
 *     hash-chained audit log (SCAN_REJECTED).
 *   - INTRUSIVE profile additionally requires a scope with intrusiveAllowed set
 *     by a second user (four-eyes); the engine itself only ships SAFE probes.
 *
 *  Engines (all live):
 *   INFRA → real TCP port scan + banner/TLS/HTTP service detection → offline
 *           CVE-feed version matching (live-fetched CVSS/EPSS/KEV data)
 *   SNMP  → real SNMPv1/v2c GET + RFC 3412/3414 v3 USM probes (read-only) for
 *           NETWORK/FIREWALL assets — default-community and noAuthNoPriv
 *           misconfigurations come back as evidence-backed findings
 *   DB    → credentialed database audit (MongoDB OP_MSG + SCRAM-SHA-256,
 *           MySQL/MariaDB handshake + mysql_native_password) for DATABASE
 *           assets — auth-enforcement probes + release-line EOL findings
 *   DAST  → real non-destructive HTTP checks against WEBAPP/API assets
 *   FULL  → all of the above; DISCOVERY → port-level reachability only
 *
 *  Unified finding identity: fingerprint = sha256(asset ‖ rule ‖ location) —
 *  duplicates are counted as `known`; open findings NOT re-observed by a FULL
 *  scan are auto-closed as verified-fixed (plan §4).
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

  // ── Authorization gate (plan §1) ────────────────────────────────────────
  const scopes = await db.vaptScope.findMany({ where: { organizationId } });
  const now = new Date();
  const unauthorized: { asset: string; identifier: string }[] = [];
  const scopeChoice = body.scopeId ? scopes.find((s) => s.id === body.scopeId) : null;
  if (body.scopeId && !scopeChoice) {
    return NextResponse.json({ error: "Scope not found" }, { status: 404 });
  }
  if (scopeChoice && !scopeIsLive(scopeChoice, now)) {
    return NextResponse.json({ error: `Scope "${scopeChoice.name}" is not approved or is outside its validity window.` }, { status: 403 });
  }
  for (const asset of assets) {
    const ok = scopeChoice
      ? (() => {
          const targets = parseScopeTargets(scopeChoice.targets) ?? [];
          return targets.some((t) => targetMatches(t, asset.identifier));
        })()
      : !!authorizingScope(asset.identifier, scopes, now);
    if (!ok) unauthorized.push({ asset: asset.name, identifier: asset.identifier });
  }
  if (unauthorized.length) {
    // Reject the ENTIRE scan at the API level — and record the attempt.
    await appendVaptAudit({
      type: "SCAN_REJECTED",
      actorId: user.id,
      actorEmail: user.email,
      organizationId,
      target: unauthorized.map((u) => u.identifier).join(", ").slice(0, 400),
      action: `Scan request rejected at the authorization gate (${unauthorized.length} of ${assets.length} target(s) outside any approved, in-window scope)`,
      result: "rejected — nothing was scanned",
      payload: { unauthorized, scanType: body.scanType ?? "FULL", requestedScope: body.scopeId ?? "auto" },
    });
    await audit({
      type: "ACCESS_DENIED",
      userId: user.id,
      email: user.email,
      organizationId,
      ip: clientIp(req.headers),
      userAgent: req.headers.get("user-agent"),
      detail: `VAPT scan rejected — out-of-scope targets: ${unauthorized.map((u) => u.identifier).join(", ")}`,
    });
    return NextResponse.json(
      {
        error: "Scan rejected by the authorization gate — no target may be scanned outside an approved, in-window scope.",
        unauthorized,
        remediation: "Create a scope covering these targets and have a second user approve it (four-eyes), then rescan.",
      },
      { status: 403 }
    );
  }

  // Resolve the effective scope record for the scan (explicit or covering).
  const effectiveScope =
    scopeChoice ??
    (() => {
      let candidate: (typeof scopes)[number] | null = null;
      for (const s of scopes) {
        if (!scopeIsLive(s, now)) continue;
        const coversAll = assets.every((a) => authorizingScope(a.identifier, [s], now));
        if (coversAll) {
          candidate = s;
          break;
        }
      }
      return candidate;
    })();

  // ── INTRUSIVE profile requires the scope's four-eyes opt-in ─────────────
  if (body.profile === "INTRUSIVE" && !effectiveScope?.intrusiveAllowed) {
    await appendVaptAudit({
      type: "SCAN_PROFILE_BLOCKED",
      actorId: user.id,
      actorEmail: user.email,
      organizationId,
      target: effectiveScope?.name ?? "scope",
      action: "INTRUSIVE-profile scan blocked — scope does not carry the second-user intrusive opt-in",
      result: "blocked — SAFE-profile probes only",
      payload: { profile: "INTRUSIVE", scope: effectiveScope?.name ?? null },
    });
    return NextResponse.json(
      { error: "The INTRUSIVE profile is disabled for this scope: a second user must set the intrusive opt-in at scope approval (four-eyes)." },
      { status: 403 }
    );
  }

  const scanType = body.scanType ?? "FULL";
  const profile = body.profile ?? "SAFE";
  const startedAt = Date.now();
  const scan = await db.vaptScan.create({
    data: {
      organizationId,
      scopeId: effectiveScope?.id ?? null,
      profile,
      name: body.name || `VAPT ${scanType} scan — ${assets.length} target(s)`,
      scanType,
      status: "RUNNING",
      engineMode: "live",
      targetCount: assets.length,
      createdById: user.id,
    },
  });
  await appendVaptAudit({
    type: "SCAN_STARTED",
    actorId: user.id,
    actorEmail: user.email,
    organizationId,
    target: effectiveScope?.name ?? `${assets.length} target(s)`,
    action: `VAPT ${scanType} (${profile}) scan "${scan.name}" started under scope "${effectiveScope?.name ?? "auto-resolved"}"`,
    result: "started",
    payload: { scanId: scan.id, scanType, profile, assets: assets.map((a) => a.identifier), ports: body.ports ?? null },
  });

  // Existing tracked fingerprints — the dedup base (plan §4).
  const tracked = await db.vaptVulnerability.findMany({
    where: { organizationId },
    select: { id: true, assetId: true, fingerprint: true, cveId: true, title: true, status: true },
  });
  const trackedKeys = new Set(tracked.map((v) => v.fingerprint ?? `${v.assetId}|${v.cveId ?? "—"}|${v.title}`));
  const observedFingerprints = new Set<string>();

  let newCount = 0;
  let knownCount = 0;
  let dastReal = false;
  let infraReal = false;
  const unreachable: string[] = [];
  const engineNotes: string[] = [];
  const dastReports: unknown[] = [];
  const snmpReports: unknown[] = [];
  const dbReports: unknown[] = [];
  const infraReports: { asset: string; host: string; openPorts: number[]; banners: { port: number; banner: string }[]; serviceChecks: unknown[] }[] = [];

  // Stored scan credentials (AES-256-GCM at rest) — decrypted only inside
  // the engine calls below, never logged, never echoed in findings.
  const credRows = await db.vaptCredential.findMany({ where: { assetId: { in: assets.map((a) => a.id) } } });
  const credentialsByAsset: Record<string, typeof credRows> = {};
  for (const c of credRows) (credentialsByAsset[c.assetId] ??= []).push(c);
  const decryptCred = (ciphertext: string): string | null => {
    try {
      return decryptSecret(ciphertext);
    } catch {
      return null;
    }
  };

  const persist = async (assetId: string, asset: { criticality: string; surface: string; environment: string }, draft: VulnDraft, ruleKey: string, location: string) => {
    const fp = findingFingerprint(assetId, ruleKey, location);
    observedFingerprints.add(fp);
    if (trackedKeys.has(fp)) {
      knownCount++;
      return;
    }
    trackedKeys.add(fp);
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
        assetId,
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
        fingerprint: fp,
        status: "open",
        dueAt: vaptSlaDueDate(severity, now),
        detectedAt: draft.detectedAt,
      },
    });
    newCount++;
  };

  try {
    for (const asset of assets) {
      await db.vaptAsset.update({ where: { id: asset.id }, data: { lastSeenAt: now } });
      const isWebKind = asset.kind === "WEBAPP" || asset.kind === "API";
      const cand = extractTarget(asset.identifier);

      // ── REAL INFRA engine ────────────────────────────────────────────────
      if (scanType === "INFRA" || scanType === "FULL" || (scanType === "DAST" && !isWebKind)) {
        const host = cand.host ?? cand.domain;
        if (host) {
          const ports = [...new Set([...(body.ports ?? []), ...(cand.port ? [cand.port] : []), ...SAFE_DEFAULT.ports])].sort((a, b) => a - b);
          const report = await runInfraScan(host, { ...SAFE_DEFAULT, ports, concurrency: 8 });
          infraReports.push({ asset: asset.name, host, openPorts: report.openPorts, banners: report.banners.map((b) => ({ port: b.port, banner: b.banner.slice(0, 120) })), serviceChecks: report.serviceChecks });
          if (report.error) {
            unreachable.push(`${asset.name} (${report.error})`);
          } else {
            infraReal = true;
            const drafts = infraVulnsFromReport(report, asset.id);
            for (const d of drafts) {
              const ruleKey = d.cveId ?? d.title;
              const location = d.evidence && typeof (d.evidence as Record<string, unknown>).port === "number" ? String((d.evidence as Record<string, unknown>).port) : host;
              await persist(asset.id, asset, d, ruleKey, location);
            }
          }
        } else {
          engineNotes.push(`${asset.name}: identifier is not scannable by the infra engine`);
        }
      }

      // ── REAL SNMP device audit (NETWORK/FIREWALL) — NBE "network device
      //    assessment via SNMPv1/v2c/v3". Read-only GETs; port from the
      //    identifier (host:port) or the standard 161/udp.
      if ((asset.kind === "NETWORK" || asset.kind === "FIREWALL") && (scanType === "INFRA" || scanType === "FULL")) {
        const host = cand.host ?? cand.domain;
        const snmpPort = cand.port ?? 161;
        if (host) {
          const snmpCreds = credentialsByAsset[asset.id] ?? [];
          const extraCommunities: string[] = [];
          let v3User: string | undefined;
          let credNote = "";
          for (const c of snmpCreds) {
            if (c.kind === "snmp" && c.username === "community") {
              const val = decryptCred(c.secretCiphertext);
              if (val) extraCommunities.push(val);
              else credNote = " (stored community unreadable — AUTH_SECRET changed?)";
            }
            if (c.kind === "snmp-v3") v3User = c.username;
          }
          if (snmpCreds.length) {
            await db.vaptCredential.updateMany({ where: { id: { in: snmpCreds.map((c) => c.id) } }, data: { lastUsedAt: now } });
          }
          const snmp = await runSnmpAudit(host, snmpPort, { extraCommunities, v3User, timeoutMs: 1_500 });
          snmpReports.push({
            asset: asset.name,
            host,
            port: snmpPort,
            reachable: snmp.reachable,
            versions: snmp.versions,
            defaultCommunities: snmp.defaultCommunities,
            system: snmp.system,
            v3: snmp.v3,
          });
          if (!snmp.reachable) {
            engineNotes.push(`${asset.name}: no SNMP agent answered on udp/${snmpPort}${credNote}`);
          } else {
            infraReal = true;
            const drafts = snmpVulnsFromReport(snmp);
            for (const d of drafts) {
              await persist(asset.id, asset, d, d.cveId ?? d.title, `udp:${snmpPort}`);
            }
          }
        }
      }

      // ── REAL credentialed DB audit (DATABASE) — MongoDB OP_MSG + SCRAM-
      //    SHA-256 / MySQL-MariaDB handshake + native password. Port from the
      //    identifier (host:port) or the observed open default DB ports.
      if (asset.kind === "DATABASE" && (scanType === "INFRA" || scanType === "FULL")) {
        const host = cand.host ?? cand.domain;
        if (host) {
          const infraReport = infraReports.find((r) => r.host === host);
          const defaultDbPorts = [27017, 3306, 1433, 5432, 1521];
          const dbPorts = cand.port ? [cand.port] : defaultDbPorts.filter((p) => infraReport?.openPorts.includes(p));
          if (!dbPorts.length) {
            engineNotes.push(`${asset.name}: no database port observed (no credentialed DB audit)`);
          } else {
            const dbCreds: DbCredentials = {};
            const credIds: string[] = [];
            for (const c of credentialsByAsset[asset.id] ?? []) {
              if (c.kind !== "mongo" && c.kind !== "mysql") continue;
              const val = decryptCred(c.secretCiphertext);
              if (!val) {
                engineNotes.push(`${asset.name}: stored ${c.kind} credential unreadable (AUTH_SECRET changed?)`);
                continue;
              }
              credIds.push(c.id);
              dbCreds[c.kind as "mongo" | "mysql"] = { user: c.username, password: val };
            }
            if (credIds.length) {
              await db.vaptCredential.updateMany({ where: { id: { in: credIds } }, data: { lastUsedAt: now } });
            }
            for (const dbPort of dbPorts) {
              const report = await auditDatabase(host, dbPort, dbCreds, 2_500);
              dbReports.push({
                asset: asset.name,
                host,
                port: dbPort,
                protocol: report.protocol,
                reachable: report.reachable,
                mongo: report.mongo
                  ? { authEnabled: report.mongo.authEnabled, version: report.mongo.version, databases: report.mongo.databases, scramOk: report.mongo.scramOk }
                  : undefined,
                mysql: report.mysql
                  ? { authEnabled: report.mysql.authEnabled, version: report.mysql.version, loginOk: report.mysql.loginOk }
                  : undefined,
              });
              if (!report.protocol) {
                engineNotes.push(`${asset.name}:${dbPort}: no database wire protocol detected`);
                continue;
              }
              infraReal = true;
              const drafts = dbVulnsFromReport(report);
              for (const d of drafts) {
                await persist(asset.id, asset, d, d.cveId ?? d.title, `db:${dbPort}`);
              }
            }
          }
        }
      }

      // ── REAL DAST engine ────────────────────────────────────────────────
      if (isWebKind && (scanType === "DAST" || scanType === "FULL")) {
        const targetUrl = asset.identifier.startsWith("http") ? asset.identifier : `http://${asset.identifier}`;
        const report = await runDastScan(targetUrl);
        dastReports.push({ asset: asset.name, target: report.target, reachable: report.reachable, checks: report.checks.map((c) => ({ id: c.id, result: c.result })) });
        if (!report.reachable) {
          unreachable.push(`${asset.name} (${report.error ?? "unreachable"})`);
        } else {
          dastReal = true;
          const drafts = dastVulnsFromReport(report);
          for (const d of drafts) {
            await persist(asset.id, asset, d, d.cveId ?? d.title, report.target);
          }
        }
      }
    }

    // ── Auto-close: open findings of scanned assets NOT re-observed by a
    //    FULL scan are verified fixed (plan §4 "Auto-close findings not seen
    //    in the next full scan"). Only FULL coverage justifies the claim.
    let autoClosedCount = 0;
    if (scanType === "FULL") {
      const scannedAssetIds = assets.map((a) => a.id);
      // Only LIVE-engine findings (those carrying fingerprints) may be
      // auto-closed — seeded/reference-catalogue history is never verified
      // away by an engine that never produced it.
      const openFindings = await db.vaptVulnerability.findMany({
        where: { organizationId, assetId: { in: scannedAssetIds }, status: { in: ["open", "in_progress"] }, fingerprint: { not: null } },
      });
      for (const f of openFindings) {
        const fp = f.fingerprint;
        if (fp && !observedFingerprints.has(fp)) {
          await db.vaptVulnerability.update({
            where: { id: f.id },
            data: { status: "remediated", remediatedAt: now },
          });
          autoClosedCount++;
          await appendVaptAudit({
            type: "FINDING_AUTOCLOSED",
            actorId: user.id,
            actorEmail: user.email,
            organizationId,
            target: f.title,
            action: `Finding auto-closed as verified-fixed — not re-observed by the FULL rescan of its asset`,
            result: "remediated (verified)",
            payload: { vulnerabilityId: f.id, fingerprint: fp, scanId: scan.id },
          });
        }
      }
    }

    const vulns = await db.vaptVulnerability.findMany({ where: { scanId: scan.id } });
    const summary = summariseVulns(vulns, new Date());

    const completed = await db.vaptScan.update({
      where: { id: scan.id },
      data: {
        status: "COMPLETED",
        newCount,
        knownCount,
        autoClosedCount,
        dastReal,
        infraReal,
        engineMode: "live",
        summary: JSON.stringify(summary),
        completedAt: new Date(),
        durationMs: Date.now() - startedAt,
        detail: [
          `Engine: live (real TCP/TLS/HTTP probes + banner→CVE feed matching; feed data as of the bundled snapshot).`,
          `Scope: ${effectiveScope?.name ?? "auto-resolved"} (${profile} profile).`,
          unreachable.length ? `Unreachable target(s): ${unreachable.join(", ")}.` : "",
          engineNotes.join(" "),
        ].filter(Boolean).join(" "),
      },
    });

    await appendVaptAudit({
      type: "SCAN_COMPLETED",
      actorId: user.id,
      actorEmail: user.email,
      organizationId,
      target: effectiveScope?.name ?? `${assets.length} target(s)`,
      action: `VAPT ${scanType} (${profile}) scan "${completed.name}" completed for ${org.name}`,
      result: `${newCount} new, ${knownCount} known, ${autoClosedCount} auto-closed${infraReal ? ", live INFRA" : ""}${dastReal ? ", live DAST" : ""}`,
      payload: { scanId: scan.id, newCount, knownCount, autoClosedCount, infraReal, dastReal, unreachable },
    });
    await audit({
      type: "VAPT_SCAN_COMPLETED",
      userId: user.id,
      email: user.email,
      organizationId,
      ip: clientIp(req.headers),
      userAgent: req.headers.get("user-agent"),
      detail: `VAPT ${scanType} scan "${completed.name}" for ${org.name}: ${assets.length} target(s), ${newCount} new, ${knownCount} known, ${autoClosedCount} auto-closed${infraReal ? ", live INFRA" : ""}${dastReal ? ", live DAST" : ""}.`,
    });

    return NextResponse.json({ scan: { ...completed, summary }, dastReports, snmpReports, dbReports, infraReports }, { status: 201 });
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
    await appendVaptAudit({
      type: "SCAN_FAILED",
      actorId: user.id,
      actorEmail: user.email,
      organizationId,
      target: effectiveScope?.name ?? "scan",
      action: `VAPT ${scanType} scan "${failed.name}" failed`,
      result: err instanceof Error ? err.message.slice(0, 200) : "engine error",
      payload: { scanId: scan.id },
    });
    return NextResponse.json({ error: "Scan failed", scan: failed }, { status: 502 });
  }
}
