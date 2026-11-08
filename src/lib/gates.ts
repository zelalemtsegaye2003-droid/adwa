/**
 * Adwa Cyber — Track C gate criteria (proposal roadmap §3.2 Table 2, §11.1
 * R11, §14 "Consolidated Strategic Recommendations").
 *
 * The roadmap re-sequenced the original five phases into three tracks. Track C
 * (Phases 4 + 5) is gated expansion: content filtering (ACFS) and CII
 * monitoring are strategically important but institutionally demanding, and
 * "the core business is never hostage to their slower institutional clocks".
 * No deployment until every blocking criterion below is SATISFIED.
 */

export const GATE_PHASES = ["P4_ACFS", "P5_CII"] as const;
export type GatePhase = (typeof GATE_PHASES)[number];

export const GATE_STATUSES = ["NOT_STARTED", "IN_PROGRESS", "SATISFIED", "BLOCKED"] as const;
export type GateStatus = (typeof GATE_STATUSES)[number];

export const GATE_CATEGORIES = [
  "PARTNERSHIP",
  "LEGAL",
  "HUMAN_RIGHTS",
  "FUNDING",
  "DESIGN",
  "INSURANCE",
] as const;

/** Forward-only progression; BLOCKED can be set from any state. */
export function canTransitionGate(from: string, to: string): boolean {
  if (from === to) return false;
  if (to === "BLOCKED") return true; // a gate criterion can be blocked at any time
  if (from === "BLOCKED") return to === "IN_PROGRESS" || to === "NOT_STARTED";
  if (from === "NOT_STARTED") return to === "IN_PROGRESS" || to === "SATISFIED";
  if (from === "IN_PROGRESS") return to === "SATISFIED";
  return false; // SATISFIED is terminal (re-open requires BLOCKED first)
}

export interface GateCriterionDef {
  phase: GatePhase;
  code: string;
  titleEn: string;
  titleAm: string;
  detailEn: string;
  detailAm: string;
  category: (typeof GATE_CATEGORIES)[number];
  blocking: boolean;
  initialStatus: GateStatus;
  notes?: string;
}

/**
 * Phase 4 — ACFS (Advanced Content Filtering System).
 * Roadmap risk R11: "Content filtering in any country sits next to censorship
 * … being framed as a surveillance vendor would be disproportionately
 * damaging." The gates make the venture's position unambiguous.
 */
/**
 * Phase 5 — CII (critical-infrastructure protection) for the four operators
 * named in the proposal: Ethiopian Electric Power, Ethiopian Airlines,
 * Ethio Telecom, CBE. Year-3 objective, gated since Year 1.
 */
