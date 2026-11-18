/**
 * runbook.js - Adwa Sec "Self-Scan Demo Runbook" docx.
 * English document, DM-1 Deep Cyan palette, R1 cover (reuses gen infrastructure).
 * Structure: Cover (no page#) + Body (Arabic from 1). No TOC (linear manual).
 */
const {
  Document, Packer, Paragraph, TextRun, Header, Footer,
  AlignmentType, PageNumber, NumberFormat, SectionType,
  BorderStyle, ShadingType, PageBreak,
} = require("docx");
const fs = require("fs");

const {
  PAL, EN_FONT, NB,
  h1, h2, h3, body, bodyRuns, bullet,
  tableCaption, bizTable,
} = require("./helpers");
const { buildCoverR1 } = require("./cover");

const MONO = { ascii: "Courier New", eastAsia: "Courier New" };

// ---------------------------------------------------------------------------
// Local building blocks
// ---------------------------------------------------------------------------
/** Command block: monospace on light surface, accent left border. */
function cmd(text, opts = {}) {
  return new Paragraph({
    alignment: AlignmentType.LEFT,
    spacing: { before: 60, after: 60, line: 276 },
    indent: { left: 240, right: 120 },
    shading: { type: ShadingType.CLEAR, fill: "F0F4F6" },
    border: {
      left: { style: BorderStyle.SINGLE, size: 12, color: PAL.table.accentLine, space: 8 },
    },
    children: [
      ...(opts.prompt ? [new TextRun({ text: "$ ", bold: true, size: 19, color: "1B6B7A", font: MONO })] : []),
      new TextRun({ text, size: 19, color: "17313D", font: MONO }),
    ],
  });
}

/** UI path: mono inline look via gray text, used inside bodyRuns. */
function step(no, action, detail) {
  const parts = [
    new Paragraph({
      alignment: AlignmentType.LEFT,
      spacing: { before: 100, after: 40, line: 312 },
      keepNext: true,
      children: [
        new TextRun({ text: `Step ${no} - `, bold: true, size: 24, color: PAL.headingColor, font: EN_FONT }),
        new TextRun({ text: action, bold: true, size: 24, color: "000000", font: EN_FONT }),
      ],
    }),
  ];
  if (detail) {
    parts.push(new Paragraph({
      alignment: AlignmentType.JUSTIFIED,
      spacing: { after: 120, line: 312 },
      indent: { left: 360 },
      children: [new TextRun({ text: detail, size: 24, color: PAL.body, font: EN_FONT })],
    }));
  }
  return parts;
}

function note(text) {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { before: 60, after: 160, line: 312 },
    indent: { left: 240, right: 240 },
    border: { left: { style: BorderStyle.SINGLE, size: 6, color: PAL.table.accentLine, space: 10 } },
    children: [
      new TextRun({ text: "Note: ", bold: true, size: 22, color: PAL.headingColor, font: EN_FONT }),
      new TextRun({ text, size: 22, color: "333333", font: EN_FONT }),
    ],
  });
}

function expect(text) {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { before: 40, after: 160, line: 312 },
    indent: { left: 360 },
    children: [
      new TextRun({ text: "Expected: ", bold: true, size: 22, color: "2A7A65", font: EN_FONT }),
      new TextRun({ text, size: 22, color: "333333", font: EN_FONT }),
    ],
  });
}

// ---------------------------------------------------------------------------
// Cover
// ---------------------------------------------------------------------------
const coverConfig = {
  title: "Self-Scan Demo Runbook",
  subtitle: "Exact, repeatable steps: compliance self-assessment, live VAPT scanning and real-data external discovery",
  englishLabel: "ADWA SEC OPERATIONS RUNBOOK",
  metaLines: [
    "Version 1.0 - issued 19 November 2026",
    "Environment: local demo stack (Bun + Next.js 16 + SQLite)",
    "Time required: about 10 minutes per demo",
    "Repeatable: full reset ritual included (Section 8)",
  ],
  footerLeft: "Adwa Cyber Research Lab",
  footerRight: "Bahir Dar, Ethiopia",
  palette: {
    bg: PAL.bg, accent: PAL.accent,
    titleColor: PAL.cover.titleColor, subtitleColor: PAL.cover.subtitleColor,
    metaColor: PAL.cover.metaColor, footerColor: PAL.cover.footerColor,
  },
};

// ---------------------------------------------------------------------------
// Body content
// ---------------------------------------------------------------------------
const c = [];

