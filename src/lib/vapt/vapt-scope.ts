/**
 * Adwa Cyber — VAPT authorization gate (plan §1 "Authorization first").
 *
 * No scan runs unless every target lies inside an APPROVED scope object whose
 * validity window covers the scan date. Rejections are recorded in the
 * hash-chained audit log (SCAN_REJECTED) — the plan's acceptance test:
 * "a scan against an out-of-scope target is rejected, and the audit log
 * records the attempt."
 *
 * Scope targets are typed:
 *   cidr    — IPv4 CIDR block (host bits allowed; matched numerically)
 *   ip      — single IPv4 address (equivalent to a /32)
 *   domain  — DNS suffix match (bank.et matches www.bank.et, not mybank.et)
 *   url     — scheme-aware origin match (https://app.bank.et matches any port)
 *
 * Pure functions — unit-testable without a database.
 */

export interface ScopeTarget {
  kind: "cidr" | "ip" | "domain" | "url";
  value: string;
}

export interface ScopeRecord {
  id: string;
  name: string;
  targets: string; // JSON array of ScopeTarget
  owner: string;
  authorizationNote: string;
  validFrom: Date | string;
  validUntil: Date | string;
  status: string; // DRAFT | APPROVED | REJECTED | EXPIRED
  intrusiveAllowed: boolean;
  requestedById: string;
  approvedById?: string | null;
}

// ── IPv4 arithmetic ──────────────────────────────────────────────────────────

