/**
 * Adwa Cyber — Real-Data Roadmap Phase 2 parser verification (pure functions,
 * no network): MISP restSearch parsing/TLP mapping, VirusTotal v3 report
 * mapping/target classification, and FIRST EPSS response parsing/provenance
 * labelling. Complements scripts/intel-feeds-test.mjs (API honesty suite).
 *
 * Usage: bun scripts/test-intel-phase2.ts
 */
import {
  IntelFeedError,
  parseMispEvents,
  mispTlpFromTags,
  mispTypeToIndicatorType,
  mispSeverity,
  mispCategory,
  fetchMisp,
  vtTargetKind,
  vtEndpointPath,
  parseVtReport,
  enrichVirusTotal,
} from "../src/lib/soc/intel-feeds";
import { parseEpssResponse, epssProvenanceNote } from "../src/lib/vapt/vapt-epss";

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

async function throwsIntelError(fn: () => Promise<unknown>, code: string, label: string): Promise<void> {
  try {
    await fn();
    check(label, false, "did not throw");
  } catch (err) {
    const good = err instanceof IntelFeedError && err.code === code;
    check(label, good, err instanceof Error ? err.message : String(err));
  }
}

// ── 1. MISP parsing ────────────────────────────────────────────────────────
console.log("\n[1] MISP restSearch parsing");
check("1a. tlp:clear → TLP:CLEAR", mispTlpFromTags([{ name: "tlp:clear" }]) === "TLP:CLEAR");
check("1b. tlp:green → TLP:GREEN", mispTlpFromTags([{ name: "tlp:green" }]) === "TLP:GREEN");
check("1c. tlp:amber → TLP:AMBER", mispTlpFromTags([{ name: "misp-galaxy:ransomware", }, { name: "tlp:amber" }]) === "TLP:AMBER");
check("1d. tlp:amber+strict → TLP:AMBER+STRICT", mispTlpFromTags([{ name: "tlp:AMBER+STRICT" }]) === "TLP:AMBER+STRICT");
check("1e. tlp:red → TLP:RED", mispTlpFromTags([{ name: "tlp:red" }]) === "TLP:RED");
check("1f. no TLP tag → conservative TLP:AMBER", mispTlpFromTags([{ name: "osint" }]) === "TLP:AMBER");
check("1g. ip-src → ip", mispTypeToIndicatorType("ip-src") === "ip");
check("1h. ip-dst → ip", mispTypeToIndicatorType("ip-dst") === "ip");
check("1i. domain/hostname → domain", mispTypeToIndicatorType("domain") === "domain" && mispTypeToIndicatorType("hostname") === "domain");
check("1j. url/link → url", mispTypeToIndicatorType("url") === "url" && mispTypeToIndicatorType("link") === "url");
check("1k. md5/sha256 → hub hashes", mispTypeToIndicatorType("md5") === "hash_md5" && mispTypeToIndicatorType("sha256") === "hash_sha256");
check("1l. sha1 honestly unsupported", mispTypeToIndicatorType("sha1") === null);
check("1m. email-src → email", mispTypeToIndicatorType("email-src") === "email");
check("1n. filename|md5 → filename", mispTypeToIndicatorType("filename|md5") === "filename");
check("1o. threat levels 1/2/3 → high/medium/low", mispSeverity("1") === "high" && mispSeverity("2") === "medium" && mispSeverity("3") === "low");
check("1p. undefined threat level → medium", mispSeverity(undefined) === "medium");
check("1q. ransomware tag → category", mispCategory([{ name: "ransomware" }]) === "ransomware");

