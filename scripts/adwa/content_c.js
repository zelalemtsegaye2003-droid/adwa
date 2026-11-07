// content_c.js — Sections 11–14
const H = require("./helpers");
const { h1, h2, h3, p, bullet, numbered, tableTitle, makeTable, note } = H;

function build() {
  const c = [];

  // ══════════════════════════════════════════════════════════════
  // 11. RISK REGISTER
  // ══════════════════════════════════════════════════════════════
  c.push(h1("11. Risk Register and Mitigation"));

  c.push(p(
    "The register below scores the twelve risks most likely to affect the roadmap on likelihood (H/M/L) and impact (H/M/L), and assigns each a mitigation and an owner. It should be reviewed monthly by the management team and quarterly by the advisory board, with scores re-judged against the early-warning indicators in Section 11.2."
  ));

  c.push(tableTitle("Risk register (Year 1)"));
  c.push(makeTable({
    headers: ["#", "Risk", "L", "I", "Mitigation", "Owner"],
    widths: [7, 25, 5, 5, 42, 16],
    fontSize: 19,
    vPad: 55,
    rows: [
      ["R1", "Bank and MFI sales cycles stretch beyond the roadmap (procurement, sign-off layers)", "H", "H",
        "Start LOI conversion in Month 1; parallel pipeline across banks, MFIs, SMEs; paid pilot scope kept small enough for single-executive approval; steering-committee rhythm maintains momentum", "Founder"],
      ["R2", "INSA authorisation pathway for a private SOC is unclear or slower than assumed", "M", "H",
        "Seek written confirmation early (Section 6.3); frame pilots as research collaboration under BDU where appropriate; design data handling conservatively (metadata-only)", "Founder / counsel"],
      ["R3", "Proclamation 1321/2024 interpretations shift, invalidating rule mappings", "M", "M",
        "Rule engine designed for update; maintain counsel relationship for regulatory watch; versioned rule releases communicated to customers as a service feature", "CTO"],
      ["R4", "Birr depreciation erodes revenue value while costs are USD-linked", "H", "M",
        "USD-indexed or annually adjusted pricing; USD-denominated cost commitments minimised; grants held in hard currency where permitted", "Finance / Ops"],
      ["R5", "Key-person dependency on the founder", "H", "H",
        "CTO owns architecture; documented systems and decisions; advisory board; BDU agreement institutionalises continuity; key-person insurance at seed round", "Founder / Board"],
      ["R6", "24/7 SOC staffing and fatigue with a small analyst team", "M", "M",
        "Three-shift roster with cross-training; BDU intern support for level-1 triage; automation of alert prioritisation (already an implemented platform feature); hire fourth analyst early if attrition appears", "SOC Manager"],
      ["R7", "Cybersecurity talent attrition to Gulf and remote-first employers", "M", "M",
        "Certification sponsorship; 60th-percentile compensation; option pool; mission brand — retention levers of Section 7.1", "Founder / Ops"],
      ["R8", "A serious security incident at a customer creates liability and reputational damage", "L", "H",
        "Professional indemnity / E&O insurance before pilot signature; conservative SLAs; the proposal's 90-day responsible-disclosure policy; documented IR runbooks; ISO 27001 discipline", "CTO / SOC"],
      ["R9", "Compliance engine false positives undermine customer trust", "M", "M",
        "RQ1-style validation during pilots; human-in-the-loop review tier; transparent rule documentation (open-source API supports scrutiny)", "CTO"],
      ["R10", "Phase 4 political sensitivity contaminates the brand (censorship perception)", "M", "H",
        "Track C deferral; EHRC engagement and published human-rights due diligence before any deployment; the proposal's appeal process and judicial-oversight design adopted verbatim; no public claims before gates pass", "Founder / Board"],
      ["R11", "Grant funding timing gaps create cash-flow stress", "M", "M",
        "Never schedule cash outlays against unawarded grants; 10% contingency; pilot revenue as first charge on fixed costs; monthly rolling 12-month cash forecast", "Finance / Ops"],
      ["R12", "Hosting reliability on Ethiopian infrastructure falls short of enterprise SLAs", "M", "M",
        "Multi-provider redundancy where sovereignty rules permit; transparent uptime reporting; RQ4 target (>99.5%) tracked publicly with customers", "CTO"],
    ],
  }));

  c.push(h2("11.1 The Three Risks That Matter Most"));
  c.push(p([
    { t: "Sales-cycle length (R1) ", b: true },
    { t: "is the risk most likely to bend the roadmap. Ethiopian financial institutions buy deliberately, and a six-month pilot can sit behind three months of procurement. The roadmap absorbs this by starting LOI conversion in Month 1, by keeping the initial paid engagement small enough to be approved by a single executive, and by never letting the pipeline rest on one institution — the MFI and SME segments exist in the plan precisely to provide faster-moving counterparties.",
    },
  ]));
  c.push(p([
    { t: "Key-person risk (R5) ", b: true },
    { t: "is the risk investors will price hardest. A single founder holding all relationships, all architecture knowledge, and all fundraising context is a discount on any term sheet. Every structural mitigation in this roadmap — the CTO hire in Quarter 1, the documentation discipline, the advisory board, the university agreement — is also, deliberately, an investor-readiness measure.",
    },
  ]));
  c.push(p([
    { t: "Phase 4 reputational adjacency (R10) ", b: true },
    { t: "is the risk with the longest shadow. Content filtering in any country sits next to censorship, and for a venture whose credibility rests on a university partnership and development funding, being framed as a surveillance vendor would be disproportionately damaging. The Track C gates exist to make the venture's position unambiguous: no deployment without the EMA partnership, the EHRC-engaged due-diligence report, and the transparency framework the proposal itself designed — appeal tiers, judicial oversight, quarterly independent audit, and 90-day data retention limits, all adopted verbatim.",
    },
  ]));

  c.push(h2("11.2 Early-Warning Indicators"));
  c.push(p(
    "Four indicators should be watched monthly and trigger action when crossed: no signed LOI by the end of Month 3 (sales-cycle risk materialising — escalate partnership channels through BDU and INSA); any pilot customer disengaging from the steering-committee rhythm (conversion risk — founder-level intervention); analyst utilisation above 85 percent for a full month (SOC staffing risk — begin hiring); and any grant rejection citing institutional capacity (governance signal — accelerate advisory-board formation). Indicators are cheap to watch and expensive to ignore; the monthly review should take one hour and follow the register's order."
  ));

  // ══════════════════════════════════════════════════════════════
  // 12. KPI AND MONITORING FRAMEWORK
  // ══════════════════════════════════════════════════════════════
  c.push(h1("12. KPI and Monitoring Framework"));

  c.push(p(
    "Measurement runs on two clocks. Company KPIs are reviewed monthly by management and answer the question \u201cis the business working?\u201d; they borrow their thresholds directly from the proposal's research questions so that commercial and scientific evaluation are the same exercise. National-impact KPIs are reviewed quarterly with the advisory board and university, and answer the question the mission asks: is Ethiopia's cybersecurity posture measurably improving? Both tiers feed the funder and investor reporting cadence established in Sections 9 and 6."
  ));

  c.push(tableTitle("Company KPIs (monthly, with thresholds drawn from the proposal's research questions)"));
  c.push(makeTable({
    headers: ["KPI", "Definition", "Target", "Source"],
    widths: [26, 38, 18, 18],
    rows: [
      ["Monthly recurring revenue", "Contracted subscription + retainer revenue annualised", "Growth each quarter", "Invoicing"],
      ["Pipeline coverage", "Weighted pipeline versus next-quarter revenue target", "\u2265 3\u00d7", "CRM"],
      ["Pilot conversion", "Pilots converting to annual contracts", "50–70%", "Sales records"],
      ["Audit-time reduction", "Automated audit time versus the 40–80-hour manual baseline (RQ1)", "> 70%", "Platform telemetry"],
      ["Detection-to-notification latency", "SOC median across incidents (RQ3)", "< 15 minutes", "SOC logs"],
      ["Platform uptime", "Production availability (RQ4)", "> 99.5%", "Monitoring"],
      ["Alert precision", "Actionable alerts versus total (false-positive control)", "Trend upward; review if < 70%", "SOC logs"],
      ["Retention / NPS", "Contract renewals; customer satisfaction", "NPS \u2265 40 by Month 12", "Quarterly survey"],
    ],
  }));

  c.push(tableTitle("National-impact KPIs (quarterly, aligned to the proposal's outcome tables)"));
  c.push(makeTable({
    headers: ["Indicator", "Baseline (proposal)", "2027 trajectory", "Company contribution"],
    widths: [30, 24, 20, 26],
    rows: [
      ["Organisations using compliance tools", "Near zero", "500 (proposal target)", "Subscriber growth; open-source API adoption"],
      ["Compliance audit duration", "40–80 hours manual", "< 4 hours", "RQ1 telemetry across customer base"],
      ["Incident detection latency (private sector)", "Hours to days", "< 30 minutes", "RQ3 results; CERT client count"],
      ["Sectoral CERT capability", "0 (Ethio-CERT only)", "5 operational", "CERT-as-a-Service clients by sector"],
      ["Schools with Amharic cyber curriculum", "0%", "20% of target schools", "Track B pilot and scale-up"],
      ["GCI trajectory", "Tier 3 (2024)", "Tier 2 path by 2028", "Metrics fed to GCI 2026+ questionnaires via MInT"],
    ],
  }));
  c.push(note("Baselines and targets are taken from the proposal's expected-results and next-steps tables; company contribution is the measurable share this venture can evidence."));

  c.push(p(
    "Evaluation integrity is protected by the DSR design already in the proposal: paired t-tests for audit-time comparison, ANOVA for the school pilot's control-group design, and latency distribution analysis for SOC performance. Two additions are recommended for the commercial context. First, a data-quality gate: every KPI reported to funders or investors must be traceable to a system of record (invoicing, platform telemetry, or SOC logs), never to manual recollection. Second, the ethical safeguards the proposal commits to — metadata-only audits, parental consent in schools, the 90-day disclosure policy — should be reported on the same cadence as the KPIs, so that governance is measured with the same seriousness as growth."
  ));

  // ══════════════════════════════════════════════════════════════
  // 13. FIRST 90 DAYS
  // ══════════════════════════════════════════════════════════════
  c.push(h1("13. First 90 Days: The 30-60-90 Action Plan"));

  c.push(p(
    "Everything in this roadmap reduces, in the end, to a small number of concrete acts in the next ninety days. The plan below is written to be executed as written: each action has a due day, an owner, and a deliverable that either exists or does not. Its logic follows Section 4's first quarter — foundation, then traction, then launch."
  ));

  c.push(tableTitle("30-60-90 day action plan"));
  c.push(makeTable({
    headers: ["Window", "Action", "Owner", "Deliverable / evidence"],
    widths: [12, 42, 16, 30],
    fontSize: 19,
    rows: [
      ["Days 1–30", "Engage commercial lawyer; begin PLC registration", "Founder", "Engagement letter; registration filed"],
      ["Days 1–30", "Draft and present BDU technology-transfer term sheet", "Founder", "Term sheet delivered to the technology-transfer office"],
      ["Days 1–30", "Deploy production instance on Ethiopian hosting; buy domain; enable HTTPS and monitoring; remove all localhost references", "Founder / CTO", "Live public URL; uptime monitor active"],
      ["Days 1–30", "Assemble LOI package: one-page product briefs per segment, pilot design, pricing intent", "Founder", "Package complete; target list of 12 organisations"],
      ["Days 1–30", "Open company bank account; set up basic bookkeeping and a 12-month cash model", "Founder", "Account operational; model reviewed"],
      ["Days 31–60", "Secure at least two signed letters of intent (banks / MFIs)", "Founder", "Signed LOIs"],
      ["Days 31–60", "Submit first two grant applications (Track B and working capital)", "Founder", "Submissions confirmed"],
      ["Days 31–60", "Hire CTO / senior engineer; begin SOC manager search", "Founder", "Offer signed; candidate pipeline"],
      ["Days 31–60", "Commission ISO 27001 gap assessment", "CTO", "Assessor engaged; scope agreed"],
      ["Days 31–60", "Finalise pilot evaluation plan with BDU ethical review; define data-collection instruments", "Founder / BDU", "Ethics submission; instruments ready"],
      ["Days 61–90", "Sign and launch first paid pilot", "Founder", "Signed contract; kick-off held"],
      ["Days 61–90", "Publish the free compliance-scan offer and run it with five prospects", "CTO / Founder", "Five scan reports delivered; findings logged"],
      ["Days 61–90", "Hold first advisory board meeting; adopt the risk register and KPI baseline", "Founder", "Minutes; baseline recorded"],
      ["Days 61–90", "Submit next grant wave; review the 90-day metrics against this plan and adjust the roadmap", "Founder", "Applications in; variance note written"],
    ],
  }));
  c.push(note("Day counts run from the adoption of this roadmap. \u201cFounder\u201d actions before the CTO hire are executed by the founder with contractor support where needed."));

  // ══════════════════════════════════════════════════════════════
  // 14. CONSOLIDATED RECOMMENDATIONS
  // ══════════════════════════════════════════════════════════════
  c.push(h1("14. Consolidated Strategic Recommendations"));

  c.push(p(
    "The ten recommendations below synthesise the roadmap. Each is stated with its rationale and horizon: immediate (within 30 days), near-term (within 6 months), or structural (within 12 months). They are ordered by priority, not by effort."
  ));

  c.push(numbered("rec-final", [
    { t: "Deploy to production immediately (immediate). ", b: true },
    { t: "Move every dashboard and API off localhost onto a secured, monitored Ethiopian-hosted deployment behind HTTPS. No enterprise buyer, grant reviewer, or ministry official will evaluate a local development address, and the work is measured in days, not months."},
  ]));
  c.push(numbered("rec-final", [
    { t: "Convert claims to commitments (immediate). ", b: true },
    { t: "Replace every \u201cPlanned\u201d pilot with a signed letter of intent before the proposal is shown externally again. One signed bank LOI changes the document's status from promising to credible."},
  ]));
  c.push(numbered("rec-final", [
    { t: "Establish the legal entity and the BDU agreement (immediate). ", b: true },
    { t: "Register the PLC and execute a technology-transfer agreement covering IP, students, facilities, and ethics. This unlocks contracts, grants, and investment — none of which can flow to an informal lab."},
  ]));
  c.push(numbered("rec-final", [
    { t: "Re-sequence into three tracks (immediate). ", b: true },
    { t: "Run Phases 1–2 as the commercial core, Phase 3 as the grant-funded mission track, and Phases 4–5 behind explicit partnership, authorisation, and human-rights gates. Focus is the scarcest resource a nine-person company has."},
  ]));
  c.push(numbered("rec-final", [
    { t: "Charge for pilots (near-term). ", b: true },
    { t: "Six-month paid pilots at a defined discount, never free engagements. Paid pilots select committed customers, fund delivery, and produce the reference stories that sell the next ten."},
  ]));
  c.push(numbered("rec-final", [
    { t: "Adopt USD-indexed or annually adjusted pricing (near-term). ", b: true },
    { t: "Multi-year contracts priced only in birr transfer depreciation risk entirely onto the venture. Pricing discipline set at the first contract is nearly impossible to retrofit."},
  ]));
  c.push(numbered("rec-final", [
    { t: "Pursue ISO 27001 certification as a sales instrument (near-term). ", b: true },
    { t: "Certification is the standard answer to the bank-procurement question \u201cwho audits the auditor?\u201d and, at indicative cost of USD 15,000–30,000, is among the cheapest credibility assets available."},
  ]));
  c.push(numbered("rec-final", [
    { t: "Fund the first year with the hybrid stack (structural). ", b: true },
    { t: "Development-partner grants and university in-kind support first, pilot revenue second, equity last. Approach the funder families in Section 9 with the policy mapping already in the proposal's appendices."},
  ]));
  c.push(numbered("rec-final", [
    { t: "Gate Phases 4 and 5 behind human-rights and institutional criteria (structural). ", b: true },
    { t: "No ACFS deployment without the EMA partnership, EHRC-engaged due diligence, and the proposal's own transparency framework verbatim; no CII monitoring without operator MOUs, confirmed authorisation, and insurance. The gates protect everything else the venture is building."},
  ]));
  c.push(numbered("rec-final", [
    { t: "De-risk the founder (structural). ", b: true },
    { t: "Hire the CTO early, document systems and decisions, stand up the advisory board, and let the university agreement carry institutional continuity. Investors price key-person risk; this roadmap systematically removes it."},
  ]));

  c.push(p(
    "Bahir Dar University's invitation to anchor Ethiopia's digital sovereignty is well founded: the research is rigorous, the policy alignment is direct, and two phases are already built. This roadmap adds the discipline of sequence — prove each ambition before claiming the next, and rest every claim on a signed commitment or a measured result. Ethiopia's climb from Tier 3 toward Tier 2 by 2028 can be built on Ethiopian intelligence, Ethiopian systems, and Ethiopian people.",
    { after: 120 }
  ));

  return c;
}

module.exports = { build };
