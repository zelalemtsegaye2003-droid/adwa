/** 06 Product & Service Roadmap 2027-2029. */
const C = require("./common.js");
const fs = require("fs");

const cover = C.buildCoverR1({
  title: "Adwa Sec — Product and Service Roadmap",
  subtitle: "From verified MVP to national platform: 2027–2029 milestones with exit criteria",
  englishLabel: "PRODUCT ROADMAP",
  metaLines: [
    "Venture: Adwa Sec",
    "Authors: Solomon Asalif & Zelalem Tsegaaye, Founders",
    "Date: November 2026",
    "Scope: platform modules, services, certification and market milestones",
  ],
  footerLeft: "Adwa Sec — Startup Application Package",
  footerRight: "Confidential",
  palette: C.P,
});

const body = [
  C.h1("1. Where the Product Stands Today"),
  C.para("The roadmap starts from an unusual position: the engineering risk is already retired. The Adwa Sec platform exists as a working, tested MVP, verified by 766 automated checks across a CI-enforced battery (lint, typecheck, production build, full test suite and Docker deployment smoke on every push). What ships today:"),
  ...C.dataTable({
    headers: ["Capability", "Status", "Verification"],
    widths: [34, 18, 48],
    caption: "Table 1: Current state of the platform (November 2026)",
    rows: [
      ["Compliance engine — 47 obligations of Proclamation 1321/2024 + 30 of NBE SBB/83/2022, scoring, findings, SLAs, evidence vault, bilingual reports", "Complete", "Scan-integrity and lifecycle suites; submission requires 100 percent explicit answers; every N/A carries justification"],
      ["VAPT Center — asset registry incl. shadow-IT EASM, live OWASP-aligned DAST with proof bundles, CVSS+EPSS+KEV prioritisation (P1–P4), remediation SLA queue", "Complete (reference CVE catalogue for infrastructure; honestly labelled)", "83-check VAPT suite; the engine runs a real non-destructive scan of the platform itself in the demo"],
      ["AD Attack Paths — BloodHound-style multi-hop analysis over a 15-node/19-edge reference topology", "Complete (reference topology; live directory ingestion is roadmap)", "12 computed attack paths; chokepoint and tier-0 exposure verified in tests"],
      ["Bid Matrix — all 66 NBE LOT4 tender lines with status, response text, evidence pointers, SBD CSV export", "Complete", "27 full / 21 partial / 18 roadmap statuses with per-line evidence links"],
      ["SOC / CERT — NIST SP 800-61 lifecycle, threat-intel sharing, Ethio-CERT synchronisation with SHA-256 receipts", "Pilot-grade", "SOC suite green; detection-to-notification latency target (<15 min) instrumented"],
      ["Awareness — Amharic-first curriculum (8 units, 32 quizzes), pseudonymised minors, parental consent", "Pilot-grade", "Awareness suites incl. tools-API checks; RQ2 treatment/control evaluation design"],
      ["Identity & hardening — MFA/TOTP, JWT rotation with reuse detection, multi-tenant RBAC, captcha, rate limits, audit trail", "Complete", "218-check auth/OWASP/recovery battery"],
    ],
  }),
  C.para("Two governing principles carry through every subsequent milestone. First, honest labelling: no simulated or reference component is ever presented as live coverage — every engine mode is recorded and displayed. Second, evidence integrity: every claim in this roadmap is written to be verifiable, by automated test, audit trail or third-party certification."),
  C.h1("2. Roadmap at a Glance"),
  ...C.dataTable({
    headers: ["Period", "Product milestones", "Commercial / institutional milestones"],
    widths: [16, 44, 40],
    caption: "Table 2: 2027–2029 roadmap overview",
    rows: [
      ["Q1 2027", "Production hardening; PostgreSQL deployment; Ethiopian hosting; live NVD/CISA-KEV vulnerability feed replacing the reference catalogue", "PLC registration; Bahir Dar University technology-transfer agreement; signed letters of intent with pilot institutions; first paid pilot contracts"],
      ["Q2 2027", "Tenant onboarding workflow; pilot-scoped integrations; executive PDF branding", "First paid pilots live (anchor bank + MFIs); pilot steering committees start; monthly founder letters to INSA/Ethio-CERT liaison"],
      ["Q3 2027", "SOC stand-up to 24/5 coverage; alert triage runbooks; containment automation expansion", "ISO 27001 Stage 1 audit; second wave pilots; first VAPT engagements delivered on the platform"],
      ["Q4 2027", "Live Active Directory ingestion (identity connector replacing the reference topology); authenticated web-application scanning", "Pilot evaluations published; GCI-contribution data; seed-round data room assembled; awareness five-school pilot (RQ2) completed"],
      ["2028 H1", "Agent-based infrastructure scanning; SAST/SCA repository analysis for code-auditing services", "12 subscribing institutions; SOC retainers sold; seed round opened on pilot metrics"],
      ["2028 H2", "SIEM and ITSM bidirectional integrations; multi-entity consolidated reporting for groups", "Monthly run-rate break-even (Q4); partnerships channel signed (integrators, audit firms)"],
      ["2029", "Cloud posture (CSPM/CIEM) connectors; regional multi-tenant deployment option", "28 subscribing institutions; first profitable year; regional expansion decision"],
    ],
  }),
  C.h1("3. 2027 in Detail — the Make-or-Break Year"),
  C.h2("3.1 First quarter: institution and infrastructure"),
  C.para("The quarter converts a research artefact into a company. The PLC is registered with the two founders — Solomon Asalif and Zelalem Tsegaaye — as initial shareholders and a clean IP ledger assigning all pre-incorporation work to the company; the technology-transfer and affiliation agreement is executed with Bahir Dar University; and the engineering hiring plan is funded, with the first engineers landing from July 2027 per the payroll plan. In parallel the platform moves from development to production: PostgreSQL deployment on Ethiopian hosting (satisfying the data-localisation provisions of Proclamation 1321/2024), and the vulnerability catalogue is swapped from the bundled reference set to a live NVD/CISA-KEV feed — a data-source change behind the existing engine interface, which is how the engine was designed. Exit criteria: company registered, agreement signed, production URL serving health checks, live feed refreshing on schedule, letters of intent converted into at least two paid pilot contracts."),
  C.h2("3.2 Second quarter: pilots with consequences"),
  C.para("Pilot institutions are onboarded with the tenant workflow: their own obligation scans, findings queues, evidence vaults and executive reports. Each pilot runs under a steering committee that meets monthly — the customer-success motion disguised as governance. Pricing is pilot-priced: a discount against annual list, never free, so that renewal is a commercial decision rather than a reawakening. Exit criteria: all pilot tenants producing regulator-grade evidence packs; at least one executive report consumed by a bank board; zero critical audit findings on the platform's own hardening checks."),
  C.h2("3.3 Third quarter: SOC stand-up and certification"),
  C.para("The SOC/CERT module graduates from pilot to service: 24/5 analyst coverage (building to 24/7 in 2028), documented triage runbooks aligned to NIST SP 800-61, and the detection-to-notification latency dashboard live for pilot customers. ISO 27001 Stage 1 audit is taken in this quarter — the certification budget in the financial plan is sized for exactly this. Exit criteria: median notification latency inside the 15-minute target on instrumented incidents; Stage 1 passed with a dated Stage 2 plan."),
  C.h2("3.4 Fourth quarter: the two engines of proof"),
  C.para("Two proof engines close the year. Technically, the AD Attack Paths module moves from its reference topology to live directory ingestion through an identity connector — turning the tender's most differentiating requirement (§G) into a continuously refreshed view of a real bank's domain. Commercially, the pilot evaluations are written and published: audit-time reduction against the 40–80 hour manual baseline, remediation SLA adherence rates, and the RQ2 treatment/control results from the five-school Amharic awareness pilot. Exit criteria: live AD graph for at least one production tenant; awareness pilot evaluated; seed-round data room complete (metrics, references, certification status, roadmap)."),
  C.h1("4. 2028 — Productise and Sell"),
  C.para("The 2028 product line completes the tender roadmap honestly: agent-based infrastructure scanning and SAST/SCA repository analysis become services (closing the two largest 'roadmap' categories in the bid matrix), SIEM and ITSM integrations make the platform a citizen of the enterprise it defends, and multi-entity consolidated reporting opens the group-bank and MFI-federation segments. Commercially the year is defined by the shift from founder-led sales to a repeatable motion: a partnerships lead, an integrator channel and the audit-firm referral channel — while the founders open the seed round on pilot metrics rather than promise, in line with the funding strategy's principle that equity is sold last, on evidence. The year-end target is 12 subscribing institutions, 4 SOC retainer clients and monthly run-rate break-even in the fourth quarter."),
  C.h1("5. 2029 — National Footprint and Regional Option"),
  C.para("With 28 subscribing institutions and the first profitable year, 2029 adds cloud posture management (CSPM/CIEM connectors for the banks' growing cloud estates) and evaluates regional expansion — a multi-tenant deployment option for neighbouring markets whose regulators are converging on Ethiopia's data-protection model. The decision is made deliberately late, on the same discipline as the seed round: only after the Ethiopian plan is proven, staffed and profitable. The regional option remains exactly that — an option, not a plan dependency."),
  C.h1("6. Sequencing Risks and Dependencies"),
  ...C.dataTable({
    headers: ["Dependency", "Risk if late", "Buffer in the plan"],
    widths: [34, 30, 36],
    caption: "Table 3: Critical dependencies and buffers",
    rows: [
      ["PLC registration (Q1 2027)", "No bank can sign a paid pilot with an unregistered entity; grants cannot be disbursed", "Registration is the first use of funds; indicative 2–6 weeks; counsel engaged at formation"],
      ["Bahir Dar University agreement", "Intern pipeline and institutional credibility delayed; ethical-review pathway unclear for school pilots", "Approach with a draft agreement; university incentivised by IP and royalty terms already proposed"],
      ["INSA authorisation pathway confirmation", "Selling monitoring beyond pilot scope risks regulatory exposure", "Written confirmation sought before SOC retainers are sold; retainers scheduled only from Q4 2027"],
      ["Live NVD/KEV feed integration", "Reference catalogue remains labelled 'simulated' for infrastructure findings", "Data-source swap behind a stable engine interface; deliberately designed-in from the first build"],
      ["ISO 27001 Stage 1", "Bank procurement eligibility limited; enterprise deals slow", "Certification budgeted at ETB 2.25M in 2027; Stage 2 scheduled with dated plan"],
    ],
  }),
  C.para("The roadmap's honest-labelling principle doubles as its risk discipline: because every capability claim is already tagged complete, partial or roadmap, slippage is visible early and re-planning is a table edit, not a credibility event. Each quarter's exit criteria are the founders' operational contract with the plan — and, cumulatively, the incubator's instrument for tracking this venture's execution."),
];

const doc = C.makeDoc({ cover, toc: C.tocBlock(), body, headerTitle: "Adwa Sec — Product and Service Roadmap" });
C.docx.Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync("/home/z/my-project/download/AdwaSec_06_Product_Roadmap.docx", buf);
  console.log("written: AdwaSec_06_Product_Roadmap.docx");
});