const mispFixture = {
  response: [
    {
      Event: {
        id: "42",
        uuid: "9c8d7e6f-1111-2222-3333-444455556666",
        info: "INSA advisory — banking phishing campaign",
        date: "2026-11-14",
        published: true,
        threat_level_id: "1",
        Tag: [{ name: "tlp:amber" }, { name: "phishing" }],
        Attribute: [
          { id: "a1", type: "domain", value: "cbe-verify-login.com", to_ids: true, timestamp: "1763088000" },
          { id: "a2", type: "ip-dst", value: "203.0.113.55", to_ids: false },
          { id: "a3", type: "sha1", value: "0123456789abcdef0123456789abcdef01234567", to_ids: true },
        ],
      },
    },
    {
      Event: {
        id: "43",
        uuid: "9c8d7e6f-7777-8888-9999-000011112222",
        info: "Sector malware indicators (restricted)",
        date: "2026-11-16",
        published: true,
        threat_level_id: "2",
        Tag: [{ name: "tlp:red" }, { name: "malware" }],
        Attribute: [
          { id: "a4", type: "domain", value: "cbe-verify-login.com", to_ids: true }, // duplicate across events
          { id: "a5", type: "sha256", value: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855", to_ids: true, timestamp: 1763174400 },
        ],
      },
    },
  ],
};
const mispParsed = parseMispEvents(mispFixture);
check("1r. parsed 3 indicators (sha1 skipped, duplicate deduped)", mispParsed.entries.length === 3, `got ${mispParsed.entries.length}`);
check("1s. sha1 counted as skippedInvalid", mispParsed.skippedInvalid === 1, `got ${mispParsed.skippedInvalid}`);
check("1t. cross-event duplicate counted", mispParsed.duplicates === 1, `got ${mispParsed.duplicates}`);
check("1u. two events with indicators counted", mispParsed.events === 2, `got ${mispParsed.events}`);
const mispRow = mispParsed.entries[0];
check("1v. row carries TLP:AMBER from event tag", mispRow.tlp === "TLP:AMBER");
check("1w. row category phishing", mispRow.category === "phishing");
check("1x. row severity high (threat level 1)", mispRow.severity === "high");
check("1y. to_ids attribute → confidence 90", mispRow.confidence === 90);
check("1z. sourceRef carries event UUID", /^MISP event [0-9a-f-]{36}$/.test(mispRow.sourceRef ?? ""), mispRow.sourceRef ?? "");
check("1za. attribute timestamp → ISO firstSeenAt", /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(mispRow.firstSeenAt ?? ""), String(mispRow.firstSeenAt));
const mispRed = mispParsed.entries.find((e) => e.tlp === "TLP:RED");
check("1zb. TLP:RED row ingested with its marking (sharing engine gates it)", !!mispRed && mispRed.type === "hash_sha256");
const mispFallbackDate = mispParsed.entries.find((e) => e.value === "203.0.113.55");
check("1zc. no attribute timestamp → event date as firstSeenAt", mispFallbackDate?.firstSeenAt === "2026-11-14", String(mispFallbackDate?.firstSeenAt));
try {
  parseMispEvents({ unexpected: true });
  check("1zd. malformed MISP payload rejected", false, "did not throw");
} catch (err) {
  check("1zd. malformed MISP payload rejected", err instanceof IntelFeedError && err.code === "BAD_PAYLOAD");
}
await throwsIntelError(() => fetchMisp(100, 500), "UNCONFIGURED", "1ze. fetchMisp without MISP_URL/API_KEY → UNCONFIGURED (never fakes a run)");

// ── 2. VirusTotal mapping ──────────────────────────────────────────────────
console.log("\n[2] VirusTotal target classification + report mapping");
check("2a. IPv4 → ip", vtTargetKind("203.0.113.55") === "ip");
check("2b. 999.1.1.1 rejected (octet range)", vtTargetKind("999.1.1.1") === null);
check("2c. http URL → url", vtTargetKind("https://cbe-verify-login.com/phish?id=1") === "url");
check("2d. md5 → hash", vtTargetKind("44d88612fea8a8f36de82e1278abb02f") === "hash");
check("2e. sha256 → hash", vtTargetKind("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855") === "hash");
check("2f. garbage rejected", vtTargetKind("not a target") === null);
check("2g. ip endpoint path", vtEndpointPath("203.0.113.55", "ip") === "/ip_addresses/203.0.113.55");
check("2h. hash endpoint path", vtEndpointPath("44d88612fea8a8f36de82e1278abb02f", "hash") === "/files/44d88612fea8a8f36de82e1278abb02f");
const urlPath = vtEndpointPath("https://example.com/a", "url");
check("2i. url id is unpadded base64url", /^\/urls\/[a-zA-Z0-9_-]+$/.test(urlPath) && !urlPath.endsWith("="), urlPath);

const vtFixture = {
  data: {
    id: "203.0.113.55",
    type: "ip_address",
    links: { self: "https://www.virustotal.com/gui/ip-address/203.0.113.55" },
    attributes: {
      last_analysis_stats: { malicious: 12, suspicious: 3, harmless: 40, undetected: 15, timeout: 2 },
      reputation: -35,
      last_analysis_date: 1763174400,
    },
  },
};
const vt = parseVtReport(vtFixture, "203.0.113.55", "ip");
check("2j. verdict malicious when malicious>0", vt.verdict === "malicious");
check("2k. engine count 15/72 engines", vt.engineCount === "15/72 engines", vt.engineCount);
check("2l. reputation mapped", vt.reputation === -35);
check("2m. last analysis date ISO", vt.lastAnalysisDate === new Date(1763174400 * 1000).toISOString());
check("2n. link mapped", vt.link?.includes("/gui/ip-address/") === true);
const vtClean = parseVtReport(
  { data: { attributes: { last_analysis_stats: { malicious: 0, suspicious: 0, harmless: 5, undetected: 60, timeout: 0 } } } },
  "8.8.8.8",
  "ip"
);
check("2o. verdict clean when harmless/undetected only", vtClean.verdict === "clean");
const vtEmpty = parseVtReport(
  { data: { attributes: { last_analysis_stats: { malicious: 0, suspicious: 0, harmless: 0, undetected: 0, timeout: 0 } } } },
  "203.0.113.55",
  "ip"
);
check("2p. zero stats → unknown verdict (never fabricated)", vtEmpty.verdict === "unknown" && vtEmpty.engineCount === "0/0 engines");
try {
  parseVtReport({ no: "data" }, "203.0.113.55", "ip");
  check("2q. malformed VT payload rejected", false, "did not throw");
} catch (err) {
  check("2q. malformed VT payload rejected", err instanceof IntelFeedError && err.code === "BAD_PAYLOAD");
}
await throwsIntelError(() => enrichVirusTotal("203.0.113.55"), "UNCONFIGURED", "2r. enrichVirusTotal without key → UNCONFIGURED (never fabricated)");

// ── 3. FIRST EPSS parsing + provenance labels ──────────────────────────────
console.log("\n[3] FIRST EPSS response parsing + provenance labelling");
const epssFixture = {
  status: "OK",
  "status-code": 200,
  total: 2,
  data: [
    { cve: "CVE-2021-44228", epss: "0.974400000", percentile: "0.997690000", date: "2026-11-18" },
    { cve: "CVE-2024-6387", epss: "0.051430000", percentile: "0.921770000", date: "2026-11-18" },
  ],
};
const epss = parseEpssResponse(epssFixture);
check("3a. two scores parsed", epss.length === 2);
check("3b. epss value parsed as number", epss[0].epss === 0.9744);
check("3c. percentile parsed as number", epss[1].percentile === 0.92177);
check("3d. date captured", epss[0].date === "2026-11-18");
try {
  parseEpssResponse({ status: "ERROR" });
  check("3e. non-OK status rejected", false, "did not throw");
} catch (err) {
  check("3e. non-OK status rejected", err instanceof Error && /status/.test(err.message));
}
try {
  parseEpssResponse({ status: "OK", data: "not-an-array" });
  check("3f. missing data array rejected", false, "did not throw");
} catch (err) {
  check("3f. missing data array rejected", err instanceof Error);
}
check("3g. live provenance label names FIRST + date", epssProvenanceNote(epss[0], "2026-11-01", true).note === "EPSS live from FIRST (as of 2026-11-18)");
check("3h. live provenance source", epssProvenanceNote(epss[0], "2026-11-01", true).source === "live");
const fb = epssProvenanceNote(null, "2026-11-01", true);
check("3i. fallback label names the snapshot as-of", fb.note === "EPSS from bundled feed snapshot (as of 2026-11-01) — live EPSS unavailable this run" && fb.source === "snapshot");
const heur = epssProvenanceNote(null, "2026-11-01", false);
check("3j. non-CVE heuristic label", heur.source === "heuristic" && /heuristic prior/.test(heur.note));

console.log(`\n${fail === 0 ? "ALL CHECKS PASSED" : `${fail} CHECK(S) FAILED`} (${pass + fail} checks)`);
process.exit(fail === 0 ? 0 : 1);
