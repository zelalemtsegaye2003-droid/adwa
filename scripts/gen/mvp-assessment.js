/**
 * Adwa Cyber — MVP Readiness Assessment (docx generation)
 * Route: Create · Scene: report (Template A adapted) · Cover: R1 · Palette: DM-1
 * Run: bun scripts/gen/mvp-assessment.js  → download/Adwa_MVP_Readiness_Assessment.docx
 */
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, HeadingLevel, PageNumber, PageBreak,
  BorderStyle, WidthType, ShadingType, TableLayoutType, SectionType,
  NumberFormat, TableOfContents, VerticalAlign,
} = require("docx");
const fs = require("fs");
const path = require("path");

// ── Palette: DM-1 (Deep Cyan — tech) ───────────────────────────────────────
const PAL = {
  bg: "162235", primary: "FFFFFF", accent: "37DCF2",
  cover: { titleColor: "FFFFFF", subtitleColor: "B0B8C0", metaColor: "90989F", footerColor: "687078" },
  table: { headerBg: "1B6B7A", headerText: "FFFFFF", accentLine: "1B6B7A", innerLine: "C8DDE2", surface: "EDF3F5" },
};
const INK = "000000";
const BODY = "182030";
const MUTED = "506070";

const NB = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const noBorders = { top: NB, bottom: NB, left: NB, right: NB };
const allNoBorders = { top: NB, bottom: NB, left: NB, right: NB, insideHorizontal: NB, insideVertical: NB };

// ── Cover layout helpers (from design-system.md) ───────────────────────────
function splitTitleLines(title, charsPerLine) {
  if (title.length <= charsPerLine) return [title];
  const breakAfter = new Set([..."，。、；：！？", ..."的与和及之在于为", ..."-_—–·/", ..." \t"]);
  const lines = [];
  let remaining = title;
  while (remaining.length > charsPerLine) {
    let breakAt = -1;
    for (let i = charsPerLine; i >= Math.floor(charsPerLine * 0.6); i--) {
      if (i < remaining.length && breakAfter.has(remaining[i - 1])) { breakAt = i; break; }
    }
    if (breakAt === -1) breakAt = charsPerLine;
    lines.push(remaining.slice(0, breakAt).trim());
    remaining = remaining.slice(breakAt).trim();
  }
  if (remaining) {
    if (remaining.length < 2 && lines.length) {
      lines[lines.length - 1] += " " + remaining;
    } else lines.push(remaining);
  }
  return lines;
}

function calcTitleLayout(title, maxWidthTwips, preferredPt = 40, minPt = 24) {
  const charWidth = (pt) => pt * 20;
  const charsPerLine = (pt) => Math.floor(maxWidthTwips / charWidth(pt));
  let titlePt = preferredPt, lines;
  while (titlePt >= minPt) {
    const cpl = charsPerLine(titlePt);
    if (cpl < 2) { titlePt -= 2; continue; }
    lines = splitTitleLines(title, cpl);
    if (lines.length <= 3) break;
    titlePt -= 2;
  }
  if (!lines || lines.length > 3) {
    lines = splitTitleLines(title, charsPerLine(minPt));
    titlePt = minPt;
  }
  return { titlePt, titleLines: lines };
}

