/**
 * Adwa Cyber — production bindings registry model (Real-Data Roadmap Phase 3).
 *
 * Phase 3 of the real-data roadmap is "production bindings": the live code
 * paths for Google SSO, SMTP mail, the Ethio-CERT bilateral exchange, the
 * keyed intel feeds and EPSS already exist and switch on their environment
 * variables. What was missing is ONE observable surface that answers, at a
 * glance and honestly, the incubator/regulator question:
 *
 *     "Which integrations are LIVE, which are still demo, and what exactly
 *      flips each one to production?"
 *
 * This module is the platform-core half: a pure descriptor model plus the
 * report builder. It imports from NO domain (the architectural invariant —
 * platform core never depends on a domain); the app layer (API route) and the
 * ops CLI each collect a plain `BindingInputs` record from the domains'
 * existing env-derived status functions and call `buildBindingsReport`.
 *
 * Honesty contract (the platform's established pattern, now applied to the
 * binding layer itself):
 *   - every binding carries a status from the closed set below — never
 *     "configured" when it is not, never silent about a kill switch;
 *   - `detail` explains what the current mode actually serves;
 *   - `envKeys` lists the exact variables that flip the binding — names only,
 *     secret VALUES never leave the server (the builder only ever receives
 *     booleans and non-secret hosts/dates).
 *
 * Status semantics:
 *   live         bound and serving real data (feeds degrade to a labelled
 *                snapshot when the source is unreachable — never silent)
 *   mock         dev test double wired (mock-google :3010, mock-ethiocert
 *                :3020, mock MISP :3030) — deterministic CI mode
 *   fixture      no binding configured; bundled demo fixtures serve
 *   snapshot     offline/kill-switch mode: the bundled labelled snapshot
 *                captured from the real source is served, as-of stamped
 *   unconfigured an optional keyed feature without its key — the UI says
 *                "key required", syncs skip it, nothing pretends to be live
 *   disabled     an operator kill switch is ON (ETHIO_WEB_OFF, INTEL_FEEDS_OFF,
 *                EPSS_LIVE_OFF) — deliberate offline/air-gap posture
 */

export type BindingStatus =
  | "live"
  | "mock"
  | "fixture"
  | "snapshot"
  | "unconfigured"
  | "disabled";

export const BINDING_STATUSES: BindingStatus[] = [
  "live",
  "mock",
  "fixture",
  "snapshot",
  "unconfigured",
  "disabled",
];

export type BindingDomain = "identity" | "mail" | "national" | "intel" | "enrichment" | "vapt";

export const BINDING_DOMAINS: BindingDomain[] = [
  "identity",
  "mail",
  "national",
  "intel",
  "enrichment",
  "vapt",
];

export interface BindingDescriptor {
  id: string;
  domain: BindingDomain;
  label: string;
  status: BindingStatus;
  /** one line: what the current mode actually serves (never a value) */
  detail: string;
  /** the exact env vars that govern this binding — names only */
  envKeys: string[];
  /** snapshot capture date, when the binding serves/refreshes a snapshot */
  asOf?: string;
  /** ops command that refreshes the bundled snapshot/capture */
  refresh?: string;
  /** operator doc that explains the production switch */
  docs?: string;
}

/**
 * Plain facts collected at the call site (API route or CLI) from the
 * domains' existing env-derived status functions. Booleans and non-secret
 * strings only — this record is safe to render to an admin and to print.
 */
export interface BindingInputs {
  google: { configured: boolean; mock: boolean };
  smtp: { hostSet: boolean };
  ethioExchange: { bound: boolean; endpoint: string | null };
  ethioWeb: { disabled: boolean; snapshotAsOf: string };
  intel: {
    off: boolean;
    abusechKey: boolean;
    otxKey: boolean;
    greynoiseKey: boolean;
    mispBound: boolean;
    mispUrl: string | null;
    virustotalKey: boolean;
    kevSnapshotAsOf: string;
    dropSnapshotAsOf: string;
  };
  epss: { disabled: boolean };
  vaptFeed: { asOf: string };
}

export interface BindingReport {
  generatedAt: string;
  /** counts per status, in BINDING_STATUSES order */
  summary: Record<BindingStatus, number>;
  bindings: BindingDescriptor[];
}

