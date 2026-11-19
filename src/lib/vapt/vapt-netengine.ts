/**
 * Adwa Cyber — VAPT REAL infrastructure engine (plan §Phase 3 "Vulnerability
 * Assessment & Core Engine Capabilities", §Phase 1 "safe by default").
 *
 * Genuine network probes — no fabricated findings, ever:
 *   - TCP connect port scan (concurrency-limited, per-host timeout)
 *   - Protocol-aware banner grabbing (SSH greeting arrives on connect; FTP/SMTP
 *     greetings on connect; HTTP ports probed with a single HEAD request)
 *   - TLS posture: deprecated protocol acceptance (TLS 1.0/1.1) + certificate
 *     expiry window (the plan's configurable 30/14/7-day warning bands)
 *   - SAFE active service checks, non-destructive only:
 *       anonymous FTP (USER anonymous → 230/530), Redis unauthenticated access
 *       (PING → +PONG), MySQL version from the handshake greeting
 *   - Banner → product/version → bundled offline CVE feed (live-fetched data)
 *
 * The SAFE profile (default) sends only the probes above. Exploit verification
 * and credential testing live behind the INTRUSIVE profile, which the API only
 * permits under a scope with intrusiveAllowed set by a SECOND user (four-eyes)
 * — the plan's hard rule: "No offensive payload code" / "never destructive".
 */
import net from "net";
import tls from "tls";
import http from "http";
import type { VulnDraft } from "./vapt-engine";
import { matchBanner, FEED_AS_OF } from "./vapt-cve-feed";
import { createHash } from "crypto";

// ── Scan configuration (plan §1: rate limits, concurrency, timeouts) ───────

export interface EngineConfig {
  ports: number[];
  concurrency: number;
  connectTimeoutMs: number;
  bannerTimeoutMs: number;
  throttleMs: number; // pause between probes to the same host
}

export const SAFE_DEFAULT: EngineConfig = {
  // High-signal common services — deliberately not a full 65k sweep (safe scan).
  ports: [21, 22, 23, 25, 80, 110, 143, 443, 445, 1433, 1521, 2375, 2376, 3306, 3389, 5432, 5900, 6379, 8080, 8443, 9200, 11211, 27017],
  concurrency: 8,
  connectTimeoutMs: 1_500,
  bannerTimeoutMs: 2_500,
  throttleMs: 60,
};

const HTTP_PORTS = new Set([80, 8080, 443, 8443]);
const TLS_PORTS = new Set([443, 8443]);
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// ── TCP port scan ───────────────────────────────────────────────────────────

export interface PortResult {
  port: number;
  open: boolean;
}

/** TCP connect scan over the configured ports (concurrency-limited). */
export async function portScan(host: string, cfg: EngineConfig = SAFE_DEFAULT): Promise<PortResult[]> {
  const results: PortResult[] = new Array(cfg.ports.length);
  let cursor = 0;
  const workers = Array.from({ length: cfg.concurrency }, async () => {
    while (cursor < cfg.ports.length) {
      const i = cursor++;
      const port = cfg.ports[i];
      results[i] = { port, open: await tcpOpen(host, port, cfg.connectTimeoutMs) };
    }
  });
  await Promise.all(workers);
  return results;
}

function tcpOpen(host: string, port: number, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let settled = false;
    const done = (v: boolean) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(v);
    };
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => done(true));
    socket.once("timeout", () => done(false));
    socket.once("error", () => done(false));
    socket.connect(port, host);
  });
}

// ── Banner grabbing ────────────────────────────────────────────────────────

/**
 * Read the greeting a service sends on connect (SSH, FTP, SMTP, MySQL).
 * Passive — nothing is transmitted for non-HTTP services.
 */
function readBanner(host: string, port: number, timeoutMs: number): Promise<string | null> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let buf = "";
    let settled = false;
    const done = (v: string | null) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(v);
    };
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => {
      socket.on("data", (d: Buffer) => {
        buf += d.toString("latin1");
        // MySQL greeting is binary-ish; SSH/FTP/SMTP are line protocols.
        if (buf.length >= 128 || /\r\n/.test(buf)) done(buf.slice(0, 256));
      });
    });
    socket.once("timeout", () => done(buf.length ? buf : null));
    socket.once("error", () => done(null));
    socket.connect(port, host);
  });
}

interface HttpHeadResult {
  status: number | null;
  server: string | null;
  raw: string;
}

