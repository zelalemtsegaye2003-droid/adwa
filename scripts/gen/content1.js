/**
 * content1.js - Chapters 1-4
 */
const {
  h1, h2, body, bodyRuns, tableCaption, figCaption, bizTable, image,
} = require("./helpers");

const ASSETS = process.cwd() + "/scripts/assets";

const chapters = [];

// ===========================================================================
// 1. EXECUTIVE SUMMARY
// ===========================================================================
chapters.push(
  h1("1. Executive Summary"),
  body(
    "This roadmap translates the Adwa Cyber Startup Proposal (v1.0, May 2026) into an executable 36-month implementation plan. It is written for the founder and for the two audiences whose decisions matter most in the next twelve months: Bahir Dar University, which is invited to serve as the academic home and research supervisor of the initiative, and the early funding partners whose support will carry the platform from a research artefact to operational national infrastructure. Every recommendation in this document is traceable to a specific section of the original proposal, and every figure is presented as an indicative planning estimate with its assumptions stated."
  ),
  body(
    "The starting position is stronger than most university laboratory ventures can claim. Phase 1, the compliance automation engine for the Personal Data Protection Proclamation No. 1321/2024, and Phase 2, the CERT-as-a-Service capability, are already implemented as working software: all 47 rules of the Proclamation are mapped to code, the threat-intelligence hub, the 24/7 SOC monitoring interface, the incident-response workflow and the Ethio-CERT synchronisation layer exist. What they are not yet is a production-grade, revenue-bearing product. The dashboards currently run on localhost; there is no legal entity able to sign a pilot agreement with a commercial bank, no support model, no independent security certification, and no paying customer."
  ),
  bodyRuns([
    ["The core recommendation of this roadmap is to ", false],
    ["sequence the commercial phases before the mission phases", true],
    [". Phases 1 and 2 should be hardened, piloted and converted into recurring revenue within eighteen months, because they address urgent, regulated demand - financial institutions face penalties of up to 4 percent of global turnover and executive imprisonment under Proclamation No. 1321/2024 - and because that revenue funds everything else. Phases 3 to 5 (multilingual awareness, content filtering and critical-infrastructure protection) should follow on a grant-funded track under university research oversight, entering the field only after the Stage 2 gate criteria defined in Chapter 4 are met.", false],
  ]),
  body(
    "The plan runs in four stages separated by explicit gates. Stage 0 (Months 1-3) builds the foundation: legal entity, university agreement, core team and security hardening. Stage 1 (Months 4-9) executes the commercial pilots with the banks, microfinance institutions and SMEs named in the proposal. Stage 2 (Months 10-18) converts pilots into subscriptions and activates the 24/7 SOC. Stage 3 (Months 19-36) delivers the awareness platform, the AI Content Filtering System and the critical-infrastructure pilot. The indicative Year-1 budget is USD 590,000; the cumulative three-year requirement is approximately USD 2.5 million, offset by pilot and subscription revenue projected from late Year 1 (Chapter 6). The recommended funding blend combines research and development grants for the mission phases, revenue for commercial operations, and a single strategic equity round in Year 2 for scale - always milestone-gated, never front-loaded (Chapter 7)."
  ),
  body(
    "The principal risks are dependence on government integration timelines, the perception risk attached to content filtering, talent retention and foreign-exchange constraints; each is addressed in Chapter 10 with a named mitigation and owner. The immediate priority is the 90-day action plan in Chapter 12: register the entity, sign the university agreement, harden the platform, and secure anchor pilot agreements. The threat landscape documented in the proposal - Ethiopia ranked first globally for malware detections and more than 27,000 recorded attacks in a six-month period - is not improving, and the policy momentum created by the National Cybersecurity Policy and Digital Ethiopia 2030 will not wait."
  )
);

