/** 01 Founder CVs — Solomon Asalif (Founder & CEO) + Zelalem Tsegaye (Co-founder & CTO).
 * Resume scene, Template B, English. Four pages: two per founder.
 * Personal fields (contact, education, prior employment, certifications) are clearly
 * marked placeholders — only the founders can complete them. Venture facts are final. */
const C = require("./common.js");
const { Paragraph, TextRun, Table, TableRow, TableCell, AlignmentType, BorderStyle, ShadingType, WidthType } = C.docx;
const fs = require("fs");

// Resume palette (tech, aligned with brand navy/cyan)
const S = {
  dark: "162235", accent: "1B6B7A", title: "0A1628", body: "1A2B40",
  sec: "506070", light: "EDF3F5",
};
const F = { ascii: "Calibri", eastAsia: "Calibri" };

// ── Section heading (underline style) ───────────────────────────────────────
function section(title) {
  return new Paragraph({
    spacing: { before: 240, after: 100, line: 276 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: S.accent } },
    children: [
      new TextRun({ text: title, size: 24, bold: true, color: S.accent, font: F }),
    ],
  });
}

// ── Experience entry header: role/org left, date right (borderless table) ─
function entryHeader(left1, left2, date) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: C.allNoBorders,
    rows: [new TableRow({
      cantSplit: true,
      children: [
        new TableCell({
          width: { size: 72, type: WidthType.PERCENTAGE }, borders: C.noBorders,
          margins: { top: 20, bottom: 20, left: 0, right: 80 },
          children: [new Paragraph({
            spacing: { line: 276 },
            children: [
              new TextRun({ text: left1, size: 22, bold: true, color: S.title, font: F }),
              new TextRun({ text: left2 ? `  ·  ${left2}` : "", size: 20, color: S.accent, font: F }),
            ],
          })],
        }),
        new TableCell({
          width: { size: 28, type: WidthType.PERCENTAGE }, borders: C.noBorders,
          margins: { top: 20, bottom: 20, left: 0, right: 0 },
          children: [new Paragraph({
            alignment: AlignmentType.RIGHT, spacing: { line: 276 },
            children: [new TextRun({ text: date, size: 17, color: S.sec, font: F })],
          })],
        }),
      ],
    })],
  });
}

function b(text) {
  return new Paragraph({
    bullet: { level: 0 }, spacing: { line: 276, after: 40 },
    children: [new TextRun({ text, size: 19, color: S.body, font: F })],
  });
}
function bRuns(runs) {
  return new Paragraph({
    bullet: { level: 0 }, spacing: { line: 276, after: 40 },
    children: runs,
  });
}
const t = (text, o = {}) => new TextRun({ text, size: o.size || 19, bold: !!o.bold, italics: !!o.italics, color: o.color || S.body, font: F });

// ── Skills line ─────────────────────────────────────────────────────────────
function skill(name, dots, detail) {
  const filled = "● ".repeat(dots) + "○ ".repeat(5 - dots);
  return new Paragraph({
    spacing: { line: 276, after: 30 },
    children: [
      new TextRun({ text: `${name}  `, size: 19, bold: true, color: S.title, font: F }),
      new TextRun({ text: filled.trim() + "  ", size: 13, color: S.accent, font: F }),
      new TextRun({ text: detail, size: 18, color: S.sec, font: F }),
    ],
  });
}

// ── Header banner (parameterised per founder) ────────────────────────────────
function banner(name, role, tagline) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: C.allNoBorders,
    rows: [new TableRow({
      height: { value: 2350, rule: "exact" },
      children: [new TableCell({
        shading: { type: ShadingType.CLEAR, fill: S.dark },
        borders: C.noBorders,
        margins: { top: 260, bottom: 120, left: 560, right: 560 },
        children: [
          new Paragraph({
            spacing: { line: 640, lineRule: "atLeast", after: 40 },
            children: [
              new TextRun({ text: name, size: 48, bold: true, color: "FFFFFF", font: F }),
              new TextRun({ text: `   ${role}`, size: 26, color: "7FDBF0", font: F }),
            ],
          }),
          new Paragraph({
            spacing: { line: 276, after: 20 },
            children: [
              new TextRun({ text: tagline, size: 20, color: "B8C4CC", font: F }),
            ],
          }),
          new Paragraph({
            spacing: { line: 276 },
            children: [
              new TextRun({ text: "[+251-9XX-XXX-XXX]   ·   [email@example.com]   ·   Addis Ababa / Bahir Dar, Ethiopia", size: 18, color: "90989F", font: F }),
            ],
          }),
        ],
      })],
    })],
  });
}

