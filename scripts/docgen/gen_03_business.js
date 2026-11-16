/** 03 Business Plan — full plan with TOC, charts, tables from locked numbers. */
const C = require("./common.js");
const fs = require("fs");
const N = JSON.parse(fs.readFileSync("/home/z/my-project/scripts/docgen/numbers.json", "utf8"));
const CH = "/home/z/my-project/scripts/docgen/charts";

const cover = C.buildCoverR1({
  title: "Adwa Sec — Business Plan",
  subtitle: "Bilingual cybersecurity platform and services for Ethiopia's regulated financial sector, 2027–2029",
  englishLabel: "BUSINESS PLAN",
  metaLines: [
    "Founders: Solomon Asalif (Founder & CEO) · Zelalem Tsegaaye (Co-founder & CTO)",
    "Venture: Adwa Sec (PLC registration planned Q1 2027, Addis Ababa)",
    "Prepared for: Startup incubation programme",
    "Date: November 2026",
    "Status: figures calculated bottom-up; every input anchored to cited current data",
  ],
  footerLeft: "Adwa Sec — Startup Application Package",
  footerRight: "Confidential",
  palette: C.P,
});

const M = (v) => (v / 1e6).toFixed(2);
const K = (v) => (v / 1e3).toFixed(0);
const y1 = N.y1, y2 = N.y2, y3 = N.y3;

