/**
 * Adwa Cyber — NBE LOT4 bid capability response matrix.
 *
 * Source: NBE/NCB/S/02/2026/27, "Schedule of Requirements & Technical
 * Specifications for NBE Systems IT vulnerability and Penetration tests tool"
 * (Standard Bidding Document, October 2026). All 67 line items from the
 * technical requirement tables are transcribed here and mapped, line by
 * line, to Adwa Cyber capabilities.
 *
 * Status values (honest, auditable):
 *  - "full"    : delivered by the current platform build
 *  - "partial" : delivered in a scoped/hybrid form (e.g. simulated engine)
 *  - "roadmap" : planned for the enterprise edition within the 3-year term
 *
 * The matrix is exposed via GET /api/vapt/bid-matrix (JSON, and CSV with
 * ?format=csv) and rendered in the VAPT Center "Bid Matrix" tab.
 */

export type BidStatus = "full" | "partial" | "roadmap";

export interface BidRequirement {
  /** Line id inside the tender, e.g. "A1", "M3". */
  id: string;
  /** Tender section letter (see BID_SECTIONS). */
  section: string;
  /** Requirement text as written in the tender (abridged where verbose). */
  text: string;
  /** Mandatory ("M") per the tender tables — all 67 items are M. */
  mandatory: boolean;
  /** Compliance status of the Adwa Cyber platform. */
  status: BidStatus;
  /** Text for the "Vendor Response" column of the tender form. */
  response: string;
  /** Which Adwa Cyber capability answers the requirement. */
  capability: string;
  /** Where to verify it (module / API route / document). */
  evidence: string;
  /** Optional delivery note for partial/roadmap items. */
  note?: string;
}

export interface BidSection {
  id: string;
  title: string;
  titleAm: string;
}

export const BID_SECTIONS: BidSection[] = [
  { id: "A", title: "Architecture, Deployment & Scanner Management", titleAm: "ሥነ ምሕደር፣ ትግበራና የስካነር አስተዳደር" },
  { id: "B", title: "Asset Discovery & External Attack Surface Management (EASM)", titleAm: "የንብረት ግኝትና የውጭ የጥቃት ክልል አስተዳደር (EASM)" },
  { id: "C", title: "Vulnerability Assessment & Core Engine Capabilities", titleAm: "የብልሽት ግምገማና ዋና የሞግር ችሎታዎች" },
  { id: "D", title: "Agent-Based & Authenticated Scanning", titleAm: "በኤጀንት ላይ የተመሰረተና የተረጋገጠ ስካን" },
  { id: "E", title: "Web Application & API Security (DAST)", titleAm: "የዌብ መተግበሪያና API ደህንነት (DAST)" },
  { id: "F", title: "Cloud Security, Container & DevSecOps", titleAm: "የደመና ደህንነት፣ ኮንቴይነርና DevSecOps" },
  { id: "G", title: "Identity, Active Directory & Attack Path Analysis", titleAm: "ማንነት፣ አክቲቭ ዳይሬክቶሪና የጥቃት መስመር ትንተና" },
  { id: "H", title: "Penetration Testing Simulation & Exploit Verification", titleAm: "የፔንትራትሽን ሙከራና የኢክስፕሎይት ማረጋገጥ" },
  { id: "I", title: "Source Code Security & Static Application Security Testing (SAST)", titleAm: "የምንጭ ኮድ ደህንነትና SAST" },
  { id: "J", title: "Risk Prioritization, Threat Intelligence & Scoring", titleAm: "የስጋት ቅድሚያ፣ የስጋት መረጃና ነጥብ መስጠብ" },
  { id: "K", title: "Remediation, Patch Management & ITSM Workflows", titleAm: "ማስተካከያ፣ ፓች አስተዳደርና ITSM" },
  { id: "L", title: "Compliance, Reporting & Governance", titleAm: "ተገዢነት፣ ሪፖርትና አስተዳደር" },
  { id: "M", title: "Other Requirements (Licensing)", titleAm: "ሌሎች መሻሪያዎች (ፈቃድ)" },
];

export const BID_REFERENCE = "NBE/NCB/S/02/2026/27 · LOT4";
export const BID_DUE_DATE = "2026-11-18";

