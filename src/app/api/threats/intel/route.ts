import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuthAny } from "@/lib/auth/guard";
import { can } from "@/lib/auth/rbac";
import { audit } from "@/lib/auth/audit";
import { clientIp } from "@/lib/auth/rate-limit";
import { classifySensitivity, hybridSharingDecision } from "@/lib/soc-engine";
import {
  intelConfig,
  intelFeedStatuses,
  IntelFeedError,
  IntelFeedId,
  IntelIndicatorInput,
  runIntelFetch,
} from "@/lib/intel-feeds";

export const runtime = "nodejs";

/** ThreatIndicator.source value per feed (extends the ETHIO_CERT | MISP_FEED | … set). */
const FEED_SOURCE: Record<Exclude<IntelFeedId, "greynoise">, string> = {
  cisa_kev: "CISA_KEV",
  spamhaus_drop: "SPAMHAUS_DROP",
  urlhaus: "URLHAUS",
  threatfox: "THREATFOX",
  otx: "OTX",
};

const SEV_ORDER = ["critical", "high", "medium", "low"];

/**
 * POST /api/threats/intel — public threat-intel feed synchronisation (Phase 1
 * of the Real-Data Roadmap: CISA KEV + Spamhaus DROP live, URLhaus /
 * ThreatFox / OTX key-gated).
 *
 * Body: { source?: "all" | "cisa_kev" | "spamhaus_drop" | "urlhaus" | "threatfox" | "otx" }
 *
 * Honesty contract, per feed:
 *   live      — SyncRun source LIVE, endpoint recorded, entries ingested
 *   snapshot  — SyncRun source SNAPSHOT + as-of detail (offline degradation,
 *              never presented as live)
 *   failed    — configured keyed feed failing → SyncRun status "failed" (502
 *              when it was the only requested feed)
 *   skipped   — keyed feed without a key in an "all" run: visible in the
 *              response, never recorded as an ingest run
 * Every run is written to the hash-chained audit log. Dedupe on (type, value):
 * new indicators are created, known ones get a sighting + lastSeen refresh +
 * severity escalation when the feed raised it.
 */