// ── 1. Purpose ─────────────────────────────────────────────────────────────
c.push(h1("1. Purpose and How to Use This Runbook"));
c.push(body(
  "This runbook gives the exact, click-by-click steps for the three self-scan demonstrations of the Adwa Sec platform, so any team member can reproduce them again and again with identical results. Demo A covers the compliance self-assessment scan (the 3-step wizard over the 47 obligations of Proclamation No. 1321/2024 and the NBE framework). Demo B covers a live VAPT scan of the built-in vulnerable lab target, using real TCP, TLS, banner and HTTP-header probes enriched against the live NVD vulnerability feed. Demo C covers external attack-surface discovery, which queries real certificate-transparency data from the internet."));
c.push(body(
  "Conventions: text in this style - for example bun run seed:demo - is a terminal command to type exactly as shown; navigation is written as Sidebar > Scans meaning click the Scans item in the left sidebar; every numbered step is one action. Each demo is independent: you can run only Demo B on any day. Section 8 gives the reset ritual that restores the demo database to its seeded state, so every presentation starts from the same numbers."));

// ── 2. Prerequisites ───────────────────────────────────────────────────────
c.push(h1("2. Prerequisites (One-Time Setup)"));
c.push(h2("2.1 Software"));
c.push(bullet("Bun 1.x (runs the app and all scripts; Node 18+ also works for the helper scripts)."));
c.push(bullet("About 4 GB RAM; a normal laptop is enough - the demo stack is lightweight."));
c.push(bullet("Free local ports: 3000 (app), 3060/3021/3022/3061/3062 (vulnerable lab), 3160-3164 (credentialed protocol labs), 3010/3020 (optional mock services)."));
c.push(h2("2.2 Install and initialize"));
c.push(body("Inside the project directory, run once:"));
c.push(cmd("bun install", { prompt: true }));
c.push(cmd("bun run seed:demo", { prompt: true }));
c.push(body(
  "The seed chain creates the regulatory catalogues (77 rules across two frameworks), the pilot organizations with demo users, evidence artefacts, SOC fixtures, the VAPT asset registry with the vulnerable lab targets, and one APPROVED authorization scope for CBE. It prints a confirmation line per stage and ends with Track C seed complete. If the command prints AUTH_SECRET is not configured, the .env file is missing its signing secret: create or restore .env from .env.example and set AUTH_SECRET to any long random string, then re-run the seed."));
c.push(tableCaption("Vulnerable lab targets provided by mini-services/vuln-lab"));
c.push(bizTable(
  ["Port", "Service banner served", "What the scan engine detects"],
  [
    ["3060", "Apache/2.4.49 with weak headers", "Version-bearing Server banner, missing CSP/HSTS/XFO/nosniff, robots.txt advertising /admin"],
    ["3021", "vsFTPd 2.3.4", "FTP banner matching a known backdoor vulnerability record in the NVD feed"],
    ["3061", "ProFTPD 1.3.3c", "FTP banner matched against the live CVE feed"],
    ["3022", "OpenSSH 7.2p2", "SSH version banner within a vulnerable range"],
    ["3062", "Redis, unauthenticated", "PONG answer without auth - an exposure finding, no CVE needed"],
    ["3160", "MongoDB, no auth (protocol lab)", "Credentialed wire-protocol audit detects missing authentication"],
    ["3161/udp", "SNMP agent (protocol lab)", "Device-inventory audit over SNMP v1/v2c/v3 probes"],
    ["3162", "MariaDB with auth (protocol lab)", "Database audit via the seeded audit account"],
    ["3164", "MongoDB SCRAM (protocol lab)", "Authenticated wire-protocol audit"],
  ],
  [12, 30, 58]
));

// ── 3. Start the demo stack ────────────────────────────────────────────────
c.push(h1("3. Starting the Demo Stack (Every Session)"));
c.push(h2("3.1 Start the application"));
c.push(body("Terminal 1, from the project directory:"));
c.push(cmd("bun run dev", { prompt: true }));
c.push(expect("Next.js prints Ready in ... within a few seconds. Open http://localhost:3000 in the browser. The login screen appears with the bilingual brand panel."));
c.push(h2("3.2 Start the vulnerable lab (needed for Demo B)"));
c.push(body("Terminal 2, from the project directory:"));
c.push(cmd("cd mini-services/vuln-lab && bun run dev", { prompt: true }));
c.push(expect("The lab prints one line per listening port (http :3060, ftp :3021 ... lab udp/3161 listening). Leave this terminal open for the whole demo."));
c.push(note(
  "The lab is intentionally vulnerable by design and binds to 127.0.0.1 only - no real software is exploited, the ports simply serve crafted banners that a real scanner must detect. It is safe on any machine."));
