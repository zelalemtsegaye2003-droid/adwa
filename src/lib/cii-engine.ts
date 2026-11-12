/**
 * Adwa Cyber — CII monitoring readiness engine (proposal Phase 5, Track C).
 *
 * Monitoring of Critical Information Infrastructure operators is GATED on two
 * parallel preconditions per operator:
 *
 *   1. An ACTIVE MOU (signed, in force, not expired) that enumerates the
 *      authorised telemetry scope — nothing outside `scope` may ever be
 *      collected.
 *   2. An ACTIVE INSA authorisation (the regulatory licence to monitor).
 *
 * Only when BOTH gates are open may a registered system advance to
 * MONITORING_AUTHORIZED. This module holds the pure evaluation logic the API
 * layer enforces; the platform intentionally ships no collection agents.
 */

export const CII_MOU_STATUSES = [
  "DRAFTING",
  "LEGAL_REVIEW",
  "SIGNED",
  "ACTIVE",
  "EXPIRED",
  "TERMINATED",
] as const;

export type CiiMouStatus = (typeof CII_MOU_STATUSES)[number];

export const CII_AUTH_STATUSES = [
  "PENDING",
  "UNDER_REVIEW",
  "GRANTED",
  "ACTIVE",
  "SUSPENDED",
  "REVOKED",
  "EXPIRED",
] as const;

export type CiiAuthStatus = (typeof CII_AUTH_STATUSES)[number];

export const CII_SYSTEM_READINESS = [
  "REGISTERED",
  "INVENTORY_MAPPED",
  "AGENT_READY",
  "MONITORING_AUTHORIZED",
] as const;

export type CiiSystemReadiness = (typeof CII_SYSTEM_READINESS)[number];

export const CII_SYSTEM_CATEGORIES = [
  "SCADA",
  "CORE_BANKING",
  "ERP",
  "NETWORK_BACKBONE",
  "RESERVATION",
  "PAYMENT_SWITCH",
  "DATA_CENTER",
  "OTHER",
] as const;

export const CII_SECTORS = ["Energy", "Aviation", "Telecommunications", "Banking", "Water", "Transport", "Health"] as const;

/** Bilingual labels for the MOU lifecycle. */
export const CII_MOU_STATUS_LABELS: Record<CiiMouStatus, [string, string]> = {
  DRAFTING: ["Drafting", "በማዘጋጀት ላይ"],
  LEGAL_REVIEW: ["Legal review", "በሕግ ግምገማ ላይ"],
  SIGNED: ["Signed", "የተፈረመ"],
  ACTIVE: ["Active", "ንቁ"],
  EXPIRED: ["Expired", "ጊዜው አልፏል"],
  TERMINATED: ["Terminated", "ተቋርጧል"],
};

/** Bilingual labels for the INSA authorisation lifecycle. */
export const CII_AUTH_STATUS_LABELS: Record<CiiAuthStatus, [string, string]> = {
  PENDING: ["Pending", "በመጠበቅ ላይ"],
  UNDER_REVIEW: ["Under review", "በግምገማ ላይ"],
  GRANTED: ["Granted", "ተሰጥቷል"],
  ACTIVE: ["Active", "ንቁ"],
  SUSPENDED: ["Suspended", "ተከልክሏል"],
  REVOKED: ["Revoked", "ተሰርዟል"],
  EXPIRED: ["Expired", "ጊዜው አልፏል"],
};

/** Bilingual labels for system readiness. */
export const CII_READINESS_LABELS: Record<CiiSystemReadiness, [string, string]> = {
  REGISTERED: ["Registered", "ተመዝግቧል"],
  INVENTORY_MAPPED: ["Inventory mapped", "ቆጠራ ተዘጋጅቷል"],
  AGENT_READY: ["Agent ready", "ወኪል ዝግጁ ነው"],
  MONITORING_AUTHORIZED: ["Monitoring authorised", "ክትትል ተፈቅዷል"],
};

// ── Gate evaluation ─────────────────────────────────────────────────────────

export interface CiiMouLike {
  status: string;
  signedAt: Date | null;
  expiresAt: Date | null;
}

export interface CiiAuthLike {
  status: string;
  issuedAt: Date | null;
  expiresAt: Date | null;
}