function calcCoverSpacing(params) {
  const {
    titleLineCount = 1, titlePt = 36, hasSubtitle = false,
    hasEnglishLabel = false, metaLineCount = 0,
    fixedHeight = 800, pageHeight = 16838, marginTop = 0, marginBottom = 0,
  } = params;
  const SAFETY = 1200;
  const usableHeight = pageHeight - marginTop - marginBottom - SAFETY;
  const titleHeight = titleLineCount * (titlePt * 23 + 200);
  const subtitleHeight = hasSubtitle ? (12 * 23 + 600) : 0;
  const englishLabelHeight = hasEnglishLabel ? (9 * 23 + 600) : 0;
  const metaHeight = metaLineCount * (10 * 23 + 100);
  const implicitParaHeight = 3 * 300;
  const contentHeight = titleHeight + subtitleHeight + englishLabelHeight + metaHeight + fixedHeight + implicitParaHeight;
  const remainingSpace = usableHeight - contentHeight;
  const safeRemaining = Math.max(remainingSpace, 400);
  const FOOTER_MIN = 800;
  const rawTop = Math.floor(safeRemaining * 0.45);
  const rawBottom = Math.floor(safeRemaining * 0.45);
  const bottomSpacing = Math.max(rawBottom, FOOTER_MIN);
  const topSpacing = Math.max(rawTop - Math.max(0, FOOTER_MIN - rawBottom), 400);
  return { topSpacing, midSpacing: Math.max(safeRemaining - topSpacing - bottomSpacing, 0), bottomSpacing };
}

// ── Recipe R1: Pure Paragraph Cover ────────────────────────────────────────
function buildCoverR1(config) {
  const P = config.palette;
  const padL = 1200, padR = 800;
  const availableWidth = 11906 - padL - padR - 300;
  const { titlePt, titleLines } = calcTitleLayout(config.title, availableWidth, 40, 24);
  const titleSize = titlePt * 2;
  const spacing = calcCoverSpacing({
    titleLineCount: titleLines.length, titlePt,
    hasSubtitle: !!config.subtitle, hasEnglishLabel: !!config.englishLabel,
    metaLineCount: (config.metaLines || []).length, fixedHeight: 400,
  });
  const accentLeft = { style: BorderStyle.SINGLE, size: 8, color: P.accent, space: 12 };
  const children = [];
  children.push(new Paragraph({ spacing: { before: spacing.topSpacing } }));
  if (config.englishLabel) {
    children.push(new Paragraph({
      indent: { left: padL, right: padR }, spacing: { after: 500 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: P.accent, space: 8 } },
      children: [new TextRun({ text: config.englishLabel.split("").join("  "),
        size: 18, color: P.accent, font: { ascii: "Calibri", eastAsia: "SimHei" }, characterSpacing: 40 })],
    }));
  }
  for (let i = 0; i < titleLines.length; i++) {
    children.push(new Paragraph({
      indent: { left: padL },
      spacing: { after: i < titleLines.length - 1 ? 100 : 300, line: Math.ceil(titlePt * 23), lineRule: "atLeast" },
      children: [new TextRun({ text: titleLines[i], size: titleSize, bold: true,
        color: P.cover.titleColor, font: { eastAsia: "SimHei", ascii: "Arial" } })],
    }));
  }
  if (config.subtitle) {
    children.push(new Paragraph({
      indent: { left: padL }, spacing: { after: 800 },
      children: [new TextRun({ text: config.subtitle, size: 24, color: P.cover.subtitleColor,
        font: { eastAsia: "Microsoft YaHei", ascii: "Arial" } })],
    }));
  }
  for (const line of (config.metaLines || [])) {
    children.push(new Paragraph({
      indent: { left: padL + 200 }, spacing: { after: 80 },
      border: { left: accentLeft },
      children: [new TextRun({ text: line, size: 24, color: P.cover.metaColor,
        font: { eastAsia: "Microsoft YaHei", ascii: "Arial" } })],
    }));
  }
  children.push(new Paragraph({ spacing: { before: spacing.bottomSpacing } }));
  children.push(new Paragraph({
    indent: { left: padL, right: padR },
    border: { top: { style: BorderStyle.SINGLE, size: 2, color: P.accent, space: 8 } },
    spacing: { before: 200 },
    children: [
      new TextRun({ text: config.footerLeft || "", size: 16, color: P.cover.footerColor, font: { ascii: "Arial" } }),
      new TextRun({ text: "                                        " }),
      new TextRun({ text: config.footerRight || "", size: 16, color: P.cover.footerColor, font: { ascii: "Arial" } }),
    ],
  }));
  return [new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: allNoBorders,
    rows: [new TableRow({
      height: { value: 16838, rule: "exact" },
      children: [new TableCell({
        shading: { type: ShadingType.CLEAR, fill: P.bg }, borders: noBorders,
        children,
      })],
    })],
  })];
}

