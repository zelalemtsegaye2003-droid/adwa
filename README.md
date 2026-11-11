# Adwa Cyber — Compliance Platform (Phase 1 MVP)

Automated compliance assessment against the **47 obligations of the Ethiopian
Personal Data Protection Proclamation No. 1321/2024**, with a security-hardened
multi-tenant identity layer.

Bilingual (English / አማርኛ) · Proclamation 1321/2024 · NCSP 2024 · Digital Ethiopia 2030

## What is implemented

| Module | Details |
|---|---|
| **Authentication** | Password sign-in (scrypt, N=16384), JWT access cookies (HS256, 15 min) + rotating opaque refresh tokens with reuse detection & family revocation; logged-in password change re-authenticates with the current password and revokes every session |
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
| **Scan integrity (WS-2)** | Submission requires 100% explicit answers (INCOMPLETE lists the missing codes — a partial submission can never inflate a score), every N/A needs a ≥5-char justification (decision D1), duplicates/unknown rules/invalid values rejected, all writes in one transaction; drafts autosave per-question with `answeredAt` tracking so an intentional N/A survives resume |
| **Track C gate board** | Phases 4–5 governance (ACFS content filtering + CII protection): 8 blocking gate criteria with forward-only status lifecycle, evidence-backed satisfaction (SHA-256-sealed artefacts, refusals without one), append-only per-criterion timeline, funder-facing Gate Dossier PDF (EN/አማርኛ) — deployment stays locked until every blocking criterion is satisfied |
| **CII monitoring register (P5)** | 4 named operators (EEP, Ethio Telecom, CBE, Ethiopian Airlines), MOU version lifecycle (DRAFTING→…→ACTIVE), INSA authorisation tracking, registered-system readiness ladder; monitoring is doubly gated per operator (in-force MOU + ACTIVE INSA licence) and advancing a system to MONITORING_AUTHORIZED on a shut gate is refused with 409; tenants get a read-only feed of their own operator |
| **ACFS precondition register (P4)** | 13 preconditions across 4 domains (EMA partnership, EHRC due diligence, transparency framework, dedicated funding) with SATISFIED-requires-evidence rule, periodic board decisions (REMAINED_LOCKED/UNLOCKED), server-side unlock enforcement — register currently LOCKED |
| **UI** | Dashboard, catalogue, organizations, 47-question scan wizard, findings, executive report, evidence vault, SOC (overview/incidents/threat intel), team & roles, audit log — EN/AM toggle, dark mode |
| **Audit trail** | Every auth event (logins, MFA, lockouts, token reuse, user CRUD, Google logins) persisted with IP + user agent |

See `docs/AUTH.md` for the full identity-module reference (API surface,
permission matrix, OWASP hardening notes).

## System architecture

![System architecture](docs/architecture.png)

Six layers, top to bottom: **users** (tenant staff in 4 roles, platform staff,
public learners) → **presentation** (one bilingual SPA with role-scoped panes
plus public auth/learner screens) → **API + identity** (route handlers with
RBAC guard, JWT session rotation, MFA, captcha, rate limits, audit on every
call) → **domain engines** (pure TypeScript: compliance, rules, SOC, awareness,
SLA, Track C gate enforcement, PDF generators — deterministic and
regulator-auditable by design) → **data** (Prisma over SQLite/PostgreSQL,
SHA-256-anchored evidence vault, audit stores) → **integrations & operations**
(Google OIDC, Ethio-CERT exchange, SMTP, captcha providers, Docker Compose +
Caddy TLS, CI, backup/restore drills). Everything drawn with a **dashed amber
border is a dev/pilot substitute** — honestly labelled and swapped by
configuration, never silently (decisions D3/D4). Regenerate the diagram with
`python3 scripts/render-architecture.py` (source:
`scripts/architecture-diagram.html`).

## Tech stack

Next.js 16 (App Router) · TypeScript · Prisma (SQLite dev DB, PostgreSQL-ready) ·
Tailwind CSS 4 + shadcn/ui · jose (JWT) · Node crypto (scrypt, AES-256-GCM, TOTP)

## Quick start

