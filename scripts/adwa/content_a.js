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
    { t: "This roadmap converts the Adwa Cyber startup proposal (v1.0, May 2026) into an executable, fundable programme — and it deliberately re-baselines the plan: the platform descriptions in the proposal are treated as design specifications rather than existing assets, and " },
    { t: "Phase 1, the compliance-automation platform, is scheduled to be built from scratch in Months 1–6", b: true },
    { t: ". The verdict on the proposal is positive: it is technically credible, methodologically rigorous, and unusually well aligned with Ethiopia's policy architecture — the National Cybersecurity Policy (NCSP) 2024, Digital Ethiopia 2030, and Proclamation No. 1321/2024. What the venture now needs is both working software and " },
    { t: "execution scaffolding", b: true },
    { t: ": a legal entity, a production-grade platform, signed pilot commitments, a team, a budget, and a funding strategy. This document supplies the plan for all of it.",
    },
  ]));

  c.push(p([
    { t: "The central strategic recommendation is to " },
    { t: "re-sequence the five phases into three delivery tracks", b: true },
    { t: ". Track A (Months 1–12) builds Phase 1 (compliance automation) from scratch in Months 1–6, productises it as subscription software, and stands up Phase 2 (CERT-as-a-Service) on the same open-source infrastructure in the second half of the year — because together they address acute, penalised pain: manual audits of 40–80 hours against 47 legal obligations, with penalties of up to 4 percent of global turnover and executive imprisonment, and therefore can be sold, not just piloted. Track B runs Phase 3 (multilingual awareness) in parallel as a grant-funded mission programme, developing its Amharic curriculum and training corpus during the first half of the year. Track C defers Phases 4 and 5 until partnership, authorisation, and human-rights gates are passed, protecting the venture's credibility and donor eligibility.",
    },
  ]));

  c.push(p([
    { t: "The 12-month roadmap follows the proposal's own Design Science Research calendar: legal setup, rule formalisation, architecture, and signed letters of intent in Quarter 1; the Phase 1 build to MVP and production deployment on Ethiopian hosting in Quarter 2; paid pilots with the Commercial Bank of Ethiopia, Dashen Bank, and three microfinance institutions from Month 6; pilot execution, SOC stand-up, and the five-school awareness pilot in Quarter 3; and evaluation, GCI 2026 questionnaire data, open-sourcing of the Compliance API, and a seed round in Quarter 4. The Year 1 budget is estimated at " },
    { t: "USD 104,000–193,000", b: true },
    { t: " (indicative planning range), funded by a deliberate hybrid: development-partner grants, university in-kind support, and paid pilot revenue — with equity investment deferred until pilot metrics justify a fair valuation.",
    },
  ]));

  c.push(p([
    { t: "The five highest-priority actions, developed in Sections 2–14, are: (1) start the Phase 1 from-scratch build immediately — rule catalogue in Month 1, MVP and production deployment by Month 6; (2) convert every \u201cPlanned\u201d pilot into a signed letter of intent before making any external claim; (3) establish the legal entity and a technology-transfer agreement with Bahir Dar University; (4) re-sequence delivery into the three tracks described above; and (5) charge for pilots from day one. Executed together, these steps turn a strong research artefact into an investable company while preserving the proposal's national mission — accelerating Ethiopia's trajectory from GCI Tier 3 toward Tier 2 by 2028.",
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
    { t: " with six defined research questions and quantitative success thresholds (for example, greater than 70 percent audit-time reduction; detection-to-notification latency under 15 minutes) gives funders a built-in evaluation framework. Fourth, the " },
    { t: "technical design is build-ready", b: true },
    { t: ": the 47 obligations of Proclamation 1321/2024 are inventoried with enough precision to be formalised as machine-readable rules, and the specified open-source stack (Wazuh, MISP, BERT variants) is mature, licence-clean, and well matched to a small team building from scratch — which is exactly how this roadmap schedules the build.",
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
        "Complete technical design: all 47 obligations of Proclamation 1321/2024 inventoried for automation; open-source stack specified (Wazuh, MISP, BERT variants); dashboard and API concepts documented",
        "No independently verifiable production system exists — this roadmap therefore treats the proposal's platform descriptions as design documentation and re-baselines Phase 1 as a six-month from-scratch build (Section 4.1)"],
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
    { t: ". The technical design needs no rethinking; what must be added is its construction and everything around it: a company that can sign contracts, a platform built from scratch and deployed to production, paying customers who validate the value proposition, and a governance layer that protects both the founder and the university. The remainder of this roadmap is organised around exactly that addition. It is also worth stating plainly: the sequencing, budget, and revenue figures in this document are planning instruments based on the proposal's own data and clearly labelled market estimates — they are decision aids, not forecasts, and should be re-validated as pilot data arrives.",
    },
  ]));

  // ══════════════════════════════════════════════════════════════
  // 3. IMPLEMENTATION SEQUENCING
  // ══════════════════════════════════════════════════════════════
  c.push(h1("3. Implementation Sequencing Strategy"));

  c.push(h2("3.1 Why the Linear Sequence Should Change"));
  c.push(p(
    "The proposal presents the five phases as a single integrated programme, with Phases 4 and 5 (content filtering and critical-infrastructure protection) scheduled alongside the rest. That framing is appropriate for a national-policy audience but hazardous for a startup. Phases 4 and 5 depend on partnerships that do not yet exist (the Ethiopian Media Authority, four CII operators), on authorisation pathways that must be confirmed with INSA and legal counsel, and — in the case of Phase 4 — on navigating Ethiopia's most politically sensitive terrain, where a mis-step could damage the credibility of the entire platform and its university affiliation. Pursuing all five phases simultaneously would also dilute a small team across five codebases and five sales motions before a single customer has paid or a single line of production code has been written."
  ));

  c.push(p([
    { t: "The recommended structure is therefore " },
    { t: "three tracks with explicit gates", b: true },
    { t: ". The tracks differ in funding source, management rhythm, and risk profile, which is precisely what makes the programme manageable: the commercial track is judged by delivery milestones and revenue, the mission track by reach and learning outcomes, and the deferred track by gate criteria rather than dates.",
    },
  ]));

  c.push(h2("3.2 The Three Tracks"));
  c.push(bullet([
    { t: "Track A — Commercial core (Phases 1 and 2). ", b: true },
    { t: "Build Phase 1 from scratch in Months 1–6 (Section 4.1): the rule catalogue, the compliance engine, the scan engine, and the web, executive, and Amharic dashboards on the open-source stack. Productise it as subscription software, then stand up the CERT capability (Phase 2) as a managed service on the same infrastructure, with 24/7 coverage phased in from late Year 1 into Year 2. These phases solve acute, quantified pain: a manual compliance audit takes 40–80 hours of specialist work against obligations that carry penalties of up to 4 percent of global turnover and imprisonment, and private-sector incident response currently does not exist. Pain that is penalised and quantified is pain that budgets can be found for. Track A is the only track expected to generate revenue in Year 1.",
    },
  ]));
  c.push(bullet([
    { t: "Track B — Mission programme (Phase 3). ", b: true },
    { t: "The multilingual awareness platform serves school children and the public interest, not paying customers, and should be funded accordingly: by education and digital-inclusion grants, in partnership with Bahir Dar University and the Ministry of Education. Its Amharic curriculum and training corpus are developed within the track during the first half of Year 1 by a grant-funded education specialist rather than engineers, so the five-school pilot can run in Months 7–9 in parallel, without competing with Track A for engineering attention.",
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
        "None — the Phase 1 build starts immediately in Month 1 (Section 4.1)"],
      ["B — Mission programme", "3",
        "Education and digital-inclusion grants; university and ministry in-kind support",
        "None — curriculum development starts in Month 1; grant calendar in Section 9"],
      ["C — Gated expansion", "4 and 5",
        "Dedicated institutional funding; not funded from Track A revenue until profitable",
        "Phase 4: signed EMA partnership; human-rights due-diligence report with EHRC engagement; published transparency framework. Phase 5: signed MOUs with at least two CII operators; confirmed INSA authorisation pathway; IEC 62443-aligned design review; liability insurance"],
    ],
  }));

  c.push(h2("3.3 What the Tracks Preserve"));
  c.push(p(
    "This sequencing does not retreat from the proposal's ambition — it protects it. Every phase remains on the roadmap, the DSR research questions remain the evaluation spine, and the national-mission narrative (indigenous AI, digital sovereignty, the Adwa name) remains the brand. What changes is order and ownership: the venture earns the right to build Phases 4 and 5 by first building and proving Phases 1 and 2 with paying customers, which is exactly the evidence INSA, the EMA, and CII operators will ask for anyway. In negotiations with state institutions, a startup that says \u201cwe protect banks today, and here is our certified, audited platform\u201d is far stronger than one that asks for sensitive mandates on the strength of a proposal alone."
  ));

  // ══════════════════════════════════════════════════════════════
  // 4. 12-MONTH EXECUTION ROADMAP
  // ══════════════════════════════════════════════════════════════
  c.push(h1("4. Twelve-Month Execution Roadmap (Year 1)"));

  c.push(p(
    "The Year 1 calendar below is deliberately aligned with the Design Science Research timeline committed to in the proposal — demonstration in Months 5–9 and evaluation in Months 10–12 — so that the commercial programme and the research programme reinforce rather than compete with each other. Because Phase 1 is built from scratch, the first half of the year belongs to the build: the MVP is complete and in production by the end of Month 6, pilots onboard from Month 6, and the demonstration window is satisfied by pilot onboarding and early execution. Each quarter has one dominant objective; everything else is subordinate to it."
  ));

  c.push(h2("4.1 The Phase 1 Build Plan (Months 1–6)"));
  c.push(p(
    "Building the compliance-automation platform from scratch in six months is the critical path of the entire roadmap, and it is planned as five workstreams with hard exit criteria. \u201cFrom scratch\u201d means exactly that: no existing codebase is assumed, and every component — rule catalogue, engines, dashboards, deployment — is specified, built, tested, and hardened within the window. The proposal's design (the 47-obligation inventory, the open-source stack, the dashboard concepts) is the blueprint; the build turns it into a running system."
  ));

  c.push(tableTitle("Phase 1 build workstreams, activities, and exit criteria"));
  c.push(makeTable({
    headers: ["Workstream", "Months", "Key activities", "Exit criterion"],
    widths: [19, 9, 44, 28],
    fontSize: 19,
    vPad: 55,
    rows: [
      ["Rule formalisation", "M1–M3",
        "Convert the 47 obligations of Proclamation 1321/2024 into a machine-readable rule catalogue: article reference, control statement, evidence source, check logic, severity; counsel validation of every legal interpretation",
        "Rule catalogue v1.0 approved, version-controlled, and counsel-signed"],
      ["Architecture & infrastructure", "M2–M3",
        "Confirm the open-source stack (Wazuh as the SIEM foundation, MISP for threat intelligence, PostgreSQL, BERT-based Amharic components); design the deployment topology for Ethiopian hosting under Article 22 data-residency rules; stand up repositories, CI/CD, and the security baseline",
        "Blueprint signed off; development and staging environments live"],
      ["Core build sprints", "M3–M6",
        "Two-week sprints in dependency order: rule engine, scan engine, evidence collection, web dashboard, executive report, Amharic interface; working demo at every sprint review",
        "MVP passes acceptance tests by the end of Month 6"],
      ["Security & production deployment", "M5–M6",
        "Hardening, TLS, uptime monitoring, backups, incident runbooks; production cutover to Ethiopian hosting with a public domain",
        "Public URL live and monitored; no local-only references in any material"],
      ["QA & pilot readiness", "M6",
        "False-positive tuning on sample data; user documentation; pilot-onboarding runbook; training for the first pilot customers",
        "Pilot-ready sign-off by the advisory board"],
    ],
  }));

  c.push(p(
    "Two disciplines protect the schedule. Scope: the MVP is defined tightly — rule engine, scan engine, and the three dashboards — while API integrations (including Ethio-CERT synchronisation) and advanced analytics are post-MVP enhancements scheduled only after pilot feedback. Team: the build is staffed by the CTO (hired Month 1–2), a full-stack engineer (Month 3–4), and the founder, using mature open-source components instead of custom foundations; if two consecutive sprint milestones slip, the response is to descope, not to extend. The build window deliberately overlaps the pilot-contracting window: customers sign in Months 4–5 against the MVP scope, so onboarding starts the moment acceptance tests pass."
  ));

  c.push(h2("4.2 Quarter 1 (Months 1–3): Foundation and Build Kick-off"));
  c.push(p(
    "The first quarter removes every credibility gap identified in Section 2 and starts the build. The company is registered as a private limited company and a technology-transfer agreement is negotiated with Bahir Dar University (Section 6). The Phase 1 build kicks off with the rule-formalisation workstream — the 47 obligations converted into machine-readable rules with counsel validation — and the architecture blueprint is finalised (Section 4.1). The CTO is hired in Month 1–2, and the development environment, repositories, and CI pipeline go live. In parallel, the founder converts pilot interest into signed letters of intent, starting with the organisations the proposal names: CBE, Dashen Bank, the Wasasa, Oromia, and Amhara MFIs, and the five e-commerce, logistics, and fintech SMEs. Track B begins curriculum development with a grant-funded education specialist, and the first grant applications are drafted."
  ));

  c.push(h2("4.3 Quarter 2 (Months 4–6): Build to MVP and First Paid Pilots"));
  c.push(p(
    "Quarter 2 is dominated by the core build sprints and opens the demonstration phase of the DSR cycle. The full-stack engineer joins; the rule engine, scan engine, and dashboards come together sprint by sprint; and the platform is hardened and deployed to production on Ethiopian hosting with a public domain, TLS encryption, and monitoring — a precondition for any bank evaluation. Pilot contracts are signed in Months 4–5 against the MVP scope, each structured as a six-month engagement with defined success metrics drawn from the proposal's research questions (audit-time reduction above 70 percent; detection-to-notification latency below 15 minutes; platform uptime above 99.5 percent), with onboarding beginning the moment MVP acceptance passes in Month 6. An ISO 27001 certification timetable is agreed with a shortlisted assessor, and the first grant applications for Track B and for working capital are submitted (Section 9)."
  ));

  c.push(h2("4.4 Quarter 3 (Months 7–9): Pilot Execution and SOC Stand-up"));
  c.push(p(
    "Pilot execution dominates the quarter: metrics are collected continuously against the RQ thresholds, and monthly steering-committee reviews with each pilot customer build the reference relationships that Quarter 4 will convert into case studies. The SOC stands up on the same open-source infrastructure: the SOC manager and analysts hired this quarter deploy Wazuh-based monitoring and the MISP threat-intelligence feed for pilot customers, beginning with business-hours coverage and on-call escalation, while full 24/7 coverage is a Year 2 objective. In parallel, the Phase 3 school pilot with five Addis Ababa public schools runs on grant funding, using the curriculum completed in the first half of the year. Track C groundwork proceeds quietly: a human-rights due-diligence scoping paper for Phase 4 is drafted with EHRC engagement, and technical MOU conversations continue with CII operators without any public claims."
  ));

  c.push(h2("4.5 Quarter 4 (Months 10–12): Evaluation, Visibility, and Capital"));
  c.push(p(
    "The evaluation phase closes the DSR cycle. Pilot results are analysed (paired t-tests for audit-time reduction, latency distribution analysis for SOC performance, as specified in the proposal's evaluation table) and written into two bank-grade case studies and at least one peer-reviewed submission. The Adwa Cyber data feed is prepared for the GCI 2026 national questionnaire, in coordination with MInT, as the proposal's next-steps table plans. The Compliance API is open-sourced on GitHub — a deliberate credibility and talent-attraction move committed to in the proposal. The 24/7 SOC transition plan for Year 2 is finalised with the SOC manager. Finally, a seed funding round opens, supported by pilot metrics, LOIs converted to annual contracts, and the ISO 27001 programme underway."
  ));

  c.push(tableTitle("Year 1 milestone plan"));
  c.push(makeTable({
    headers: ["Milestone", "Target month", "Owner", "Success criterion"],
    widths: [38, 12, 16, 34],
    fontSize: 19,
    vPad: 55,
    rows: [
      ["PLC registered; BDU technology-transfer agreement signed", "M1–M2", "Founder / counsel", "Certificate of incorporation; signed IP agreement defining ownership and licence terms"],
      ["Rule catalogue v1.0: all 47 obligations formalised as machine-readable rules", "M1–M3", "CTO / counsel", "Version-controlled rule specification; legal interpretation validated"],
      ["Architecture blueprint finalised; development and staging environments live", "M2–M3", "CTO", "Stack confirmed (Wazuh, MISP, BERT components); repositories and CI/CD operational"],
      ["First 3+ signed letters of intent (banks, MFIs, SMEs)", "M2–M3", "Founder", "Signed LOIs with scope, duration, and pricing intent"],
      ["CTO hired (M1–M2); full-stack engineer hired (M3–M4)", "M1–M4", "Founder", "Offers accepted; onboarding complete"],
      ["Phase 1 MVP complete: rule engine, scan engine, web / executive / Amharic dashboards", "M5–M6", "CTO", "Acceptance tests pass; sprint demo presented to the advisory board"],
      ["Production deployment live on Ethiopian hosting with HTTPS", "M5–M6", "CTO", "Public domain resolves; uptime monitoring active; deployment reachable from the public internet"],
      ["First paid pilot contracts signed and onboarding begins (1 bank + 1 MFI minimum)", "M4–M6", "Founder / CTO", "Signed 6-month contracts scoped to the MVP; first invoices issued"],
      ["SOC manager and analysts hired; business-hours monitoring live for pilot customers", "M6–M8", "Founder / SOC manager", "Wazuh monitoring and MISP feed operational; escalation runbook tested"],
      ["ISO 27001 gap assessment complete; remediation plan underway", "M6–M8", "CTO", "Gap report delivered; Statement of Applicability drafted"],
      ["First 2+ grant applications submitted", "M4–M8", "Founder", "Applications to development-partner programmes (Section 9)"],
      ["Phase 3 school pilot running in 5 Addis Ababa schools", "M7–M9", "Education lead (Track B)", "Pre/post knowledge assessments administered per RQ2 design"],
      ["Pilot evaluation and case studies published", "M10–M12", "Founder / CTO", "RQ1 and RQ3 thresholds measured; 2 case studies released"],
      ["GCI 2026 questionnaire data submitted via MInT", "M11–M12", "Founder", "Adwa Cyber metrics included in national submission"],
      ["Compliance API open-sourced; seed round opened", "M12", "Founder", "Public repository with documentation; investor data room complete"],
    ],
  }));
  c.push(note("Owner titles refer to the Year 1 team plan in Section 7. Months follow the proposal's DSR calendar (demonstration M5–9, evaluation M10–12); the Phase 1 build (Section 4.1) completes in Month 6, when pilot onboarding begins."));

  // ══════════════════════════════════════════════════════════════
  // 5. YEARS 2–3 SCALE-UP
  // ══════════════════════════════════════════════════════════════
  c.push(h1("5. Years 2–3 Scale-Up Plan (2028–2029)"));

  c.push(p(
    "Years 2 and 3 shift the company from proving to scaling. The organising logic is simple: Year 1 builds the product from scratch and proves it with paid pilots; Year 2 productises and repeatably sells it; Year 3 embeds it nationally and opens the regional option. The targets below extend the proposal's own KPI table (500 organisations using compliance tools by 2027; five operational sectoral CERTs; 20 percent school coverage) to the company level."
  ));

  c.push(h2("5.1 Year 2 (2028): Productise and Sell"));
  c.push(p(
    "The pilot relationships convert into annual subscriptions, and the sales motion becomes repeatable: a standardised compliance scan as the lead-generation offer, a fixed-price onboarding package, and annual contracts with defined service levels for the CERT service. The 24/7 SOC, whose staff and runbooks were built in the second half of Year 1, becomes fully operational in the first half of Year 2, converting pilot-period business-hours monitoring into a round-the-clock managed service. ISO 27001 certification is completed — the audit cycle that began in Year 1 concludes here — unlocking larger bank and government contracts that require certified suppliers. The Phase 3 platform, validated in the school pilot, scales toward the proposal's target of 20 percent of target schools, funded by the education grants secured in Year 1. Team size roughly doubles to 18–22. Track C gates are formally reviewed at mid-year: if the EMA partnership and human-rights due diligence for Phase 4 are complete, a limited Phase 4 deployment with the three media organisations named in the proposal (Fanaka, Ethio Forum, Sheger FM) may proceed; if not, it slips without any impact on the core business."
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
