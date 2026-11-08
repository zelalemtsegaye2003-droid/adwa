# Adwa Cyber — Deliverables

## Deployment status: READY (verified 2026-11-08)

The platform passes a full production-build verification:

- `bun run build` → clean compile (49 routes, standalone output complete)
- Standalone server boots and serves: login page 200, public `/learn`
  portal 200, unauthenticated APIs correctly 401
- End-to-end round-trip in production mode: captcha → login (SUPER_ADMIN)
  → authenticated `/api/rules` (77 rules), `/api/stats`, `/api/gates`
  (8 Track-C criteria), `/api/auth/me` — zero errors in the server log
  (`scripts/prod-smoke.py`, included in the zip, reproduces this)

Two blockers were found and fixed during verification:

1. **`AUTH_SECRET` was never persisted** — it only lived in a dev shell,
   so production login failed with 500 `AUTH_SECRET is not configured`.
   A fresh 64+ char secret is now in `.env` and the officer's TOTP secret
   re-encrypted under it (`bun scripts/fix-mfa-secret.ts`).
2. **`.env.example`** restored to the working tree (was only in the zip).

Pre-deploy checklist for the target host: set a fresh `AUTH_SECRET` env
var (rotating invalidates sessions + MFA seeds — re-run
`scripts/fix-mfa-secret.ts`), serve over HTTPS behind Caddy/nginx (session
cookies are `Secure`-flagged in production — plain HTTP will 401 every
authed call), and point `DATABASE_URL` at PostgreSQL for anything beyond
pilot scale. Full notes in the README's "Deploying" section.

## Phase 1 MVP — platform source code

- `adwa-cyber-platform-source.zip` — the complete Phase 1 codebase:
  security-hardened identity layer (MFA/TOTP, JWT sessions with refresh
  rotation + reuse detection, Sign in with Google, captcha, multi-tenant
  RBAC, audit trail) and the compliance engine (47 obligations of
  Proclamation No. 1321/2024, pillar-weighted scoring, risk-ranked
  findings, remediation plans, bilingual EN/አማርኛ UI).

  Quick start (Bun): `bun install` → set `DATABASE_URL` + `AUTH_SECRET`
  (see `.env.example`) → `bun prisma db push` → `bun prisma seed.ts` →
  `bun scripts/seed-users.ts` → `bun run dev`. Test suites:
  `test-auth` (54), `test-owasp` (67), `test-google` (15),
  `test-compliance` (44) — **180 checks, all passing** (run each against
  the dev server; restart the server between full passes — the in-memory
  rate limiter is by design persistent within a server lifetime).

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
