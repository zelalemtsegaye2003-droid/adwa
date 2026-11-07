/**
 * content3.js - Chapters 9-12
 */
const {
  h1, h2, body, bodyRuns, tableCaption, bizTable,
} = require("./helpers");

const chapters = [];

// ===========================================================================
// 9. GOVERNANCE, LEGAL AND ETHICAL FRAMEWORK
// ===========================================================================
chapters.push(
  h1("9. Governance, Legal and Ethical Framework"),
  h2("9.1 Implementation Governance"),
  body(
    "Governance is kept simple and scheduled. A steering committee - the founder, the CTO, the chair of the advisory board and a Bahir Dar University representative - meets quarterly and at every stage gate, receives a standing metrics pack built from the Chapter 11 framework, and takes documented go, hold or fix decisions. Minutes and decision logs are maintained from the first meeting, both because institutional funders will ask for them and because the discipline of writing decisions down changes their quality. An independent technical review is commissioned before any deployment that handles third-party content or critical-infrastructure data - that is, before the ACFS and CII pilots - and its findings are reported to the committee unedited."
  ),
  h2("9.2 Legal Posture"),
  body(
    "Five legal workstreams must complete in Stage 0 or early Stage 1. First, registration of the corporate entity in a form that can contract with banks and government. Second, the intellectual-property arrangement with Bahir Dar University: pre-agreement work assigned or licensed to the company on documented terms, and a standing rule for work created afterwards, including student and supervisor contributions. Third, the platform's own compliance: registration and obligations under Proclamation No. 1321/2024, so that the answer to 'are you compliant with the law you automate' is a documented yes. Fourth, the contract suite - data-processing agreements, service terms with availability and liability clauses, and pilot participation agreements with the ethical safeguards from the proposal built in. Fifth, insurance: professional indemnity and cyber coverage at limits appropriate to financial-sector customers."
  ),
  h2("9.3 Operationalising the Ethics Framework"),
  body(
    "The proposal's accountability framework for the ACFS is one of its strongest differentiators, and the implementation must treat it as engineering scope, not narrative. Concretely: transparency logging and the three-tier appeal workflow are built into the common services layer in Stage 0-1, so that every automated compliance or moderation decision is logged and reviewable from the first pilot; the judicial-oversight rule (no permanent content removal without a court order) and the 30-day expiry of content flags are enforced in code, not policy documents; data minimisation follows the proposal's rules - safe content is not stored, flagged content is retained for exactly 90 days; reviewer wellbeing protocols and the code of conduct for human reviewers are established before the first reviewer is hired; and the 90-day coordinated vulnerability-disclosure policy aligned with Ethio-CERT guidelines is published before the first external deployment. The quarterly Ethiopian Human Rights Commission audit relationship proposed for the ACFS should be initiated during Stage 2, a year before the first filtering deployment, so that the methodology is agreed when the stakes are low."
  ),
  h2("9.4 Ethics as a Commercial Asset"),
  body(
    "It is worth stating plainly why this framework belongs in a business plan. Bank and telecom procurement processes in Ethiopia increasingly require documented data-protection and governance practice; development funders require safeguarding and rights-respecting design as a condition of grants; and any system that filters speech in Amharic, Oromo or Tigrigna will attract public and international scrutiny proportional to its effectiveness. An operator that can demonstrate independent audit, appeal rights, judicial oversight and data minimisation - from day one, in code - converts the most probable attack on the venture into its strongest proof of trustworthiness. Ethics infrastructure is not overhead; it is the licence to operate the mission phases at scale."
  )
);

