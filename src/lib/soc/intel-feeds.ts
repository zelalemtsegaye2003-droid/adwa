/**
 * Adwa Cyber — public threat-intelligence feed connectors.
 * (Real-Data Review & Roadmap — Phase 1 implementation; Phase 2 adds the
 * self-hosted MISP exchange and VirusTotal reputation enrichment.)
 *
 * One connector per source, all free tiers, one honesty contract:
 *
 *   CISA KEV        JSON catalog of actively exploited CVEs — public domain,
 *                   no key (https://www.cisa.gov/known-exploited-vulnerabilities-catalog)
 *   Spamhaus DROP   "Don't Route Or Peer" hijacked-netblock list — free for
 *                   operational use, attribution header preserved (spamhaus.org/drop)
 *   abuse.ch URLhaus  authenticated v2 CSV export — ABUSECH_AUTH_KEY (free key,
 *                   auth.abuse.ch; mandatory since June 2025, attribution required)
 *   abuse.ch ThreatFox  IOC API (JSON) — ABUSECH_AUTH_KEY (same key, attribution)
 *   AlienVault OTX  subscribed community pulses — OTX_API_KEY (free key)
 *   GreyNoise Community  per-IP "is this a known mass scanner?" enrichment —
 *                   GREYNOISE_API_KEY (free key); an enrichment action, not bulk
 *   MISP            self-hosted private sharing instance (roadmap §5.1) —
 *                   MISP_URL + MISP_API_KEY (AGPL, free software, TLP honoured);
 *                   a curated channel INSA / sector peers can push sensitive
 *                   indicators through — TLP:AMBER+ stays inside the tenant
 *   VirusTotal      per-target reputation (IP / URL / file hash, roadmap §5.2) —
 *                   VIRUSTOTAL_API_KEY (free public tier: 4 req/min, 500/day;
 *                   an enrichment action, not bulk)
 *
 * Modes (the platform-wide honesty pattern):
 *   live       entries were fetched from the source right now
 *   snapshot   the source was unreachable, so the bundled snapshot captured
 *              from that same source is served — labelled with its as-of date
 * No-key feeds degrade to the bundled snapshot (labelled). Keyed feeds NEVER
 * fall back: a missing key is a visible UNCONFIGURED state, and a configured
 * but failing keyed feed is a FAILED run, never a silent replacement.
 */
import kevSnapshotJson from "./intel-snapshots/kev.json";
import dropSnapshotJson from "./intel-snapshots/spamhaus-drop.json";

// ── configuration ────────────────────────────────────────────────────────────

export type IntelFeedId = "cisa_kev" | "spamhaus_drop" | "urlhaus" | "threatfox" | "otx" | "greynoise" | "misp" | "virustotal";

export interface IntelConfig {
  timeoutMs: number;
  disabled: boolean; // INTEL_FEEDS_OFF=true kills every connector (ops switch)
  maxEntries: number; // per-feed cap per run (default 2 000) — honest capping
  abusechKey: string | null;
  otxKey: string | null;
  greynoiseKey: string | null;
  mispUrl: string | null; // self-hosted MISP base URL, e.g. https://misp.insa.gov.et
  mispKey: string | null;
  virustotalKey: string | null;
}

export function intelConfig(): IntelConfig {
  const flag = (v: string | undefined) => /^(1|true|yes|on)$/i.test((v ?? "").trim());
  const clean = (v: string | undefined) => (v ?? "").trim().replace(/\/+$/, "") || null;
  return {
    timeoutMs: Number(process.env.INTEL_FEED_TIMEOUT_MS ?? 15_000) || 15_000,
    disabled: flag(process.env.INTEL_FEEDS_OFF),
    maxEntries: Math.max(1, Number(process.env.INTEL_FEED_MAX_ENTRIES ?? 2_000) || 2_000),
    abusechKey: (process.env.ABUSECH_AUTH_KEY ?? "").trim() || null,
    otxKey: (process.env.OTX_API_KEY ?? "").trim() || null,
    greynoiseKey: (process.env.GREYNOISE_API_KEY ?? "").trim() || null,
    mispUrl: clean(process.env.MISP_URL),
    mispKey: (process.env.MISP_API_KEY ?? "").trim() || null,
    virustotalKey: (process.env.VIRUSTOTAL_API_KEY ?? "").trim() || null,
  };
}

export const KEV_URL = "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json";
export const DROP_URL = "https://www.spamhaus.org/drop/drop.txt";
export const URLHAUS_URL = "https://urlhaus-api.abuse.ch/v2/files/exports/";
export const THREATFOX_URL = "https://threatfox-api.abuse.ch/api/v1/";
export const OTX_URL = "https://otx.alienvault.com/api/v1/pulses/subscribed";
export const GREYNOISE_URL = "https://api.greynoise.io/v3/community";
export const MISP_ENDPOINT = "/events/restSearch"; // appended to MISP_URL
export const VIRUSTOTAL_URL = "https://www.virustotal.com/api/v3";

// ── errors ───────────────────────────────────────────────────────────────────

export type IntelErrorCode = "UNCONFIGURED" | "UNREACHABLE" | "UNAUTHORIZED" | "BAD_PAYLOAD";

export class IntelFeedError extends Error {
  readonly feed: IntelFeedId;
  readonly code: IntelErrorCode;
  readonly httpStatus: number;
  readonly endpoint: string;

  constructor(feed: IntelFeedId, code: IntelErrorCode, message: string, httpStatus: number, endpoint: string) {
    super(message);
    this.name = "IntelFeedError";
    this.feed = feed;
    this.code = code;
    this.httpStatus = httpStatus;
    this.endpoint = endpoint;
  }
}

// ── normalised indicator contract ───────────────────────────────────────────

export interface IntelIndicatorInput {
  type: string; // ip | domain | url | hash_sha256 | hash_md5 | email | filename | cve
  value: string;
  titleEn: string;
  descriptionEn?: string | null;
  category: string;
  severity: string; // critical | high | medium | low
  tlp: string;
  confidence: number; // 0–100
  sourceRef: string; // feed-native provenance (catalog version / SBL id / pulse id)
  firstSeenAt?: string | null; // ISO date the source first observed it
}

export interface IntelFeedResult {
  feed: IntelFeedId;
  label: string;
  mode: "live" | "snapshot";
  endpoint: string;
  asOf: string; // live: source-native version/date; snapshot: capture date
  entries: IntelIndicatorInput[];
  skippedInvalid: number;
  note?: string; // honesty note surfaced to the UI
}

export interface IntelFeedStatus {
  id: IntelFeedId;
  label: string;
  endpoint: string;
  keyRequired: boolean;
  configured: boolean;
  snapshotCount?: number;
  snapshotAsOf?: string;
  snapshotNote?: string;
  attribution: string; // licence / terms line, shown to supervisors
}