export async function POST(req: NextRequest) {
  const guard = await requireAuthAny(req, ["threats:sync"]);
  if (guard.error) return guard.error;
  const { user } = guard;
  if (!can(user.role, "soc:manage-all")) {
    return NextResponse.json({ error: "Public-intel synchronisation is performed by the platform SOC." }, { status: 403 });
  }

  const cfg = intelConfig();
  if (cfg.disabled) {
    return NextResponse.json(
      { error: { code: "INTEL_FEEDS_OFF", message: "Public intel feeds are disabled (INTEL_FEEDS_OFF)." } },
      { status: 503 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const requested = String(body.source ?? "all");
  if (requested !== "all" && !(requested in FEED_SOURCE)) {
    return NextResponse.json(
      { error: { code: "BAD_SOURCE", message: `source must be "all" or one of: ${Object.keys(FEED_SOURCE).join(", ")}.` } },
      { status: 400 }
    );
  }

  const keyedConfigured = (feed: Exclude<IntelFeedId, "greynoise">): boolean => {
    if (feed === "urlhaus" || feed === "threatfox") return !!cfg.abusechKey;
    if (feed === "otx") return !!cfg.otxKey;
    return true; // key-less feeds are always runnable
  };

  const feeds: Exclude<IntelFeedId, "greynoise">[] =
    requested === "all"
      ? (Object.keys(FEED_SOURCE) as Exclude<IntelFeedId, "greynoise">[]).filter(keyedConfigured)
      : [requested as Exclude<IntelFeedId, "greynoise">];

  // Explicitly requesting a keyed feed whose key is missing → honest 503, no run.
  if (requested !== "all" && !keyedConfigured(feeds[0])) {
    return NextResponse.json(
      { error: { code: "UNCONFIGURED", feed: feeds[0], message: `${feeds[0]} key is not configured for this deployment.` } },
      { status: 503 }
    );
  }

  const skipped: { feed: string; code: string; message: string }[] = [];
  if (requested === "all") {
    // Visible in the response — not silently omitted, not recorded as a run.
    for (const f of Object.keys(FEED_SOURCE) as Exclude<IntelFeedId, "greynoise">[]) {
      if (!keyedConfigured(f)) {
        skipped.push({
          feed: f,
          code: "UNCONFIGURED",
          message: f === "otx" ? "OTX_API_KEY is not set — free key from otx.alienvault.com." : "ABUSECH_AUTH_KEY is not set — free Auth-Key from auth.abuse.ch.",
        });
      }
    }
  }

  const { results, errors } = await runIntelFetch(feeds);

  const runs: Record<string, unknown>[] = [];
  const summary: Record<string, { label: string; mode: "live" | "snapshot" | "failed"; asOf: string; ingested: number; updated: number; skippedInvalid: number; note?: string }> = {};

  /** createMany row type, inferred structurally (no codegen type re-export). */
  type CreateManyArgs = NonNullable<Parameters<typeof db.threatIndicator.createMany>[0]>;
  type CreateRow = CreateManyArgs["data"] extends infer D
    ? D extends (infer R)[]
      ? R
      : never
    : never;

  /**
   * Bulk ingestion (a full DROP sync is ~1.7k rows — per-row findUnique +
   * create would dominate the request). Chunked lookups, one createMany for
   * the new rows, one bulk UPDATE for the sightings/lastSeen refresh, and
   * per-row updates ONLY for the rare escalations / provenance refreshes.
   */
  const CHUNK = 400;
  const chunk = <T>(arr: T[]): T[][] => {
    const out: T[][] = [];
    for (let i = 0; i < arr.length; i += CHUNK) out.push(arr.slice(i, i + CHUNK));
    return out;
  };

  for (const res of results) {
    const source = FEED_SOURCE[res.feed];
    let ingested = 0;
    let updated = 0;

    const entries: IntelIndicatorInput[] = [];
    const seenValues = new Set<string>();
    let duplicates = 0;
    for (const entry of res.entries as IntelIndicatorInput[]) {
      const key = `${entry.type}|${entry.value}`;
      if (seenValues.has(key)) {
        duplicates++; // feeds occasionally repeat an indicator — dedupe, never double-ingest
        continue;
      }
      seenValues.add(key);
      entries.push(entry);
    }
    const existingByKey = new Map<string, { id: string; severity: string; source: string; sourceRef: string | null; confidence: number }>();
    for (const part of chunk(entries)) {
      const rows = await db.threatIndicator.findMany({
        where: { OR: part.map((e) => ({ type: e.type, value: e.value })) },
        select: { id: true, type: true, value: true, severity: true, source: true, sourceRef: true, confidence: true },
      });
      for (const r of rows) existingByKey.set(`${r.type}|${r.value}`, r);
    }

    const creates: CreateRow[] = [];
    const refreshIds: string[] = [];
    const escalations: { id: string; severity: string }[] = [];
    const provenance: { id: string; sourceRef: string; confidence: number }[] = [];
    for (const entry of entries) {
      const existing = existingByKey.get(`${entry.type}|${entry.value}`);
      if (!existing) {
        const sensitivity = classifySensitivity(entry.category, entry.tlp, entry.confidence);
        const decision = hybridSharingDecision({ tlp: entry.tlp, sensitivity, category: entry.category });
        creates.push({
          type: entry.type,
          value: entry.value,
          titleEn: entry.titleEn,
          titleAm: "",
          descriptionEn: entry.descriptionEn ?? null,
          category: entry.category,
          severity: entry.severity,
          tlp: entry.tlp,
          source,
          sourceRef: entry.sourceRef,
          confidence: entry.confidence,
          sensitivity,
          sharing: decision.mode,
          organizationId: null,
          firstSeenAt: entry.firstSeenAt ? new Date(entry.firstSeenAt) : new Date(),
          lastSeenAt: new Date(),
        });
      } else {
        updated++;
        refreshIds.push(existing.id);
        if (SEV_ORDER.indexOf(entry.severity) < SEV_ORDER.indexOf(existing.severity)) {
          escalations.push({ id: existing.id, severity: entry.severity });
        }
        if (existing.source === source && (existing.sourceRef !== entry.sourceRef || existing.confidence !== entry.confidence)) {
          provenance.push({ id: existing.id, sourceRef: entry.sourceRef, confidence: entry.confidence });
        }
      }
    }

    for (const part of chunk(creates)) {
      // NOTE: skipDuplicates is unsupported on SQLite; the chunked findMany above
      // has already de-duplicated within this single-writer route.
      await db.threatIndicator.createMany({ data: part });
      ingested += part.length;
    }
    for (const part of chunk(refreshIds)) {
      await db.threatIndicator.updateMany({
        where: { id: { in: part } },
        data: { sightings: { increment: 1 }, lastSeenAt: new Date() },
      });
    }
    for (const e of escalations) {
      await db.threatIndicator.update({ where: { id: e.id }, data: { severity: e.severity } });
    }
    for (const p of provenance) {
      await db.threatIndicator.update({ where: { id: p.id }, data: { sourceRef: p.sourceRef, confidence: p.confidence } });
    }

    const run = await db.syncRun.create({
      data: {
        direction: "INGEST",
        status: "success",
        source: res.mode === "live" ? "LIVE" : "SNAPSHOT",
        endpoint: res.endpoint,
        ingested,
        updated,
        triggeredById: user.id,
        detail:
          res.mode === "live"
            ? `${res.label} LIVE (${res.asOf}): ${ingested} new indicator(s), ${updated} refreshed${res.skippedInvalid ? `, ${res.skippedInvalid} invalid skipped` : ""}${duplicates ? `, ${duplicates} in-feed duplicate(s) deduplicated` : ""}${res.note ? ` · ${res.note}` : ""}`
            : `${res.label} SNAPSHOT (${res.asOf}): ${ingested} new indicator(s), ${updated} refreshed${res.note ? ` · ${res.note}` : ""}`,
      },
    });
    runs.push({ ...run, feed: res.feed });
    summary[res.feed] = {
      label: res.label,
      mode: res.mode,
      asOf: res.asOf,
      ingested,
      updated,
      skippedInvalid: res.skippedInvalid,
      ...(res.note ? { note: res.note } : {}),
    };

    await audit({
      type: "PUBLIC_INTEL_SYNC",
      userId: user.id,
      email: user.email,
      organizationId: null,
      ip: clientIp(req.headers),
      userAgent: req.headers.get("user-agent"),
      detail: `INGEST (${res.mode.toUpperCase()}) from ${res.label} — ${ingested} new, ${updated} refreshed`,
    });
  }

  const failed: { feed: string; code: string; message: string }[] = [];
  for (const err of errors) {
    await db.syncRun.create({
      data: {
        direction: "INGEST",
        status: "failed",
        source: "LIVE",
        endpoint: err.endpoint === "-" ? null : err.endpoint,
        triggeredById: user.id,
        detail: `${FEED_SOURCE[err.feed as Exclude<IntelFeedId, "greynoise">] ?? err.feed} feed failed: ${err.message}`,
      },
    });
    await audit({
      type: "PUBLIC_INTEL_SYNC",
      userId: user.id,
      email: user.email,
      organizationId: null,
      ip: clientIp(req.headers),
      userAgent: req.headers.get("user-agent"),
      detail: `INGEST FAILED from ${err.feed} — ${err.message}`,
    });
    failed.push({ feed: err.feed, code: err.code, message: err.message });
  }

  return NextResponse.json({
    runs,
    summary,
    skipped,
    failed,
    totals: {
      ingested: results.reduce((a, r) => a + (summary[r.feed]?.ingested ?? 0), 0),
      updated: results.reduce((a, r) => a + (summary[r.feed]?.updated ?? 0), 0),
      feeds: results.length,
    },
  });
}

/**
 * GET /api/threats/intel — connector statuses for the SOC honesty panel:
 * every feed shows its configuration, its bundled-snapshot as-of (if any) and
 * its last synchronisation run. Keyed feeds say "key required" instead of
 * pretending to be live.
 */
export async function GET(req: NextRequest) {
  const guard = await requireAuthAny(req, ["threats:view"]);
  if (guard.error) return guard.error;

  const cfg = intelConfig();
  const statuses = intelFeedStatuses();
  const feeds = await Promise.all(
    statuses.map(async (f) => {
      const last = await db.syncRun.findFirst({
        where: { endpoint: f.endpoint },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true, status: true, source: true, ingested: true, updated: true, detail: true },
      });
      return { ...f, lastSync: last ?? null };
    })
  );

  return NextResponse.json({
    disabled: cfg.disabled,
    greynoise: { configured: !!cfg.greynoiseKey, endpoint: "https://api.greynoise.io/v3/community/{ip}" },
    feeds,
  });
}
