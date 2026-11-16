/** 02 Startup Concept Note — 2-3 body pages, cover R1, no TOC. */
const C = require("./common.js");
const { Paragraph, TextRun } = C.docx;
const fs = require("fs");
const N = JSON.parse(fs.readFileSync("/adwa/scripts/docgen/numbers.json", "utf8"));

const F = C.EN_FONT;
const cover = C.buildCoverR1({
  title: "Adwa Sec — Startup Concept Note",
  subtitle: "Bilingual cybersecurity platform and services for Ethiopia's regulated financial sector",
  englishLabel: "STARTUP APPLICATION",
  metaLines: [
    "Founders: Solomon Asalif (Founder & CEO) · Zelalem Tsegaaye (Co-founder & CTO)",
    "Venture: Adwa Sec (unregistered — PLC formation planned Q1 2027)",
    "Prepared for: Startup incubation programme",
    "Date: November 2026",
  ],
  footerLeft: "Adwa Sec — Startup Application Package",
  footerRight: "Confidential",
  palette: C.P,
});

const body = [
  C.h1("1. The Idea"),
  C.para("Adwa Sec is a cybersecurity venture, founded in Addis Ababa, that builds and operates the security software Ethiopia's banks and microfinance institutions are now being required to use. Its platform automates three things these institutions must do but cannot yet afford to do well: prove compliance with data-protection and central-bank obligations, find and fix technical vulnerabilities before attackers do, and detect and respond to security incidents — all in working practice delivered bilingually in English and Amharic. Around the platform, Adwa Sec sells the human services regulators and tender processes still demand: penetration-testing engagements, compliance evidence packs and security-awareness training. The venture grows out of the Adwa Cyber Research Lab at Bahir Dar University and is led by two founders: Solomon Asalif (Founder & CEO) and Zelalem Tsegaaye (Co-founder & CTO)."),
  C.h1("2. The Problem"),
  C.para("Ethiopia's financial sector is digitising faster than it is defending itself. Roughly eight billion digital transactions worth over ETB 34 trillion were processed in the 2025/26 fiscal year, yet a 2026 financial-inclusion assessment found a 60 percent implementation deficit in digital-fraud countermeasures. Reported digital-fraud losses reached ETB 1.3 billion in 2024, the same year a major service disruption hit the Commercial Bank of Ethiopia. According to INSA-derived threat-landscape reporting, financial services accounted for 41 percent of recorded incidents — the largest share of any sector — with phishing the dominant entry vector. Globally, INTERPOL's Africa Cyberthreat Assessment 2025 placed Ethiopia first in the world for malware detections in 2024, and the ITU Global Cybersecurity Index 2024 ranks the country in its lower tier."),
  C.para("Compliance pressure is rising just as fast. The Personal Data Protection Proclamation No. 1321/2024 imposes 47 obligations with penalties up to 4 percent of global turnover and personal criminal liability for executives, and National Bank of Ethiopia directives (including SBB/83/2022 and the NBE/NCB/S/02/2026/27 LOT4 security-services tender framework) demand documented vulnerability assessment, remediation SLAs and incident-response capability. Today a bank typically proves the first of these with a manual audit of 40–80 specialist hours, in English, using foreign consultants whose engagements cost more than most Ethiopian institutions' annual security tooling budgets. There is no locally-built platform that turns these legal obligations into working software."),
  C.h1("3. The Solution"),
  C.para("Adwa Sec's platform is that software — and it already exists. The two founders have built and verified a working MVP covering the full chain from legal obligation to technical fix:"),
  ...C.dataTable({
    headers: ["Module", "What it does"],
    widths: [30, 70],
    caption: "Table 1: The five platform modules (all implemented in the MVP)",
    rows: [
      ["Compliance engine", "Machine-readable catalogues of the 47 obligations of Proclamation 1321/2024 and 30 obligations of NBE SBB/83/2022; pillar-weighted scoring, findings workflow, severity-based remediation SLAs (30/60/90 days), tamper-evident evidence vault, bilingual executive PDF reports."],
      ["VAPT Center", "Attack-surface registry (incl. shadow-IT discovery), live OWASP-aligned web/API scanning with proof bundles, CVSS+EPSS+CISA-KEV dynamic risk prioritisation (P1–P4), remediation queue — built to the NBE LOT4 tender specification."],
      ["AD Attack Paths", "BloodHound-style multi-hop Active Directory analysis: breach-to-domain-admin path enumeration, chokepoint identification, tier-0 exposure, bilingual remediation guidance."],
      ["SOC / CERT service", "NIST SP 800-61 incident lifecycle, threat-intelligence sharing, Ethio-CERT synchronisation with cryptographic proof receipts, sub-15-minute notification-latency target."],
      ["Awareness platform", "Amharic-first cyber-safety curriculum (8 bilingual units, 32 quiz items) with pseudonymised minors handling and parental-consent register, designed for school pilots."],
    ],
  }),
  C.para("Every module is bilingual, multi-tenant, role-scoped and audited; the whole system carries 766 automated checks across a CI-enforced test battery, and simulated components are honestly labelled rather than presented as live coverage. Services layer on top: penetration-test engagements, compliance evidence preparation aligned to NBE tenders, and awareness training delivered by the same platform."),
  C.h1("4. Market and Business Model"),
  C.para("Ethiopia's cybersecurity market was valued at USD 361.1 million in 2025 and is projected to reach USD 746.6 million by 2034 (IMARC, CAGR 8.16 percent). Adwa Sec targets the segment where regulation, budget and pain intersect first: the 31 commercial banks and 59 microfinance institutions licensed by the NBE at June 2025. Revenue is hybrid: recurring platform subscriptions (ETB 1.8M/year bank tier, ETB 540K/year MFI tier), project-based VAPT engagements (ETB 450K), monthly SOC/CERT retainers (ETB 150K/month) and awareness training engagements. The three-year plan reaches 28 subscribing institutions and ETB 44.6M annual revenue by 2029, with monthly run-rate break-even in late 2028. These figures are calculated, not estimated: every input is anchored to current cited data — the NBE indicative exchange rate of ETB 160.93/USD (12 November 2026), levels.fyi salary benchmarks for Addis Ababa, NBE institution counts, IMARC market sizing and current global service-price benchmarks — and each year's revenue equals five lines of arithmetic on those prices and a bottom-up count of institutions; the 2029 target is 0.056 percent of the projected market."),
  C.h1("5. Where the Venture Stands"),
  C.para("The engineering risk has already been retired: the MVP is built, tested and documented, including a complete 66-line capability response to the NBE LOT4 tender with per-line evidence pointers. The remaining work is institutional — company registration (a PLC is planned for Q1 2027), technology-transfer agreement with Bahir Dar University, regulator engagement with INSA, and conversion of named pilot interest (Commercial Bank of Ethiopia, Dashen Bank and three microfinance institutions identified in the venture's roadmap) into paid engagements. The founding team of two — Solomon Asalif (CEO) and Zelalem Tsegaaye (CTO) — is in place; the first three hires are planned with post-funding, reaching five staff by the end of 2027."),
  C.h1("6. The Ask"),
  C.para("Adwa Sec is seeking incubation support and an ETB 10 million (approximately USD 62,000 at the NBE's indicative rate of 12 November 2026) pre-seed investment for 18 months of runway. The ask is sized from the model, not rounded up in hope: the computed 2027–2028 cumulative net burn is ETB 5.64M, so ETB 10M covers it 1.77 times, absorbing the pre-revenue first half of 2027 and birr movement. The allocation: 40 percent product and engineering (live vulnerability feeds, live AD ingestion, production hardening), 25 percent SOC stand-up and ISO 27001 certification, 20 percent sales and pilot delivery, 10 percent legal and registration, and 5 percent working-capital buffer. What the venture offers in return is unusual at pre-seed: a working, tested product; a regulatory mapping no competitor has; and a founding pair — one founder who writes the rule engines and answers the tender, one who runs the engineering and security operations."),
  C.para("The venture's mission aligns with the National Cybersecurity Policy 2024, Digital Ethiopia 2030 and the country's trajectory in the Global Cybersecurity Index — locally built capacity that keeps cybersecurity spend, skills and data on Ethiopian soil."),
];

const doc = C.makeDoc({ cover, body, headerTitle: "Adwa Sec — Startup Concept Note" });
C.docx.Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync("/adwa/download/AdwaSec_02_Concept_Note.docx", buf);
  console.log("written: AdwaSec_02_Concept_Note.docx");
});
