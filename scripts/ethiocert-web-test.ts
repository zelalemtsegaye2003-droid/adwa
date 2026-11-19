/**
 * Adwa Cyber — Ethiopian real-data integration verification.
 * ---------------------------------------------------------------------
 * Pure-function + bundled-data tests (no network, no dev server):
 *
 *   1. Advisories HTML parsing (tolerant utility — server-rendered layouts)
 *      and the verified real empty state ("No Advisories Found").
 *   2. INSA news page parsing — /blog/<slug> detail links, "Read more"
 *      heading inheritance, pure-date anchor exclusion, listing exclusion,
 *      truncated-title recovery from image alt text.
 *   3. Bundled snapshots captured from the REAL national sources:
 *      Ethio-CERT public JSON API (advisories empty-honest, 5 alerts with
 *      severities, 10 national news, 9 regulations with official PDFs, GCI
 *      2024 pillars summing 76.34) + INSA news (4 full headlines).
 *   4. Ethiopian landscape data invariants — hotline 933, real contacts,
 *      every fact carries a live source URL, NBE directive set, products,
 *      market sizing.
 *   5. Live→snapshot degradation semantics (ETHIO_WEB_OFF switch) for
 *      every accessor, incl. aggregate mode.
 *   6. Intel ribbon — Ethiopian tips present and sourced; global layer
 *      unchanged (16 published facts).
 *
 * Usage: bun scripts/ethiocert-web-test.ts
 */
import {
  advisorySnapshot,
  aggregateEthioMode,
  alertSnapshot,
  ethioWebConfig,
  gciSnapshot,
  getEthioCertAdvisories,
  getEthioCertAlerts,
  getEthioCertGci,
  insaNewsSnapshotFeed,
  newsSnapshot,
  parseAdvisoriesHtml,
  parseInsaNewsHtml,
  regulationSnapshot,
} from "../src/lib/ethio/ethiocert-web";
import {
  ETHIOCERT_CONTACT,
  ETHIOCERT_SERVICES,
  ETHIO_MARKET,
  INSA_AWARENESS_TIPS,
  INSA_PRODUCTS,
  INSA_STATS,
  NBE_ITEMS,
} from "../src/lib/ethio/ethio-landscape";

