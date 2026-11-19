/**
 * Adwa Cyber — ACFS gating governance engine (proposal Phase 4, Track C).
 *
 * The Advanced Content Filtering System is a DELIBERATELY GATED capability.
 * The proposal's Track C governance model requires four institutional
 * preconditions to be SATISFIED before any filtering engineering may begin:
 *
 *   1. EMA_PARTNERSHIP     — a formal partnership with the Ethiopian Media
 *                            Authority (regulator of content intermediaries).
 *   2. EHRC_DUE_DILIGENCE  — human-rights due diligence with the Ethiopian
 *                            Human Rights Commission (freedom of expression,
 *                            access to information, proportionality).
 *   3. TRANSPARENCY_FRAMEWORK — the verbatim transparency framework:
 *                            grievance tiers, judicial oversight, quarterly
 *                            independent audits, 90-day maximum retention.
 *   4. DEDICATED_FUNDING   — dedicated institutional funding that can never
 *                            be sourced from Track A commercial revenue.
 *
 * This module defines the precondition register (seeded into AcfsGateItem)
 * and the pure gate-evaluation logic used by the API layer. There is
 * intentionally NO filtering logic anywhere on this platform.
 */

export const ACFS_DOMAINS = [
  "EMA_PARTNERSHIP",
  "EHRC_DUE_DILIGENCE",
  "TRANSPARENCY_FRAMEWORK",
  "DEDICATED_FUNDING",
] as const;

export type AcfsDomain = (typeof ACFS_DOMAINS)[number];

export const ACFS_STATUSES = [
  "NOT_STARTED",
  "IN_PROGRESS",
  "EVIDENCE_SUBMITTED",
  "SATISFIED",
  "BLOCKED",
] as const;

export type AcfsStatus = (typeof ACFS_STATUSES)[number];

export interface AcfsDomainMeta {
  key: AcfsDomain;
  labelEn: string;
  labelAm: string;
  short: string;
  descriptionEn: string;
  descriptionAm: string;
}

export const ACFS_DOMAIN_META: Record<AcfsDomain, AcfsDomainMeta> = {
  EMA_PARTNERSHIP: {
    key: "EMA_PARTNERSHIP",
    labelEn: "EMA Partnership",
    labelAm: "የኢማ አጋርነት",
    short: "EMA",
    descriptionEn:
      "Formal partnership with the Ethiopian Media Authority under the Media Proclamation — regulator sign-off before any content-intermediary function is offered.",
    descriptionAm:
      "ከኢትዮጵያ መገናኛ ባለሥልጣን ጋር በመገናኛ አዋጅ ሥር የተገባ አጋርነት — ማንኛውም የይዘት በታክሲ ሥራ ከመጀመሩ በፊት የተቆጣጠሪው ስምምነት።",
  },
  EHRC_DUE_DILIGENCE: {
    key: "EHRC_DUE_DILIGENCE",
    labelEn: "EHRC Human-Rights Due Diligence",
    labelAm: "የኢኤችአርሲ የሰብዓዊ መብት ትክክለኛ ግምገማ",
    short: "EHRC",
    descriptionEn:
      "Human-rights due diligence with the Ethiopian Human Rights Commission: freedom of expression, access to information, necessity and proportionality testing.",
    descriptionAm:
      "ከኢትዮጵያ የሰብዓዊ መብቶች ኮሚሽን ጋር የሰብዓዊ መብት ትክክለኛ ግምገማ፡ የአመለካከት ነጻነት፣ የመረጃ ተደራሽነት፣ አስፈላጊነትና ልክነት ፍተሻ።",
  },
  TRANSPARENCY_FRAMEWORK: {
    key: "TRANSPARENCY_FRAMEWORK",
    labelEn: "Verbatim Transparency Framework",
    labelAm: "ቃል-በቃል ግልጽነት ሥነ-ሥርዓት",
    short: "TRANSPARENCY",
    descriptionEn:
      "The verbatim transparency framework: tiered grievance mechanism, judicial oversight of blocking decisions, quarterly independent audits, 90-day maximum retention.",
    descriptionAm:
      "ቃል-በቃል የግልጽነት ሥነ-ሥርዓት፡ ደረጃ የተሰጠው የቅሬታ ሥርዓት፣ የፍትሕ ቁጥጥር፣ በየሩብ ዓመቱ ገለልተኛ ኦዲት፣ ከፍተኛ 90 ቀናት የመያዣ ጊዜ።",
  },
  DEDICATED_FUNDING: {
    key: "DEDICATED_FUNDING",
    labelEn: "Dedicated Institutional Funding",
    labelAm: "የተመሰረተ ተቋማዊ ድጋፍ",
    short: "FUNDING",
    descriptionEn:
      "Dedicated institutional funding for Track C — constitutionally separated from Track A commercial revenue so no bank client ever funds content filtering.",
    descriptionAm:
      "ለሥር 6 የተመሰረተ ተቋማዊ ድጋፍ — ከሥር 1 ንግድዊ ገቢ ጋር ፈጽሞ የተለየ፤ ማንኛውም የባንክ ደንበኛ የይዘት ማጣሪያ እንዳይደግፍ።",
  },
};