/** Dev test doubles run on localhost ports (mock-google 3010, Ethio-CERT 3020, MISP 3030). */
export function looksLikeDevEndpoint(url: string | null | undefined): boolean {
  if (!url) return false;
  return /(^|\.)localhost(:|$)|127\.0\.0\.1|\[::1\]/.test(url);
}

/** Keyed-feed resolution honouring the kill switch before the key check. */
function keyedFeedStatus(off: boolean, keyed: boolean): BindingStatus {
  if (off) return "disabled";
  return keyed ? "live" : "unconfigured";
}

export function buildBindingsReport(inp: BindingInputs): Omit<BindingReport, "generatedAt"> {
  const googleStatus: BindingStatus = inp.google.configured
    ? inp.google.mock
      ? "mock"
      : "live"
    : "unconfigured";
  const exchangeStatus: BindingStatus = inp.ethioExchange.bound
    ? looksLikeDevEndpoint(inp.ethioExchange.endpoint)
      ? "mock"
      : "live"
    : "fixture";
  const mispStatus = keyedFeedStatus(inp.intel.off, inp.intel.mispBound);
  const mispDetail =
    mispStatus === "live" && looksLikeDevEndpoint(inp.intel.mispUrl)
      ? "self-hosted MISP (dev mock instance :3030) — published events of the last 7 days, TLP honoured"
      : mispStatus === "live"
        ? "self-hosted MISP private exchange — published events of the last 7 days, TLP:AMBER+/RED stay peer-to-peer"
        : "self-hosted MISP exchange — set MISP_URL + MISP_API_KEY to bind the private sharing channel";

  const bindings: BindingDescriptor[] = [
    {
      id: "google-sso",
      domain: "identity",
      label: "Sign in with Google (OAuth 2.0 / OIDC)",
      status: googleStatus,
      detail:
        googleStatus === "live"
          ? "real accounts.google.com flow — ID tokens verified against Google's JWKS"
          : googleStatus === "mock"
            ? "dev test double wired (GOOGLE_AUTH_BASE override) — the deterministic CI provider"
            : "password + MFA sign-in only; the login screen honestly hides the Google button",
      envKeys: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_AUTH_BASE"],
      docs: "docs/GOOGLE_SSO_SETUP.md",
    },
    {
      id: "smtp-mail",
      domain: "mail",
      label: "Outbound mail (password reset + email verification)",
      status: inp.smtp.hostSet ? "live" : "unconfigured",
      detail: inp.smtp.hostSet
        ? "SMTP transport — real delivery via SMTP_HOST"
        : "console transport — links print to the server log (dev/pilot mode, never silent)",
      envKeys: ["SMTP_HOST", "SMTP_PORT", "SMTP_SECURE", "SMTP_USER", "SMTP_PASS", "MAIL_FROM"],
    },
    {
      id: "ethiocert-exchange",
      domain: "national",
      label: "Ethio-CERT bilateral exchange (sync + reporting)",
      status: exchangeStatus,
      detail:
        exchangeStatus === "live"
          ? "live exchange — national feed GET + anonymised tenant summary POST"
          : exchangeStatus === "mock"
            ? "dev mock exchange wired — the deterministic CI double of the national API"
            : "fixture mode — bundled demo indicators, no network; flips live the moment INSA issues credentials",
      envKeys: ["ETHIOCERT_API_URL", "ETHIOCERT_API_KEY", "ETHIOCERT_TIMEOUT_MS"],
    },
    {
      id: "ethio-web",
      domain: "national",
      label: "Ethio-CERT public web layer + INSA headlines",
      status: inp.ethioWeb.disabled ? "snapshot" : "live",
      detail: inp.ethioWeb.disabled
        ? "ETHIO_WEB_OFF — offline/air-gap mode: the labelled snapshot captured from the real sites is served"
        : "public advisories/alerts/news/regulations/GCI live from ethiocert.gov.et/api + INSA news scrape; degrades to the labelled snapshot when unreachable",
      envKeys: ["ETHIOCERT_WEB_URL", "INSA_NEWS_URL", "ETHIO_WEB_TIMEOUT_MS", "ETHIO_WEB_OFF"],
      asOf: inp.ethioWeb.snapshotAsOf,
      refresh: "bun run ethio:snapshot",
    },
    {
      id: "cisa-kev",
      domain: "intel",
      label: "CISA Known Exploited Vulnerabilities",
      status: inp.intel.off ? "disabled" : "live",
      detail: inp.intel.off
        ? "INTEL_FEEDS_OFF — every public connector is deliberately off"
        : "public-domain JSON feed, no key; cross-references VAPT findings as actively exploited",
      envKeys: ["INTEL_FEEDS_OFF", "INTEL_FEED_TIMEOUT_MS", "INTEL_FEED_MAX_ENTRIES"],
      asOf: inp.intel.kevSnapshotAsOf,
      refresh: "bun run intel:snapshots",
    },
    {
      id: "spamhaus-drop",
      domain: "intel",
      label: "Spamhaus DROP (hijacked netblocks)",
      status: inp.intel.off ? "disabled" : "live",
      detail: inp.intel.off
        ? "INTEL_FEEDS_OFF — deliberate offline posture"
        : "public text feed, no key; label-SNAPSHOT degradation when unreachable",
      envKeys: ["INTEL_FEEDS_OFF", "INTEL_FEED_TIMEOUT_MS"],
      asOf: inp.intel.dropSnapshotAsOf,
      refresh: "bun run intel:snapshots",
    },
    {
      id: "abusech-urlhaus",
      domain: "intel",
      label: "abuse.ch URLhaus (malware URLs)",
      status: keyedFeedStatus(inp.intel.off, inp.intel.abusechKey),
      detail: keyedFeedStatus(inp.intel.off, inp.intel.abusechKey) === "live"
        ? "free keyed JSON API (attribution required) — active malware distribution URLs"
        : keyedFeedStatus(inp.intel.off, inp.intel.abusechKey) === "disabled"
          ? "INTEL_FEEDS_OFF — deliberate offline posture"
          : "key required — syncs skip it and the hub honestly says so",
      envKeys: ["ABUSECH_AUTH_KEY", "INTEL_FEEDS_OFF"],
    },
    {
      id: "abusech-threatfox",
      domain: "intel",
      label: "abuse.ch ThreatFox (IOCs in the wild)",
      status: keyedFeedStatus(inp.intel.off, inp.intel.abusechKey),
      detail: keyedFeedStatus(inp.intel.off, inp.intel.abusechKey) === "live"
        ? "free keyed API — IOCs observed in the wild, mapped onto the hub taxonomy"
        : keyedFeedStatus(inp.intel.off, inp.intel.abusechKey) === "disabled"
          ? "INTEL_FEEDS_OFF — deliberate offline posture"
          : "key required — shared with URLhaus via ABUSECH_AUTH_KEY",
      envKeys: ["ABUSECH_AUTH_KEY", "INTEL_FEEDS_OFF"],
    },
    {
      id: "alienvault-otx",
      domain: "intel",
      label: "AlienVault OTX (subscribed pulses)",
      status: keyedFeedStatus(inp.intel.off, inp.intel.otxKey),
      detail: keyedFeedStatus(inp.intel.off, inp.intel.otxKey) === "live"
        ? "free keyed API — subscribed pulses incl. regional and banking-sector streams"
        : keyedFeedStatus(inp.intel.off, inp.intel.otxKey) === "disabled"
          ? "INTEL_FEEDS_OFF — deliberate offline posture"
          : "key required — subscribe to pulses, then set OTX_API_KEY",
      envKeys: ["OTX_API_KEY", "INTEL_FEEDS_OFF"],
    },
    {
      id: "greynoise",
      domain: "enrichment",
      label: "GreyNoise Community (scanner classification)",
      status: keyedFeedStatus(inp.intel.off, inp.intel.greynoiseKey),
      detail: keyedFeedStatus(inp.intel.off, inp.intel.greynoiseKey) === "live"
        ? "per-IP enrichment — separates mass internet scanners from targeted activity"
        : keyedFeedStatus(inp.intel.off, inp.intel.greynoiseKey) === "disabled"
          ? "INTEL_FEEDS_OFF — deliberate offline posture"
          : "key required — an analyst action, never bulk",
      envKeys: ["GREYNOISE_API_KEY", "INTEL_FEEDS_OFF"],
    },
    {
      id: "misp-exchange",
      domain: "intel",
      label: "MISP private exchange (self-hosted)",
      status: mispStatus,
      detail: mispDetail,
      envKeys: ["MISP_URL", "MISP_API_KEY", "INTEL_FEEDS_OFF"],
    },
    {
      id: "virustotal",
      domain: "enrichment",
      label: "VirusTotal reputation (IP / URL / hash)",
      status: keyedFeedStatus(inp.intel.off, inp.intel.virustotalKey),
      detail: keyedFeedStatus(inp.intel.off, inp.intel.virustotalKey) === "live"
        ? "free public tier (4 req/min, 500/day) — analyst-driven reputation on evidence artefacts"
        : keyedFeedStatus(inp.intel.off, inp.intel.virustotalKey) === "disabled"
          ? "INTEL_FEEDS_OFF — deliberate offline posture"
          : "key required — reputation requests honestly 503 until bound",
      envKeys: ["VIRUSTOTAL_API_KEY", "INTEL_FEEDS_OFF"],
    },
    {
      id: "epss-live",
      domain: "vapt",
      label: "FIRST EPSS at scan time",
      status: inp.epss.disabled ? "snapshot" : "live",
      detail: inp.epss.disabled
        ? "EPSS_LIVE_OFF — strictly bundled snapshot values, provenance labelled on every finding"
        : "batched live lookups (6h cache); every finding's evidence bundle labels live / snapshot-as-of / heuristic provenance",
      envKeys: ["EPSS_LIVE_OFF", "EPSS_TIMEOUT_MS"],
      refresh: "bun run vapt:epss",
    },
    {
      id: "vapt-feed",
      domain: "vapt",
      label: "NVD / CISA reference catalogue (engine offline-first)",
      status: "snapshot",
      detail:
        "bundled labelled snapshot (CVSS v3.1 + KEV membership, D3 honesty label) the engine matches banners against — air-gap capable",
      envKeys: [],
      asOf: inp.vaptFeed.asOf,
      refresh: "bun scripts/fetch-vapt-feed.ts",
    },
  ];

  const summary = Object.fromEntries(BINDING_STATUSES.map((s) => [s, 0])) as Record<BindingStatus, number>;
  for (const b of bindings) summary[b.status] += 1;

  return { summary, bindings };
}