// ===========================================================================
// 10. RISK REGISTER AND MITIGATION
// ===========================================================================
chapters.push(
  h1("10. Risk Register and Mitigation"),
  body(
    "Table 8 registers the twelve most material implementation risks, each with likelihood and impact ratings, the primary mitigation and the accountable owner. The register is a living document: it is reviewed at every steering committee meeting, and any risk that materialises is converted into a dated action with a named owner. Three risks - R-01, R-02 and R-05 - warrant standing agenda status because they combine high impact with only partially controllable causes.",
    { keepNext: true }
  ),
  tableCaption("Implementation risk register"),
  bizTable(
    ["ID", "Risk", "L", "I", "Primary mitigation (owner)"],
    [
      ["R-01", "Ethio-CERT or INSA integration and permissions arrive later than the technical API work assumes", "M", "H", "Design for asynchronous integration; MISP-based feeds as interim; early relationship building via BDU and MInT (Founder)"],
      ["R-02", "The ACFS is publicly framed as a censorship or surveillance tool", "M", "H", "Publish the accountability framework and transparency reports; EHRC audits; judicial-oversight and appeal rights in code; engage civil society early (Founder with advisory board)"],
      ["R-03", "Grant or equity funding falls short of the stage plan", "M", "H", "Milestone-gated tranches; revenue-first sequencing; cost floor preserved - the venture can hold at any gate (Founder)"],
      ["R-04", "Bank and government procurement cycles delay pilot start or conversion", "H", "M", "Run MFIs and SMEs in parallel from day one; channel partners carry mid-market; negotiate reference rights early (BD manager)"],
      ["R-05", "Senior engineers leave for remote or foreign employers", "H", "H", "Equity pool; market-band reviews; university affiliation benefits; documented two-person ownership of every critical system (CTO)"],
      ["R-06", "Foreign-exchange scarcity and birr volatility distort costs and pricing", "H", "M", "Planning-rate re-validation at each gate; forex clauses in enterprise contracts; lean import dependence; USD-denominated cloud spend monitored monthly (Finance)"],
      ["R-07", "The platform itself is breached or suffers a serious outage", "L", "H", "Stage-0 hardening and penetration testing; 24/7 internal monitoring; tested incident response; cyber insurance (CTO)"],
      ["R-08", "CII operators restrict OT/SCADA access, delaying the Phase 5 pilot", "H", "M", "Begin with IT-side monitoring; build a testbed per NIST SP 800-82; conservative response doctrine per the proposal (CTO)"],
      ["R-09", "International vendors localise and compete on price", "M", "M", "Deepen the moat: 47-rule mapping, Ethiopian-language NLP, sovereignty hosting, CERT integration (Founder)"],
      ["R-10", "Handling sensitive content data creates legal or political exposure", "M", "H", "Strict data minimisation per proposal (safe content not stored; 90-day retention); transparency logging; judicial oversight (Compliance counsel)"],
      ["R-11", "Oromo and Tigrigna training data remains too scarce for the accuracy targets", "H", "M", "University data partnerships; collaboration with the Ethiopian AI Institute; staged annotation plan; realistic target-setting at G4 (NLP lead)"],
      ["R-12", "The initiative remains dependent on a single founder", "M", "H", "Advisory board with mandate; deputy ownership of workstreams; documentation culture; BDU institutional continuity (Steering committee)"],
    ],
    [7, 28, 5, 5, 55]
  ),
  body(
    "Likelihood (L) and impact (I) are rated high, medium or low against the three-year plan. The register deliberately includes reputational and political risks alongside technical and financial ones, because in this domain they are the ones most likely to end the venture rather than merely slow it."
  )
);

// ===========================================================================
// 11. MONITORING, EVALUATION AND SUCCESS METRICS
// ===========================================================================
chapters.push(
  h1("11. Monitoring, Evaluation and Success Metrics"),
  body(
    "The proposal already defines its success numerically through research questions RQ1 to RQ6 and the Digital Ethiopia 2030 KPI alignment; the implementation inherits that discipline rather than inventing a new one. Table 9 consolidates the operating metrics pack: each metric carries its baseline from the proposal, its target, the gate at which it is assessed and its data source. The pack is produced quarterly, reviewed by the steering committee, and forms the core of the independent evaluation Bahir Dar University supervises as part of the research relationship. Negative results are reported and published per the Design Science Research commitment - the credibility this buys with funders and the scientific community outweighs the short-term cost of imperfect numbers.",
    { keepNext: true }
  ),
  tableCaption("Operating metrics framework mapped to proposal research questions"),
  bizTable(
    ["Metric", "Baseline", "Target", "Gate", "Source"],
    [
      ["Compliance audit time reduction (RQ1)", "40 - 80 hours manual", "Above 70 percent reduction", "G2", "Pre/post pilot time tracking, 10 organisations"],
      ["Detection-to-notification latency (RQ3)", "Hours to days", "Median below 15 minutes", "G2, G3", "SOC log analysis, pilot banks"],
      ["Platform availability (RQ4)", "Not applicable", "Above 99.5 percent; fewer than 10 API errors per 1,000 calls", "G2, G3", "Uptime and error monitoring"],
      ["Student knowledge gain, treatment vs control (RQ2)", "No curriculum exists", "Above 60 percent improvement", "G3", "Pre/post assessment, ANOVA analysis"],
      ["ACFS detection quality (RQ5)", "No system exists", "F1 above 85 percent; false positives below 5 percent", "G4", "Held-out labelled test sets (10,000 examples)"],
      ["CII detection latency (RQ6)", "Hours to days", "Below 5 minutes (IT); below 15 minutes (OT)", "G4", "SOC logs and sector drills"],
      ["Paying organisations", "0", "20+ by G3; 500+ organisations on tooling by G4", "G3, G4", "Finance records"],
      ["Institutions trained (awareness platform)", "0", "5 pilot schools by G3; 100,000+ students reached by Year 2 of scale-up", "G3, G4", "Platform analytics"],
    ],
    [26, 15, 22, 8, 29]
  ),
  body(
    "Two design rules keep the framework honest. First, every metric is measured by a mechanism that exists before the metric is needed - time-tracking instruments, monitoring dashboards and assessment tools are Stage 0 and Stage 1 deliverables, not retrofits. Second, the metrics pack separates operational indicators, which management reviews monthly, from evaluation indicators, which the university-supervised research process assesses at gates, so that commercial pressure never quietly rewrites the research record."
  )
);

