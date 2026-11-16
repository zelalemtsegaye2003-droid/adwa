/**
 * Adwa Cyber — VAPT Center engine (NBE/NCB/S/02/2026/27 LOT4).
 *
 * Pure decision logic, deterministic and regulator-auditable like the other
 * Adwa engines (src/lib/engine.ts design stance):
 *
 *  1. Prioritisation — "Adwa dynamic risk score" 0..100 combining
 *     CVSS v3.1 base score (technical severity), EPSS (probability of
 *     exploitation in the wild), the CISA KEV catalog (observed active
 *     exploitation) and the bank's business context (asset criticality,
 *     internet-facing surface, production environment) — exactly the
 *     "context-aware scoring" the tender's §Risk Prioritization demands.
 *  2. Remediation SLA — mirrors the platform's corrective-action policy
 *     (critical 30d / high 60d / medium 90d — Procl. 1426/2026 practice;
 *     VAPT adds low 180d so every finding is deadline-tracked).
 *  3. Simulation — deterministic per-asset catalogue selection for the
 *     infrastructure half of the hybrid engine (seeded RNG — reproducible).
 *  4. DAST — REAL non-destructive HTTP checks against web/API targets
 *     (headers, cookies, TLS posture, robots disclosure). OWASP Top 10
 *     aligned (A05 security misconfiguration, A07 identification/auth
 *     failures) with request throttling — never a destructive probe.
 */
import type { CatalogueEntry, VaptAssetKind, VaptCategory } from "./vapt-data";
import { VAPT_CATALOGUE } from "./vapt-data";
import { slaDaysFor } from "./sla";
import http from "http";
import https from "https";
import type { IncomingMessage } from "http";
import type { TLSSocket } from "tls";

// ── Severity bands (CVSS v3.1 specification) ────────────────────────────────

export function severityFromCvss(score: number): "critical" | "high" | "medium" | "low" {
  if (score >= 9.0) return "critical";
  if (score >= 7.0) return "high";
  if (score >= 4.0) return "medium";
  return "low";
}

// ── Remediation SLA (corrective-action timelines) ────────────────────────────

export const VAPT_SLA_DAYS: Record<string, number> = {
  critical: slaDaysFor("critical"), // 30
  high: slaDaysFor("high"), // 60
  medium: slaDaysFor("medium"), // 90
  low: 180, // one release cycle for informational findings
};

export function vaptSlaDays(severity: string): number {
  return VAPT_SLA_DAYS[severity] ?? VAPT_SLA_DAYS.low;
}

/** Deadline for a detected vulnerability of the given severity. */
export function vaptSlaDueDate(severity: string, from: Date, now = new Date()): Date {
  const base = from.getTime() <= now.getTime() ? from : now;
  return new Date(base.getTime() + vaptSlaDays(severity) * 86_400_000);
}

// ── Prioritisation (Adwa dynamic risk score) ─────────────────────────────────

export interface PriorityInput {
  cvssScore: number;
  epss: number; // 0..1
  kev: boolean;
  assetCriticality: string; // critical | high | medium | low
  assetSurface: string; // INTERNAL | EXTERNAL
  assetEnvironment: string; // PROD | DMZ | UAT | DEV | EXTERNAL
}

export interface PriorityOutcome {
  score: number; // 0..100
  priorityClass: "P1" | "P2" | "P3" | "P4";
}

const CRITICALITY_W: Record<string, number> = { critical: 8, high: 5, medium: 2, low: 0 };

/**
 * Context-aware dynamic risk score (0..100):
 *   CVSS technical severity  → up to 45 pts
 *   EPSS exploit probability → up to 25 pts
 *   CISA KEV active exploit  → +15 pts
 *   Business context         → up to +15 pts (criticality, surface, PROD)
 */