/** Presentation metadata shared by the admin console and the CLI report. */
export const BINDING_STATUS_META: Record<BindingStatus, { label: string; badgeClass: string }> = {
  live: {
    label: "live",
    badgeClass:
      "bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800",
  },
  mock: {
    label: "mock",
    badgeClass:
      "bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800",
  },
  fixture: {
    label: "fixture",
    badgeClass:
      "bg-slate-50 text-slate-700 border-slate-300 dark:bg-slate-950/60 dark:text-slate-300 dark:border-slate-800",
  },
  snapshot: {
    label: "snapshot",
    badgeClass:
      "bg-sky-50 text-sky-800 border-sky-300 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800",
  },
  unconfigured: {
    label: "unconfigured",
    badgeClass:
      "bg-zinc-50 text-zinc-700 border-zinc-300 dark:bg-zinc-950/60 dark:text-zinc-300 dark:border-zinc-800",
  },
  disabled: {
    label: "disabled",
    badgeClass:
      "bg-red-50 text-red-800 border-red-300 dark:bg-red-950/60 dark:text-red-300 dark:border-red-800",
  },
};

export const BINDING_DOMAIN_META: Record<BindingDomain, { label: string; i18nKey: string }> = {
  identity: { label: "Identity", i18nKey: "sysDomIdentity" },
  mail: { label: "Mail", i18nKey: "sysDomMail" },
  national: { label: "National ecosystem", i18nKey: "sysDomNational" },
  intel: { label: "Threat intelligence", i18nKey: "sysDomIntel" },
  enrichment: { label: "Enrichment", i18nKey: "sysDomEnrichment" },
  vapt: { label: "VAPT", i18nKey: "sysDomVapt" },
};