/** Feed labels are English brand names — not localised. */
export const FEED_LABELS: Record<Exclude<IntelFeedId, "greynoise" | "virustotal">, string> = {
  cisa_kev: "CISA KEV",
  spamhaus_drop: "Spamhaus DROP",
  urlhaus: "URLhaus",
  threatfox: "ThreatFox",
  otx: "AlienVault OTX",
  misp: "MISP (self-hosted)",
};

const CVE_RE = /^CVE-\d{4}-\d{4,}$/;
const IPV4_CIDR_RE = /^\d{1,3}(\.\d{1,3}){3}\/\d{1,2}$/;

// ── fetch helper ────────────────────────────────────────────────────────────

import { fetchWithTimeout as kernelFetch, isTimeout } from "../feed-kernel";

/** One policy for every outbound feed request (src/lib/feed-kernel.ts): the
 * threat-intel UA identifies us to sources with attribution terms. */
async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  return kernelFetch(url, init, timeoutMs, "AdwaSec/1.0 (threat-intel feed sync)");
}

function networkError(feed: IntelFeedId, endpoint: string, err: unknown): IntelFeedError {
  const timedOut = isTimeout(err);
  return new IntelFeedError(
    feed,
    "UNREACHABLE",
    timedOut ? `Feed timed out.` : `Feed unreachable: ${err instanceof Error ? err.message : "unknown error"}`,
    timedOut ? 504 : 502,
    endpoint
  );
}

// ── 1. CISA KEV ─────────────────────────────────────────────────────────────

interface KevEntry {
  cveID: string;
  vendorProject: string;
  product?: string;
  vulnerabilityName?: string;
  dateAdded?: string;
  dueDate?: string;
  knownRansomwareCampaignUse?: string;
  shortDescription?: string;
  cwes?: string[];
}

const kevSnapshot = kevSnapshotJson as {
  source: string;
  sourceUrl: string;
  capturedAt: string;
  catalogVersion: string;
  dateReleased: string;
  catalogCount: number;
  note: string;
  entries: KevEntry[];
};

/** Map a KEV record onto the hub taxonomy. Ransomware-known → critical. */
export function kevToIndicator(e: KevEntry, catalogVersion: string): IntelIndicatorInput | null {
  if (!e.cveID || !CVE_RE.test(e.cveID) || !e.vendorProject) return null;
  const name = e.vulnerabilityName?.trim() || "Known Exploited Vulnerability";
  const product = e.product?.trim();
  const titleEn = `CISA KEV · ${e.vendorProject}${product ? ` ${product}` : ""} — ${name}`;
  const ransomware = (e.knownRansomwareCampaignUse ?? "").toLowerCase() === "known";
  const desc =
    (e.shortDescription?.trim() ??
      "Actively exploited vulnerability listed by the CISA Known Exploited Vulnerabilities catalog.") +
    (e.dueDate ? ` Federal remediation due date: ${e.dueDate}.` : "");
  return {
    type: "cve",
    value: e.cveID,
    titleEn,
    descriptionEn: desc,
    category: "vulnerability",
    severity: ransomware ? "critical" : "high",
    tlp: "TLP:CLEAR", // CISA KEV is public-domain data
    confidence: 100, // CISA-confirmed exploitation in the wild
    sourceRef: `KEV ${catalogVersion}`,
    firstSeenAt: e.dateAdded ?? null,
  };
}

export function parseKevCatalog(
  body: unknown
): { catalogVersion: string; dateReleased: string; catalogCount: number; entries: IntelIndicatorInput[]; skippedInvalid: number } {
  if (typeof body !== "object" || body === null) throw new IntelFeedError("cisa_kev", "BAD_PAYLOAD", "KEV catalog is not JSON.", 502, KEV_URL);
  const raw = body as Record<string, unknown>;
  const vulns = raw.vulnerabilities;
  if (!Array.isArray(vulns)) throw new IntelFeedError("cisa_kev", "BAD_PAYLOAD", "KEV catalog has no vulnerabilities array.", 502, KEV_URL);
  const catalogVersion = String(raw.catalogVersion ?? "").trim();
  if (!catalogVersion) throw new IntelFeedError("cisa_kev", "BAD_PAYLOAD", "KEV catalog has no catalogVersion.", 502, KEV_URL);
  const entries: IntelIndicatorInput[] = [];
  let skippedInvalid = 0;
  for (const v of vulns) {
    const parsed = kevToIndicator(v as KevEntry, catalogVersion);
    if (parsed) entries.push(parsed);
    else skippedInvalid++;
  }
  return {
    catalogVersion,
    dateReleased: String(raw.dateReleased ?? ""),
    catalogCount: Number(raw.count ?? vulns.length),
    entries,
    skippedInvalid,
  };
}

export async function fetchKev(maxEntries: number, timeoutMs: number): Promise<IntelFeedResult> {
  let res: Response;
  try {
    res = await fetchWithTimeout(KEV_URL, { headers: { Accept: "application/json" } }, timeoutMs);
  } catch (err) {
    // Network-level failure → labelled snapshot degradation (roadmap §8).
    return kevSnapshotResult(maxEntries, networkError("cisa_kev", KEV_URL, err).message);
  }
  // Transient edge failures (CDN/geo blocks 403, timeouts, rate limits, upstream
  // 5xx) are unreachability for this deployment → the same labelled snapshot.
  if ([403, 408, 429, 500, 502, 503, 504].includes(res.status)) {
    return kevSnapshotResult(maxEntries, `catalog returned HTTP ${res.status}.`);
  }
  if (!res.ok) throw new IntelFeedError("cisa_kev", "BAD_PAYLOAD", `KEV catalog HTTP ${res.status}.`, 502, KEV_URL);
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    return kevSnapshotResult(maxEntries, `Live catalog is not valid JSON — serving labelled snapshot.`);
  }
  let parsed: ReturnType<typeof parseKevCatalog>;
  try {
    parsed = parseKevCatalog(body);
  } catch (err) {
    // A reachable catalog with a broken payload is a real defect — surface it,
    // never substitute the snapshot silently for a malformed live document.
    throw err;
  }
  const capped = parsed.entries.slice(0, maxEntries);
  return {
    feed: "cisa_kev",
    label: FEED_LABELS.cisa_kev,
    mode: "live",
    endpoint: KEV_URL,
    asOf: `catalog v${parsed.catalogVersion}`,
    entries: capped,
    skippedInvalid: parsed.skippedInvalid,
    note:
      capped.length < parsed.entries.length
        ? `Capped at ${capped.length} of ${parsed.entries.length} catalog entries this run.`
        : undefined,
  };
}