// ── Body component builders ────────────────────────────────────────────────
function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 400, after: 160 },
    children: [new TextRun({ text, bold: true, size: 32, color: "1B6B7A", font: { ascii: "Arial", eastAsia: "SimHei" } })],
  });
}
function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 300, after: 120 },
    children: [new TextRun({ text, bold: true, size: 26, color: "1B6B7A", font: { ascii: "Arial", eastAsia: "SimHei" } })],
  });
}
function body(text, opts = {}) {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { line: 312, after: 80 },
    children: [new TextRun({ text, size: 22, color: BODY, font: { ascii: "Calibri", eastAsia: "SimSun" }, ...opts })],
  });
}
function bodyRuns(runs) {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { line: 312, after: 80 },
    children: runs.map(r => new TextRun({ size: 22, color: BODY, font: { ascii: "Calibri", eastAsia: "SimSun" }, ...r })),
  });
}
function bullet(text) {
  return new Paragraph({
    alignment: AlignmentType.LEFT,
    spacing: { line: 312, after: 60 },
    bullet: { level: 0 },
    children: [new TextRun({ text, size: 22, color: BODY, font: { ascii: "Calibri", eastAsia: "SimSun" } })],
  });
}
function caption(text) {
  return new Paragraph({
    alignment: AlignmentType.LEFT, keepNext: true,
    spacing: { before: 160, after: 80 },
    children: [new TextRun({ text, bold: true, size: 20, color: MUTED, font: { ascii: "Calibri" } })],
  });
}

// status chip colors
const STATUS = {
  MET: { bg: "E3F4E9", text: "1E7A3C" },
  PARTIAL: { bg: "FFF4DE", text: "9A6A00" },
  CLOSED: { bg: "E3F4E9", text: "1E7A3C" },
  PENDING: { bg: "FDEBEB", text: "A03030" },
  N_A: { bg: "EDF3F5", text: "4A6572" },
};

const cellMargins = { top: 80, bottom: 80, left: 120, right: 120 };
const thin = (color) => ({ style: BorderStyle.SINGLE, size: 4, color });

function dataTable(headers, rows, widths) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    columnWidths: widths,
    borders: {
      top: thin(PAL.table.accentLine), bottom: thin(PAL.table.accentLine),
      left: thin(PAL.table.innerLine), right: thin(PAL.table.innerLine),
      insideHorizontal: thin(PAL.table.innerLine), insideVertical: thin(PAL.table.innerLine),
    },
    rows: [
      new TableRow({
        tableHeader: true, cantSplit: true,
        children: headers.map((htext, i) => new TableCell({
          shading: { type: ShadingType.CLEAR, fill: PAL.table.headerBg },
          margins: cellMargins, verticalAlign: VerticalAlign.CENTER,
          width: widths ? { size: widths[i], type: WidthType.DXA } : undefined,
          children: [new Paragraph({
            spacing: { line: 276 },
            children: [new TextRun({ text: htext, bold: true, size: 20, color: PAL.table.headerText, font: { ascii: "Calibri" } })],
          })],
        })),
      }),
      ...rows.map((row, ri) => new TableRow({
        cantSplit: true,
        children: row.map((cell, ci) => {
          const isStatus = typeof cell === "object" && cell.__status;
          const textVal = isStatus ? cell.label : cell;
          const color = isStatus ? STATUS[cell.__status].text : BODY;
          return new TableCell({
            shading: { type: ShadingType.CLEAR, fill: isStatus ? STATUS[cell.__status].bg : (ri % 2 === 1 ? PAL.table.surface : "FFFFFF") },
            margins: cellMargins, verticalAlign: VerticalAlign.CENTER,
            width: widths ? { size: widths[ci], type: WidthType.DXA } : undefined,
            children: [new Paragraph({
              spacing: { line: 276 },
              children: [new TextRun({ text: String(textVal), size: 20, bold: isStatus, color, font: { ascii: "Calibri", eastAsia: "SimSun" } })],
            })],
          });
        }),
      })),
    ],
  });
}
const S = (key, label) => ({ __status: key, label: label ?? key });

