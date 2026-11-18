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
| Data models (`VaptAsset`, `VaptScan`, `VaptVulnerability`, `VaptScope`, `VaptAuditChain`, `VaptCustomCheck`) | `prisma/schema.prisma` (+ postgres variant) |
| Reference CVE catalogue (44 entries, NVD/CISA-aligned) | `src/lib/vapt-data.ts` |
| **Offline CVE feed — live-fetched CVSS/EPSS/KEV** | `src/lib/vapt-cve-feed.ts` + `src/lib/vapt-feed-snapshot.json` (built by `scripts/fetch-vapt-feed.ts`) |
| Engine: prioritisation, SLA, **live DAST** | `src/lib/vapt-engine.ts` |
| **REAL infrastructure engine** (TCP scan, banners, TLS, safe service checks) | `src/lib/vapt-netengine.ts` |
| **Authorization gate** (scopes, CIDR/domain/URL matching, four-eyes) | `src/lib/vapt-scope.ts` |
| **Hash-chained audit log** (append-only, tamper-check) | `src/lib/vapt-audit.ts` |
| **Custom YAML check engine** (sandboxed declarative matchers) | `src/lib/vapt-checks.ts` |
| **AD attack-path graph & BFS analysis** | `src/lib/vapt-ad-paths.ts` + `src/lib/vapt-ad-engine.ts` |
| **Bid capability response matrix (66 tender lines)** | `src/lib/vapt-bid-matrix.ts` |
| API routes | `src/app/api/vapt/{overview,assets,scans,scopes,vulnerabilities,checks,audit,ad-paths,bid-matrix}` |
| Promotion into Findings | `src/app/api/vapt/vulnerabilities/[id]/promote/route.ts` |
| UI tabs (Overview / Assets / Scans / Vulnerabilities / **AD Attack Paths** / **Bid Matrix** / **Scopes & Authorization**) | `src/components/adwa/vapt.tsx` + `vapt-adpaths.tsx` + `vapt-bidmatrix.tsx` + `vapt-scopes.tsx` |
| **Vulnerable lab target** (engine acceptance) | `mini-services/vuln-lab` (banners/headers only, localhost) |
| RBAC permissions (`vapt:view-*`, `vapt:manage-*`) | `src/lib/auth/rbac.ts` |
| Demo seed | `scripts/seed-vapt.ts` (`bun run seed:vapt`) |
| API test suite (113 checks) | `scripts/vapt-test.mjs` (runs via `scripts/run-api-tests.sh`) |
| **Traceability matrix** (plan phases → status, honest) | `docs/VAPT_TRACEABILITY.md` |

## The engine — REAL probes behind an authorization gate (all live, zero simulation)

Every scan now runs through three layers, all real:

### 1. Authorization gate (plan §1 "Authorization first")

No scan (or custom-check test run) starts unless every target lies inside an
**APPROVED scope** whose validity window covers the scan date. Scopes are
written-authorization objects (`VaptScope`): typed targets (IPv4 CIDR / IP /
DNS-suffix domain / URL), a business owner, an authorization note and a window.
Approval is **four-eyes** — the approver must be a different user than the
requester; self-approval is rejected with 403. An out-of-scope attempt is
rejected at the API level and written to the hash-chained audit log as
`SCAN_REJECTED` — the plan's acceptance test, verbatim.

### 2. Live engines

- **INFRA (real).** `src/lib/vapt-netengine.ts` — TCP connect port scan
  (concurrency-limited, per-host throttling), a SAFE service-detection ladder
  (passive greeting read → HTTP HEAD → Redis PING), TLS posture probes
  (deprecated-protocol acceptance via pinned handshakes + certificate expiry
  bands), and non-destructive service checks (anonymous FTP, unauthenticated
  Redis). Banners are parsed into product/version pairs and matched against
  the bundled offline CVE feed with published affected ranges — vsftpd 2.3.4
  banners match CVE-2011-2523 exactly; ProFTPD 1.3.3c matches the backdoor
  CVE-2010-20103 but *not* CVE-2010-4221 (fixed in 1.3.3c) — version
  arithmetic, not string guessing.
- **DAST (real).** For `WEBAPP`/`API` assets: live, non-destructive GET probes
  (throttled): TLS protocol/certificate audit, HSTS, CSP, framing, nosniff,
  referrer policy, version disclosure, `Set-Cookie` flags (OWASP A02/A05/A07)
  and `robots.txt` disclosure. The platform itself
  (`http://localhost:3000`) is a registered demo target — it genuinely passes
  its own hardening checks and yields the plaintext-transport finding.
- **Offline feed (live-fetched data).** `scripts/fetch-vapt-feed.ts` builds
  `src/lib/vapt-feed-snapshot.json` from **live** NVD API 2.0 (primary CVSS
  v3.1 records), the FIRST EPSS API and KEV membership via the NVD
  `cisaExploitAdd` field, with per-entry source citations and an `asOf` date
  (content freshness — the air-gap pattern from plan §Phase 1).

### 3. Unified findings + dedup + auto-close