c.push(h2("3.3 Sign in"));
c.push(step(1, "Open the login page", "http://localhost:3000 shows the sign-in card with email, password and a security-check captcha field."));
c.push(step(2, "Click the Demo accounts row", "The demo picker expands with five accounts (see Appendix B). Click CBE - Org Admin: email and password fill automatically."));
c.push(step(3, "Solve the captcha", "Type the four distorted characters shown in the captcha image into the Security check field. Characters are case-sensitive."));
c.push(step(4, "Click Sign in", "The dashboard loads with the green Compliance Posture Overview banner and the live security-intel ticker along the top."));
c.push(note(
  "Use admin@cbe.com.et for all three demos - it has no MFA. The officer account requires a TOTP code from an authenticator app, which interrupts the flow of a timed demo."));

// ── 4. Demo A ──────────────────────────────────────────────────────────────
c.push(h1("4. Demo A - Compliance Self-Assessment Scan (about 4 minutes)"));
c.push(body(
  "This demo walks the full evidence-based audit of the 47 obligations of the Personal Data Protection Proclamation No. 1321/2024 (switching the framework to NBE-IT works identically with its 30 rules)."));
const demoA = [];
demoA.push(...step(1, "Sidebar > Compliance Scans", "The 3-step wizard opens: Select organization, Collect evidence, Engine results."));
demoA.push(...step(2, "Step 1 - Select organization", "Pick Commercial Bank of Ethiopia. Framework stays PD-1321 (default). Scan name: type Quarterly self-assessment demo. Click Start scan."));
demoA.push(...step(3, "Step 2 - Collect evidence (the 47 obligations)", "Obligations appear grouped by article subject. The top strip shows evidence coverage (satisfied / stale / gap). Rules with linked current evidence carry a green badge suggesting the answer."));
demoA.push(...step(4, "Answer the obligations", "For a repeatable demo, use this fixed pattern: answer the first 30 Compliant, the next 10 Partial, the following 5 Non-compliant, and the last 2 N/A. N/A requires a justification note of at least 5 characters - type not applicable to our processing activities. Progress shows answered / remaining; drafts autosave."));
demoA.push(...step(5, "Run the compliance engine", "With all 47 answered, the Run compliance engine button activates. Click it. The engine evaluates weights, pillars and severities in seconds."));
demoA.push(...step(6, "Step 3 - Review results", "The screen shows the overall score ring, pillar scores, findings by severity and the risk-ranked remediation plan, plus the audit duration versus the 40-80 hour manual baseline."));
demoA.push(...step(7, "Open the executive report", "The flow continues into the Executive Report view - a board-ready summary of the same scan with PDF export."));
c.push(...demoA);
c.push(expect(
  "With the fixed pattern the score lands in the mid-range (roughly 60-70 percent), with findings on the Non-compliant and N/A obligations and Partial items dragging their pillars. Every re-run with the same pattern produces the same score, because the engine is deterministic."));
c.push(note(
  "To show the evidence-coverage angle mid-demo: before answering, point at the green badges on rules that have linked evidence on file - the Rules Engine computed those suggestions from the evidence vault, which is what makes the audit evidence-based rather than questionnaire-based."));

// ── 5. Demo B ──────────────────────────────────────────────────────────────
c.push(h1("5. Demo B - Live VAPT Scan of the Vulnerable Lab (about 3 minutes)"));
c.push(body(
  "This demo shows the platform performing a real vulnerability assessment: real TCP connect and banner grabs, real TLS/HTTP-header analysis, and enrichment against the live NVD feed (CVSS v3.1 severity, FIRST EPSS exploit probability and CISA KEV known-exploited status). The authorization context is already in place: the seed created the APPROVED scope CBE internal and perimeter scope, approved through the four-eyes principle, which covers 127.0.0.1, localhost and cbe.com.et."));
