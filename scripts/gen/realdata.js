/**
 * realdata.js - "Real-Data Review & Roadmap" docx: comments and suggestions for
 * making Adwa Sec fully real (internet data instead of demo fixtures).
 * English document, DM-1 palette, R1 cover (reuses gen infrastructure).
 */
const {
  Document, Packer, Paragraph, TextRun, Header, Footer,
  AlignmentType, PageNumber, NumberFormat, SectionType,
  BorderStyle, ShadingType,
} = require("docx");
const fs = require("fs");

const {
  PAL, EN_FONT,
  h1, h2, h3, body, bodyRuns, bullet,
  tableCaption, bizTable,
} = require("./helpers");
const { buildCoverR1 } = require("./cover");

const MONO = { ascii: "Courier New", eastAsia: "Courier New" };

function cmd(text) {
  return new Paragraph({
    alignment: AlignmentType.LEFT,
    spacing: { before: 60, after: 60, line: 276 },
    indent: { left: 240, right: 120 },
    shading: { type: ShadingType.CLEAR, fill: "F0F4F6" },
    border: { left: { style: BorderStyle.SINGLE, size: 12, color: PAL.table.accentLine, space: 8 } },
    children: [
      new TextRun({ text: "$ ", bold: true, size: 19, color: "1B6B7A", font: MONO }),
      new TextRun({ text, size: 19, color: "17313D", font: MONO }),
    ],
  });
}

function note(text) {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { before: 60, after: 160, line: 312 },
    indent: { left: 240, right: 240 },
    border: { left: { style: BorderStyle.SINGLE, size: 6, color: PAL.table.accentLine, space: 10 } },
    children: [
      new TextRun({ text: "Note: ", bold: true, size: 22, color: PAL.headingColor, font: EN_FONT }),
      new TextRun({ text, size: 22, color: "333333", font: EN_FONT }),
    ],
  });
}

// ── Cover ───────────────────────────────────────────────────────────────────
const coverConfig = {
  title: "Real-Data Review and Roadmap",
  subtitle: "Comments and suggestions: replacing demo fixtures with live internet data across the Adwa Sec platform",
  englishLabel: "ADWA SEC ADVISORY",
  metaLines: [
    "Version 1.0 - issued 19 November 2026",
    "Scope: VAPT intelligence, SOC threat feeds, EASM, authentication, notifications",
    "Position: platform assessment with a phased, cost-aware implementation plan",
  ],
  footerLeft: "Adwa Cyber Research Lab",
  footerRight: "Bahir Dar, Ethiopia",
  palette: {
    bg: PAL.bg, accent: PAL.accent,
    titleColor: PAL.cover.titleColor, subtitleColor: PAL.cover.subtitleColor,
    metaColor: PAL.cover.metaColor, footerColor: PAL.cover.footerColor,
  },
};

const c = [];

// ── 1. Executive summary ────────────────────────────────────────────────────
c.push(h1("1. Executive Summary"));
c.push(body(
  "Adwa Sec is already substantially real where it matters most technically: vulnerability detection runs real network probes and is enriched against authoritative internet feeds (NVD, FIRST EPSS, CISA KEV), and external discovery queries real certificate-transparency logs. What remains demo is concentrated in three places: SOC threat intelligence (seeded fixtures and a mock national-CERT exchange), the authentication and notification surroundings (mock Google OAuth, console email), and the pilot organization estate. This document inventories what is already live, what is still fixture, and gives a phased, cost-aware plan for replacing each remaining fixture with real internet data - with the licensing terms, effort estimates and safety notes for each source."));
c.push(body(
  "The headline recommendation: adopt free, no-key public feeds first (CISA KEV, abuse.ch URLhaus/ThreatFox, GreyNoise Community, AlienVault OTX) to make the SOC hub live within days; keep the platform's established honesty pattern - every table carries a source column and an as-of date, and offline fallbacks are labelled as snapshots rather than silently served as live. That pattern is already implemented in the VAPT and EASM modules and is the platform's strongest credibility asset when presenting to NBE and the incubator jury."));