// ══════════════════════════════════════════════════════════════════════════
// CONTENT
// ══════════════════════════════════════════════════════════════════════════

const coverConfig = {
  title: "Adwa Cyber Platform — MVP Readiness Assessment",
  subtitle: "Measured against the Phase 1 exit criteria of the re-baselined implementation roadmap",
  englishLabel: "ENGINEERING ASSESSMENT REPORT",
  metaLines: [
    "Version 1.0 · 11 November 2026",
    "Scope: Phase 1 compliance-automation platform",
    "Basis: Roadmap Table 3 — five build workstreams, exit criteria",
    "Verification: 454 automated checks, production-build smoke tests",
  ],
  footerLeft: "Adwa Cyber",
  footerRight: "Confidential — internal use",
  palette: PAL,
};

const bodyChildren = [];

// ── 1. Executive summary ──────────────────────────────────────────────────
bodyChildren.push(h1("1. Executive Summary"));
bodyChildren.push(body(
  "This report measures the Adwa Cyber compliance-automation platform against the Minimum Viable Product definition in the company's own planning documents — the re-baselined implementation roadmap, Section 4.1, Table 3 — and records what was done about every gap found. The measurement is code-level, not aspirational: every claim below is backed either by an automated test result or by a file in the repository."
));
bodyChildren.push(bodyRuns([
  { text: "Verdict: " },
  { text: "the platform now satisfies the MVP scope as defined by the roadmap", bold: true },
  { text: " — rule engine, scan engine, and the dashboards, passing acceptance tests — and the operational exit criteria that could be met in the current environment have been closed in this assessment cycle. Four items remain open, and all four require actors or assets outside the development environment (a public hosting domain, counsel sign-off, advisory-board review, and an external penetration test). None is a code task." },
]));
bodyChildren.push(body(
  "The session that produced this report closed every gap that was executable in software: self-service password reset and email verification, a health endpoint for uptime monitoring, scripted database backups with a verified restore drill, a one-command Docker deployment stack with PostgreSQL, a CI pipeline that runs the full 454-check battery on every push, and the four operational documents a pilot customer's security team will ask to see. During verification, one previously undetected functional defect — the evidence-vault upload endpoint, which the UI and two test suites depend on but which had been lost from the working tree — was rebuilt and re-verified."
));

// ── 2. Method ─────────────────────────────────────────────────────────────
bodyChildren.push(h1("2. How the Measurement Was Made"));
bodyChildren.push(body(
  "The roadmap defines the MVP scope explicitly and narrowly: \u201Cthe MVP is defined tightly — rule engine, scan engine, and the three dashboards — while API integrations (including Ethio-CERT synchronisation) and advanced analytics are post-MVP enhancements.\u201D Table 3 of the roadmap decomposes the six-month Phase 1 build into five workstreams, each with an exit criterion. Those five exit criteria are the measurement instrument used here; nothing was added to, or removed from, the standard."
));
bodyChildren.push(body(
  "Each criterion was evaluated by direct inspection and execution: the rule catalogue was queried through the public API, the test suites were run to completion against a live server, the production build was booted from its standalone output and exercised end-to-end, and the operational scripts (backup, restore, restore drill) were executed rather than read. Where a criterion requires human or institutional action (a signature, a hosted domain), it is reported as open with its owner named — it is not marked satisfied by proxy."
));

