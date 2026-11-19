import { NextRequest, NextResponse } from "next/server";
import { requireAuthAny } from "@/lib/auth/guard";
import { googleConfigured, googleMockMode } from "@/lib/auth/google";
import { activeTransport } from "@/lib/auth/mail";
import { bindingStatus } from "@/lib/ethio/ethiocert-client";
import { ethioWebConfig } from "@/lib/ethio/ethiocert-web";
import ethiocertApiSnapshot from "@/lib/ethio/ethio-snapshots/ethiocert-api.json";
import { intelConfig } from "@/lib/soc/intel-feeds";
import kevSnapshot from "@/lib/soc/intel-snapshots/kev.json";
import dropSnapshot from "@/lib/soc/intel-snapshots/spamhaus-drop.json";
import { epssConfig } from "@/lib/vapt/vapt-epss";
import { FEED_AS_OF } from "@/lib/vapt/vapt-cve-feed";
import { buildBindingsReport } from "@/lib/bindings";

export const runtime = "nodejs";

/**
 * GET /api/system/bindings — the production bindings registry
 * (Real-Data Roadmap Phase 3). SUPER_ADMIN only (`orgs:manage`).
 *
 * One honest surface for every external integration the platform can bind:
 * Google SSO, SMTP mail, the Ethio-CERT bilateral exchange, the public and
 * keyed intel feeds, live EPSS and the engine's offline-first reference
 * catalogue — each with a closed-set status (live | mock | fixture |
 * snapshot | unconfigured | disabled), the env vars that flip it, snapshot
 * as-of dates and the ops refresh command.
 *
 * Security: descriptors carry env var NAMES and booleans only — secret
 * values (API keys, client secrets, passwords) never enter the response.
 * Statuses are derived from the same env-driven functions the live code
 * paths use (auth/google, auth/mail, ethio clients, soc/intel-feeds,
 * vapt/epss), so the console can never disagree with reality.
 */
export async function GET(req: NextRequest) {
  const guard = await requireAuthAny(req, ["orgs:manage"]);
  if (guard.error) return guard.error;

  const exchange = bindingStatus();
  const intel = intelConfig();
  const web = ethioWebConfig();

  const report = buildBindingsReport({
    google: { configured: googleConfigured(), mock: googleMockMode() },
    smtp: { hostSet: activeTransport() === "smtp" },
    ethioExchange: { bound: exchange.mode === "live", endpoint: exchange.endpoint },
    ethioWeb: { disabled: web.disabled, snapshotAsOf: ethiocertApiSnapshot.capturedAt.slice(0, 10) },
    intel: {
      off: intel.disabled,
      abusechKey: intel.abusechKey !== null,
      otxKey: intel.otxKey !== null,
      greynoiseKey: intel.greynoiseKey !== null,
      mispBound: intel.mispUrl !== null && intel.mispKey !== null,
      mispUrl: intel.mispUrl,
      virustotalKey: intel.virustotalKey !== null,
      kevSnapshotAsOf: kevSnapshot.capturedAt.slice(0, 10),
      dropSnapshotAsOf: dropSnapshot.capturedAt.slice(0, 10),
    },
    epss: { disabled: epssConfig().disabled },
    vaptFeed: { asOf: FEED_AS_OF.slice(0, 10) },
  });

  return NextResponse.json({ generatedAt: new Date().toISOString(), ...report });
}
