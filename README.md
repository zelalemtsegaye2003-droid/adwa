# Adwa Cyber — Compliance Platform (Phase 1 MVP)

Automated compliance assessment against the **47 obligations of the Ethiopian
Personal Data Protection Proclamation No. 1321/2024**, with a security-hardened
multi-tenant identity layer.

Bilingual (English / አማርኛ) · Proclamation 1321/2024 · NCSP 2024 · Digital Ethiopia 2030

## What is implemented

| Module | Details |
|---|---|
| **Authentication** | Password sign-in (scrypt, N=16384), JWT access cookies (HS256, 15 min) + rotating opaque refresh tokens with reuse detection & family revocation |
| **Account recovery** | Self-service password reset (30-min single-use SHA-256-hashed tokens, enumeration-resistant) + email verification (24 h); sessions fully revoked on reset; pluggable mail transport (SMTP or console) |
| **MFA (OTP)** | RFC 6238 TOTP (Google Authenticator / Authy / Aegis), QR enrollment, AES-256-GCM encrypted secrets, replay protection, 8 single-use backup codes |
| **Sign in with Google** | OAuth 2.0 / OIDC authorization-code flow, state-CSRF cookie, ID token verified against Google's JWKS, domain-restricted auto-provisioning |
| **Captcha** | Built-in distorted SVG captcha (single-use server-side challenges) on login & registration; pluggable hCaptcha / reCAPTCHA |
| **Multi-tenant RBAC** | 5 roles — SUPER_ADMIN, ORG_ADMIN, COMPLIANCE_OFFICER, AUDITOR, VIEWER — permission matrix, every query scoped by `organizationId` |
| **47-rule catalogue** | The obligations of Proclamation 1321/2024 as machine-readable rules (bilingual statements, questions, check logic, remediation, penalty refs, pillars, severity, priority) |
| **Compliance engine** | Pillar-weighted scoring (Legal 35% / Technical 30% / Organisational 20% / Awareness 15%), risk-ranked findings, predictive violation detection, prioritised remediation plan, RQ1 audit-time comparison |
| **Findings workflow** | open → in_progress → remediated / waived, tenant-isolated |
| **Remediation SLA** | Severity-based corrective-action deadlines (critical 30d / high 60d / medium 90d, Procl. 1426/2026 practice), on-time vs late closure proof, overdue tracking, dashboard banner |
| **Rules engine** | NBE-IT SBB/83/2022 30-obligation catalogue, evidence coverage (SATISFIED/STALE/GAP), freshness policies, evidence↔obligation links with AUTO_TAG |
| **Executive PDF** | Server-side bilingual (EN/አማርኛ) pdfkit reports with pillar charts, SLA table, per-page footers + payload hash |
| **SOC / CERT-as-a-Service** | Phase 2 pilot: threat-intelligence hub with hybrid sharing (anonymised hub broadcasts + peer-to-peer for sensitive indicators, AAU framework), NIST SP 800-61 incident lifecycle (detect → triage → contain → eradicate → recover → close), alert prioritisation, predictive threat forecast, automated containment, Ethio-CERT synchronisation (national-feed ingest + anonymised upward reports with sha256-proof payloads), RQ3 detection→notification latency tracking (<15 min median target) |
| **Awareness platform** | Phase 3 (Track B): Amharic-first cyber-safety curriculum (8 bilingual units, 32 quiz items) for the five-school Addis Ababa pilot, pseudonymised minor participants, parental-consent register, RQ2 treatment/control evaluation, public learner portal + safe-browsing tools |
| **Track C gate board** | Phases 4–5 governance (ACFS content filtering + CII protection): 8 blocking gate criteria with forward-only status lifecycle, evidence-backed satisfaction (SHA-256-sealed artefacts, refusals without one), append-only per-criterion timeline, funder-facing Gate Dossier PDF (EN/አማርኛ) — deployment stays locked until every blocking criterion is satisfied |
| **UI** | Dashboard, catalogue, organizations, 47-question scan wizard, findings, executive report, evidence vault, SOC (overview/incidents/threat intel), team & roles, audit log — EN/AM toggle, dark mode |
| **Audit trail** | Every auth event (logins, MFA, lockouts, token reuse, user CRUD, Google logins) persisted with IP + user agent |

See `docs/AUTH.md` for the full identity-module reference (API surface,
permission matrix, OWASP hardening notes).

## Tech stack

Next.js 16 (App Router) · TypeScript · Prisma (SQLite dev DB, PostgreSQL-ready) ·
Tailwind CSS 4 + shadcn/ui · jose (JWT) · Node crypto (scrypt, AES-256-GCM, TOTP)

## Quick start

```bash
bun install

# .env needs DATABASE_URL and AUTH_SECRET (64+ chars) — see .env.example
bun prisma db push          # create schema
bun prisma seed.ts          # 47 rules + pilot orgs + 2 demo scans
bun scripts/seed-users.ts   # demo accounts (idempotent)
bun scripts/seed-soc.cjs    # SOC demo data: Ethio-CERT feed + incidents (idempotent)
bun scripts/seed-gates.ts   # Track C gate criteria (Phases 4–5, idempotent)
bun scripts/seed-gate-evidence.ts  # fixture artefact + timeline backfill

bun run dev                 # http://localhost:3000
```