/**
 * The precondition register — every requirement that must exist as an
 * AcfsGateItem row. Seeded by scripts/seed-trackc.cjs; the codes are stable
 * so re-seeding is idempotent (upsert by code).
 */
export const ACFS_REQUIREMENTS: {
  domain: AcfsDomain;
  code: string;
  titleEn: string;
  titleAm: string;
  description: string;
  owner: string;
  sortOrder: number;
}[] = [
  // ── 1. EMA partnership ──────────────────────────────────────────────────
  {
    domain: "EMA_PARTNERSHIP",
    code: "EMA-01",
    titleEn: "EMA partnership agreement drafted",
    titleAm: "የኢማ አጋርነት ስምምነት ረቂቅ ተዘጋጅቷል",
    description:
      "Partnership agreement with the Ethiopian Media Authority drafted and reviewed by counsel, covering the intermediary role, takedown workflow and regulator escalation path.",
    owner: "Executive Director",
    sortOrder: 10,
  },
  {
    domain: "EMA_PARTNERSHIP",
    code: "EMA-02",
    titleEn: "EMA agreement signed",
    titleAm: "የኢማ ስምምነት ተፈርሟል",
    description:
      "The partnership agreement is signed by both parties and deposited in the governance evidence vault.",
    owner: "Executive Director",
    sortOrder: 20,
  },
  {
    domain: "EMA_PARTNERSHIP",
    code: "EMA-03",
    titleEn: "EMA technical liaison appointed",
    titleAm: "የኢማ ቴክኒካል ተዋንያን ተሾምተዋል",
    description:
      "A named EMA technical liaison is appointed for takedown-request handling with defined response SLAs.",
    owner: "Head of Engineering",
    sortOrder: 30,
  },
  // ── 2. EHRC human-rights due diligence ─────────────────────────────────
  {
    domain: "EHRC_DUE_DILIGENCE",
    code: "EHRC-01",
    titleEn: "Human-rights impact assessment (HRIA) completed",
    titleAm: "የሰብዓዊ መብት ተጽዕኖ ግምገማ ተጠናቋል",
    description:
      "A full HRIA on the proposed filtering function, testing freedom of expression (FDRE Const. Art. 29), access to information and proportionality, reviewed with EHRC counsel.",
    owner: "Legal & Governance Lead",
    sortOrder: 10,
  },
  {
    domain: "EHRC_DUE_DILIGENCE",
    code: "EHRC-02",
    titleEn: "EHRC consultation minutes on record",
    titleAm: "የኢኤችአርሲ ምክክር ቃለ-ጉባኤ ተመዝግቧል",
    description:
      "Documented consultation sessions with the Ethiopian Human Rights Commission, with the Commission's observations and the platform's responses.",
    owner: "Legal & Governance Lead",
    sortOrder: 20,
  },
  {
    domain: "EHRC_DUE_DILIGENCE",
    code: "EHRC-03",
    titleEn: "EHRC remediation conditions satisfied",
    titleAm: "የኢኤችአርሲ የማስተካከያ መመሪያዎች ተሟልተዋል",
    description:
      "Every condition EHRC attached to its no-objection opinion is implemented and evidenced (e.g. category definitions, appeal rights, safeguards for journalists).",
    owner: "Legal & Governance Lead",
    sortOrder: 30,
  },
  // ── 3. Verbatim transparency framework ────────────────────────────────
  {
    domain: "TRANSPARENCY_FRAMEWORK",
    code: "TRA-01",
    titleEn: "Tiered grievance mechanism operational",
    titleAm: "ደረጃ የተሰጠው የቅሬታ ሥርዓት ሥራ ጀምሯል",
    description:
      "A working grievance mechanism with at least two tiers (internal review → independent review) and published response timelines.",
    owner: "Legal & Governance Lead",
    sortOrder: 10,
  },
  {
    domain: "TRANSPARENCY_FRAMEWORK",
    code: "TRA-02",
    titleEn: "Judicial oversight protocol agreed",
    titleAm: "የፍትሕ ቁጥጥር መከታተያ ተስማምቷል",
    description:
      "Blocking decisions are subject to judicial oversight: a protocol with the courts defining how takedown/blocking orders are challenged and reviewed.",
    owner: "Executive Director",
    sortOrder: 20,
  },
  {
    domain: "TRANSPARENCY_FRAMEWORK",
    code: "TRA-03",
    titleEn: "Quarterly independent audit contracted",
    titleAm: "በየሩብ ዓመቱ ገለልተኛ ኦዲት ተቋርቧል",
    description:
      "An independent auditor is contracted to publish quarterly transparency audits (volume, categories, appeal outcomes, error rates).",
    owner: "Audit Committee",
    sortOrder: 30,
  },
  {
    domain: "TRANSPARENCY_FRAMEWORK",
    code: "TRA-04",
    titleEn: "90-day retention limit engineered",
    titleAm: "90 ቀናት የመያዣ ገደብ ተተግብሯል",
    description:
      "The data pipeline is engineered so filtered-content metadata is purged at 90 days maximum, with the deletion job independently verified.",
    owner: "Head of Engineering",
    sortOrder: 40,
  },
  {
    domain: "TRANSPARENCY_FRAMEWORK",
    code: "TRA-05",
    titleEn: "Public transparency report published",
    titleAm: "ይፋዊ የግልጽነት ሪፖርት ታትሟል",
    description:
      "A public transparency report is published (bilingual EN/AM) disclosing request volumes, action rates and grievance outcomes.",
    owner: "Communications Lead",
    sortOrder: 50,
  },
  // ── 4. Dedicated institutional funding ────────────────────────────────
  {
    domain: "DEDICATED_FUNDING",
    code: "FND-01",
    titleEn: "Track C funding vehicle established",
    titleAm: "የሥር 6 የገንዘብ መሣሪያ ተቋቁሯል",
    description:
      "A ring-fenced funding vehicle (grant/endowment) for Track C exists in the governance charter, with a constitutional prohibition on Track A revenue.",
    owner: "Board of Directors",
    sortOrder: 10,
  },
  {
    domain: "DEDICATED_FUNDING",
    code: "FND-02",
    titleEn: "Multi-year funding commitment secured",
    titleAm: "የበርካታ ዓመታት የገንዘብ ቁርጠኝነት ተያይዟል",
    description:
      "A multi-year donor/institutional commitment covering ACFS operating costs without any contribution from commercial compliance revenue.",
    owner: "Board of Directors",
    sortOrder: 20,
  },
  {
    domain: "DEDICATED_FUNDING",
    code: "FND-03",
    titleEn: "Firewall audit shows zero Track A leakage",
    titleAm: "የገንዘብ መከላከያ ኦዲት ዜሮ መፍሰስ አሳይቷል",
    description:
      "An independent accountant's report confirms no Track A (bank compliance) revenue funds any Track C activity for the audited period.",
    owner: "Audit Committee",
    sortOrder: 30,
  },
];