```bash
bun install

# .env needs DATABASE_URL and AUTH_SECRET (64+ chars) — see .env.example
bunx prisma db push             # create schema
bun run seed:demo               # catalogue + demo accounts + evidence + SOC +
                                 #   awareness RCT + SLA + gates + Track C
bun run dev                     # http://localhost:3000
```

`seed:demo` chains: `db:seed` (77 rules + pilot orgs + demo scans) →
`seed:users` → `seed:evidence` → `seed:evidence-links` → `seed:soc` →
`seed:awareness` → `seed:sla` → `seed:gates` → `seed:trackc` →
`seed:gate-evidence`. Every step is idempotent, and all of them refuse to run
against `NODE_ENV=production` unless `SEED_ON_BOOT=1` (bootstrap) or
`ALLOW_DEMO_SEED=1` (full demo) is set — decision D6, `docs/DECISIONS.md`.

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

## Who can do what — end-to-end, per user

**Yes — every role has a complete, working end-to-end path.** No role hits a
dead end, and every journey below is machine-verified: the 683-check battery
walks each one through the real API (real captcha logins, real HTTP status
codes, real tenant-isolation probes). The authoritative permission matrix is
`src/lib/auth/rbac.ts` (reference: `docs/AUTH.md`).

### Before login — public flows (no account needed)

- **Register** → captcha → email verification (24 h single-use link) → sign in.
- **Forgot password** → single-use reset link (30 min, enumeration-resistant) →
  all sessions revoked on success.
- **Sign in with Google** → OAuth/OIDC (real provider or the labelled dev mock).
- **TOTP challenge** for MFA-enabled accounts (QR enrollment + 8 backup codes).

### Per-role end-to-end journeys

| Role | The journey a user can complete, start to finish |
|---|---|
| **SUPER_ADMIN**<br>(platform staff) | Onboard an organization → create its first ORG_ADMIN → run an assessment for any tenant → review every tenant's findings/evidence → operate the national threat hub: ingest the Ethio-CERT feed, publish anonymised upward reports with SHA-256 receipts → run the awareness programme (schools, classes, parental-consent register, RQ2 evaluation) → govern Track C (gate board, CII + ACFS registers, funder dossier PDF) → review the platform-wide audit log. |
| **ORG_ADMIN**<br>(tenant) | Manage the org profile → invite the team and assign the 4 tenant roles → run the 47-question scan (autosave, resume, N/A justification enforced) → work the findings: remediate or waive with SLA deadlines (30/60/90 d) → upload evidence (SHA-256 anchored, tamper-evident) → link evidence to obligations (coverage SATISFIED/STALE/GAP) → generate the bilingual executive PDF → manage the org's SOC incidents and share threat indicators → read the own-org audit trail. |
| **COMPLIANCE_OFFICER**<br>(tenant) | The full assessment workflow — run scans, work findings, upload/link evidence, generate reports, manage own-org SOC — everything except user management and org settings. This is the daily-driver account; the demo officer has TOTP MFA enabled. |
| **AUDITOR**<br>(read-only) | Independently verify: browse the catalogue, open any own-org scan, check findings + on-time/late SLA proof, inspect evidence with integrity verification, view the SOC overview and the own-org audit log. Every write attempt returns 403 (verified). |
| **VIEWER**<br>(read-only) | Observe: dashboard, catalogue, own-org scans/findings/evidence/SOC, executive report — no mutations, no audit log. |
| **Learner**<br>(public, no account) | Open `/learn` → join with a class code → study Amharic-first modules → take quizzes → use the safe-browsing tools → see progress. Pseudonymised throughout; the RQ2 group assignment is never revealed. |
| **Anyone** | All public flows listed above (register, reset, Google, MFA challenge). |

### Capability matrix

| Capability | SUPER_ADMIN | ORG_ADMIN | OFFICER | AUDITOR | VIEWER |
|---|---|---|---|---|---|
| Onboard / manage organizations | all tenants | own profile | — | — | — |
| Manage users | all tenants | own tenant | — | — | — |
| Run compliance scans | any org | own org | own org | — | — |
| Findings + SLA workflow | manage all | manage own | manage own | view | view |
| Evidence vault | manage all | upload + manage | upload + manage | view | view |
| Executive PDF report | all orgs | own org | own org | view | view |
| SOC incidents (NIST lifecycle) | manage all | manage own | manage own | view | view |
| Threat-intel sharing | + national ingest (only role) | contribute + upward report | contribute + upward report | view | view |
| Awareness programme (schools, RCT) | only role | — | — | — | — |
| Track C governance (gates, CII/ACFS) | manage | own operator, read-only (API) | own operator, read-only (API) | — | — |
| Audit log | platform-wide | own org | — | own org | — |
| Self account security (MFA, password change) | ✓ | ✓ | ✓ | ✓ | ✓ |