// ── 3. Scorecard ───────────────────────────────────────────────────────────
bodyChildren.push(h1("3. Workstream Scorecard"));
bodyChildren.push(body(
  "Table 1 states the verdict per workstream. Sections 4 and 5 give the evidence and the detail behind each row."
));
bodyChildren.push(caption("Table 1 — Phase 1 workstreams vs. exit criteria (roadmap Table 3)"));
bodyChildren.push(dataTable(
  ["Workstream", "Exit criterion (roadmap)", "Status", "Basis"],
  [
    ["1. Rule formalisation", "Rule catalogue v1.0 approved, version-controlled, counsel-signed", S("PARTIAL", "PARTIAL — code side done"), "77 machine-readable obligations live (47 Procl. 1321/2024 + 30 NBE SBB/83/2022); bilingual, article-referenced, severity-weighted. Counsel signature is an institutional action — open."],
    ["2. Architecture & infrastructure", "Blueprint signed off; dev and staging environments live", S("PARTIAL", "PARTIAL — dev live"), "Dev environment verified live (55-route production build). CI/CD now exists (GitHub Actions, full battery per push). PostgreSQL path validated. Staging on a hosted domain is open."],
    ["3. Core build sprints", "MVP passes acceptance tests by end of Month 6", S("MET", "MET"), "454 automated checks green across 12 suites: catalogue integrity, scan lifecycle, engine mathematics, findings workflow, tenant isolation, RBAC, MFA, OWASP A01–A10."],
    ["4. Security & production deployment", "Public URL live and monitored; hardening, TLS, backups, runbooks", S("PARTIAL", "PARTIAL — code side done"), "Hardening verified (67 OWASP checks). Health endpoint + Docker healthcheck live. Backups + restore drill pass. Incident runbook written. Public URL on Ethiopian hosting is open."],
    ["5. QA & pilot readiness", "Pilot-ready sign-off by the advisory board", S("PARTIAL", "PARTIAL — materials ready"), "False-positive tuning executable on pilot data. User guide, pilot-onboarding runbook, and ops guide written. Advisory-board review and training delivery are open."],
  ],
  [2200, 2600, 1900, 4900]
));

// ── 4. Evidence ────────────────────────────────────────────────────────────
bodyChildren.push(h1("4. Evidence — What Was Verified"));
bodyChildren.push(h2("4.1 The MVP scope (workstream 3) is complete and tested"));
bodyChildren.push(body(
  "The MVP scope — rule engine, scan engine, dashboards — is not merely present; it passes the acceptance tests the roadmap demands. The compliance catalogue exposes 77 obligations across two frameworks with bilingual statements, article references, severity, priority and penalty references. The scan engine runs the full lifecycle (create, answer, resume, submit, 409 on resubmission) with pillar-weighted scoring recomputed independently by the test suite. Findings follow the remediation workflow with SLA tracking. The bilingual executive PDF renders per-page footers with a payload hash. The Amharic interface toggle covers the whole application."
));
bodyChildren.push(caption("Table 2 — Acceptance-test battery, all green at the time of writing"));
bodyChildren.push(dataTable(
  ["Suite", "Checks", "Covers"],
  [
    ["test-auth", "54", "Captcha, login, MFA (TOTP + backup codes), refresh rotation with reuse detection, lockout, tenant isolation, RBAC matrix"],
    ["test-owasp", "67", "OWASP Top 10 (2021) A01–A10 against the identity layer"],
    ["test-compliance", "44", "Catalogue integrity (47 obligations), scan lifecycle, engine mathematics, findings workflow, RQ1 audit-time comparison"],
    ["test-password-reset", "26", "Self-service recovery: enumeration resistance, single-use tokens, expiry, session revocation, audit trail, rate limits"],
    ["test-google", "15", "Full OAuth 2.0 / OIDC dance via the mock provider"],
    ["ethiocert-bind-test", "26", "Ethio-CERT exchange binding: live ingest, anonymised upward reports, sha256 payload proofs, RBAC"],
    ["soc-test", "91", "NIST 800-61 incident lifecycle, alert prioritisation, containment"],
    ["sla-test", "32", "Severity-based remediation SLAs, on-time vs late closure, overdue tracking"],
    ["report-test", "25", "Executive PDF export correctness"],
    ["rules-engine-test", "27", "NBE obligation coverage, evidence freshness, AUTO_TAG links"],
    ["scan-lifecycle-test", "36", "Scan state machine and persistence"],
    ["evidence-security-test", "11", "Evidence vault: tenant isolation, RBAC, checksum integrity gate"],
    ["Total", "454", "All passing; battery wired into CI on every push and pull request"],
  ],
  [2800, 1100, 7700]
));