function kevSnapshotResult(maxEntries: number, reason: string): IntelFeedResult {
  const entries = kevSnapshot.entries
    .map((e) => kevToIndicator(e, kevSnapshot.catalogVersion))
    .filter((e): e is IntelIndicatorInput => !!e)
    .slice(0, maxEntries);
  return {
    feed: "cisa_kev",
    label: FEED_LABELS.cisa_kev,
    mode: "snapshot",
    endpoint: KEV_URL,
    asOf: `captured ${kevSnapshot.capturedAt.slice(0, 10)} · catalog v${kevSnapshot.catalogVersion}`,
    entries,
    skippedInvalid: 0,
    note: `${kevSnapshot.note} Live fetch failed: ${reason}`,
  };
}

// ── 2. Spamhaus DROP ─────────────────────────────────────────────────────────

interface DropLine {
  cidr: string;
  sbl: string;
}

const dropSnapshot = dropSnapshotJson as {
  source: string;
  sourceUrl: string;
  capturedAt: string;
  listHeader: string;
  lastModified: string;
  count: number;
  note: string;
  entries: DropLine[];
};

export function parseDropText(text: string): { listDate: string; lastModified: string; entries: IntelIndicatorInput[]; skippedInvalid: number; duplicates: number } {
  let listDate = "";
  let lastModified = "";
  const seen = new Set<string>();
  const entries: IntelIndicatorInput[] = [];
  let skippedInvalid = 0;
  let duplicates = 0;
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (t.startsWith(";")) {
      if (!listDate && /Spamhaus DROP List/i.test(t)) listDate = t.replace(/^;\s*/, "");
      if (!lastModified && /^;\s*Last-Modified:/i.test(t)) lastModified = t.replace(/^;\s*Last-Modified:\s*/i, "");
      continue;
    }
    const m = /^([0-9.]+\/\d+)\s*;\s*(SBL[0-9]+)\s*$/i.exec(t);
    if (m && IPV4_CIDR_RE.test(m[1])) {
      if (seen.has(m[1])) {
        duplicates++; // the live list occasionally repeats a netblock — dedupe, never double-ingest
        continue;
      }
      seen.add(m[1]);
      entries.push({
        type: "ip",
        value: m[1],
        titleEn: `Spamhaus DROP hijacked netblock (${m[2]})`,
        descriptionEn:
          "Netblock listed by the Spamhaus DROP (Don't Route Or Peer) list — stolen or hijacked IP space controlled by criminal operators; the recommended action is not to route or peer it.",
        category: "other",
        severity: "medium",
        tlp: "TLP:CLEAR",
        confidence: 90,
        sourceRef: m[2],
        firstSeenAt: null,
      });
    } else if (t) {
      skippedInvalid++;
    }
  }
  return { listDate, lastModified, entries, skippedInvalid, duplicates };
}

export async function fetchDrop(maxEntries: number, timeoutMs: number): Promise<IntelFeedResult> {
  let res: Response;
  try {
    res = await fetchWithTimeout(DROP_URL, { headers: { Accept: "text/plain" } }, timeoutMs);
  } catch (err) {
    return dropSnapshotResult(maxEntries, networkError("spamhaus_drop", DROP_URL, err).message);
  }
  // Transient edge failures (CDN blocks, rate limits, upstream 5xx) → the same
  // labelled snapshot degradation as network-level unreachability.
  if ([403, 408, 429, 500, 502, 503, 504].includes(res.status)) {
    return dropSnapshotResult(maxEntries, `list returned HTTP ${res.status}.`);
  }
  if (!res.ok) throw new IntelFeedError("spamhaus_drop", "BAD_PAYLOAD", `DROP list HTTP ${res.status}.`, 502, DROP_URL);
  const text = await res.text();
  if (!/Spamhaus DROP/i.test(text)) throw new IntelFeedError("spamhaus_drop", "BAD_PAYLOAD", "DROP payload does not look like the DROP list.", 502, DROP_URL);
  const parsed = parseDropText(text);
  const capped = parsed.entries.slice(0, maxEntries);
  return {
    feed: "spamhaus_drop",
    label: FEED_LABELS.spamhaus_drop,
    mode: "live",
    endpoint: DROP_URL,
    asOf: parsed.lastModified ? `list ${parsed.lastModified}` : parsed.listDate,
    entries: capped,
    skippedInvalid: parsed.skippedInvalid,
    note:
      (parsed.duplicates ? `${parsed.duplicates} duplicate netblock line(s) in the live list deduplicated. ` : "") +
      (capped.length < parsed.entries.length
        ? `Capped at ${capped.length} of ${parsed.entries.length} netblocks this run. `
        : "") +
      `The Spamhaus Project SLU — attribution preserved per DROP terms.`,
  };
}

function dropSnapshotResult(maxEntries: number, reason: string): IntelFeedResult {
  const entries = dropSnapshot.entries
    .slice(0, maxEntries)
    .map((d) => ({
      type: "ip",
      value: d.cidr,
      titleEn: `Spamhaus DROP hijacked netblock (${d.sbl})`,
      descriptionEn:
        "Netblock listed by the Spamhaus DROP (Don't Route Or Peer) list — stolen or hijacked IP space controlled by criminal operators; the recommended action is not to route or peer it.",
      category: "other",
      severity: "medium",
      tlp: "TLP:CLEAR",
      confidence: 90,
      sourceRef: d.sbl,
      firstSeenAt: null,
    }));
  return {
    feed: "spamhaus_drop",
    label: FEED_LABELS.spamhaus_drop,
    mode: "snapshot",
    endpoint: DROP_URL,
    asOf: `captured ${dropSnapshot.capturedAt.slice(0, 10)} · ${dropSnapshot.lastModified}`,
    entries,
    skippedInvalid: 0,
    note: `${dropSnapshot.note} Live fetch failed: ${reason}`,
  };
}

// ── 3. abuse.ch URLhaus (keyed) ──────────────────────────────────────────────

/**
 * URLhaus v2 authenticated export: GET {URLHAUS_URL}{key}/recent.csv — CSV with
 * a header row; columns are mapped by name so order changes cannot mis-map data.
 */