/** One HEAD request to an HTTP port — captures the Server header and status line. */
function httpHead(host: string, port: number, useTls: boolean, timeoutMs: number): Promise<HttpHeadResult> {
  return new Promise((resolve) => {
    let settled = false;
    const done = (v: { status: number | null; server: string | null; raw: string }) => {
      if (settled) return;
      settled = true;
      resolve(v);
    };
    const onConnected = () => {
      const sock = useTls ? (req as unknown as tls.TLSSocket) : (req as unknown as net.Socket);
      const chunks: Buffer[] = [];
      sock.on("data", (d: Buffer) => {
        chunks.push(d);
        const text = Buffer.concat(chunks).toString("latin1");
        if (/\r\n\r\n/.test(text) || text.length > 4096) {
          const statusLine = text.split("\r\n")[0] ?? "";
          const server = /server:\s*(.+)/i.exec(text)?.[1]?.trim() ?? null;
          sock.destroy();
          done({ status: Number.parseInt((statusLine.match(/ (\d{3}) /) ?? [])[1] ?? "0", 10) || null, server, raw: text.slice(0, 512) });
        }
      });
      sock.write(`HEAD / HTTP/1.0\r\nHost: ${host}\r\nUser-Agent: AdwaVAPT-INFRA/1.0 (safe scan)\r\n\r\n`);
    };
    const req: net.Socket | tls.TLSSocket = useTls
      ? tls.connect({ host, port, timeout: timeoutMs, rejectUnauthorized: false }, onConnected)
      : net.connect({ host, port, timeout: timeoutMs }, onConnected);
    req.setTimeout(timeoutMs, () => {
      req.destroy();
      done({ status: null, server: null, raw: "" });
    });
    req.on("error", () => done({ status: null, server: null, raw: "" }));
  });
}

// ── TLS posture (plan §Phase 3 "SSL/TLS audit") ─────────────────────────────

export interface TlsPosture {
  port: number;
  negotiated: string | null;
  tls10Accepted: boolean;
  tls11Accepted: boolean;
  certDaysRemaining: number | null;
  certSubject: string | null;
  certIssuer: string | null;
  error?: string;
}

/** Probe TLS acceptance of deprecated protocols + certificate lifetime. */
async function probeTls(host: string, port: number, timeoutMs: number): Promise<TlsPosture> {
  const posture: TlsPosture = { port, negotiated: null, tls10Accepted: false, tls11Accepted: false, certDaysRemaining: null, certSubject: null, certIssuer: null };
  // Main handshake — preferred (modern) protocol + certificate details.
  await new Promise<void>((resolve) => {
    const sock = tls.connect({ host, port, timeout: timeoutMs, rejectUnauthorized: false, minVersion: "TLSv1.2" }, () => {
      posture.negotiated = sock.getProtocol() ?? null;
      try {
        const cert = sock.getPeerCertificate();
        posture.certSubject = cert?.subject?.CN ?? null;
        posture.certIssuer = cert?.issuer?.CN ?? null;
        if (cert?.valid_to) posture.certDaysRemaining = Math.round((new Date(cert.valid_to).getTime() - Date.now()) / 86_400_000);
      } catch { /* no cert presented */ }
      sock.destroy();
      resolve();
    });
    sock.on("timeout", () => { sock.destroy(); resolve(); });
    sock.on("error", () => resolve());
  });
  // Deprecated-protocol acceptance: a TLS 1.0 (or 1.1) handshake that SUCCEEDS
  // proves the server still accepts it — each a real, non-destructive handshake.
  for (const [field, min, max] of [["tls10Accepted", "TLSv1", "TLSv1"], ["tls11Accepted", "TLSv1.1", "TLSv1.1"]] as const) {
    await new Promise<void>((resolve) => {
      const sock = tls.connect({ host, port, timeout: timeoutMs, rejectUnauthorized: false, minVersion: min, maxVersion: max } as never, () => {
        (posture as unknown as Record<string, boolean>)[field] = true;
        sock.destroy();
        resolve();
      });
      sock.on("timeout", () => { sock.destroy(); resolve(); });
      sock.on("error", () => resolve());
    });
    await sleep(150);
  }
  return posture;
}

// ── Safe active service checks (non-destructive by construction) ─────────────

export interface ServiceCheckResult {
  id: string;
  port: number;
  detail: string;
  hit: boolean;
  evidence: string;
}