Every finding carries `fingerprint = sha256(asset ‖ rule ‖ location)` (plan
§4) — re-scans count known findings instead of duplicating them. A **FULL**
re-scan that does not re-observe a live finding auto-closes it as
verified-fixed (remediation proven by absence); seeded reference history is
never silently closed this way.

The old simulated-catalogue path is retained only as labelled reference data
(`src/lib/vapt-data.ts`) — scan `engineMode` is now always `live`.

## The vulnerable lab target (plan §7 acceptance lab)

`bun mini-services/vuln-lab/index.ts` starts a localhost-only, deliberately
mis-configured service set — every "vulnerability" is a label (a crafted
banner/header), no real software is exploited: an Apache/2.4.49-shaped HTTP
server with weak headers/cookies/robots, vsftpd-2.3.4 and ProFTPD-1.3.3c
banner greeters, an OpenSSH-7.2p2/OpenSSL-1.0.1e banner, and an
unauthenticated Redis. `seed-vapt` registers both lab assets (in-scope) and
`vapt-test` proves end-to-end detection — including the NEGATIVE case
(anonymous FTP correctly not flagged).

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

## AD Attack Paths (LOT4 §G — identity & lateral movement)

BloodHound-style Active Directory relationship analysis over the seeded
`CBE.LOCAL` reference topology (15 nodes / 19 directed edges; the enterprise
edition ingests live directory data through the identity connector):

- **Graph model** — nodes carry tier (0/1/2), type, and risk flags
  (Kerberoastable SPNs, AS-REP-no-preauth, dormant days, password age,
  over-privileged, unconstrained delegation); edges are directed in the
  *attack traversal* direction and each records the underlying AD relation
  plus how an attacker abuses it (EN/አማርኛ).
- **Analysis engine** (`vapt-ad-engine.ts`) — BFS shortest path per
  (entry → target) pair, full simple-path enumeration (≤8 hops), risk score
  (20–100, shorter & roast-assisted = higher), node betweenness →
  **chokepoints**, tier-0 exposure per entry, and remediation guidance
  mapped from the abused techniques.
- **Demo scenario** — two phished tier-2 users (intern + payroll clerk) →
  **12 computed attack paths**; shortest = 4 hops
  (`MemberOf → AsRepRoast → CanRDP → AdminCreds` into Domain Admins),
  5 hops to the DC via three distinct technique families: AS-REP roast →
  RDP → cached DA credentials; Kerberoast → SQL admin → unconstrained
  delegation; helpdesk password-reset overreach → service-account takeover.
  The biggest chokepoint is `svc-webapp` (on 10 of 12 paths).
- **API** — `GET /api/vapt/ad-paths` (`include=graph|paths|all`, filters,
  `vapt:view-*` guard). **UI** — interactive SVG graph (tier-coloured
  columns from breach entries to tier-0 crown jewels, technique-coloured
  edges with hover tooltips, entry rings, chokepoint markers), path list
  with risk bars, node detail panel, and a remediation guide per selected
  path — fully bilingual EN/አማርኛ.

## Bid capability response matrix (tender Vendor-Response form)

`GET /api/vapt/bid-matrix` transcribes **all 66 mandatory requirement lines**
from the tender's technical tables (13 sections A–M; the tender's own line
numbering is preserved, including its skipped L3) and maps each to an
honest, auditable Adwa Cyber response:

- **status**: `full` (27) / `partial` (21) / `roadmap` (18) — never a
  silent "comply" on an undelivered engine (the tender's
  honest-labelling principle, applied to ourselves);
- **response**: the exact text for the tender's *Vendor Response* column;
- **capability + evidence**: which module answers the line and where to
  verify it (API route, file, UI tab, doc);
- **CSV export** (`?format=csv`) shaped to paste into the SBD table
  (the tender disqualifies non-conforming response formats).

The UI tab adds summary cards, a compliance-split bar, section/status
filters, search, and the CSV download.

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
| Identity, AD & attack-path analysis | AD Attack Paths tab — multi-hop path engine, roastable/dormant/over-privileged detection, tier-0 exposure |
| Bid response | Bid Matrix tab — 66 line-by-line Vendor-Response rows with evidence links + CSV export |
| Risk prioritisation & threat intel | CVSS + EPSS + CISA KEV + business-context dynamic score (P1–P4) |
| Remediation & ITSM workflows | SLA-tracked queue, risk acceptance with justification, promotion into the platform's corrective-action machinery |
| Compliance, reporting & governance | NBE-anchored promotion (NBE-22/16/18), audit trail on every operation, bilingual EN/አማርኛ UI, RBAC, rate-limited documented REST API |

Not yet in v1 (roadmap, honestly labelled): authenticated/agent-based
scanning, SAST/SCA repository analysis, live AD directory ingestion,
cloud CSPM/CIEM connectors, SIEM/ITSM bidirectional integrations. These map
onto the same registry/queue/promotion substrate. The line-by-line stance
for every tender requirement — including these — lives in the Bid Matrix
tab (`/api/vapt/bid-matrix`, CSV export).
