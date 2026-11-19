import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { db } from "@/lib/db";
import { requireAuthAny } from "@/lib/auth/guard";
import { can } from "@/lib/auth/rbac";
import { audit } from "@/lib/auth/audit";
import { clientIp } from "@/lib/auth/rate-limit";
import { anonymiseForHub, classifySensitivity, hybridSharingDecision, notificationLatency, RQ3_TARGET_MINUTES } from "@/lib/soc/soc-engine";
import {
  bindingStatus,
  deliverReport,
  EthioCertError,
  fetchNationalFeed,
} from "@/lib/ethio/ethiocert-client";

export const runtime = "nodejs";

/**
 * POST /api/threats/sync — Ethio-CERT synchronisation layer (exchange-bound).
 *
 *  direction=ingest (SUPER_ADMIN): pull the national feed DOWN into the hub —
 *    bound to {ETHIOCERT_API_URL}/feed when configured, otherwise the bundled
 *    pilot fixture. Dedupe on (type, value): new indicators are created, known
 *    ones get a sighting + lastSeen refresh + severity escalation if the feed
 *    raised it. A configured-but-failing exchange is a FAILED run (502), never
 *    a silent fixture fall-back.
 *
 *  direction=report (org admin/officer, or super with ?org=): push an
 *    anonymised tenant summary UP to {ETHIOCERT_API_URL}/reports —
 *    category/severity counts, latency statistics and hub-visible indicators,
 *    with NO organisation identity and NO incident titles (privacy-preserving
 *    protocol). The payload is hashed (sha256), the exchange returns a
 *    receiptId, and both are stored on the SyncRun so the export is provable
 *    to a supervisor end-to-end.
 */