c.push(bodyRuns([
  ["Effort summary: ", true],
  ["Phase 1 (free public feeds, about 3 to 5 working days) makes the SOC hub live. Phase 2 (keyed free feeds plus a self-hosted MISP, about 2 weeks) deepens the intelligence. Phase 3 (production national-CERT binding, real OAuth, real SMTP) is mostly coordination, not code - the binding code already exists behind environment variables.", false],
]));

// ── 2. What is already real ─────────────────────────────────────────────────
c.push(h1("2. What Is Already Real (Live Internet Data)"));
c.push(tableCaption("Live data sources in production use today"));
c.push(bizTable(
  ["Module", "Real source", "How it is used"],
  [
    ["VAPT CVE enrichment", "NVD API 2.0 (services.nvd.nist.gov)", "CVSS v3.1 base scores and vectors are pulled for every matched vulnerability; the snapshot is rebuilt from the live API by scripts/fetch-vapt-feed.ts"],
    ["Exploit probability", "FIRST EPSS API (api.first.org)", "EPSS score and percentile annotate every finding; prioritisation uses EPSS, not CVSS alone"],
    ["Known-exploited status", "CISA KEV (NVD cisaExploitAdd field)", "Each finding shows KEV status; KEV-open items are surfaced as active exploitation risk"],
    ["External discovery", "crt.sh certificate-transparency logs", "EASM sweeps query every certificate ever issued for the authorized root domain, live, with retry"],
    ["Name resolution", "Live DNS", "Discovered hostnames are resolved to real current IP addresses"],
    ["Network probes", "Real TCP/TLS/banner/HTTP requests", "Port scanning, banner capture, TLS handshake and header analysis against in-scope targets - no simulation"],
    ["Credentialed audits", "Real wire protocols", "SNMP v1/v2c/v3 device audit, MongoDB OP_MSG/SCRAM handshake, MariaDB handshake with the seeded audit account"],
    ["Security-intel ticker", "Published research (NIST, CIS, OWASP, FIRST, CISA, Verizon DBIR, IBM)", "The header ticker shows verifiable published facts with the publishing organization named"],
    ["Rule catalogue", "Regulatory instruments", "47 obligations of Proclamation No. 1321/2024 and the NBE framework rules are encoded as machine-readable rules"],
  ],
  [22, 30, 48]
));
c.push(note(
  "The platform's honesty pattern deserves highlighting: when the internet is unreachable, the feed falls back to a bundled snapshot that was captured from the real source, carries an as-of date, and is labelled in the user interface as a snapshot rather than presented as live. This is exactly how a professional system should degrade, and it should be preserved and extended to every new source."));

// ── 3. What is still demo ───────────────────────────────────────────────────
c.push(h1("3. What Is Still Demo (and Why It Exists)"));
c.push(tableCaption("Remaining fixtures and their purpose"));
c.push(bizTable(
  ["Fixture", "Where it appears", "Why it is fixture today"],
  [
    ["SOC incidents, alerts and hub indicators", "Security Operations module", "No live feed binding configured; entries follow the INTERPOL Africa threat assessment's categories but values are synthetic documentation IPs"],
    ["Ethio-CERT exchange", "SOC sync panel (fixture mode)", "The live client exists (ETHIOCERT_API_URL/KEY) but the production national endpoint and credentials are not yet issued; the mock exchange on port 3020 exercises the full pipeline deterministically"],
    ["Google sign-in", "Login screen", "Real OAuth flow is implemented; mock Google on port 3010 stands in while GOOGLE_CLIENT_ID/SECRET are unset"],
    ["Email delivery", "Password reset, verification", "Mail transport is pluggable; dev uses the console transport, so no real mail leaves the machine"],
    ["Pilot organizations and their estate", "Organizations, assets, scan history", "Tenants are seeded demo banks (CBE, Dashen, Ethio Telecom); real data arrives with real onboarding"],
    ["EPSS fallback constants", "VAST engine, rare unmatched banners", "When no feed entry matches a banner, conservative default EPSS values are used; a live feed lookup removes the need"],
    ["Track C timeline", "Governance gates", "Seeded accountability events for the demo deployment"],
    ["The vulnerable lab", "VAPT demo target", "Intentionally vulnerable by design - this one should stay, see Section 6"],
  ],
  [26, 28, 46]
));

