import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuthAny } from "@/lib/auth/guard";
import { audit } from "@/lib/auth/audit";
import { clientIp } from "@/lib/auth/rate-limit";
import { IntelFeedError, enrichIpGreynoise, enrichVirusTotal, vtTargetKind } from "@/lib/soc/intel-feeds";

export const runtime = "nodejs";

/**
 * POST /api/threats/intel/enrich — per-target enrichment, two engines
 * (roadmap Phase 1 item 4 + Phase 2 item 5.2):
 *
 *   { ip: "203.0.113.10" }            → GreyNoise Community: "is this IP a
 *                                       known internet-wide scanner, and with
 *                                       what intent?" — the enrichment a
 *                                       professional SOC runs on raw noisy
 *                                       events before paging a human.
 *   { target: "8.8.8.8 | https://…    → VirusTotal reputation: engine verdict
 *     | <md5/sha1/sha256>" }            and community reputation for an IP,
 *                                       URL or file hash — the reputation an
 *                                       analyst wants on an evidence
 *                                       artefact before acting on it.
 *
 * Unconfigured engines (GREYNOISE_API_KEY / VIRUSTOTAL_API_KEY unset) →
 * honest 503, never a fabricated classification. When the enriched value
 * matches an existing hub indicator exactly, the enrichment also records a
 * sighting — intel-driven workflow, audited.
 */
export async function POST(req: NextRequest) {
  const guard = await requireAuthAny(req, ["threats:view"]);
  if (guard.error) return guard.error;
  const { user } = guard;

  const body = await req.json().catch(() => ({}));
  const ip = typeof body.ip === "string" ? body.ip.trim() : "";
  const target = typeof body.target === "string" ? body.target.trim() : "";

  // ── GreyNoise path (IPv4) ──────────────────────────────────────────────────
  if (ip && !target) {
    let enrichment;
    try {
      enrichment = await enrichIpGreynoise(ip);
    } catch (err) {
      if (err instanceof IntelFeedError) {
        return NextResponse.json({ error: { code: err.code, message: err.message } }, { status: err.httpStatus });
      }
      return NextResponse.json({ error: { code: "ENRICH_FAILED", message: err instanceof Error ? err.message : "unknown error" } }, { status: 502 });
    }

    // Record a sighting when this exact IP is already tracked in the hub.
    const existing = await db.threatIndicator.findUnique({ where: { type_value: { type: "ip", value: ip } } });
    let sighting = false;
    if (existing) {
      await db.threatIndicator.update({
        where: { id: existing.id },
        data: { sightings: { increment: 1 }, lastSeenAt: new Date() },
      });
      sighting = true;
    }

    await audit({
      type: "PUBLIC_INTEL_ENRICH",
      userId: user.id,
      email: user.email,
      organizationId: user.orgId,
      ip: clientIp(req.headers),
      userAgent: req.headers.get("user-agent"),
      detail: `GreyNoise enrichment for ${ip} — noise: ${enrichment.noise ? "yes" : "no"}${enrichment.riot === true ? ", RIOT: yes" : ""}`,
    });

    return NextResponse.json({ enrichment, sighting });
  }

  // ── VirusTotal path (IP / URL / file hash) ────────────────────────────────
  if (target && !ip) {
    let enrichment;
    try {
      enrichment = await enrichVirusTotal(target);
    } catch (err) {
      if (err instanceof IntelFeedError) {
        return NextResponse.json({ error: { code: err.code, message: err.message } }, { status: err.httpStatus });
      }
      return NextResponse.json({ error: { code: "ENRICH_FAILED", message: err instanceof Error ? err.message : "unknown error" } }, { status: 502 });
    }

    // Record a sighting when this exact target is already tracked in the hub.
    const kind = vtTargetKind(target);
    const hubType =
      kind === "ip" ? "ip" : kind === "url" ? "url" : target.length === 32 ? "hash_md5" : target.length === 64 ? "hash_sha256" : null;
    let sighting = false;
    if (hubType) {
      const existing = await db.threatIndicator.findUnique({ where: { type_value: { type: hubType, value: target } } });
      if (existing) {
        await db.threatIndicator.update({
          where: { id: existing.id },
          data: { sightings: { increment: 1 }, lastSeenAt: new Date() },
        });
        sighting = true;
      }
    }

    await audit({
      type: "PUBLIC_INTEL_ENRICH",
      userId: user.id,
      email: user.email,
      organizationId: user.orgId,
      ip: clientIp(req.headers),
      userAgent: req.headers.get("user-agent"),
      detail: `VirusTotal reputation for ${target} — ${enrichment.verdict} (${enrichment.engineCount})${enrichment.reputation !== null ? `, reputation ${enrichment.reputation}` : ""}`,
    });

    return NextResponse.json({ enrichment, sighting });
  }

  return NextResponse.json(
    { error: { code: "TARGET_REQUIRED", message: "Provide { ip } for GreyNoise enrichment or { target } (IP / URL / hash) for VirusTotal reputation." } },
    { status: 400 }
  );
}
