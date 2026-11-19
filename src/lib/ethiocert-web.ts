/**
 * Adwa Cyber — Ethio-CERT / INSA real national-source adapter.
 * ---------------------------------------------------------------------
 * Binds the platform to the REAL public Ethiopian national cyber
 * ecosystem. Two source families, both live-verified on 2026-11-19:
 *
 *  A. Ethio-CERT public JSON API (structured — primary):
 *       https://www.ethiocert.gov.et/api
 *         /advisories/   national security advisories (DRF list; currently
 *                        empty — the site itself reports "No advisories
 *                        found for the specified criteria")
 *         /alerts/       9 national cyber alerts, bilingual, with severity
 *         /news/         113 national security news items
 *         /regulations/  the national legal corpus — Computer Crime
 *                        Proclamation, IT Proclamation 2024, national
 *                        cybersecurity policy, cryptography directives…
 *         /gci/latest    Ethiopia's ITU Global Cybersecurity Index pillar
 *                        scores (2024: legal 18.83 · technical 14.37 ·
 *                        organizational 12.12 · capacity 15.33 ·
 *                        cooperation 15.69)
 *       All endpoints accept ?lang=en|am and paginate DRF-style
 *       ({count, next, previous, results}).
 *
 *  B. INSA public web (HTML — institutional news on the home page):
 *       https://www.insa.gov.et  (/blog/<slug> headlines)
 *
 * Honesty model (same convention as src/lib/intel-feeds.ts):
 *   mode "live"     fetched and parsed just now (60 s in-process cache)
 *   mode "snapshot" source unreachable (or ETHIO_WEB_OFF) → the bundled
 *                  labelled snapshot captured from the real sources is
 *                  served, with capture date + degradation reason.
 *                  Never invented content.
 *
 * The structured exchange client (src/lib/ethiocert-client.ts,
 * {ETHIOCERT_API_URL}/feed + /reports, bearer-key bilateral sync) remains
 * the official integration path for when Ethio-CERT grants API keys; this
 * module is the public layer every deployment can read immediately.
 *
 * Configuration:
 *   ETHIOCERT_WEB_URL     site base, default https://www.ethiocert.gov.et
 *   ETHIOCERT_API_BASE    API base, default ${ETHIOCERT_WEB_URL}/api
 *   INSA_NEWS_URL         default https://www.insa.gov.et
 *   ETHIO_WEB_TIMEOUT_MS  default 8 000
 *   ETHIO_WEB_OFF         true/1 → snapshot only (offline / air-gap)
 */
import insaNewsSnapshotJson from "./ethio-snapshots/insa-news.json";
import ethiocertApiSnapshotJson from "./ethio-snapshots/ethiocert-api.json";

// ── configuration ───────────────────────────────────────────────────────────

export interface EthioWebConfig {
  siteUrl: string;
  apiBase: string;
  insaNewsUrl: string;
  timeoutMs: number;
  disabled: boolean;
}

export function ethioWebConfig(): EthioWebConfig {
  const site = (process.env.ETHIOCERT_WEB_URL ?? "https://www.ethiocert.gov.et").replace(/\/+$/, "");
  return {
    siteUrl: site,
    apiBase: (process.env.ETHIOCERT_API_BASE ?? `${site}/api`).replace(/\/+$/, ""),
    insaNewsUrl: (process.env.INSA_NEWS_URL ?? "https://www.insa.gov.et").replace(/\/+$/, ""),
    timeoutMs: Number(process.env.ETHIO_WEB_TIMEOUT_MS ?? 8_000) || 8_000,
    disabled: /^(1|true)$/i.test(process.env.ETHIO_WEB_OFF ?? ""),
  };
}

// ── result contracts ────────────────────────────────────────────────────────

export type Severity = "critical" | "high" | "medium" | "low";

export interface WebAdvisory {
  id: string;
  titleEn: string;
  titleAm?: string;
  url: string;
  date: string | null;
  severity: Severity | null;
  summaryEn?: string;
}

export interface EthioAlert {
  id: string;
  titleEn: string; // as published (mixed EN/AM content is the national reality)
  titleAm?: string; // from the ?lang=am request when it differs
  url: string;
  date: string | null;
  severity: Severity | null;
  summaryEn?: string;
}

