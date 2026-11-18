/**
 * content2.js - Chapters 5-8
 */
const {
  h1, h2, body, bodyRuns, tableCaption, figCaption, bizTable, image,
} = require("./helpers");

const ASSETS = process.cwd() + "/scripts/assets";

const chapters = [];

// ===========================================================================
// 5. ORGANIZATION AND TEAM PLAN
// ===========================================================================
chapters.push(
  h1("5. Organization and Team Plan"),
  h2("5.1 Organisational Design"),
  body(
    "The organisation is deliberately small and dual-anchored. A chief executive (the founder) and a chief technology officer lead three delivery units - Engineering and AI, SOC Operations, and Learning and Content - supported by lean administration shared with the university laboratory. The Engineering and AI unit owns the compliance engine, the threat-intelligence platform and, from Stage 3, the Ethiopian-language models. The SOC Operations unit owns monitoring shifts, incident response and the customer support tiers. The Learning and Content unit owns the awareness curriculum, its Amharic and Afan Oromo delivery and the relationships with schools and the Ministry of Education. The Adwa Cyber Research Lab at Bahir Dar University remains the research home: graduate students, thesis projects and published work flow through the lab, while commercial delivery flows through the company."
  ),
  h2("5.2 Hiring Sequence and Indicative Salary Bands"),
  body(
    "Table 3 sets out the Year-1 hiring plan. All salary figures are indicative planning estimates for the Ethiopian market, expressed in US dollars at the planning exchange rate used throughout this document; they must be validated against prevailing conditions before offers are made. The sequencing follows the stage logic of Chapter 4: hardening and engineering staff first, SOC and commercial staff when pilots begin, NLP and curriculum staff when the mission phases activate.",
    { keepNext: true }
  ),
  tableCaption("Year-1 hiring plan with indicative monthly salary bands (estimates)"),
  bizTable(
    ["Role", "FTE", "Onboard", "Indicative band (USD / month)"],
    [
      ["Chief Technology Officer", "1", "Stage 0", "2,500 - 3,500"],
      ["Senior security engineers", "2", "Stage 0", "1,500 - 2,500 each"],
      ["Full-stack engineer (platform)", "1", "Stage 0", "1,200 - 2,000"],
      ["Compliance and legal counsel", "1", "Stage 0 (part-time to full)", "1,000 - 1,800"],
      ["SOC manager", "1", "Stage 1", "1,500 - 2,200"],
      ["SOC analysts", "5 in Year 1 (8 from 24/7 go-live)", "Stage 1-2", "400 - 700 each"],
      ["Business development and partnerships manager", "1", "Stage 1", "800 - 1,400"],
      ["NLP / ML engineers", "2", "Stage 2-3", "1,200 - 2,000 each"],
      ["Curriculum designers (Amharic / Afan Oromo)", "2", "Stage 2", "500 - 800 each"],
    ],
    [34, 8, 18, 40]
  ),
  body(
    "The plan reaches twelve full-time positions around Month 7 and approximately twenty by the end of Year 2, when the 24/7 SOC shift structure is complete and the awareness platform requires field staff. Payroll is the largest single budget line, which is why the hiring plan is tied to gates rather than to ambition: each stage's hires are authorised only when the previous gate is passed."
  ),
  h2("5.3 The 24/7 Coverage Calculation"),
  body(
    "Continuous monitoring is a staffing problem before it is a technology problem. Twenty-four-hour coverage equals 168 hours per week; at a 40-hour week, one monitored seat requires at least 4.2 analysts before a single holiday, illness or training day is counted. With a realistic allowance for leave and attrition, a single-tier 24/7 seat consumes roughly six full-time analysts, and a two-tier structure with senior incident leads consumes eight to ten. This is why the roadmap runs daytime pilot coverage with five analysts in Year 1 and activates the full 24/7 structure in Stage 2, when subscription revenue can carry it - and why the Year-2 budget step in Chapter 6 is dominated by SOC payroll."
  ),
  h2("5.4 Advisory Board"),
  body(
    "The advisory board provides the oversight the organisation cannot provide itself. Its recommended composition is: a senior faculty member of Bahir Dar University as chair; an INSA or Ethio-CERT liaison member serving ex officicio; a data-protection lawyer familiar with Proclamation No. 1321/2024; an international cybersecurity advisor with SOC and CII experience; and, from Stage 3, an Ethiopian Human Rights Commission-affiliated member for the content-filtering ethics agenda. The board meets quarterly ahead of steering committee meetings, receives the same metrics pack, and holds an explicit mandate to challenge stage-gate decisions."
  ),
  h2("5.5 Retention Measures"),
  body(
    "Senior Ethiopian engineers can command remote salaries several times the bands in Table 3, so retention must be engineered. Four measures are recommended: the equity pool of 10 to 15 percent with four-year vesting described in Section 3.7; salary-band reviews every twelve months against market data; the university-affiliation benefits - research co-authorship, laboratory association and adjunct teaching pathways - that private and foreign employers cannot offer; and a documented succession arrangement for every critical system, so that departures degrade capacity rather than continuity."
  )
);