let pass = 0;
let fail = 0;
function check(label: string, ok: boolean, detail = ""): void {
  if (ok) {
    pass++;
    console.log(`  ok    ${label}`);
  } else {
    fail++;
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

// ── 1. Advisories HTML parsing (tolerant utility) ──────────────────────────
console.log("\n1. Advisories HTML parsing (server-rendered layouts)");

const ADV_PAGE_POPULATED = `
<html><body>
<div class="advisory-list">
  <article>
    <h4><a href="/advisories/cve-2026-31">Critical RCE in border gateway appliance</a></h4>
    <span class="badge severity-critical">CRITICAL</span>
    <time>12 Nov, 2026</time>
    <p>Active exploitation observed against financial-sector edge devices; patch immediately.</p>
  </article>
  <article>
    <h4><a href="/advisories/ec-bul-2026-051">Phishing campaign targeting NBE-member banks</a></h4>
    <span class="badge">HIGH</span>
    <time>05 Nov, 2026</time>
    <p>SMS-borne phishing impersonating bank verification portals.</p>
  </article>
  <article>
    <h4><a href="/advisories/ec-bul-2026-050">Update available for TLS stack</a></h4>
    <span class="badge">Medium</span>
    <time>2026-10-28</time>
    <p>Advisory on deprecated cipher suites.</p>
  </article>
</div>
<a href="/advisories">Back to advisories</a>
<a href="/advisories?page=2">Next</a>
</body></html>`;

const adv = parseAdvisoriesHtml(ADV_PAGE_POPULATED, "https://www.ethiocert.gov.et/advisories");
check("populated page yields 3 advisories", adv.length === 3, `got ${adv.length}`);
check("titles extracted", adv[0]?.titleEn === "Critical RCE in border gateway appliance", adv[0]?.titleEn ?? "");
check("severity found (CRITICAL → critical)", adv[0]?.severity === "critical", String(adv[0]?.severity));
check("severity found (HIGH → high)", adv[1]?.severity === "high", String(adv[1]?.severity));
check("severity found (Medium → medium)", adv[2]?.severity === "medium", String(adv[2]?.severity));
check("long-month date parsed", adv[0]?.date === "2026-11-12", adv[0]?.date ?? "");
check("comma-month date parsed", adv[1]?.date === "2026-11-05", adv[1]?.date ?? "");
check("ISO date parsed", adv[2]?.date === "2026-10-28", adv[2]?.date ?? "");
check("summary captured", (adv[0]?.summaryEn ?? "").includes("edge devices"));
check("pagination link not an advisory", !adv.some((a) => a.url.includes("?page=")));
check("ids stable slugs", adv[0]?.id === "ec-cve-2026-31", adv[0]?.id ?? "");

const ADV_PAGE_EMPTY = `
<html><body>
<div class="advisories">
  <h1>Advisories</h1>
  <div class="empty-state">
    <p>No Advisories Found</p>
    <p>No Advisories found</p>
  </div>
</div>
</body></html>`;
const advEmpty = parseAdvisoriesHtml(ADV_PAGE_EMPTY, "https://www.ethiocert.gov.et/advisories");
check("verified real empty state parses to zero advisories", advEmpty.length === 0, `got ${advEmpty.length}`);

// ── 2. INSA news parsing ───────────────────────────────────────────────────
console.log("\n2. INSA national news page parsing");

const INSA_PAGE = `
<html><body>
<div class="latest-news">
  <article>
    <div class="blog-img"><img src="x.jpg" alt="7th National Cybersecurity Month to Be Celebrated Under the Theme An Aware Citizen for a Secure Nation"></div>
    <div class="blog-content">
      <div class="blog-meta">
        <a href="/newsDetail?id=54">05 Nov, 2026</a>
      </div>
      <h3 class="box-title">
        <a href="/newsDetail?id=54">7th National Cybersecurity Month to Be C...</a>
      </h3>
    </div>
  </article>
  <article>
    <h3><a href="/news/61">Financial Sector Cybersecurity Forum Officially Launched</a></h3>
    <span>28 Oct, 2026</span>
    <a href="/news/61">Read More</a>
  </article>
  <article>
    <h3>Critical Infrastructure Cybersecurity Proclamation Briefing</h3>
    <a href="/news/62">Read More</a>
  </article>
</div>
<a href="/news">All news</a>
</body></html>`;

const news = parseInsaNewsHtml(INSA_PAGE, "https://www.insa.gov.et");
check("news items parsed (3 unique detail URLs)", news.length === 3, `got ${news.length}`);
check("truncated title recovered from image alt", (news[0]?.titleEn ?? "").startsWith("7th National Cybersecurity Month to Be Celebrated Under the Theme"), news[0]?.titleEn ?? "");
check("pure-date anchor not the headline", (news[0]?.titleEn ?? "") !== "05 Nov, 2026");
check("news dates parsed from card", news[0]?.date === "2026-11-05", news[0]?.date ?? "");
check("substantive anchor text used", news[1]?.titleEn === "Financial Sector Cybersecurity Forum Officially Launched", news[1]?.titleEn ?? "");
check("generic anchor inherits preceding heading", (news[2]?.titleEn ?? "").startsWith("Critical Infrastructure Cybersecurity"));
check("bare /news listing link excluded", !news.some((n) => n.url === "https://www.insa.gov.et/news"));
check("news urls absolute", news.every((n) => n.url.startsWith("https://www.insa.gov.et/")));

// ── 3. Bundled real-source snapshots ───────────────────────────────────────
console.log("\n3. Bundled snapshots captured from the real national sources");

const advSnap = advisorySnapshot();
check("advisory snapshot points at the national API", advSnap.url.includes("ethiocert.gov.et/api/advisories"), advSnap.url);
check("advisory snapshot honest empty state (real API baseline)", advSnap.entries.length === 0 && !!advSnap.note, advSnap.note ?? "");

const alertSnap = alertSnapshot();
check("alerts snapshot captured from the real API", alertSnap.entries.length >= 5, `got ${alertSnap.entries.length}`);
check("real alerts carry severity", alertSnap.entries.filter((a) => a.severity).length >= 5);
check("real alerts carry dates", alertSnap.entries.filter((a) => a.date).length >= 5);
check("real alerts are bilingual content (AM titles present)", alertSnap.entries.some((a) => /[\u1200-\u137F]/.test(a.titleEn)));

const newsSnap = newsSnapshot();
check("national news snapshot captured (first page)", newsSnap.entries.length >= 10, `got ${newsSnap.entries.length}`);
check("national news items carry dates", newsSnap.entries.filter((n) => n.date).length >= 10);
check("national news includes the password-usage item", newsSnap.entries.some((n) => n.titleEn.includes("123456")));

const regSnap = regulationSnapshot();
check("legal corpus captured (9 instruments)", regSnap.entries.length === 9, `got ${regSnap.entries.length}`);
check("Computer Crime Proclamation present", regSnap.entries.some((r) => r.titleEn.includes("Computer Crime Proclamation")));
check("IT Proclamation 2024 present", regSnap.entries.some((r) => r.titleEn.includes("Information Technology")));
check("regulations link the official PDFs on ethiocert.gov.et", regSnap.entries.every((r) => r.url.includes("ethiocert.gov.et/media/regulations") || r.url.includes("ethiocert.gov.et/regulations")));
check("regulations carry years", regSnap.entries.filter((r) => r.year).length === 9);

const gciSnap = gciSnapshot();
check("GCI snapshot is 2024", gciSnap.year === 2024, String(gciSnap.year));
check("GCI pillar values are the real API values", Math.abs(gciSnap.pillars.legal - 18.83) < 0.01 && Math.abs(gciSnap.pillars.cooperation - 15.69) < 0.01);
const gciSum = gciSnap.pillars.legal + gciSnap.pillars.technical + gciSnap.pillars.organizational + gciSnap.pillars.capacity + gciSnap.pillars.cooperation;
check("GCI pillars sum to 76.34", Math.abs(gciSum - 76.34) < 0.01, String(gciSum));
check("GCI timeline captured (2014→2024)", gciSnap.timeline.length >= 5 && gciSnap.timeline[0].year === 2014 && gciSnap.timeline[gciSnap.timeline.length - 1].year === 2024);

const insaSnap = insaNewsSnapshotFeed();
check("INSA news snapshot captured 4 real headlines", insaSnap.entries.length === 4, `got ${insaSnap.entries.length}`);
check("INSA snapshot titles are full-length (alt-recovered)", (insaSnap.entries[0]?.titleEn ?? "").length > 60, insaSnap.entries[0]?.titleEn ?? "");
check("INSA snapshot dates are the on-page dates", insaSnap.entries.every((n) => n.date === "2026-11-05"));
check("INSA snapshot includes the financial-sector forum", insaSnap.entries.some((n) => n.titleEn.startsWith("Financial Sector Cybersecurity Forum")));

// ── 4. Landscape data invariants ───────────────────────────────────────────
console.log("\n4. Ethiopian landscape data (real sources)");

check("Ethio-CERT hotline is the real 933", ETHIOCERT_CONTACT.hotline === "933");
check("Ethio-CERT email is the real one", ETHIOCERT_CONTACT.email === "ethiocert@insa.gov.et");
check("Ethio-CERT website is the real one", ETHIOCERT_CONTACT.website === "https://www.ethiocert.gov.et");
check("Ethio-CERT services from the real site (4)", ETHIOCERT_SERVICES.length === 4, `got ${ETHIOCERT_SERVICES.length}`);

const allFacts = [...INSA_STATS, ...NBE_ITEMS, ...ETHIO_MARKET];
check("every landscape fact carries a live source URL", allFacts.every((f) => /^https:\/\//.test(f.sourceUrl)));
check("every landscape fact carries a capture date", allFacts.every((f) => /^\d{4}-\d{2}-\d{2}$/.test(f.asOf)));
check("every landscape fact names its source", allFacts.every((f) => f.sourceName.length > 2));
check("every landscape fact is bilingual", allFacts.every((f) => f.labelAm.length > 2 && f.valueAm.length > 2));
check("provenance tiers are declared", allFacts.every((f) => ["official-site", "official-reporting-via-press", "independent-analysis"].includes(f.provenance)));
check("INSA stats include the 6,700+ 2023 figure", INSA_STATS.some((f) => f.id === "insa-attacks-2023" && f.valueEn === "6,700+"));
check("NBE directive SBB/96/2025 present", NBE_ITEMS.some((f) => f.valueEn === "SBB/96/2025"));
check("NBE awareness material present", NBE_ITEMS.some((f) => f.sourceUrl.includes("nbe.gov.et")));
check("INSA awareness tips are the real six", INSA_AWARENESS_TIPS.length === 6, `got ${INSA_AWARENESS_TIPS.length}`);
check("INSA national products (9 real)", INSA_PRODUCTS.length === 9, `got ${INSA_PRODUCTS.length}`);
check("market sizing present with source", ETHIO_MARKET.length === 1 && ETHIO_MARKET[0]?.sourceUrl.includes("imarcgroup.com"));

// ── 5. Degradation semantics ───────────────────────────────────────────────
console.log("\n5. Live → snapshot degradation");

const cfg = ethioWebConfig();
check("default API base is the real national API", cfg.apiBase === "https://www.ethiocert.gov.et/api", cfg.apiBase);
check("default INSA news URL is the real site", cfg.insaNewsUrl === "https://www.insa.gov.et");

process.env.ETHIO_WEB_OFF = "1";
const [degraded, degradedAlerts, degradedGci] = await Promise.all([getEthioCertAdvisories(), getEthioCertAlerts(), getEthioCertGci()]);
check("ETHIO_WEB_OFF degrades advisories to labelled snapshot", degraded.mode === "snapshot");
check("degradation reason recorded", typeof degraded.degradedReason === "string" && degraded.degradedReason.length > 0);
check("ETHIO_WEB_OFF degrades alerts to labelled snapshot", degradedAlerts.mode === "snapshot" && degradedAlerts.entries.length >= 5);
check("ETHIO_WEB_OFF degrades GCI to labelled snapshot", degradedGci.mode === "snapshot" && degradedGci.year === 2024);
check("aggregate mode reports snapshot when any feed degrades", aggregateEthioMode([{ mode: "live" }, { mode: "snapshot" }]) === "snapshot");
check("aggregate mode reports live only when all feeds are live", aggregateEthioMode([{ mode: "live" }, { mode: "live" }]) === "live");
delete process.env.ETHIO_WEB_OFF;

// ── 6. Intel ribbon ─────────────────────────────────────────────────────────
console.log("\n6. Intel ribbon (national + global layers)");

const ticker = await import("../src/components/adwa/tip-ticker");
const ethioTips = ticker.ETHIO_TIPS as { en: string; am?: string; source?: string }[];
const intelTips = ticker.INTEL_TIPS as { en: string }[];
check("ribbon carries the Ethiopian national layer", ethioTips.length >= 10, `got ${ethioTips.length}`);
check("national items carry source chips", ethioTips.filter((tp) => tp.source).every((tp) => ["Ethio-CERT", "INSA", "NBE"].includes(tp.source ?? "")));
check("Ethio-CERT hotline tip present", ethioTips.some((tp) => tp.en.includes("933")));
check("national tips are bilingual", ethioTips.filter((tp) => tp.am).length >= 9, `am count ${ethioTips.filter((tp) => tp.am).length}`);
check("global layer unchanged (16 published facts)", intelTips.length === 16, `got ${intelTips.length}`);
check("MFA 99% fact retained", intelTips.some((tp) => tp.en.includes("MFA blocks over 99%")));
check("DBIR human-element fact retained", intelTips.some((tp) => tp.en.includes("68% of breaches")));

// ── summary ─────────────────────────────────────────────────────────────────
console.log(`\n${pass} passed, ${fail} failed — Ethiopian real-data integration`);
process.exit(fail ? 1 : 0);
