/**
 * Adwa Cyber — SOC engine (CERT-as-a-Service, proposal Phase 2).
 *
 * Deterministic intelligence layer for the security-operations module. The
 * proposal markets "AI-powered" SOC capabilities; in the MVP these are
 * implemented as transparent, rule-based engines that a supervisor can audit:
 *
 *   1. Alert prioritisation  — severity × sector targeting × confidence ×
 *                              freshness → a 0–100 score and an
 *                              IMMEDIATE / HIGH / ROUTINE queue label
 *                              (NIST SP 800-61 alignment; fights alert fatigue).
 *   2. Hybrid sharing        — TLP + sensitivity decide hub-and-spoke
 *                              (anonymised broadcast) vs peer-to-peer
 *                              (targeted, identity-protected) — the AAU
 *                              Collaborative Framework model.
 *   3. Anonymisation         — strips the originating organisation from any
 *                              indicator before a hub broadcast.
 *   4. Latency analytics     — detection→notification median / p90 against
 *                              the RQ3 target (<15 min for financial
 *                              institutions), plus MTTD/MTTR summaries.
 *   5. Predictive intel      — ranks the threat categories most likely to
 *                              target a sector from live indicator + incident
 *                              data (INTERPOL Africa threat weighting).
 *
 * Pure module — safe on both server and client.
 */

// ── Incident lifecycle (NIST SP 800-61) ─────────────────────────────────────

export const INCIDENT_STATUSES = [
  "detected",
  "triaged",
  "contained",
  "eradicated",
  "recovered",
  "closed",
] as const;
export type IncidentStatus = (typeof INCIDENT_STATUSES)[number];

/** Timestamp field stamped when an incident enters each status. */
export const STATUS_TIMESTAMP: Record<IncidentStatus, string> = {
  detected: "detectedAt",
  triaged: "triagedAt",
  contained: "containedAt",
  eradicated: "eradicatedAt",
  recovered: "recoveredAt",
  closed: "closedAt",
};

/** Forward-only lifecycle: an incident may only advance to a later stage. */
export function canAdvanceTo(current: string, next: string): boolean {
  const a = INCIDENT_STATUSES.indexOf(current as IncidentStatus);
  const b = INCIDENT_STATUSES.indexOf(next as IncidentStatus);
  return a !== -1 && b !== -1 && b === a + 1;
}

export function nextStatus(current: string): IncidentStatus | null {
  const a = INCIDENT_STATUSES.indexOf(current as IncidentStatus);
  if (a === -1 || a === INCIDENT_STATUSES.length - 1) return null;
  return INCIDENT_STATUSES[a + 1];
}

export const STATUS_EVENT: Record<IncidentStatus, string> = {
  detected: "DETECTED",
  triaged: "TRIAGE",
  contained: "CONTAIN",
  eradicated: "ERADICATE",
  recovered: "RECOVER",
  closed: "CLOSE",
};

// ── 1. Alert prioritisation ─────────────────────────────────────────────────

const SEVERITY_WEIGHT: Record<string, number> = {
  critical: 40,
  high: 28,
  medium: 16,
  low: 8,
};

/**
 * Sector × category targeting matrix (INTERPOL Africa Cyberthreat Assessment
 * 2025: BEC, phishing and ransomware dominate East-African financial-sector
 * incidents; DDoS is prevalent for telecom; SMEs are heavily phished).
 */
const SECTOR_CATEGORY_BOOST: Record<string, Partial<Record<string, number>>> = {
  Banking: { bec: 14, ransomware: 12, phishing: 10, credential_stuffing: 10, malware: 8, data_breach: 8 },
  Microfinance: { phishing: 12, bec: 10, credential_stuffing: 8, malware: 6 },
  Telecom: { ddos: 14, ransomware: 8, apt: 8 },
  SME: { phishing: 12, scam: 10, malware: 6, credential_stuffing: 6 },
};