// ===========================================================================
// 6. BUDGET AND RESOURCE PLAN
// ===========================================================================
chapters.push(
  h1("6. Budget and Resource Plan (Indicative)"),
  h2("6.1 Basis and Assumptions"),
  body(
    "All figures in this chapter are indicative planning estimates, not quotations or commitments. They use a planning exchange rate of 1 USD to approximately ETB 130, to be re-validated at each commitment point given currency volatility; salary costs follow the bands in Table 3; and the technology stack remains the open-source base specified in the proposal (Wazuh with Elastic Security, MISP, AfroXLMR-family language models), which keeps software licensing close to zero and concentrates cost in people, infrastructure and fieldwork. Hosting follows the sovereignty requirement: Ethiopian-cloud or Ethiopian-datacentre deployment as required by the data-residency obligations the proposal itself enforces for its customers."
  ),
  h2("6.2 Year-1 Indicative Budget"),
  body(
    "Figure 2 and Table 4 present the Year-1 allocation. The total is approximately USD 590,000. Personnel dominates, as it should in a services-and-software venture, and the contingency line is deliberately material because the operating environment - procurement timelines, connectivity, import duties on equipment - is less predictable than in mature markets.",
    { keepNext: true }
  ),
  image(ASSETS + "/budget.png", 560, 1943, 883),
  figCaption("Year-1 indicative budget allocation by cost category (planning estimates)."),
  tableCaption("Year-1 indicative budget lines (planning estimates, USD thousands)"),
  bizTable(
    ["Cost category", "Year-1 (USD K)", "Principal contents"],
    [
      ["Personnel and benefits", "270", "12 FTE ramp (Table 3), statutory benefits, one-time recruitment"],
      ["Infrastructure, hosting and GPU compute", "96", "Sovereign-cloud hosting, monitoring stack, GPU capacity for NLP training"],
      ["Pilot execution and field research", "72", "Pilot onboarding, school study logistics, evaluation data collection"],
      ["Legal, certification and compliance", "46", "Entity and agreements, ISO/IEC 27001 path, penetration tests, insurance"],
      ["Office, administration and travel", "38", "Bahir Dar and Addis Ababa presence, finance and bookkeeping"],
      ["Contingency (approx. 14 percent)", "68", "Exchange-rate and schedule risk buffer, released by steering committee"],
      ["Total", "590", ""],
    ],
    [34, 14, 52]
  ),
  h2("6.3 Three-Year View"),
  body(
    "Table 5 extends the plan across the roadmap horizon. Year 2 carries the 24/7 SOC staffing step and the awareness rollout; Year 3 adds ACFS operations and the CII pilot. The cumulative three-year gross requirement is approximately USD 2.5 million, against which pilot fees and subscription revenue - conservatively projected in Section 6.4 - offset an increasing share.",
    { keepNext: true }
  ),
  tableCaption("Three-year indicative budget (planning estimates, USD thousands)"),
  bizTable(
    ["Line", "Year 1", "Year 2", "Year 3", "Cumulative"],
    [
      ["Personnel and benefits", "270", "430", "520", "1,220"],
      ["Infrastructure and compute", "96", "130", "150", "376"],
      ["Pilots, research and evaluation", "72", "90", "110", "272"],
      ["Legal, certification, audit", "46", "60", "70", "176"],
      ["Administration and travel", "38", "50", "60", "148"],
      ["Contingency", "68", "120", "150", "338"],
      ["Total", "590", "880", "1,060", "2,530"],
      ["Indicative revenue offset", "60 - 90", "350 - 450", "900 - 1,100", "1,310 - 1,640"],
      ["Net external funding need", "approx. 500", "approx. 450", "approx. 100", "approx. 1,000 - 1,250"],
    ],
    [34, 14, 14, 14, 24]
  ),
  h2("6.4 Revenue Offsets and Cost Discipline"),
  body(
    "Revenue projections are indicative and deliberately conservative: pilot fees of USD 60,000 to 90,000 in Year 1 (recovery of direct pilot costs rather than profit), subscription revenue of USD 350,000 to 450,000 in Year 2 as the pricing model in Chapter 8 activates, and USD 900,000 to 1,100,000 in Year 3 as the installed base grows and the SOC retainer business matures. Three cost disciplines keep the plan honest: hiring is released by gate decisions rather than calendar dates; the open-source stack is defended against feature-creep toward commercial licences; and GPU-intensive model training is scheduled and shared - including potential shared capacity with the Ethiopian Artificial Intelligence Institute referenced in the proposal - rather than provisioned for peak load."
  )
);