const demoB = [];
demoB.push(...step(1, "Prerequisite check", "The vulnerable lab must be running (Section 3.2). Its banner lines in terminal 2 confirm every port."));
demoB.push(...step(2, "Sidebar > VAPT Center", "The red Vulnerability Assessment and Penetration Testing banner opens with the NVD/FIRST/CT live badge."));
demoB.push(...step(3, "Open the Scans tab", "The New scan card shows: scan type, scan name and the asset chip list."));
demoB.push(...step(4, "Fill the scan form", "Scan type: FULL. Scan name: Lab sweep - live demo. Click the two lab chips: VULN-LAB multi-service host (127.0.0.1) and VULN-LAB web app (http://127.0.0.1:3060). Leave the profile at SAFE."));
demoB.push(...step(5, "Click Launch", "A progress bar runs while the engine probes the target ports, captures banners, matches software versions and queries the live NVD feed."));
demoB.push(...step(6, "Read the result panel", "It reports N targets, X new vulnerabilities, Y known, and the engine badges INFRA and DAST both marked live."));
demoB.push(...step(7, "Open the Vulnerabilities tab", "The detected findings are listed with severity badges, CVSS scores, EPSS percentages and KEV status. Filter or search vsftpd to isolate the classic banner finding."));
demoB.push(...step(8, "Open one finding", "The evidence bundle shows the raw captured banner, the matched software record and the full CVE enrichment - everything a reviewer needs to re-verify the finding without re-scanning."));
c.push(...demoB);
c.push(expect(
  "The scan detects the vsFTPd 2.3.4 backdoor record from the 3021 banner, the Apache 2.4.49 path-traversal range from the 3060 Server header, the OpenSSH 7.2p2 banner, the unauthenticated Redis exposure, and the missing security headers on the web app - typically 8 to 14 findings on the seeded set, each with live NVD enrichment."));
c.push(h2("5.1 Optional extensions of Demo B"));
c.push(bullet("Credentialed audits: launch a second scan selecting the protocol-lab assets (SNMP device udp/3161, MongoDB tcp/3160 or 3164, MariaDB tcp/3162). The engine performs real wire-protocol handshakes: the SNMP device inventory audit answers with the lab device, the no-auth MongoDB is flagged as an authentication failure by design, the SCRAM and MariaDB labs audit through the seeded audit account."));
c.push(bullet("The authorization gate on stage: in the Vulnerabilities or Assets tab, try a custom-check test-run against 8.8.8.8 - the request is rejected with an authorization error, because no approved scope covers it. Run the same check against 127.0.0.1 and it evaluates. Four-eyes authorization is enforced by the engine, not just the UI."));
c.push(bullet("Scope lifecycle: Sidebar > VAPT Center > Scopes and Authorization shows the seeded APPROVED scope. Request a new scope as a draft, then approve it from a second account to see the four-eyes workflow with the audit trail."));

// ── 6. Demo C ──────────────────────────────────────────────────────────────
c.push(h1("6. Demo C - External Discovery with Real Internet Data (about 2 minutes)"));
c.push(body(
  "This demo queries real certificate-transparency data. It is passive and authorization-gated: the queried root domain must be inside an approved scope. The seeded CBE scope authorizes cbe.com.et."));
const demoC = [];
demoC.push(...step(1, "Sidebar > VAPT Center", "Open the VAPT Center as the CBE org admin."));
demoC.push(...step(2, "Open the EASM Discovery tab", "The discovery panel shows the run card (root domain field and Run button), the counts strip and the hostname registry."));
demoC.push(...step(3, "Enter the root domain", "Type cbe.com.et into the root domain field (lowercase, no scheme)."));
demoC.push(...step(4, "Click Run", "The engine queries certificate transparency live (crt.sh) and resolves the discovered hostnames over DNS."));
demoC.push(...step(5, "Read the result line", "It states how many hostnames were discovered, how many resolved and how many are shadow (unmanaged), and labels the data source honestly: LIVE CT when the internet query succeeded, or bundled real snapshot with an as-of date when crt.sh was unreachable."));
demoC.push(...step(6, "Browse the hostname registry", "Each row shows the hostname, resolved IPs, the CT entry id and issuer, in-scope versus out-of-scope classification and shadow-IT flags."));
c.push(...demoC);
c.push(expect(
  "A table of real issued certificates for the domain: subdomains you did not enter anywhere (the point of CT-log discovery), each classified as managed or shadow. Counts strip at the top updates to the same totals the result line quotes."));
c.push(note(
  "Typing any domain outside the approved scope - for example github.com - is rejected with an authorization error: authorization first, even for passive OSINT. To discover your own domain in a real deployment, create and approve a scope for it first."));

