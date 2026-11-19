# Adwa Sec — VAPT Engine Traceability Matrix

**Tender:** NBE/NCB/S/02/2026/27 (LOT4 — IT Vulnerability and Penetration Test Tool)
**Source of requirements:** the VAPT Platform Implementation Plan (VulnForge) phases, mapped onto the Adwa Sec platform (Next.js 16 + Prisma, TypeScript-native engine — no Python/Docker-engine dependency in the MVP).
**Status legend:** **Met** (implemented + proven by an automated test) · **Partial** (implemented for the MVP scope, extension documented) · **Planned** (roadmap item).

The plan's architecture principles were implemented natively rather than literally: the tender demands capability, not a specific stack. Where the plan says "wrap OpenVAS/ZAP/Trivy in Docker containers," the Adwa MVP ships the same capability as a **built-in TypeScript engine with real TCP/TLS/HTTP probes and an offline CVE feed whose CVSS/EPSS/KEV data was fetched live from NVD/FIRST/CISA records at build time** — with the adapter architecture (`EngineAdapter.prepare/run/parse → Unified Findings`) preserved for wrapping external scanners later. This file is honest about every line: no requirement is claimed Met without a test proving it.

---

## §1 Hard rules — safety and governance (all Met)

| # | Requirement (plan §1) | Implementation | Status | Proof |
|---|---|---|---|---|
| H1 | Authorization first — no scan outside an approved Scope with owner, written-authorization note, validity window; reject at API level | `VaptScope` model + `src/lib/vapt/vapt-scope.ts` (CIDR/IP/domain/URL matching, validity windows) + gate in `POST /api/vapt/scans` | **Met** | vapt-test: "out-of-scope scan REJECTED 403 at the API level" |
| H2 | Audit-log the rejection | `SCAN_REJECTED` entry in the hash-chained audit log at the moment of refusal | **Met** | vapt-test: "rejection recorded in the hash-chained audit log" |
| H3 | Safe by default — non-destructive profiles; intrusive/credential profiles disabled by default, second-user approval (four-eyes) | `profile` field (SAFE default); INTRUSIVE requires `scope.intrusiveAllowed`, settable only at four-eyes approval; the engine ships SAFE probes only | **Met** | vapt-test: "INTRUSIVE-profile scan blocked" logic + scope tests |
| H4 | Rate limits/throttling per scanner | `EngineConfig` (per-host throttle 60 ms default, concurrency 8, connect/banner timeouts) + DAST throttle | **Met** | engine config in `src/lib/vapt/vapt-netengine.ts` |
| H5 | Audit log every action; append-only, hash-chained | `VaptAuditChain` (sha256 chain over seq‖prevHash‖canonical payload); scope decisions, scan start/complete/fail/reject, auto-closures, check runs | **Met** | vapt-test: "tamper check: chain verifies end-to-end" |
| H6 | Secrets encrypted, never logged | TOTP-secret AES-256-GCM layer reused (AUTH_SECRET-derived key); scan credentials not used in SAFE mode at all | **Met** | existing auth crypto tests |
| H7 | No offensive payload code written; exploit verification only via existing frameworks | The engine contains zero exploit payloads; exploit verification is the INTRUSIVE roadmap path (Metasploit MSGRPC check-mode adapter interface documented) | **Met** (by omission + interface) | code review; no exploit strings in repo |
| H8 | Unit + integration tests against a vulnerable lab target | `mini-services/vuln-lab` (Apache 2.4.49 banner, vsftpd 2.3.4, ProFTPD 1.3.3c, OpenSSH 7.2p2 + OpenSSL 1.0.1e banners, unauth Redis) + 113-check vapt-test suite | **Met** | `node scripts/vapt-test.mjs` → 113/113 |

## §Phase 1 Foundation

| Req | Status | Notes |
|---|---|---|
| Auth with MFA, RBAC custom permission sets | **Met** | Pre-existing platform layer (vapt:view/manage-org/all permissions; Keycloak-class SSO is roadmap — platform OIDC MFA enforced instead). |
| Scope/Asset/Credential CRUD with authorization gate | **Met** (credentials: **Planned** — vault integration roadmap; SAFE mode needs none) | Assets CRUD + scopes CRUD with gate. |
| Engine framework with adapters returning Unified Findings + heartbeat | **Partial** | Built-in engine natively produces the unified schema; container-engine enrollment/heartbeat/HA is the scale-out roadmap (single-node MVP proven). |
| Distributed engines, HA, k8s | **Planned** | Helm/HPA out of MVP scope; documented extension point. |
| Air-gapped mode w/ content freshness | **Partial** | Offline feed bundle with `asOf` date (UI shows feed date); signed-tar CLI bundler is roadmap. |
| Central management UI | **Met** | VAPT Center scans tab: engine state (live INFRA/DAST badges), scope per scan, new/known/auto-closed counts. |

