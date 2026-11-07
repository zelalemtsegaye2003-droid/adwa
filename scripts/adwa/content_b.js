// content_b.js — Sections 6–10
const H = require("./helpers");
const { h1, h2, h3, p, bullet, numbered, tableTitle, makeTable, note } = H;

function build() {
  const c = [];

  // ══════════════════════════════════════════════════════════════
  // 6. LEGAL, GOVERNANCE AND INSTITUTIONAL SETUP
  // ══════════════════════════════════════════════════════════════
  c.push(h1("6. Legal, Governance and Institutional Setup"));

  c.push(h2("6.1 Company Formation"));
  c.push(p(
    "Adwa Cyber currently exists as a research lab affiliation, not a contracting entity. No bank can sign a paid pilot with, and no grant can be disbursed to, an unregistered activity. The first executive action of the roadmap is therefore to register a private limited company (PLC) at the Ethiopian Commercial Register, with the founder as initial shareholder. Registration should be executed with a commercial lawyer familiar with technology ventures; as an indicative planning range, incorporation and initial counsel typically cost USD 1,500–4,000 and complete within two to six weeks, though both figures must be validated locally. The company should from the outset maintain a clean IP ledger: everything developed before incorporation is assigned to the company in writing, and everything after is developed under contracts that so provide."
  ));

  c.push(h2("6.2 The Bahir Dar University Relationship"));
  c.push(p(
    "The proposal invites the university to be the academic home of the initiative — providing research oversight, pilot facilitation, and institutional credibility. That relationship is an asset worth formalising precisely because it is valuable to both sides. The recommended instrument is a technology-transfer and affiliation agreement covering four subjects: ownership and licensing of intellectual property developed in the lab (a clean default is university ownership of pre-existing academic work, company ownership of new product code, with a cross-licence and, if the university prefers, a small royalty or equity position); the terms under which students and faculty may work on company projects, including the internship pipeline in Section 7; the use of the university's name and facilities; and the ethical-review pathway for research involving organisations and minors, which the proposal already commits to. Universities increasingly standardise such agreements; approaching BDU's research and technology-transfer office early, with a draft rather than a request, will shorten the negotiation."
  ));

  c.push(h2("6.3 Regulatory Engagement: INSA and Ethio-CERT"));
  c.push(p(
    "Cybersecurity services, threat-intelligence sharing, and especially any monitoring of networks touch regulated territory. The proposal already assumes deep technical integration with Ethio-CERT (API synchronisation is implemented) and an observation role for INSA in the pilot design — both are the right instincts. The roadmap adds a formal step: before selling monitoring services beyond the pilot scope, the company should obtain written confirmation from INSA of the authorisation or licensing pathway applicable to private cybersecurity service providers, and structure its data-handling (metadata-only audits, privacy-preserving sharing protocols, Ethiopian-soil storage under Article 22 of Proclamation 1321/2024) to match. The specific permits, if any, required for a private SOC operating in Ethiopia should be confirmed with counsel rather than assumed; this item is flagged as requiring verification in the risk register."
  ));

  c.push(h2("6.4 Governance Structure"));
  c.push(p(
    "A startup selling security services to banks will be judged on its governance as much as its code. Three lightweight structures are recommended for Year 1. First, an advisory board of five to seven members meeting quarterly: a senior BDU faculty member (academic oversight), a former bank or telecom CISO (credibility with buyers), an INSA or Ethio-CERT liaison as permitted (regulatory alignment), a lawyer with technology and data-protection practice, and one international cyber-capacity expert (useful for grant applications). Second, a pilot steering committee per pilot customer, meeting monthly — this doubles as the customer-success motion. Third, a founder-level discipline of written board minutes and decisions, which costs little now and is indispensable at the first investment round. Together these structures also begin to address the key-person risk flagged in Section 2.2."
  ));

  // ══════════════════════════════════════════════════════════════
  // 7. TEAM AND ORGANIZATION PLAN
  // ══════════════════════════════════════════════════════════════
  c.push(h1("7. Team and Organization Plan"));

  c.push(p(
    "The Year 1 plan requires roughly nine full-time staff, hired in three waves that track the roadmap: engineering and leadership first, delivery capacity second, sales third. Compensation figures below are indicative market estimates for cybersecurity talent in Ethiopia, stated in USD for planning stability against birr depreciation; they must be validated against actual offers. The university relationship subsidises this plan substantially: student interns from BDU can support SOC rotations, content translation, and test data under supervision, at a fraction of market cost, while creating the talent pipeline the proposal's national mission requires."
  ));

  c.push(tableTitle("Year 1 hiring plan (indicative monthly cost ranges in USD)"));
  c.push(makeTable({
    headers: ["Role", "FTE", "Start", "Monthly range (USD)", "Year 1 cost (USD)", "Core responsibility"],
    widths: [23, 8, 8, 16, 14, 31],
    rows: [
      ["Founder / CEO (Solomon Asalif)", "1", "Q1*", "500–1,000", "4,500–9,000", "Strategy, fundraising, anchor sales, university and INSA relationships"],
      ["CTO / Senior Security Engineer", "1", "Q1", "1,500–2,500", "18,000–30,000", "Production platform, compliance engine, security architecture, ISO 27001 programme"],
      ["SOC Manager", "1", "Q2", "1,200–2,000", "10,800–18,000", "24/7 operations, incident response, escalation, pilot delivery"],
      ["Compliance Engineer", "1", "Q2", "800–1,500", "7,200–13,500", "Phase 1 engine maintenance, rule updates, customer onboarding scans"],
      ["Partnerships & Sales Lead", "1", "Q3", "600–1,200", "3,600–7,200", "Pipeline beyond anchors, SME segment, partner channel"],
      ["SOC Analysts (three shifts)", "3", "Q3", "400–800 each", "7,200–14,400", "24/7 monitoring, triage, threat-intelligence operations"],
      ["Operations & Administration", "1", "Q2", "300–500", "2,700–4,500", "Finance, HR, procurement, grant reporting"],
      [{ t: "Total", b: true }, { t: "9", b: true }, "—", { t: "—", b: true }, { t: "54,000–96,600", b: true }, { t: "Plus supervised BDU student interns", b: true }],
    ],
  }));
  c.push(note("* Founder draw begins Q2, after first revenue or grant receipt; Year 1 costs reflect in-year months only. Ranges are indicative Ethiopian market estimates for validation against actual offers."));

  c.push(h2("7.1 Retention and Key-Person De-Risking"));
  c.push(p(
    "Cybersecurity talent is scarce and mobile everywhere, and Ethiopia is no exception. Three retention levers are recommended: certification sponsorship (ISO 27001 lead auditor, and a structured path toward CISSP-equivalent seniority) which costs little and signals investment in the individual; compensation positioned at or slightly above the 60th percentile of the local market with annual review; and an employee share option pool of 10–15 percent established at incorporation, vesting over four years — inexpensive now, and standard diligence hygiene for the seed round. Key-person risk around the founder is addressed structurally in Year 1: the CTO owns the architecture, all systems and decisions are documented, the advisory board meets quarterly, and the BDU agreement guarantees continuity of the academic relationship independently of any individual."
  ));

  // ══════════════════════════════════════════════════════════════
  // 8. BUDGET AND FINANCIAL MODEL
  // ══════════════════════════════════════════════════════════════
  c.push(h1("8. Budget and Financial Model"));

  c.push(h2("8.1 Year 1 Budget"));
  c.push(p(
    "The Year 1 budget is deliberately lean: it funds the credibility infrastructure (production deployment, certification, legal setup), the delivery team, and the pilots — nothing else. Figures are planning estimates in USD; birr conversions should use the prevailing National Bank of Ethiopia rate at the time of each expenditure, and the budget should be re-based quarterly as actuals arrive."
  ));

  c.push(tableTitle("Year 1 operating budget (indicative, USD)"));
  c.push(makeTable({
    headers: ["Cost category", "Low", "High", "Notes"],
    widths: [28, 12, 12, 48],
    vPad: 45,
    rows: [
      ["Personnel (9 FTE, Section 7)", "54,000", "96,600", "In-year cost of three hiring waves; founder draw from Q2"],
      ["Hosting & infrastructure", "10,000", "18,000", "Ethiopian cloud hosting per Art. 22 data-sovereignty rules; SOC tooling; monitoring"],
      ["ISO 27001 certification", "15,000", "30,000", "Gap assessment, remediation, Stage 1 and 2 audits (indicative range for a small firm)"],
      ["Legal & professional services", "6,000", "12,000", "PLC registration, BDU agreement, pilot contracts, ongoing counsel"],
      ["Pilot operations", "8,000", "15,000", "Travel, participant coordination, evaluation data collection"],
      ["Marketing & business development", "5,000", "10,000", "Case-study production, events, sales materials"],
      ["Subtotal", "98,000", "181,600", "Sum of the rows above"],
      ["Contingency (10%)", "9,800", "18,160", "FX movement, hiring delays, audit re-work"],
      [{ t: "Total Year 1", b: true }, { t: "107,800", b: true }, { t: "199,760", b: true }, { t: "≈ USD 108k–200k; midpoint ≈ USD 154k", b: true }],
    ],
  }));
  c.push(note("All figures are planning estimates to be validated; the totals are arithmetic sums of the ranges above."));

  c.push(h2("8.2 Revenue Model"));
  c.push(p(
    "Three revenue lines match the three tracks. The compliance platform (Phase 1) sells as an annual subscription tiered by organisation size, anchored against the alternative: a manual audit costing 40–80 specialist hours and exposure to penalties of up to 4 percent of global turnover. The CERT service (Phase 2) sells as a monthly managed-service retainer sized by estate and required response times. The awareness platform (Phase 3) is primarily grant-funded, with paid corporate training as a modest third line. Two pricing principles are recommended from the outset: price in USD or with an annual birr adjustment clause (multi-year contracts signed in a depreciating currency otherwise destroy margin), and offer pilot pricing that converts — a discount against the annual list price, not free pilots, which erode both revenue and the perception of value."
  ));

  c.push(tableTitle("Illustrative pricing architecture (to be validated with pilot customers)"));
  c.push(makeTable({
    headers: ["Revenue line", "Segment", "Illustrative price point", "Anchor value logic"],
    widths: [22, 20, 24, 34],
    rows: [
      ["Compliance SaaS (Phase 1)", "SMEs", "USD 1,000–2,000 / year", "Fraction of the 40–80-hour manual audit cost; penalty avoidance"],
      ["Compliance SaaS (Phase 1)", "MFIs / mid-market", "USD 3,000–6,000 / year", "Multi-entity reporting; regulator-ready audit trail"],
      ["Compliance SaaS (Phase 1)", "Banks / enterprise", "USD 10,000–20,000 / year", "Executive dashboards; Amharic interfaces; API integration"],
      ["CERT-as-a-Service (Phase 2)", "SMEs / MFIs", "USD 800–2,000 / month", "24/7 monitoring otherwise unaffordable in-house"],
      ["CERT-as-a-Service (Phase 2)", "Banks / telecom", "USD 3,000–8,000 / month", "Sub-15-minute notification SLA; Ethio-CERT integration"],
      ["Training & awareness (Phase 3)", "Corporates / NGOs", "USD 1,000–3,000 per engagement", "Amharic-first delivery no international vendor offers"],
    ],
  }));

  c.push(h2("8.3 Three-Year Illustrative Scenarios"));
  c.push(p(
    "The scenarios below are illustrative planning instruments, not forecasts; each assumes the roadmap executes and uses the conversion behaviour of typical B2B security services (a majority of successful pilots renewing into annual contracts). Their purpose is to show the shape of the business and the timing of break-even, and to be replaced by actuals as soon as pilot data exists."
  ));

  c.push(tableTitle("Illustrative three-year scenarios (USD, planning assumptions only)"));
  c.push(makeTable({
    headers: ["Metric", "Year 1 (2027)", "Year 2 (2028)", "Year 3 (2029)"],
    widths: [34, 22, 22, 22],
    rows: [
      ["Compliance subscribers (cumulative)", "5–10", "15–35", "60–120"],
      ["CERT / MDR retainer clients (cumulative)", "2–4", "5–10", "12–20"],
      ["Commercial revenue", "25k–60k", "120k–320k", "400k–850k"],
      ["Grant & institutional funding (Tracks B/C)", "50k–150k", "100k–250k", "150k–400k"],
      ["Operating cost", "108k–200k", "220k–400k", "450k–800k"],
      ["Headcount (FTE)", "9", "18–22", "28–35"],
      ["Position", "Grant-subsidised loss", "Near break-even", "Break-even to modest profit on commercial revenue alone"],
    ],
  }));
  c.push(note("Scenarios assume pilot-to-annual conversion of 50–70%, USD-indexed pricing, and hiring that lags validated demand. They are planning aids to be re-based quarterly."));

  c.push(p(
    "Two features of this model deserve emphasis. First, the business reaches viability on commercial revenue alone by Year 3 in the base scenario, with grants accelerating rather than substituting — the posture development partners themselves prefer to fund. Second, the revenue is concentrated in exactly the segments the proposal's pilot table already names, which means the Year 1 sales plan requires no speculative customer acquisition: it requires converting interest that already exists into signed, priced engagements."
  ));

  // ══════════════════════════════════════════════════════════════
  // 9. FUNDING STRATEGY
  // ══════════════════════════════════════════════════════════════
  c.push(h1("9. Funding Strategy"));

  c.push(h2("9.1 The Hybrid Principle"));
  c.push(p(
    "Adwa Cyber sits at the intersection of three funding worlds: development assistance (cyber-capacity building is an established development priority), university and government programmes (the proposal's own recommendations ask for policy support, funding channels, and university involvement), and commercial security markets. The strategy is to draw on all three in a deliberate sequence — non-dilutive money first, revenue second, equity last — so that by the time the founder sells shares, the company's pilot metrics, not its promise, set the valuation."
  ));

  c.push(h2("9.2 Stage 1 (Months 1–6): Non-Dilutive Foundation"));
  c.push(p(
    "The first stage funds the Year 1 budget gap with grants and in-kind support. The table below lists the funder categories with the strongest programme fit; amounts are deliberately omitted because they vary by call and cycle, and the correct approach is to identify open calls and match them to the roadmap's needs. Bahir Dar University's contribution — office and lab space, internship supervision, and the credibility of institutional affiliation — should be counted and communicated as a co-investment, which materially strengthens every grant application. Grant-writing is a founder-level priority in Quarter 1 and 2: the proposal itself, the LOIs, and the policy mapping in its appendices are most of what a strong application needs."
  ));

  c.push(tableTitle("Development-partner fit assessment (programmes to approach; no amounts implied)"));
  c.push(makeTable({
    headers: ["Funder / programme family", "Focus relevant to Adwa Cyber", "Best-fit track", "Approach route"],
    widths: [26, 34, 12, 28],
    rows: [
      ["World Bank digital-development operations in Ethiopia", "Digital economy, cyber resilience, public-sector digitisation", "A / C", "Via MInT and the relevant project coordination units"],
      ["GIZ digital and cyber-capacity programmes", "Cybersecurity capacity building, CIIP, digital transformation", "A / C", "Country office; cyber-capacity calls"],
      ["EU Global Gateway / Digital for Development (D4D)", "Trusted connectivity, cyber resilience, digital rights", "B / C", "D4D Hub calls; delegation in Addis Ababa"],
      ["UNDP digital programmes", "Public-sector capacity, inclusive digitalisation", "B", "Country office digital team"],
      ["Global Forum on Cyber Expertise (GFCE) network", "Cyber-capacity coordination, donor visibility", "A / C", "National coordination; GFCE community calls"],
      ["Internet-health and online-safety funders (e.g., Mozilla foundation programmes)", "Amharic NLP, online safety, trustworthy AI", "B / C", "Open calls; research partnerships"],
      ["GSMA innovation funds", "Mobile-centred digital services and safety", "B", "Innovation fund calls"],
      ["Bahir Dar University / MInT / INSA", "In-kind: lab space, interns, endorsement, pilot facilitation", "All", "Direct institutional agreements (Sections 6.2, 6.3)"],
    ],
  }));
  c.push(note("Programme families are named for fit, not as commitments; each requires identification of the currently open call and its criteria."));

  c.push(h2("9.3 Stage 2 (Months 6–12): Revenue and Grant Stacking"));
  c.push(p(
    "From mid-year the funding mix shifts toward earned revenue as pilots invoice, with grants stacked on top for Track B and the certification programme. The operating target for Month 12 is that paid pilots plus committed grants cover 60 percent or more of the Year 2 budget — a threshold that simultaneously proves commercial traction to investors and programme delivery to grantors, and that becomes the headline of the seed-round data room."
  ));

  c.push(h2("9.4 Stage 3 (Year 2): Seed Capital on Proven Metrics"));
  c.push(p(
    "The seed round, opened at the end of Year 1 or early Year 2, should target investors with both the mandate and the patience for East African deep tech: impact investors with digital-inclusion mandates, development-finance-connected vehicles, and venture funds with security or Africa-focused theses. The pitch rests on assets this roadmap creates deliberately: recurring revenue from converted pilots, ISO 27001 certification, signed university and regulator relationships, and a research-grade evaluation dataset no competitor can quickly replicate. A modest round (sized to the Year 2 gap after grants, rather than to a maximal valuation) preserves founder ownership while funding the scale-up plan of Section 5."
  ));

  // ══════════════════════════════════════════════════════════════
  // 10. GO-TO-MARKET AND PARTNERSHIP STRATEGY
  // ══════════════════════════════════════════════════════════════
  c.push(h1("10. Go-to-Market and Partnership Strategy"));

  c.push(h2("10.1 Beachhead: The Financial Sector"));
  c.push(p(
    "The beachhead is the segment where pain, budget, and regulatory attention intersect: banks and microfinance institutions. The wedge message writes itself from the proposal's own evidence — the Personal Data Protection Proclamation's 47 obligations, penalties of up to 4 percent of global turnover and imprisonment, the 72-hour breach-notification clock, and manual audits that take 40–80 hours. For a bank CISO, the pitch is concrete: an Ethiopian-law-native compliance engine and a 24/7 monitoring service at a fraction of the cost of building either in-house or importing a foreign tool that does not map to Proclamation 1321/2024. The Commercial Bank of Ethiopia and Dashen Bank are already named pilot candidates; the microfinance institutions (Wasasa, Oromia, Amhara) extend the beachhead into a segment with less in-house capability and more price sensitivity, ideal for the standardised offering."
  ));

  c.push(h2("10.2 The Sales Motion"));
  c.push(p(
    "The motion from first contact to contract has five steps, each with an exit criterion. One: an anchored introduction through INSA, Ethio-CERT, BDU, or a peer CISO — warm channels already implicit in the proposal's design. Two: a free, scoped compliance scan against a subset of the 47 rules, producing a findings report the prospect keeps — the single most persuasive artifact the platform can generate, and a natural productisation of the implemented engine. Three: a six-month paid pilot with metrics agreed up front (the proposal's pilot design already specifies participants, phases, and durations). Four: a steering-committee rhythm during the pilot that builds the internal champions who will defend renewal. Five: conversion to an annual contract at pilot pricing plus a defined step. Free pilots are explicitly rejected: they signal low value, attract non-committed participants, and consume the same delivery capacity as paid ones."
  ));

  c.push(h2("10.3 Partnership Architecture"));
  c.push(p(
    "Four partnership tiers carry the go-to-market. Bahir Dar University provides the academic legitimacy and the student pipeline; its name opens ministry and school-system doors that a startup alone cannot. INSA and Ethio-CERT provide the regulatory integration and, over time, the endorsement without which security sales to state-adjacent buyers stall — the implemented Ethio-CERT API synchronisation is the technical foundation of this tier. The anchor banks are design partners whose case studies become the reference assets for the wider financial sector. Hosting and telecom partners (Ethio Telecom, Ethiopian cloud providers) supply the sovereign infrastructure the data-residency rules require, and can become channel partners reselling compliance scanning to their enterprise customers. Phase 4 and 5 partnerships — the EMA, the CII operators — belong to Track C and follow its gates; they are cultivated quietly through Year 1 but carry no revenue expectations."
  ));

  c.push(h2("10.4 Competitive Positioning"));
  c.push(p(
    "Against international vendors, Adwa Cyber's position is not cheaper security but native security: law-native (47 rules mapped to the actual proclamation, not to GDPR), language-native (Amharic dashboards and curriculum), and sovereignty-native (Ethiopian-soil hosting, indigenous IP — the exact argument the proposal's discussion section makes). Against local consultancies, the position is product over person-days: repeatable software and a 24/7 service rather than audit reports that age. This positioning should be stated consistently in every artifact — website, case studies, grant applications — and is the brand answer to the question every buyer and funder will ask: why not buy foreign? The proposal has already written the answer; the go-to-market's job is to prove it with paying customers."
  ));

  return c;
}

module.exports = { build };