export function parseUrlhausCsv(text: string): { entries: IntelIndicatorInput[]; skippedInvalid: number } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length < 2) return { entries: [], skippedInvalid: 0 };
  const header = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, "").toLowerCase());
  const col = (name: string) => header.indexOf(name);
  const urlIdx = col("url");
  if (urlIdx === -1) throw new IntelFeedError("urlhaus", "BAD_PAYLOAD", "URLhaus CSV has no url column.", 502, URLHAUS_URL);
  const threatIdx = col("threat");
  const familyIdx = col("malware_family") !== -1 ? col("malware_family") : col("tag");
  const dateIdx = col("dateadded");
  const entries: IntelIndicatorInput[] = [];
  let skippedInvalid = 0;
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
    const url = cells[urlIdx];
    if (!url || !/^https?:\/\//i.test(url)) {
      skippedInvalid++;
      continue;
    }
    const family = familyIdx !== -1 ? cells[familyIdx] : "";
    const threat = threatIdx !== -1 ? cells[threatIdx] : "malware_download";
    const date = dateIdx !== -1 ? cells[dateIdx] : "";
    let host = url;
    try {
      host = new URL(url).host;
    } catch {
      /* keep the full url as the display name */
    }
    entries.push({
      type: "url",
      value: url,
      titleEn: `URLhaus ${family ? family : threat} — ${host}`,
      descriptionEn:
        "Malware-distribution URL observed in the wild by the abuse.ch URLhaus community platform (Spamhaus + abuse.ch). Free tier, attribution required.",
      category: "malware",
      severity: "high",
      tlp: "TLP:GREEN",
      confidence: 80,
      sourceRef: `URLhaus${date ? ` ${date}` : ""}`,
      firstSeenAt: date || null,
    });
  }
  return { entries, skippedInvalid };
}

export async function fetchUrlhaus(maxEntries: number, timeoutMs: number): Promise<IntelFeedResult> {
  const c = intelConfig();
  if (!c.abusechKey) throw new IntelFeedError("urlhaus", "UNCONFIGURED", "ABUSECH_AUTH_KEY is not set — free Auth-Key from auth.abuse.ch.", 503, URLHAUS_URL);
  const endpoint = `${URLHAUS_URL}${encodeURIComponent(c.abusechKey)}/recent.csv`;
  let res: Response;
  try {
    res = await fetchWithTimeout(endpoint, { headers: { Accept: "text/csv, text/plain" } }, timeoutMs);
  } catch (err) {
    throw networkError("urlhaus", endpoint, err);
  }
  if (res.status === 401 || res.status === 403) throw new IntelFeedError("urlhaus", "UNAUTHORIZED", "Auth-Key rejected by URLhaus.", res.status, endpoint);
  if (!res.ok) throw new IntelFeedError("urlhaus", "BAD_PAYLOAD", `URLhaus export HTTP ${res.status}.`, 502, endpoint);
  const text = await res.text();
  if (text.trim().startsWith("{") || /^\s*</.test(text)) throw new IntelFeedError("urlhaus", "BAD_PAYLOAD", "URLhaus export did not return CSV.", 502, endpoint);
  const parsed = parseUrlhausCsv(text);
  const capped = parsed.entries.slice(0, maxEntries);
  return {
    feed: "urlhaus",
    label: FEED_LABELS.urlhaus,
    mode: "live",
    endpoint: URLHAUS_URL, // never echo the key back — record the base endpoint only
    asOf: "export regenerated every 5 min",
    entries: capped,
    skippedInvalid: parsed.skippedInvalid,
    note:
      capped.length < parsed.entries.length
        ? `Capped at ${capped.length} of ${parsed.entries.length} URLs this run (exports regenerate every 5 minutes; do not poll faster).`
        : `Terms: abuse.ch community API — attribution required.`,
  };
}

// ── 4. abuse.ch ThreatFox (keyed) ────────────────────────────────────────────

interface ThreatFoxIoc {
  id?: string;
  ioc?: string;
  ioc_type?: string;
  threat_type?: string;
  malware_printable?: string;
  confidence_level?: number;
  first_seen?: string;
}

export function parseThreatFox(body: unknown): { entries: IntelIndicatorInput[]; skippedInvalid: number } {
  if (typeof body !== "object" || body === null) throw new IntelFeedError("threatfox", "BAD_PAYLOAD", "ThreatFox response is not JSON.", 502, THREATFOX_URL);
  const raw = body as Record<string, unknown>;
  if (raw.query_status === "no_result") return { entries: [], skippedInvalid: 0 };
  if (raw.query_status !== "ok") {
    throw new IntelFeedError("threatfox", "BAD_PAYLOAD", `ThreatFox query_status: ${String(raw.query_status)}.`, 502, THREATFOX_URL);
  }
  const data = raw.data;
  if (!Array.isArray(data)) throw new IntelFeedError("threatfox", "BAD_PAYLOAD", "ThreatFox response has no data array.", 502, THREATFOX_URL);
  const entries: IntelIndicatorInput[] = [];
  let skippedInvalid = 0;
  for (const item of data as ThreatFoxIoc[]) {
    const value = String(item.ioc ?? "").trim();
    const iocType = String(item.ioc_type ?? "").toLowerCase();
    if (!value || !iocType) {
      skippedInvalid++;
      continue;
    }
    let type: string;
    if (iocType.startsWith("ip")) type = "ip";
    else if (iocType === "domain" || iocType === "hostname") type = "domain";
    else if (iocType === "url") type = "url";
    else if (iocType === "hash_md5") type = "hash_md5";
    else if (iocType === "hash_sha256") type = "hash_sha256";
    else {
      skippedInvalid++;
      continue;
    }
    const malware = item.malware_printable || "unattributed malware";
    const confidence = Math.max(0, Math.min(100, Number(item.confidence_level ?? 70) || 70));
    const firstSeen = item.first_seen ? item.first_seen.replace(" UTC", "Z").replace(" ", "T") : null;
    entries.push({
      type,
      value,
      titleEn: `ThreatFox IOC — ${malware}`,
      descriptionEn: `IOC observed in the wild, shared via the abuse.ch ThreatFox community platform (${item.threat_type ?? "IOC"}). Free tier, attribution required.`,
      category: "malware",
      severity: confidence >= 75 ? "high" : "medium",
      tlp: "TLP:GREEN",
      confidence,
      sourceRef: item.id ? `ThreatFox #${item.id}` : "ThreatFox",
      firstSeenAt: firstSeen,
    });
  }
  return { entries, skippedInvalid };
}

export async function fetchThreatFox(maxEntries: number, timeoutMs: number): Promise<IntelFeedResult> {
  const c = intelConfig();
  if (!c.abusechKey) throw new IntelFeedError("threatfox", "UNCONFIGURED", "ABUSECH_AUTH_KEY is not set — free Auth-Key from auth.abuse.ch.", 503, THREATFOX_URL);
  let res: Response;
  try {
    res = await fetchWithTimeout(
      THREATFOX_URL,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json", "Auth-Key": c.abusechKey },
        body: JSON.stringify({ query: "get_iocs", days: 7 }),
      },
      timeoutMs
    );
  } catch (err) {
    throw networkError("threatfox", THREATFOX_URL, err);
  }
  if (res.status === 401 || res.status === 403) throw new IntelFeedError("threatfox", "UNAUTHORIZED", "Auth-Key rejected by ThreatFox.", res.status, THREATFOX_URL);
  if (!res.ok) throw new IntelFeedError("threatfox", "BAD_PAYLOAD", `ThreatFox API HTTP ${res.status}.`, 502, THREATFOX_URL);
  const body = await res.json().catch(() => null);
  if (body === null) throw new IntelFeedError("threatfox", "BAD_PAYLOAD", "ThreatFox API returned non-JSON.", 502, THREATFOX_URL);
  const parsed = parseThreatFox(body);
  const capped = parsed.entries.slice(0, maxEntries);
  return {
    feed: "threatfox",
    label: FEED_LABELS.threatfox,
    mode: "live",
    endpoint: THREATFOX_URL,
    asOf: "last 7 days (get_iocs)",
    entries: capped,
    skippedInvalid: parsed.skippedInvalid,
    note:
      capped.length < parsed.entries.length
        ? `Capped at ${capped.length} of ${parsed.entries.length} IOCs this run.`
        : `Terms: abuse.ch community API — attribution required.`,
  };
}