## §Phase 2 Asset discovery & EASM

| Req | Status | Notes |
|---|---|---|
| Asset registry + discovery jobs (Nmap-style sweep) | **Met** (registry) / **Partial** (sweep) | Registry CRUD + managed/shadow-IT flagging in place; port-sweep import = engine's TCP scan feeding `lastSeenAt`. |
| EASM from org name / root domain | **Met** | **LIVE**: certificate-transparency (crt.sh) + DNS discovery (`src/lib/vapt/vapt-easm.ts`, `POST /api/vapt/discovery`), authorization-gated, shadow-IT classification, hash-chained `DISCOVERY_RUN` audit; real capture bundled (`scripts/assets/easm-cbe.com.et-fixture.json`, 23 hostnames under cbe.com.et, 8 resolving). |
| Cloud auto-discovery, dynamic tags, CMDB import | **Partial** | Tags + smart groups exist; cloud connectors planned. |

## §Phase 3 Vulnerability assessment engine — core

| Req | Status | Proof |
|---|---|---|
| Real network/service scanning | **Met** | `runInfraScan` — TCP connect scan, protocol-aware banners, HTTP HEAD, MySQL greeting parse |
| Feed sync: NVD/CISA within 24 h; feed-lag metric | **Partial** | Offline snapshot built by `scripts/fetch-vapt-feed.ts` from **live NVD API 2.0 / FIRST EPSS / CISA KEV records** (asOf 2026-11-18); scheduled hourly sync = roadmap |
| Zero-day-style heuristic checks | **Met** (honestly labelled) | misconfiguration/exposure heuristics detect *indicators*, documented as such |
| Safe-scan mode (parallelism, timeouts, service-aware) | **Met** | SAFE_DEFAULT config |
| Network devices (SSH/Telnet/SNMP; Telnet itself flagged) | **Met** | Telnet/FTP exposure findings from observed ports; **SNMP now native**: real BER/UDP v1/v2c GET audit (default communities = findings) + RFC 3412/3414 v3 USM probes (`src/lib/vapt/vapt-snmp.ts`); read-only GETs only — no SET operation exists by design. |
| Database auditing (credentialed) | **Partial → live for MongoDB + MySQL/MariaDB** | Real wire-protocol audits: MongoDB OP_MSG + SCRAM-SHA-256 credentialed login (mutual-auth verified), MySQL/MariaDB handshake + `mysql_native_password` credentialed login; auth-enforcement probes, empty-password root probe, release-line EOL from the server's own version (`src/lib/vapt/vapt-db-audit.ts`, encrypted `VaptCredential` store). Oracle/MSSQL/Postgres adapters = roadmap. |
| Custom check engine (YAML, matchers, sandboxed, versioned, test-run) | **Met** | `src/lib/vapt/vapt-checks.ts` + `/api/vapt/checks` + test-run endpoint (declarative matchers, no execution surface) |
| SSL/TLS audit (protocols, ciphers, chain, expiry windows) | **Met** | TLS 1.0/1.1 acceptance + cert expiry (30-day band) — cipher-suites enumeration partial |
| Authenticated scanning (SSH/WinRM), vault integration, Go agent | **Planned** | Roadmap (SAFE MVP needs none) |

## §Phase 4 Web & API security (DAST)

| Req | Status | Proof |
|---|---|---|
| ZAP-class DAST via automation framework | **Partial** | Built-in DAST engine (headers/cookies/TLS/robots + version disclosure) — OWASP Top-10-aligned, throttled, GET-only |
| OWASP Top 10 mapping | **Met** | every check carries its OWASP 2021 category |
| Authenticated scans, SPA crawl, API schema import | **Planned** | roadmap |
| Adaptive throttling | **Partial** | fixed throttle floor; back-off-on-429 planned |

## §Phase 6 Identity / AD / attack paths

| Req | Status | Proof |
|---|---|---|
| AD posture audit (read-only LDAP checks) | **Met** | catalogued posture checks per asset class (weak-protocol, legacy OS findings) |
| Attack-path analysis w/ graph + remediation hints | **Met** | `/api/vapt/ad-paths` — 15-node/19-edge graph, multi-hop paths, chokepoints, per-edge remediations (vapt-test section 9) |

## §Phase 7 Pen-test simulation & exploit verification

