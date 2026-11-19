import { NextRequest, NextResponse } from "next/server";
import { requireAuthAny } from "@/lib/auth/guard";
import { bindingStatus } from "@/lib/ethio/ethiocert-client";
import {
  aggregateEthioMode,
  ethioWebConfig,
  getEthioCertAdvisories,
  getEthioCertAlerts,
  getEthioCertGci,
  getEthioCertNews,
  getEthioCertRegulations,
  getInsaNews,
} from "@/lib/ethio/ethiocert-web";
import {
  ETHIOCERT_CONTACT,
  ETHIOCERT_SERVICES,
  ETHIO_MARKET,
  INSA_AWARENESS_TIPS,
  INSA_PRODUCTS,
  INSA_STATS,
  NBE_ITEMS,
} from "@/lib/ethio/ethio-landscape";

export const runtime = "nodejs";

/**
 * GET /api/threats/ethio — Ethiopian national cyber ecosystem, real sources.
 *
 * Aggregates the REAL public layer of the Ethiopian security ecosystem:
 *   cert.advisories    Ethio-CERT public advisories — LIVE from the national
 *                      JSON API (ethiocert.gov.et/api/advisories, en+am),
 *                      degrading to the bundled labelled snapshot captured
 *                      from the real API when unreachable.
 *   cert.alerts        Ethio-CERT national cyber alerts — LIVE from
 *                      /api/alerts (severity + dates + bilingual titles).
 *   cert.news           Ethio-CERT national security news — LIVE from
 *                      /api/news (113 items published; first page served).
 *   cert.regulations    the national legal corpus — Computer Crime
 *                      Proclamation 958/2016, Electronic Signature &
 *                      Transactions Proclamations, IT Proclamation 2024,
 *                      national cybersecurity policy, cryptography
 *                      directives — with the official PDF links.
 *   cert.gci            Ethiopia's ITU Global Cybersecurity Index pillar
 *                      scores + the 2014→2024 timeline, LIVE from
 *                      /api/gci/latest + /api/gci/timeline.
 *   insa.news          INSA institutional news headlines — LIVE scrape of
 *                      insa.gov.et with the same honesty model.
 *   insa.stats         bundled national posture facts (INSA data tracker).
 *   insa.awareness    INSA cyber-awareness tips (Amharic = our translations).
 *   insa.products      INSA national product portfolio (Gasha, Enyuma IAM…).
 *   nbe                NBE directives + official awareness material.
 *   market             independent Ethiopia CTI market sizing.
 *   cert.exchange      the structured bilateral exchange binding
 *                      (ETHIOCERT_API_URL) shown alongside.
 *
 * Every live feed carries mode ("live" | "snapshot"), asOf and (when
 * degraded) degradedReason — never silent, never invented.
 */
export async function GET(req: NextRequest) {
  const guard = await requireAuthAny(req, ["threats:view"]);
  if (guard.error) return guard.error;

  const [advisories, alerts, news, regulations, gci, insaNews] = await Promise.all([
    getEthioCertAdvisories(),
    getEthioCertAlerts(),
    getEthioCertNews(),
    getEthioCertRegulations(),
    getEthioCertGci(),
    getInsaNews(),
  ]);

  return NextResponse.json({
    web: ethioWebConfig(),
    mode: aggregateEthioMode([advisories, alerts, news, regulations, gci, insaNews]),
    cert: {
      contact: ETHIOCERT_CONTACT,
      services: ETHIOCERT_SERVICES,
      advisories,
      alerts,
      news,
      regulations,
      gci,
      exchange: bindingStatus(),
    },
    insa: {
      news: insaNews,
      stats: INSA_STATS,
      awareness: INSA_AWARENESS_TIPS,
      products: INSA_PRODUCTS,
    },
    nbe: NBE_ITEMS,
    market: ETHIO_MARKET,
  });
}