export function prioritise(v: PriorityInput): PriorityOutcome {
  const cvssTerm = (Math.max(0, Math.min(10, v.cvssScore)) / 10) * 45;
  const epssTerm = Math.max(0, Math.min(1, v.epss)) * 25;
  const kevTerm = v.kev ? 15 : 0;
  const ctxTerm =
    (CRITICALITY_W[v.assetCriticality] ?? 0) +
    (v.assetSurface === "EXTERNAL" ? 5 : 0) +
    (v.assetEnvironment === "PROD" || v.assetEnvironment === "DMZ" ? 2 : 0);
  const score = Math.max(0, Math.min(100, Math.round((cvssTerm + epssTerm + kevTerm + ctxTerm) * 10) / 10));
  const priorityClass = score >= 80 ? "P1" : score >= 60 ? "P2" : score >= 40 ? "P3" : "P4";
  return { score, priorityClass };
}

// ── Summary helpers ──────────────────────────────────────────────────────────

export interface VulnLike {
  severity: string;
  status: string;
  kev: boolean;
  priorityScore: number;
  cvssScore: number;
  epss: number;
  dueAt?: string | Date | null;
  remediatedAt?: string | Date | null;
}

export interface VaptSummary {
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  kev: number;
  open: number;
  inProgress: number;
  remediated: number;
  accepted: number;
  overdue: number;
  dueSoon: number;
  avgPriority: number | null;
  topPriority: number;
  /** Exposure score 0..100 — mean of open/accepted P-scores, weighted floor. */
  exposureScore: number;
}

export function summariseVulns(vulns: VulnLike[], now = new Date()): VaptSummary {
  const s: VaptSummary = {
    total: vulns.length, critical: 0, high: 0, medium: 0, low: 0, kev: 0,
    open: 0, inProgress: 0, remediated: 0, accepted: 0, overdue: 0, dueSoon: 0,
    avgPriority: null, topPriority: 0, exposureScore: 0,
  };
  const openish: VulnLike[] = [];
  const prios: number[] = [];
  for (const v of vulns) {
    if (v.severity === "critical") s.critical++;
    else if (v.severity === "high") s.high++;
    else if (v.severity === "medium") s.medium++;
    else s.low++;
    if (v.kev) s.kev++;
    if (v.status === "open") { s.open++; openish.push(v); }
    else if (v.status === "in_progress") { s.inProgress++; openish.push(v); }
    else if (v.status === "remediated") s.remediated++;
    else if (v.status === "accepted") s.accepted++;
    prios.push(v.priorityScore);
    if (v.priorityScore > s.topPriority) s.topPriority = v.priorityScore;
    if (v.dueAt && (v.status === "open" || v.status === "in_progress")) {
      const days = (new Date(v.dueAt).getTime() - now.getTime()) / 86_400_000;
      if (days < 0) s.overdue++;
      else if (days <= 7) s.dueSoon++;
    }
  }
  if (prios.length) s.avgPriority = Math.round((prios.reduce((a, b) => a + b, 0) / prios.length) * 10) / 10;
  if (openish.length) {
    const sum = openish.reduce((a, v) => a + v.priorityScore, 0);
    const remediatedWeight = vulns.length ? 1 - s.remediated / vulns.length : 1;
    s.exposureScore = Math.round(Math.min(100, (sum / openish.length) * remediatedWeight) * 10) / 10;
  }
  return s;
}

// ── Deterministic simulation (seeded RNG — reproducible audits) ─────────────

