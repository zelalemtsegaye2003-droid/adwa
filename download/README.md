# Adwa Cyber — Deliverables

## MVP Hardening (2026-11-12) — plan fully executed

The 10-workstream MVP hardening plan is implemented and verified — **683
automated checks green across 15 suites** (was 454):

- **WS-2 scoring integrity** — submission requires 100% explicit answers
  (`400 INCOMPLETE` lists every missing code — a partial submission can no
  longer score as all-N/A), every N/A carries a required ≥5-char
  justification (decision D1), duplicates/unknown rules/invalid values
  rejected, all writes transactional; drafts track `answeredAt` so an
  intentional N/A survives resume. Verified 47/47.
- **WS-7 password lifecycle** — logged-in password change with current-
  password re-auth + full session revocation + Security-dialog UI (38/38
  recovery checks).
- **WS-8 hardening** — crypto-secure captcha randomness, reactStrictMode,
  boot-time env validation (`src/lib/env.ts` fails fast in production),
  service banner at `/api`, evidence on a persistent `DATA_DIR` volume.
- **WS-3/WS-9 deployability** — Postgres-only Docker build, no
  `--accept-data-loss` in the entrypoint, compose boot/health smoke job in
  CI, portable test scripts, `seed:demo` orchestration, D6 production seed
  guards on every seed script.
- **WS-6 error contract** — canonical `{ error: { code, message } }` helper
  + client normalization so no toast ever renders "undefined".
- **Track C restoration** — the P5_CII monitoring register and P4_ACFS
  precondition register (lost to a sandbox recycle) are fully restored:
  6 Prisma models, 11 API routes, RBAC (`cii:manage`/`cii:view-own`/
  `acfs:manage`), server-side gate enforcement (409 + audit on gated
  authorization), seeded 4-operator demo, and UI panes in Track C — 36/36.
- New docs: `docs/DECISIONS.md` (D1–D9), `docs/DEPLOY.md`,
  `docs/TESTING.md`, `SECURITY.md`; unused dependencies removed.

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
  RBAC, audit trail, **self-service password reset + email verification +
  logged-in password change**) and the compliance engine (47 obligations of
  Proclamation No. 1321/2024 + 30 NBE obligations, pillar-weighted scoring,
  risk-ranked findings, remediation plans, bilingual EN/አማርኛ UI, evidence
  vault with integrity anchoring, SOC/CERT-as-a-Service, awareness
  platform, Track C gated expansion incl. CII + ACFS registers).

- `adwa-cyber-repo-with-history.zip` — the same project **including the
  full `.git` history** (secrets purged: `.env` and the dev database were
  removed from every commit). For pushing to GitHub: unzip →
  `git remote add origin https://github.com/<you>/<repo>.git` →
  `git push -u origin main`. The source zip above is the plain-code
  alternative (no history) — `git init && git add -A && git commit` works
  just as well from it.

  Quick start (Bun): `bun install` → set `DATABASE_URL` + `AUTH_SECRET`
  (see `.env.example`) → `bunx prisma db push` → `bun run seed:demo` →
  `bun run dev`. Stop: `Ctrl+C` (or `lsof -ti:3000 | xargs kill` for a
  stray background process); full run/stop/restart tables for dev,
  standalone and Docker are in the project `README.md`.

  Production: `cp .env.example .env` → `docker compose up -d`
  (app + PostgreSQL 16 + Caddy auto-HTTPS; schema + guarded idempotent
  seeds run on boot; stop with `docker compose down`). Backups:
  `sh scripts/backup-db.sh`; prove the restore
  with `bash scripts/restore-drill.sh`.

  Test battery (**683 checks, all passing**): `bun run test:integration` /
  `run-api-tests.sh` (465) · `ci-run-auth-suites.sh` (180) ·
  `run-recovery-tests.sh` (38) — the same battery plus a Docker compose
  boot/health smoke gates every push in CI (`.github/workflows/ci.yml`).
  Production build re-verified: `scripts/prod-smoke.py` walks captcha →
  login → rules → stats → gates → CII/ACFS → /me against the standalone
  server.

  Operations docs in `docs/`: DECISIONS, DEPLOY, TESTING, USER_GUIDE,
  PILOT_ONBOARDING (90-minute runbook to first scan), INCIDENT_RUNBOOK
  (SEV levels, NIST 800-61), OPS (deploy/monitor/backup/upgrade).

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