// ── 4. Phase 1 ──────────────────────────────────────────────────────────────
c.push(h1("4. Phase 1 - Free Public Feeds (Days, No API Keys)"));
c.push(body(
  "These sources need no key or payment, are officially published as machine-readable feeds, and can light up the SOC hub and the VAPT overview with genuinely live data immediately."));
c.push(h2("4.1 CISA Known Exploited Vulnerabilities catalog"));
c.push(body(
  "The KEV catalog is published as a JSON feed in the public domain. Fetch it on a schedule, ingest into the threat-intel hub, and cross-reference VAPT findings: any detected vulnerability present in KEV gets flagged as actively exploited. This closes the loop the engine already opens (it reads KEV status from the NVD-sourced feed; a direct feed makes the SOC side live too)."));
c.push(h2("4.2 abuse.ch feeds: URLhaus and ThreatFox"));
c.push(body(
  "URLhaus serves active malware URL distribution data; ThreatFox serves IOCs observed in the wild. Both are free JSON APIs under abuse.ch terms, which ask for attribution. A scheduled pull (rate-limit friendly: every 30-60 minutes) populates the indicator hub with real, current malicious URLs and hashes. The sync history table already exists - each pull becomes a LIVE sync row with receipt id and counts, exactly like the current Ethio-CERT sync UI."));
c.push(h2("4.3 GreyNoise Community"));
c.push(body(
  "GreyNoise classifies internet-wide background scanning. The Community API (free key) answers whether an IP hitting your honeypot or logs is a known mass scanner, with the tags and the intent classification. This turns raw noisy events into actionable context - and it is exactly the kind of enrichment a professional SOC shows on stage."));
c.push(h2("4.4 AlienVault OTX"));
c.push(body(
  "OTX is a large open indicator-sharing platform with a free API key. Subscribing to regional and banking-sector pulses gives a daily stream of real indicators that map directly onto the hub's existing classification taxonomy."));
c.push(tableCaption("Phase 1 sources at a glance"));
c.push(bizTable(
  ["Source", "Content", "Access", "Terms"],
  [
    ["CISA KEV", "Actively exploited CVEs", "Public JSON, no key", "Public domain"],
    ["abuse.ch URLhaus", "Malware distribution URLs", "Free API", "Free with attribution"],
    ["abuse.ch ThreatFox", "IOCs observed in the wild", "Free API", "Free with attribution"],
    ["GreyNoise Community", "Internet scanner classification", "Free key", "Community tier"],
    ["AlienVault OTX", "Community indicator pulses", "Free key", "Rate-limited"],
  ],
  [24, 32, 22, 22]
));
c.push(body(
  "Implementation shape: one scheduled connector per source behind the existing sync pipeline (fetch, validate, dedupe by indicator value, classify, publish to the tenant hub), a source column on every hub row (LIVE - URLhaus 12:40), and the same as-of honesty labelling the EASM module already renders. Estimated effort: one connector per day including tests."));

// ── 5. Phase 2 ──────────────────────────────────────────────────────────────
c.push(h1("5. Phase 2 - Keyed and Self-Hosted Intelligence (About Two Weeks)"));
c.push(h2("5.1 MISP self-hosted"));
c.push(body(
  "MISP is the open-source threat-intelligence platform used by national CERTs worldwide. Self-hosting one instance (it is AGPL, free) and connecting it through its REST API gives the platform a curated, private sharing channel: INSA or sector peers can push sensitive indicators that must never appear in public feeds. The connector maps MISP events onto the existing hub taxonomy and honours TLP markings - TLP:AMBER+ items stay inside the tenant, which mirrors how real national exchanges behave."));