// ── 7. API replay ──────────────────────────────────────────────────────────
c.push(h1("7. One-Command API Replay of Demo B"));
c.push(body(
  "The whole VAPT input/output story - login, FULL scan of the lab, an in-scope custom-check test-run, an out-of-scope rejection and a full vulnerability evidence bundle - is automated as a console script that prints the exact request and response JSON of every call. It doubles as the API contract reference."));
c.push(cmd("node scripts/vapt-io-demo.mjs", { prompt: true }));
c.push(expect(
  "Four numbered sections in the console: 1. POST /api/vapt/scans - the FULL scan response with the scan summary and infra/dast reports; 2. the custom-check test-run output for an in-scope target; 3. the 403 authorization-gate rejection for 8.8.8.8; 4. one vulnerability with its complete evidence bundle. HTTP status codes are printed for every call."));
c.push(body(
  "Run it whenever the dev stack and the vulnerable lab are up. It is read-mostly: it creates one scan and possibly one demo check, which the reset ritual in Section 8 clears."));

// ── 8. Reset ───────────────────────────────────────────────────────────────
c.push(h1("8. Reset and Repeat Ritual"));
c.push(body(
  "Run this ritual before any presentation to make the demos byte-for-byte repeatable. It stops the stack, restores the seeded demo database, and clears every scan and vulnerability created during earlier demos."));
c.push(h2("8.1 The ritual"));
c.push(cmd("bash scripts/stop.sh", { prompt: true }));
c.push(body("stops the app and the mock services (the vulnerable lab is stopped by port or with pkill):"));
c.push(cmd("pkill -f vuln-lab || true", { prompt: true }));
c.push(cmd("bun run seed:demo", { prompt: true }));
c.push(cmd("bun run dev", { prompt: true }));
c.push(body("(run the lab command in a new terminal)"));
c.push(cmd("cd mini-services/vuln-lab && bun run dev", { prompt: true }));
c.push(h2("8.2 What the reseed restores"));
c.push(bullet("The rule catalogues, pilot organizations, users and evidence links are upserted - existing tenant users survive by design."));
c.push(bullet("All VAPT tables are cleared and re-seeded (assets, scans, vulnerabilities, scopes, custom checks, credentials, discoveries, and promoted VAPT mirror scans): exactly one APPROVED CBE scope, the lab assets, and the demo Dashen/CBE estate assets."));
c.push(bullet("Compliance scans and findings regenerate from the seed, and SOC/Track C fixtures return to their initial state."));
c.push(h2("8.3 Verify the baseline"));
c.push(step(1, "Sign in as CBE - Org Admin", "Section 3.3."));
c.push(step(2, "VAPT Center > Scopes and Authorization", "Exactly one APPROVED scope row (CBE internal and perimeter scope) with the four-eyes badge."));
c.push(step(3, "VAPT Center > Scans", "The Scans table contains only the seeded historical scans - your demo scans are gone."));
c.push(step(4, "Dashboard", "The posture numbers match the first time you ever saw the seeded platform."));

// ── 9. Troubleshooting ────────────────────────────────────────────────────
c.push(h1("9. Troubleshooting"));
c.push(tableCaption("Common issues and fixes"));
c.push(bizTable(
  ["Symptom", "Cause", "Fix"],
  [
    ["Port 3000 already in use", "A previous dev server is still running", "bash scripts/stop.sh, then retry; or lsof -ti:3000 | xargs kill"],
    ["AUTH_SECRET is not configured", ".env lost its signing secret (fresh clone or recycled environment)", "Add AUTH_SECRET=<long random string> to .env and re-run bun run seed:demo"],
    ["Login rejected", "Wrong captcha (case-sensitive) or wrong password", "Re-open Demo accounts to refill; type the captcha exactly; use the passwords in Appendix B"],
    ["Officer account asks for a 6-digit code", "That account has TOTP MFA enabled", "Use admin@cbe.com.et for demos, or set up an authenticator app from Security in the sidebar account menu"],
    ["VAPT scan finds nothing on the lab", "The vulnerable lab is not running", "Start it (Section 3.2); confirm the banner lines for :3060 :3021 :3062"],
    ["EASM discovery rejected", "The domain is outside the approved scope", "Use cbe.com.et, or create and approve a scope covering your domain first"],
    ["EASM says bundled snapshot", "crt.sh unreachable from this network", "Expected fallback - the snapshot is a real captured CT dataset with an as-of date; show the honest source label"],
    ["White page after login", "Dev server still compiling", "Wait a few seconds and refresh - dev mode compiles routes lazily"],
  ],
  [28, 34, 38]
));