// ===========================================================================
// 2. READINESS ASSESSMENT
// ===========================================================================
chapters.push(
  h1("2. Readiness Assessment: Where the Proposal Stands Today"),
  h2("2.1 Implemented Assets"),
  body(
    "The proposal reports two phases as implemented and a third in development. Concretely, the Phase 1 codebase contains the 47-rule compliance engine for Proclamation No. 1321/2024, a web compliance dashboard, an executive reporting dashboard, an Amharic-language dashboard and a REST API for third-party integration. The Phase 2 codebase contains the threat-intelligence hub, the SOC monitoring interface, the incident-response workflow covering containment, eradication, recovery and closure, the Ethio-CERT API synchronisation layer and the privacy-preserving sharing protocols derived from the AAU collaborative framework. Phase 3 has a completed platform design, a complete Amharic curriculum translation, 60 percent of AI training data collected and 30 percent of model development. Table 1 summarises the readiness position of each phase across the five dimensions that determine whether a pilot can begin."
  ),
  tableCaption("Readiness position by phase (status per proposal Sections 7-11)"),
  bizTable(
    ["Phase and product", "Product", "Infrastructure", "Team", "Legal / commercial", "Evidence"],
    [
      ["Phase 1 - Compliance automation", "Working software, all 47 rules mapped", "localhost only; no sovereign hosting", "Founder-led", "No entity, no DPA templates", "No independent audit"],
      ["Phase 2 - CERT-as-a-Service", "Core SOC and TI components built", "No 24/7 operations; no SLA engineering", "No SOC shifts staffed", "No service contracts", "No latency or uptime data"],
      ["Phase 3 - Awareness platform", "Design and Amharic curriculum complete; AI 30 percent", "Not deployed", "No curriculum staff", "No school agreements", "No controlled study"],
      ["Phase 4 - ACFS content filtering", "Proposed; detectors specified", "Not built", "No NLP team", "No EMA relationship", "No labelled test sets"],
      ["Phase 5 - CII protection", "Proposed; architecture specified", "Not built", "No OT engineers", "No CII operator agreements", "No sector drills"],
    ],
    [20, 17, 17, 14, 17, 15]
  ),
  h2("2.2 The Gap Between Implemented and Deployable"),
  body(
    "The distance between a component that is implemented and a service that a commercial bank can safely subscribe to is the central execution challenge of this roadmap. A compliance platform must itself comply with the very law it automates; a security operations centre that is itself breachable would destroy, in a single incident, the credibility the initiative has built. Closing this gap requires six workstreams: migration from development machines to Ethiopian sovereign-cloud hosting with data residency guarantees; availability engineering against the 99.5 percent uptime target the proposal sets for itself; an independent security assessment and penetration test of the existing codebase; a support model with defined response times and escalation paths; the legal vehicle, data-processing agreements and service terms required to sign customers; and the beginnings of an ISO/IEC 27001 certification path that bank procurement departments will eventually demand."
  ),
  body(
    "None of these workstreams is optional, and all of them belong in Stage 0, before the first external pilot. The pilot organisations named in the proposal - the Commercial Bank of Ethiopia, Dashen Bank, the Wasasa, Oromia and Amhara microfinance institutions, Ethio Telecom and the Ministry of Innovation and Technology - are precisely the organisations whose reference value is highest and whose tolerance for a fragile pilot is lowest. A failed or embarrassing pilot at a state-owned bank would be far more damaging than a delayed one."
  ),
  h2("2.3 Strengths Worth Preserving"),
  body(
    "Four strengths in the current position should be protected as the venture formalises. First, the policy alignment is genuine and specific: every product is mapped to sections of the National Cybersecurity Policy, Digital Ethiopia 2030 and the relevant proclamations, which shortens every government conversation. Second, the Design Science Research methodology and the six measurable research questions give the initiative a built-in monitoring and evaluation framework that most startups lack and most donors require. Third, the open-source technology stack - Wazuh and Elastic Security for compliance and SIEM, MISP for threat intelligence, AfroXLMR-based models for Ethiopian-language NLP - keeps licensing costs near zero and supports the sovereignty narrative. Fourth, the university affiliation provides research supervision, ethical review, facilities and credibility that a private startup cannot buy."
  )
);