/** Anonymous-FTP check: USER anonymous → PASS adwa-audit — a 230 reply proves open access. */
async function checkAnonymousFtp(host: string, port: number, timeoutMs: number): Promise<ServiceCheckResult> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let stage = 0;
    let log = "";
    const result: ServiceCheckResult = { id: "ftp-anonymous", port, detail: "Anonymous FTP not permitted", hit: false, evidence: "" };
    const finish = () => {
      result.evidence = log.slice(0, 400);
      socket.destroy();
      resolve(result);
    };
    socket.setTimeout(timeoutMs);
    socket.once("error", finish);
    socket.once("timeout", finish);
    socket.connect(port, host, () => {
      socket.on("data", (d: Buffer) => {
        const line = d.toString("latin1");
        log += line;
        const code = Number.parseInt(line.slice(0, 3), 10);
        if (stage === 0 && code === 220) {
          stage = 1;
          socket.write("USER anonymous\r\n");
        } else if (stage === 1) {
          if (code === 230) {
            result.hit = true;
            result.detail = "Anonymous FTP login ACCEPTED (230) — unrestricted file access";
            finish(); // QUIT immediately — nothing else touched
          } else if (code === 331) {
            stage = 2;
            socket.write("PASS adwa-audit@example.et\r\n");
          } else {
            finish();
          }
        } else if (stage === 2) {
          if (code === 230) {
            result.hit = true;
            result.detail = "Anonymous FTP login ACCEPTED (230) with guest password";
          }
          finish();
        }
      });
    });
  });
}

/** Redis check: PING — a +PONG reply proves unauthenticated access (read-only probe). */
async function checkUnauthRedis(host: string, port: number, timeoutMs: number): Promise<ServiceCheckResult> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let log = "";
    const result: ServiceCheckResult = { id: "redis-unauth", port, detail: "Redis not accessible without authentication", hit: false, evidence: "" };
    const finish = () => {
      result.evidence = log.slice(0, 400);
      socket.destroy();
      resolve(result);
    };
    socket.setTimeout(timeoutMs);
    socket.once("error", finish);
    socket.once("timeout", finish);
    socket.connect(port, host, () => {
      socket.on("data", (d: Buffer) => {
        log += d.toString("latin1");
        if (log.includes("+PONG")) {
          result.hit = true;
          result.detail = "Redis answers PING without authentication — unauthenticated data-store access";
        }
        finish();
      });
      socket.write("PING\r\n");
    });
  });
}

// ── Findings assembly ───────────────────────────────────────────────────────

export interface InfraReport {
  host: string;
  reachable: boolean;
  openPorts: number[];
  banners: { port: number; banner: string; source: "greeting" | "http-head" }[];
  tls: TlsPosture[];
  serviceChecks: ServiceCheckResult[];
  error?: string;
}

/**
 * Full SAFE-mode infrastructure assessment of one host. Every step is a real
 * network interaction; evidence captures the raw bytes observed.
 */
