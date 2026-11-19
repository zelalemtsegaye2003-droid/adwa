/**
 * Adwa Cyber — live EPSS (Exploit Prediction Scoring System) enrichment.
 * (Real-Data Review & Roadmap §5.3 — retiring the engine's fallback EPSS
 * constants: live FIRST scores at scan time, the bundled snapshot only as a
 * labelled fallback, and heuristics narrowed to the strict non-CVE case.)
 *
 * FIRST publishes daily EPSS scores as a free, key-less JSON API:
 *   GET https://api.first.org/data/v1/epss?cve=CVE-2021-44228
 *   {"status":"OK","data":[{"cve":"CVE-2021-44228","epss":"0.97",
 *    "percentile":"0.999","date":"2026-11-19"}]}
 * Multiple CVEs comma-separated (≤ 2 000 characters including commas).
 *
 * Honesty contract (platform-wide pattern):
 *   - every CVE finding gets a LIVE score at scan time when the API answers;
 *   - when the API is unreachable the bundled feed snapshot value is kept and
 *     labelled with its as-of date — never silently presented as live;
 *   - findings with no CVE (TLS posture, exposure, config) keep a conservative
 *     heuristic prior, always labelled as such in the evidence bundle.
 *   - a lookup failure NEVER fabricates a score: it returns null and the
 *     caller keeps the labelled fallback.
 *
 * Rate limits are respected with a 6-hour in-process TTL cache (FIRST asks
 * consumers to cache; scores change daily, so 6 h is within one publication
 * cycle) and batched lookups (one request covers up to 2 000 characters of
 * CVE ids).
 */

export const EPSS_URL = "https://api.first.org/data/v1/epss";

export interface EpssScore {
  cve: string;
  epss: number; // 0..1 — probability of exploitation in the next 30 days
  percentile: number; // 0..1 — rank against all scored CVEs
  date: string; // the day the score was published
}

export interface EpssConfig {
  timeoutMs: number;
  disabled: boolean; // EPSS_LIVE_OFF=true → strictly bundled snapshot values
  cacheTtlMs: number;
}

export function epssConfig(): EpssConfig {
  const flag = (v: string | undefined) => /^(1|true|yes|on)$/i.test((v ?? "").trim());
  return {
    timeoutMs: Math.max(2_000, Number(process.env.EPSS_TIMEOUT_MS ?? 8_000) || 8_000),
    disabled: flag(process.env.EPSS_LIVE_OFF),
    cacheTtlMs: 6 * 3600 * 1000,
  };
}

const CVE_RE = /^CVE-\d{4}-\d{4,}$/;

interface EpssCacheEntry {
  at: number;
  score: EpssScore | null; // null = looked up live and not returned by the API
}

const cache = new Map<string, EpssCacheEntry>();

/**
 * Parse the FIRST EPSS API response (pure — testable).
 * Throws on malformed payloads; a well-formed "no data" response parses to [].
 */
export function parseEpssResponse(body: unknown): EpssScore[] {
  if (typeof body !== "object" || body === null) throw new Error("EPSS response is not JSON.");
  const raw = body as Record<string, unknown>;
  if (raw.status !== "OK") throw new Error(`EPSS response status: ${String(raw.status)}`);
  if (!Array.isArray(raw.data)) throw new Error("EPSS response has no data array.");
  const out: EpssScore[] = [];
  for (const item of raw.data as Record<string, unknown>[]) {
    const cve = String(item.cve ?? "");
    const epss = Number(item.epss);
    const percentile = Number(item.percentile);
    if (!CVE_RE.test(cve) || !Number.isFinite(epss) || !Number.isFinite(percentile)) continue;
    out.push({
      cve,
      epss: Math.max(0, Math.min(1, epss)),
      percentile: Math.max(0, Math.min(1, percentile)),
      date: String(item.date ?? "").slice(0, 10),
    });
  }
  return out;
}

async function fetchEpssBatch(cves: string[]): Promise<Map<string, EpssScore>> {
  const cfg = epssConfig();
  const out = new Map<string, EpssScore>();
  const url = `${EPSS_URL}?cve=${cves.map((c) => encodeURIComponent(c)).join(",")}`;
  const res = await fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(cfg.timeoutMs),
    headers: { Accept: "application/json", "User-Agent": "AdwaSec/1.0 (VAPT EPSS enrichment)" },
  });
  if (!res.ok) throw new Error(`EPSS API HTTP ${res.status}.`);
  const body = await res.json();
  for (const score of parseEpssResponse(body)) out.set(score.cve, score);
  return out;
}

/**
 * Live EPSS lookup for a batch of CVE ids, through the TTL cache.
 * Returns a map of found scores; CVEs the API does not return are absent
 * (the caller keeps its labelled fallback). Network/API failure → empty map
 * plus `failed: true` — never a fabricated score.
 */
export async function epssLiveLookup(cves: string[]): Promise<{ found: Map<string, EpssScore>; failed: boolean }> {
  const cfg = epssConfig();
  const found = new Map<string, EpssScore>();
  if (cfg.disabled || cves.length === 0) return { found, failed: cfg.disabled };
  const now = Date.now();
  const uncached: string[] = [];
  for (const cve of cves) {
    if (!CVE_RE.test(cve)) continue;
    const hit = cache.get(cve);
    if (hit && now - hit.at < cfg.cacheTtlMs && hit.score) found.set(cve, hit.score);
    else if (hit && now - hit.at < cfg.cacheTtlMs) continue; // cached "not returned by API"
    else uncached.push(cve);
  }
  if (uncached.length === 0) return { found, failed: false };
  // ≤ 2 000 characters per request (including commas) — chunk defensively.
  const CHUNK = 60; // ~60 CVE ids ≈ 840 characters incl. commas
  try {
    for (let i = 0; i < uncached.length; i += CHUNK) {
      const part = uncached.slice(i, i + CHUNK);
      const batch = await fetchEpssBatch(part);
      for (const cve of part) {
        const score = batch.get(cve) ?? null;
        cache.set(cve, { at: now, score });
        if (score) found.set(cve, score);
      }
    }
    return { found, failed: false };
  } catch {
    // Unreachable or malformed — keep the caller on its labelled fallback.
    return { found, failed: true };
  }
}

/** Single-CVE convenience around the cached batch lookup. */
export async function epssFor(cve: string): Promise<EpssScore | null> {
  const { found } = await epssLiveLookup([cve]);
  return found.get(cve) ?? null;
}

/**
 * The provenance label every finding's evidence bundle carries — the roadmap's
 * "always labelled" rule, made concrete.
 */
export function epssProvenanceNote(score: EpssScore | null, feedAsOf: string, hasCve: boolean): { note: string; source: "live" | "snapshot" | "heuristic" } {
  if (score) return { note: `EPSS live from FIRST (as of ${score.date || "current"})`, source: "live" };
  if (hasCve) return { note: `EPSS from bundled feed snapshot (as of ${feedAsOf}) — live EPSS unavailable this run`, source: "snapshot" };
  return { note: "EPSS heuristic prior (non-CVE finding — EPSS scores CVEs only)", source: "heuristic" };
}