export interface EthioNewsItem {
  id: string;
  titleEn: string;
  titleAm?: string;
  url: string;
  date: string | null;
  summaryEn?: string;
}

export interface EthioRegulation {
  id: string;
  titleEn: string;
  titleAm?: string;
  year: number | null;
  url: string; // official PDF on ethiocert.gov.et
  type: string | null;
}

export interface EthioGci {
  year: number;
  pillars: { legal: number; technical: number; organizational: number; capacity: number; cooperation: number };
  timeline: { year: number; pillars: EthioGci["pillars"] }[];
  sourceUrl: string;
}

export interface InsaNewsItem {
  id: string;
  titleEn: string;
  url: string;
  date: string | null;
  summaryEn?: string;
}

export type EthioWebMode = "live" | "snapshot";

export interface EthioWebFeed<T> {
  mode: EthioWebMode;
  url: string; // the source page / endpoint
  asOf: string; // live: fetch time; snapshot: capture time
  entries: T[];
  note?: string;
  degradedReason?: string; // snapshot only: why live failed
}

// ── HTML parsing helpers (INSA home page + tolerant advisory fallback) ─────

const ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", "#39": "'", "#x27": "'",
};

function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&(\w+|#\d+|#x[\da-f]+);/g, (m, name: string) => ENTITIES[name] ?? m);
}