// ===========================================================================
// 12. FIRST 90 DAYS: IMMEDIATE ACTION PLAN
// ===========================================================================
chapters.push(
  h1("12. First 90 Days: Immediate Action Plan"),
  body(
    "Everything in this roadmap eventually depends on the next ninety days, because the foundation stage is where the venture either acquires the legal, institutional and technical footing that the rest of the plan assumes, or accumulates delays that compound through every later stage. Table 10 sets out the week-by-week programme with owners and verifiable deliverables. The cadence is deliberately front-loaded: institutional and legal items start in week one because their completion timelines are outside the venture's control.",
    { keepNext: true }
  ),
  tableCaption("Ninety-day action plan"),
  bizTable(
    ["Window", "Actions", "Owner", "Verifiable deliverable"],
    [
      ["Weeks 1-4", "Initiate company registration; draft the BDU agreement; commission the independent security assessment of the Phase 1-2 codebase; begin research ethics submission; shortlist grant programmes", "Founder with counsel", "Registration filed; agreement draft circulated; assessment engagement signed; ethics dossier submitted; grant shortlist approved"],
      ["Weeks 5-8", "Hire CTO and two senior security engineers; negotiate pilot memoranda with CBE and Dashen Bank; introductory meetings with INSA, MInT and Ethio-CERT; contract sovereign-cloud hosting", "Founder; CTO from week 5-8", "Three senior hires signed; two pilot MOUs in signature; meeting records and agreed follow-ups with each agency; hosting contract executed"],
      ["Weeks 9-12", "Deploy hardened Phase 1 for the first two anchor tenants; commission the penetration test; submit the first grant applications; seat the advisory board; hold steering committee meeting one", "CTO; Founder", "Two tenants live on production hosting; penetration test underway; three or more grant applications submitted; board seated with charter; first minutes and decision log issued"],
    ],
    [12, 38, 16, 34]
  ),
  bodyRuns([
    ["By day ninety, the initiative should be able to answer yes to four questions: does a legal entity exist that a bank can contract with; is there a signed institutional agreement with Bahir Dar University; is the platform running, hardened, on Ethiopian sovereign infrastructure for real users; and is there a funded, governed pipeline into the Stage 1 pilots. If any answer is no, the correct response is to extend Stage 0 and hold the gate - ", false],
    ["the roadmap protects that choice deliberately", true],
    [", because every later stage depends on these foundations being real rather than nominal.", false],
  ]),
  body(
    "The original proposal closed with a call to Bahir Dar University to anchor Ethiopia's transition to a digitally sovereign, cybersecurity-capable nation. The operational version of that call is narrower and more testable: with the entity registered, the agreement signed, the platform hardened and the anchor pilots underway within ninety days, Adwa Cyber enters 2027 as a governed, evidence-producing, revenue-track venture positioned to execute all five phases on the timeline this document sets out. The threat statistics that motivated the proposal are not improving, the regulatory clock of Proclamation No. 1321/2024 is already running for every organisation it covers, and the policy window opened by the National Cybersecurity Policy and Digital Ethiopia 2030 is open now. The recommendation of this roadmap is to move accordingly."
  )
);

module.exports = chapters;