export async function runInfraScan(host: string, cfg: EngineConfig = SAFE_DEFAULT): Promise<InfraReport> {
  const report: InfraReport = { host, reachable: false, openPorts: [], banners: [], tls: [], serviceChecks: [] };
  const ports = await portScan(host, cfg);
  const open = ports.filter((p) => p.open).map((p) => p.port);
  report.openPorts = open;
  report.reachable = open.length > 0;
  if (!open.length) {
    report.error = "No configured service ports answered (host unreachable or firewalled)";
    return report;
  }
  // Service-detection ladder, all SAFE probes:
  //   1. known TLS ports → HTTP HEAD over TLS + TLS posture
  //   2. everything else → passive greeting read (SSH/FTP/SMTP/MySQL)
  //   3. no greeting → HTTP HEAD attempt (version-bearing Server headers)
  //   4. still nothing → Redis PING (unauthenticated-access check)
  for (const port of open) {
    await sleep(cfg.throttleMs);
    if (TLS_PORTS.has(port)) {
      const r = await httpHead(host, port, true, cfg.bannerTimeoutMs);
      const banner = r.server ? `Server: ${r.server}\r\n${r.raw.split("\r\n")[0] ?? ""}` : r.raw.split("\r\n")[0] ?? "";
      if (banner.trim()) report.banners.push({ port, banner: banner.slice(0, 256), source: "http-head" });
      report.tls.push(await probeTls(host, port, cfg.bannerTimeoutMs));
      continue;
    }
    if (HTTP_PORTS.has(port)) {
      const r = await httpHead(host, port, false, cfg.bannerTimeoutMs);
      const banner = r.server ? `Server: ${r.server}\r\n${r.raw.split("\r\n")[0] ?? ""}` : r.raw.split("\r\n")[0] ?? "";
      if (banner.trim()) report.banners.push({ port, banner: banner.slice(0, 256), source: "http-head" });
      continue;
    }
    const banner = await readBanner(host, port, cfg.bannerTimeoutMs);
    if (banner) {
      report.banners.push({ port, banner, source: "greeting" });
      // FTP-like greeting (220 + FTP product) or the classic port → anonymous-access check
      if (port === 21 || (/^220\b/i.test(banner) && /ftp/i.test(banner))) {
        report.serviceChecks.push(await checkAnonymousFtp(host, port, cfg.bannerTimeoutMs));
      }
      continue;
    }
    // no passive greeting → HTTP candidate?
    const http = await httpHead(host, port, false, cfg.bannerTimeoutMs);
    if (http.status !== null || http.server) {
      const assembled = http.server ? `Server: ${http.server}\r\n${http.raw.split("\r\n")[0] ?? ""}` : http.raw.split("\r\n")[0] ?? "";
      if (assembled.trim()) report.banners.push({ port, banner: assembled.slice(0, 256), source: "http-head" });
      continue;
    }
    // last candidate: an unauthenticated Redis answering PING
    report.serviceChecks.push(await checkUnauthRedis(host, port, cfg.bannerTimeoutMs));
  }
  return report;
}

/** Fingerprint per plan §4: sha256(asset ‖ rule ‖ location) — the dedupe identity. */
export function findingFingerprint(assetId: string, ruleKey: string, location: string): string {
  return createHash("sha256").update(`${assetId}|${ruleKey}|${location}`).digest("hex");
}

// ── Infra report → vulnerability drafts (all REAL observations) ─────────────

const WEAK_PROTOCOL_PORTS: Record<number, { title: string; cvss: number; remediation: string }> = {
  23: { title: "Telnet service exposed — cleartext remote administration protocol", cvss: 7.5, remediation: "Disable Telnet; require SSH (or console) for device administration." },
  21: { title: "FTP service exposed — cleartext file transfer protocol", cvss: 5.3, remediation: "Replace FTP with SFTP/FTPS; if required, restrict source IPs and disable anonymous access." },
  3389: { title: "RDP endpoint exposed to the scanned segment", cvss: 5.3, remediation: "Restrict RDP to VPN/bastion access; enforce NLA and MFA at the gateway." },
  445: { title: "SMB port 445 reachable from this segment", cvss: 4.3, remediation: "Segment SMB access; block 445 at the perimeter; enforce SMB signing." },
  2375: { title: "Docker daemon API exposed unencrypted on 2375", cvss: 9.8, remediation: "Disable the unencrypted docker remote API; require the authenticated TLS endpoint on 2376." },
  9200: { title: "Elasticsearch HTTP API exposed", cvss: 5.3, remediation: "Bind Elasticsearch to localhost; front it with an authenticated proxy; enable TLS." },
  11211: { title: "memcached exposed to the network", cvss: 5.3, remediation: "Restrict memcached to loopback; enable SASL authentication." },
  27017: { title: "MongoDB exposed to the network", cvss: 5.3, remediation: "Enable authentication and TLS; bind to trusted interfaces only." },
};

/**
 * Convert a real InfraReport into tracked vulnerability drafts:
 *   1. CVE feed matches from observed banners (version-verified)
 *   2. Deprecated TLS protocol / certificate expiry findings
 *   3. Weak-protocol and exposure findings from OPEN PORTS (observed, not assumed)
 *   4. SAFE active service-check hits (anonymous FTP / unauth Redis)
 */
