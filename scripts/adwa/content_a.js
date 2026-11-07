// content_a.js — Sections 1–5
const H = require("./helpers");
const { h1, h2, h3, p, bullet, numbered, tableTitle, makeTable, note, P } = H;

function build() {
  const c = [];

  // ══════════════════════════════════════════════════════════════
  // 1. EXECUTIVE SUMMARY
  // ══════════════════════════════════════════════════════════════
  c.push(h1("1. Executive Summary"));

  c.push(p([
    { t: "This roadmap converts the Adwa Cyber startup proposal (v1.0, May 2026) into an executable, fundable programme. The verdict is positive: the proposal is technically credible, methodologically rigorous, and unusually well aligned with Ethiopia's policy architecture — the National Cybersecurity Policy (NCSP) 2024, Digital Ethiopia 2030, and Proclamation No. 1321/2024. Two of its five phases already have working implementations, which is rare at proposal stage. What the document lacks is not technology but " },
    { t: "execution scaffolding", b: true },
    { t: ": a legal entity, a production-grade deployment, signed pilot commitments, a team, a budget, and a funding strategy. This document supplies that scaffolding.",
    },
  ]));

  c.push(p([
    { t: "The central strategic recommendation is to " },
    { t: "re-sequence the five phases into three delivery tracks", b: true },
    { t: ". Track A (Months 1–12) productises and monetises Phase 1 (compliance automation) and Phase 2 (CERT-as-a-Service) as the commercial core, because they address acute, penalised pain — manual audits of 40–80 hours against 47 legal obligations, with penalties of up to 4 percent of global turnover and executive imprisonment — and therefore can be sold, not just piloted. Track B runs Phase 3 (multilingual awareness) in parallel as a grant-funded mission programme. Track C defers Phases 4 and 5 until partnership, authorisation, and human-rights gates are passed, protecting the venture's credibility and donor eligibility.",
    },
  ]));

  c.push(p([
    { t: "The 12-month roadmap follows the proposal's own Design Science Research calendar: legal setup, production deployment, and signed letters of intent in Quarter 1; paid pilots with the Commercial Bank of Ethiopia, Dashen Bank, and three microfinance institutions in Quarter 2; pilot execution and the five-school awareness pilot in Quarter 3; and evaluation, GCI 2026 questionnaire data, open-sourcing of the Compliance API, and a seed round in Quarter 4. The Year 1 budget is estimated at " },
    { t: "USD 108,000–200,000", b: true },
    { t: " (indicative planning range), funded by a deliberate hybrid: development-partner grants, university in-kind support, and paid pilot revenue — with equity investment deferred until pilot metrics justify a fair valuation.",
    },
  ]));

  c.push(p([
    { t: "The five highest-priority actions, developed in Sections 2–14, are: (1) move the platform from localhost demonstrations to a secured production deployment on Ethiopian hosting; (2) convert every \u201cPlanned\u201d pilot into a signed letter of intent before making any external claim; (3) establish the legal entity and a technology-transfer agreement with Bahir Dar University; (4) re-sequence delivery into the three tracks described above; and (5) charge for pilots from day one. Executed together, these steps turn a strong research artefact into an investable company while preserving the proposal's national mission — accelerating Ethiopia's trajectory from GCI Tier 3 toward Tier 2 by 2028.",
    },
  ]));

  // ══════════════════════════════════════════════════════════════
  // 2. STRATEGIC ASSESSMENT
  // ══════════════════════════════════════════════════════════════
  c.push(h1("2. Strategic Assessment of the Proposal"));

  c.push(h2("2.1 What the Proposal Gets Right"));
  c.push(p([
    { t: "Four strengths distinguish this proposal from typical startup documents and should be preserved in every future version. First, " },
    { t: "policy alignment is concrete, not rhetorical", b: true },
    { t: ": every phase maps to a specific NCSP section, and Appendix A of the proposal traces each NCSP tactic to a product component. This makes the venture legible to INSA, the Ministry of Innovation and Technology (MInT), and international assessors. Second, the " },
    { t: "evidence base is current and specific", b: true },
    { t: " — INTERPOL's Africa Cyberthreat Assessment 2025 (which places Ethiopia first globally for malware detections in 2024), the ITU Global Cybersecurity Index 2024 (Tier 3), and INSA's report of 27,773 sophisticated attacks in a single six-month period in 2025–2026. Third, the " },
    { t: "Design Science Research methodology", b: true },
    { t: " with six defined research questions and quantitative success thresholds (for example, greater than 70 percent audit-time reduction; detection-to-notification latency under 15 minutes) gives funders a built-in evaluation framework. Fourth, " },
    { t: "two phases are already implemented", b: true },
    { t: " — the 47-rule compliance engine with web, executive, and Amharic dashboards, and the CERT platform with threat-intelligence hub, SOC interface, and Ethio-CERT synchronisation — which materially de-risks the technical plan.",
    },
  ]));

  c.push(h2("2.2 Credibility Gaps to Close Before External Use"));
  c.push(p(
    "The same document, submitted to a bank procurement committee or a development-partner review panel today, would face avoidable objections. The gaps below are all fixable within 90 days, and the roadmap in Section 4 schedules them accordingly."
  ));

  c.push(tableTitle("Proposal strengths versus execution gaps"));
  c.push(makeTable({
    headers: ["Dimension", "Strength in the proposal", "Gap to close for professional execution"],
    widths: [16, 42, 42],
    rows: [
      ["Technology",
        "Phases 1–2 implemented; all 47 rules of Proclamation 1321/2024 mapped to code; open-source stack (Wazuh, MISP, BERT variants)",
        "Demos reference localhost:8000 URLs; no production deployment, domain, HTTPS, or uptime record — no enterprise buyer will evaluate a localhost address"],
      ["Customers",
        "Pilot design covers banks, MFIs, Ethio Telecom, SMEs, schools, media, and four CII operators",
        "Every pilot is marked \u201cPlanned\u201d; no signed letters of intent, no paid engagements, no reference customers"],
      ["Evidence",
        "GCI 2024, INTERPOL 2025, INSA 2026 cited with page references",
        "Internal inconsistency: the abstract cites a GCI score of 76.34 while Section 2.1 and its pillar table total 47.32 — reconcile against the ITU source before any external submission"],
      ["Organisation",
        "Named lab affiliation (Adwa Cyber Research Lab) and university sponsor",
        "No legal entity, no team plan, no budget, no revenue model, no governance structure; single-founder key-person risk is unaddressed"],
      ["Risk & ethics",
        "Strong ethical safeguards; ACFS includes an appeal process, judicial oversight, and EHRC audits",
        "Phase 4 (content filtering) is politically sensitive and adjacent to censorship concerns; no human-rights due-diligence plan or phased public positioning is described"],
    ],
  }));
  c.push(note("Sources: Adwa Cyber Startup Proposal v1.0 (May 2026), Tables 2, 19, 22, 25 and Section 15; ITU GCI 2024 as cited therein."));

  c.push(h2("2.3 Assessment Conclusion"));
  c.push(p([
    { t: "The proposal is a strong " },
    { t: "research and vision document", b: true },
    { t: " that now needs a " },
    { t: "commercial and institutional wrapper", b: true },
    { t: ". Nothing in the technical plan needs to be rethought; what must be added is everything around it: a company that can sign contracts, a production system that can be evaluated, paying customers who validate the value proposition, and a governance layer that protects both the founder and the university. The remainder of this roadmap is organised around exactly that addition. It is also worth stating plainly: the sequencing, budget, and revenue figures in this document are planning instruments based on the proposal's own data and clearly labelled market estimates — they are decision aids, not forecasts, and should be re-validated as pilot data arrives.",
    },
  ]));

  // ══════════════════════════════════════════════════════════════
  // 3. IMPLEMENTATION SEQUENCING
  // ══════════════════════════════════════════════════════════════
  c.push(h1("3. Implementation Sequencing Strategy"));

  c.push(h2("3.1 Why the Linear Sequence Should Change"));
  c.push(p(
    "The proposal presents the five phases as a single integrated programme, with Phases 4 and 5 (content filtering and critical-infrastructure protection) scheduled alongside the rest. That framing is appropriate for a national-policy audience but hazardous for a startup. Phases 4 and 5 depend on partnerships that do not yet exist (the Ethiopian Media Authority, four CII operators), on authorisation pathways that must be confirmed with INSA and legal counsel, and — in the case of Phase 4 — on navigating Ethiopia's most politically sensitive terrain, where a mis-step could damage the credibility of the entire platform and its university affiliation. Pursuing all five phases simultaneously would also dilute a small team across five codebases and five sales motions before a single customer has paid."
  ));

  c.push(p([
    { t: "The recommended structure is therefore " },
    { t: "three tracks with explicit gates", b: true },
    { t: ". The tracks differ in funding source, management rhythm, and risk profile, which is precisely what makes the programme manageable: the commercial track is judged by revenue and pilot metrics, the mission track by reach and learning outcomes, and the deferred track by gate criteria rather than dates.",
    },
  ]));

  c.push(h2("3.2 The Three Tracks"));
  c.push(bullet([
    { t: "Track A — Commercial core (Phases 1 and 2). ", b: true },
    { t: "Productise the compliance engine as subscription software and the CERT capability as a managed 24/7 service. These phases solve acute, quantified pain: a manual compliance audit takes 40–80 hours of specialist work against obligations that carry penalties of up to 4 percent of global turnover and imprisonment, and private-sector incident response currently does not exist. Pain that is penalised and quantified is pain that budgets can be found for. Track A is the only track expected to generate revenue in Year 1.",
    },
  ]));
  c.push(bullet([
    { t: "Track B — Mission programme (Phase 3). ", b: true },
    { t: "The multilingual awareness platform serves school children and the public interest, not paying customers, and should be funded accordingly: by education and digital-inclusion grants, in partnership with Bahir Dar University and the Ministry of Education. Its Amharic curriculum is already complete and training-data collection is 60 percent done, so Track B can proceed in parallel without competing with Track A for engineering attention.",
    },
  ]));
  c.push(bullet([
    { t: "Track C — Gated expansion (Phases 4 and 5). ", b: true },
    { t: "Content filtering and CII protection are strategically important but institutionally demanding. They should advance only through the gates in Table 2 — partnership commitments, legal authorisation, human-rights due diligence, and dedicated funding — so that the core business is never hostage to their slower institutional clocks.",
    },
  ]));

  c.push(tableTitle("Track structure, funding logic, and gate criteria"));
  c.push(makeTable({
    headers: ["Track", "Phases", "Funding source", "Advance gate criteria"],
    widths: [14, 16, 28, 42],
    rows: [
      ["A — Commercial core", "1 and 2",
        "Paid pilots and subscriptions; working-capital grant or seed round in Quarter 4",
        "None — start immediately in Month 1"],
      ["B — Mission programme", "3",
        "Education and digital-inclusion grants; university and ministry in-kind support",
        "None — start immediately; grant calendar in Section 9"],
      ["C — Gated expansion", "4 and 5",
        "Dedicated institutional funding; not funded from Track A revenue until profitable",
        "Phase 4: signed EMA partnership; human-rights due-diligence report with EHRC engagement; published transparency framework. Phase 5: signed MOUs with at least two CII operators; confirmed INSA authorisation pathway; IEC 62443-aligned design review; liability insurance"],
    ],
  }));

  c.push(h2("3.3 What the Tracks Preserve"));
  c.push(p(
    "This sequencing does not retreat from the proposal's ambition — it protects it. Every phase remains on the roadmap, the DSR research questions remain the evaluation spine, and the national-mission narrative (indigenous AI, digital sovereignty, the Adwa name) remains the brand. What changes is order and ownership: the venture earns the right to build Phases 4 and 5 by first proving Phases 1 and 2 with paying customers, which is exactly the evidence INSA, the EMA, and CII operators will ask for anyway. In negotiations with state institutions, a startup that says \u201cwe protect banks today, and here is our certified, audited platform\u201d is far stronger than one that asks for sensitive mandates on the strength of a proposal alone."
  ));

  // ══════════════════════════════════════════════════════════════
  // 4. 12-MONTH EXECUTION ROADMAP
  // ══════════════════════════════════════════════════════════════
  c.push(h1("4. Twelve-Month Execution Roadmap (Year 1)"));

  c.push(p(
    "The Year 1 calendar below is deliberately aligned with the Design Science Research timeline already committed to in the proposal — demonstration in Months 5–9 and evaluation in Months 10–12 — so that the commercial programme and the research programme reinforce rather than compete with each other. Each quarter has one dominant objective; everything else is subordinate to it."
  ));

  c.push(h2("4.1 Quarter 1 (Months 1–3): Foundation and Credibility"));
  c.push(p(
    "The first quarter removes every credibility gap identified in Section 2. The company is registered as a private limited company and a technology-transfer agreement is negotiated with Bahir Dar University (Section 6). The platform moves from localhost to a secured production deployment on Ethiopian hosting with a public domain, TLS encryption, and monitoring — a precondition for any bank evaluation. In parallel, the founder converts pilot interest into signed letters of intent, starting with the organisations the proposal already names: CBE, Dashen Bank, the Wasasa, Oromia, and Amhara MFIs, and the five e-commerce, logistics, and fintech SMEs. The first hires (CTO or senior engineer, then SOC manager) are made, and pricing hypotheses are drafted for validation in Quarter 2."
  ));

  c.push(h2("4.2 Quarter 2 (Months 4–6): Paid Pilots and Team"));
  c.push(p(
    "Quarter 2 begins the demonstration phase of the DSR cycle. Two to four paid pilot contracts are signed with anchor institutions — the goal is at least one bank and at least one MFI — each structured as a six-month engagement with defined success metrics drawn from the proposal's research questions (audit-time reduction above 70 percent; detection-to-notification latency below 15 minutes; platform uptime above 99.5 percent). The SOC begins 24/7 shift coverage with the analysts hired in this quarter. An ISO 27001 gap assessment is commissioned, because certification is the single most effective answer to the procurement question \u201cwho audits you?\u201d when selling security services to banks. The first grant applications for Track B and for working capital are submitted (Section 9)."
  ));

  c.push(h2("4.3 Quarter 3 (Months 7–9): Execution and Parallel Mission Work"));
  c.push(p(
    "Pilot execution dominates the quarter: metrics are collected continuously against the RQ thresholds, and monthly steering-committee reviews with each pilot customer build the reference relationships that Quarter 4 will convert into case studies. In parallel, the Phase 3 school pilot with five Addis Ababa public schools runs on grant funding, completing the Amharic-curriculum validation described in the proposal. Track C groundwork proceeds quietly: a human-rights due-diligence scoping paper for Phase 4 is drafted with EHRC engagement, and technical MOU conversations continue with CII operators without any public claims."
  ));

  c.push(h2("4.4 Quarter 4 (Months 10–12): Evaluation, Visibility, and Capital"));
  c.push(p(
    "The evaluation phase closes the DSR cycle. Pilot results are analysed (paired t-tests for audit-time reduction, latency distribution analysis for SOC performance, as specified in the proposal's evaluation table) and written into two bank-grade case studies and at least one peer-reviewed submission. The Adwa Cyber data feed is prepared for the GCI 2026 national questionnaire, in coordination with MInT, as the proposal's next-steps table already plans. The Compliance API is open-sourced on GitHub — a deliberate credibility and talent-attraction move already committed to in the proposal. Finally, a seed funding round opens, supported by pilot metrics, LOIs converted to annual contracts, and the ISO 27001 programme underway."
  ));

  c.push(tableTitle("Year 1 milestone plan"));
  c.push(makeTable({
    headers: ["Milestone", "Target month", "Owner", "Success criterion"],
    widths: [38, 12, 16, 34],
    rows: [
      ["PLC registered; BDU technology-transfer agreement signed", "M1–M2", "Founder / counsel", "Certificate of incorporation; signed IP agreement defining ownership and licence terms"],
      ["Production deployment live on Ethiopian hosting with HTTPS", "M1–M2", "CTO", "Public domain resolves; uptime monitoring active; no localhost references in any material"],
      ["First 3+ signed letters of intent (banks, MFIs, SMEs)", "M2–M3", "Founder", "Signed LOIs with scope, duration, and pricing intent"],
      ["SOC manager and senior engineer hired", "M2–M4", "Founder", "Offers accepted; onboarding complete"],
      ["First paid pilots commence (1 bank + 1 MFI minimum)", "M4–M6", "Founder / SOC manager", "Signed 6-month contracts; first invoices issued"],
      ["24/7 SOC shift coverage operational", "M6", "SOC manager", "Three-shift roster staffed; escalation runbook tested"],
      ["ISO 27001 gap assessment complete; remediation plan underway", "M5–M7", "CTO", "Gap report delivered; Statement of Applicability drafted"],
      ["First 2+ grant applications submitted", "M4–M8", "Founder", "Applications to development-partner programmes (Section 9)"],
      ["Phase 3 school pilot running in 5 Addis Ababa schools", "M7–M9", "Education lead (Track B)", "Pre/post knowledge assessments administered per RQ2 design"],
      ["Pilot evaluation and case studies published", "M10–M12", "Founder / CTO", "RQ1 and RQ3 thresholds measured; 2 case studies released"],
      ["GCI 2026 questionnaire data submitted via MInT", "M11–M12", "Founder", "Adwa Cyber metrics included in national submission"],
      ["Compliance API open-sourced; seed round opened", "M12", "Founder", "Public repository with documentation; investor data room complete"],
    ],
  }));
  c.push(note("Owner titles refer to the Year 1 team plan in Section 7. Months follow the proposal's DSR calendar (demonstration M5–9, evaluation M10–12)."));

  // ══════════════════════════════════════════════════════════════
  // 5. YEARS 2–3 SCALE-UP
  // ══════════════════════════════════════════════════════════════
  c.push(h1("5. Years 2–3 Scale-Up Plan (2028–2029)"));

  c.push(p(
    "Years 2 and 3 shift the company from proving to scaling. The organising logic is simple: Year 1 proves the product with paid pilots; Year 2 productises and repeatably sells it; Year 3 embeds it nationally and opens the regional option. The targets below extend the proposal's own KPI table (500 organisations using compliance tools by 2027; five operational sectoral CERTs; 20 percent school coverage) to the company level."
  ));

  c.push(h2("5.1 Year 2 (2028): Productise and Sell"));
  c.push(p(
    "The five pilot relationships convert into annual subscriptions, and the sales motion becomes repeatable: a standardised compliance scan as the lead-generation offer, a fixed-price onboarding package, and annual contracts with defined service levels for the CERT service. ISO 27001 certification is completed — the audit cycle that began in Year 1 concludes here — unlocking larger bank and government contracts that require certified suppliers. The Phase 3 platform, validated in the school pilot, scales toward the proposal's target of 20 percent of target schools, funded by the education grants secured in Year 1. Team size roughly doubles to 18–22. Track C gates are formally reviewed at mid-year: if the EMA partnership and human-rights due diligence for Phase 4 are complete, a limited Phase 4 deployment with the three media organisations named in the proposal (Fanaka, Ethio Forum, Sheger FM) may proceed; if not, it slips without any impact on the core business."
  ));

  c.push(h2("5.2 Year 3 (2029): National Footprint and Regional Option"));
  c.push(p(
    "Year 3 pursues three objectives. First, national coverage of the commercial core: the compliance subscriber base grows toward the proposal's 2030 trajectory (2,000+ organisations), and CERT-as-a-Service expands from banking into telecom and energy, in direct support of the sectoral-CERT count the proposal targets (20+ by 2030). Second, if the Phase 5 gates are passed — at least two CII operator MOUs, confirmed authorisation, IEC 62443-aligned design — the CII pilot with the four operators named in the proposal (Ethiopian Electric Power, Ethiopian Airlines, Ethio Telecom, CBE) begins under dedicated institutional funding with liability insurance in place. Third, the regional replication study recommended in the proposal's own limitations section (Kenya, Tanzania, Uganda) is commissioned with a regional development partner, since the architecture was deliberately designed for replication."
  ));

  c.push(h2("5.3 Scale-Up Guardrails"));
  c.push(p(
    "Three disciplines should govern the scale-up. Revenue concentration must be managed: no single client should exceed roughly 30 percent of revenue by the end of Year 2, which argues for prioritising breadth in the SME segment alongside the anchor banks. Hiring must lag validated demand rather than lead projections — the Year 2 plan above assumes conversion rates, not pipeline hope. And every expansion (new sector, new phase, new country) must pass a mini-gate modelled on Section 3.2: a named partner, a funding source, and a defined kill criterion. Companies die more often from unfocused expansion than from slow growth, and a venture carrying a national-security mission has an additional obligation to scale only where it can deliver."
  ));

  return c;
}

module.exports = { build };
