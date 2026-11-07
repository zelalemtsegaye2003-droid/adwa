/**
 * Adwa Cyber — Ethio-CERT national threat feed: bundled pilot fixture.
 *
 * The proposal's Phase 2 includes an Ethio-CERT API synchronisation layer:
 * national intelligence flows DOWN to member organisations, anonymised
 * private-sector intelligence flows UP. The live binding is implemented in
 * src/lib/ethiocert-client.ts (ETHIOCERT_API_URL + ETHIOCERT_API_KEY); this
 * module is the pilot fixture used when no exchange endpoint is configured,
 * and the reference content the development exchange mock
 * (mini-services/mock-ethiocert) serves — so the full downward pipeline
 * (fetch → validate → dedupe → classify → publish to the tenant hub) is
 * exercised end-to-end without live credentials.
 *
 * Entries follow the categories documented in INTERPOL's Africa Cyberthreat
 * Assessment and INSA's national threat landscape reporting: BEC, phishing,
 * ransomware and mobile-banking malware dominate the Ethiopian financial
 * sector. Indicator values are synthetic (documentation IP ranges, plausible
 * phishing-style domains) — they are feed fixtures, not live IOCs.
 */

export interface FeedEntry {
  type: "ip" | "domain" | "url" | "hash_sha256" | "email" | "filename";
  value: string;
  titleEn: string;
  titleAm: string;
  category: string;
  severity: "critical" | "high" | "medium" | "low";
  tlp: "TLP:RED" | "TLP:AMBER" | "TLP:GREEN" | "TLP:CLEAR";
  confidence: number;
  descriptionEn?: string;
  descriptionAm?: string;
  bulletin: string; // Ethio-CERT bulletin reference
}