// ===========================================================================
// 3. STRATEGIC RECOMMENDATIONS
// ===========================================================================
chapters.push(
  h1("3. Strategic Recommendations"),
  body(
    "Seven recommendations follow from the readiness assessment. They are ordered by urgency, and each is formulated so that its completion can be verified at a stage gate."
  ),
  h2("3.1 Sequence Revenue Before Mission"),
  body(
    "The proposal presents five phases in policy order; the implementation should run them in demand order. Phases 1 and 2 serve institutions that are already legally compelled to act - Proclamation No. 1321/2024 carries penalties of up to 4 percent of global turnover and imprisonment for executives - and that have budget lines for compliance and security today. Phases 3 to 5 serve schools, media regulators and critical-infrastructure operators whose procurement cycles are slower and whose funding is largely public. Running the revenue phases first is therefore not a retreat from the mission; it is the only sequence in which the mission phases are financed by something other than hope. The gate structure in Chapter 4 enforces this discipline."
  ),
  h2("3.2 Formalise the University Anchoring Immediately"),
  body(
    "The proposal asks Bahir Dar University to be the academic home of the initiative; the implementation needs this converted from an aspiration into a signed agreement within the first ninety days. The agreement should cover five points: the research supervision and ethical review relationship; access to laboratory space and computing facilities; the treatment of intellectual property created before and after the agreement; the pilot facilitation role with government stakeholders; and the use of the university's name in communications. An ambiguous arrangement here will surface later as a funding obstacle, because grant committees and investors both examine institutional arrangements early."
  ),
  h2("3.3 Secure Regulatory Goodwill Before You Need It"),
  body(
    "Three relationships determine the venture's ceiling: the Information Network Security Administration (INSA), the Ministry of Innovation and Technology (MInT) and Ethio-CERT. The Ethio-CERT API integration described in Phase 2 already exists technically, but its official status, data-sharing permissions and escalation protocols need documented government agreement. Equally important, the platform must register and comply with the Personal Data Protection Proclamation it automates - the fastest way to lose a compliance pitch is to be asked whether your own house is in order. Introductory meetings in the first ninety days, before any favour is requested, are worth more than formal applications made under deadline pressure later."
  ),
  h2("3.4 Harden to Production Standard Before the First Pilot"),
  body(
    "The first external deployment of the compliance engine and the SOC interface must be preceded by an independent security assessment and penetration test, migration to sovereign hosting, and a documented incident-response and support procedure. The proposal sets a 99.5 percent uptime target for itself; that target must be engineered, measured and reported from the first pilot day. This is also the moment to establish the secure development lifecycle - code review, dependency scanning, secrets management - that every subsequent phase inherits. Chapter 4 places this work in Stage 0 and makes its completion a gate criterion."
  ),
  h2("3.5 Build the Ethics Infrastructure as a Product Feature"),
  body(
    "The accountability framework in the proposal - transparency logging, the three-tier appeal process, the judicial-oversight requirement for permanent content removal, the 30-day expiry of content flags, quarterly audits by the Ethiopian Human Rights Commission and strict data minimisation - is often treated as a compliance appendix. It should instead be implemented early and marketed as a differentiator. For the banks, it answers procurement due-diligence questions; for the donors, it answers safeguarding questions; for the public debate that will inevitably surround any filtering system in Ethiopian languages, it is the difference between a defensible system and a controversial one. The technical components (transparency logs, appeal workflows) belong in the common services layer, not in Phase 4."
  ),
  h2("3.6 Distribute Through Partners, Not Headcount"),
  body(
    "A twelve-person team cannot sell to thousands of Ethiopian organisations directly, and it should not try. The natural channels already exist: audit and consulting firms that today sell the manual 40-to-80-hour compliance audits the platform automates can be converted into resellers and implementation partners; Ethio Telecom can bundle awareness and SME security services; the university network and the Ministry's digital-skills programmes provide reach into schools and the public sector. Partner-led distribution also keeps customer-acquisition cost low enough for the SME price points proposed in Chapter 8."
  ),
  h2("3.7 Engineer Against Key-Person and Talent Risk"),
  body(
    "The initiative currently depends on one founder, and the market it competes in - international vendors and remote employers - can outbid an Ethiopian startup for senior engineers. Two mitigations belong in the company's foundation rather than in a later policy: an employee equity pool of 10 to 15 percent with vesting, and a deliberate knowledge-transfer regime in which every critical system is documented and co-owned by two people. The university affiliation is itself a retention asset: research co-authorship, adjunct appointments and laboratory roles give the venture a form of compensation that remote employers cannot match."
  )
);

