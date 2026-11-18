import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuthAny } from "@/lib/auth/guard";
import { audit } from "@/lib/auth/audit";
import { clientIp } from "@/lib/auth/rate-limit";
import { IntelFeedError, enrichIpGreynoise } from "@/lib/intel-feeds";

export const runtime = "nodejs";

/**
 * POST /api/threats/intel/enrich — GreyNoise Community per-IP enrichment
 * (roadmap Phase 1 item 4): "is this IP a known internet-wide scanner, and
 * with what intent?" — the enrichment a professional SOC runs on raw noisy
 * events before paging a human.
 *
 * Body: { ip: "203.0.113.10" }
 * Unconfigured (GREYNOISE_API_KEY unset) → honest 503, never a fabricated
 * classification. When the IP matches an existing hub indicator exactly, the
 * enrichment also records a sighting — intel-driven workflow, audited.
 */
export async function POST(req: NextRequest) {
  const guard = await requireAuthAny(req, ["threats:view"]);
  if (guard.error) return guard.error;
  const { user } = guard;

  const body = await req.json().catch(() => ({}));
  const ip = String(body.ip ?? "").trim();
  if (!ip) {
    return NextResponse.json({ error: { code: "IP_REQUIRED", message: "An IPv4 address is required." } }, { status: 400 });
  }

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
