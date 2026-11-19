/**
 * Adwa Cyber — Ethio-CERT exchange API client (sync-layer binding).
 * ---------------------------------------------------------------------
 * Binds the platform's synchronisation layer to a real Ethio-CERT
 * exchange endpoint instead of the bundled pilot fixture:
 *
 *   DOWN  GET  {ETHIOCERT_API_URL}/feed     → national threat feed
 *   UP    POST {ETHIOCERT_API_URL}/reports  → anonymised tenant summary
 *
 * Configuration (read per call, so tests and ops can change it):
 *   ETHIOCERT_API_URL      base URL of the exchange; unset ⇒ pilot fixture
 *   ETHIOCERT_API_KEY      bearer token for both directions
 *   ETHIOCERT_TIMEOUT_MS   request timeout (default 8 000)
 *
 * Failure semantics: a configured-but-unreachable exchange is an ERROR
 * (SyncRun status "failed", HTTP 502) — never a silent fall-back to the
 * fixture, which would mask a broken national binding from supervisors.
 */
import { ETHIOCERT_FEED, type FeedEntry } from "./ethiocert-feed";
import { fetchWithTimeout, isTimeout } from "../feed-kernel";

// ── configuration ───────────────────────────────────────────────────────────

export interface ExchangeConfig {
  url: string | null;
  key: string | null;
  timeoutMs: number;
}

export function getExchangeConfig(): ExchangeConfig {
  const raw = (process.env.ETHIOCERT_API_URL ?? "").trim();
  return {
    // Trim a trailing slash so `${url}/feed` never doubles up.
    url: raw ? raw.replace(/\/+$/, "") : null,
    key: (process.env.ETHIOCERT_API_KEY ?? "").trim() || null,
    timeoutMs: Number(process.env.ETHIOCERT_TIMEOUT_MS ?? 8_000) || 8_000,
  };
}

/** Binding status for UI badges and GET /api/threats/sync. */
export function bindingStatus(): { mode: "live" | "fixture"; endpoint: string | null; hasKey: boolean } {
  const c = getExchangeConfig();
  return {
    mode: c.url ? "live" : "fixture",
    endpoint: c.url,
    hasKey: !!c.key,
  };
}

// ── errors ──────────────────────────────────────────────────────────────────

export type ExchangeErrorCode =
  | "ETHIOCERT_UNAUTHORIZED" // wrong/missing API key
  | "ETHIOCERT_UNREACHABLE" // network error / timeout
  | "ETHIOCERT_BAD_PAYLOAD"; // exchange answered, payload unusable

export class EthioCertError extends Error {
  readonly code: ExchangeErrorCode;
  readonly httpStatus: number; // 401/408/502…
  readonly endpoint: string | null;

  constructor(code: ExchangeErrorCode, message: string, httpStatus: number, endpoint: string | null) {
    super(message);
    this.name = "EthioCertError";
    this.code = code;
    this.httpStatus = httpStatus;
    this.endpoint = endpoint;
  }
}

function requireLiveEndpoint(): { url: string; headers: Record<string, string>; timeoutMs: number } {
  const c = getExchangeConfig();
  if (!c.url) {
    throw new EthioCertError("ETHIOCERT_UNREACHABLE", "No exchange endpoint configured.", 503, null);
  }
  return {
    url: c.url,
    headers: {
      Accept: "application/json",
      ...(c.key ? { Authorization: `Bearer ${c.key}` } : {}),
    },
    timeoutMs: c.timeoutMs,
  };
}

// ── DOWN: national feed ─────────────────────────────────────────────────────

export interface NationalFeedResult {
  mode: "live" | "fixture";
  endpoint: string | null;
  entries: FeedEntry[];
  skippedInvalid: number; // live only: entries rejected by schema validation
}

const TYPES = new Set(["ip", "domain", "url", "hash_sha256", "email", "filename"]);
const SEVERITIES = new Set(["critical", "high", "medium", "low"]);
const TLPS = new Set(["TLP:RED", "TLP:AMBER", "TLP:GREEN", "TLP:CLEAR"]);

/** Validate one raw feed record against the FeedEntry contract. */
export function parseFeedEntry(raw: unknown): FeedEntry | null {
  if (typeof raw !== "object" || raw === null) return null;
  const e = raw as Record<string, unknown>;
  const type = String(e.type ?? "");
  const value = String(e.value ?? "").trim();
  const severity = String(e.severity ?? "");
  const tlp = String(e.tlp ?? "");
  const confidence = Number(e.confidence ?? NaN);
  if (!TYPES.has(type) || !value || !SEVERITIES.has(severity) || !TLPS.has(tlp)) return null;
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 100) return null;
  const titleEn = typeof e.titleEn === "string" && e.titleEn.trim() ? e.titleEn : `National feed indicator (${value})`;
  return {
    type: type as FeedEntry["type"],
    value,
    titleEn,
    titleAm: typeof e.titleAm === "string" && e.titleAm.trim() ? e.titleAm : titleEn,
    category: String(e.category ?? "other") || "other",
    severity: severity as FeedEntry["severity"],
    tlp: tlp as FeedEntry["tlp"],
    confidence: Math.round(confidence),
    descriptionEn: typeof e.descriptionEn === "string" ? e.descriptionEn : undefined,
    descriptionAm: typeof e.descriptionAm === "string" ? e.descriptionAm : undefined,
    bulletin: String(e.bulletin ?? "EC-LIVE") || "EC-LIVE",
  };
}