Read-only roles are enforced **server-side** (403), not just hidden in the UI —
the OWASP and evidence-security suites probe every cross-tenant and
privilege-escalation path.

## Tests (against the running dev server)

```bash
bun run test:integration     # alias: bash scripts/run-api-tests.sh
bash scripts/run-api-tests.sh       # 10 API suites — 465 checks (Ethio-CERT
                                    #   binding, SOC, SLA, report, rules engine,
                                    #   scan lifecycle incl. WS-2 submit hardening,
                                    #   evidence security, Track C gate board,
                                    #   CII/ACFS, awareness, awareness tools)
bash scripts/ci-run-auth-suites.sh  # auth + OWASP + compliance + Google
                                    #   — 180 checks
bash scripts/run-recovery-tests.sh  # password reset + email verification +
                                    #   logged-in change — 38 checks
```

**683 checks total, all green.** The same battery runs in CI
(`.github/workflows/ci.yml`: lint → zero-error typecheck → production build →
full test battery → Docker compose boot/health smoke) on every push and pull
request. Suites are order-independent and self-healing (429-aware retries,
TOTP-window retries); `scripts/reset-locks.ts` clears account lockouts between
runs. Seed prerequisites per suite are documented in `docs/TESTING.md`.

## Project structure

```
prisma/schema.prisma        Organization, Rule, Scan, ScanResult, User,
                            RefreshToken, AuthEvent, CaptchaChallenge, AuthToken,
                            + Track C: ExpansionGate, GateEvidence, GateEvent,
                              CiiOperator/Mou/Authorization/System, AcfsGateItem/Decision
prisma/schema.postgres.prisma  PostgreSQL variant (kept in sync — used by Docker)
src/lib/rules-data.ts       the 47 obligations (bilingual, mapped to articles)
src/lib/engine.ts           scoring / risk-ranking / remediation engine
src/lib/env.ts              boot-time env validation (fail fast in production)
src/lib/api-error.ts        canonical { error: { code, message, fieldErrors } }
src/lib/auth/               jwt, totp, crypto, session, guard, rbac, captcha,
                            google, rate-limit, audit, passwords, mail, tokens
src/app/api/                auth/* · rules · organizations · scans · findings ·
                            evidence (+upload) · gates · cii/* · acfs/* ·
                            incidents · threats · awareness · learn · soc · health
src/components/adwa/        dashboard, catalogue, scan wizard, findings, report,
                            SOC, awareness, Track C (gate board + CII + ACFS)
src/components/auth/        login screen (with password reset), MFA setup +
                            password change, users, audit
docs/architecture.png      system architecture diagram (see above)
mini-services/              mock Google OIDC (:3010), mock Ethio-CERT (:3020)
docs/                       DECISIONS, AUTH, EVIDENCE, DEPLOY, TESTING, OPS,
                            USER_GUIDE, PILOT_ONBOARDING, INCIDENT_RUNBOOK
Dockerfile · docker-compose.yml · deploy/Caddyfile   one-command deploy
.github/workflows/ci.yml    lint + typecheck + build + test battery + compose smoke
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
- Configure `RECAPTCHA_*` or `HCAPTCHA_*` to replace the built-in captcha
  (dev-only by decision D4 — a determined bot can parse the SVG glyphs).
- The in-memory rate limiter is single-instance; use a shared store when
  scaling horizontally.
- Evidence artefacts live under `DATA_DIR` (compose mounts a named volume at
  `/data`) — include them in backups alongside the database.
- Seeding is guarded in production (decision D6): bootstrap seeds need
  `SEED_ON_BOOT=1`, demo seeds need `ALLOW_DEMO_SEED=1`.
- The server refuses to boot in production with an invalid `DATABASE_URL` or
  a missing/short `AUTH_SECRET` (`src/lib/env.ts` — fail fast, clear log).

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

