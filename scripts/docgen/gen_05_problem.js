/** 05 Problem & Solution — the Ethiopian market problem, quantified + solution mapping. */
const C = require("./common.js");
const fs = require("fs");

const cover = C.buildCoverR1({
  title: "The Ethiopian Cybersecurity Gap",
  subtitle: "Problem and solution: securing a digitising financial sector with locally-built, bilingual tooling",
  englishLabel: "PROBLEM AND SOLUTION",
  metaLines: [
    "Venture: Adwa Sec",
    "Authors: Solomon Asalif & Zelalem Tsegaye, Founders",
    "Date: November 2026",
    "Audience: Startup incubation programme reviewers",
  ],
  footerLeft: "Adwa Sec — Startup Application Package",
  footerRight: "Confidential",
  palette: C.P,
});

const CH = "/home/z/my-project/scripts/docgen/charts";
const body = [
  C.h1("1. Executive Summary"),
  C.para("Ethiopia's financial sector is digitising at extraordinary speed while its defensive capacity lags years behind. The result is a measurable, regulated and growing cybersecurity gap: financial services suffer the largest share of the country's reported incidents, digital-fraud losses reached a reported ETB 1.3 billion in 2024, and new personal-data and central-bank rules now impose obligations that institutions have no affordable, local means of meeting. Adwa Sec exists to close this gap with a bilingual cybersecurity platform and accompanying services built in Ethiopia, priced for the Ethiopian market. This document sets out the evidence for the problem, its root causes, and how each cause is addressed by a specific, already-implemented platform capability."),
  C.h1("2. The Problem, Quantified"),
  C.h2("2.1 Attackers are concentrating on the financial sector"),
  C.para("Threat-landscape reporting derived from INSA data for 2026 attributes 41 percent of reported Ethiopian incidents to financial services — the largest share of any sector, ahead of government (22 percent) and telecommunications (14 percent). The dominant initial-access vectors are human: phishing accounts for 56 percent of incidents, credential stuffing 19 percent, exploitation of public-facing applications 12 percent and insider misuse 6 percent. INTERPOL's Africa Cyberthreat Assessment 2025 placed Ethiopia first globally for malware detections in 2024, and the ITU Global Cybersecurity Index 2024 places the country in Tier 3 — the tier signalling the least-developed cyber capacity."),
  ...C.figure(`${CH}/chart_incident_share.png`, "Figure 1: Reported Ethiopian incidents by sector — financial services lead (INSA-derived threat-landscape reporting, 2026)", 460),
  ...C.figure(`${CH}/chart_access_vectors.png`, "Figure 2: Initial-access vectors — phishing and credential abuse dominate, which is precisely what awareness and identity tooling address", 460),
  C.h2("2.2 The losses are already material"),
  C.para("Reported digital-fraud losses in 2024 reached ETB 1.3 billion, and the same year saw a major service disruption at the Commercial Bank of Ethiopia — the country's largest bank. Roughly eight billion digital transactions worth over ETB 34 trillion were processed in the 2025/26 fiscal year, so the attack surface continues to expand faster than the controls around it. A 2026 financial-inclusion assessment cited in the Ethiopian press found a 60 percent implementation deficit in digital-fraud countermeasures, linked to weaknesses in the legal framework and consumer-safety mechanisms."),
  C.h2("2.3 Compliance pressure is now legally binding"),
  C.para("Three regulatory instruments define the obligation stack. First, the Personal Data Protection Proclamation No. 1321/2024: 47 obligations, with penalties of up to 4 percent of global turnover and imprisonment for responsible executives. Second, National Bank of Ethiopia directives — SBB/83/2022 on IT risk and the NBE/NCB/S/02/2026/27 tender framework through which the central bank is currently procuring vulnerability-assessment and penetration-testing services (LOT 4). Third, national policy: the National Cybersecurity Policy 2024 and Digital Ethiopia 2030 both call for local cyber capacity. Meeting the first instrument alone typically consumes a 40–80 specialist-hour manual audit per institution — repeated periodically, delivered in English, by foreign or diaspora consultants at rates most Ethiopian institutions cannot sustain."),
  C.h2("2.4 The market is growing into this gap"),
  C.para("Ethiopia's cybersecurity market was valued at USD 361.1 million in 2025 and is projected to reach USD 746.6 million by 2034 (IMARC Group, 8.16 percent CAGR). Demand is being created by regulation and by losses, not by discretionary IT budgets — which means it is recession-resistant and concentrated in exactly the institutions Adwa Sec targets: NBE-regulated banks, microfinance institutions and payment institutions."),
  C.h1("3. Root Causes"),
  C.para("The gap is not a single failure; it is four compounding constraints, each of which blocks a different part of the remedy."),
  ...C.dataTable({
    headers: ["Root cause", "Consequence", "Evidence"],
    widths: [30, 45, 25],
    caption: "Table 1: Four root causes of the Ethiopian cybersecurity gap",
    rows: [
      ["Scarce, expensive specialists", "No domestic capacity to run continuous security operations; foreign consultants charge international rates for episodic visits", "ISC2 2025 workforce study records sustained global skills shortages; Ethiopian SOC-as-a-service demand is explicitly driven by the qualified-professional shortage"],
      ["Tooling priced for foreign budgets", "International platforms are licensed in USD at prices that exclude most Ethiopian institutions", "Ethiopian market reports note security-services demand concentrated in institutions that can only afford episodic engagement"],
      ["Language barrier", "Policy, awareness and reporting delivered only in English reach a fraction of staff and customers", "Amharic is the working language; security awareness content in Amharic is effectively absent from commercial tooling"],
      ["Evidence burden", "Obligations demand provable, timestamped compliance evidence that manual processes cannot produce consistently", "Proclamation 1321/2024 and NBE directives require documented corrective-action cycles with deadlines"],
    ],
  }),
  C.h1("4. The Solution, Mapped Cause-by-Cause"),
  C.para("Adwa Sec's answer is a bilingual platform that converts obligations and attacks into the same managed queue — plus human services where regulators require professional judgment. Every capability listed below is implemented and running in the current MVP, verified by an automated test battery of 766 checks."),
  ...C.dataTable({
    headers: ["Root cause", "Adwa Sec capability (implemented)", "Effect"],
    widths: [22, 48, 30],
    caption: "Table 2: Solution mapping — each root cause answered by a shipping capability",
    rows: [
      ["Scarce specialists", "SOC/CERT module: NIST SP 800-61 incident lifecycle, alert prioritisation, automated containment, threat-intel sharing with Ethio-CERT synchronisation; one analyst covers what a roster did", "Continuous coverage without a 12-person SOC; sub-15-minute notification-latency target per incident"],
      ["Foreign pricing", "Local platform subscription at ETB 1.8M/year (bank tier) — a fraction of the cost of a single foreign consultancy engagement, amortised over every obligation it automates", "A 40–80 hour manual audit becomes a continuously updated, evidence-backed assessment"],
      ["Language barrier", "Amharic-first awareness curriculum (8 bilingual units, 32 quiz items), bilingual UI and executive PDF reports, bilingual node-and-edge annotations on attack-path graphs", "Staff and customers receive safety training in the language they actually use"],
      ["Evidence burden", "Machine-readable catalogues of the 47 Proclamation 1321/2024 obligations and 30 NBE SBB/83/2022 obligations; SHA-256-anchored evidence vault; severity-based remediation SLAs (30/60/90 days) with on-time/late proof; full audit trail", "Regulator-ready evidence produced as a by-product of normal operation, not as a quarterly scramble"],
      ["Attacker technique", "VAPT Center with live OWASP-aligned web/API scanning, CVSS+EPSS+CISA-KEV prioritisation (P1–P4), and BloodHound-style AD attack-path analysis (12 computed multi-hop paths in the reference topology; chokepoint identification)", "Vulnerabilities ranked by real exploitation risk; lateral-movement routes fixed before they are walked"],
    ],
  }),
  C.h1("5. Why Now"),
  C.para("Four clocks have converged. The regulation clock: Proclamation 1321/2024 and the NBE tender framework are in force now, and enforcement capacity is being built. The loss clock: fraud losses and service disruptions have made boards receptive in a way awareness campaigns never did. The market clock: at 8.16 percent CAGR the domestic cybersecurity market doubles within the decade. The capability clock: for the first time there is a local, working platform to point at — built in Ethiopia, priced in Ethiopian terms, and already responding to a real NBE tender."),
  C.h1("6. Expected Outcomes"),
  C.para("For customers, the operating target is a reduction of audit preparation time from 40–80 specialist hours to under 24 platform hours, remediation tracked against regulator-aligned SLAs, and incident notification inside 15 minutes. For the country, each subscribing institution represents cybersecurity spend kept on Ethiopian soil, skills trained locally (including through the Bahir Dar University intern pipeline), and Amharic-language safety capacity that currently does not exist commercially. For the venture, the same work supports a planned ETB 44.6M annual revenue by 2029 across 28 subscribing institutions — the commercial engine that makes the impact durable."),
  C.h1("7. Sources"),
  C.para("Figures cited in this document are drawn from: IMARC Group, Ethiopia Cybersecurity Market report (imarcgroup.com); UT Solutions, Ethiopia Cyber Threat Landscape 2026, INSA-derived incident statistics (utsolutionsplc.com); The Reporter Ethiopia, 'High Digital Transaction Costs, Fraud Gaps Threaten Ethiopia's Financial Inclusion Targets' (October 2026, Sara Solomon); INTERPOL Africa Cyberthreat Assessment 2025; ITU Global Cybersecurity Index 2024; ISC2 Cybersecurity Workforce Study 2025; the Personal Data Protection Proclamation No. 1321/2024 and NBE directives and tender NBE/NCB/S/02/2026/27; and the Adwa Sec platform's own verified implementation record."),
];

const doc = C.makeDoc({ cover, toc: C.tocBlock(), body, headerTitle: "Adwa Sec — Problem and Solution" });
C.docx.Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync("/home/z/my-project/download/AdwaSec_05_Problem_and_Solution.docx", buf);
  console.log("written: AdwaSec_05_Problem_and_Solution.docx");
});