function stripTags(html: string): string {
  return decodeEntities(html.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
}

function absolutize(href: string, base: string): string {
  try {
    return new URL(href, base.endsWith("/") ? base : `${base}/`).toString();
  } catch {
    return href;
  }
}

function shortHash(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

/** "05 Nov, 2026" | "Nov 5, 2026" | ISO | "05/11/2026" → ISO, else null. */
function parseDate(text: string): string | null {
  const m = text.match(/\b(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*,?\s+(\d{4})\b/i);
  if (m) {
    const mo = MONTHS[m[2].toLowerCase()];
    if (mo) return `${m[3]}-${String(mo).padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  const m2 = text.match(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{1,2}),?\s+(\d{4})\b/i);
  if (m2) {
    const mo = MONTHS[m2[1].toLowerCase()];
    if (mo) return `${m2[3]}-${String(mo).padStart(2, "0")}-${m2[2].padStart(2, "0")}`;
  }
  const iso = text.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const num = text.match(/\b(\d{1,2})[/](\d{1,2})[/](\d{4})\b/);
  if (num) return `${num[3]}-${num[2].padStart(2, "0")}-${num[1].padStart(2, "0")}`; // day/month/year
  return null;
}

function severityIn(card: string): Severity | null {
  for (const s of ["critical", "high", "medium", "low"] as const) {
    if (new RegExp(`\\b${s}\\b`, "i").test(card)) return s;
  }
  return null;
}

/**
 * Bounding box of the card-like container around an anchor — <article>,
 * <li>, <tr>, or a div whose class mentions card/item/post/news/advis/blog.
 * Metadata (date, severity, summary) is searched INSIDE the card so it
 * never bleeds from an adjacent card in tight listing layouts.
 */
function cardBounds(html: string, idx: number): { start: number; end: number } {
  const from = Math.max(0, idx - 6_000);
  const before = html.slice(from, idx);
  const OPEN = /<(article|li|tr)\b[^>]*>|<div\b[^>]*class\s*=\s*["'][^"']*\b(card|item|post|news|advis|blog)\b[^"']*["'][^>]*>/gi;
  let openAbs = -1;
  let openTag = "div";
  for (const m of before.matchAll(OPEN)) {
    openAbs = from + (m.index ?? 0);
    openTag = (m[1] ?? "div").toLowerCase();
  }
  if (openAbs < 0) return { start: Math.max(0, idx - 300), end: Math.min(html.length, idx + 500) };
  const close = `</${openTag}>`;
  const closeRel = html.toLowerCase().indexOf(close, idx);
  return { start: openAbs, end: closeRel >= 0 ? closeRel + close.length : Math.min(html.length, idx + 900) };
}

/** Nearest <h1..h6> text before the anchor, for "Read more"-style links. */
function headingBefore(html: string, anchorStart: number): string | null {
  const before = html.slice(Math.max(0, anchorStart - 800), anchorStart);
  const heads = [...before.matchAll(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi)].map((m) => stripTags(m[1]));
  const meaningful = heads.filter((h) => h.length >= 12);
  return meaningful.length ? meaningful[meaningful.length - 1] : null;
}

function summaryIn(html: string, from: number, end: number): string | undefined {
  const window = html.slice(from, end);
  const m = window.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
  const text = m ? stripTags(m[1]) : "";
  return text.length >= 24 && text.length <= 400 ? text : undefined;
}

interface AnchorHit {
  href: string;
  text: string;
  start: number;
}

const GENERIC = /^(read\s*more|more|details?|next|previous|prev|last|first|all\s+news|back|→|»)$/i;

function anchorsWith(html: string, matcher: (href: string) => boolean): AnchorHit[] {
  const hits: AnchorHit[] = [];
  for (const m of html.matchAll(/<a\b[^>]*?href\s*=\s*(?:&quot;|"|')([^"']*)(?:&quot;|"|')[^>]*>([\s\S]*?)<\/a>/gi)) {
    const href = decodeEntities(m[1]).trim();
    if (!href || href.startsWith("#") || href.toLowerCase().startsWith("mailto:") || href.toLowerCase().startsWith("javascript:")) continue;
    if (!matcher(href)) continue;
    hits.push({ href, text: stripTags(m[2]), start: m.index ?? 0 });
  }
  return hits;
}

/**
 * Advisory detail links on a server-rendered listing resolve under
 * /advisories/<slug> (the listing page is /advisories itself). Accept any
 * "advisor*" link that carries a path segment (or an id-bearing query)
 * beyond the bare listing page; pagination (?page=2) does NOT qualify.
 */
function isAdvisoryDetail(href: string, base: string): boolean {
  if (!/advisor/i.test(href)) return false;
  let u: URL;
  try {
    u = new URL(href, base.endsWith("/") ? base : `${base}/`);
  } catch {
    return false;
  }
  let listingPath: string;
  try {
    listingPath = new URL(base).pathname.replace(/\/+$/, "");
  } catch {
    listingPath = "/";
  }
  const path = u.pathname.replace(/\/+$/, "");
  if (path === listingPath) return false; // the bare listing page itself
  return path.length > listingPath.length || /[?&](id|advisory|advis|slug|post)=/i.test(u.search);
}

/**
 * Parse a server-rendered advisories listing (tolerant utility — kept for
 * deployments/other CERT sites that server-render; the Ethio-CERT site is
 * currently a React SPA whose shell yields zero anchors, so the primary
 * path for ethiocert.gov.et is the JSON API). Empty result is a valid,
 * honest state.
 */
export function parseAdvisoriesHtml(html: string, base: string, maxEntries = 50): WebAdvisory[] {
  const out: WebAdvisory[] = [];
  const seen = new Set<string>();
  for (const hit of anchorsWith(html, (href) => isAdvisoryDetail(href, base))) {
    const url = absolutize(hit.href, base);
    if (seen.has(url)) continue;
    seen.add(url);
    let title = hit.text;
    if (title.length < 12 || GENERIC.test(title)) title = headingBefore(html, hit.start) ?? title;
    // Unusable link (icon/pagination/label) — never fabricate an entry for it.
    if (title.length < 12 || GENERIC.test(title)) continue;
    const pathSlug = (() => {
      try {
        const seg = new URL(url).pathname.split("/").filter(Boolean).pop() ?? "";
        return seg.replace(/[^a-z0-9-]+/gi, "-").slice(0, 60);
      } catch {
        return "";
      }
    })();
    const card = cardBounds(html, hit.start);
    const cardText = html.slice(card.start, card.end);
    out.push({
      id: `ec-${pathSlug || shortHash(url)}`,
      titleEn: title.slice(0, 240),
      url,
      date: parseDate(cardText),
      severity: severityIn(cardText),
      summaryEn: summaryIn(html, hit.start, card.end),
    });
    if (out.length >= maxEntries) break;
  }
  return out;
}

/**
 * A news anchor qualifies as a DETAIL link: it carries an id-ish query
 * (?id=54) or a path deeper than a bare single-segment listing (/news/61,
 * /blog/<slug>). The bare listing link (/news, /blog) is excluded so it
 * cannot inherit a far-away heading and become a duplicate headline.
 * insa.gov.et renders headlines as /blog/<slug> links (verified live).
 */
function isNewsDetail(href: string, base: string): boolean {
  if (/[?&]page=\d/i.test(href)) return false; // pagination
  if (!/(news|blog)/i.test(href)) return false;
  let u: URL;
  try {
    u = new URL(href, base.endsWith("/") ? base : `${base}/`);
  } catch {
    return false;
  }
  if (/[?&](id|news|post|slug)=/i.test(u.search)) return true; // ?id=54 style detail
  const segs = u.pathname.split("/").filter(Boolean);
  // ".../news" or ".../blog" with nothing after it is the listing page.
  if (segs.length === 0 || (segs.length === 1 && /^(news|blog)$/i.test(segs[0]))) return false;
  return /(news|blog)/i.test(u.pathname);
}

/**
 * When the on-page headline is visibly truncated ("… to Be C…"), the full
 * title often sits in the card image's alt text. Recover it ONLY when the
 * alt text extends the truncated prefix — never invent.
 */
function recoverTruncatedTitle(html: string, card: { start: number; end: number }, truncated: string): string {
  const TRUNC = /(?:…|\.\.\.|\u2026)\s*$/;
  if (!TRUNC.test(truncated)) return truncated;
  const prefix = truncated.replace(TRUNC, "").trim();
  if (prefix.length < 12) return truncated;
  // The headline image (with the full title as its alt) usually sits in a
  // sibling div just before the text card — search a window that includes it.
  const region = html.slice(Math.max(0, card.start - 1_200), card.end);
  for (const m of region.matchAll(/<img\b[^>]*\balt\s*=\s*["]([^"]{12,})"/gi)) {
    const alt = stripTags(m[1]);
    if (alt.length > prefix.length && alt.slice(0, Math.min(prefix.length, 24)).toLowerCase() === prefix.slice(0, Math.min(prefix.length, 24)).toLowerCase()) {
      return alt;
    }
  }
  return truncated;
}

export function parseInsaNewsHtml(html: string, base: string, maxEntries = 20): InsaNewsItem[] {
  const groups = new Map<string, AnchorHit[]>();
  for (const hit of anchorsWith(html, (href) => isNewsDetail(href, base))) {
    const url = absolutize(hit.href, base);
    if (!groups.has(url)) groups.set(url, []);
    groups.get(url)!.push(hit);
  }
  const out: InsaNewsItem[] = [];
  for (const [url, hits] of groups) {
    // The headline anchor carries the longest non-generic text; the date
    // anchor ("/blog/x … 05 Nov, 2026") carries a pure date.
    const texts = hits.map((h) => h.text);
    const headline = texts
      .filter((txt) => txt.length >= 12 && !GENERIC.test(txt) && parseDate(txt) === null)
      .sort((a, b) => b.length - a.length)[0];
    let title = headline;
    if (!title) title = headingBefore(html, hits[0].start) ?? "";
    // Bare "Read More" with no heading nearby, or navigation labels — skip;
    // never fabricate a headline for a link that does not carry one.
    if (!title || title.length < 12 || GENERIC.test(title)) continue;
    const primary = hits[0];
    const card = cardBounds(html, primary.start);
    const cardText = html.slice(card.start, card.end);
    title = recoverTruncatedTitle(html, card, title);
    out.push({
      id: `insa-${shortHash(url)}`,
      titleEn: title.slice(0, 240),
      url,
      date: parseDate(cardText),
      summaryEn: summaryIn(html, primary.start, card.end),
    });
    if (out.length >= maxEntries) break;
  }
  return out;
}

// ── Ethio-CERT public JSON API client ──────────────────────────────────────

const USER_AGENT = "Mozilla/5.0 (compatible; AdwaCyberIntel/1.0; national CERT situational awareness)";

export class EthioWebError extends Error {
  readonly url: string;
  readonly code: "ETHIO_WEB_OFF" | "ETHIO_WEB_UNREACHABLE" | "ETHIO_WEB_BAD_STATUS" | "ETHIO_WEB_EMPTY";
  constructor(code: EthioWebError["code"], message: string, url: string) {
    super(message);
    this.name = "EthioWebError";
    this.code = code;
    this.url = url;
  }
}

/** 60-second in-process cache — a dashboard load should not hammer a national API. */
const apiCache = new Map<string, { at: number; body: unknown }>();
const API_CACHE_TTL_MS = 60_000;

interface DrfList {
  count?: number;
  results?: unknown[];
  message?: string;
}

async function apiGet(path: string): Promise<unknown> {
  const c = ethioWebConfig();
  const url = `${c.apiBase}${path}`;
  if (c.disabled) throw new EthioWebError("ETHIO_WEB_OFF", "Live Ethio web adapter disabled (ETHIO_WEB_OFF).", url);
  const cached = apiCache.get(url);
  if (cached && Date.now() - cached.at < API_CACHE_TTL_MS) return cached.body;
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": USER_AGENT },
      redirect: "follow",
      cache: "no-store",
      signal: AbortSignal.timeout(c.timeoutMs),
    });
  } catch (err) {
    const timedOut = err instanceof Error && err.name === "TimeoutError";
    throw new EthioWebError(
      "ETHIO_WEB_UNREACHABLE",
      timedOut ? `${url} timed out after ${c.timeoutMs} ms.` : `${url} unreachable: ${(err as Error).message}`,
      url
    );
  }
  if (!res.ok) throw new EthioWebError("ETHIO_WEB_BAD_STATUS", `${url} returned HTTP ${res.status}.`, url);
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    throw new EthioWebError("ETHIO_WEB_EMPTY", `${url} returned a non-JSON body.`, url);
  }
  apiCache.set(url, { at: Date.now(), body });
  return body;
}

async function fetchPage(url: string): Promise<string> {
  const c = ethioWebConfig();
  if (c.disabled) throw new EthioWebError("ETHIO_WEB_OFF", "Live Ethio web adapter disabled (ETHIO_WEB_OFF).", url);
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { Accept: "text/html,application/xhtml+xml", "User-Agent": USER_AGENT },
      redirect: "follow",
      cache: "no-store",
      signal: AbortSignal.timeout(c.timeoutMs),
    });
  } catch (err) {
    const timedOut = err instanceof Error && err.name === "TimeoutError";
    throw new EthioWebError(
      "ETHIO_WEB_UNREACHABLE",
      timedOut ? `${url} timed out after ${c.timeoutMs} ms.` : `${url} unreachable: ${(err as Error).message}`,
      url
    );
  }
  if (!res.ok) throw new EthioWebError("ETHIO_WEB_BAD_STATUS", `${url} returned HTTP ${res.status}.`, url);
  const html = await res.text();
  if (!html || html.length < 200) throw new EthioWebError("ETHIO_WEB_EMPTY", `${url} returned an empty document.`, url);
  return html;
}

// — mappers from the API's row shapes to the platform contracts —

function normalizeSeverity(raw: unknown): Severity | null {
  const s = String(raw ?? "").toLowerCase();
  return s === "critical" || s === "high" || s === "medium" || s === "low" ? (s as Severity) : null;
}

function isoDay(raw: unknown): string | null {
  const s = String(raw ?? "");
  const m = s.match(/\b(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

function htmlExcerpt(html: unknown, max = 240): string | undefined {
  const text = stripTags(String(html ?? ""));
  if (text.length < 24) return undefined;
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

function asDrfList(body: unknown, url: string): DrfList {
  if (Array.isArray(body)) return { results: body, count: body.length };
  if (typeof body === "object" && body !== null) return body as DrfList;
  throw new EthioWebError("ETHIO_WEB_EMPTY", `${url} returned an unexpected body.`, url);
}

export function mapAdvisoryRow(row: Record<string, unknown>, siteUrl: string, am?: Record<string, unknown>): WebAdvisory | null {
  const title = String(row.title ?? "").trim();
  if (!title) return null;
  return {
    id: `ec-${String(row.id ?? shortHash(title))}`,
    titleEn: title.slice(0, 240),
    titleAm: am?.title && String(am.title).trim() && String(am.title) !== title ? String(am.title).slice(0, 240) : undefined,
    url: `${siteUrl}/advisories`,
    date: isoDay(row.created_at ?? row.updated_at ?? row.date),
    severity: normalizeSeverity(row.severity),
    summaryEn: htmlExcerpt(row.description),
  };
}

export function mapAlertRow(row: Record<string, unknown>, siteUrl: string, am?: Record<string, unknown>): EthioAlert | null {
  const title = String(row.title ?? "").trim();
  if (!title) return null;
  return {
    id: `alert-${String(row.id ?? shortHash(title))}`,
    titleEn: title.slice(0, 240),
    titleAm: am?.title && String(am.title).trim() && String(am.title) !== title ? String(am.title).slice(0, 240) : undefined,
    url: `${siteUrl}/alerts`,
    date: isoDay(row.created_at ?? row.updated_at),
    severity: normalizeSeverity(row.severity),
    summaryEn: htmlExcerpt(row.description),
  };
}

export function mapNewsRow(row: Record<string, unknown>, siteUrl: string, am?: Record<string, unknown>): EthioNewsItem | null {
  const title = String(row.title ?? "").trim();
  if (!title) return null;
  return {
    id: `news-${String(row.id ?? shortHash(title))}`,
    titleEn: title.slice(0, 240),
    titleAm: am?.title && String(am.title).trim() && String(am.title) !== title ? String(am.title).slice(0, 240) : undefined,
    url: `${siteUrl}/news`,
    date: isoDay(row.created_at ?? row.updated_at),
    summaryEn: htmlExcerpt(row.description),
  };
}

export function mapRegulationRow(row: Record<string, unknown>, am?: Record<string, unknown>): EthioRegulation | null {
  const title = String(row.title ?? "").trim();
  if (!title) return null;
  const year = Number(row.year);
  return {
    id: `reg-${String(row.id ?? shortHash(title))}`,
    titleEn: title.slice(0, 240),
    titleAm: am?.title && String(am.title).trim() && String(am.title) !== title ? String(am.title).slice(0, 240) : undefined,
    year: Number.isFinite(year) && year > 1900 ? year : null,
    url: String(row.file_url ?? "").trim() || "https://www.ethiocert.gov.et/regulations",
    type: typeof row.regulation_type === "object" && row.regulation_type !== null
      ? String((row.regulation_type as Record<string, unknown>).name ?? "") || null
      : null,
  };
}

export function mapGci(body: unknown, siteUrl: string): EthioGci | null {
  const latest = (body as Record<string, unknown>)?.latest as Record<string, unknown> | undefined;
  const timelineRaw = (body as Record<string, unknown>)?.timeline as { year?: unknown; values?: Record<string, number> }[] | undefined;
  if (!latest || typeof latest.year !== "number" || typeof latest.values !== "object") return null;
  const pillars = latest.values as Record<string, number>;
  const timeline = Array.isArray(timelineRaw)
    ? timelineRaw
        .filter((t) => typeof t.year === "number" && t.values && typeof t.values === "object")
        .map((t) => ({
          year: t.year as number,
          pillars: {
            legal: Number(t.values?.legal ?? 0),
            technical: Number(t.values?.technical ?? 0),
            organizational: Number(t.values?.organizational ?? 0),
            capacity: Number(t.values?.capacity ?? 0),
            cooperation: Number(t.values?.cooperation ?? 0),
          },
        }))
    : [];
  return {
    year: latest.year,
    pillars: {
      legal: Number(pillars.legal ?? 0),
      technical: Number(pillars.technical ?? 0),
      organizational: Number(pillars.organizational ?? 0),
      capacity: Number(pillars.capacity ?? 0),
      cooperation: Number(pillars.cooperation ?? 0),
    },
    timeline,
    sourceUrl: `${siteUrl}/api/gci/latest`,
  };
}

// — bilingual fetch helpers: en + am requests, merged per row id —

async function fetchBilingualRows(path: string): Promise<{
  en: Record<string, unknown>[];
  am: Map<string, Record<string, unknown>>;
  message: string | undefined;
}> {
  const [enBody, amBody] = await Promise.all([
    apiGet(`${path}?lang=en`),
    apiGet(`${path}?lang=am`).catch(() => null),
  ]);
  const en = asDrfList(enBody, `${ethioWebConfig().apiBase}${path}?lang=en`);
  const rows = Array.isArray(en.results) ? (en.results as Record<string, unknown>[]) : [];
  const amRows = new Map<string, Record<string, unknown>>();
  if (amBody) {
    const am = asDrfList(amBody, `${ethioWebConfig().apiBase}${path}?lang=am`);
    for (const r of Array.isArray(am.results) ? (am.results as Record<string, unknown>[]) : []) {
      if (r && r.id !== undefined) amRows.set(String(r.id), r);
    }
  }
  return { en: rows, am: amRows, message: en.message ? String(en.message) : undefined };
}

// ── live fetchers (public layer) ────────────────────────────────────────────

const now = () => new Date().toISOString();

export async function fetchEthioCertAdvisories(): Promise<EthioWebFeed<WebAdvisory>> {
  const c = ethioWebConfig();
  const { en, am, message } = await fetchBilingualRows("/advisories/");
  const site = c.siteUrl;
  const entries = en
    .map((row) => mapAdvisoryRow(row, site, am.get(String(row.id))))
    .filter((e): e is WebAdvisory => e !== null);
  return {
    mode: "live",
    url: `${c.apiBase}/advisories/`,
    asOf: now(),
    entries,
    note: entries.length === 0 ? message ?? "Advisories section currently lists no published advisories." : undefined,
  };
}

export async function fetchEthioCertAlerts(): Promise<EthioWebFeed<EthioAlert>> {
  const c = ethioWebConfig();
  const { en, am } = await fetchBilingualRows("/alerts/");
  const site = c.siteUrl;
  const entries = en
    .map((row) => mapAlertRow(row, site, am.get(String(row.id))))
    .filter((e): e is EthioAlert => e !== null);
  return { mode: "live", url: `${c.apiBase}/alerts/`, asOf: now(), entries };
}

export async function fetchEthioCertNews(): Promise<EthioWebFeed<EthioNewsItem>> {
  const c = ethioWebConfig();
  const { en, am } = await fetchBilingualRows("/news/");
  const site = c.siteUrl;
  const entries = en
    .map((row) => mapNewsRow(row, site, am.get(String(row.id))))
    .filter((e): e is EthioNewsItem => e !== null);
  return { mode: "live", url: `${c.apiBase}/news/`, asOf: now(), entries };
}

export async function fetchEthioCertRegulations(): Promise<EthioWebFeed<EthioRegulation>> {
  const c = ethioWebConfig();
  const { en, am } = await fetchBilingualRows("/regulations/");
  const entries = en
    .map((row) => mapRegulationRow(row, am.get(String(row.id))))
    .filter((e): e is EthioRegulation => e !== null);
  return { mode: "live", url: `${c.apiBase}/regulations/`, asOf: now(), entries };
}

export async function fetchEthioCertGci(): Promise<EthioGci & { mode: EthioWebMode; asOf: string }> {
  const c = ethioWebConfig();
  const body = await apiGet("/gci/timeline"); // timeline carries the full history
  const gci = mapGci({ latest: (await apiGet("/gci/latest")) as Record<string, unknown>, ...((body as Record<string, unknown>) ?? {}) }, c.siteUrl);
  if (!gci) throw new EthioWebError("ETHIO_WEB_EMPTY", "GCI payload missing latest pillar values.", `${c.apiBase}/gci/latest`);
  return { ...gci, mode: "live", asOf: now() };
}

export async function fetchInsaNews(): Promise<EthioWebFeed<InsaNewsItem>> {
  const c = ethioWebConfig();
  const html = await fetchPage(c.insaNewsUrl);
  const entries = parseInsaNewsHtml(html, c.insaNewsUrl);
  return {
    mode: "live",
    url: c.insaNewsUrl,
    asOf: now(),
    entries,
    note: entries.length === 0 ? "No news headlines detected on the INSA home page." : undefined,
  };
}

// ── bundled real-site snapshots (captured 2026-11-19; see scripts/fetch-ethio-snapshot.ts) ──

interface ApiSnapshotFile {
  sourceUrl: string;
  capturedAt: string;
  note?: string;
  advisories: { entries: WebAdvisory[]; note?: string };
  alerts: { entries: EthioAlert[] };
  news: { entries: EthioNewsItem[] };
  regulations: { entries: EthioRegulation[] };
  gci: EthioGci & { asOf: string };
}

const apiSnapshot = ethiocertApiSnapshotJson as unknown as ApiSnapshotFile;
const insaSnapshot = insaNewsSnapshotJson as unknown as {
  sourceUrl: string;
  capturedAt: string;
  note?: string;
  entries: InsaNewsItem[];
};

export function advisorySnapshot(): EthioWebFeed<WebAdvisory> {
  return {
    mode: "snapshot",
    url: `${apiSnapshot.sourceUrl}/advisories/`,
    asOf: apiSnapshot.capturedAt,
    entries: apiSnapshot.advisories.entries,
    note: apiSnapshot.advisories.note,
  };
}

export function alertSnapshot(): EthioWebFeed<EthioAlert> {
  return { mode: "snapshot", url: `${apiSnapshot.sourceUrl}/alerts/`, asOf: apiSnapshot.capturedAt, entries: apiSnapshot.alerts.entries };
}

export function newsSnapshot(): EthioWebFeed<EthioNewsItem> {
  return { mode: "snapshot", url: `${apiSnapshot.sourceUrl}/news/`, asOf: apiSnapshot.capturedAt, entries: apiSnapshot.news.entries };
}

export function regulationSnapshot(): EthioWebFeed<EthioRegulation> {
  return { mode: "snapshot", url: `${apiSnapshot.sourceUrl}/regulations/`, asOf: apiSnapshot.capturedAt, entries: apiSnapshot.regulations.entries };
}

export function gciSnapshot(): EthioGci & { mode: EthioWebMode; asOf: string } {
  return { ...apiSnapshot.gci, mode: "snapshot", asOf: apiSnapshot.capturedAt };
}

export function insaNewsSnapshotFeed(): EthioWebFeed<InsaNewsItem> {
  return { mode: "snapshot", url: insaSnapshot.sourceUrl, asOf: insaSnapshot.capturedAt, entries: insaSnapshot.entries, note: insaSnapshot.note };
}

// ── live → labelled-snapshot accessors ──────────────────────────────────────

async function withSnapshot<T>(live: () => Promise<EthioWebFeed<T>>, snap: EthioWebFeed<T>): Promise<EthioWebFeed<T>> {
  try {
    return await live();
  } catch (err) {
    return { ...snap, degradedReason: err instanceof Error ? err.message : "live fetch failed" };
  }
}

/** Live first; the real captured snapshot on failure — never silent, never invented. */
export function getEthioCertAdvisories(): Promise<EthioWebFeed<WebAdvisory>> {
  return withSnapshot(fetchEthioCertAdvisories, advisorySnapshot());
}

/** Live first; the real captured snapshot on failure — never silent, never invented. */
export function getEthioCertAlerts(): Promise<EthioWebFeed<EthioAlert>> {
  return withSnapshot(fetchEthioCertAlerts, alertSnapshot());
}

/** Live first; the real captured snapshot on failure — never silent, never invented. */
export function getEthioCertNews(): Promise<EthioWebFeed<EthioNewsItem>> {
  return withSnapshot(fetchEthioCertNews, newsSnapshot());
}

/** Live first; the real captured snapshot on failure — never silent, never invented. */
export function getEthioCertRegulations(): Promise<EthioWebFeed<EthioRegulation>> {
  return withSnapshot(fetchEthioCertRegulations, regulationSnapshot());
}

/** Live first; the real captured snapshot on failure — never silent, never invented. */
export async function getEthioCertGci(): Promise<EthioGci & { mode: EthioWebMode; asOf: string; degradedReason?: string }> {
  try {
    return await fetchEthioCertGci();
  } catch (err) {
    return { ...gciSnapshot(), degradedReason: err instanceof Error ? err.message : "live fetch failed" };
  }
}

/** Live first; the real captured snapshot on failure — never silent, never invented. */
export function getInsaNews(): Promise<EthioWebFeed<InsaNewsItem>> {
  return withSnapshot(fetchInsaNews, insaNewsSnapshotFeed());
}

/** Aggregate mode for UI badges: live only if every live source answered. */
export function aggregateEthioMode(feeds: { mode: EthioWebMode }[]): EthioWebMode {
  return feeds.every((f) => f.mode === "live") ? "live" : "snapshot";
}