// ── 5. AlienVault OTX (keyed, two-phase: pulses → indicators) ────────────────

interface OtxIndicator {
  indicator?: string;
  type?: string;
  description?: string | null;
  _id?: string;
}

export function otxTypeToIndicatorType(t: string): string | null {
  switch (t.toLowerCase()) {
    case "ipv4":
    case "ipv6":
      return "ip";
    case "domain":
    case "hostname":
      return "domain";
    case "url":
      return "url";
    case "filehashmd5":
      return "hash_md5";
    case "filehashsha256":
      return "hash_sha256";
    case "email":
      return "email";
    default:
      return null;
  }
}

/** Pulse tags map onto the platform taxonomy; unmapped → "other". */
export function otxCategory(tags: string[]): string {
  const t = tags.join(" ").toLowerCase();
  if (t.includes("phishing")) return "phishing";
  if (t.includes("ransom")) return "ransomware";
  if (t.includes("botnet") || t.includes("malware") || t.includes("c2") || t.includes("trojan")) return "malware";
  if (t.includes("apt")) return "apt";
  if (t.includes("ddos")) return "ddos";
  return "other";
}

export function parseOtxPulse(pulse: { id?: string; name?: string; tags?: string[] }, indicators: OtxIndicator[]): { entries: IntelIndicatorInput[]; skippedInvalid: number } {
  const category = otxCategory(Array.isArray(pulse.tags) ? pulse.tags : []);
  const pulseName = pulse.name ?? "community pulse";
  const entries: IntelIndicatorInput[] = [];
  let skippedInvalid = 0;
  for (const i of indicators) {
    const value = String(i.indicator ?? "").trim();
    const type = i.type ? otxTypeToIndicatorType(i.type) : null;
    if (!value || !type) {
      skippedInvalid++;
      continue;
    }
    entries.push({
      type,
      value,
      titleEn: `OTX · ${pulseName}`,
      descriptionEn: i.description || "Indicator from an AlienVault OTX community pulse the platform subscribes to.",
      category,
      severity: "medium",
      tlp: "TLP:AMBER",
      confidence: 70,
      sourceRef: pulse.id ? `OTX pulse ${pulse.id}` : "OTX",
      firstSeenAt: null,
    });
  }
  return { entries, skippedInvalid };
}

export async function fetchOtx(maxEntries: number, timeoutMs: number): Promise<IntelFeedResult> {
  const c = intelConfig();
  if (!c.otxKey) throw new IntelFeedError("otx", "UNCONFIGURED", "OTX_API_KEY is not set — free key from otx.alienvault.com.", 503, OTX_URL);
  let res: Response;
  try {
    res = await fetchWithTimeout(`${OTX_URL}?limit=10`, { headers: { "X-OTX-API-KEY": c.otxKey, Accept: "application/json" } }, timeoutMs);
  } catch (err) {
    throw networkError("otx", OTX_URL, err);
  }
  if (res.status === 401 || res.status === 403) throw new IntelFeedError("otx", "UNAUTHORIZED", "OTX API key rejected.", res.status, OTX_URL);
  if (!res.ok) throw new IntelFeedError("otx", "BAD_PAYLOAD", `OTX pulses HTTP ${res.status}.`, 502, OTX_URL);
  const body = (await res.json().catch(() => null)) as { results?: { id?: string; name?: string; tags?: string[] }[] } | null;
  if (!body || !Array.isArray(body.results)) throw new IntelFeedError("otx", "BAD_PAYLOAD", "OTX pulses response has no results array.", 502, OTX_URL);

  const entries: IntelIndicatorInput[] = [];
  let skippedInvalid = 0;
  let pulsesUsed = 0;
  for (const pulse of body.results.slice(0, 10)) {
    if (entries.length >= maxEntries) break;
    let ires: Response;
    try {
      ires = await fetchWithTimeout(
        `https://otx.alienvault.com/api/v1/pulses/${encodeURIComponent(String(pulse.id))}/indicators?limit=${maxEntries}`,
        { headers: { "X-OTX-API-KEY": c.otxKey, Accept: "application/json" } },
        timeoutMs
      );
    } catch (err) {
      throw networkError("otx", OTX_URL, err);
    }
    if (!ires.ok) continue; // per-pulse soft skip; the pulse set itself was live
    const ibody = (await ires.json().catch(() => null)) as { results?: OtxIndicator[] } | null;
    if (!ibody || !Array.isArray(ibody.results)) continue;
    pulsesUsed++;
    const parsed = parseOtxPulse(pulse as { id?: string; name?: string; tags?: string[] }, ibody.results);
    skippedInvalid += parsed.skippedInvalid;
    for (const e of parsed.entries) {
      if (entries.length < maxEntries) entries.push(e);
    }
  }
  return {
    feed: "otx",
    label: FEED_LABELS.otx,
    mode: "live",
    endpoint: OTX_URL,
    asOf: `subscribed pulses (${pulsesUsed} used this run)`,
    entries,
    skippedInvalid,
    note: `Terms: AlienVault OTX community API — free key, rate-limited.`,
  };
}

// ── 6. GreyNoise Community enrichment (per-IP) ───────────────────────────────

export interface GreynoiseEnrichment {
  ip: string;
  noise: boolean | null; // known internet-wide scanner?
  riot: boolean | null; // known common business service?
  message: string | null;
  link: string | null;
  name: string | null;
  categories: string[];
  raw: unknown;
}

