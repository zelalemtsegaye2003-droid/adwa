# Adwa Cyber — Deliverables

## MVP Readiness Assessment (2026-11-11)

- `Adwa_MVP_Readiness_Assessment.docx` / `.pdf` — the platform measured
  against the Phase 1 exit criteria of the implementation roadmap (Table 3,
  five workstreams). **Verdict: MVP scope met in software; 454 automated
  checks green; four institutional items remain open (public hosting,
  counsel sign-off, staging host, advisory-board review).** Includes the
  workstream scorecard, the evidence tables, the gaps closed this cycle,
  and an ordered pre-deployment checklist.

## Phase 1 MVP — platform source code

- `adwa-cyber-platform-source.zip` — the complete codebase:
  security-hardened identity layer (MFA/TOTP, JWT sessions with refresh
  rotation + reuse detection, Sign in with Google, captcha, multi-tenant
  RBAC, audit trail, **self-service password reset + email verification**)
  and the compliance engine (47 obligations of Proclamation No. 1321/2024
  + 30 NBE obligations, pillar-weighted scoring, risk-ranked findings,
  remediation plans, bilingual EN/አማርኛ UI, evidence vault with integrity
  anchoring).

  Quick start (Bun): `bun install` → set `DATABASE_URL` + `AUTH_SECRET`
  (see `.env.example`) → `bun prisma db push` → `bun prisma seed.ts` →
  `bun scripts/seed-users.ts` → `bun run dev`.

  Production: `cp .env.example .env` → `docker compose up -d`
  (app + PostgreSQL 16 + Caddy auto-HTTPS; migrations + idempotent seeds
  run on boot). Backups: `sh scripts/backup-db.sh`; prove the restore with
  `bash scripts/restore-drill.sh`.

  Test battery (**454 checks, all passing**): `run-api-tests.sh` (248) ·
  `ci-run-auth-suites.sh` (180) · `run-recovery-tests.sh` (26) — the same
  battery gates every push in CI (`.github/workflows/ci.yml`).

  Operations docs in `docs/`: USER_GUIDE, PILOT_ONBOARDING (90-minute
  runbook to first scan), INCIDENT_RUNBOOK (SEV levels, NIST 800-61),
  OPS (deploy/monitor/backup/upgrade).

## Implementation roadmap (re-baselined)

- `Adwa_Cyber_Implementation_Roadmap.docx` — the editable roadmap (29 pages, 14 sections, 13 tables).
- `Adwa_Cyber_Implementation_Roadmap.pdf` — print-ready export.

**This revision re-baselines the plan per the founder's decision:** the proposal's
"Phases 1–2 already implemented" claims are treated as design documentation only.
Phase 1 (compliance-automation platform) is now planned as a from-scratch build in
Months 1–6 — see Section 4.1 for the five-workstream build plan with exit criteria.
All dependent schedules, hiring, budget (USD 104k–193k Year 1), scenarios, risks and
the 30-60-90 plan have been re-timed around the Month-6 MVP / pilot start.

The TOC page numbers are cached field results; after editing in Word, right-click
the TOC and choose "Update Field" to refresh them.