// ── Page-2 header bar (parameterised per founder) ────────────────────────────
function page2Bar(name, role) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: { ...C.allNoBorders, bottom: { style: BorderStyle.SINGLE, size: 2, color: "C8DDE2" } },
    rows: [new TableRow({
      cantSplit: true, height: { value: 500, rule: "atLeast" },
      children: [new TableCell({
        margins: { top: 60, bottom: 60, left: 100, right: 100 }, borders: C.noBorders,
        children: [new Paragraph({
          spacing: { line: 276 },
          children: [
            new TextRun({ text: name, size: 20, bold: true, color: S.title, font: F }),
            new TextRun({ text: `   |   ${role}`, size: 18, color: S.sec, font: F }),
          ],
        })],
      })],
    })],
  });
}

// ═════════════════════════ SOLOMON ASALIF — FOUNDER & CEO ═══════════════════
const solomonP1 = [
  banner("SOLOMON ASALIF", "Founder & CEO — Adwa Sec", "Cybersecurity platform founder · Offensive-security practitioner · GRC lead"),
  section("Profile"),
  new Paragraph({
    alignment: AlignmentType.JUSTIFIED, spacing: { line: 276, after: 120 },
    children: [t("Founder and CEO of Adwa Sec, an Addis Ababa-based cybersecurity venture building the platform Ethiopia's regulated financial sector is now required to defend itself with. Designed and single-handedly engineered the full MVP — a bilingual (English/Amharic) compliance, vulnerability-assessment and SOC platform — and authored the venture's startup proposal, implementation roadmap and NBE LOT4 tender response. Rare hybrid profile: ships production-grade software (766 automated checks green), practices hands-on attack-path analysis, and formalises regulation (47 + 30 machine-readable obligations) into working engines. Co-leads the venture with Zelalem Tsegaye, Co-founder & CTO, who owns engineering leadership and security operations; this founder retains strategy, regulation, anchor sales and the university and regulator relationships. Seeking incubation and pre-seed backing to convert the MVP into Ethiopia's first locally-built cybersecurity platform business.", { size: 20 })],
  }),
  section("Core Skills"),
  skill("Cybersecurity engineering", 4, "VAPT, OWASP-aligned web/API DAST, CVSS/EPSS/CISA-KEV prioritisation, BloodHound-style AD attack-path analysis"),
  skill("Governance, risk & compliance", 4, "Proclamation 1321/2024 (47 obligations), NBE SBB/83/2022 (30 obligations), NBE LOT4 SBD response, NIST SP 800-61, ISO 27001 programme design"),
  skill("Full-stack engineering", 5, "TypeScript, Next.js 16 (App Router), React, Node, Prisma, PostgreSQL/SQLite, Docker + Caddy, GitHub Actions CI"),
  skill("Security hardening", 5, "JWT rotation + reuse detection, MFA/TOTP, multi-tenant RBAC, captcha, rate limiting, tamper-evident evidence vaults, audit trails"),
  skill("Bilingual delivery", 5, "English–Amharic products: UI, executive PDF reports, awareness curriculum, tender responses"),
  section("Work Experience"),
  entryHeader("Adwa Sec — Adwa Cyber Research Lab, Bahir Dar University", "Founder / CEO", "May 2026 — present"),
  b("Authored the Adwa Sec startup proposal (v1.0, May 2026) aligned to the National Cybersecurity Policy (NCSP) 2024, Digital Ethiopia 2030 and Proclamation 1321/2024; converted it into a re-baselined 3-track implementation roadmap for 2027–2029."),
  b("Designed and built the Adwa platform MVP end-to-end (Next.js 16, TypeScript, Prisma): compliance engine covering the 47 obligations of Proclamation 1321/2024 and the 30 obligations of NBE SBB/83/2022, pillar-weighted scoring, findings workflow with severity-based remediation SLAs, evidence vault with SHA-256 integrity anchoring, and bilingual EN/Amharic executive PDF reporting."),
  b("Built the VAPT Center for the NBE/NCB/S/02/2026/27 LOT4 tender: attack-surface registry (managed + shadow-IT EASM), live OWASP-aligned non-destructive DAST engine with proof bundles, CVSS+EPSS+KEV dynamic risk scoring (P1–P4), remediation SLA queue, and promotion of critical findings into NBE-anchored corrective actions."),
  b("Delivered the AD Attack Paths engine (tender §G): BloodHound-style multi-hop analysis over a 15-node/19-edge reference topology — BFS shortest paths, 12 computed attack paths, chokepoint and tier-0 exposure identification — with interactive bilingual SVG visualisation."),
  b("Transcribed the full 66-line NBE LOT4 bid capability matrix with honest full/partial/roadmap status (27/21/18), vendor-response text and evidence pointers, plus SBD-shaped CSV export."),
  b("Co-founded the two-founder leadership team with Zelalem Tsegaye (Co-founder & CTO): retains strategy, regulation, compliance-engine rule content, anchor sales, Bahir Dar University technology-transfer and INSA relationships; engineering leadership and security operations sit with the CTO."),
  b("Enforced quality discipline: 766 automated checks across the full test battery, CI on every push (lint, typecheck, build, tests, Docker smoke), and honest labelling of every simulated vs live component."),
  entryHeader("【Previous positions — to be completed】", "【Role】", "【dates】"),
  bRuns([t("【Please fill in: previous employer(s), title(s), date ranges and 2–3 quantified achievements per role. Delete this block if the Adwa Sec founding work is the first professional engagement.】", { color: S.sec, italics: true })]),
];

