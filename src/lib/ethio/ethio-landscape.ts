/**
 * Adwa Cyber — Ethiopian cyber landscape: bundled REAL national facts.
 * ---------------------------------------------------------------------
 * Every item below was captured from a live public source during the
 * real-data integration (2026-11-19) and carries its source URL. Items are
 * factual claims of the named institutions — none is invented demo data.
 * Amharic renderings of source content are the platform's own translations
 * and are marked as such where relevant.
 *
 * Sources (opened and verified on 2026-11-19):
 *   https://www.ethiocert.gov.et            hotline 933 · ethiocert@insa.gov.et
 *   https://www.ethiocert.gov.et/advisories public advisories section
 *   https://www.insa.gov.et                  INSA home: news, services, products
 *   https://nbe.gov.et/files/cyber-security-awareness
 *   https://www.imarcgroup.com/ethiopia-cyber-threat-intelligence-market
 *   public coverage of the INSA data tracker (6,700+ attacks, 2023)
 */

// ── Ethio-CERT official contact & mandate (ethiocert.gov.et) ───────────────

export const ETHIOCERT_CONTACT = {
  nameEn: "Ethio-CERT (Ethiopian Computer Emergency Response Team)",
  nameAm: "ኢትዮ-CERT (የኢትዮጵያ የኮምፒውተር አስቸኳይ ምላሽ ቡድን)",
  hotline: "933",
  email: "ethiocert@insa.gov.et",
  website: "https://www.ethiocert.gov.et",
  established: "2012-01-01",
  parentAuthorityEn: "INSA — Information Network Security Administration",
  parentAuthorityAm: "ኢንሳ — የመረጃ አውታረ መረጃ ደህንነት አስተዳደር",
  sourceUrl: "https://www.ethiocert.gov.et",
} as const;

export const ETHIOCERT_SERVICES: { nameEn: string; nameAm: string }[] = [
  { nameEn: "Cyber Incident Response", nameAm: "የሳይበር ጥቃት አስቸኳይ ምላሽ" },
  { nameEn: "Cyber Threat Analysis", nameAm: "የሳይበር ወንበር ትንተና" },
  { nameEn: "SOC-as-a-Service (Security Operations Center)", nameAm: "የሳው አገልግሎት (SOC-as-a-Service)" },
  { nameEn: "Pro-Active Vulnerability Analysis", nameAm: "አስቀድሞ የሚደረግ የተለይነት ትንተና" },
];

// ── INSA national posture facts (insa.gov.et + public reporting) ──────────

export interface LandscapeFact {
  id: string;
  labelEn: string;
  labelAm: string;
  valueEn: string;
  valueAm: string;
  detailEn?: string;
  provenance: "official-site" | "official-reporting-via-press" | "independent-analysis";
  sourceName: string;
  sourceUrl: string;
  asOf: string;
}

export const INSA_STATS: LandscapeFact[] = [
  {
    id: "insa-attacks-2023",
    labelEn: "Cyberattacks thwarted by INSA in 2023",
    labelAm: "በ2023 በኢንሳ የተገተሙ የሳይበር ጥቃቶች",
    valueEn: "6,700+",
    valueAm: "ከ6,700 በላይ",
    detailEn: "INSA reported thwarting more than 6,700 attacks in 2023 — the country's attack volume grew from only a handful in 2010 (INSA data tracker, as covered by the Ethiopian technology press, Feb 2026).",
    provenance: "official-reporting-via-press",
    sourceName: "INSA data tracker (public coverage)",
    sourceUrl: "https://www.insa.gov.et",
    asOf: "2026-11-19",
  },
  {
    id: "insa-24-7-csoc",
    labelEn: "National Cybersecurity Operations Center",
    labelAm: "ብሔራዊ የሳይበር ደህንነት ማዕከል",
    valueEn: "24/7",
    valueAm: "24/7",
    detailEn: "INSA operates the National CSOC around the clock, monitoring and responding to threats against critical national infrastructures, government networks and sensitive data.",
    provenance: "official-site",
    sourceName: "INSA",
    sourceUrl: "https://www.insa.gov.et",
    asOf: "2026-11-19",
  },
  {
    id: "insa-cyber-month-7",
    labelEn: "National Cybersecurity Month (7th)",
    labelAm: "ብሔራዊ የሳይበር ደህንነት ወር (7ኛ)",
    valueEn: "Nov 2026",
    valueAm: "ኖቬምበር 2026",
    detailEn: "The 7th National Cybersecurity Month was announced by INSA leadership in November 2026, together with a press briefing on the Critical Infrastructure Cybersecurity Proclamation.",
    provenance: "official-site",
    sourceName: "INSA",
    sourceUrl: "https://www.insa.gov.et",
    asOf: "2026-11-19",
  },
  {
    id: "insa-fins-sector-forum",
    labelEn: "Financial Sector Cybersecurity Forum",
    labelAm: "የፋይናንስ ዘርፍ የሳይበር ደህንነት መድረክ",
    valueEn: "Launched",
    valueAm: "ተመርቋል",
    detailEn: "The Financial Sector Cybersecurity Forum was officially launched during the second Ethiopian Finance event (Nov 2026) — the national coordination venue for NBE-member institutions.",
    provenance: "official-site",
    sourceName: "INSA",
    sourceUrl: "https://www.insa.gov.et",
    asOf: "2026-11-19",
  },
  {
    id: "insa-established",
    labelEn: "INSA established",
    labelAm: "ኢንሳ የተመሰረተበት",
    valueEn: "2007 · Reg. 130/2007",
    valueAm: "2007 · ደንብ ቁ. 130/2007",
    detailEn: "The Information Network Security Administration was established by Council of Ministers Regulation No. 130/2007 to protect national information infrastructure and interests.",
    provenance: "official-site",
    sourceName: "INSA",
    sourceUrl: "https://www.insa.gov.et",
    asOf: "2026-11-19",
  },
];

