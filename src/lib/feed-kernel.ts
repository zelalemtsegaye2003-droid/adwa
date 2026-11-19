/**
 * feed-kernel.ts — the shared fetch/cache policy for every external feed
 * connector (docs/ARCHITECTURE.md §5, "the connector pattern").
 *
 * Every connector (NVD, FIRST EPSS, CISA KEV, abuse.ch, Spamhaus, AlienVault
 * OTX, MISP, VirusTotal, GreyNoise, Ethio-CERT public API/web, INSA web)
 * follows the same discipline; this module owns the mechanical half of it:
 *
 *   - fetchWithTimeout — every outbound feed request goes through here:
 *     no-store (never a stale CDN copy), a hard per-request timeout via
 *     AbortSignal, and an identifying User-Agent (sources with attribution
 *     terms, like abuse.ch, expect one).
 *   - makeTtlCache — the in-process TTL caches (60 s … 6 h) so repeat views
 *     and bursts don't re-fetch.
 *   - isTimeout — normalised timeout detection for the labelled
 *     degradation messages ("timed out after N ms"), which every connector
 *     renders its own way.
 *
 * Domain-specific halves (parsing, snapshot fallback, honesty labels,
 * provenance columns) stay in the owning domain module — deliberately.
 * Platform core imports nothing from domains (ARCHITECTURE.md §3).
 */

export const DEFAULT_FEED_USER_AGENT = "AdwaSec/1.0";

/**
 * Fetch a feed URL with the connector policy: never cached by the runtime,
 * hard timeout, identifying User-Agent. Caller-supplied headers win over the
 * default UA when they include one.
 */
export async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
  userAgent: string = DEFAULT_FEED_USER_AGENT,
): Promise<Response> {
  return fetch(url, {
    ...init,
    cache: "no-store",
    signal: AbortSignal.timeout(timeoutMs),
    headers: { "User-Agent": userAgent, ...(init.headers ?? {}) },
  });
}

/** True when the fetch failure was the AbortSignal timeout (not unreachable). */
export function isTimeout(err: unknown): boolean {
  return err instanceof Error && err.name === "TimeoutError";
}

export interface TtlCache<T> {
  get(key: string): T | undefined;
  set(key: string, value: T): void;
  readonly size: number;
}

/**
 * A small in-process TTL cache. Values expire by age (checked on read); a
 * dashboard load hitting a national API twice within the TTL fetches once.
 */
export function makeTtlCache<T>(ttlMs: number): TtlCache<T> {
  const store = new Map<string, { at: number; value: T }>();
  return {
    get(key: string): T | undefined {
      const hit = store.get(key);
      if (hit && Date.now() - hit.at < ttlMs) return hit.value;
      return undefined;
    },
    set(key: string, value: T): void {
      store.set(key, { at: Date.now(), value });
    },
    get size(): number {
      return store.size;
    },
  };
}