c.push(h2("5.2 Paid enrichment where it pays"));
c.push(bullet("Shodan or SecurityTrails for EASM enrichment: real historical IP and certificate data per discovered hostname, plus exposed-service context. Paid tiers; the discovery registry already has the columns for it."));
c.push(bullet("VirusTotal public API for hash and URL reputation on evidence artefacts; the free tier is rate-limited but sufficient for a pilot."));
c.push(h2("5.3 Remove the EPSS fallback constants"));
c.push(body(
  "Once the feed sync refreshes EPSS data on schedule (FIRST publishes daily scores), the conservative fallback constants in the engine can be retired or narrowed to the strict offline case, always labelled."));

// ── 6. Phase 3 ──────────────────────────────────────────────────────────────
c.push(h1("6. Phase 3 - Production Bindings (Coordination, Not Code)"));
c.push(h2("6.1 The real Ethio-CERT / INSA exchange"));
c.push(body(
  "The live binding already exists in code: setting ETHIOCERT_API_URL and ETHIOCERT_API_KEY switches the sync from fixture mode to a live exchange, and the UI honestly reports which mode is active. What is missing is the production endpoint and credentials from the national authority - a coordination step with INSA, not an engineering step. Until issued, keep the mock for tests and label the fixture mode clearly in the UI (which it already is)."));
c.push(h2("6.2 Real Google sign-in"));
c.push(body(
  "Register the production domain with Google Cloud Console, set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET, and the same code path switches from the mock to real Google accounts. The mock then remains as the deterministic test double in CI."));
c.push(h2("6.3 Real email delivery"));
c.push(body(
  "The mail transport is pluggable by design. Point SMTP (or a transactional provider) at the existing transport interface and password-reset and verification mail start flowing for real. Nothing else changes."));
c.push(h2("6.4 Real tenants"));
c.push(body(
  "The create-organization onboarding flow already exists on the login screen. Real pilot banks onboard themselves; the seeded estate then serves only as the offline demo dataset."));

// ── 7. Keep these demo ─────────────────────────────────────────────────────
c.push(h1("7. What Should Stay Demo (Deliberately)"));
c.push(bullet("The vulnerable lab. A safe, deterministic, always-available target with crafted banners is what makes the on-stage VAPT demo repeatable in any network condition - real internet targets are neither authorized nor stable. The runbook relies on it."));
c.push(bullet("The offline feed snapshots. Air-gapped and offline demos need them, and the as-of labelling keeps them honest."));
c.push(bullet("The mock Ethio-CERT and mock Google services. Deterministic CI test doubles; they keep the 548-check battery reproducible without internet access."));
c.push(body(
  "The principle: demo data only where reality requires authorization, payment or determinism that the internet cannot provide. Live data everywhere else."));

// ── 8. Engineering practices ───────────────────────────────────────────────
c.push(h1("8. Engineering Practices for Live Data"));
c.push(bullet("Source column on every ingested table: LIVE - source name - timestamp, or SNAPSHOT - as-of. The EASM and VAPT modules already model this; extend it to the SOC hub."));
c.push(bullet("Scheduled sync with jitter and per-source rate limits; cache responses; never block a user request on a third-party API."));
c.push(bullet("Keys only in server-side environment variables; never in the repository. The platform already follows this - keep it."));
c.push(bullet("Continue writing every ingestion into the hash-chained audit log (the sync receipt ids already do this) - auditable provenance is a differentiator when pitching to regulators."));
c.push(bullet("Graceful degradation: on network failure, serve the last good snapshot labelled with its date, never silently fabricate live-looking data."));
c.push(bullet("Active scanning stays four-eyes authorized and scope-gated exactly as implemented; new passive sources must also pass the authorization-first rule (the EASM endpoint already demonstrates the pattern)."));