export const GATE_CRITERIA: GateCriterionDef[] = [
  {
    phase: "P4_ACFS",
    code: "EMA_PARTNERSHIP",
    titleEn: "Signed EMA partnership",
    titleAm: "የተፈረሙ የኢትዮጵያ ሚዲያ ባለሥልጣን አጋርነቶች",
    detailEn:
      "A signed partnership with the Ethiopian Media Authority — the institutional owner of any national content-filtering mandate. Does not exist yet; no deployment proceeds without it.",
    detailAm:
      "ከኢትዮጵያ ሚዲያ ባለሥልጣን ጋር የተፈረመ ውል — ብሔራዊ የይዘት ማጣሪያ ተቋማዊ ባለቤት። ገና አልተፈረመም፤ ያለው ምንም አቅርቦት አይከናወንም።",
    category: "PARTNERSHIP",
    blocking: true,
    initialStatus: "NOT_STARTED",
  },
  {
    phase: "P4_ACFS",
    code: "EHRC_DUE_DILIGENCE",
    titleEn: "Human-rights due-diligence report (EHRC-engaged)",
    titleAm: "የሰብዓዊ መብት ጥንቃቄ ሪፖርት (ከኢቲአርሲ ጋር)",
    detailEn:
      "A published human-rights due-diligence report with Ethiopian Human Rights Commission engagement — required BEFORE any ACFS deployment to keep the university affiliation and development funding credible.",
    detailAm:
      "ከኢትዮጵያ የሰብዓዊ መብት ኮሚሽን ተሳትፎ የታተመ የሰብዓዊ መብት ጥንቃቄ ሪፖርት — ከአካዳሚክ አገልግሎትና የዕድገት ድጋፍ አክብሮት ለመጠበቅ ከማንኛውም ACFS አቅርቦት በፊት ያስፈልጋል።",
    category: "HUMAN_RIGHTS",
    blocking: true,
    initialStatus: "NOT_STARTED",
  },
  {
    phase: "P4_ACFS",
    code: "TRANSPARENCY_FRAMEWORK",
    titleEn: "Transparency framework adopted verbatim",
    titleAm: "የግልጽነት ማዕቀፍ ቃል በቃል ተቀብሏል",
    detailEn:
      "The proposal's own transparency framework adopted verbatim: appeal tiers, judicial oversight, quarterly independent audit, and 90-day data-retention limits.",
    detailAm:
      "የጥናቱ የግልጽነት ማዕቀፍ ቃል በቃል መቀበል፦ የክርክር ደረጃዎች፣ የፍርድ ቤት ቁጥጥር፣ የሩብ ዓመት ገለልተኛ ኦዲት፣ እና 90-ቀን የውሂብ ጊዜ ገደብ።",
    category: "LEGAL",
    blocking: true,
    initialStatus: "NOT_STARTED",
  },
  {
    phase: "P4_ACFS",
    code: "DEDICATED_FUNDING",
    titleEn: "Dedicated institutional funding",
    titleAm: "የተመደበ ተቋማዊ ገንዘብ",
    detailEn:
      "Dedicated institutional funding committed for the filtering programme — never funded from Track A (commercial core) revenue until that track is profitable.",
    detailAm:
      "ለማጣሪያ ፕሮግራሙ የተመደበ ተቋማዊ ገንዘብ — Track A (ንግድ ልማት) ገቢ ትርፋማ እስኪሆን ድረስ ለዚህ ግብዓት መሆን የለበትም።",
    category: "FUNDING",
    blocking: true,
    initialStatus: "NOT_STARTED",
  },
  {
    phase: "P5_CII",
    code: "OPERATOR_MOUS",
    titleEn: "≥2 CII operator MOUs",
    titleAm: "ቢያንስ 2 የCII ኦፕሬተር የግንኙነት ውሎች",
    detailEn:
      "Memoranda of understanding with at least two of the four operators named in the proposal: Ethiopian Electric Power, Ethiopian Airlines, Ethio Telecom, CBE.",
    detailAm:
      "በጥናቱ ከተጠቀሱት አራት ኦፕሬተሮች (ኢትዮጵያ ኤሌክትሪክ ኃይል፣ ኢትዮጵያ አየር መንገድ፣ ኢትዮ ቴሌኮም፣ ሲቢኢ) ቢያንስ ሁለት ጋር የግንኙነት ውሎች።",
    category: "PARTNERSHIP",
    blocking: true,
    initialStatus: "NOT_STARTED",
  },
  {
    phase: "P5_CII",
    code: "INSA_AUTHORISATION",
    titleEn: "Confirmed INSA authorisation",
    titleAm: "የተረጋገጠ የኢንሳ ፈቃድ",
    detailEn:
      "Written confirmation of the authorisation pathway for private-sector CII monitoring (INSA + legal counsel) — sought early per roadmap risk R3.",
    detailAm:
      "ለግል ዘርፍ CII ክትትል የፈቃድ መንገድ የጽሑፍ ማረጋገጫ (ኢንሳ + ሕግ ባለሙያ) — በስጋት R3 መሠረት በቅድመ-ቅደም ይፈለጋል።",
    category: "LEGAL",
    blocking: true,
    initialStatus: "NOT_STARTED",
  },
  {
    phase: "P5_CII",
    code: "IEC_62443_DESIGN",
    titleEn: "IEC 62443-aligned design",
    titleAm: "የIEC 62443 መሠረት ዲዛይን",
    detailEn:
      "The CII monitoring design aligned to IEC 62443 (industrial control system security) and approved before any pilot with operators begins.",
    detailAm:
      "የCII ክትትል ዲዛይን በIEC 62443 (የኢንዱስትሪ ቁጥጥር ሥርዓት ደህንነት) የተገጠመ እና ከኦፕሬተሮች ሙከራ በፊት የተገመገመ።",
    category: "DESIGN",
    blocking: true,
    initialStatus: "NOT_STARTED",
  },
  {
    phase: "P5_CII",
    code: "LIABILITY_INSURANCE",
    titleEn: "Liability insurance in place",
    titleAm: "የኃላፊነት መድን ተዘጋጅቷል",
    detailEn:
      "Professional indemnity / liability insurance covering CII monitoring operations — the roadmap places the CII pilot under dedicated institutional funding with insurance in place.",
    detailAm:
      "የCII ክትትል ክንውኖችን የሚሸፍን የሙያ ኃላፊነት መድን — መንገዱ ማስቀመጫ የCII ሙከራን በተመደበ ገንዘብና በመድን ላይ ያደርገዋል።",
    category: "INSURANCE",
    blocking: true,
    initialStatus: "NOT_STARTED",
  },
];

export interface PhaseReadiness {
  phase: GatePhase;
  total: number;
  satisfied: number;
  inProgress: number;
  blocked: number;
  readinessPct: number;
  open: boolean; // true = every blocking criterion SATISFIED → phase gate OPEN
  deploymentAllowed: boolean; // alias of open — the enforcement read
}

export function phaseReadiness(
  phase: GatePhase,
  criteria: { status: string; blocking: boolean }[]
): PhaseReadiness {
  const blocking = criteria.filter((c) => c.blocking);
  const satisfied = blocking.filter((c) => c.status === "SATISFIED").length;
  const open = blocking.length > 0 && satisfied === blocking.length;
  return {
    phase,
    total: criteria.length,
    satisfied,
    inProgress: criteria.filter((c) => c.status === "IN_PROGRESS").length,
    blocked: criteria.filter((c) => c.status === "BLOCKED").length,
    readinessPct: blocking.length ? Math.round((satisfied / blocking.length) * 100) : 0,
    open,
    deploymentAllowed: open,
  };
}