// ── INSA cyber-awareness tips (titles from insa.gov.et; Amharic ours) ──────

export const INSA_AWARENESS_TIPS: { id: string; titleEn: string; titleAm: string; sourceUrl: string }[] = [
  { id: "insa-tip-1", titleEn: "Use Strong, Unique Passwords", titleAm: "ጠንካራ እና ልዩ የጥበብ ቃላት ይጠቀሙ", sourceUrl: "https://www.insa.gov.et" },
  { id: "insa-tip-2", titleEn: "Enable Two-Factor Authentication (2FA)", titleAm: "ሁለት-ደረጃ ማረጋገጫ (2FA) ያንቁ", sourceUrl: "https://www.insa.gov.et" },
  { id: "insa-tip-3", titleEn: "Keep Software and Devices Updated", titleAm: "ሶፍትዌሮችን እና መሣሪያዎችን ያዘምኑ", sourceUrl: "https://www.insa.gov.et" },
  { id: "insa-tip-4", titleEn: "Use Disposable Email Addresses for Sign-Ups", titleAm: "ለምዝገባ የሚጠፋ ኢሜይል አድራሻ ይጠቀሙ", sourceUrl: "https://www.insa.gov.et" },
  { id: "insa-tip-5", titleEn: "Beware of Deepfake Scams", titleAm: "ከዲፍበክ ማታለያዎች ይጠንቀቁ", sourceUrl: "https://www.insa.gov.et" },
  { id: "insa-tip-6", titleEn: "Spot Sneaky Social Engineering Tricks", titleAm: "የማስታለያ ማስተናገጃ ብልሃቶችን ይለዩ", sourceUrl: "https://www.insa.gov.et" },
];

// ── INSA national product portfolio (insa.gov.et) ──────────────────────────

export const INSA_PRODUCTS: { name: string; categoryEn: string }[] = [
  { name: "Gasha WAF", categoryEn: "Web Application Firewall" },
  { name: "Gasha VPN", categoryEn: "Secure remote access" },
  { name: "Gasha Anti-Virus", categoryEn: "Endpoint protection" },
  { name: "Enyuma IAM", categoryEn: "Identity & access management" },
  { name: "Debo", categoryEn: "National security platform" },
  { name: "Derash", categoryEn: "Public-service platform" },
  { name: "Niser SIM", categoryEn: "Subscriber identity security" },
  { name: "Sirkuni", categoryEn: "National security service" },
  { name: "Erga", categoryEn: "National security service" },
];

// ── NBE / financial-sector context (nbe.gov.et + directive coverage) ───────

export const NBE_ITEMS: LandscapeFact[] = [
  {
    id: "nbe-cyber-awareness",
    labelEn: "NBE cyber-security awareness",
    labelAm: "የኤንቢኢ የሳይበር ደህንነት ግንዛቤ",
    valueEn: "Official guidance",
    valueAm: "ይፋዊ መመሪያ",
    detailEn: "The National Bank of Ethiopia publishes official cyber-security awareness material for the financial sector (nbe.gov.et).",
    provenance: "official-site",
    sourceName: "National Bank of Ethiopia",
    sourceUrl: "https://nbe.gov.et/files/cyber-security-awareness",
    asOf: "2026-11-19",
  },
  {
    id: "nbe-sbb-96-2025",
    labelEn: "Banking licence directive",
    labelAm: "የባንክ ፈቃድ ደንብ",
    valueEn: "SBB/96/2025",
    valueAm: "SBB/96/2025",
    detailEn: "NBE Directive SBB/96/2025 (Requirements for Licensing and Renewal of Banking Business) replaces SBB/27/2001 and reshapes foreign-bank entry; existing banks must meet the new capital threshold by 30 June 2026.",
    provenance: "official-reporting-via-press",
    sourceName: "National Bank of Ethiopia (directive)",
    sourceUrl: "https://nbe.gov.et",
    asOf: "2026-11-19",
  },
  {
    id: "nbe-foreign-banks",
    labelEn: "Financial-sector opening",
    labelAm: "የፋይናንስ ዘርፍ መክፈት",
    valueEn: "Foreign banks admitted",
    valueAm: "የውጭ ባንኮች ገብተዋል",
    detailEn: "Ethiopia opened its financial sector to foreign banks under the new NBE framework — licensing fee ETB 600,000, investigation fee ETB 200,000 — expanding the supervisory perimeter the platform serves.",
    provenance: "official-reporting-via-press",
    sourceName: "NBE directive coverage (Ethiopian press, Nov 2025)",
    sourceUrl: "https://nbe.gov.et",
    asOf: "2026-11-19",
  },
];

// ── Market context (independent analysis) ─────────────────────────────────

export const ETHIO_MARKET: LandscapeFact[] = [
  {
    id: "ethio-cti-market",
    labelEn: "Ethiopia cyber-threat-intelligence market",
    labelAm: "የኢትዮጵያ የሳይበር ወንበር አሳሳቢ ገበያ",
    valueEn: "USD 3.21M (2025) → 37.67M (2034)",
    valueAm: "3.21 ሚሊዮን ዶላር (2025) → 37.67 ሚሊዮን (2034)",
    detailEn: "Independent sizing (IMARC Group): Ethiopia's CTI market reached USD 3.21M in 2025 and is projected at USD 37.67M by 2034 — a 31.46% CAGR (2026–2034), the demand curve this platform addresses.",
    provenance: "independent-analysis",
    sourceName: "IMARC Group",
    sourceUrl: "https://www.imarcgroup.com/ethiopia-cyber-threat-intelligence-market",
    asOf: "2026-11-19",
  },
];
