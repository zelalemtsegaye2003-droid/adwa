/** 01 Founder CV — Solomon Asalif (resume scene, Template B, English). */
const C = require("./common.js");
const { Paragraph, TextRun, Table, TableRow, TableCell, AlignmentType, BorderStyle, ShadingType, WidthType, TabStopType } = C.docx;
const fs = require("fs");

// Resume palette (tech, aligned with brand navy/cyan)
const S = {
  dark: "162235", accent: "1B6B7A", title: "0A1628", body: "1A2B40",
  sec: "506070", light: "EDF3F5",
};
const F = { ascii: "Calibri", eastAsia: "Calibri" };

const NB = C.NB;

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

// ── Header banner ───────────────────────────────────────────────────────────
const banner = new Table({
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
            new TextRun({ text: "SOLOMON ASALIF", size: 48, bold: true, color: "FFFFFF", font: F }),
            new TextRun({ text: "   Founder — Adwa Sec", size: 26, color: "7FDBF0", font: F }),
          ],
        }),
        new Paragraph({
          spacing: { line: 276, after: 20 },
          children: [
            new TextRun({ text: "Cybersecurity platform founder · Offensive-security practitioner · GRC lead", size: 20, color: "B8C4CC", font: F }),
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

// ── Page 1 body ─────────────────────────────────────────────────────────────
const page1 = [
  banner,
  section("Profile"),
  new Paragraph({
    alignment: AlignmentType.JUSTIFIED, spacing: { line: 276, after: 120 },
    children: [t("Founder of Adwa Sec, an Addis Ababa-based cybersecurity venture building the platform Ethiopia's regulated financial sector is now required to defend itself with. Designed and single-handedly engineered the full MVP — a bilingual (English/Amharic) compliance, vulnerability-assessment and SOC platform — and authored the venture's startup proposal, implementation roadmap and NBE LOT4 tender response. Rare hybrid profile: ships production-grade software (766 automated checks green), practices hands-on attack-path analysis, and formalises regulation (47 + 30 machine-readable obligations) into working engines. Seeking incubation and pre-seed backing to convert the MVP into Ethiopia's first locally-built cybersecurity platform business.", { size: 20 })],
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
  b("Enforced quality discipline: 766 automated checks across the full test battery, CI on every push (lint, typecheck, build, tests, Docker smoke), and honest labelling of every simulated vs live component."),
  entryHeader("【Previous positions — to be completed】", "【Role】", "【dates】"),
  bRuns([t("【Please fill in: previous employer(s), title(s), date ranges and 2–3 quantified achievements per role. Delete this block if the Adwa Sec founding work is the first professional engagement.】", { color: S.sec, italics: true })]),
];

// ── Page 2 header bar + content ────────────────────────────────────────────
const page2Bar = new Table({
  width: { size: 100, type: WidthType.PERCENTAGE },
  borders: { ...C.allNoBorders, bottom: { style: BorderStyle.SINGLE, size: 2, color: "C8DDE2" } },
  rows: [new TableRow({
    cantSplit: true, height: { value: 500, rule: "atLeast" },
    children: [new TableCell({
      margins: { top: 60, bottom: 60, left: 100, right: 100 }, borders: C.noBorders,
      children: [new Paragraph({
        spacing: { line: 276 },
        children: [
          new TextRun({ text: "SOLOMON ASALIF", size: 20, bold: true, color: S.title, font: F }),
          new TextRun({ text: "   |   Founder — Adwa Sec", size: 18, color: S.sec, font: F }),
        ],
      })],
    })],
  })],
});

const page2 = [
  page2Bar,
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

const doc = new C.docx.Document({
  creator: "Adwa Sec",
  styles: {
    default: {
      document: { run: { font: F, size: 20, color: S.body }, paragraph: { spacing: { line: 276 } } },
    },
  },
  sections: [
    {
      properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 0, bottom: 0, left: 620, right: 620 } } },
      children: page1,
    },
    {
      properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 800, bottom: 700, left: 850, right: 850 } } },
      children: page2,
    },
  ],
});

C.docx.Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync("/home/z/my-project/download/AdwaSec_01_Founder_CV.docx", buf);
  console.log("written: AdwaSec_01_Founder_CV.docx");
});