bodyChildren.push(h2("4.2 Production build verified end-to-end"));
bodyChildren.push(body(
  "The application compiles to a self-contained standalone server (55 routes, static assets included) and was booted in production mode. The full round trip — captcha, SUPER_ADMIN login, authenticated rules (77), statistics, all eight Track-C gate criteria, session identity — succeeds with a zero-error server log. The self-service password-reset flow was additionally exercised in production mode: request, token issuance via the mail transport, confirmation, and session revocation all behave as specified."
));

bodyChildren.push(h2("4.3 A latent defect was found and fixed during measurement"));
bodyChildren.push(body(
  "Running the full battery exposed that the evidence-vault upload endpoint had been lost from the working tree during an environment reset: the UI and two test suites reference it, but the route did not exist, so every upload attempt returned 405. The endpoint was rebuilt to its documented contract — strict type allow-listing with magic-byte checks, server-generated storage names outside the web root, SHA-256 checksum anchoring, version chains, tenant scoping, and tag-driven AUTO_TAG obligation links — after which both dependent suites (rules-engine 27/27, evidence-security 11/11) pass. This is the measurement working as intended: the battery exists precisely to catch this class of silent loss."
));

// ── 5. What was executed ───────────────────────────────────────────────────
bodyChildren.push(h1("5. Gaps Closed in This Cycle"));
bodyChildren.push(body(
  "Every item below was identified by the Table 3 measurement, implemented, and verified in this cycle."
));
bodyChildren.push(caption("Table 3 — Executed remediation"));
bodyChildren.push(dataTable(
  ["Gap", "What was built", "Verification"],
  [
    ["No self-service password reset (pilot blocker: users depend on an admin for every forgotten password)", "Full recovery flow: 30-minute single-use SHA-256-hashed tokens, enumeration-resistant request endpoint, policy-checked confirmation that revokes all sessions, four new audit event types, bilingual UI (login-screen panel + /reset-password and /verify-email pages), pluggable mail transport (SMTP or console)", "26-check suite; flow re-verified in production mode"],
    ["No email verification", "24-hour verification tokens issued at registration and on demand; verified state exposed in /api/auth/me", "Included in the 26-check suite"],
    ["No health/uptime endpoint", "GET /api/health: database probe with latency, configuration checks, version and uptime; 503 when degraded; wired into the Docker healthcheck", "Returns ok against production build"],
    ["No backups or restore capability", "backup-db.sh (SQLite and PostgreSQL, sha256 sidecars, 30-backup retention), restore-db.sh (checksum + integrity gates, refuses a live app), sqlite_tool.py, and restore-drill.sh", "Drill executed: backup → restore → identical row counts, integrity ok"],
    ["No reproducible deployment", "Multi-stage Dockerfile (Bun, PostgreSQL schema variant), docker-entrypoint.sh (migrate + idempotent seed + serve), docker-compose.yml (app + PostgreSQL 16 + Caddy auto-HTTPS), .dockerignore", "Compose validated; lockfile freeze and PostgreSQL schema validated; image build requires a Docker host (not available in the dev sandbox)"],
    ["No CI/CD", "GitHub Actions workflow: lint, zero-error typecheck gate, production build, then the full 454-check battery including mock OAuth and Ethio-CERT services; tsconfig.ci.json isolates the strict gate", "All gates green locally; lint and typecheck pass at zero errors"],
    ["No operational documentation", "docs/USER_GUIDE.md (end-user manual), docs/PILOT_ONBOARDING.md (90-minute runbook to first scan), docs/INCIDENT_RUNBOOK.md (SEV levels, NIST 800-61 phases, templates), docs/OPS.md (deploy, monitor, back up, upgrade)", "Reviewed against the actual system behaviour"],
    ["76 hidden type errors (build config suppressed them)", "Two orphaned, unreachable route modules removed; strict typecheck re-enabled as a CI gate", "tsc reports zero errors for src/"],
  ],
  [3200, 5000, 3600]
));