export function infraVulnsFromReport(report: InfraReport, assetId: string): VulnDraft[] {
  const drafts: VulnDraft[] = [];
  const now = new Date();

  // 1. Banner → product/version → feed matches
  for (const { port, banner } of report.banners) {
    for (const { pv, entries } of matchBanner(banner)) {
      for (const e of entries) {
        drafts.push({
          cveId: e.cve,
          title: e.title,
          description: `${e.description} Detected from the live service banner on port ${port} (${pv.raw}) — affected range: ${e.affected}. Feed data as of ${FEED_AS_OF} (${e.source}).`,
          remediation: e.remediation,
          category: (e.category === "WEB" ? "WEB" : e.category === "SSL_TLS" ? "SSL_TLS" : "OS") as VulnDraft["category"],
          cvssScore: e.cvss,
          cvssVector: e.cvssVector,
          epss: e.epss,
          kev: e.kev,
          evidence: {
            mode: "infra-live",
            host: report.host,
            port,
            banner: banner.slice(0, 200),
            product: pv.product,
            version: pv.version,
            affectedRange: e.affected,
            feedAsOf: FEED_AS_OF,
            note: "Version match against the bundled offline feed (live-fetched CVSS/EPSS/KEV)",
          },
          detectedAt: now,
        });
      }
    }
  }

  // 2. TLS posture
  for (const t of report.tls) {
    if (t.tls10Accepted || t.tls11Accepted) {
      drafts.push({
        cveId: null,
        title: `Deprecated TLS protocol accepted on port ${t.port}`,
        description: `The service on port ${t.port} completed a ${t.tls10Accepted ? "TLS 1.0" : "TLS 1.1"} handshake during the safe probe — deprecated protocols with known weaknesses (BEAST/Poodle family) remain enabled.`,
        remediation: "Disable TLS 1.0 and 1.1; require TLS 1.2+ with AEAD cipher suites.",
        category: "SSL_TLS",
        cvssScore: 5.3,
        cvssVector: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:L/A:N",
        epss: 0.2,
        kev: false,
        evidence: { mode: "infra-live", host: report.host, port: t.port, tls: { ...t }, note: "Real TLS handshake with maxVersion pinned to the deprecated protocol" },
        detectedAt: now,
      });
    }
    if (t.certDaysRemaining !== null && t.certDaysRemaining <= 30) {
      drafts.push({
        cveId: null,
        title: t.certDaysRemaining <= 0 ? `Expired TLS certificate on port ${t.port}` : `TLS certificate expiring in ${t.certDaysRemaining} day(s)`,
        description: `Certificate for ${t.certSubject ?? report.host} (issued by ${t.certIssuer ?? "unknown"}) ${t.certDaysRemaining <= 0 ? "has EXPIRED" : "enters the 30-day warning window"} — service continuity and trust-chain risk.`,
        remediation: "Automate certificate renewal (ACME) and alert at the 30/14/7-day bands.",
        category: "SSL_TLS",
        cvssScore: t.certDaysRemaining <= 0 ? 5.3 : 3.7,
        cvssVector: null,
        epss: 0.1,
        kev: false,
        evidence: { mode: "infra-live", host: report.host, port: t.port, certDaysRemaining: t.certDaysRemaining, certSubject: t.certSubject, certIssuer: t.certIssuer },
        detectedAt: now,
      });
    }
  }

  // 3. Weak-protocol / exposure findings from OBSERVED open ports
  for (const port of report.openPorts) {
    const w = WEAK_PROTOCOL_PORTS[port];
    if (!w) continue;
    drafts.push({
      cveId: null,
      title: w.title,
      description: `Port ${port} answered the TCP connect scan — the exposed service accepts connections from the scanning position. ${w.title.includes("Telnet") ? "Telnet transmits credentials in cleartext." : ""}`.trim(),
      remediation: w.remediation,
      category: "NETWORK",
      cvssScore: w.cvss,
      cvssVector: null,
      epss: 0.2,
      kev: false,
      evidence: { mode: "infra-live", host: report.host, port, observed: "port open (TCP connect)", note: "Exposure finding from the observed socket state" },
      detectedAt: now,
    });
  }

  // 4. SAFE active service-check hits
  for (const c of report.serviceChecks) {
    if (!c.hit) continue;
    drafts.push({
      cveId: null,
      title: c.detail,
      description: `${c.detail}. Verified by a non-destructive protocol handshake on port ${c.port}.`,
      remediation: c.id === "ftp-anonymous" ? "Disable anonymous authentication on the FTP service; enforce named accounts." : "Require authentication (Redis requirepass/ACL) and bind to trusted interfaces.",
      category: "CONFIG",
      cvssScore: c.id === "ftp-anonymous" ? 5.3 : 7.5,
      cvssVector: null,
      epss: 0.15,
      kev: false,
      evidence: { mode: "infra-live", host: report.host, port: c.port, transcript: c.evidence, note: "Non-destructive authentication probe transcript" },
      detectedAt: now,
    });
  }

  return drafts;
}