export async function POST(req: NextRequest) {
  const guard = await requireAuthAny(req, ["threats:sync"]);
  if (guard.error) return guard.error;
  const { user } = guard;

  const body = await req.json().catch(() => ({}));
  const direction = String(body.direction || "ingest");
  const isSuper = can(user.role, "soc:manage-all");

  // ── Downward: ingest the national feed ────────────────────────────────────
  if (direction === "ingest") {
    if (!isSuper) {
      return NextResponse.json({ error: "National-feed ingestion is performed by the platform SOC." }, { status: 403 });
    }

    let feed;
    try {
      feed = await fetchNationalFeed();
    } catch (err) {
      // Failed binding: record it, surface it — never fall back silently.
      const ec = err instanceof EthioCertError ? err : null;
      const message = err instanceof Error ? err.message : "unknown error";
      await db.syncRun.create({
        data: {
          direction: "INGEST",
          status: "failed",
          source: "LIVE",
          endpoint: ec?.endpoint ?? bindingStatus().endpoint,
          triggeredById: user.id,
          detail: `Exchange binding failed: ${message}`,
        },
      });
      await audit({
        type: "ETHIOCERT_SYNC",
        userId: user.id,
        email: user.email,
        organizationId: null,
        ip: clientIp(req.headers),
        userAgent: req.headers.get("user-agent"),
        detail: `INGEST FAILED — ${message}`,
      });
      return NextResponse.json(
        { error: { code: ec?.code ?? "ETHIOCERT_UNREACHABLE", message } },
        { status: ec?.httpStatus ?? 502 }
      );
    }

    const mode = feed.mode === "live" ? "LIVE" : "FIXTURE";
    let ingested = 0;
    let updated = 0;
    for (const entry of feed.entries) {
      const sensitivity = classifySensitivity(entry.category, entry.tlp, entry.confidence);
      const decision = hybridSharingDecision({ tlp: entry.tlp, sensitivity, category: entry.category });
      const existing = await db.threatIndicator.findUnique({ where: { type_value: { type: entry.type, value: entry.value } } });
      if (!existing) {
        await db.threatIndicator.create({
          data: {
            type: entry.type,
            value: entry.value,
            titleEn: entry.titleEn,
            titleAm: entry.titleAm,
            descriptionEn: entry.descriptionEn ?? null,
            descriptionAm: entry.descriptionAm ?? null,
            category: entry.category,
            severity: entry.severity,
            tlp: entry.tlp,
            source: "ETHIO_CERT",
            sourceRef: entry.bulletin,
            confidence: entry.confidence,
            sensitivity,
            sharing: decision.mode, // national feed respects the same hybrid model
            organizationId: null,
            firstSeenAt: new Date(),
            lastSeenAt: new Date(),
          },
        });
        ingested++;
      } else {
        // Known indicator: refresh sighting, escalate severity if raised.
        const escalate =
          ["critical", "high", "medium", "low"].indexOf(entry.severity) <
          ["critical", "high", "medium", "low"].indexOf(existing.severity);
        await db.threatIndicator.update({
          where: { id: existing.id },
          data: {
            sightings: { increment: 1 },
            lastSeenAt: new Date(),
            ...(escalate ? { severity: entry.severity } : {}),
            ...(existing.source === "ETHIO_CERT" ? { sourceRef: entry.bulletin } : {}),
          },
        });
        updated++;
      }
    }

    const run = await db.syncRun.create({
      data: {
        direction: "INGEST",
        status: "success",
        source: mode,
        endpoint: feed.endpoint,
        ingested,
        updated,
        triggeredById: user.id,
        detail:
          mode === "LIVE"
            ? `Ethio-CERT exchange (${feed.endpoint}): ${ingested} new indicator(s), ${updated} refreshed${feed.skippedInvalid ? `, ${feed.skippedInvalid} invalid entry(ies) skipped` : ""}`
            : `Ethio-CERT pilot fixture: ${ingested} new indicator(s), ${updated} refreshed (no exchange endpoint configured)`,
      },
    });

    await audit({
      type: "ETHIOCERT_SYNC",
      userId: user.id,
      email: user.email,
      organizationId: null,
      ip: clientIp(req.headers),
      userAgent: req.headers.get("user-agent"),
      detail: `INGEST (${mode}) from Ethio-CERT — ${ingested} new, ${updated} refreshed`,
    });

    return NextResponse.json({
      run,
      ingested,
      updated,
      feed: { mode: feed.mode, endpoint: feed.endpoint, entryCount: feed.entries.length, skippedInvalid: feed.skippedInvalid },
    });
  }

  // ── Upward: anonymised report to Ethio-CERT ───────────────────────────────
  if (direction === "report") {
    // An org user reports its own activity; naming a foreign tenant is an
    // explicit cross-tenant attempt → 403 (never silently re-pinned).
    if (!isSuper && typeof body.organizationId === "string" && body.organizationId !== user.orgId) {
      return NextResponse.json({ error: "You can only report your own organization's activity." }, { status: 403 });
    }
    const organizationId = isSuper && typeof body.organizationId === "string" ? body.organizationId : user.orgId;
    if (!organizationId) {
      return NextResponse.json({ error: { code: "ORG_REQUIRED", message: "No organization to report for." } }, { status: 400 });
    }
    if (!isSuper && organizationId !== user.orgId) {
      return NextResponse.json({ error: "You can only report your own organization's activity." }, { status: 403 });
    }
    const org = await db.organization.findUnique({
      where: { id: organizationId },
      select: { id: true, name: true, sector: true },
    });
    if (!org) return NextResponse.json({ error: "Organization not found." }, { status: 404 });

    const since = new Date(Date.now() - 30 * 86_400_000);
    const incidents = await db.incident.findMany({
      where: { organizationId, detectedAt: { gte: since } },
      select: { category: true, severity: true, status: true, detectedAt: true, notifiedAt: true },
    });
    const indicators = await db.threatIndicator.findMany({
      where: { organizationId, isActive: true },
      select: { type: true, value: true, category: true, severity: true, tlp: true, confidence: true, descriptionEn: true },
    });

    // Privacy-preserving payload: counts and anonymised indicators ONLY —
    // no organisation name, no incident titles, no free-text notes.
    const byCategory: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};
    for (const i of incidents) {
      byCategory[i.category] = (byCategory[i.category] ?? 0) + 1;
      bySeverity[i.severity] = (bySeverity[i.severity] ?? 0) + 1;
    }
    const latency = notificationLatency(incidents);
    const payload = {
      reportType: "ADWA_CYBER_TENANT_SUMMARY",
      protocol: "privacy-preserving (Procl. 1321/2024 Art. 22 data-minimisation)",
      period: { since: since.toISOString(), until: new Date().toISOString() },
      reportingEntity: "A member organisation of the Adwa Cyber sharing community", // anonymised
      sector: org.sector, // sector-level attribution only
      incidentCounts: { total: incidents.length, byCategory, bySeverity },
      notificationLatency: {
        targetMedianMin: RQ3_TARGET_MINUTES,
        samples: latency.count,
        medianMin: latency.medianMin,
        p90Min: latency.p90Min,
        withinTarget: latency.withinTarget,
      },
      indicators: indicators.map((i) => anonymiseForHub(i)),
    };
    const payloadJson = JSON.stringify(payload, null, 2);
    const payloadHash = createHash("sha256").update(payloadJson).digest("hex");

    let delivery;
    try {
      delivery = await deliverReport(payloadJson);
    } catch (err) {
      const ec = err instanceof EthioCertError ? err : null;
      const message = err instanceof Error ? err.message : "unknown error";
      await db.syncRun.create({
        data: {
          direction: "REPORT",
          status: "failed",
          source: "LIVE",
          endpoint: ec?.endpoint ?? bindingStatus().endpoint,
          reported: incidents.length,
          payloadHash,
          organizationId,
          triggeredById: user.id,
          detail: `Upward report NOT delivered — exchange rejected: ${message}`,
        },
      });
      await audit({
        type: "ETHIOCERT_SYNC",
        userId: user.id,
        email: user.email,
        organizationId,
        ip: clientIp(req.headers),
        userAgent: req.headers.get("user-agent"),
        detail: `REPORT FAILED for ${org.name} — ${message}`,
      });
      return NextResponse.json(
        { error: { code: ec?.code ?? "ETHIOCERT_UNREACHABLE", message } },
        { status: ec?.httpStatus ?? 502 }
      );
    }

    const mode = delivery.mode === "live" ? "LIVE" : "FIXTURE";
    const run = await db.syncRun.create({
      data: {
        direction: "REPORT",
        status: "success",
        source: mode,
        endpoint: delivery.endpoint,
        receiptId: delivery.receiptId,
        reported: incidents.length,
        payloadHash,
        organizationId,
        triggeredById: user.id,
        detail:
          mode === "LIVE"
            ? `Delivered to Ethio-CERT exchange — receipt ${delivery.receiptId}: ${incidents.length} incident(s) in 30d, ${indicators.length} anonymised indicator(s), payload sha256 ${payloadHash.slice(0, 16)}…`
            : `Recorded locally (pilot fixture, no exchange configured): ${incidents.length} incident(s) in 30d, ${indicators.length} anonymised indicator(s), payload sha256 ${payloadHash.slice(0, 16)}…`,
      },
    });

    await audit({
      type: "ETHIOCERT_SYNC",
      userId: user.id,
      email: user.email,
      organizationId,
      ip: clientIp(req.headers),
      userAgent: req.headers.get("user-agent"),
      detail:
        mode === "LIVE"
          ? `REPORT delivered to Ethio-CERT for ${org.name} — receipt ${delivery.receiptId}, ${incidents.length} incident(s), sha256 ${payloadHash.slice(0, 16)}…`
          : `REPORT recorded locally (fixture) for ${org.name} — ${incidents.length} incident(s), sha256 ${payloadHash.slice(0, 16)}…`,
    });

    return NextResponse.json({
      run,
      payload: JSON.parse(payloadJson),
      payloadHash,
      delivery: { mode: delivery.mode, endpoint: delivery.endpoint, receiptId: delivery.receiptId },
    });
  }

  return NextResponse.json({ error: 'direction must be "ingest" or "report".' }, { status: 400 });
}

/** GET /api/threats/sync — binding status + recent synchronisation runs. */
export async function GET(req: NextRequest) {
  const guard = await requireAuthAny(req, ["threats:view"]);
  if (guard.error) return guard.error;
  const { user } = guard;

  const isSuper = can(user.role, "soc:view-all");
  const runs = await db.syncRun.findMany({
    where: isSuper ? {} : { organizationId: user.orgId },
    include: {
      organization: { select: { name: true } },
      triggeredBy: { select: { name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return NextResponse.json({
    binding: bindingStatus(),
    runs: isSuper
      ? runs
      : runs.map((r) => ({ ...r, payloadHash: r.payloadHash?.slice(0, 16) ?? null })), // tenants see the short hash only
  });
}