const solomonP2 = [
  page2Bar("SOLOMON ASALIF", "Founder & CEO — Adwa Sec"),
  new Paragraph({ spacing: { after: 120 }, children: [] }),
  section("Selected Projects"),
  entryHeader("AD Attack-Path Analysis Engine", "Design & engineering", "2026"),
  b("Multi-hop Active Directory breach analysis (BFS + full path enumeration ≤8 hops, risk scoring 20–100, node betweenness chokepoints, tier-0 exposure). Demo scenario: 12 attack paths from two phished users; shortest path 4 hops into Domain Admins; chokepoint svc-webapp on 10 of 12 paths."),
  entryHeader("SOC / CERT-as-a-Service (Phase 2 pilot)", "Architecture", "2026"),
  b("NIST SP 800-61 incident lifecycle, threat-intelligence hub with privacy-preserving sharing, automated containment actions, Ethio-CERT synchronisation with SHA-256 proof receipts, and a sub-15-minute detection-to-notification latency target tracked per incident."),
  entryHeader("Amharic-first Cyber-Safety Programme", "Curriculum & platform", "2026"),
  b("Eight bilingual learning units with 32 quiz items for a five-school Addis Ababa pilot; pseudonymised minors, parental-consent register, and treatment/control (RQ2) evaluation design; public learner portal with safe-browsing tools."),
  entryHeader("Track C Governance Register", "Gate engineering", "2026"),
  b("Evidence-sealed blocking-gate board for CII monitoring and content-filtering expansion (8 criteria, forward-only lifecycle, SHA-256-sealed artefacts, refusal without evidence, funder-facing bilingual dossiers)."),
  section("Education"),
  entryHeader("【University / Institution】", "【Degree, field】", "【years】"),
  bRuns([t("【Please fill in: degree(s), institution(s), graduation year(s), thesis or research focus. Current affiliation: Adwa Cyber Research Lab, Bahir Dar University.】", { color: S.sec, italics: true })]),
  section("Certifications & Languages"),
  bRuns([t("Certifications: ", { bold: true, size: 19, color: S.title }), t("【Please fill in: certifications if any — e.g., CEH, OSCP, ISO 27001 Lead Auditor — or write \"In progress: ISO 27001 programme design (2027)\".\"】", { color: S.sec })]),
  bRuns([t("Languages: ", { bold: true, size: 19, color: S.title }), t("Amharic (native) · English (professional working proficiency) — all platform content authored bilingually.", {})]),
  bRuns([t("References: ", { bold: true, size: 19, color: S.title }), t("Available on request — Adwa Cyber Research Lab, Bahir Dar University; platform codebase and 766-check test battery open to technical due diligence.", {})]),
];