export async function enrichIpGreynoise(ip: string): Promise<GreynoiseEnrichment> {
  const c = intelConfig();
  if (!c.greynoiseKey) {
    throw new IntelFeedError("greynoise", "UNCONFIGURED", "GREYNOISE_API_KEY is not set — free Community key from greynoise.io.", 503, `${GREYNOISE_URL}/{ip}`);
  }
  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) {
    throw new IntelFeedError("greynoise", "BAD_PAYLOAD", "IPv4 address required.", 400, `${GREYNOISE_URL}/{ip}`);
  }
  const endpoint = `${GREYNOISE_URL}/${encodeURIComponent(ip)}`;
  let res: Response;
  try {
    res = await fetchWithTimeout(endpoint, { headers: { key: c.greynoiseKey, Accept: "application/json" } }, c.timeoutMs);
  } catch (err) {
    throw networkError("greynoise", endpoint, err);
  }
  if (res.status === 401 || res.status === 403) throw new IntelFeedError("greynoise", "UNAUTHORIZED", "GreyNoise key rejected.", res.status, endpoint);
  if (!res.ok) throw new IntelFeedError("greynoise", "BAD_PAYLOAD", `GreyNoise HTTP ${res.status}.`, 502, endpoint);
  const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body.noise !== "boolean") {
    throw new IntelFeedError("greynoise", "BAD_PAYLOAD", "GreyNoise response missing noise flag.", 502, endpoint);
  }
  return {
    ip,
    noise: body.noise === true,
    riot: typeof body.riot === "boolean" ? (body.riot as boolean) : null,
    message: typeof body.message === "string" ? body.message : null,
    link: typeof body.link === "string" ? body.link : null,
    name: typeof body.name === "string" ? body.name : null,
    categories: Array.isArray(body.categories) ? (body.categories as string[]) : [],
    raw: body,
  };
}

// ── 7. MISP self-hosted private exchange (keyed — roadmap §5.1) ───────────────

interface MispTag {
  name?: string;
}

interface MispAttribute {
  id?: string;
  uuid?: string;
  type?: string;
  category?: string;
  to_ids?: boolean;
  value?: string;
  timestamp?: string | number; // unix epoch seconds
}

interface MispEvent {
  id?: string;
  uuid?: string;
  info?: string; // event title
  date?: string; // YYYY-MM-DD the event is about
  published?: boolean | number;
  threat_level_id?: string; // 1 high | 2 medium | 3 low | 4 undefined
  analysis?: string;
  timestamp?: string | number;
  Tag?: MispTag[];
  Attribute?: MispAttribute[];
}

/** MISP tlp: machine tags → platform TLP markings. */
export function mispTlpFromTags(tags: MispTag[]): string {
  for (const tag of tags) {
    const m = /^tlp:(clear|green|amber\+strict|amber|red)$/i.exec((tag.name ?? "").trim());
    if (m) {
      const v = m[1].toLowerCase();
      if (v === "clear") return "TLP:CLEAR";
      if (v === "green") return "TLP:GREEN";
      if (v === "amber+strict") return "TLP:AMBER+STRICT";
      if (v === "amber") return "TLP:AMBER";
      return "TLP:RED";
    }
  }
  return "TLP:AMBER"; // conservative default when the event carries no TLP tag
}

/** MISP attribute types → the hub taxonomy (unsupported types are skipped). */
export function mispTypeToIndicatorType(t: string): string | null {
  switch (t.toLowerCase()) {
    case "ip-src":
    case "ip-dst":
      return "ip";
    case "domain":
    case "hostname":
      return "domain";
    case "url":
    case "link":
      return "url";
    case "md5":
      return "hash_md5";
    case "sha256":
      return "hash_sha256";
    case "sha1": // no sha1 in the hub taxonomy — honestly skipped, never mangled
      return null;
    case "email-src":
    case "email-dst":
      return "email";
    case "filename":
    case "filename|md5":
    case "filename|sha256":
      return "filename";
    default:
      return null;
  }
}

/** Event tags map onto the platform taxonomy (same mapping family as OTX). */
export function mispCategory(tags: MispTag[]): string {
  const t = tags.map((x) => x.name ?? "").join(" ").toLowerCase();
  if (t.includes("ransom")) return "ransomware";
  if (t.includes("phishing")) return "phishing";
  if (t.includes("botnet") || t.includes("malware") || t.includes("c2") || t.includes("trojan")) return "malware";
  if (t.includes("apt")) return "apt";
  if (t.includes("ddos")) return "ddos";
  return "other";
}

/** MISP threat_level_id → severity (1=high, 2=medium, 3=low, 4=undefined). */
export function mispSeverity(threatLevelId: string | undefined): string {
  switch (String(threatLevelId ?? "4")) {
    case "1":
      return "high";
    case "3":
      return "low";
    default:
      return "medium"; // 2 and undefined → medium
  }
}

/**
 * Parse a MISP restSearch JSON response (returnformat json):
 * {"response":[{"Event":{…, Tag:[{name:"tlp:amber"}], Attribute:[…]}}]}
 * (a bare array of Event envelopes is accepted too — both shapes are seen in
 * the wild across MISP versions). TLP:RED is honoured, never dropped: the
 * hybrid sharing decision keeps it peer-to-peer inside the tenant.
 */
export function parseMispEvents(body: unknown): { entries: IntelIndicatorInput[]; skippedInvalid: number; duplicates: number; events: number } {
  if (typeof body !== "object" || body === null) throw new IntelFeedError("misp", "BAD_PAYLOAD", "MISP response is not JSON.", 502, MISP_ENDPOINT);
  const raw = body as Record<string, unknown>;
  let list: unknown[];
  if (Array.isArray(raw.response)) list = raw.response;
  else if (Array.isArray(body)) list = body;
  else throw new IntelFeedError("misp", "BAD_PAYLOAD", "MISP response has no response array.", 502, MISP_ENDPOINT);

  const seen = new Set<string>();
  const entries: IntelIndicatorInput[] = [];
  let skippedInvalid = 0;
  let duplicates = 0;
  let events = 0;
  for (const item of list) {
    const ev = (item as { Event?: MispEvent }).Event ?? (item as MispEvent);
    if (typeof ev !== "object" || ev === null) {
      skippedInvalid++;
      continue;
    }
    const tags = Array.isArray(ev.Tag) ? ev.Tag : [];
    const tlp = mispTlpFromTags(tags);
    const category = mispCategory(tags);
    const severity = mispSeverity(ev.threat_level_id);
    const eventTitle = (ev.info ?? "").trim() || "shared MISP event";
    const eventDate = typeof ev.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(ev.date) ? ev.date : null;
    const attrs = Array.isArray(ev.Attribute) ? ev.Attribute : [];
    if (attrs.length > 0) events++;
    for (const a of attrs) {
      const value = String(a.value ?? "").trim();
      const type = a.type ? mispTypeToIndicatorType(a.type) : null;
      if (!value || !type) {
        skippedInvalid++;
        continue;
      }
      const key = `${type}|${value}`;
      if (seen.has(key)) {
        duplicates++; // the same indicator across events — dedupe, never double-ingest
        continue;
      }
      seen.add(key);
      // Attribute timestamp (unix seconds) is the finest first-observation
      // time; fall back to the event date.
      let firstSeenAt: string | null = null;
      if (a.timestamp) {
        const ts = Number(a.timestamp);
        if (Number.isFinite(ts) && ts > 0) firstSeenAt = new Date(ts * 1000).toISOString();
      }
      if (!firstSeenAt && eventDate) firstSeenAt = eventDate;
      entries.push({
        type,
        value,
        titleEn: `MISP · ${eventTitle}`,
        descriptionEn:
          `Indicator shared through the self-hosted MISP threat-intelligence platform (event "${eventTitle}"${ev.uuid ? `, UUID ${ev.uuid}` : ""}). TLP marking (${tlp}) is honoured — restricted markings stay inside the tenant.`,
        category,
        severity,
        tlp,
        confidence: a.to_ids === true ? 90 : 70, // to_ids = publisher marks it detection-worthy
        sourceRef: ev.uuid ? `MISP event ${ev.uuid}` : ev.id ? `MISP event #${ev.id}` : "MISP",
        firstSeenAt,
      });
    }
  }
  return { entries, skippedInvalid, duplicates, events };
}