const body = [
  C.h1("1. Executive Summary"),
  C.para("Adwa Sec is a founder-led cybersecurity venture building the platform Ethiopia's regulated financial institutions must now use to defend themselves: bilingual (English/Amharic) compliance automation against the 47 obligations of the Personal Data Protection Proclamation No. 1321/2024 and the 30 obligations of NBE SBB/83/2022, vulnerability assessment and penetration testing built to the NBE LOT4 tender specification, Active Directory attack-path analysis, SOC/CERT incident response, and Amharic-first security-awareness delivery. The platform exists today as a tested MVP — 766 automated checks green across a CI-enforced battery — and has already produced a complete 66-line capability response to a live National Bank of Ethiopia tender."),
  C.para("The venture monetises through a hybrid model: recurring platform subscriptions (banks ETB 1.8M/year; MFIs ETB 540K/year), project-based VAPT engagements (ETB 450K), monthly SOC/CERT retainers (ETB 150K/month) and awareness training (ETB 300K/engagement). The three-year plan targets 28 subscribing institutions and ETB 44.64M revenue by 2029, monthly run-rate break-even in late 2028, and a first profitable year in 2029 at ETB 9.16M pre-tax. Adwa Sec seeks ETB 10M (approximately USD 62,000 at the National Bank of Ethiopia's indicative rate of 12 November 2026) in pre-seed funding for 18 months of runway, plus incubation support for company formation, Bahir Dar University technology transfer and INSA regulatory engagement. The founding team is in place — Solomon Asalif (Founder & CEO) leads strategy, regulation and sales; Zelalem Tsegaaye (Co-founder & CTO) leads engineering and security operations — and three further hires are planned with post-funding, reaching five staff by year-end 2027."),
  C.h1("2. Company Overview"),
  C.h2("2.1 Identity and status"),
  C.para("Adwa Sec is an Addis Ababa-based cybersecurity venture emerging from the Adwa Cyber Research Lab at Bahir Dar University. It is not yet a registered company: formation of a private limited company (PLC) at the Ethiopian Commercial Register is scheduled for Q1 2027 as the first use of funds, with the two founders — Solomon Asalif and Zelalem Tsegaaye — as initial shareholders. Everything built to date will be assigned to the company at incorporation under a written IP ledger, and the Bahir Dar University relationship will be formalised through a technology-transfer and affiliation agreement covering intellectual property, student and faculty collaboration, use of institutional name and facilities, and the ethical-review pathway for research involving organisations and minors."),
  C.h2("2.2 Governance"),
  C.para("A startup selling security to banks is judged on governance as much as code. Three lightweight structures are planned for Year 1: a five-to-seven member advisory board meeting quarterly (a senior Bahir Dar University faculty member, a former bank or telecom CISO, an INSA or Ethio-CERT liaison as permitted, a technology and data-protection lawyer, and one international cyber-capacity expert); a pilot steering committee per pilot customer, which doubles as the customer-success motion; and a founder-level discipline of written minutes and decisions, maintained from day one at negligible cost."),
  C.h1("3. Market Analysis"),
  C.h2("3.1 Size and trajectory"),
  C.para("Ethiopia's cybersecurity market was valued at USD 361.1 million in 2025 and is projected to reach USD 746.6 million by 2034, an 8.16 percent compound annual growth rate (IMARC Group). Demand is driven by regulation and realised losses rather than discretionary IT budgets, making it resilient: the Personal Data Protection Proclamation No. 1321/2024 carries penalties up to 4 percent of global turnover plus executive imprisonment; the National Bank of Ethiopia is actively procuring vulnerability-assessment and penetration-testing services through its NBE/NCB/S/02/2026/27 framework (LOT 4); and reported digital-fraud losses of ETB 1.3 billion in 2024 have made boards attentive. INSA-derived reporting attributes 41 percent of the country's incidents to financial services — the largest sector share — while INTERPOL's Africa Cyberthreat Assessment 2025 places Ethiopia first globally for malware detections and the ITU Global Cybersecurity Index 2024 places it in Tier 3."),
  C.h2("3.2 Target segment"),
  C.para("Adwa Sec's beachhead is NBE-regulated banks and microfinance institutions, where compliance obligation, budget and incident pain intersect. Per the NBE Annual Report 2024/25 and the central bank's financial-stability reporting, Ethiopia's banking sector comprised 31 commercial banks (plus the Development Bank of Ethiopia) and 59 licensed microfinance institutions at June 2025 — together the immediate addressable universe for the platform's subscription tiers; digital transaction volumes of roughly eight billion transactions worth over ETB 34 trillion in the 2025/26 fiscal year create the attack surface that regulation now obliges institutions to defend. Within this segment the venture's roadmap names named-pilot candidates: the Commercial Bank of Ethiopia, Dashen Bank and three microfinance institutions — institutions whose data is already resident in the platform's reference demo (built from public tender documents and reference topologies) and whose procurement processes the founding team has already engaged through the NBE LOT4 tender response."),
  C.h2("3.3 Buyer analysis"),
  C.para("The buyer is a chief information security officer, IT risk officer or compliance officer acting under a board mandate. Their alternatives are: foreign consultancies (international rates, English-only deliverables, episodic engagements), offshore SaaS platforms (USD pricing, no Amharic, no local evidence handling) or in-house spreadsheets (40–80 specialist hours per audit cycle, no continuous coverage). Adwa Sec's offer is recurring, local, bilingual and priced at a fraction of a single foreign engagement — anchored to the penalty regime it helps avoid."),
  C.h2("3.4 Size-of-prize feasibility check"),
  C.para("The plan's revenue targets are deliberately small against the measured market. Ethiopia's cybersecurity market was USD 361.1 million in 2025 (IMARC) and is projected to grow at 8.16 percent annually; compounding that rate forward gives market sizes of approximately USD 422M (2027), USD 457M (2028) and USD 494M (2029). The plan's revenues — ETB 4.02M, 19.26M and 44.64M, equivalent to roughly USD 25K, 120K and 277K at the NBE's 12 November 2026 indicative rate of ETB 160.93/USD — represent 0.006, 0.026 and 0.056 percent of those markets respectively: even the 2029 target is less than six hundredths of one percent of a market growing under regulatory mandate. Measured against institutions rather than dollars, the 2029 year-end target of 28 subscribing institutions is 12 of the 31 commercial banks and 16 of the 59 MFIs licensed at June 2025 — 38.7 and 27.1 percent of the NBE-regulated universe, reached in a market where the NBE LOT4 tender itself is procuring exactly these capabilities sector-wide and where the plan assumes sector-wide procurement pressure, not discretionary buying. Annual subscription TAM at list prices is ETB 87.66M (31 banks x ETB 1.8M + 59 MFIs x ETB 540K); the 2029 subscription revenue of ETB 22.14M is 25.3 percent of it."),
  C.h1("4. Products and Services"),
  C.h2("4.1 Platform modules (implemented in the MVP)"),
  ...C.dataTable({
    headers: ["Module", "Capability (verified by 766 automated checks)", "Replaces"],
    widths: [24, 48, 28],
    caption: "Table 1: The five platform modules",
    rows: [
      ["Compliance engine", "47 Proclamation 1321/2024 obligations + 30 NBE SBB/83/2022 obligations as machine-readable rules; pillar-weighted scoring; findings workflow with 30/60/90-day remediation SLAs; SHA-256-anchored evidence vault; bilingual executive PDF reports", "Manual audit binders and consultancy hours"],
      ["VAPT Center", "Attack-surface registry incl. shadow-IT discovery; live OWASP-aligned non-destructive web/API scanning with proof bundles; CVSS+EPSS+CISA-KEV dynamic risk scoring (P1–P4); remediation queue; promotion of criticals into NBE-anchored corrective actions", "Foreign pentest reports on a shelf"],
      ["AD Attack Paths", "BloodHound-style multi-hop Active Directory analysis: 15-node/19-edge reference topology, BFS shortest paths, full path enumeration to 8 hops, chokepoints, tier-0 exposure, bilingual remediation guidance", "Unexamined lateral-movement routes"],
      ["SOC / CERT", "NIST SP 800-61 incident lifecycle; threat-intel hub with privacy-preserving sharing; Ethio-CERT synchronisation with SHA-256 receipts; sub-15-minute notification-latency target", "Unstaffed night-time security"],
      ["Awareness", "Amharic-first curriculum: 8 bilingual units, 32 quiz items; pseudonymised minors; parental-consent register; public learner portal", "One-off translated slide decks"],
    ],
  }),
  C.h2("4.2 Services layer"),
  C.para("Regulators and tender processes still require human judgment, and services are how a young platform proves itself. Adwa Sec delivers: VAPT engagements using its own platform as the evidence engine; compliance evidence preparation aligned to NBE tender formats (demonstrated by the 66-line LOT4 response matrix with per-line evidence pointers); and awareness training engagements built on the Amharic curriculum. Services convert to subscriptions: every engagement ends with a platform licence proposal at pilot pricing — a discount against list, never free, to protect both revenue and perceived value."),
  C.h2("4.3 Pricing"),
  ...C.dataTable({
    headers: ["Offer", "Segment", "Price (ETB)", "USD equiv.", "Benchmark anchor (current market data)"],
    widths: [22, 16, 18, 14, 30],
    caption: "Table 2: Pricing architecture — every list price anchored to a current, cited global benchmark and priced below it for the Ethiopian market; USD-indexed with annual birr-adjustment clause",
    rows: [
      ["Platform subscription", "Banks / enterprise", "1,800,000 / year", "11,185 / yr", "56% of the ~USD 20,000 median annual spend on GRC compliance platforms (Vendr procurement data)"],
      ["Platform subscription", "MFIs / mid-market", "540,000 / year", "3,354 / yr", "Small-institution tier; multi-entity regulator-ready reporting"],
      ["VAPT engagement", "All segments", "450,000 / engagement", "2,799", "56% of the USD 5,000 global floor for a web-application penetration test (2026 buyer guides: USD 5,000–30,000)"],
      ["SOC/CERT retainer", "Banks, MFIs", "150,000 / month", "932 / mo", "Below the USD 1,000/month managed-SOC entry price; monitoring tiers run USD 5–25 per endpoint/month"],
      ["Awareness training", "Corporates, NGOs", "300,000 / engagement", "1,865", "Amharic-first delivery no international vendor offers"],
    ],
    alignRight: [2, 3],
  }),
  C.h1("5. Go-to-Market Strategy"),
  C.h2("5.1 Beachhead motion"),
  C.para("The sales motion is deliberately narrow: prove the platform inside one or two anchor institutions in the first half of 2027 — converting the named pilot interest into paid, priced pilots — then let the evidence sell the rest. NBE-regulated institutions buy credibility: an anchor reference from the Commercial Bank of Ethiopia or Dashen Bank, ISO 27001 certification, and a visible regulator relationship matter more than feature lists. The founding team's completion of a real NBE LOT4 tender response (all 66 mandatory lines, evidence-linked) is the credential that opens these doors; the CSV export is shaped for the tender's own Vendor-Response form."),
  C.h2("5.2 Channels and partnerships"),
  C.para("Three channels: direct sales to banks and MFIs (founder-led in Year 1, partnerships lead from Year 2); the public-procurement channel (NBE and ministry tenders, where the bid matrix capability compounds); and a partner channel — local system integrators and the audit practices of Ethiopian accountancy firms reselling or referring the compliance module. The Bahir Dar University relationship supplies supervised interns for SOC rotations, content translation and test data at a fraction of market cost while building the talent pipeline the national mission requires."),
  C.h2("5.3 Competition and positioning"),
  ...C.dataTable({
    headers: ["Alternative", "Weakness Adwa Sec exploits", "Adwa Sec advantage"],
    widths: [26, 40, 34],
    caption: "Table 3: Competitive positioning",
    rows: [
      ["Foreign consultancies (Big-4 style)", "International day rates; English-only deliverables; episodic engagements leave no continuous coverage; no local evidence retention", "Local presence, bilingual output, continuous platform coverage at ~10–20% of engagement cost"],
      ["International SaaS (global GRC/VAPT tools)", "USD pricing excluded by most institutions; no Amharic; no Proclamation 1321/2024 or NBE rule content; data handled abroad", "Rule content for the exact Ethiopian instruments; local hosting under Article 22 data-sovereignty provisions"],
      ["In-house manual programmes", "40–80 specialist hours per audit; no SLA proof; no attack-path visibility; collapses with staff turnover", "Automated, evidence-backed, SLA-tracked; survives turnover because it is software"],
    ],
  }),
  C.para("The defensible moat is compound: rule content no competitor has (the 47+30 obligation catalogues), an evidence-integrity architecture regulators can audit (SHA-256 anchoring, append-only timelines), bilingual delivery, and a first-mover local reference base. None of these is quickly replicable by an entrant without local presence."),
  C.h1("6. Operations and Team"),
  C.h2("6.1 Founding team"),
  C.para("Two complementary founders are in place. Solomon Asalif, Founder & CEO: strategy, fundraising and anchor sales; authored the venture's proposal, roadmap and the NBE LOT4 tender response; owns the regulation and compliance-engine agenda (the 47+30 machine-readable obligation catalogues) and the university and INSA relationships — the Adwa Cyber Research Lab at Bahir Dar University is his. Zelalem Tsegaaye, Co-founder & CTO: engineering leadership for the platform and the security operations it runs — the VAPT scanning engine, the AD attack-path analysis, SOC/CERT architecture and production hardening; owns the engineering hiring plan and the CI-enforced 766-check quality discipline. The division of responsibility is written down: the CEO carries revenue, regulation and external relationships; the CTO carries architecture, delivery and the engineering bench; neither domain has a single point of failure once the first engineers are hired."),
  C.h2("6.2 Team plan"),
  ...C.dataTable({
    headers: ["Role", "Start", "Monthly (ETB)", "Responsibility"],
    widths: [32, 10, 18, 40],
    caption: "Table 4: Year 1 hiring plan (5 FTE at year-end; both founders draw from February, after grant or first revenue). Rates are anchored to the levels.fyi median software-engineer pay for Addis Ababa (ETB 55,738/month, November 2026): the ladder runs 1.25-2.5x that median, and escalates 10% per year in 2028 and 2029 against 14.6% October 2026 headline inflation",
    rows: [
      ["Founder / CEO — Solomon Asalif", "Feb", "75,000", "Strategy, fundraising, anchor sales, university and INSA relationships"],
      ["Co-founder / CTO — Zelalem Tsegaaye", "Feb", "130,000", "Platform architecture, VAPT engine, SOC stand-up, engineering hiring and quality"],
      ["Full-stack Engineer", "Jul", "90,000", "Scan engine, dashboards, rule-catalogue implementation"],
      ["SOC Analyst", "Sep", "75,000", "Pilot monitoring, triage, threat-intel operations"],
      ["Operations & Admin (PT)", "Jul", "50,000", "Finance, HR, procurement, grant reporting"],
    ],
    alignRight: [2],
  }),
  C.para("Year 2 adds a SOC manager, a second full-stack engineer, additional analysts and a partnerships lead, reaching 10 FTE; Year 3 reaches 16 FTE across engineering, SOC and sales — revenue per employee of ETB 2.79M (~USD 17.3K) in 2029, within normal bands for a services-heavy security business. Retention levers are certification sponsorship (ISO 27001 lead auditor; CISSP-equivalent path), compensation at or slightly above the 60th percentile of the local market, and a 10–15 percent employee option pool established at incorporation vesting over four years."),
  C.h2("6.3 Key-person risk"),
  C.para("The plan starts from a two-founder base rather than a solo founder, and de-risks further deliberately: the MVP already exists (the engineering risk is retired, not pending); the CTO owns architecture from day one and the CEO owns the commercial and regulatory relationships, so no single domain depends on one person; all systems and decisions are documented; the advisory board meets quarterly; and the Bahir Dar University agreement guarantees continuity of the academic relationship independently of any individual."),
  C.h1("7. Financial Plan"),
  C.para("This plan is calculated, not estimated. Every input is anchored to a current, citable source and every downstream figure is computed from those inputs in the accompanying model (AdwaSec_07_Financial_Projections.xlsx), whose assumptions sheet exposes the anchors as editable inputs."),
  C.h2("7.1 Basis of preparation"),
  ...C.dataTable({
    headers: ["Input", "Value used", "Source (current as of November 2026)"],
    widths: [26, 22, 52],
    caption: "Table 5: Every model input and its current-data anchor",
    rows: [
      ["Exchange rate", "ETB 160.93 / USD", "National Bank of Ethiopia indicative interbank rate, 12 November 2026 (nbe.gov.et/exchange)"],
      ["Market size & growth", "USD 361.1M (2025); CAGR 8.16%", "IMARC Group, Ethiopia Cybersecurity Market 2025-2034"],
      ["Buyer universe", "31 commercial banks + 59 MFIs", "NBE Annual Report 2024/25 and financial-stability reporting, June 2025"],
      ["Salary anchor", "ETB 55,738/month median", "levels.fyi, software engineers, Addis Ababa, November 2026; role ladder set at 1.25-2.5x median"],
      ["Cost escalation", "10% per year on payroll", "ESS headline inflation 14.6% (Oct 2026) — escalation planned below headline"],
      ["Pricing benchmarks", "See Table 2", "Vendr GRC-platform medians; 2026 penetration-testing, managed-SOC and ISO 27001 buyer guides"],
      ["Contingency", "10% on operating subtotals", "Standard pre-seed practice for a first operating year"],
    ],
  }),
  C.para("Revenue is commercial only — grants and university in-kind support are treated as upside, not plan. Contracts are ETB-denominated; the USD equivalents in this plan are informational at the NBE rate above, and pricing carries an annual birr-adjustment clause."),
  C.h2("7.2 Three-year summary"),
  ...C.dataTable({
    headers: ["Metric", "2027", "2028", "2029"],
    widths: [40, 20, 20, 20],
    caption: "Table 6: Three-year summary (ETB) — computed in the accompanying model",
    rows: [
      ["Subscribing institutions (cumulative)", "3 (1 bank + 2 MFIs)", "12 (6 + 6)", "28 (12 + 16)"],
      ["VAPT engagements", "4", "10", "18"],
      ["SOC retainer clients (year-end)", "1", "4", "8"],
      ["Awareness engagements", "2", "6", "12"],
      ["Revenue", M(y1.revenue_total), M(y2.revenue_total), M(y3.revenue_total)],
      ["Operating costs", M(y1.costs_total), M(y2.costs_total), M(y3.costs_total)],
      ["Net (pre-tax)", M(y1.net), M(y2.net), M(y3.net)],
      ["FTE at year-end", "5", "10", "16"],
    ],
    alignRight: [1, 2, 3],
  }),
  ...C.figure(`${CH}/chart_rev_cost.png`, "Figure 1: Revenue, operating costs and net across the three-year plan (ETB millions)", 520),
  C.h2("7.3 Year 1 shape"),
  C.para("Year 1 is a build-and-prove year: revenue of ETB 4.02M against costs of ETB 9.35M, the difference funded by the pre-seed ask. Costs are dominated by the five-person payroll (ETB 3.40M in-year, both founders from February), the ISO 27001 certification programme (ETB 2.25M — mid-range of the USD 6-40K small-organisation benchmark) and Ethiopian hosting with tooling (ETB 0.9M), plus legal setup, pilot operations and a 10 percent contingency. First revenue arrives with the bank pilot subscription from July and the first VAPT engagements from August."),
  ...C.figure(`${CH}/chart_y1_monthly.png`, "Figure 2: Year 1 monthly revenue build against operating costs (ETB millions)", 520),
  C.h2("7.4 Funding ask and use of funds"),
  C.para("Adwa Sec seeks ETB 10M pre-seed (about USD 62,000 at the NBE rate of 12 November 2026) for approximately 18 months of runway. Sized from the model, not from a round-number habit: the cumulative 2027-2028 net burn is ETB 5.64M (ETB -5.33M in 2027, ETB -0.32M in 2028), so the ask covers it 1.77 times — the margin absorbs the pre-revenue first half of 2027, working-capital timing (revenue concentrates in the second half) and birr depreciation on USD-indexed costs. The strategy is deliberately hybrid: non-dilutive money and revenue first, equity only on proven pilot metrics, so that any future seed round is priced on evidence."),
  ...C.figure(`${CH}/chart_use_of_funds.png`, "Figure 3: Allocation of the ETB 10M pre-seed ask", 500),
  C.h2("7.5 Break-even and scenarios"),
  C.para("The plan reaches monthly run-rate break-even in the fourth quarter of 2028, as the exit run-rate — 6 bank subscriptions, 6 MFI subscriptions and 4 retainers — approximately covers monthly costs. The first profitable year is 2029 at ETB 9.16M pre-tax. The scenario logic follows standard B2B security behaviour: a majority of successful pilots renew into annual contracts (50–70 percent assumed), hiring lags validated demand, and pricing is USD-indexed with an annual birr-adjustment clause to protect against depreciation. If pilot conversion runs slower, the Year 2 gap is bridged by development-partner grants for the awareness and certification tracks — the venture's roadmap already maps the funder families (World Bank digital-development operations, GIZ cyber-capacity programmes, EU D4D, UNDP, GFCE and internet-health funders) — and by the grant-writing assets this application itself demonstrates."),
  C.h1("8. Risk Register"),
  ...C.dataTable({
    headers: ["Risk", "Likelihood", "Impact", "Mitigation (in plan)"],
    widths: [26, 12, 12, 50],
    caption: "Table 7: Principal risks and mitigations",
    rows: [
      ["Pilot conversion slower than planned", "Medium", "High", "Pilot pricing converts (discounted, not free); 18-month runway; grants bridge Year 2; hiring lags demand"],
      ["Regulatory ambiguity for private SOC services", "Medium", "Medium", "Written INSA confirmation of the authorisation pathway before selling monitoring beyond pilot scope; counsel engaged from formation"],
      ["Birr depreciation against USD-indexed costs", "High", "Medium", "USD-indexed pricing with annual adjustment clause; quarterly re-basing; contingency line"],
      ["Founder loss (either founder)", "Low", "High", "MVP built and documented; two founders with split domains (CEO commercial/regulatory, CTO engineering); advisory board; BDU continuity agreement; option-pool vesting"],
      ["Foreign competitor localisation", "Low", "Medium", "Rule-content moat (47+30 obligations catalogues); evidence-integrity architecture; local references and bilingual delivery compound early"],
      ["Bank procurement cycle length", "Medium", "Medium", "Direct paid pilots run in parallel to tender channel; LOT4-style bid capability already demonstrated"],
    ],
  }),
  C.h1("9. Impact and National Alignment"),
  C.para("Adwa Sec's commercial engine and its national mission are the same machine. Every subscribing institution keeps cybersecurity spend, skills and data on Ethiopian soil — consistent with the data-localisation provisions of Proclamation 1321/2024. Each year of operation trains security engineers and SOC analysts through the Bahir Dar University pipeline who can then staff the sector. The Amharic-first awareness programme builds safety capacity in the language of the workforce. And a locally-built, GCI-Tier-3-country platform responding to central-bank tenders is, in itself, the kind of capability the National Cybersecurity Policy 2024 and Digital Ethiopia 2030 call for — the practical path from Tier 3 toward Tier 2 by the decade's end."),
  C.h1("10. Appendix: NBE LOT4 Capability Response (Summary)"),
  C.para("The venture has transcribed all 66 mandatory requirement lines of the NBE/NCB/S/02/2026/27 LOT4 tender into a bid capability matrix, with honest per-line status — 27 fully met, 21 partially met, 18 on the roadmap — each mapped to the platform capability and evidence pointer that answers it, exportable as CSV in the tender's own Vendor-Response format. Coverage includes scanner architecture and deployment, asset discovery and EASM, vulnerability assessment with context-aware prioritisation (CVSS+EPSS+KEV, P1–P4), live web/API DAST, identity and AD attack-path analysis (§G), remediation SLA workflows, compliance reporting and governance. Roadmap items (authenticated/agent-based scanning, SAST/SCA, live AD directory ingestion, cloud CSPM connectors, SIEM/ITSM integrations) are scheduled in the product roadmap rather than claimed as delivered — the honest-labelling discipline the tender itself demands."),
  C.para("The full line-by-line matrix is viewable in the MVP demonstration document and the platform's Bid Matrix tab (AdwaSec_08_MVP_Demonstration.docx)."),
];

const doc = C.makeDoc({ cover, toc: C.tocBlock(), body, headerTitle: "Adwa Sec — Business Plan" });
C.docx.Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync("/home/z/my-project/download/AdwaSec_03_Business_Plan.docx", buf);
  console.log("written: AdwaSec_03_Business_Plan.docx");
});