// ═════════════════════ ZELALEM TSEGAYE — CO-FOUNDER & CTO ═══════════════════
const zelalemP1 = [
  banner("ZELALEM TSEGAYE", "Co-founder & CTO — Adwa Sec", "Cybersecurity platform CTO · Engineering & security-operations lead · Bilingual delivery"),
  section("Profile"),
  new Paragraph({
    alignment: AlignmentType.JUSTIFIED, spacing: { line: 276, after: 120 },
    children: [t("Co-founder and Chief Technology Officer of Adwa Sec, the Addis Ababa-based cybersecurity venture building the platform Ethiopia's regulated financial sector is now required to defend itself with. Owns the venture's engineering mandate: platform architecture, the VAPT scanning engine, Active Directory attack-path analysis, the SOC/CERT service architecture, production hardening, and the CI-enforced 766-check quality discipline, together with engineering hiring as the team scales from the founding pair to 16 staff by 2029. Complements the founding pair: Solomon Asalif (Founder & CEO) carries strategy, regulation, compliance-engine rule content, anchor sales and the university and regulator relationships; this role carries engineering, delivery and the security-operations bench. 【Please fill in: a 3–4 line summary of professional background — years of experience, domain highlights, notable employers or engagements, and any security research or engineering track record.】", { size: 20 })],
  }),
  section("Core Skills"),
  skill("Platform & security engineering", 5, "TypeScript, Next.js 16 (App Router), React, Node, Prisma, PostgreSQL/SQLite, Docker + Caddy, GitHub Actions CI — the Adwa Sec production stack"),
  skill("Offensive-security tooling", 4, "OWASP-aligned web/API DAST, CVSS/EPSS/CISA-KEV prioritisation, BloodHound-style AD attack-path analysis, proof-bundle evidence capture"),
  skill("Security operations", 4, "NIST SP 800-61 incident lifecycle, SOC 24/5→24/7 stand-up, threat-intelligence operations, Ethio-CERT synchronisation, containment automation"),
  skill("Production hardening & SRE", 5, "Multi-tenant RBAC, JWT rotation with reuse detection, MFA/TOTP, rate limiting, audit trails, deployment smoke pipelines"),
  skill("Bilingual delivery", 4, "English–Amharic products: UI, executive PDF reports, remediation guidance, tender responses"),
  section("Work Experience"),
  entryHeader("Adwa Sec — startup venture, Addis Ababa", "Co-founder / CTO", "2026 — present"),
  b("Co-founds Adwa Sec as the two-founder leadership team with Solomon Asalif (Founder & CEO); division of responsibility is written into the venture's business plan — this role owns architecture, engineering and security operations."),
  b("Owns the platform engineering mandate across the five MVP modules: compliance engine (47 + 30 machine-readable obligations), VAPT Center (live OWASP-aligned DAST, CVSS+EPSS+KEV P1–P4 prioritisation), AD Attack Paths (multi-hop domain analysis), SOC/CERT (NIST SP 800-61 lifecycle, Ethio-CERT synchronisation) and the Amharic-first awareness platform."),
  b("Owns the technical roadmap through 2027–2029: live NVD/CISA-KEV vulnerability-feed integration, live Active Directory ingestion, authenticated and agent-based scanning, SAST/SCA, SIEM/ITSM integrations and cloud-posture (CSPM/CIEM) connectors — the milestones the NBE LOT4 bid matrix commits to."),
  b("Owns engineering hiring (three hires in 2027, building to 16 FTE by 2029) and the CI-enforced quality discipline: 766 automated checks across lint, typecheck, production build, the full test battery and Docker deployment smoke on every push."),
  b("Owns the production-hardening and ISO 27001 programme engineering side: Ethiopian hosting with PostgreSQL, data-localisation compliance for Proclamation 1321/2024, and audit-ready evidence integrity (SHA-256 anchoring, append-only timelines)."),
  entryHeader("【Previous positions — to be completed】", "【Role】", "【dates】"),
  bRuns([t("【Please fill in: previous employer(s), title(s), date ranges and 2–3 quantified achievements per role — engineering teams led, systems shipped, security engagements delivered.】", { color: S.sec, italics: true })]),
];