export interface CiiOperatorGate {
  operatorId: string;
  operatorCode: string;
  mouGate: boolean; // an MOU is signed/active and not expired
  mouStatus: CiiMouStatus | null; // the governing (latest) MOU status
  insaGate: boolean; // an INSA authorisation is active and not expired
  authStatus: CiiAuthStatus | null;
  gateOpen: boolean; // both preconditions
  unmetGates: ("MOU" | "INSA_AUTHORIZATION")[];
}

function mouInForce(m: CiiMouLike, now: Date): boolean {
  if (m.status === "ACTIVE") return m.expiresAt ? m.expiresAt > now : true;
  if (m.status === "SIGNED") return m.signedAt !== null && (!m.expiresAt || m.expiresAt > now);
  return false;
}

function authInForce(a: CiiAuthLike, now: Date): boolean {
  if (a.status !== "ACTIVE" && a.status !== "GRANTED") return false;
  if (a.expiresAt && a.expiresAt <= now) return false;
  if (a.issuedAt && a.expiresAt) return a.expiresAt > now;
  return true;
}

/**
 * Evaluate an operator's monitoring gate. The governing MOU is the newest
 * version; the governing INSA authorisation is the newest record.
 */
export function evaluateCiiGate(
  operator: { id: string; code: string },
  mous: CiiMouLike[],
  authorizations: CiiAuthLike[],
  now: Date = new Date()
): CiiOperatorGate {
  // Governing MOU = highest version-ish: prefer in-force, else latest signed/review, else latest.
  const inForce = mous.filter((m) => mouInForce(m, now));
  const governingMou =
    inForce[0] ??
    mous.find((m) => m.status === "SIGNED") ??
    mous.find((m) => m.status === "LEGAL_REVIEW") ??
    mous[0] ??
    null;
  // Governing authorisation = an in-force one, else the most advanced review stage.
  const authInForceRow = authorizations.filter((a) => authInForce(a, now));
  const governingAuth =
    authInForceRow[0] ??
    authorizations.find((a) => a.status === "GRANTED") ??
    authorizations.find((a) => a.status === "UNDER_REVIEW") ??
    authorizations[0] ??
    null;

  const mouGate = inForce.length > 0;
  const insaGate = authInForceRow.length > 0;
  const unmetGates: ("MOU" | "INSA_AUTHORIZATION")[] = [];
  if (!mouGate) unmetGates.push("MOU");
  if (!insaGate) unmetGates.push("INSA_AUTHORIZATION");

  return {
    operatorId: operator.id,
    operatorCode: operator.code,
    mouGate,
    mouStatus: (governingMou?.status as CiiMouStatus | undefined) ?? null,
    insaGate,
    authStatus: (governingAuth?.status as CiiAuthStatus | undefined) ?? null,
    gateOpen: mouGate && insaGate,
    unmetGates,
  };
}

/**
 * The four nationally designated TIER1 operators named in the proposal —
 * seeded by scripts/seed-trackc.cjs (upsert by code).
 */
export const CII_DEFAULT_OPERATORS: {
  code: string;
  name: string;
  nameAm: string;
  sector: string;
  tier: string;
  contactEmail: string;
}[] = [
  {
    code: "EEP",
    name: "Ethiopian Electric Power",
    nameAm: "የኢትዮጵያ ኤሌክትሪክ ኃይል",
    sector: "Energy",
    tier: "TIER1",
    contactEmail: "cio@eep.com.et",
  },
  {
    code: "ETHIOPIAN-AIRLINES",
    name: "Ethiopian Airlines",
    nameAm: "የኢትዮጵያ አየር መንገድ",
    sector: "Aviation",
    tier: "TIER1",
    contactEmail: "cio@ethiopianairlines.com",
  },
  {
    code: "ETHIO-TELECOM",
    name: "Ethio Telecom",
    nameAm: "ኢትዮ ቴሌኮም",
    sector: "Telecommunications",
    tier: "TIER1",
    contactEmail: "security@ethiotelecom.et",
  },
  {
    code: "CBE",
    name: "Commercial Bank of Ethiopia",
    nameAm: "የኢትዮጵያ ንግድ ባንክ",
    sector: "Banking",
    tier: "TIER1",
    contactEmail: "ciso@cbe.com.et",
  },
];