export async function fetchMisp(maxEntries: number, timeoutMs: number): Promise<IntelFeedResult> {
  const c = intelConfig();
  if (!c.mispUrl || !c.mispKey) {
    throw new IntelFeedError("misp", "UNCONFIGURED", "MISP_URL and MISP_API_KEY are not set — self-hosted MISP instance (AGPL, free software).", 503, `${c.mispUrl ?? "MISP_URL"}${MISP_ENDPOINT}`);
  }
  const endpoint = `${c.mispUrl}${MISP_ENDPOINT}`;
  // restSearch: published events modified in the last 7 days, one page.
  const since = Math.floor((Date.now() - 7 * 24 * 3600 * 1000) / 1000);
  let res: Response;
  try {
    res = await fetchWithTimeout(
      endpoint,
      {
        method: "POST",
        headers: { Authorization: c.mispKey, Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ returnformat: "json", published: true, timestamp: since, limit: 25, page: 1 }),
      },
      timeoutMs
    );
  } catch (err) {
    throw networkError("misp", endpoint, err);
  }
  if (res.status === 401 || res.status === 403) throw new IntelFeedError("misp", "UNAUTHORIZED", "MISP auth key rejected.", res.status, endpoint);
  if (!res.ok) throw new IntelFeedError("misp", "BAD_PAYLOAD", `MISP restSearch HTTP ${res.status}.`, 502, endpoint);
  const body = await res.json().catch(() => null);
  if (body === null) throw new IntelFeedError("misp", "BAD_PAYLOAD", "MISP restSearch returned non-JSON.", 502, endpoint);
  const parsed = parseMispEvents(body);
  const capped = parsed.entries.slice(0, maxEntries);
  return {
    feed: "misp",
    label: FEED_LABELS.misp,
    mode: "live",
    endpoint,
    asOf: `published events, last 7 days (${parsed.events} with indicators)`,
    entries: capped,
    skippedInvalid: parsed.skippedInvalid,
    note:
      (parsed.duplicates ? `${parsed.duplicates} duplicate indicator(s) across events deduplicated. ` : "") +
      (capped.length < parsed.entries.length ? `Capped at ${capped.length} of ${parsed.entries.length} indicators this run. ` : "") +
      `Terms: MISP — AGPL-3.0, self-hosted private sharing channel; TLP markings honoured (TLP:AMBER+ and TLP:RED never leave the tenant).`,
  };
}

// ── 8. VirusTotal reputation enrichment (per target — roadmap §5.2) ─────────

/** Classify an enrichment target: IPv4, http(s) URL, or MD5/SHA-1/SHA-256 file hash. */
export function vtTargetKind(target: string): "ip" | "url" | "hash" | null {
  const t = target.trim();
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(t)) {
    // reject malformed octets (999.1.1.1 passes the shape, not the range)
    if (t.split(".").every((o) => Number(o) <= 255)) return "ip";
    return null;
  }
  if (/^https?:\/\//i.test(t) && t.length <= 2048) return "url";
  if (/^[0-9a-f]{32}$|^[0-9a-f]{40}$|^[0-9a-f]{64}$/.test(t)) return "hash";
  return null;
}

/** VT v3 endpoint path for a target kind (URL ids are base64url, unpadded). */
export function vtEndpointPath(target: string, kind: "ip" | "url" | "hash"): string {
  if (kind === "ip") return `/ip_addresses/${encodeURIComponent(target)}`;
  if (kind === "hash") return `/files/${target}`;
  return `/urls/${Buffer.from(target, "utf8").toString("base64url")}`;
}

export interface VtEnrichment {
  target: string;
  kind: "ip" | "url" | "hash";
  verdict: "malicious" | "suspicious" | "clean" | "unknown";
  malicious: number;
  suspicious: number;
  harmless: number;
  undetected: number;
  timeout: number;
  engineCount: string; // e.g. "2/72 engines"
  reputation: number | null; // community votes (ip/domain)
  lastAnalysisDate: string | null; // ISO
  link: string | null;
}

/** Map a VT v3 object report onto the enrichment contract (pure — testable). */
export function parseVtReport(body: unknown, target: string, kind: "ip" | "url" | "hash"): VtEnrichment {
  if (typeof body !== "object" || body === null) throw new IntelFeedError("virustotal", "BAD_PAYLOAD", "VirusTotal response is not JSON.", 502, VIRUSTOTAL_URL);
  const raw = body as { data?: { attributes?: Record<string, unknown>; links?: { self?: string } } };
  const attrs = raw.data?.attributes;
  if (!attrs || typeof attrs !== "object") throw new IntelFeedError("virustotal", "BAD_PAYLOAD", "VirusTotal response has no data.attributes.", 502, VIRUSTOTAL_URL);
  const stats = attrs.last_analysis_stats as Record<string, number> | undefined;
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
  const malicious = num(stats?.malicious);
  const suspicious = num(stats?.suspicious);
  const harmless = num(stats?.harmless);
  const undetected = num(stats?.undetected);
  const timeout = num(stats?.timeout);
  const reputation = typeof attrs.reputation === "number" ? attrs.reputation : null;
  const lastAnalysisDate =
    typeof attrs.last_analysis_date === "number" && attrs.last_analysis_date > 0
      ? new Date(attrs.last_analysis_date * 1000).toISOString()
      : null;
  const link = raw.data?.links?.self ?? null;
  const verdict: VtEnrichment["verdict"] =
    malicious > 0 ? "malicious" : suspicious > 0 ? "suspicious" : harmless + undetected > 0 ? "clean" : "unknown";
  const total = malicious + suspicious + harmless + undetected + timeout;
  return {
    target,
    kind,
    verdict,
    malicious,
    suspicious,
    harmless,
    undetected,
    timeout,
    engineCount: `${malicious + suspicious}/${total} engines`,
    reputation,
    lastAnalysisDate,
    link,
  };
}