export interface PrioritisationInput {
  severity: string;
  category: string;
  orgSector?: string | null;
  confidence?: number; // 0–100 (indicator confidence when threat-matched)
  ageMinutes?: number; // minutes since detection
  assetCriticality?: number; // 1–5, default 3
}

export interface Prioritisation {
  score: number; // 0–100
  label: "IMMEDIATE" | "HIGH" | "ROUTINE";
  rationale: string; // audit-friendly explanation of the components
}

export function prioritiseIncident(input: PrioritisationInput): Prioritisation {
  const sev = SEVERITY_WEIGHT[input.severity] ?? 12;
  const sector = input.orgSector ?? "";
  const boost = SECTOR_CATEGORY_BOOST[sector]?.[input.category] ?? 0;
  const confidence = Math.max(0, Math.min(100, input.confidence ?? 60));
  const confTerm = Math.round(((confidence - 50) / 100) * 12); // −6 … +6
  const asset = Math.max(1, Math.min(5, input.assetCriticality ?? 3));
  const assetTerm = (asset - 3) * 3; // −6 … +6
  // Freshness: incidents older than 4h decay slightly (they are being worked);
  // brand-new criticals surface at the top of the queue.
  const age = Math.max(0, input.ageMinutes ?? 0);
  const freshTerm = age <= 15 ? 6 : age <= 60 ? 3 : age <= 240 ? 0 : -4;

  const score = Math.max(0, Math.min(100, sev + boost + confTerm + assetTerm + freshTerm));
  const label: Prioritisation["label"] = score >= 75 ? "IMMEDIATE" : score >= 50 ? "HIGH" : "ROUTINE";
  const rationale =
    `severity ${input.severity} (${sev})` +
    (boost ? ` + ${sector}×${input.category} targeting (+${boost})` : "") +
    ` + confidence ${confidence} (${confTerm >= 0 ? "+" : ""}${confTerm})` +
    ` + asset criticality ${asset} (${assetTerm >= 0 ? "+" : ""}${assetTerm})` +
    ` + freshness ${age}m (${freshTerm >= 0 ? "+" : ""}${freshTerm})`;
  return { score, label, rationale };
}

// ── 2. Hybrid sharing decision (AAU Collaborative Framework) ────────────────

export type SharingMode = "HUB" | "P2P";

/**
 * AI-mediated routing per the hybrid model: sensitive indicators (TLP:RED /
 * TLP:AMBER+STRICT, sensitivity ≥ 4, or categories that tend to expose the
 * reporting org — insider, data_breach) travel peer-to-peer between trusted
 * partners; everything else is broadcast through the anonymising hub.
 */
export function hybridSharingDecision(input: {
  tlp: string;
  sensitivity: number; // 1–5
  category: string;
}): { mode: SharingMode; reason: string } {
  const identitySensitive = input.category === "insider" || input.category === "data_breach";
  if (input.tlp === "TLP:RED" || input.tlp === "TLP:AMBER+STRICT") {
    return { mode: "P2P", reason: `${input.tlp} — restricted to named recipients` };
  }
  if (input.sensitivity >= 4) {
    return { mode: "P2P", reason: `sensitivity ${input.sensitivity}/5 — identity-protection applies` };
  }
  if (identitySensitive && input.sensitivity >= 3) {
    return { mode: "P2P", reason: `${input.category} indicators can identify the reporter — peer-to-peer only` };
  }
  return { mode: "HUB", reason: `${input.tlp} — anonymised hub broadcast is safe` };
}

/**
 * Sensitivity classification for a submitted indicator. Heuristic: base by
 * category, raised by TLP marking and confidence, clamped 1–5.
 */
export function classifySensitivity(category: string, tlp: string, confidence: number): number {
  const base: Record<string, number> = {
    insider: 4, data_breach: 4, apt: 4, bec: 3, ransomware: 3,
    malware: 3, credential_stuffing: 3, phishing: 2, ddos: 2, scam: 2, other: 3,
  };
  let s = base[category] ?? 3;
  if (tlp === "TLP:RED" || tlp === "TLP:AMBER+STRICT") s += 1;
  if (tlp === "TLP:CLEAR" || tlp === "TLP:GREEN") s -= 1;
  if (confidence >= 80) s += 1;
  return Math.max(1, Math.min(5, s));
}