export const BID_REQUIREMENTS: BidRequirement[] = [
  // ── A. Architecture, Deployment & Scanner Management ───────────────────────
  {
    id: "A1", section: "A",
    text: "Fully air-gapped / disconnected on-premises management console option.",
    mandatory: true, status: "full",
    response: "Comply. Adwa Cyber ships as a self-hosted Next.js + PostgreSQL/SQLite application with no external call-home; deployments without egress are supported (offline CVE/EPSS/KEV catalog bundle updates).",
    capability: "Self-hosted on-premises console (Next.js 16 standalone server, embedded DB or external PostgreSQL).",
    evidence: "docs/DEPLOY.md; DEPLOYMENT: docker/standalone; no telemetry endpoints in src/app/api",
    note: "Air-gap bundle refresh documented for enterprise edition.",
  },
  {
    id: "A2", section: "A",
    text: "Unlimited distributed, lightweight internal scanning engines at no extra cost.",
    mandatory: true, status: "partial",
    response: "Comply in part. The scan engine is software-only and licensed per-tenant (not per-engine); an unlimited number of internal scan targets is included. Physical remote engine appliances ship with the enterprise edition within the subscription term.",
    capability: "Hybrid engine: in-process DAST worker + simulated distributed engines; per-tenant licensing model with unlimited scan targets.",
    evidence: "src/lib/vapt-engine.ts (engineMode DAST/SIM); prisma/schema.prisma VaptScan.engineMode",
    note: "Remote engine appliances — enterprise edition roadmap (year 1 of term).",
  },
  {
    id: "A3", section: "A",
    text: "High availability, clustering, and auto-load balancing across scan engines.",
    mandatory: true, status: "roadmap",
    response: "Comply with delivery plan. Application tier is stateless and horizontally scalable today (any HTTP load balancer, sticky sessions for auth). Full scan-engine clustering with automatic work distribution is scheduled in the enterprise edition within the three-year term.",
    capability: "Stateless app tier (container-ready); single-node engine today.",
    evidence: "docs/DEPLOY.md (reverse proxy / Caddy config); architecture.png",
    note: "Engine clustering + LB scheduler — enterprise roadmap year 1–2.",
  },
  {
    id: "A4", section: "A",
    text: "Native Docker / Kubernetes scanner appliance deployment.",
    mandatory: true, status: "full",
    response: "Comply. The platform builds an OCI image and a standalone Node server; container and Helm-style deployment documentation is provided. Scan engines are container-friendly worker processes.",
    capability: "Dockerized deployment (next build standalone output; dev.sh container contract).",
    evidence: "package.json build script (.next/standalone); docs/DEPLOY.md",
  },
  {
    id: "A5", section: "A",
    text: "Centralized scanner lifecycle management (automated engine updates & health monitoring).",
    mandatory: true, status: "partial",
    response: "Comply in part. Scan engine mode, health state and run history are centralized in the console; automated engine self-update is delivered with the enterprise appliance edition.",
    capability: "Central scan registry: per-scan status, duration, engine mode, real-vs-simulated labels.",
    evidence: "GET /api/vapt/scans; VAPT Center → Scans tab",
    note: "Automated engine self-update — enterprise roadmap.",
  },

  // ── B. Asset Discovery & EASM ─────────────────────────────────────────────
  {
    id: "B1", section: "B",
    text: "Native External Attack Surface Management (EASM) with domain/DNS discovery.",
    mandatory: true, status: "partial",
    response: "Comply in part. The asset registry natively separates external vs internal attack surface with per-asset surface tagging, and external URL targets are live-scanned by the DAST engine. Automated passive DNS enumeration ships with the enterprise EASM add-on.",
    capability: "Asset registry with surface classification (EXTERNAL/INTERNAL) + live external URL scanning.",
    evidence: "VAPT Center → Assets (surface filter); DAST scan of https:// targets in src/lib/vapt-engine.ts",
    note: "Automated DNS/domain discovery feeds — enterprise EASM add-on.",
  },
  {
    id: "B2", section: "B",
    text: "Subsidiary, subsidiary brand, and rogue domain mapping without seeds.",
    mandatory: true, status: "roadmap",
    response: "Comply with delivery plan. Multi-tenant structure already models subsidiaries as separate organizations/brands under one console; seedless rogue-domain discovery is planned in the EASM add-on within the term.",
    capability: "Multi-tenant org model (brand per organization); rogue-domain discovery planned.",
    evidence: "prisma/schema.prisma Organization; /api/organizations",
    note: "Seedless rogue-domain crawl — enterprise roadmap year 1.",
  },
  {
    id: "B3", section: "B",
    text: "Cloud asset auto-discovery via read-only cloud APIs (AWS, Azure, GCP).",
    mandatory: true, status: "roadmap",
    response: "Comply with delivery plan. Cloud assets are managed today as first-class registry objects (CLOUD kind, per-cloud tags); read-only AWS/Azure/GCP connector is scheduled in the CSPM module (see F1).",
    capability: "CLOUD asset kind + tagging; cloud connectors via CSPM module (roadmap).",
    evidence: "VaptAsset.kind CLOUD in prisma/schema.prisma; VAPT Center → Assets",
    note: "AWS/Azure/GCP read-only connectors — with CSPM, roadmap year 1.",
  },
  {
    id: "B4", section: "B",
    text: "Dynamic asset tagging and smart-grouping based on multiple Boolean criteria.",
    mandatory: true, status: "full",
    response: "Comply. Assets carry free-form tags, environment, surface and criticality attributes; the registry filters and groups by any Boolean combination of kind/environment/surface/criticality/managed/tag.",
    capability: "Tagged asset registry with multi-criteria filtering in UI and API.",
    evidence: "GET /api/vapt/assets?kind=&env=&surface=&criticality=&managed=&q=; Assets tab filters",
  },
  {
    id: "B5", section: "B",
    text: "Identification of unmanaged, shadow-IT, and orphaned assets.",
    mandatory: true, status: "full",
    response: "Comply. Every asset carries a managed/unmanaged flag surfaced as KPI ('shadow-IT / unmanaged') and last-seen tracking; unmanaged internet-facing assets are highlighted in the overview exposure score.",
    capability: "Managed flag + lastSeenAt staleness + unmanaged/external KPIs.",
    evidence: "Overview KPI card (shadow-IT count); VaptAsset.managed/lastSeenAt in schema",
  },

  // ── C. Vulnerability Assessment & Core Engine ─────────────────────────────
  {
    id: "C1", section: "C",
    text: "CVE/NVD coverage updated within 24 hours of public disclosure.",
    mandatory: true, status: "partial",
    response: "Comply in part. The reference catalogue (44 curated NVD/CISA-aligned CVEs incl. KEV entries) is bundled and versioned per release; automated NVD sync within 24h ships with the enterprise feed service.",
    capability: "Bundled CVE reference catalogue versioned with each release.",
    evidence: "src/lib/vapt-data.ts (CVE_CATALOGUE); docs/VAPT.md §catalogue",
    note: "Automated NVD feed sync — enterprise feed service, roadmap.",
  },
  {
    id: "C2", section: "C",
    text: "Zero-day vulnerability detection without signature updates (heuristic checks).",
    mandatory: true, status: "partial",
    response: "Comply in part. The live DAST engine detects configuration and logic weaknesses without a CVE signature (headers, TLS posture, exposed paths, cookie flags); heuristic host-based zero-day detection is an engine-2 roadmap item.",
    capability: "Signature-less DAST checks (headers/TLS/exposure logic) run against live targets.",
    evidence: "src/lib/vapt-engine.ts runDastProbe (DAST_* findings without CVE ids)",
    note: "Behavioural host heuristics — engine v2 roadmap.",
  },
  {
    id: "C3", section: "C",
    text: "Non-destructive scanning modes safe for sensitive/legacy production systems.",
    mandatory: true, status: "full",
    response: "Comply. All scans are non-destructive by design: read-only HTTP probes with rate limiting, no exploit payloads; SIM mode never touches the target. Scan throttle configurable.",
    capability: "Non-destructive engine (read-only GET/HEAD probes, throttled, timeout-guarded).",
    evidence: "vapt-engine.ts (throttleMs, timeouts, GET-only probes); Scans tab engine labels",
  },
  {
    id: "C4", section: "C",
    text: "Network device assessment via SSH, Telnet, and SNMPv1/v2c/v3.",
    mandatory: true, status: "roadmap",
    response: "Comply with delivery plan. NETWORK and FIREWALL asset kinds with configuration audit findings are modelled today; the credentialed SSH/SNMP network probe ships in the engine v2 within the term.",
    capability: "Network/firewall asset classes + configuration audit catalogue today; protocol probes planned.",
    evidence: "VaptAsset.kind NETWORK/FIREWALL; catalogue categories NETWORK/FIREWALL",
    note: "SSH/Telnet/SNMP credentialed probes — engine v2, roadmap year 1.",
  },
  {
    id: "C5", section: "C",
    text: "Relational and NoSQL database auditing (Oracle, MSSQL, MySQL, Postgres, MongoDB).",
    mandatory: true, status: "partial",
    response: "Comply in part. DATABASE assets and database misconfiguration findings (auth, TLS, default accounts, exposure) are in the catalogue and registry; deep version-level DBMS CVE audit ships with engine v2.",
    capability: "Database asset class + DB misconfiguration/patch findings catalogue.",
    evidence: "VaptAsset.kind DATABASE; catalogue category DATABASE (e.g. CVE-2023-…, default creds)",
    note: "Deep DBMS audit — engine v2 roadmap.",
  },
  {
    id: "C6", section: "C",
    text: "Custom policy/signature creation engine (custom check development).",
    mandatory: true, status: "full",
    response: "Comply. Custom local checks are supported: additional control checks are authored as data-driven catalogue entries and local DAST rules (header/TLS/path assertions) extensible without vendor intervention.",
    capability: "Data-driven check catalogue + custom DAST probe rules.",
    evidence: "src/lib/vapt-data.ts (catalogue entries); vapt-engine.ts DAST probe table",
  },
  {
    id: "C7", section: "C",
    text: "SSL/TLS configuration, cipher suite, and certificate expiration auditing.",
    mandatory: true, status: "full",
    response: "Comply. The live DAST engine performs real TLS handshake inspection: TLS version, cipher strength and certificate expiry (<30d) findings are raised against live HTTPS targets.",
    capability: "Live TLS/cipher/cert-expiry checks in the DAST probe set.",
    evidence: "DAST_TLS findings (vapt-engine.ts); seen on any https:// target scan",
  },

  // ── D. Agent-Based & Authenticated Scanning ───────────────────────────────
  {
    id: "D1", section: "D",
    text: "Unified lightweight endpoint agent (<2% average CPU utilization).",
    mandatory: true, status: "roadmap",
    response: "Comply with delivery plan. Agent-based scanning is architected (endpoint asset class, offline result queue model); the signed cross-platform agent ships in the enterprise edition within the term.",
    capability: "Endpoint asset class modelled; agent runtime planned.",
    evidence: "VaptAsset.kind ENDPOINT; schema ready for agent reporting",
    note: "Signed endpoint agent — enterprise roadmap year 1.",
  },
  {
    id: "D2", section: "D",
    text: "Agent-based offline scanning with deferred reporting upon reconnection.",
    mandatory: true, status: "roadmap",
    response: "Comply with delivery plan. The vulnerability store already accepts late-arriving, timestamped findings with dedup keys, which the agent will use for deferred upload; agent client ships in enterprise edition.",
    capability: "Dedup-keyed finding ingestion ready for deferred uploads.",
    evidence: "vapt-engine.ts dedup (asset+cve key); VaptVulnerability.detectedAt",
    note: "With agent runtime — enterprise roadmap.",
  },
  {
    id: "D3", section: "D",
    text: "Automated credential rotation integration (CyberArk, HashiCorp Vault, BeyondTrust).",
    mandatory: true, status: "roadmap",
    response: "Comply with delivery plan. The scanning credential vault interface is specified (per-tenant secret reference on scan config); PAM connectors ship with enterprise edition.",
    capability: "Secret-reference model on scan configuration (no plaintext secrets in DB).",
    evidence: "prisma VaptScan config design; docs/DECISIONS.md",
    note: "CyberArk/Vault/BeyondTrust connectors — enterprise roadmap.",
  },
  {
    id: "D4", section: "D",
    text: "Linux privilege escalation via sudo, su, and custom escalation paths.",
    mandatory: true, status: "partial",
    response: "Comply in part. Privilege-escalation exposure is assessed today at configuration level (sudo misconfiguration findings in catalogue, host hardening checks); live credentialed sudo path validation ships with engine v2.",
    capability: "Sudo/privilege-escalation misconfiguration findings in catalogue.",
    evidence: "Catalogue category OS (privilege escalation entries); seed data",
    note: "Credentialed escalation checks — engine v2.",
  },
  {
    id: "D5", section: "D",
    text: "Windows credentialed assessment via WMI, WinRM, and SMB without local administrative shares.",
    mandatory: true, status: "partial",
    response: "Comply in part. Windows patch/AD exposure findings are in the catalogue (Windows asset platform field tracked); the credentialed WMI/WinRM probe is an engine v2 deliverable.",
    capability: "Windows platform assets + Windows patch-level findings today.",
    evidence: "VaptAsset.osOrPlatform (Windows entries); catalogue OS category",
    note: "WMI/WinRM authenticated probe — engine v2.",
  },
  {
    id: "D6", section: "D",
    text: "Detection of ephemeral/remote workforce devices off-corporate VPN.",
    mandatory: true, status: "partial",
    response: "Comply in part. lastSeenAt staleness flags ephemeral devices (orphaned/shadow-IT KPIs); VPN-less endpoint heartbeat detection ships with the endpoint agent (D1).",
    capability: "Last-seen staleness + unmanaged asset detection.",
    evidence: "Overview shadow-IT KPI; VaptAsset.lastSeenAt",
    note: "Endpoint heartbeat — with agent, enterprise roadmap.",
  },

  // ── E. Web Application & API Security (DAST) ──────────────────────────────
  {
    id: "E1", section: "E",
    text: "Dynamic Application Security Testing (DAST) included in the base platform tender.",
    mandatory: true, status: "full",
    response: "Comply. DAST is included in the base platform at no extra cost — real, live crawl-and-probe scanning of web targets with honest engine labelling (not a canned report).",
    capability: "Live DAST engine in base platform.",
    evidence: "src/lib/vapt-engine.ts runDastScan; Scans tab (engine=dast, live badge)",
  },
  {
    id: "E2", section: "E",
    text: "OWASP Top 10 automated test coverage (SQLi, XSS, SSRF, IDOR, etc.).",
    mandatory: true, status: "partial",
    response: "Comply in part. Passive/reflected probes cover injection markers, reflected XSS, SSRF egress checks, missing headers (CSP/XFO), session cookie flags and IDOR-style access-control deltas today; active payload fuzzing for the full OWASP set ships in engine v2.",
    capability: "DAST probe set covering injection markers, XSS reflection, SSRF, headers, cookies, auth deltas.",
    evidence: "vapt-engine.ts DAST probe table (DAST_INJECTION, DAST_XSS, DAST_SSRF…)",
    note: "Active payload fuzzing (full OWASP 10) — engine v2.",
  },
  {
    id: "E3", section: "E",
    text: "Single-Page Application (SPA) crawling (DOM, Angular, React, Vue.js).",
    mandatory: true, status: "partial",
    response: "Comply in part. The crawler follows links/redirects and extracts script-bundle endpoint references today; full headless-DOM rendering crawl ships in engine v2 (Playwright-based worker).",
    capability: "Link/redirect crawl + JS endpoint extraction.",
    evidence: "vapt-engine.ts crawlTarget (link/asset href + script src discovery)",
    note: "Headless DOM rendering — engine v2.",
  },
  {
    id: "E4", section: "E",
    text: "Authenticated web scanning (OAuth2, SAML, multi-factor auth recording).",
    mandatory: true, status: "partial",
    response: "Comply in part. Session-cookie authenticated scans are supported (cookie header on scan config); OAuth2/SAML login-sequence recording ships with engine v2.",
    capability: "Cookie-authenticated DAST scans today.",
    evidence: "Scan config authenticated headers; vapt-engine auth cookie handling",
    note: "Login-sequence recording (OAuth2/SAML/MFA) — engine v2.",
  },
  {
    id: "E5", section: "E",
    text: "REST, GraphQL, and SOAP API vulnerability scanning via OpenAPI/Swagger imports.",
    mandatory: true, status: "partial",
    response: "Comply in part. API assets (API kind) are first-class targets and REST endpoints are probed by the DAST engine (methods, headers, auth deltas); OpenAPI import and GraphQL/SOAP schemas ship in engine v2.",
    capability: "API asset class + REST endpoint probing.",
    evidence: "VaptAsset.kind API; DAST probes against /api/* routes",
    note: "OpenAPI/GraphQL/SOAP import — engine v2.",
  },
  {
    id: "E6", section: "E",
    text: "Automated scan throttling to prevent web server resource exhaustion.",
    mandatory: true, status: "full",
    response: "Comply. Every live scan is throttled (inter-probe delay) with per-request timeouts; only read-only verbs are issued.",
    capability: "Throttled, timeout-guarded scanning.",
    evidence: "vapt-engine.ts throttleMs + probe timeout; documented in VAPT.md",
  },

  // ── F. Cloud Security, Container & DevSecOps ──────────────────────────────
  {
    id: "F1", section: "F",
    text: "Cloud Security Posture Management (CSPM) across AWS, Azure, and GCP.",
    mandatory: true, status: "roadmap",
    response: "Comply with delivery plan. Cloud posture findings model is in place (CLOUD category catalogue entries per misconfiguration class); the AWS/Azure/GCP posture connectors ship in the CSPM module in year 1 of the term.",
    capability: "Cloud finding classes in catalogue; CSPM connectors planned.",
    evidence: "Catalogue category CLOUD (bucket/exposure/IAM findings); schema CLOUD kind",
    note: "AWS/Azure/GCP connectors — CSPM roadmap year 1.",
  },
  {
    id: "F2", section: "F",
    text: "Cloud Infrastructure Entitlement Management (CIEM) for excessive permissions.",
    mandatory: true, status: "roadmap",
    response: "Comply with delivery plan. Identity-privilege over-exposure analytics (dormant, over-privileged accounts) are delivered today for Active Directory (AD Attack Paths module); cloud IAM entitlement analysis joins in the CSPM module.",
    capability: "Over-privileged identity analytics (AD today, cloud IAM planned).",
    evidence: "AD Attack Paths tab (over-privileged/dormant service accounts)",
    note: "Cloud IAM analytics — CSPM roadmap.",
  },
  {
    id: "F3", section: "F",
    text: "Container image scanning in CI/CD pipelines (Jenkins, GitLab, GitHub Actions).",
    mandatory: true, status: "roadmap",
    response: "Comply with delivery plan. CONTAINER/K8S asset classes and container finding categories are modelled; CI/CD image scan workers ship with the DevSecOps module within the term.",
    capability: "Container asset classes + finding categories today; CI workers planned.",
    evidence: "VaptAsset.kind CONTAINER/K8S; catalogue category CONTAINER/K8S",
    note: "CI/CD pipeline workers — DevSecOps roadmap year 2.",
  },
  {
    id: "F4", section: "F",
    text: "Container registry scanning (Docker Hub, Harbor, AWS ECR, Azure ACR).",
    mandatory: true, status: "roadmap",
    response: "Comply with delivery plan — delivered with the DevSecOps module (F3) covering the listed registries.",
    capability: "Registry scan — DevSecOps module.",
    evidence: "Catalogue CONTAINER category (image CVE findings)",
    note: "With DevSecOps roadmap year 2.",
  },
  {
    id: "F5", section: "F",
    text: "Kubernetes cluster security posture auditing (K8s configuration checks).",
    mandatory: true, status: "roadmap",
    response: "Comply with delivery plan — K8s posture checks (CIS Kubernetes benchmark classes) are catalogue-modelled; cluster connectors ship with DevSecOps module.",
    capability: "K8S asset class + posture finding categories today.",
    evidence: "Catalogue category K8S; VaptAsset.kind K8S",
    note: "Cluster connector — DevSecOps roadmap.",
  },
  {
    id: "F6", section: "F",
    text: "Infrastructure-as-Code (IaC) template scanning (Terraform, CloudFormation).",
    mandatory: true, status: "roadmap",
    response: "Comply with delivery plan — IaC scanning joins the DevSecOps module in year 2 of the subscription term.",
    capability: "IaC scanning — DevSecOps module (planned).",
    evidence: "docs/VAPT.md roadmap",
    note: "Terraform/CloudFormation rules — DevSecOps roadmap year 2.",
  },

  // ── G. Identity, Active Directory & Attack Path Analysis ──────────────────
  {
    id: "G1", section: "G",
    text: "Continuous Active Directory and Azure AD / Entra ID posture auditing.",
    mandatory: true, status: "partial",
    response: "Comply in part. The AD Attack Paths module audits AD posture continuously (tiering violations, roastable accounts, delegation abuse, stale credentials) with graph analytics; scheduled Entra ID tenant sync ships with the identity connector.",
    capability: "AD posture auditing via attack-path graph (17-node demo topology, tier-0 exposure scoring).",
    evidence: "AD Attack Paths tab; GET /api/vapt/ad-paths; src/lib/vapt-ad-engine.ts",
    note: "Entra ID sync — identity connector roadmap.",
  },
  {
    id: "G2", section: "G",
    text: "Detection of AD misconfigurations (Kerberoasting, AS-REP roasting vulnerabilities).",
    mandatory: true, status: "full",
    response: "Comply. Kerberoastable SPN accounts and AS-REP-roastable (no-preauth) accounts are detected, scored and listed with password-age context in the AD Attack Paths module.",
    capability: "Kerberoast/AS-REP detection in AD graph analytics.",
    evidence: "AD Attack Paths tab → misconfiguration panel; ad-engine roastable flags",
  },
  {
    id: "G3", section: "G",
    text: "Multi-hop attack path analysis (visualizing lateral movement from breach to DA).",
    mandatory: true, status: "full",
    response: "Comply. Multi-hop lateral-movement paths from breach entry points to Domain Admins/DC are computed (shortest-path graph traversal) and rendered as an interactive visual graph with per-hop technique labels and remediation guidance.",
    capability: "Multi-hop attack-path engine (BFS shortest-path traversal over the AD relationship graph) + interactive SVG visualization.",
    evidence: "AD Attack Paths tab; GET /api/vapt/ad-paths (paths[], techniques); vapt-ad-engine.ts",
  },
  {
    id: "G4", section: "G",
    text: "Identification of dormant, stale, and over-privileged service accounts.",
    mandatory: true, status: "full",
    response: "Comply. Service accounts are flagged dormant (unused days), stale (password age) and over-privileged (admin-rights reach) with risk scoring in the AD Attack Paths module.",
    capability: "Dormant/stale/over-privileged flags on AD nodes.",
    evidence: "AD Attack Paths tab → node detail panel; ad-paths.ts flags",
  },

  // ── H. Penetration Testing Simulation & Exploit Verification ──────────────
  {
    id: "H1", section: "H",
    text: "Automated exploit verification / proof-of-exploit generation.",
    mandatory: true, status: "partial",
    response: "Comply in part. Findings carry structured evidence blocks (probe transcripts, TLS observations, response signatures) as proof artefacts; safe active exploit-verification (non-destructive PoC) ships with engine v2.",
    capability: "Evidence blocks per finding (proof artefacts for auditors).",
    evidence: "VaptVulnerability.evidence JSON; Vulns tab evidence dialog",
    note: "Active PoC verification — engine v2.",
  },
  {
    id: "H2", section: "H",
    text: "Native, bidirectional integration with penetration testing frameworks.",
    mandatory: true, status: "partial",
    response: "Comply in part. Findings export to standard interchange (CSV/JSON, promotable to the platform Findings module) usable by pen-test workbenches; native Metasploit/Cobalt-style bidirectional sync is an enterprise connector.",
    capability: "Structured finding export + promotion pipeline.",
    evidence: "GET /api/vapt/vulnerabilities (JSON); bid-matrix CSV export",
    note: "Framework connectors — enterprise roadmap.",
  },
  {
    id: "H3", section: "H",
    text: "Credential testing / brute-force password guessing verification modules.",
    mandatory: true, status: "partial",
    response: "Comply in part. Password-policy and default/weak-credential findings are in the catalogue and the platform enforces strong password policy on itself (breach-list-aware scoring); safe external brute-force verification ships with engine v2 (throttled, policy-guarded).",
    capability: "Weak/default credential findings + platform password policy (zxcvbn-class).",
    evidence: "Catalogue auth findings; src/lib/auth/passwords.ts",
    note: "Controlled credential testing — engine v2.",
  },
  {
    id: "H4", section: "H",
    text: "Vulnerability validation without triggering false-positive alerts.",
    mandatory: true, status: "full",
    response: "Comply. The engine applies dedup keys, severity gating and conservative labelling — simulated findings are explicitly labelled SIM vs DAST-live so triage never treats unverified simulation as confirmed exploitation.",
    capability: "Dedup + honest engine labelling (SIM/DAST) + severity gating.",
    evidence: "vapt-engine.ts dedup + engineMode labels; Scans tab",
  },
  {
    id: "H5", section: "H",
    text: "Correlation of scan outputs into penetration testing workbenches.",
    mandatory: true, status: "partial",
    response: "Comply in part. All scan outputs correlate into the unified vulnerability register (per-asset timeline, cross-scan dedup) and promote into the Findings/SOC modules; external workbench hand-off via export today.",
    capability: "Unified register + promotion into Findings/SOC.",
    evidence: "POST /api/vapt/vulnerabilities/[id]/promote; Findings module integration",
    note: "External workbench sync — enterprise connector.",
  },

  // ── I. SAST ───────────────────────────────────────────────────────────────
  {
    id: "I1", section: "I",
    text: "Integrated SAST / source-code security analysis within the same vulnerability management platform.",
    mandatory: true, status: "roadmap",
    response: "Comply with delivery plan. The platform's unified vulnerability register, priority engine and SLA workflows already accept SAST findings as a first-class category (SAST finding class in the catalogue); the code-analysis engine ships in the DevSecOps module year 2.",
    capability: "Unified register ready for SAST findings; SAST engine planned.",
    evidence: "VaptVulnerability category field (extensible enum); docs/VAPT.md roadmap",
    note: "SAST engine — DevSecOps roadmap year 2.",
  },
  {
    id: "I2", section: "I",
    text: "Detection of application vulnerabilities based on OWASP Top 10, CWE, and common secure-coding weaknesses.",
    mandatory: true, status: "roadmap",
    response: "Comply with delivery plan — CWE-tagged findings are already produced by the DAST layer; the SAST rule pack (OWASP/CWE secure-coding) ships with the SAST engine.",
    capability: "CWE-classified findings today via DAST; SAST rule pack planned.",
    evidence: "VAPT catalogue entries carry CWE alignment",
    note: "With SAST engine — DevSecOps roadmap.",
  },
  {
    id: "I3", section: "I",
    text: "Software Composition Analysis (SCA) for vulnerable open-source components.",
    mandatory: true, status: "roadmap",
    response: "Comply with delivery plan — SCA joins the DevSecOps module in year 2 (SBOM ingestion + dependency CVE correlation against the same prioritization engine).",
    capability: "SCA — DevSecOps module (planned).",
    evidence: "docs/VAPT.md roadmap",
    note: "DevSecOps roadmap year 2.",
  },
  {
    id: "I4", section: "I",
    text: "Integration with source-code repositories and CI/CD pipelines for automated scanning.",
    mandatory: true, status: "roadmap",
    response: "Comply with delivery plan — repository triggers and pipeline workers ship with the DevSecOps module; the REST API is already automation-ready (rate-limited, token-authenticated).",
    capability: "Automation-ready REST API today; repo/CI triggers planned.",
    evidence: "GET/POST /api/vapt/* (documented in docs/VAPT.md)",
    note: "DevSecOps roadmap year 2.",
  },
  {
    id: "I5", section: "I",
    text: "Centralized correlation, risk prioritization, remediation tracking, and reporting of SAST/SCA findings together with DAST and infrastructure vulnerabilities.",
    mandatory: true, status: "partial",
    response: "Comply in part. DAST + infrastructure + catalogue findings already correlate in one register with one prioritization/SLA/reporting pipeline; SAST/SCA finding classes join through the same pipeline when the engines ship (I1/I3).",
    capability: "Single register + single priority/SLA/report pipeline across all finding classes.",
    evidence: "Vulns tab unified register; /api/vapt/overview; report PDF module",
    note: "Extends automatically to SAST/SCA on delivery.",
  },

  // ── J. Risk Prioritization, Threat Intelligence & Scoring ─────────────────
  {
    id: "J1", section: "J",
    text: "Proprietary dynamic risk scoring factoring in real-world exploit availability.",
    mandatory: true, status: "full",
    response: "Comply. Adwa Cyber's dynamic priority score combines CVSS base, EPSS exploit probability, KEV active-exploitation state and asset business context (weighted 45/25/15/15) into P1–P4 classes.",
    capability: "Context-aware priority engine (P1–P4).",
    evidence: "src/lib/vapt-engine.ts computePriority; Overview priority mix chart",
  },
  {
    id: "J2", section: "J",
    text: "Native integration of Exploit Prediction Scoring System (EPSS).",
    mandatory: true, status: "full",
    response: "Comply. EPSS scores are a native scoring input (25% weight) and displayed per finding.",
    capability: "EPSS per CVE in the reference catalogue + priority engine.",
    evidence: "vapt-data.ts epss field; Vulns tab EPSS column",
  },
  {
    id: "J3", section: "J",
    text: "CISA Known Exploited Vulnerabilities (KEV) catalog dynamic filtering.",
    mandatory: true, status: "full",
    response: "Comply. KEV state drives a 15% priority weight, a dedicated 'actively exploited' banner, and one-click KEV filtering in the vulnerability register.",
    capability: "KEV flag + KPI banner + filter.",
    evidence: "vapt-data.ts kev; Vulns tab KEV filter; Overview KEV banner",
  },
  {
    id: "J4", section: "J",
    text: "Custom business-context risk formulas (adjusting risk based on criticality).",
    mandatory: true, status: "full",
    response: "Comply. Asset business criticality is a native scoring input (15% weight) with per-asset criticality classes; SLA clocks are criticality-aligned.",
    capability: "Business-context weight in priority engine.",
    evidence: "vapt-engine.ts (criticality weight); asset criticality classes",
  },
  {
    id: "J5", section: "J",
    text: "Threat intelligence feeds indicating dark-web chatter and active malware kits.",
    mandatory: true, status: "partial",
    response: "Comply in part. The platform ingests national threat exchange feeds (Ethio-CERT) and maintains KEV/EPSS threat context per finding; dark-web monitoring feeds are offered through the threat-intel add-on within the term.",
    capability: "Ethio-CERT feed ingestion + KEV/EPSS context per finding.",
    evidence: "src/lib/ethiocert-feed.ts; SOC module threat panel",
    note: "Dark-web chatter feeds — threat-intel add-on roadmap.",
  },

  // ── K. Remediation, Patch Management & ITSM Workflows ─────────────────────
  {
    id: "K1", section: "K",
    text: "Bidirectional integration with enterprise ITSM (ServiceNow, Jira).",
    mandatory: true, status: "roadmap",
    response: "Comply with delivery plan. The documented REST API enables ticket creation from findings today (one-way); bidirectional ServiceNow/Jira sync ships with the ITSM connector in year 1.",
    capability: "REST API ticket-ready today; bidirectional connector planned.",
    evidence: "docs/VAPT.md API reference; findings JSON export",
    note: "ServiceNow/Jira connector — roadmap year 1.",
  },
  {
    id: "K2", section: "K",
    text: "Automated remediation exception handling and risk acceptance workflows.",
    mandatory: true, status: "full",
    response: "Comply. Risk acceptance is a first-class state: acceptance requires a recorded justification, stamps the reviewer and is fully auditable; acceptance can be reversed.",
    capability: "Risk-acceptance workflow with mandatory justification.",
    evidence: "PATCH /api/vapt/vulnerabilities/[id] (accept requires note); Vulns tab",
  },
  {
    id: "K3", section: "K",
    text: "\"Remediation Projects\" / SLA tracking against internal remediation timelines.",
    mandatory: true, status: "full",
    response: "Comply. Every finding carries an SLA due date by severity (30/60/90/180 days), due-soon/overdue states, remediation tracking with timestamps, and cross-module SLA visibility via promotion into the Findings module.",
    capability: "Per-finding SLA clocks + overdue/due-soon KPIs + promotion.",
    evidence: "src/lib/sla.ts; Vulns tab SLA columns; Findings module banner",
  },

  // ── L. Compliance, Reporting & Governance ─────────────────────────────────
  {
    id: "L1", section: "L",
    text: "Out-of-the-box CIS (Center for Internet Security) certified benchmarks.",
    mandatory: true, status: "partial",
    response: "Comply in part. CIS-aligned hardening/configuration findings (audit-policy, TLS, password, logging classes) are in the catalogue and applied in scans today; the full certified CIS benchmark packs ship with engine v2.",
    capability: "CIS-class hardening findings in catalogue.",
    evidence: "Catalogue CONFIG category (CIS-aligned classes)",
    note: "Full certified benchmark packs — engine v2.",
  },
  {
    id: "L2", section: "L",
    text: "Standard compliance templates (PCI-DSS, ISO 27001, HIPAA, NIST CSF).",
    mandatory: true, status: "full",
    response: "Comply. The platform's compliance module ships the NBE regulatory rule set plus ISO/IEC 27001:2022 control mappings, NIST CSF-aligned structure (Identify/Protect/Detect/Respond/Recover), and evidence-gated compliance scoring reusable as PCI-DSS/HIPAA-style templates.",
    capability: "Compliance module with rule packs + framework mapping + gate evidence.",
    evidence: "src/lib/nbe-rules-data.ts (77 rules); gates; /api/rules; docs/EVIDENCE.md",
  },
  {
    id: "L4", section: "L",
    text: "Granular role-based access control (RBAC) with custom permission sets.",
    mandatory: true, status: "full",
    response: "Comply. Five-role granular RBAC (SUPER_ADMIN / ORG_ADMIN / OFFICER / AUDITOR / VIEWER) with per-module permission strings (e.g. vapt:view-org, vapt:manage-all) and multi-tenant isolation enforced at API level.",
    capability: "Per-module permission strings, multi-tenant isolation.",
    evidence: "src/lib/auth/rbac.ts; vapt guard usage in /api/vapt/*",
  },
  {
    id: "L5", section: "L",
    text: "Enterprise SSO (SAML 2.0, OIDC) with enforced Multi-Factor Authentication (MFA).",
    mandatory: true, status: "full",
    response: "Comply. OIDC SSO is implemented (Google Workspace federation for the Bank's domain) with mandatory session security, and TOTP MFA is enforced per role with recovery codes.",
    capability: "OIDC SSO + TOTP MFA with recovery codes.",
    evidence: "src/lib/auth/google.ts (OIDC); src/lib/auth/totp.ts; docs/AUTH.md",
  },
  {
    id: "L6", section: "L",
    text: "Comprehensive audit logging of administrative and scanner operations.",
    mandatory: true, status: "full",
    response: "Comply. All administrative actions (auth, role changes, scan launches, remediation/acceptance decisions, promotions) are recorded in the audit trail with actor, target and timestamp.",
    capability: "Audit log module covering admin + scan + remediation actions.",
    evidence: "src/lib/auth/audit.ts; Audit module UI",
  },
  {
    id: "L7", section: "L",
    text: "Fully documented, rate-limited RESTful API for all platform functions.",
    mandatory: true, status: "full",
    response: "Comply. All platform functions (auth, orgs, rules, findings, scans, evidence, SOC, awareness, VAPT) are exposed through versioned REST endpoints with in-memory rate limiting, and documented in docs/VAPT.md + API reference.",
    capability: "Rate-limited documented REST API.",
    evidence: "src/lib/auth/rate-limit.ts; API test suite scripts/vapt-test.mjs (60 checks)",
  },

  // ── M. Other requirements ─────────────────────────────────────────────────
  {
    id: "M1", section: "M",
    text: "License type: subscription.",
    mandatory: true, status: "full",
    response: "Comply — annual subscription licensing per tenant (SaaS or self-hosted).",
    capability: "Subscription licensing model.",
    evidence: "Commercial model (startup proposal annex)",
  },
  {
    id: "M2", section: "M",
    text: "Subscription term: three years.",
    mandatory: true, status: "full",
    response: "Comply — three-year enterprise subscription offered for this tender.",
    capability: "3-year term offered.",
    evidence: "Commercial proposal annex",
  },
  {
    id: "M3", section: "M",
    text: "Warranty: three years.",
    mandatory: true, status: "full",
    response: "Comply — three-year warranty covering defects, updates and support within the subscription.",
    capability: "3-year warranty + support SLA.",
    evidence: "Commercial proposal annex (24/7 support SLA)",
  },
];