/**
 * One reputation lookup against the VirusTotal public API (free tier:
 * 4 requests/min, 500/day — an analyst action, never bulk-synced).
 * Unconfigured → honest 503; an object never analysed by VT → verdict
 * "unknown" with zero counts (a real answer, not an error, not a fabrication).
 */
export async function enrichVirusTotal(target: string): Promise<VtEnrichment> {
  const c = intelConfig();
  if (!c.virustotalKey) {
    throw new IntelFeedError("virustotal", "UNCONFIGURED", "VIRUSTOTAL_API_KEY is not set — free key from virustotal.com (4 req/min · 500/day).", 503, VIRUSTOTAL_URL);
  }
  const kind = vtTargetKind(target);
  if (!kind) {
    throw new IntelFeedError("virustotal", "BAD_PAYLOAD", "Target must be an IPv4 address, an http(s) URL, or an MD5/SHA-1/SHA-256 hash.", 400, VIRUSTOTAL_URL);
  }
  const endpoint = `${VIRUSTOTAL_URL}${vtEndpointPath(target.trim(), kind)}`;
  let res: Response;
  try {
    res = await fetchWithTimeout(endpoint, { headers: { "x-apikey": c.virustotalKey, Accept: "application/json" } }, c.timeoutMs);
  } catch (err) {
    throw networkError("virustotal", endpoint, err);
  }
  if (res.status === 404) {
    // Never analysed by VT — an honest "unknown", never invented counts.
    return {
      target: target.trim(),
      kind,
      verdict: "unknown",
      malicious: 0, suspicious: 0, harmless: 0, undetected: 0, timeout: 0,
      engineCount: "0/0 engines",
      reputation: null,
      lastAnalysisDate: null,
      link: null,
    };
  }
  if (res.status === 401 || res.status === 403) throw new IntelFeedError("virustotal", "UNAUTHORIZED", "VirusTotal key rejected.", res.status, VIRUSTOTAL_URL);
  if (res.status === 429) throw new IntelFeedError("virustotal", "UNREACHABLE", "VirusTotal public-API quota exceeded (4 req/min · 500/day).", 429, VIRUSTOTAL_URL);
  if (!res.ok) throw new IntelFeedError("virustotal", "BAD_PAYLOAD", `VirusTotal HTTP ${res.status}.`, 502, VIRUSTOTAL_URL);
  const body = await res.json().catch(() => null);
  if (body === null) throw new IntelFeedError("virustotal", "BAD_PAYLOAD", "VirusTotal returned non-JSON.", 502, VIRUSTOTAL_URL);
  return parseVtReport(body, target.trim(), kind);
}

// ── registry ─────────────────────────────────────────────────────────────────

export function intelFeedStatuses(): IntelFeedStatus[] {
  const c = intelConfig();
  const st = (
    id: Exclude<IntelFeedId, "greynoise">,
    endpoint: string,
    keyRequired: boolean,
    hasKey: boolean,
    attribution: string,
    snap?: { count: number; asOf: string; note: string }
  ): IntelFeedStatus => ({
    id,
    label: FEED_LABELS[id],
    endpoint,
    keyRequired,
    configured: !keyRequired || hasKey,
    ...(snap ? { snapshotCount: snap.count, snapshotAsOf: snap.asOf, snapshotNote: snap.note } : {}),
    attribution,
  });
  return [
    st("cisa_kev", KEV_URL, false, false, "CISA KEV catalog — U.S. public domain", { count: kevSnapshot.entries.length, asOf: kevSnapshot.capturedAt.slice(0, 10), note: kevSnapshot.note }),
    st("spamhaus_drop", DROP_URL, false, false, "The Spamhaus Project SLU — attribution preserved", { count: dropSnapshot.count, asOf: dropSnapshot.capturedAt.slice(0, 10), note: dropSnapshot.note }),
    st("urlhaus", URLHAUS_URL, true, !!c.abusechKey, "abuse.ch community API — free Auth-Key, attribution required"),
    st("threatfox", THREATFOX_URL, true, !!c.abusechKey, "abuse.ch community API — free Auth-Key, attribution required"),
    st("otx", OTX_URL, true, !!c.otxKey, "AlienVault OTX — free API key, rate-limited"),
    st(
      "misp",
      `${c.mispUrl ?? "https://<your-misp-host>"}${MISP_ENDPOINT}`,
      true,
      !!(c.mispUrl && c.mispKey),
      "MISP — AGPL-3.0, self-hosted private sharing channel; TLP honoured"
    ),
  ];
}

export interface IntelFetchOutcome {
  results: IntelFeedResult[]; // feeds that produced data (live or labelled snapshot)
  errors: IntelFeedError[]; // feeds that failed or are unconfigured — never silent
}

/**
 * Run the connectors. Key-less feeds always produce data (live, or the bundled
 * labelled snapshot when the source is unreachable). Keyed feeds that are
 * unconfigured or failing surface as IntelFeedError entries in `errors` so the
 * caller records a visible skipped/failed state — never a silent omission.
 */
export async function runIntelFetch(feeds: IntelFeedId[]): Promise<IntelFetchOutcome> {
  const c = intelConfig();
  if (c.disabled) throw new IntelFeedError("cisa_kev", "UNCONFIGURED", "Public intel feeds are disabled (INTEL_FEEDS_OFF).", 503, "-");
  const results: IntelFeedResult[] = [];
  const errors: IntelFeedError[] = [];
  for (const feed of feeds) {
    try {
      if (feed === "cisa_kev") results.push(await fetchKev(c.maxEntries, c.timeoutMs));
      else if (feed === "spamhaus_drop") results.push(await fetchDrop(c.maxEntries, c.timeoutMs));
      else if (feed === "urlhaus") results.push(await fetchUrlhaus(c.maxEntries, c.timeoutMs));
      else if (feed === "threatfox") results.push(await fetchThreatFox(c.maxEntries, c.timeoutMs));
      else if (feed === "otx") results.push(await fetchOtx(c.maxEntries, c.timeoutMs));
      else if (feed === "misp") results.push(await fetchMisp(c.maxEntries, c.timeoutMs));
    } catch (err) {
      if (err instanceof IntelFeedError) errors.push(err);
      else errors.push(new IntelFeedError(feed, "BAD_PAYLOAD", err instanceof Error ? err.message : "unknown error", 500, "-"));
    }
  }
  if (results.length === 0 && errors.length > 0) throw errors[0];
  return { results, errors };
}

export const INTEL_FEED_IDS: IntelFeedId[] = ["cisa_kev", "spamhaus_drop", "urlhaus", "threatfox", "otx", "misp"];