// ===========================================================================
// 4. PHASED IMPLEMENTATION ROADMAP
// ===========================================================================
chapters.push(
  h1("4. Phased Implementation Roadmap (36 Months)"),
  h2("4.1 Roadmap Overview and Stage Gates"),
  body(
    "The roadmap is organised as four stages separated by three formal gates (G1, G2, G3) and a closing assessment (G4). A gate is a go, hold or fix decision taken by the steering committee described in Chapter 9 against pre-committed criteria; funding tranches described in Chapter 7 are released on gate decisions, not on calendar dates. Figure 1 shows the timeline; Table 2 defines each stage and its gate criteria.",
    { keepNext: true }
  ),
  image(ASSETS + "/timeline.png", 580, 2143, 963),
  figCaption("Thirty-six-month implementation timeline with stage gates G1-G4."),
  tableCaption("Stage definitions and gate criteria"),
  bizTable(
    ["Stage", "Window", "Focus", "Gate criteria (go decision)"],
    [
      ["Stage 0 - Foundation", "Months 1-3", "Legal entity; BDU agreement; core hires; production hardening; sovereign hosting", "G1: entity registered; BDU agreement signed; security assessment closed; hardened Phase 1 deployed; 2 senior engineers onboard"],
      ["Stage 1 - Commercial validation", "Months 4-9", "Pilots with banks, MFIs and SMEs; research evaluation per RQ1, RQ3, RQ4", "G2: 8+ pilot organisations live; audit-time reduction above 70 percent; median detection-to-notification below 15 minutes; 2+ signed letters of intent"],
      ["Stage 2 - Revenue and scale", "Months 10-18", "Paid conversions; 24/7 SOC go-live; school pilot per RQ2; ISO 27001 stage 1", "G3: 20+ paying organisations; annual recurring revenue above USD 250,000; 24/7 SOC staffed; school knowledge gain above 60 percent vs control"],
      ["Stage 3 - Mission expansion", "Months 19-36", "ACFS with EMA; CII pilot with four operators; regional replication study", "G4: ACFS F1 above 85 percent with false positives below 5 percent; CII latency targets met; 500+ organisations on compliance tooling"],
    ],
    [17, 11, 30, 42]
  ),
  h2("4.2 Stage 0 - Foundation (Months 1-3)"),
  body(
    "Stage 0 converts a research laboratory into a venture. Its deliverables are: registration of the legal entity; signature of the Bahir Dar University agreement described in Section 3.2; onboarding of the chief technology officer and two senior security engineers; migration of the Phase 1 and Phase 2 codebases to Ethiopian sovereign-cloud hosting; completion of an independent security assessment and penetration test with all critical findings closed; and establishment of the support, backup and monitoring procedures that the 99.5 percent uptime commitment requires. Stage 0 also seats the advisory board and holds the first steering committee meeting, so that governance exists before scale does. The 90-day plan in Chapter 12 details the weekly sequence."
  ),
  h2("4.3 Stage 1 - Commercial Validation (Months 4-9)"),
  body(
    "Stage 1 executes the pilot design already specified in the proposal, with the participants already named: the Commercial Bank of Ethiopia and Dashen Bank for Phases 1, 2 and 5 observation; the Wasasa, Oromia and Amhara microfinance institutions for Phases 1 and 2; five SMEs drawn from e-commerce, logistics and fintech; and structured observation with the Ministry of Innovation and Technology and INSA. The stage is also the evaluation window for research questions RQ1, RQ3 and RQ4: pre- and post-pilot audit-time tracking across ten organisations, SOC log latency analysis for the financial institutions, and uptime and API-error monitoring. Evaluation is not a by-product of the pilots; it is a deliverable of equal rank, because the resulting evidence is what unlocks both the Stage 2 funding tranche and the academic publications the DSR methodology commits to."
  ),
  h2("4.4 Stage 2 - Revenue and Scale (Months 10-18)"),
  body(
    "Stage 2 converts validated pilots into commercial subscriptions using the pricing architecture in Chapter 8, activates the 24/7 SOC with the shift structure costed in Chapter 5, and begins the ISO/IEC 27001 certification process that bank and government procurement will increasingly require. In parallel, Phase 3 enters the field: the five Addis Ababa public secondary schools named in the proposal run the awareness pilot with pre- and post-assessment against a control group, while curriculum and AI-personalisation work continues in Afan Oromo. The stage ends at gate G3, where the venture must demonstrate that its revenue engine works without research subsidies."
  ),
  h2("4.5 Stage 3 - Mission Expansion (Months 19-36)"),
  body(
    "Stage 3 delivers the three mission phases in ascending order of institutional complexity. The ACFS content-filtering system is developed against the six-detector specification in the proposal and deployed with the media partners named there (Fanaka, Ethio Forum and Sheger FM), under the accountability framework described in Chapter 9. The CII protection pilot follows with the four operators named in the proposal - Ethiopian Electric Power, Ethiopian Airlines, Ethio Telecom and the Commercial Bank of Ethiopia - beginning with IT-side monitoring and proceeding to OT/SCADA anomaly detection under the conservative response doctrine the proposal defines. The stage, and the roadmap, close with a documented replication assessment for other African least-developed countries and a consolidated evidence package mapping the initiative's measurable contribution to Ethiopia's GCI Tier 2 trajectory."
  )
);

module.exports = chapters;