// ===========================================================================
// 7. FUNDING STRATEGY
// ===========================================================================
chapters.push(
  h1("7. Funding Strategy"),
  h2("7.1 Principles"),
  body(
    "Four principles govern the funding strategy. First, match the instrument to the phase: research and development grants fund the mission phases and the evaluation work, because their outputs are public goods; revenue funds commercial operations; equity funds scale once recurring revenue is proven. Second, release money against gates, not against calendar dates, so that capital follows evidence. Third, avoid single-donor dependence: no funder should carry more than roughly 40 percent of any stage. Fourth, keep the equity story for later - the venture's leverage in a Year-2 round is far higher with twenty paying institutions and published evaluation results than it is today with a prototype."
  ),
  h2("7.2 Instrument Plan"),
  body(
    "Table 6 sets out the recommended instruments, amounts and timing. The sources named are candidate programmes and investor categories known to be active in Ethiopia's digital-development landscape; listing them indicates where proposals will be submitted, not any existing commitment.",
    { keepNext: true }
  ),
  tableCaption("Funding instruments, indicative amounts and timing"),
  bizTable(
    ["Instrument", "Indicative amount", "Purpose", "Candidate sources", "Timing"],
    [
      ["University and founder in-kind", "Facilities, supervision, lab access", "Stage 0 foundation", "Bahir Dar University; founder contribution", "Months 1-3"],
      ["R&D and innovation grants", "USD 250K - 400K", "Hardening, pilots, evaluation, mission-phase R&D", "Development partners with digital programmes in Ethiopia (World Bank digital development operations, GIZ, EU Global Gateway / D4D, UNDP); university research funds", "Applications Months 2-4; decision window Stage 1"],
      ["Pilot and subscription revenue", "Per Section 6.4", "Commercial operations from Stage 1", "Pilot organisations and customers", "Stage 1 onward"],
      ["Strategic seed equity", "USD 500K - 800K", "24/7 SOC scale-up, Phase 3 rollout", "Ethiopian diaspora angel networks, impact and tech funds, regional accelerator ecosystem", "After gate G2 (Months 9-15)"],
      ["Growth / development finance", "Stage-3 sizing", "CII expansion and regional replication", "Development finance institutions; larger impact funds", "After gate G3 (Year 2-3)"],
    ],
    [20, 15, 22, 27, 16]
  ),
  h2("7.3 The De-Risking Narrative for Funders"),
  body(
    "The venture's fundraising position is unusually defensible for an early-stage initiative, and every pitch should lead with the evidence structure rather than the technology. The six research questions in the proposal define success numerically before money is spent; the Design Science Research methodology commits the team to publish results, including negative ones; the gate structure in Chapter 4 gives funders a contractual stop-loss at each stage; and the policy alignment means the initiative advances named national priorities rather than a private agenda. Grant applications in Months 2-4 should be drafted around exactly this structure, with the 90-day plan in Chapter 12 presented as evidence of execution capacity."
  )
);

