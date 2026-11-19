#!/usr/bin/env bun
/**
 * Adwa Cyber — Ethiopian national-source snapshot builder (real-data layer).
 *
 * Rebuilds the bundled offline snapshots from the LIVE national sources:
 *
 *   Ethio-CERT public JSON API   https://www.ethiocert.gov.et/api
 *     /advisories/ (en+am)  /alerts/ (en+am)  /news/ (en+am)
 *     /regulations/ (en+am)  /gci/timeline + /gci/latest
 *   INSA home page (HTML)        https://www.insa.gov.et
 *
 * Output:
 *   src/lib/ethio-snapshots/ethiocert-api.json   (all API endpoints, mapped)
 *   src/lib/ethio-snapshots/insa-news.json       (parsed headlines)
 *
 * Empty capture states are VALID: at the 2026-11-19 baseline the advisories
 * endpoint answers {"results":[],"message":"No advisories found for the
 * specified criteria"} — that is the honest capture, recorded with its note,
 * NOT an error. The platform serves these files only when the live source is
 * unreachable, and always labels them as snapshots with their capture date.
 * A failed live fetch (network/HTTP) is an error — the previous snapshot is
 * left untouched, exit code 1.
 *
 * Usage: bun run ethio:snapshot
 */
import { writeFileSync } from "fs";

const SITE = "https://www.ethiocert.gov.et";
const API = `${SITE}/api`;
const INSA_URL = "https://www.insa.gov.et";
const OUT_API = "src/lib/ethio-snapshots/ethiocert-api.json";
const OUT_INSA = "src/lib/ethio-snapshots/insa-news.json";

const UA = "Mozilla/5.0 (compatible; AdwaCyberIntel/1.0; national CERT situational awareness)";
const capturedAt = new Date().toISOString();
let failed = 0;

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "application/json" },
    redirect: "follow",
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function fetchPage(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml" },
    redirect: "follow",
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();
  if (!html || html.length < 200) throw new Error("empty document");
  return html;
}

// Bilingual rows: en primary, am merged by row id (via the platform mappers).
async function rows(path: string): Promise<{ en: Record<string, unknown>[]; am: Map<string, Record<string, unknown>>; message?: string }> {
  const [en, am] = await Promise.all([getJson(`${API}${path}?lang=en`), getJson(`${API}${path}?lang=am`).catch(() => null)]);
  const enList = Array.isArray(en) ? en : ((en as Record<string, unknown>).results ?? []);
  const amRows = new Map<string, Record<string, unknown>>();
  const amList = Array.isArray(am) ? am : ((am as Record<string, unknown> | null)?.results ?? []);
  for (const r of amList as Record<string, unknown>[]) if (r && r.id !== undefined) amRows.set(String(r.id), r);
  return { en: enList as Record<string, unknown>[], am: amRows, message: (en as Record<string, unknown>).message ? String((en as Record<string, unknown>).message) : undefined };
}

// ── 1. Ethio-CERT public JSON API ──────────────────────────────────────────
console.log(`Capturing the Ethio-CERT public API (${API}) …`);
let apiWritten = false;
try {
  const adv = await rows("/advisories/");
  const alerts = await rows("/alerts/");
  const news = await rows("/news/");
  const regs = await rows("/regulations/");
  const gciTimeline = (await getJson(`${API}/gci/timeline`)) as { timeline?: unknown[] };
  const gciLatest = (await getJson(`${API}/gci/latest`)) as { latest?: unknown };

  // Map through the platform module so snapshot == runtime parsing exactly.
  const m = await import("../src/lib/ethiocert-web");
  const advisories = adv.en.map((r) => m.mapAdvisoryRow(r, SITE, adv.am.get(String(r.id)))).filter(Boolean);
  const alertEntries = alerts.en.map((r) => m.mapAlertRow(r, SITE, alerts.am.get(String(r.id)))).filter(Boolean);
  const newsEntries = news.en.map((r) => m.mapNewsRow(r, SITE, news.am.get(String(r.id)))).filter(Boolean);
  const regEntries = regs.en.map((r) => m.mapRegulationRow(r, regs.am.get(String(r.id)))).filter(Boolean);
  const gci = m.mapGci({ ...gciTimeline, ...gciLatest }, SITE);

  const payload = {
    sourceUrl: API,
    capturedAt,
    capturedBy: "scripts/fetch-ethio-snapshot.ts (bun run ethio:snapshot)",
    captureMethod: `Live capture from ${API} (en+am) on ${capturedAt.slice(0, 10)}; GCI from /gci/timeline + /gci/latest.`,
    advisories: {
      entries: advisories,
      note: advisories.length === 0 ? adv.message ?? "Advisories endpoint listed no published advisories at capture time." : undefined,
    },
    alerts: { entries: alertEntries },
    news: { entries: newsEntries },
    regulations: { entries: regEntries },
    gci: gci ? { ...gci, asOf: capturedAt } : null,
  };
  writeFileSync(OUT_API, `${JSON.stringify(payload, null, 2)}\n`);
  apiWritten = true;
  console.log(`  ✓ advisories ${advisories.length} (honest state recorded), alerts ${alertEntries.length}, news ${newsEntries.length}, regulations ${regEntries.length}, GCI ${gci?.year ?? "-"} → ${OUT_API}`);
} catch (err) {
  failed++;
  console.error(`  ✗ Ethio-CERT API capture failed: ${(err as Error).message} — previous snapshot left untouched.`);
}

// ── 2. INSA national news (home-page headlines) ───────────────────────────
console.log(`Capturing INSA national news (${INSA_URL}) …`);
let insaWritten = false;
try {
  const html = await fetchPage(INSA_URL);
  const { parseInsaNewsHtml } = await import("../src/lib/ethiocert-web");
  const entries = parseInsaNewsHtml(html, INSA_URL);
  const payload = {
    sourceUrl: INSA_URL,
    capturedAt,
    note: "Headlines captured from the INSA home page; where the site truncates a card title, the full title is recovered from the card image's alt text. Links resolve to the site's /blog/<slug> detail pages.",
    capturedBy: "scripts/fetch-ethio-snapshot.ts (bun run ethio:snapshot)",
    captureMethod: `Live fetch of ${INSA_URL} on ${capturedAt.slice(0, 10)}; blog-detail anchor extraction found ${entries.length} headline(s) with alt-text title recovery.`,
    entries,
  };
  writeFileSync(OUT_INSA, `${JSON.stringify(payload, null, 2)}\n`);
  insaWritten = true;
  console.log(`  ✓ ${entries.length} news headline(s) captured → ${OUT_INSA}`);
} catch (err) {
  failed++;
  console.error(`  ✗ INSA news capture failed: ${(err as Error).message} — previous snapshot left untouched.`);
}

if (failed) {
  console.error(`\n${failed} capture(s) failed. Keep the bundled snapshots and retry, or run behind a network that can reach the .gov.et sites.`);
  process.exit(1);
}
console.log(`\nDone — Ethio-CERT API ${apiWritten ? "refreshed" : "kept"}, INSA news ${insaWritten ? "refreshed" : "kept"}.`);