Optional: `cd mini-services/mock-google && bun run dev` starts the mock Google
OAuth/OIDC provider on :3010 so the full Google sign-in flow can be exercised
without real credentials (enabled via `GOOGLE_*` overrides in `.env`).

## Demo accounts (`bun scripts/seed-users.ts`)

| Account | Role | Password | MFA |
|---|---|---|---|
| admin@adwacyber.et | SUPER_ADMIN (platform) | `Adwa#Admin2026!` | off |
| admin@cbe.com.et | ORG_ADMIN (CBE) | `Adwa#Demo2026!` | off |
| officer@cbe.com.et | COMPLIANCE_OFFICER (CBE) | `Adwa#Demo2026!` | **TOTP on** |
| auditor@dashen.com.et | AUDITOR (Dashen) | `Adwa#Demo2026!` | off |
| viewer@ethiotelecom.et | VIEWER (Ethio Telecom) | `Adwa#Demo2026!` | off |

## Tests (against the running dev server)

```bash
bash scripts/run-api-tests.sh            # 7 API suites — 248 checks (SOC, SLA,
                                        #   report, rules engine, scan lifecycle,
                                        #   evidence security, Ethio-CERT binding)
bash scripts/ci-run-auth-suites.sh       # auth + OWASP + compliance + Google
                                        #   — 180 checks
bash scripts/run-recovery-tests.sh       # password reset + email verification
                                        #   — 26 checks
```

**454 checks total, all green.** The same battery runs in CI
(`.github/workflows/ci.yml`: lint → zero-error typecheck → production build →
full test battery) on every push and pull request. Suites are
order-independent and self-healing (429-aware retries, TOTP-window retries);
`scripts/reset-locks.ts` clears account lockouts between runs.

## Project structure

```
prisma/schema.prisma        Organization, Rule, Scan, ScanResult, User,
                            RefreshToken, AuthEvent, CaptchaChallenge, AuthToken
prisma/schema.postgres.prisma  PostgreSQL variant (used by the Docker build)
src/lib/rules-data.ts       the 47 obligations (bilingual, mapped to articles)
src/lib/engine.ts           scoring / risk-ranking / remediation engine
src/lib/auth/               jwt, totp, crypto, session, guard, rbac, captcha,
                            google, rate-limit, audit, passwords, mail, tokens
src/app/api/                auth/* · rules · organizations · scans · findings ·
                            evidence (+upload) · gates · incidents · threats ·
                            awareness · learn · soc · health
src/components/adwa/        dashboard, catalogue, scan wizard, findings, report
src/components/auth/        login screen (with password reset), MFA setup, users, audit
mini-services/              mock Google OIDC (:3010), mock Ethio-CERT (:3020)
docs/                       AUTH, EVIDENCE, USER_GUIDE, PILOT_ONBOARDING,
                            INCIDENT_RUNBOOK, OPS
Dockerfile · docker-compose.yml · deploy/Caddyfile   one-command deploy
.github/workflows/ci.yml    lint + typecheck + build + full test battery
scripts/backup-db.sh · restore-db.sh · restore-drill.sh · sqlite_tool.py
```

## Deploying (Docker — one command)

```bash
cp .env.example .env   # set AUTH_SECRET, POSTGRES_PASSWORD, SITE_ADDRESS, SMTP_*
docker compose up -d   # app + PostgreSQL 16 + Caddy (automatic HTTPS)
curl -s https://<host>/api/health
```

Migrations and idempotent seeds run on boot. Full operations guide
(deploy, monitor, back up, restore, upgrade): `docs/OPS.md`.

## Production notes

- Set a fresh `AUTH_SECRET` (64+ chars); rotating it invalidates sessions and
  MFA seeds (re-run `bun scripts/fix-mfa-secret.ts` afterwards).
- Replace the mock Google provider with real `GOOGLE_CLIENT_ID/SECRET` and
  remove the `GOOGLE_*_URL` overrides.
- Point `DATABASE_URL` at PostgreSQL and switch the Prisma provider.
- Configure `RECAPTCHA_*` or `HCAPTCHA_*` to replace the built-in captcha.
- The in-memory rate limiter is single-instance; use a shared store when
  scaling horizontally.

## Deploying (`bun run build` → standalone)

`bun run build` produces a self-contained server in `.next/standalone/`
(static assets and `public/` are copied in by the build script). Verified
working — `scripts/prod-smoke.py` boots the standalone server and walks
captcha → login → authed API round-trip end to end.

```bash
bun run build
NODE_ENV=production PORT=3000 bun .next/standalone/server.js
```

Gotchas confirmed by the production smoke test:

- **`.env` must be present at runtime.** The standalone build copies the
  root `.env` into `.next/standalone/`, but the server does NOT read the
  project root `.env` — if `AUTH_SECRET` is missing at runtime, login
  returns 500 with `AUTH_SECRET is not configured` in the server log.
  Prefer real environment variables on the deployment host over a committed
  `.env`.
- **Session cookies are `Secure` in production** (`NODE_ENV=production`),
  so the app must be served over HTTPS — put it behind Caddy/nginx TLS
  (see `Caddyfile`). Over plain HTTP browsers will not send the auth
  cookies and every authed call will 401.
- `scripts/reset-locks.ts` clears account lockouts if a deploy test
  trips the brute-force protection.