export const ETHIOCERT_FEED: FeedEntry[] = [
  {
    type: "domain",
    value: "cbe-secure-verify-portal.com",
    titleEn: "Bank impersonation phishing domain",
    titleAm: "የባንክ ማንነት የሚስበ የማጭበርበር ገጽ",
    category: "phishing",
    severity: "critical",
    tlp: "TLP:AMBER",
    confidence: 92,
    descriptionEn: "Look-alike domain used in SMS-borne phishing campaigns against customers of Ethiopian banks; harvests card credentials and OTPs.",
    descriptionAm: "የኢትዮጵያ ባንኮች ደንበኞችን ለመታለል በኤስኤምኤስ የሚላክ የማጭበርበር ገጽ፤ የካርድ መረጃ እና ኦቲፒ ይሰበስባል።",
    bulletin: "EC-BUL-2026-041",
  },
  {
    type: "ip",
    value: "203.0.113.66",
    titleEn: "Active credential-stuffing source",
    titleAm: "ንቁ የይለፍ ቃል መሞከሪያ ምንጭ",
    category: "credential_stuffing",
    severity: "high",
    tlp: "TLP:AMBER",
    confidence: 85,
    descriptionEn: "Distributed credential-stuffing attempts against Ethiopian online-banking login endpoints, rotating across residential proxies.",
    descriptionAm: "በመንበር ቤት ብለር ላይ በመመላለስ የመስመር ላይ ባንክ መግቢያዎችን የሚያጠቃ የይለፍ ቃል ሙከራ።",
    bulletin: "EC-BUL-2026-042",
  },
  {
    type: "hash_sha256",
    value: "9f2c4a71e8d3b5067c1a9e4f8b2d6a3c5e7f1b9d8a6c4e2f0d3b5a7c9e1f4b6d",
    titleEn: "Mobile banking trojan dropper (Fleckpe-family)",
    titleAm: "የሞባይል ባንክ ትሮጃን መስቫሽ (የፍሌክፔ ቤተሰብ)",
    category: "malware",
    severity: "critical",
    tlp: "TLP:AMBER",
    confidence: 88,
    descriptionEn: "Dropper distributed through third-party app stores; subscribes victims to premium services and overlays banking apps to steal PINs.",
    descriptionAm: "በሌሎች መተግበሪያ ሱቆች የሚሰራጭ፤ ተጠቃሚን በከፍተኛ ክፍያ አገልግሎት ያስተሳስራል እና የባንክ መተግበሪያዎችን በመሸፈን ፒን ይሰርቃል።",
    bulletin: "EC-BUL-2026-043",
  },
  {
    type: "domain",
    value: "ethiotelecom-bill-pay.online",
    titleEn: "Utility-bill phishing domain",
    titleAm: "የኤሌክትሪክ ክፍያ ማጭበርበሪያ ገጽ",
    category: "phishing",
    severity: "high",
    tlp: "TLP:GREEN",
    confidence: 78,
    descriptionEn: "Fake bill-payment portal delivered through SMS lures; collects payment-card data and national ID numbers.",
    descriptionAm: "የውሸት የክፍያ ገጽ፤ የክፍያ ካርድ መረጃ እና ቁጥር ይሰበስባል።",
    bulletin: "EC-BUL-2026-044",
  },
  {
    type: "email",
    value: "procurement-ethiopian-airports.net@mail.cf",
    titleEn: "BEC sender impersonating procurement staff",
    titleAm: "የግዥ ሠራተኛ ሆኖ የሚቀርጥ የBEC ላኪ",
    category: "bec",
    severity: "high",
    tlp: "TLP:AMBER",
    confidence: 81,
    descriptionEn: "Business-email-compromise sender targeting finance departments of Ethiopian corporates with invoice-redirection lures.",
    descriptionAm: "የኢንቮይስ መቀየሪያ ማታለያ በመጠቀም የኢትዮጵያ ኩባንያዎችን የፋይናንስ ክፍሎች የሚያሳብድ።",
    bulletin: "EC-BUL-2026-045",
  },
  {
    type: "url",
    value: "hxxp://198.51.100.23/nta-update.exe",
    titleEn: "Ransomware staging URL (lockbit-style)",
    titleAm: "የራንሶምዌር ዝግጅት አድራሻ",
    category: "ransomware",
    severity: "critical",
    tlp: "TLP:RED",
    confidence: 90,
    descriptionEn: "Second-stage payload delivery for a ransomware operation targeting East-African financial institutions; defanged URL form.",
    descriptionAm: "ለምስራቅ አፍሪካ የፋይናንስ ተቋማት የሚደረግ የራንሶምዌር ጥቃት ሁለተኛ ምዕራፍ።",
    bulletin: "EC-BUL-2026-046",
  },
  {
    type: "ip",
    value: "192.0.2.140",
    titleEn: "DDoS bootstresser C2",
    titleAm: "የDDoS ጥቃት መቆጣጠሪያ",
    category: "ddos",
    severity: "medium",
    tlp: "TLP:GREEN",
    confidence: 72,
    descriptionEn: "Command endpoint observed orchestrating volumetric attacks against regional telecom and hosting providers.",
    descriptionAm: "በክልላዊ ቴሌኮም እና ሆስቲንግ አገልግሎቶች ላይ ጥቃት የሚመራ መቆጣጠሪያ አድራሻ።",
    bulletin: "EC-BUL-2026-047",
  },
  {
    type: "filename",
    value: "NBE_circular_2026_DBS-41.docm",
    titleEn: "Macro-enabled lure document impersonating NBE circular",
    titleAm: "የኤንቢኢ ዘመናዊ ሆኖ የቀረጸ ማታለያ ሰነድ",
    category: "malware",
    severity: "high",
    tlp: "TLP:AMBER",
    confidence: 83,
    descriptionEn: "Weaponised document targeting bank compliance teams; drops an information stealer on macro enablement.",
    descriptionAm: "የባንክ ቅጥ ቡድኖችን የሚያሳብድ የተበላሸ ሰነድ፤ ማክሮ ሲነቃ መረጃ ሰርቃል።",
    bulletin: "EC-BUL-2026-048",
  },
];