// ── 3. Anonymisation (privacy-preserving sharing) ───────────────────────────

export interface AnonymisedIndicator {
  type: string;
  value: string;
  category: string;
  severity: string;
  tlp: string;
  confidence: number;
  descriptionEn?: string | null;
  /** "A member organisation of the Adwa Cyber sharing community" — never the name. */
  originAnonymised: string;
}

/** Strip the originating organisation before a hub broadcast / upward report. */
export function anonymiseForHub(i: {
  type: string; value: string; category: string; severity: string;
  tlp: string; confidence: number; descriptionEn?: string | null;
}): AnonymisedIndicator {
  return {
    type: i.type,
    value: i.value,
    category: i.category,
    severity: i.severity,
    tlp: i.tlp,
    confidence: i.confidence,
    descriptionEn: i.descriptionEn ?? null,
    originAnonymised: "A member organisation of the Adwa Cyber sharing community",
  };
}

// ── 4. Latency analytics (RQ3) ──────────────────────────────────────────────

export const RQ3_TARGET_MINUTES = 15; // median detection→notification, financial sector

export interface LatencyStats {
  count: number;
  medianMin: number | null;
  p90Min: number | null;
  minMin: number | null;
  maxMin: number | null;
  withinTarget: number; // notifications inside the 15-minute target
  targetMet: boolean | null; // median ≤ 15 (null when no samples)
}

function median(nums: number[]): number {
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function percentile(nums: number[], p: number): number {
  const s = [...nums].sort((a, b) => a - b);
  const idx = Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1);
  return s[Math.max(0, idx)];
}

/** Detection→notification latency across incidents (RQ3). */
export function notificationLatency(
  incidents: { detectedAt: string | Date; notifiedAt: string | Date | null }[]
): LatencyStats {
  const mins = incidents
    .filter((i) => i.notifiedAt)
    .map((i) =>
      Math.max(0, (new Date(i.notifiedAt!).getTime() - new Date(i.detectedAt).getTime()) / 60_000)
    );
  if (mins.length === 0) {
    return { count: 0, medianMin: null, p90Min: null, minMin: null, maxMin: null, withinTarget: 0, targetMet: null };
  }
  const med = median(mins);
  return {
    count: mins.length,
    medianMin: Math.round(med * 10) / 10,
    p90Min: Math.round(percentile(mins, 90) * 10) / 10,
    minMin: Math.round(Math.min(...mins) * 10) / 10,
    maxMin: Math.round(Math.max(...mins) * 10) / 10,
    withinTarget: mins.filter((m) => m <= RQ3_TARGET_MINUTES).length,
    targetMet: med <= RQ3_TARGET_MINUTES,
  };
}

/** Mean time to triage / contain / close, in minutes (null when no samples). */
export function lifecycleTimes(
  incidents: { detectedAt: string | Date; triagedAt?: string | Date | null; containedAt?: string | Date | null; closedAt?: string | Date | null }[]
): { mttaMin: number | null; mttcMin: number | null; mttrMin: number | null } {
  const avg = (pairs: [string | Date, string | Date | null | undefined][]) => {
    const mins = pairs
      .filter(([, end]) => end)
      .map(([start, end]) => Math.max(0, (new Date(end!).getTime() - new Date(start).getTime()) / 60_000));
    return mins.length ? Math.round((mins.reduce((a, b) => a + b, 0) / mins.length) * 10) / 10 : null;
  };
  return {
    mttaMin: avg(incidents.map((i) => [i.detectedAt, i.triagedAt] as const)), // mean time to acknowledge/triage
    mttcMin: avg(incidents.map((i) => [i.detectedAt, i.containedAt] as const)), // mean time to contain
    mttrMin: avg(incidents.map((i) => [i.detectedAt, i.closedAt] as const)), // mean time to resolve
  };
}