function ipToLong(ip: string): number | null {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(ip.trim());
  if (!m) return null;
  const parts = [m[1], m[2], m[3], m[4]].map((x) => Number.parseInt(x, 10));
  if (parts.some((p) => p > 255)) return null;
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

function cidrToRange(cidr: string): { lo: number; hi: number } | null {
  const idx = cidr.indexOf("/");
  const ip = idx === -1 ? cidr : cidr.slice(0, idx);
  const prefix = idx === -1 ? 32 : Number.parseInt(cidr.slice(idx + 1), 10);
  const base = ipToLong(ip);
  if (base === null || Number.isNaN(prefix) || prefix < 0 || prefix > 32) return null;
  const size = 2 ** (32 - prefix);
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  const network = (base & mask) >>> 0;
  return { lo: network, hi: network + size - 1 };
}

// ── Target extraction from an asset identifier ──────────────────────────────

export interface TargetCandidate {
  host: string | null; // bare IP if the identifier is an IP / URL with IP host
  domain: string | null; // hostname if the identifier is a URL/domain
  port: number | null; // explicit port (identifier "10.2.6.20:1521" or URL)
}

/** Extract the matchable host/port from an asset identifier (IP, host, URL, host:port). */
export function extractTarget(identifier: string): TargetCandidate {
  const raw = identifier.trim();
  if (!raw) return { host: null, domain: null, port: null };
  // URL form (http(s)://…)
  const urlMatch = /^https?:\/\/([^/:]+)(?::(\d+))?/i.exec(raw);
  if (urlMatch) {
    const hostPart = urlMatch[1];
    const port = urlMatch[2] ? Number.parseInt(urlMatch[2], 10) : null;
    if (ipToLong(hostPart) !== null) return { host: hostPart, domain: null, port };
    return { host: null, domain: hostPart.toLowerCase(), port };
  }
  // host:port form
  const hp = /^([^:]+):(\d+)$/.exec(raw);
  if (hp) {
    const hostPart = hp[1];
    const port = Number.parseInt(hp[2], 10);
    if (ipToLong(hostPart) !== null) return { host: hostPart, domain: null, port };
    return { host: null, domain: hostPart.toLowerCase(), port };
  }
  if (ipToLong(raw) !== null) return { host: raw, domain: null, port: null };
  // bare hostname or CIDR — domain suffix matching handles both
  return { host: null, domain: raw.toLowerCase(), port: null };
}

// ── Matching ────────────────────────────────────────────────────────────────

function matchesDomainSuffix(candidate: string, scopeDomain: string): boolean {
  const c = candidate.toLowerCase().replace(/\.$/, "");
  const s = scopeDomain.toLowerCase().replace(/\.$/, "");
  if (c === s) return true;
  return c.endsWith(`.${s}`);
}

/**
 * Does one scope target authorize one asset identifier?
 * `url` targets only authorize the exact scheme-origin family; `cidr`/`ip`
 * authorize any port; `domain` authorizes any port and any subdomain.
 */
export function targetMatches(target: ScopeTarget, identifier: string): boolean {
  const cand = extractTarget(identifier);
  switch (target.kind) {
    case "cidr": {
      const range = cidrToRange(target.value);
      if (!range || !cand.host) return false;
      const ip = ipToLong(cand.host);
      return ip !== null && ip >= range.lo && ip <= range.hi;
    }
    case "ip": {
      const want = ipToLong(target.value);
      return want !== null && cand.host === target.value.trim();
    }
    case "domain": {
      if (!cand.domain) return false;
      return matchesDomainSuffix(cand.domain, target.value);
    }
    case "url": {
      try {
        const u = new URL(target.value);
        const host = u.hostname.toLowerCase();
        if (cand.host && ipToLong(cand.host) !== null) {
          return cand.host === host; // IP-literal URL targets match IP-literal assets
        }
        if (!cand.domain) return false;
        return matchesDomainSuffix(cand.domain, host);
      } catch {
        return false;
      }
    }
    default:
      return false;
  }
}

/** Parse + validate the scope targets JSON. Returns null when malformed. */
export function parseScopeTargets(json: string): ScopeTarget[] | null {
  let arr: unknown;
  try {
    arr = JSON.parse(json);
  } catch {
    return null;
  }
  if (!Array.isArray(arr) || arr.length === 0) return null;
  const out: ScopeTarget[] = [];
  for (const t of arr) {
    if (typeof t !== "object" || t === null) return null;
    const rec = t as Record<string, unknown>;
    const kind = rec.kind;
    const value = typeof rec.value === "string" ? rec.value.trim() : "";
    if (kind === "cidr") {
      if (!cidrToRange(value)) return null;
    } else if (kind === "ip") {
      if (ipToLong(value) === null) return null;
    } else if (kind === "domain") {
      // sane hostname: letters, digits, dots, hyphens — single-label hosts
      // (e.g. "localhost") and dotted multi-label domains are both valid
      if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*\.?$/i.test(value) || !value.includes(".") && value.length < 2) return null;
    } else if (kind === "url") {
      try {
        const u = new URL(value);
        if (u.protocol !== "http:" && u.protocol !== "https:") return null;
      } catch {
        return null;
      }
    } else {
      return null;
    }
    out.push({ kind, value });
  }
  return out;
}

/**
 * Is a scope currently valid (approved + inside its window)?
 * Expiry is computed from wall-clock at evaluation time, not stored status —
 * an approved scope past validUntil never authorizes anything.
 */
export function scopeIsLive(scope: ScopeRecord, now = new Date()): boolean {
  if (scope.status !== "APPROVED") return false;
  const from = new Date(scope.validFrom).getTime();
  const until = new Date(scope.validUntil).getTime();
  return from <= now.getTime() && now.getTime() <= until;
}

/** Four-eyes (plan §1): approver must differ from the requester. */
export function fourEyesOk(scope: ScopeRecord): boolean {
  return !!scope.approvedById && scope.approvedById !== scope.requestedById;
}

/**
 * Find the live scope that authorizes an identifier (first match wins).
 * Returns null when NO approved, in-window scope covers the target —
 * the caller must then reject the scan and audit-log the attempt.
 */
export function authorizingScope<T extends ScopeRecord>(identifier: string, scopes: T[], now = new Date()): T | null {
  for (const s of scopes) {
    if (!scopeIsLive(s, now)) continue;
    const targets = parseScopeTargets(s.targets);
    if (!targets) continue;
    if (targets.some((t) => targetMatches(t, identifier))) return s;
  }
  return null;
}