const zelalemP2 = [
  page2Bar("ZELALEM TSEGAYE", "Co-founder & CTO — Adwa Sec"),
  new Paragraph({ spacing: { after: 120 }, children: [] }),
  section("Selected Projects & Mandates (Adwa Sec)"),
  entryHeader("VAPT Center — live scanning engine", "Engineering mandate", "2026 — 2027"),
  b("Owns the OWASP-aligned non-destructive web/API scanning engine with proof bundles and context-aware prioritisation, and its 2027 upgrade path: live NVD/CISA-KEV feed, authenticated web-application scanning and agent-based infrastructure scanning."),
  entryHeader("AD Attack Paths — identity analysis", "Engineering mandate", "2026 — 2027"),
  b("Owns the BloodHound-style multi-hop analysis engine (BFS shortest paths, full enumeration to 8 hops, chokepoints, tier-0 exposure) and its Q4 2027 live directory-ingestion connector — the tender's most differentiating requirement (§G)."),
  entryHeader("SOC / CERT service stand-up", "Operations mandate", "2027 — 2028"),
  b("Owns the 24/5→24/7 SOC stand-up: NIST SP 800-61 triage runbooks, alert prioritisation, automated containment, threat-intelligence operations and Ethio-CERT synchronisation with SHA-256 proof receipts, against a sub-15-minute detection-to-notification target."),
  entryHeader("Production platform & quality discipline", "Engineering mandate", "2027 — 2029"),
  b("Owns production deployment (PostgreSQL on Ethiopian hosting), multi-tenant hardening, and the 766-check CI battery; scales the engineering team from 3 to 9 across 2027–2029."),
  section("Education"),
  entryHeader("【University / Institution】", "【Degree, field】", "【years】"),
  bRuns([t("【Please fill in: degree(s), institution(s), graduation year(s), thesis or research focus.】", { color: S.sec, italics: true })]),
  section("Certifications & Languages"),
  bRuns([t("Certifications: ", { bold: true, size: 19, color: S.title }), t("【Please fill in: certifications if any — e.g., CEH, OSCP, CISSP, ISO 27001 Lead Auditor — or planned certification path.】", { color: S.sec })]),
  bRuns([t("Languages: ", { bold: true, size: 19, color: S.title }), t("【Please fill in — e.g., Amharic (native) · English (professional working proficiency); the venture's working languages are Amharic and English.】", { color: S.sec })]),
  bRuns([t("References: ", { bold: true, size: 19, color: S.title }), t("Available on request — the Adwa Sec platform codebase and 766-check test battery are open to technical due diligence, jointly with the Founder & CEO.", {})]),
];

const PAGE1_PROPS = { page: { size: { width: 11906, height: 16838 }, margin: { top: 0, bottom: 0, left: 620, right: 620 } } };
const PAGE2_PROPS = { page: { size: { width: 11906, height: 16838 }, margin: { top: 800, bottom: 700, left: 850, right: 850 } } };

const doc = new C.docx.Document({
  creator: "Adwa Sec",
  styles: {
    default: {
      document: { run: { font: F, size: 20, color: S.body }, paragraph: { spacing: { line: 276 } } },
    },
  },
  sections: [
    { properties: PAGE1_PROPS, children: solomonP1 },
    { properties: PAGE2_PROPS, children: solomonP2 },
    { properties: PAGE1_PROPS, children: zelalemP1 },
    { properties: PAGE2_PROPS, children: zelalemP2 },
  ],
});

C.docx.Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync("/home/z/my-project/download/AdwaSec_01_Founder_CV.docx", buf);
  console.log("written: AdwaSec_01_Founder_CV.docx (two founders, 4 pages)");
});