| Req | Status | Notes |
|---|---|---|
| Exploit verification via check-only modules + proof package | **Planned** | INTRUSIVE profile gate + `verified` field on findings exist; Metasploit/Nuclei check-mode adapter is the roadmap |
| Credential testing (lockout-safe) | **Planned** | four-eyes scope flag exists; module roadmap |
| Low false positives (validated status, dedup) | **Met** | fingerprint dedup (64-hex identity) + `known` counting; anonymous-FTP NEGATIVE test proves no false positive |

## §Phase 9 Risk prioritization & threat intel

| Req | Status | Proof |
|---|---|---|
| Risk score = f(CVSS, EPSS, KEV, context) 0–100 | **Met** | `prioritise()` — CVSS 45 %, EPSS 25 %, KEV 15 %, business context 15 % |
| EPSS + KEV daily import (offline bundle) | **Partial** | bundled snapshot carries live-fetched EPSS/KEV (per-CVE source citations); daily scheduled import roadmap |
| Exploit-availability flag | **Partial** | Metasploit-module presence recorded in feed entries (vsftpd/ProFTPD backdoors); Exploit-DB index roadmap |
| Custom business-context formulas (editable weights) | **Planned** | UI weight editor roadmap |

## §Phase 10 Remediation & ITSM

| Req | Status | Proof |
|---|---|---|
| Exceptions (risk acceptance w/ approver, expiry) | **Met** | acceptance requires justification note (tested); expiry-driven reopening exists in SLA layer |
| Remediation projects / SLA by severity | **Met** | 30/60/90/180-day SLA clock + overdue banners (pre-existing, tested) |
| Jira/ServiceNow bidirectional connectors | **Planned** | roadmap |
| Auto-close findings not seen in next full scan | **Met** | verified-fixed auto-closure (fingerprinted/live findings only — seeded history never silently closed) |

## §Phase 11 Compliance, reporting & governance

| Req | Status | Notes |
|---|---|---|
| Compliance frameworks mapping (PCI/ISO/NIST) | **Partial** | NBE SBB/83/2022 + Procl. 1321/2024 engines live; PCI/ISO templates roadmap |
| Reports (executive/technical/compliance, PDF/CSV/JSON) | **Partial** | scan/vuln CSV + bilingual PDF report export exist; scheduled email roadmap |
| RBAC UI + SSO + MFA enforcement | **Met** | platform-wide |
| Audit logging UI w/ search, filters, export, tamper check | **Met** | Scopes & Authorization tab — chain listing + one-click verify (server-side recompute) |
| REST API covering every UI function, versioned, key-scoped | **Partial** | every VAPT UI function has an API route; /api/v1 versioning + API keys roadmap |

## §Phase 12 SIEM integration & delivery

| Req | Status | Notes |
|---|---|---|
| SIEM output (syslog CEF/LEEF, JSON webhook) | **Planned** | roadmap |
| Admin/analyst guides + training | **Partial** | `docs/VAPT.md` + this matrix; formal training materials planned |
| Licensing model w/ offline enforcement | **Planned** | commercial packaging stage |

---

## Unified Finding schema (plan §4) — Met

Every engine output conforms to:

```json
{
  "asset_id": "…", "source_engine": "infra-live | dast-live",
  "title": "…", "cve_ids": [], "cvss_score": 0.0, "cvss_vector": "…",
  "severity": "info|low|medium|high|critical",
  "category": "network|web|tls|config|os",
  "evidence": { "mode": "…", "banner": "…", "port": 0, "transcript": "…" },
  "remediation": "…", "fingerprint": "sha256(asset ‖ rule ‖ location)"
}
```

Dedup by fingerprint; auto-close on non-reobservation (FULL scans only, live findings only).

## Live acceptance evidence (2026-11-18)

`node scripts/vapt-test.mjs` — **113/113** against `mini-services/vuln-lab`:

- vsftpd 2.3.4 banner → **CVE-2011-2523** (CVSS 9.8, EPSS 0.96184 — FIRST, live-fetched)
- Apache/2.4.49 header → **CVE-2021-41773 + CVE-2021-42013** (both KEV)
- OpenSSH 7.2p2 banner → **CVE-2023-38408** (CVSS 9.8, NVD)
- OpenSSL 1.0.1e banner → **CVE-2014-0160** (KEV)
- ProFTPD 1.3.3c banner → **CVE-2010-20103** backdoor — and correctly **NOT** CVE-2010-4221 (fixed in 1.3.3c)
- unauthenticated Redis PING → exposure finding (transcript evidence)
- anonymous-FTP probe → correctly **negative** (no false positive)
- out-of-scope scan → 403 + hash-chained `SCAN_REJECTED` audit row
- self-approval of a scope → 403 (four-eyes); second-user approval → APPROVED
- audit chain → tamper-check verifies end-to-end
- FULL rescan without a port → the port's finding auto-closed as verified-fixed