// ===========================================================================
// 8. GO-TO-MARKET AND REVENUE MODEL
// ===========================================================================
chapters.push(
  h1("8. Go-to-Market and Revenue Model"),
  h2("8.1 Positioning and the Entry Wedge"),
  body(
    "Adwa Cyber's defensible position is not generic security tooling; it is the localisation moat: the only machine-readable implementation of all 47 rules of Proclamation No. 1321/2024, cybersecurity content in Amharic and Afan Oromo, Ethiopian-sovereign hosting, and integration with the national CERT ecosystem. International vendors cannot credibly offer these, and their compliance products map to GDPR, not to Ethiopian law. The entry wedge is compliance automation, because it sells to a deadline - regulatory exposure with personal criminal liability for executives - and because the compliance relationship creates the trust and data access on which SOC monitoring and, later, CII protection are sold. The motion is deliberately land-and-expand: land with the audit, expand to monitoring, retain through infrastructure."
  ),
  h2("8.2 Segments and Indicative Pricing"),
  body(
    "Table 7 sketches the segment architecture and indicative price points. All prices are planning hypotheses to be tested in Stage 1 through willingness-to-pay interviews and pilot negotiations; they are set low enough to clear the market the proposal targets - including SMEs that today face a 40-to-80-hour manual audit alternative - and high enough to carry the service model.",
    { keepNext: true }
  ),
  tableCaption("Market segments and indicative pricing (planning hypotheses)"),
  bizTable(
    ["Segment", "Product entry point", "Indicative price (USD / month)", "Sales motion"],
    [
      ["SMEs (e-commerce, logistics, fintech)", "Self-serve compliance tier; freemium scan of first 10 rules", "0 to 150", "Partner-led and self-serve"],
      ["Mid-market organisations", "Compliance subscription plus awareness add-on", "300 - 800", "Channel partners, audit firms"],
      ["Banks, MFIs, telecom operators", "Enterprise compliance plus SOC monitoring retainer", "1,500 - 5,000 plus SOC retainer 2,000 - 8,000", "Direct enterprise sales; pilot-to-contract"],
      ["Government and education", "Awareness platform licensing; B2G programmes for ACFS and CII", "Programme-based contracting", "Institutional partnerships via MInT, MoE, EMA, INSA"],
    ],
    [24, 30, 24, 22]
  ),
  h2("8.3 Channels"),
  body(
    "Four channels carry the model. Audit and consulting firms are the highest-leverage conversion: they currently sell the manual audits the platform automates, and a partner programme that lets them resell or implement the automated audit preserves their revenue while multiplying reach. Ethio Telecom is both a customer and a distribution partner for bundled SME services. The university network - Bahir Dar, Addis Ababa University and the wider public-university system - provides credibility, graduates and school-system access. The Ministry's digital-skills programmes referenced in the proposal, including the 5 Million Coders initiative, offer funded reach for the awareness platform."
  ),
  h2("8.4 From Pilots to References"),
  body(
    "The pilot roster in the proposal is also the reference strategy. The Commercial Bank of Ethiopia and Dashen Bank are the two most persuasive reference names in the Ethiopian financial market; converting them from pilot to paying customer is the single most valuable commercial objective of Stage 2, ahead of raw logo count. Each pilot agreement should therefore be negotiated with explicit reference, case-study and joint-communication rights from the outset, and the evaluation results from Chapter 11 should be packaged into sector-specific evidence (banking, microfinance, SME) for use in later sales campaigns."
  )
);

module.exports = chapters;
