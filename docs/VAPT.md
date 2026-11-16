# VAPT Center — Vulnerability Assessment & Penetration Testing

Reference implementation for the National Bank of Ethiopia tender
**NBE/NCB/S/02/2026/27, LOT 4** ("IT vulnerability and Penetration tests tool
software"). The module lives in the main platform as a tenant-scoped tab —
asset registry → hybrid scan orchestration → CVSS/EPSS/KEV prioritised
findings → SLA-tracked remediation → promotion into the compliance Findings
module (NBE-anchored corrective actions).

## Where things are

| Piece | Location |
|---|---|
| Data models (`VaptAsset`, `VaptScan`, `VaptVulnerability`) | `prisma/schema.prisma` (+ postgres variant) |
| Reference CVE catalogue (44 entries, NVD/CISA-aligned) | `src/lib/vapt-data.ts` |
| Engine: prioritisation, SLA, simulation, **live DAST** | `src/lib/vapt-engine.ts` |
| API routes | `src/app/api/vapt/{overview,assets,scans,vulnerabilities}` |
| Promotion into Findings | `src/app/api/vapt/vulnerabilities/[id]/promote/route.ts` |
| UI tab (Overview / Assets / Scans / Vulnerabilities) | `src/components/adwa/vapt.tsx` |
| RBAC permissions (`vapt:view-*`, `vapt:manage-*`) | `src/lib/auth/rbac.ts` |
| Demo seed | `scripts/seed-vapt.ts` (`bun run seed:vapt`) |
| API test suite (60 checks) | `scripts/vapt-test.mjs` (runs via `scripts/run-api-tests.sh`) |

## The hybrid engine (decision D3 — honestly labelled, never silent)

- **DAST — REAL.** For `WEBAPP`/`API` assets whose identifier is an http(s)
  URL, the engine performs live, non-destructive GET probes (throttled,
  never a destructive payload): TLS protocol/certificate audit, HSTS, CSP,
  framing policy, nosniff, referrer policy, version disclosure,
  `Set-Cookie` flags (OWASP A02/A05/A07) and `robots.txt` disclosure.
  Findings carry the raw check evidence as their proof bundle. The demo
  registers the platform itself (`http://localhost:3000`) as a scan target —
  `bun run seed:vapt` + a `FULL`/`DAST` scan exercises the live engine
  end-to-end. The dev server genuinely PASSES its own hardening checks and
  yields the plaintext-transport finding — real results, not fixtures.
- **Infrastructure — simulated.** Infrastructure findings come from the
  bundled reference catalogue (`src/lib/vapt-data.ts`): real, publicly
  documented CVEs (Log4Shell, Zerologon, ProxyLogon, PAN-OS, EternalBlue…)
  with CVSS v3.1 base scores, indicative point-in-time EPSS probabilities
  and CISA KEV membership, plus no-CVE heuristic audit findings
  (Kerberoastable accounts, SNMPv1 default communities, SMBv1, weak TLS,
  unauthenticated MongoDB, exposed Kubernetes dashboard…). Selection is
  deterministic per asset (seeded RNG) so runs are reproducible. Every scan
  record stores its `engineMode` (`hybrid`/`simulated`) and the UI labels
  it — a dev/pilot substitute is never presented as live coverage.
  `ETHIOCERT`-style swap-out: replacing the catalogue with a live
  NVD/KEV feed is a data-source change behind the same engine interface.

## Prioritisation — the tender's "context-aware scoring"

`vapt-engine.prioritise()` computes the **Adwa dynamic risk score (0–100)**:

| Factor | Weight | Source |
|---|---|---|
| CVSS v3.1 base | up to 45 | catalogue / live check |
| EPSS probability | up to 25 | FIRST reference value |
| CISA KEV listed | +15 | KEV catalog |
| Business context | up to +15 | asset criticality + internet-facing + PROD/DMZ |

Priority classes: **P1 ≥ 80, P2 ≥ 60, P3 ≥ 40, else P4.** Changing an
asset's criticality/surface/environment **re-scores** its open findings
(the tender's "custom business-context risk formulas" — adjustments
propagate, they never leave stale priorities).

## Remediation SLA

The VAPT queue mirrors the platform's corrective-action policy
(Procl. 1426/2026 practice): critical 30d · high 60d · medium 90d · low
180d. Status machine: `open → in_progress → remediated` (stamps closure
time, on-time vs late provable) and `accepted` = risk acceptance, which
**requires a justification note** (audited, like a findings waiver).

## Promotion into the Findings module (SLA/banner integration)

`POST /api/vapt/vulnerabilities/[id]/promote` (critical/high/medium only)
creates:

- a mirror `Scan` (mode `vapt`, complete, NBE-IT framework) — a findings
  container, **excluded from compliance score aggregates**
  (`/api/stats`, `/api/organizations` filter on `mode !== "vapt"`), so
  promoted vulnerabilities can never silently change a compliance score;
- one `ScanResult` anchored to the severity-matched NBE obligation —
  critical → **NBE-22** (corrective actions within prescribed timeframes),
  high → **NBE-16** (IT risk register), medium → **NBE-18** (revision from
  assessment findings) — carrying the CVE finding text, risk rank =
  dynamic priority, and the **same SLA clock** (the vulnerability's own
  deadline is inherited — never two clocks for one bug);
- a bidirectional link (`vaptVulnerabilityId` ↔ `promotedFindingId`):
  status changes in either module propagate to the other (`waived` ↔
  `accepted`).

Promoted findings appear in the existing Findings view (with the CVE
detail line), the SLA dashboard (`/api/findings/sla`) and the dashboard
overdue banner.

## RBAC

| Capability | SUPER_ADMIN | ORG_ADMIN | OFFICER | AUDITOR | VIEWER |
|---|---|---|---|---|---|
| View assets / scans / findings | all tenants | own | own | own | own |
| Register / edit assets, run scans, work the queue | all tenants | own | own | — | — |
| Promote into Findings | all tenants | own | own | — | — |

Every route is server-guarded (`vapt:view-*` / `vapt:manage-*` +
`requireAuthAny`) and tenant-scoped; cross-tenant probes return 403
(verified in the test battery).

## Demo data (`bun run seed:vapt`)

44 assets across CBE (26, incl. the platform self-scan target and one
shadow-IT EASM discovery), Dashen (8), Amhara (5), Wasasa (5); ~115–130
vulnerabilities (status mix incl. overdue criticals, remediated on-time and
late, one risk-accepted with justification); 8 completed scan runs with
honest engine labels; and 4 flagship promotions into the Findings module
(Log4Shell on the middleware node, PAN-OS on the perimeter firewall —
overdue, Zerologon on the legacy DC — overdue, ProxyLogon on Exchange).

**Live demo path:** sign in as `admin@cbe.com.et` → VAPT Center → Scans →
launch `FULL` — the Adwa platform itself is scanned by the real DAST
engine; the unreachable legacy portal target demonstrates graceful
degradation (marked unreachable, never a silent pass).

## Tender coverage map (LOT4 → what this module does today)

| Tender section | Module capability |
|---|---|
| Architecture, deployment & scanner management | Tenant-scoped scan orchestration with per-run engine labels; hybrid engine interface is data-source swappable |
| Asset discovery & EASM | Attack-surface registry with managed/shadow-IT flag, tags/smart-groups, kind/environment/surface/criticality |
| Vulnerability assessment & core engine | Reference CVE catalogue (24h-update cadence = data feed swap), heuristic no-signature findings, non-destructive-only probes |
| Web application & API security (DAST) | **Live** OWASP-aligned GET-based checks with throttling and proof bundles |
| Risk prioritisation & threat intel | CVSS + EPSS + CISA KEV + business-context dynamic score (P1–P4) |
| Remediation & ITSM workflows | SLA-tracked queue, risk acceptance with justification, promotion into the platform's corrective-action machinery |
| Compliance, reporting & governance | NBE-anchored promotion (NBE-22/16/18), audit trail on every operation, bilingual EN/አማርኛ UI, RBAC, rate-limited documented REST API |

Not yet in v1 (roadmap, honestly labelled): authenticated/agent-based
scanning, SAST/SCA repository analysis, AD attack-path visualisation,
cloud CSPM/CIEM connectors, SIEM/ITSM bidirectional integrations. These map
onto the same registry/queue/promotion substrate.