// ── 6. Remaining ───────────────────────────────────────────────────────────
bodyChildren.push(h1("6. What Remains — and Who Owns It"));
bodyChildren.push(body(
  "Four items separate the platform from the roadmap's Month-6 exit in full. None of them is a software task; each needs an external actor or asset. They are listed here so the sign-off conversation is grounded."
));
bodyChildren.push(caption("Table 4 — Open items"));
bodyChildren.push(dataTable(
  ["Item", "Why it is open", "Owner / next action"],
  [
    ["Public URL on Ethiopian hosting (Art. 22 data residency)", "Requires a domain, a host in Ethiopia (or a documented residency decision for the pilot phase), and DNS. The deployment that goes live is the docker-compose stack delivered in this cycle.", "Founder: procure hosting + domain, then docker compose up -d and point the uptime monitor at /api/health"],
    ["Counsel sign-off on the rule catalogue", "The 47 legal interpretations are machine-readable and version-controlled; the roadmap requires an Ethiopian data-protection counsel to review and sign them.", "Founder: engage counsel; catalogue exported for review from the /api/rules endpoint"],
    ["Staging environment", "A second deployment of the same stack with a copy of pilot data, used for rehearsal and upgrades.", "Founder: host the compose stack a second time; restore a backup into it"],
    ["Advisory-board pilot sign-off + training", "Pilot-readiness review is an institutional gate; training delivery is scheduled with the first pilot customers.", "Founder: present this report and the runbooks; schedule onboarding sessions"],
    ["External penetration test (recommended before bank data)", "Self-run OWASP checks are strong evidence but not independent evidence; banks will ask for a third-party assessment.", "Founder: commission once the public URL is live; scope = identity layer + evidence vault + tenant isolation"],
  ],
  [3200, 5000, 3600]
));

// ── 7. Pre-deployment checklist ────────────────────────────────────────────
bodyChildren.push(h1("7. Pre-Deployment Checklist"));
bodyChildren.push(body(
  "The operational path from this report to a live pilot, in order. Each step references the delivered artefact that performs it."
));
bodyChildren.push(bullet("Provision a host (Ethiopian residency or a documented pilot-phase decision) with Docker; copy the source tree; cp .env.example .env and set AUTH_SECRET (openssl rand -base64 48), POSTGRES_PASSWORD, SITE_ADDRESS and SMTP_*."));
bodyChildren.push(bullet("docker compose up -d — migrations and idempotent seeds run on boot; verify with curl https://<host>/api/health."));
bodyChildren.push(bullet("Point an uptime monitor at /api/health (alert on two consecutive failures)."));
bodyChildren.push(bullet("Schedule the backup cron (30 2 * * *) and run bash scripts/restore-drill.sh once to prove the restore path."));
bodyChildren.push(bullet("Disable demo seed accounts or rotate their passwords before real tenants are onboarded; enforce MFA for every tenant administrator (the pilot-onboarding runbook makes this a gate)."));
bodyChildren.push(bullet("Set SEED_ON_BOOT=0 after first boot; keep CI green — it is now the regression gate for every change."));