// ── Appendices ─────────────────────────────────────────────────────────────
c.push(h1("Appendix A - Quick Command Card"));
c.push(tableCaption("Every command from this runbook on one card"));
c.push(bizTable(
  ["Action", "Command"],
  [
    ["Install dependencies (once)", "bun install"],
    ["Seed the full demo state (once + reset)", "bun run seed:demo"],
    ["Start the app", "bun run dev"],
    ["Start the vulnerable lab", "cd mini-services/vuln-lab && bun run dev"],
    ["Replay Demo B over the API", "node scripts/vapt-io-demo.mjs"],
    ["Stop app + mock services", "bash scripts/stop.sh"],
    ["Stop the vulnerable lab", "pkill -f vuln-lab"],
    ["Run the API test battery", "bash scripts/run-api-tests.sh"],
  ],
  [40, 60]
));
// Keep Appendix B together on one page: explicit break before it avoids a
// single orphan table row spilling onto the last page.
c.push(new Paragraph({ children: [new PageBreak()] }));
c.push(h1("Appendix B - Demo Accounts"));
c.push(tableCaption("Seeded accounts (Demo accounts picker fills these)"));
c.push(bizTable(
  ["Account (picker label)", "Email", "Password", "MFA"],
  [
    ["Platform Super Admin", "admin@adwacyber.et", "Adwa#Admin2026!", "Off"],
    ["CBE - Org Admin", "admin@cbe.com.et", "Adwa#Demo2026!", "Off"],
    ["CBE - Officer", "officer@cbe.com.et", "Adwa#Demo2026!", "TOTP on"],
    ["Dashen - Auditor", "auditor@dashen.com.et", "Adwa#Demo2026!", "Off"],
    ["Ethio Telecom - Viewer", "viewer@ethiotelecom.et", "Adwa#Demo2026!", "Off"],
  ],
  [26, 30, 24, 20]
));
c.push(note(
  "Passwords are demo credentials seeded for the pilot. In any real deployment, replace them on first sign-in and require MFA for every account."));

// ---------------------------------------------------------------------------
// Assemble document
// ---------------------------------------------------------------------------
const pgSize = { width: 11906, height: 16838 };
const pgMargin = { top: 1440, bottom: 1440, left: 1701, right: 1417 };

function runbookHeader() {
  return new Header({
    children: [new Paragraph({
      alignment: AlignmentType.RIGHT,
      border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: "C8DDE2", space: 4 } },
      children: [new TextRun({
        text: "Adwa Sec - Self-Scan Demo Runbook",
        size: 18, color: "808080", font: EN_FONT,
      })],
    })],
  });
}

function pageFooter() {
  return new Footer({
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ children: [PageNumber.CURRENT], size: 18, color: "595959", font: EN_FONT })],
    })],
  });
}

const doc = new Document({
  styles: {
    default: {
      document: {
        run: { font: EN_FONT, size: 24, color: "000000" },
        paragraph: { spacing: { line: 312 } },
      },
      heading1: {
        run: { font: EN_FONT, size: 32, bold: true, color: PAL.headingColor },
        paragraph: { spacing: { before: 400, after: 180, line: 312 } },
      },
      heading2: {
        run: { font: EN_FONT, size: 28, bold: true, color: PAL.headingColor },
        paragraph: { spacing: { before: 280, after: 140, line: 312 } },
      },
      heading3: {
        run: { font: EN_FONT, size: 24, bold: true, color: PAL.headingColor },
        paragraph: { spacing: { before: 220, after: 120, line: 312 } },
      },
    },
  },
  sections: [
    {
      properties: {
        page: { size: pgSize, margin: { top: 0, bottom: 0, left: 0, right: 0 } },
      },
      children: buildCoverR1(coverConfig),
    },
    {
      properties: {
        type: SectionType.NEXT_PAGE,
        page: {
          size: pgSize,
          margin: pgMargin,
          pageNumbers: { start: 1, formatType: NumberFormat.DECIMAL },
        },
      },
      headers: { default: runbookHeader() },
      footers: { default: pageFooter() },
      children: c,
    },
  ],
});

const OUT = process.cwd() + "/download/AdwaSec_SelfScan_Demo_Runbook.docx";
Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync(OUT, buf);
  console.log("written: " + OUT + " (" + buf.length + " bytes)");
});