// ── Gate evaluation ─────────────────────────────────────────────────────────

export interface AcfsGateItemLike {
  domain: string;
  status: string;
}

export interface AcfsDomainStatus {
  domain: AcfsDomain;
  total: number;
  satisfied: number;
  inProgress: number; // IN_PROGRESS + EVIDENCE_SUBMITTED
  blocked: number;
  notStarted: number;
  complete: boolean; // all items SATISFIED
}

export interface AcfsGateEvaluation {
  domains: AcfsDomainStatus[];
  satisfiedItems: number;
  totalItems: number;
  progressPct: number; // 0–100 rounded
  gateOpen: boolean; // every domain complete
  missingDomains: AcfsDomain[];
  verdict:
    | "LOCKED"
    | "GATE_OPEN"; // LOCKED = at least one precondition unmet
}

export function evaluateAcfsGate(items: AcfsGateItemLike[]): AcfsGateEvaluation {
  const domains: AcfsDomainStatus[] = ACFS_DOMAINS.map((d) => {
    const rows = items.filter((i) => i.domain === d);
    const satisfied = rows.filter((i) => i.status === "SATISFIED").length;
    const inProgress = rows.filter((i) => i.status === "IN_PROGRESS" || i.status === "EVIDENCE_SUBMITTED").length;
    const blocked = rows.filter((i) => i.status === "BLOCKED").length;
    const notStarted = rows.filter((i) => i.status === "NOT_STARTED").length;
    return {
      domain: d,
      total: rows.length,
      satisfied,
      inProgress,
      blocked,
      notStarted,
      complete: rows.length > 0 && satisfied === rows.length,
    };
  });

  const totalItems = items.length;
  const satisfiedItems = items.filter((i) => i.status === "SATISFIED").length;
  const missingDomains = domains.filter((d) => !d.complete).map((d) => d.domain);
  const gateOpen = totalItems > 0 && missingDomains.length === 0;

  return {
    domains,
    satisfiedItems,
    totalItems,
    progressPct: totalItems ? Math.round((satisfiedItems / totalItems) * 100) : 0,
    gateOpen,
    missingDomains,
    verdict: gateOpen ? "GATE_OPEN" : "LOCKED",
  };
}

/** Human-readable status labels (EN/AM) for a gate item status. */
export const ACFS_STATUS_LABELS: Record<AcfsStatus, [string, string]> = {
  NOT_STARTED: ["Not started", "አልተጀመረም"],
  IN_PROGRESS: ["In progress", "በሂደት ላይ"],
  EVIDENCE_SUBMITTED: ["Evidence submitted", "ማስረጃ ቀርቧል"],
  SATISFIED: ["Satisfied", "ተሟልቷል"],
  BLOCKED: ["Blocked", "ታግዷል"],
};
