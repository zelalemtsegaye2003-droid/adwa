/** 08 MVP Demonstration — screenshot tour of the live platform. */
const C = require("./common.js");
const fs = require("fs");

const SHOTS = "/adwa/download/screenshots/embed";

const cover = C.buildCoverR1({
  title: "Adwa Sec — MVP Demonstration",
  subtitle: "The working platform: screenshot tour, live-access instructions and verification record",
  englishLabel: "MVP DEMONSTRATION",
  metaLines: [
    "Venture: Adwa Sec",
    "Prototype: Adwa platform MVP (prototype branding: Adwa Cyber)",
    "Date: November 2026",
    "Verification: 766 automated checks, all green",
  ],
  footerLeft: "Adwa Sec — Startup Application Package",
  footerRight: "Confidential",
  palette: C.P,
});

const body = [
  C.h1("1. What Is Demonstrated"),
  C.para("This document demonstrates a working, tested minimum viable product — not a design document. The Adwa platform MVP implements the full chain the venture sells: regulatory compliance assessment, vulnerability assessment and penetration testing, Active Directory attack-path analysis, security operations, and Amharic-first awareness delivery. It exists as a single bilingual (English/Amharic) application with a hardened multi-tenant identity layer, and it is continuously verified by an automated battery of 766 checks that runs on every push through CI (lint, type-check, production build, full test suite, and a Docker deployment smoke test). The screenshots that follow were captured directly from a live instance seeded with the demonstration dataset; the working prototype carries the internal brand Adwa Cyber, which becomes Adwa Sec's product brand at commercialisation."),
  C.h1("2. How to Access the Live System"),
  C.para("The reviewer can reproduce every screen below in minutes. After installing Bun, the sequence is: clone the repository, install dependencies, point the database URL at a local SQLite file, push the schema, seed the demonstration data, and start the development server — the full quick start, stop and restart commands are documented in the repository README. Health is verifiable at the /api/health endpoint."),
  ...C.dataTable({
    headers: ["Step", "Command", "Notes"],
    widths: [24, 44, 32],
    caption: "Table 1: Quick start (Bun runtime; Node 20+ equivalent)",
    rows: [
      ["Install dependencies", "bun install", "Single command; lockfile committed"],
      ["Initialise database", "bunx prisma db push", "Creates schema on the configured database"],
      ["Seed demo data", "bun run seed:demo", "Idempotent: rules, pilot orgs, evidence, SOC, VAPT, awareness, SLA, gates"],
      ["Start the app", "bun run dev", "Serves on http://localhost:3000"],
      ["Verify health", "curl http://localhost:3000/api/health", "Returns status: ok with database and auth-secret checks"],
    ],
  }),
  ...C.dataTable({
    headers: ["Demo account", "Role", "What it shows"],
    widths: [34, 26, 40],
    caption: "Table 2: Seeded demonstration accounts (from the repository README)",
    rows: [
      ["admin@adwacyber.et", "Platform super admin", "All tenants, national threat hub, awareness programme, Track C governance, platform audit log"],
      ["admin@cbe.com.et", "Bank org admin (CBE)", "Tenant view: scans, findings, evidence vault, SOC, VAPT Center for one institution"],
      ["auditor@dashen.com.et", "Read-only auditor (Dashen)", "Verification view: every write attempt returns 403 — server-side, not just hidden UI"],
      ["viewer@ethiotelecom.et", "Read-only viewer", "Observer view: dashboards and reports only"],
    ],
  }),
  C.para("Two demonstrations of the security posture itself are worth requesting live: the login screen enforces a server-side captcha challenge (single-use, cryptographically random) and the compliance-officer account has multi-factor authentication (TOTP) enabled, with QR enrollment and eight single-use backup codes. Both are part of the identity layer documented in the repository's authentication reference, alongside JWT session rotation with reuse detection, rate limiting and a complete authentication audit trail."),
  C.h1("3. Screenshot Tour"),
  ...C.figure(`${SHOTS}/shot-01-login.png`, "Figure 1: The public login screen — captcha challenge, Google sign-in (OIDC), password reset and MFA entry points; the hardened identity layer is the front door of the product", 520),
  ...C.figure(`${SHOTS}/shot-02-dashboard.png`, "Figure 2: The dashboard — pillar-weighted compliance posture, findings and SLA status, recent scans, overdue-corrective-action banner", 520),
  ...C.figure(`${SHOTS}/shot-03-vapt-overview.png`, "Figure 3: VAPT Center overview — attack-surface registry, scan runs with honest engine labels (hybrid/simulated), vulnerability counts by priority", 520),
  ...C.figure(`${SHOTS}/shot-04-ad-attack-paths.png`, "Figure 4: AD Attack Paths (tender §G) — the BloodHound-style interactive SVG: tiered columns from breach entries to tier-0 crown jewels, technique-coloured directed edges, chokepoint markers, 12 computed paths with risk bars", 540),
  ...C.figure(`${SHOTS}/shot-05-bid-matrix.png`, "Figure 5: The Bid Matrix — all 66 mandatory NBE LOT4 tender lines with honest full/partial/roadmap statuses, capability and evidence pointers, filters and CSV export shaped for the tender's Vendor-Response form", 520),
  ...C.figure(`${SHOTS}/shot-06-findings.png`, "Figure 6: Findings and remediation SLAs — severity-based deadlines (30/60/90 days), on-time versus late closure proof, and promoted VAPT criticals anchored to NBE obligations", 520),
  ...C.figure(`${SHOTS}/shot-07-soc.png`, "Figure 7: Security Operations — NIST SP 800-61 incident lifecycle, threat-intelligence sharing hub, alert prioritisation and detection-to-notification latency tracking", 520),
  ...C.figure(`${SHOTS}/shot-08-evidence.png`, "Figure 8: The evidence vault — SHA-256-anchored artefacts, coverage status per obligation (satisfied/stale/gap), evidence-to-obligation linking", 520),
  ...C.figure(`${SHOTS}/shot-09-awareness.png`, "Figure 9: The awareness programme — Amharic-first curriculum units, quiz analytics, pseudonymised participants and the parental-consent register for the school pilot", 520),
  ...C.figure(`${SHOTS}/shot-10-ad-attack-paths-amharic.png`, "Figure 10: The same AD Attack Paths screen in Amharic — the bilingual commitment is in the product itself, not the brochure: node and edge annotations, remediation guidance and UI all switch", 540),
  C.h1("4. Verification Record"),
  ...C.dataTable({
    headers: ["Suite", "Checks", "What it proves"],
    widths: [34, 12, 54],
    caption: "Table 3: The automated test battery (all green at time of writing)",
    rows: [
      ["API integration suites (11)", "525", "Ethio-CERT binding, SOC, SLA, report generation, rules engine, scan lifecycle incl. submission hardening, evidence security, Track C gates, CII/ACFS registers, awareness, VAPT"],
      ["Auth / OWASP / compliance / Google", "180", "Login, MFA, JWT rotation with reuse detection, tenant isolation, RBAC matrix, lockouts, OWASP probe paths, the Google OIDC flow"],
      ["Password recovery lifecycle", "38", "Password reset, email verification, logged-in password change with re-authentication and session revocation"],
      ["VAPT suite (incl. new AD + bid work)", "83", "Asset registry, scans, prioritisation, promotion into Findings, the 66-line bid matrix, the AD attack-path graph engine"],
    ],
  }),
  C.para("Beyond the suites, the battery is self-honest: infrastructure findings in the reference catalogue are labelled simulated, every scan records its engine mode, and the demonstration scans the platform itself with its own live web scanner — the development server genuinely passes its own OWASP-aligned hardening checks and reports the one true finding it finds (plaintext transport on plain HTTP). This is the honest-labelling discipline the NBE tender itself demands, applied to our own house first."),
  C.h1("5. Technology Annex"),
  ...C.dataTable({
    headers: ["Layer", "Technology"],
    widths: [34, 66],
    caption: "Table 4: Stack summary (full architecture diagram in the repository)",
    rows: [
      ["Application", "Next.js 16 (App Router), TypeScript, React, Tailwind CSS 4 with shadcn/ui"],
      ["Domain engines", "Pure TypeScript: compliance scoring, rules engine, VAPT prioritisation (CVSS+EPSS+KEV), AD path engine (BFS), SOC lifecycle, PDF generation — deterministic and regulator-auditable by design"],
      ["Data", "Prisma ORM over SQLite (development) and PostgreSQL (production); SHA-256-anchored evidence vault under a persistent data volume"],
      ["Identity & security", "Scrypt password hashing, JWT access cookies with rotating opaque refresh tokens (reuse detection, family revocation), RFC 6238 TOTP MFA with AES-256-GCM encrypted secrets, OAuth 2.0/OIDC sign-in, server-side captcha, rate limiting, multi-tenant RBAC (5 roles), full audit trail"],
      ["Deployment", "Docker Compose (app + PostgreSQL 16 + Caddy automatic TLS); one-command deploy; migrations and guarded idempotent seeds on boot; backup and restore drill scripts"],
      ["Integrations", "Ethio-CERT exchange (with a labelled mock for development), SMTP mail transport, captcha providers, Google identity"],
      ["Quality", "GitHub Actions CI on every push and pull request: lint, zero-error type-check, production build, full battery, compose boot/health smoke"],
    ],
  }),
  C.h1("6. What Is Simulated — and How It Becomes Live"),
  C.para("For reviewer transparency: the web/API scanning engine is genuinely live (non-destructive, throttled, with raw check evidence in proof bundles); infrastructure findings currently come from a bundled reference catalogue of real, publicly documented CVEs with CVSS, indicative EPSS and CISA-KEV membership — selected deterministically per asset so runs are reproducible; and the AD attack-path graph runs over a seeded reference topology (15 nodes, 19 edges, a CBE-styled domain) rather than a live directory. Each substitution is a data-source swap behind a stable engine interface — the live NVD/KEV feed and the live directory ingestion connector are the first two product milestones of the 2027 roadmap (see AdwaSec_06_Product_Roadmap.docx), and the bid matrix states the same honestly line by line. No simulated component is ever presented as live coverage — the platform displays the engine mode on every scan record."),
];

const doc = C.makeDoc({ cover, toc: C.tocBlock(), body, headerTitle: "Adwa Sec — MVP Demonstration" });
C.docx.Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync("/adwa/download/AdwaSec_08_MVP_Demonstration.docx", buf);
  console.log("written: AdwaSec_08_MVP_Demonstration.docx");
});