// ── 9. Priority map ─────────────────────────────────────────────────────────
c.push(h1("9. Recommended Priority Order"));
c.push(tableCaption("Priority map with effort and payoff"));
c.push(bizTable(
  ["#", "Action", "Effort", "Why first"],
  [
    ["1", "CISA KEV feed into the hub", "1 day", "No key, no ToS friction, immediate live table; cross-references VAPT findings"],
    ["2", "abuse.ch URLhaus + ThreatFox", "2 days", "Real current IOCs; sync history becomes LIVE rows with receipts"],
    ["3", "Source/as-of columns across SOC tables", "1 day", "Credibility pattern made consistent platform-wide"],
    ["4", "GreyNoise + OTX connectors", "2 days", "Context-rich live intelligence, free keys"],
    ["5", "Production SMTP", "0.5 day", "Real email for reset/verification; config only"],
    ["6", "Real Google OAuth credentials", "0.5 day", "Config only; mock stays for CI"],
    ["7", "Self-hosted MISP + connector", "1-2 weeks", "Private sector sharing, INSA-ready"],
    ["8", "INSA production binding", "coordination", "Code exists; needs credentials and agreement"],
  ],
  [6, 34, 14, 46]
));
c.push(body(
  "Items 1 to 6 are achievable inside a single week and would make every externally visible table in the platform either live or honestly labelled as a snapshot. That is the single strongest move available for the incubator presentation: a platform whose every number can be traced to a named public source or a scope-authorized probe."));
c.push(note(
  "The rebuild command for the vulnerability feed snapshot already exists and shows the pattern every new connector should follow:"));
c.push(cmd("node scripts/fetch-vapt-feed.ts   # rebuilds vapt-feed-snapshot.json from live NVD + FIRST + KEV"));

// ---------------------------------------------------------------------------
const pgSize = { width: 11906, height: 16838 };
const pgMargin = { top: 1440, bottom: 1440, left: 1701, right: 1417 };

function docHeader() {
  return new Header({
    children: [new Paragraph({
      alignment: AlignmentType.RIGHT,
      border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: "C8DDE2", space: 4 } },
      children: [new TextRun({ text: "Adwa Sec - Real-Data Review and Roadmap", size: 18, color: "808080", font: EN_FONT })],
    })],
  });
}

function pageFooter() {
  return new Footer({
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ children: [PageNumber.CURRENT], size: 18, color: "595959", font: EN_FONT })],
    })],
  });
}

const doc = new Document({
  styles: {
    default: {
      document: {
        run: { font: EN_FONT, size: 24, color: "000000" },
        paragraph: { spacing: { line: 312 } },
      },
      heading1: {
        run: { font: EN_FONT, size: 32, bold: true, color: PAL.headingColor },
        paragraph: { spacing: { before: 400, after: 180, line: 312 } },
      },
      heading2: {
        run: { font: EN_FONT, size: 28, bold: true, color: PAL.headingColor },
        paragraph: { spacing: { before: 280, after: 140, line: 312 } },
      },
      heading3: {
        run: { font: EN_FONT, size: 24, bold: true, color: PAL.headingColor },
        paragraph: { spacing: { before: 220, after: 120, line: 312 } },
      },
    },
  },
  sections: [
    {
      properties: { page: { size: pgSize, margin: { top: 0, bottom: 0, left: 0, right: 0 } } },
      children: buildCoverR1(coverConfig),
    },
    {
      properties: {
        type: SectionType.NEXT_PAGE,
        page: { size: pgSize, margin: pgMargin, pageNumbers: { start: 1, formatType: NumberFormat.DECIMAL } },
      },
      headers: { default: docHeader() },
      footers: { default: pageFooter() },
      children: c,
    },
  ],
});

const OUT = process.cwd() + "/download/AdwaSec_Real_Data_Review_and_Roadmap.docx";
Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync(OUT, buf);
  console.log("written: " + OUT + " (" + buf.length + " bytes)");
});
