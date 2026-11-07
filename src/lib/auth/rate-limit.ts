/**
 * Adwa Cyber — in-memory sliding-window rate limiter for auth endpoints.
 * Protects against brute force, credential stuffing and captcha farming.
 */
interface Bucket {
  hits: number[]; // timestamps of hits inside the window
}

const buckets = new Map<string, Bucket>();

// Periodically purge stale buckets so the map cannot grow unbounded.
const lastSweep = { at: 0 };
function sweep(now: number) {
  if (now - lastSweep.at < 60_000) return;
  lastSweep.at = now;
  for (const [key, bucket] of buckets) {
    if (bucket.hits.length === 0 || now - bucket.hits[bucket.hits.length - 1] > 600_000) {
      buckets.delete(key);
    }
  }
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

/**
 * Sliding-window limit. Returns whether the current hit is allowed.
 * @param key     bucket key (e.g. `login:1.2.3.4` or `login:user@x.et`)
 * @param limit   max hits inside the window
 * @param windowMs window size in milliseconds
 */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  sweep(now);
  const bucket = buckets.get(key) ?? { hits: [] };
  bucket.hits = bucket.hits.filter((t) => now - t < windowMs);
  if (bucket.hits.length >= limit) {
    const oldest = bucket.hits[0];
    buckets.set(key, bucket);
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((windowMs - (now - oldest)) / 1000)),
    };
  }
  bucket.hits.push(now);
  buckets.set(key, bucket);
  return { allowed: true, remaining: limit - bucket.hits.length, retryAfterSeconds: 0 };
}

/** Extract the caller IP from proxy-aware headers. */
export function clientIp(headers: Headers): string {
  return (
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("x-real-ip") ||
    "unknown"
  );
}