export async function fetchNationalFeed(): Promise<NationalFeedResult> {
  const c = getExchangeConfig();
  if (!c.url) {
    return { mode: "fixture", endpoint: null, entries: ETHIOCERT_FEED, skippedInvalid: 0 };
  }

  const endpoint = `${c.url}/feed`;
  let res: Response;
  try {
    res = await fetchWithTimeout(endpoint, { headers: { ...requireLiveEndpoint().headers } }, c.timeoutMs);
  } catch (err) {
    const timedOut = isTimeout(err);
    throw new EthioCertError(
      "ETHIOCERT_UNREACHABLE",
      timedOut ? `Exchange timed out after ${c.timeoutMs} ms.` : `Exchange unreachable: ${(err as Error).message}`,
      timedOut ? 504 : 502,
      endpoint
    );
  }

  if (res.status === 401 || res.status === 403) {
    throw new EthioCertError("ETHIOCERT_UNAUTHORIZED", "Exchange rejected the API key.", res.status, endpoint);
  }
  if (!res.ok) {
    throw new EthioCertError("ETHIOCERT_BAD_PAYLOAD", `Exchange feed error HTTP ${res.status}.`, 502, endpoint);
  }

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    throw new EthioCertError("ETHIOCERT_BAD_PAYLOAD", "Exchange feed is not valid JSON.", 502, endpoint);
  }
  const rawFeed = Array.isArray(body)
    ? body
    : (body as Record<string, unknown>)?.feed && Array.isArray((body as Record<string, unknown>).feed)
      ? ((body as Record<string, unknown>).feed as unknown[])
      : null;
  if (!rawFeed) {
    throw new EthioCertError("ETHIOCERT_BAD_PAYLOAD", "Exchange feed payload must be an array or { feed: [...] }.", 502, endpoint);
  }

  const entries: FeedEntry[] = [];
  let skippedInvalid = 0;
  for (const raw of rawFeed) {
    const parsed = parseFeedEntry(raw);
    if (parsed) entries.push(parsed);
    else skippedInvalid++;
  }
  return { mode: "live", endpoint, entries, skippedInvalid };
}

// ── UP: anonymised report delivery ──────────────────────────────────────────

export interface DeliveryResult {
  mode: "live" | "fixture";
  endpoint: string | null;
  receiptId: string | null; // exchange acknowledgement (live only)
  httpStatus: number | null;
}

/**
 * Deliver the pre-serialised, pre-hashed upward payload. The caller hashes
 * `payloadJson` itself; the exchange echoes the sha256 of exactly the bytes
 * it received, giving an end-to-end integrity proof.
 */
export async function deliverReport(payloadJson: string): Promise<DeliveryResult> {
  const c = getExchangeConfig();
  if (!c.url) {
    // Pilot fixture: recorded locally with the sha256 proof, not delivered.
    return { mode: "fixture", endpoint: null, receiptId: null, httpStatus: null };
  }

  const endpoint = `${c.url}/reports`;
  let res: Response;
  try {
    res = await fetchWithTimeout(
      endpoint,
      {
        method: "POST",
        headers: {
          ...requireLiveEndpoint().headers,
          "Content-Type": "application/json",
        },
        body: payloadJson,
      },
      c.timeoutMs
    );
  } catch (err) {
    const timedOut = isTimeout(err);
    throw new EthioCertError(
      "ETHIOCERT_UNREACHABLE",
      timedOut ? `Exchange timed out after ${c.timeoutMs} ms.` : `Exchange unreachable: ${(err as Error).message}`,
      timedOut ? 504 : 502,
      endpoint
    );
  }

  if (res.status === 401 || res.status === 403) {
    throw new EthioCertError("ETHIOCERT_UNAUTHORIZED", "Exchange rejected the API key.", res.status, endpoint);
  }
  if (res.status === 422) {
    const detail = await res.json().catch(() => null);
    throw new EthioCertError(
      "ETHIOCERT_BAD_PAYLOAD",
      `Exchange rejected the report: ${(detail as { error?: string })?.error ?? "privacy contract violation"}`,
      422,
      endpoint
    );
  }
  if (!res.ok) {
    throw new EthioCertError("ETHIOCERT_BAD_PAYLOAD", `Exchange report error HTTP ${res.status}.`, 502, endpoint);
  }

  const ack = (await res.json().catch(() => null)) as { receiptId?: unknown } | null;
  if (!ack || typeof ack.receiptId !== "string" || !ack.receiptId) {
    throw new EthioCertError("ETHIOCERT_BAD_PAYLOAD", "Exchange acknowledgement is missing receiptId.", 502, endpoint);
  }
  return { mode: "live", endpoint, receiptId: ack.receiptId, httpStatus: res.status };
}