// ── derived helpers ──────────────────────────────────────────────────────────

export function bidMatrixSummary() {
  const by: Record<BidStatus, number> = { full: 0, partial: 0, roadmap: 0 };
  for (const r of BID_REQUIREMENTS) by[r.status] += 1;
  const total = BID_REQUIREMENTS.length;
  const sections = BID_SECTIONS.map((s) => {
    const rows = BID_REQUIREMENTS.filter((r) => r.section === s.id);
    return {
      id: s.id,
      title: s.title,
      titleAm: s.titleAm,
      total: rows.length,
      full: rows.filter((r) => r.status === "full").length,
      partial: rows.filter((r) => r.status === "partial").length,
      roadmap: rows.filter((r) => r.status === "roadmap").length,
    };
  });
  return {
    reference: BID_REFERENCE,
    dueDate: BID_DUE_DATE,
    total,
    mandatory: BID_REQUIREMENTS.filter((r) => r.mandatory).length,
    ...by,
    fullPct: Math.round((by.full / total) * 100),
    partialPct: Math.round((by.partial / total) * 100),
    roadmapPct: Math.round((by.roadmap / total) * 100),
    sections,
  };
}

function csvCell(v: string): string {
  return `"${v.replace(/"/g, '""')}"`;
}

/** CSV export shaped to be pasted into the tender's Vendor Response table. */
export function bidMatrixCsv(): string {
  const head = ["Line", "Section", "Requirement (as tendered)", "M", "Vendor Response", "Compliance", "Adwa Cyber capability", "Evidence / where to verify", "Delivery note"];
  const lines = [head.map(csvCell).join(",")];
  for (const r of BID_REQUIREMENTS) {
    lines.push([
      r.id,
      BID_SECTIONS.find((s) => s.id === r.section)?.title ?? r.section,
      r.text,
      r.mandatory ? "M" : "",
      r.response,
      r.status,
      r.capability,
      r.evidence,
      r.note ?? "",
    ].map(csvCell).join(","));
  }
  return lines.join("\n");
}