// ── 5. Predictive threat intelligence ───────────────────────────────────────

export interface ThreatForecast {
  category: string;
  riskIndex: number; // 0–100
  activeIndicators: number;
  recentIncidents: number;
  drivers: string[];
}

const SECTOR_BASELINE: Record<string, Partial<Record<string, number>>> = {
  // Baseline share of incidents per category by sector (INTERPOL A.C.T.A. 2025)
  Banking: { bec: 26, phishing: 20, ransomware: 16, credential_stuffing: 12, malware: 10, data_breach: 8, ddos: 4, apt: 4 },
  Microfinance: { phishing: 28, bec: 18, credential_stuffing: 16, malware: 12, ransomware: 10, scam: 8, data_breach: 8 },
  Telecom: { ddos: 30, ransomware: 16, apt: 14, malware: 12, phishing: 12, credential_stuffing: 8, bec: 8 },
  SME: { phishing: 30, scam: 18, malware: 14, credential_stuffing: 12, bec: 10, ransomware: 8, ddos: 8 },
};

/**
 * Forecast which attack categories are most likely to target an organisation
 * of the given sector, blending the sector baseline with live signals: the
 * active indicators in the hub and the tenant's own recent incidents.
 */
export function predictThreats(
  sector: string,
  activeIndicators: { category: string; severity: string }[],
  recentIncidents: { category: string }[]
): ThreatForecast[] {
  const baseline = SECTOR_BASELINE[sector] ?? SECTOR_BASELINE.SME;
  const categories = new Set<string>([...Object.keys(baseline), ...activeIndicators.map((i) => i.category), ...recentIncidents.map((i) => i.category)]);

  const out: ThreatForecast[] = [];
  for (const category of categories) {
    const base = baseline[category] ?? 4;
    const inds = activeIndicators.filter((i) => i.category === category);
    const incs = recentIncidents.filter((i) => i.category === category);
    const sevBoost = inds.reduce((a, i) => a + (i.severity === "critical" ? 6 : i.severity === "high" ? 4 : 2), 0);
    // Live signals can at most double the baseline; incidents count double.
    const riskIndex = Math.min(100, Math.round(base + sevBoost + incs.length * 8));
    const drivers: string[] = [`${sector} baseline ${base}`];
    if (inds.length) drivers.push(`${inds.length} active indicator(s) in the hub`);
    if (incs.length) drivers.push(`${incs.length} recent incident(s) of this type`);
    out.push({ category, riskIndex, activeIndicators: inds.length, recentIncidents: incs.length, drivers });
  }
  return out.sort((a, b) => b.riskIndex - a.riskIndex);
}

// ── Reference data ──────────────────────────────────────────────────────────

export const INDICATOR_TYPES = ["ip", "domain", "url", "hash_sha256", "hash_md5", "email", "filename", "cve"] as const;
export const THREAT_CATEGORIES = [
  "ransomware", "phishing", "bec", "malware", "ddos", "credential_stuffing",
  "apt", "scam", "insider", "data_breach", "vulnerability", "other",
] as const;
export const INCIDENT_CATEGORIES = [
  "ransomware", "phishing", "bec", "malware", "data_breach", "ddos",
  "unauthorized_access", "other",
] as const;
export const TLP_MARKINGS = ["TLP:CLEAR", "TLP:GREEN", "TLP:AMBER", "TLP:AMBER+STRICT", "TLP:RED"] as const;
export const INDICATOR_SOURCES = [
  "ETHIO_CERT", "MISP_FEED", "ANALYST", "ORG_UPLOAD",
  // Public threat-intel connectors (Real-Data Roadmap Phase 1)
  "CISA_KEV", "SPAMHAUS_DROP", "URLHAUS", "THREATFOX", "OTX",
] as const;
export const INCIDENT_SOURCES = ["SOC_MONITOR", "THREAT_MATCH", "ORG_REPORT", "ETHIO_CERT"] as const;
export const DETECTION_METHODS = ["signature", "behavioural", "anomaly", "threat_intel_match", "manual"] as const;