function hashString(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface SimAssetLike {
  id: string;
  kind: string;
  osOrPlatform?: string | null;
  criticality: string;
  surface: string;
  environment: string;
}

export interface VulnDraft {
  cveId: string | null;
  title: string;
  titleAm?: string;
  description: string;
  remediation: string;
  category: VaptCategory;
  cvssScore: number;
  cvssVector: string | null;
  epss: number;
  kev: boolean;
  evidence: Record<string, unknown>;
  detectedAt: Date;
}

/**
 * Deterministic infrastructure assessment for one asset — the simulated half
 * of the hybrid engine. Labelled `engineMode: simulated` in the scan record.
 */
export function buildSimulatedFindings(asset: SimAssetLike, salt = 0): VulnDraft[] {
  const rng = mulberry32(hashString(asset.id) + salt * 7919);
  const applicable = VAPT_CATALOGUE.filter((e) => e.appliesTo.includes(asset.kind as VaptAssetKind));
  // Density scales with asset risk context: critical/external assets carry
  // a wider observed gap (3–6 findings), internal mid/low ones fewer (1–3).
  const heavy = asset.criticality === "critical" || asset.criticality === "high" || asset.surface === "EXTERNAL";
  const count = heavy ? 3 + Math.floor(rng() * 4) : 1 + Math.floor(rng() * 3);
  const picked: CatalogueEntry[] = [];
  const pool = [...applicable];
  for (let i = 0; i < count && pool.length; i++) {
    const idx = Math.floor(rng() * pool.length);
    picked.push(pool.splice(idx, 1)[0]);
  }
  const detectedAt = new Date(Date.now() - Math.floor(rng() * 30 + 1) * 3_600_000);
  return picked.map((e) => ({
    cveId: e.cveId,
    title: e.title,
    titleAm: e.titleAm,
    description: e.description,
    remediation: e.remediation,
    category: e.category,
    cvssScore: e.cvssScore,
    cvssVector: e.cvssVector ?? null,
    epss: e.epss,
    kev: e.kev,
    evidence: {
      mode: "simulated",
      basis: "Bundled NVD/CISA reference catalogue (decision D3 — honestly labelled)",
      osOrPlatform: asset.osOrPlatform ?? null,
      matchedOn: e.appliesTo.join(", "),
    },
    detectedAt,
  }));
}

// ── DAST — REAL non-destructive HTTP checks ─────────────────────────────────

export interface DastCheck {
  id: string;
  name: string;
  owasp: string | null; // e.g. "A05:2021 — Security Misconfiguration"
  result: "pass" | "fail" | "info";
  detail: string;
}

export interface DastReport {
  target: string;
  reachable: boolean;
  httpStatus: number | null;
  protocol: string | null;
  certDaysRemaining: number | null;
  checks: DastCheck[];
  cookies: { name: string; httpOnly: boolean; secure: boolean; sameSite: string | null }[];
  error?: string;
}

const REQUEST_TIMEOUT_MS = 8_000;
/** Throttle: minimum pause between probes (tender §DAST — prevent resource exhaustion). */
const THROTTLE_MS = 150;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

interface FetchedDoc {
  status: number | null;
  headers: Record<string, string | string[]> | null;
  body: string | null;
  protocol: string | null;
  certDaysRemaining: number | null;
  error: string | null;
}

/** One throttled GET. No destructive payloads, ever. */
async function probeGet(url: string): Promise<FetchedDoc> {
  return new Promise<FetchedDoc>((resolve) => {
    let settled = false;
    const done = (v: FetchedDoc) => { if (!settled) { settled = true; resolve(v); } };
    try {
      const u = new URL(url);
      const lib = u.protocol === "http:" ? http : https;
      // Signature: lib.get(url, options, callback) — passing the URL first is
      // required; { href } inside options is silently ignored by Node core.
      const req = lib.get(
        u.href,
        { timeout: REQUEST_TIMEOUT_MS, rejectUnauthorized: false, headers: { "user-agent": "AdwaVAPT-DAST/1.0 (non-destructive audit)" } },
        (res: IncomingMessage) => {
          const chunks: Buffer[] = [];
          const socket = res.socket as TLSSocket | undefined;
          let certDays: number | null = null;
          try {
            if (socket && typeof socket.getPeerCertificate === "function") {
              const cert = socket.getPeerCertificate();
              if (cert && typeof (cert as { valid_to?: string }).valid_to === "string") {
                certDays = Math.round((new Date((cert as { valid_to: string }).valid_to).getTime() - Date.now()) / 86_400_000);
              }
            }
          } catch { /* self-signed / no cert */ }
          res.on("data", (c: Buffer) => { if (chunks.reduce((a, b) => a + b.length, 0) < 262_144) chunks.push(c); });
          res.on("end", () => done({
            status: res.statusCode ?? null,
            headers: res.headers as Record<string, string | string[]>,
            body: Buffer.concat(chunks).toString("utf8"),
            protocol: socket && typeof socket.getProtocol === "function" ? socket.getProtocol() : null,
            certDaysRemaining: certDays,
            error: null,
          }));
          res.on("error", () => done({ status: null, headers: null, body: null, protocol: null, certDaysRemaining: null, error: "response error" }));
        }
      );
      req.on("timeout", () => { req.destroy(); done({ status: null, headers: null, body: null, protocol: null, certDaysRemaining: null, error: "timeout" }); });
      req.on("error", (e: Error) => done({ status: null, headers: null, body: null, protocol: null, certDaysRemaining: null, error: e.message }));
    } catch (e) {
      done({ status: null, headers: null, body: null, protocol: null, certDaysRemaining: null, error: e instanceof Error ? e.message : "invalid url" });
    }
  });
}

const SENSITIVE_ROBOTS_HINTS = ["admin", "backup", "config", "internal", "jenkins", "cpanel", "phpmyadmin", ".env", "dump", "staging"];

/**
 * Run the REAL DAST battery against one web/API target.
 * Every probe is a plain GET — safe for production banking systems by design.
 */
export async function runDastScan(targetUrl: string): Promise<DastReport> {
  const report: DastReport = {
    target: targetUrl, reachable: false, httpStatus: null, protocol: null,
    certDaysRemaining: null, checks: [], cookies: [],
  };
  let url: URL;
  try {
    url = new URL(targetUrl);
    if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("bad protocol");
  } catch {
    report.error = "Invalid URL (http/https only)";
    return report;
  }

  const root = await probeGet(url.href);
  if (root.error) { report.error = root.error; return report; }
  report.reachable = true;
  report.httpStatus = root.status;
  report.protocol = root.protocol;
  report.certDaysRemaining = root.certDaysRemaining;
  const h = (root.headers ?? {}) as Record<string, string | string[]>;
  const lower = (k: string) => Object.keys(h).find((x) => x.toLowerCase() === k);
  const has = (k: string) => lower(k) !== undefined;
  // Node header values arrive as string | string[] — normalise before use.
  const val = (k: string) => {
    const key = lower(k);
    if (!key) return "";
    const v = h[key];
    if (Array.isArray(v)) return v.join("; ");
    return typeof v === "string" ? v : "";
  };

  // ── Transport / TLS ───────────────────────────────────────────────────
  if (url.protocol === "https:") {
    if (root.protocol && /^TLSv?1(\.0|\.1)?$/i.test(root.protocol)) {
      report.checks.push({ id: "tls-version", name: "TLS protocol version", owasp: "A02:2021 — Cryptographic Failures", result: "fail", detail: `Server negotiated deprecated ${root.protocol}` });
    } else if (root.protocol) {
      report.checks.push({ id: "tls-version", name: "TLS protocol version", owasp: null, result: "pass", detail: `Negotiated ${root.protocol}` });
    }
    if (root.certDaysRemaining !== null && root.certDaysRemaining <= 30) {
      report.checks.push({ id: "cert-expiry", name: "Certificate lifetime", owasp: "A02:2021 — Cryptographic Failures", result: root.certDaysRemaining <= 0 ? "fail" : "info", detail: `Certificate expires in ${root.certDaysRemaining} day(s)` });
    }
    if (!has("strict-transport-security")) {
      report.checks.push({ id: "hsts", name: "HTTP Strict Transport Security", owasp: "A05:2021 — Security Misconfiguration", result: "fail", detail: "No Strict-Transport-Security header on the HTTPS response" });
    } else {
      report.checks.push({ id: "hsts", name: "HTTP Strict Transport Security", owasp: null, result: "pass", detail: val("strict-transport-security") });
    }
  } else {
    report.checks.push({ id: "no-tls", name: "Transport encryption", owasp: "A02:2021 — Cryptographic Failures", result: "fail", detail: "Target served over plaintext HTTP" });
  }

  // ── A05 security-misconfiguration header battery ───────────────────────
  if (!has("content-security-policy")) {
    report.checks.push({ id: "csp", name: "Content-Security-Policy", owasp: "A05:2021 — Security Misconfiguration", result: "fail", detail: "No Content-Security-Policy header — client-side injection surface unconstrained" });
  } else {
    report.checks.push({ id: "csp", name: "Content-Security-Policy", owasp: null, result: "pass", detail: val("content-security-policy").slice(0, 120) });
  }
  const framed = has("x-frame-options") || /frame-ancestors/i.test(val("content-security-policy"));
  report.checks.push({ id: "framing", name: "Clickjacking protection (frame policy)", owasp: "A05:2021 — Security Misconfiguration", result: framed ? "pass" : "fail", detail: framed ? "Frame policy present" : "Neither X-Frame-Options nor CSP frame-ancestors set" });
  if (!/nosniff/i.test(val("x-content-type-options"))) {
    report.checks.push({ id: "nosniff", name: "X-Content-Type-Options", owasp: "A05:2021 — Security Misconfiguration", result: "fail", detail: "Missing nosniff — MIME-type sniffing attacks possible" });
  } else {
    report.checks.push({ id: "nosniff", name: "X-Content-Type-Options", owasp: null, result: "pass", detail: "nosniff set" });
  }
  report.checks.push({ id: "referrer", name: "Referrer-Policy", owasp: null, result: has("referrer-policy") ? "pass" : "info", detail: has("referrer-policy") ? val("referrer-policy") : "No Referrer-Policy header (hardening opportunity)" });

  // ── Version disclosure (attack-surface recon reduction) ────────────────
  const serverHeader = val("server");
  const powered = val("x-powered-by");
  if ((serverHeader && /[0-9]/.test(serverHeader)) || powered) {
    report.checks.push({ id: "version-disclosure", name: "Server version disclosure", owasp: "A05:2021 — Security Misconfiguration", result: "fail", detail: `Disclosed: ${[serverHeader, powered].filter(Boolean).join(" · ")}` });
  } else {
    report.checks.push({ id: "version-disclosure", name: "Server version disclosure", owasp: null, result: "pass", detail: "No version-bearing headers disclosed" });
  }

  // ── Cookie flags (A07 identification & authentication failures) ────────
  const cookieHeaders = Object.keys(h)
    .filter((k) => k.toLowerCase() === "set-cookie")
    .flatMap((k) => {
      const v = h[k];
      if (Array.isArray(v)) return v;
      return typeof v === "string" ? [v] : [];
    });
  for (const c of cookieHeaders) {
    const name = c.split("=")[0]?.trim();
    if (!name) continue;
    report.cookies.push({
      name,
      httpOnly: /httponly/i.test(c),
      secure: /secure/i.test(c),
      sameSite: (/samesite=([^;]+)/i.exec(c)?.[1] ?? null),
    });
  }
  const flaggedCookies = report.cookies.filter((c) => !c.httpOnly || !c.secure || !c.sameSite);
  if (report.cookies.length && flaggedCookies.length) {
    const missing = flaggedCookies.map((c) => `${c.name}: lacks ${[!c.httpOnly && "HttpOnly", !c.secure && "Secure", !c.sameSite && "SameSite"].filter(Boolean).join("/") || "—"} flag`).join("; ");
    report.checks.push({ id: "cookie-flags", name: "Session cookie flags", owasp: "A07:2021 — Identification & Authentication Failures", result: "fail", detail: missing });
  } else if (report.cookies.length) {
    report.checks.push({ id: "cookie-flags", name: "Session cookie flags", owasp: null, result: "pass", detail: `${report.cookies.length} cookie(s) carry HttpOnly/Secure/SameSite` });
  }

  // ── robots.txt disclosure probe (throttled) ────────────────────────────
  await sleep(THROTTLE_MS);
  const robots = await probeGet(new URL("robots.txt", url).href);
  if (robots.body !== null && /^user-agent/i.test(robots.body.slice(0, 200))) {
    const disallows = [...robots.body.matchAll(/disallow:\s*(\S+)/gi)].map((m) => m[1].toLowerCase());
    const leaks = disallows.filter((d) => SENSITIVE_ROBOTS_HINTS.some((hint) => d.includes(hint)));
    if (leaks.length) {
      report.checks.push({ id: "robots-leak", name: "robots.txt sensitive-path disclosure", owasp: "A01:2021 — Broken Access Control", result: "fail", detail: `robots.txt advertises sensitive paths: ${leaks.join(", ")}` });
    } else {
      report.checks.push({ id: "robots-leak", name: "robots.txt sensitive-path disclosure", owasp: null, result: "pass", detail: "robots.txt present, no sensitive paths advertised" });
    }
  }

  if (root.status !== null && root.status >= 500) {
    report.checks.push({ id: "server-error", name: "Availability / error state", owasp: null, result: "info", detail: `Root returned HTTP ${root.status}` });
  }

  return report;
}

// ── DAST report → vulnerability drafts ───────────────────────────────────────

const DAST_CHECK_CVSS: Record<string, number> = {
  "no-tls": 7.5, "tls-version": 5.3, "cert-expiry": 3.7, hsts: 3.7, csp: 5.3,
  framing: 4.3, nosniff: 3.7, "version-disclosure": 2.7, "cookie-flags": 5.3,
  "robots-leak": 3.1,
};

const DAST_CHECK_REMEDIATION: Record<string, string> = {
  "no-tls": "Serve the application over HTTPS only; redirect HTTP to HTTPS and enable HSTS.",
  "tls-version": "Disable TLS 1.0/1.1; require TLS 1.2+ with AEAD cipher suites.",
  "cert-expiry": "Automate certificate renewal (e.g. ACME) and alert 30 days before expiry.",
  hsts: "Add Strict-Transport-Security: max-age=63072000; includeSubDomains on every HTTPS response.",
  csp: "Publish a Content-Security-Policy that constrains script/style/img sources.",
  framing: "Set X-Frame-Options: DENY (or CSP frame-ancestors 'none').",
  nosniff: "Add X-Content-Type-Options: nosniff to all responses.",
  "version-disclosure": "Strip Server/X-Powered-By version details at the edge.",
  "cookie-flags": "Emit cookies with HttpOnly; Secure; SameSite=Lax (or Strict) attributes.",
  "robots-leak": "Do not advertise sensitive paths in robots.txt — restrict them at the authorisation layer instead.",
};

/** Map failed DAST checks to tracked vulnerability drafts (with proof bundle). */
export function dastVulnsFromReport(report: DastReport): VulnDraft[] {
  return report.checks
    .filter((c) => c.result === "fail")
    .map((c) => {
      const cvssScore = DAST_CHECK_CVSS[c.id] ?? 5.3;
      const isTransport = c.id === "no-tls" || c.id === "tls-version" || c.id === "cert-expiry";
      return {
        cveId: null,
        title: `DAST: ${c.name}`,
        description: `${c.detail}. Detected by the Adwa DAST engine against ${report.target} (OWASP ${c.owasp ?? "Top 10 alignment"}).`,
        remediation: DAST_CHECK_REMEDIATION[c.id] ?? "Apply the vendor/OWASP hardening guidance for this finding.",
        category: (isTransport ? "SSL_TLS" : "WEB") as VaptCategory,
        cvssScore,
        cvssVector: null,
        epss: 0.15, // configuration findings — low base exploitation probability
        kev: false,
        evidence: {
          mode: "dast-live",
          target: report.target,
          httpStatus: report.httpStatus,
          protocol: report.protocol,
          check: c,
          cookies: report.cookies,
          note: "Non-destructive GET-based check — safe for production (tender §DAST throttling)",
        },
        detectedAt: new Date(),
      };
    });
}