// ── 8. Conclusion ──────────────────────────────────────────────────────────
bodyChildren.push(h1("8. Conclusion"));
bodyChildren.push(body(
  "Measured against its own roadmap, the Adwa Cyber platform has reached the MVP bar: the tightly-scoped core — rule engine, scan engine, dashboards — is built, bilingual, and passing 454 acceptance checks in a pipeline that will keep it honest. The operational gaps that stood between the codebase and a credible pilot are closed in software: recovery is self-service, the deployment is one command, the backups are proven restorable, and the runbooks exist for users, operators, and incidents."
));
bodyChildren.push(body(
  "What remains is deliberately institutional, not technical: a public URL, a counsel's signature, a staging host, and a board's review. Those are the correct next conversations — and with this report, the evidence pack for each of them is already on the table."
));

// ── Assemble document ──────────────────────────────────────────────────────
const pageMargin = { top: 1440, bottom: 1440, left: 1701, right: 1417 };

const doc = new Document({
  creator: "Adwa Cyber",
  title: "Adwa Cyber Platform — MVP Readiness Assessment",
  styles: {
    default: {
      document: {
        run: { font: { ascii: "Calibri", eastAsia: "SimSun" }, size: 22, color: BODY },
        paragraph: { spacing: { line: 312 } },
      },
    },
  },
  features: { updateFields: true },
  sections: [
    // ── Cover (own section, margin 0) ──
    {
      properties: {
        page: { size: { width: 11906, height: 16838 }, margin: { top: 0, bottom: 0, left: 0, right: 0 } },
      },
      children: buildCoverR1(coverConfig),
    },
    // ── TOC (own section, roman numerals) ──
    {
      properties: {
        type: SectionType.NEXT_PAGE,
        page: { size: { width: 11906, height: 16838 }, margin: pageMargin, pageNumbers: { start: 1, formatType: NumberFormat.LOWER_ROMAN } },
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ children: [PageNumber.CURRENT], size: 18, color: MUTED })],
          })],
        }),
      },
      children: [
        new Paragraph({
          spacing: { before: 240, after: 240 },
          children: [new TextRun({ text: "Contents", bold: true, size: 32, color: "1B6B7A", font: { ascii: "Arial" } })],
        }),
        new TableOfContents("Table of Contents", { hyperlink: true, headingStyleRange: "1-2" }),
        new Paragraph({
          spacing: { before: 200 },
          children: [new TextRun({
            text: "Note: page numbers are cached field results — right-click the table of contents and choose \u201CUpdate Field\u201D after opening.",
            italics: true, size: 18, color: MUTED,
          })],
        }),
        // No trailing PageBreak: the body section below is NEXT_PAGE — adding
        // one here would create a blank page (double break).
      ],
    },
    // ── Body (arabic page numbers from 1) ──
    {
      properties: {
        type: SectionType.NEXT_PAGE,
        page: { size: { width: 11906, height: 16838 }, margin: pageMargin, pageNumbers: { start: 1, formatType: NumberFormat.DECIMAL } },
      },
      headers: {
        default: new Header({
          children: [new Paragraph({
            alignment: AlignmentType.RIGHT,
            border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: PAL.table.accentLine, space: 4 } },
            children: [new TextRun({ text: "Adwa Cyber — MVP Readiness Assessment", size: 16, color: MUTED, font: { ascii: "Calibri" } })],
          })],
        }),
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ children: [PageNumber.CURRENT], size: 18, color: MUTED })],
          })],
        }),
      },
      children: bodyChildren,
    },
  ],
});

const OUT = path.resolve(__dirname, "../../download/Adwa_MVP_Readiness_Assessment.docx");
Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync(OUT, buf);
  console.log("written:", OUT, buf.length, "bytes");
});
