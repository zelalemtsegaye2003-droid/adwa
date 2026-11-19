/**
 * Adwa Cyber — Ethio-CERT exchange client unit verification.
 * ---------------------------------------------------------------------
 * Exercises src/lib/ethio/ethiocert-client.ts directly (no dev server):
 *   1. Fixture mode when ETHIOCERT_API_URL is unset (pilot fall-back)
 *   2. LIVE mode against an inline exchange (feed parsing + invalid skipping,
 *      report delivery with receipt)
 *   3. Wrong API key → ETHIOCERT_UNAUTHORIZED
 *   4. Dead endpoint → ETHIOCERT_UNREACHABLE (feed + delivery)
 *   5. parseFeedEntry contract enforcement
 *
 * Usage: bun scripts/ethiocert-client-test.ts
 */
import {
  bindingStatus,
  deliverReport,
  EthioCertError,
  fetchNationalFeed,
  parseFeedEntry,
} from "../src/lib/ethio/ethiocert-client";

let passed = 0;
const results: string[] = [];
const check = (name: string, cond: boolean, extra = "") => {
  results.push(`${cond ? "PASS" : "FAIL"}  ${name}${extra ? " — " + extra : ""}`);
  if (cond) passed++;
};

// ── 1. Fixture mode ─────────────────────────────────────────────────────────
delete process.env.ETHIOCERT_API_URL;
delete process.env.ETHIOCERT_API_KEY;

let st = bindingStatus();
check("unset URL ⇒ fixture binding", st.mode === "fixture" && st.endpoint === null && st.hasKey === false);

let feed = await fetchNationalFeed();
check("fixture feed serves the 8 reference entries", feed.mode === "fixture" && feed.entries.length === 8 && feed.skippedInvalid === 0);
check("fixture entries keep their bulletins", feed.entries.every((e) => e.bulletin.startsWith("EC-BUL-")));

let del = await deliverReport("{}");
check("fixture delivery is recorded locally (no receipt)", del.mode === "fixture" && del.receiptId === null && del.endpoint === null);

// ── 2. LIVE mode against an inline exchange ─────────────────────────────────
const RIGHT_KEY = "unit-test-key";
const server = Bun.serve({
  port: 0,
  fetch: async (req) => {
    const url = new URL(req.url);
    if ((req.headers.get("authorization") ?? "") !== `Bearer ${RIGHT_KEY}`) {
      return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });
    }
    if (url.pathname === "/feed") {
      return Response.json({
        feed: [
          { type: "domain", value: "live-bind-check.example.net", titleEn: "Live entry", titleAm: "ቀጥታ ግባት", category: "phishing", severity: "high", tlp: "TLP:GREEN", confidence: 80, bulletin: "EC-UNIT-1" },
          { type: "bogus", value: "", severity: "nope", tlp: "TLP:???" }, // invalid → skipped
        ],
      });
    }
    if (url.pathname === "/reports") {
      return Response.json({ status: "accepted", receiptId: "EC-RCPT-UNITTEST" }, { status: 201 });
    }
    return new Response(JSON.stringify({ error: "not found" }), { status: 404 });
  },
});

try {
  process.env.ETHIOCERT_API_URL = `http://localhost:${server.port}`;
  process.env.ETHIOCERT_API_KEY = RIGHT_KEY;

  st = bindingStatus();
  check("configured URL ⇒ live binding", st.mode === "live" && st.endpoint === `http://localhost:${server.port}` && st.hasKey === true);

  feed = await fetchNationalFeed();
  check("live feed parsed from the exchange", feed.mode === "live" && feed.endpoint === `http://localhost:${server.port}/feed`);
  check("live feed keeps the valid entry", feed.entries.length === 1 && feed.entries[0].value === "live-bind-check.example.net" && feed.entries[0].bulletin === "EC-UNIT-1");
  check("live feed skips the invalid entry", feed.skippedInvalid === 1);

  del = await deliverReport(JSON.stringify({ reportType: "ADWA_CYBER_TENANT_SUMMARY" }));
  check("live delivery returns the exchange receipt", del.mode === "live" && del.receiptId === "EC-RCPT-UNITTEST" && del.httpStatus === 201);

  // ── 3. Wrong key ───────────────────────────────────────────────────────────
  process.env.ETHIOCERT_API_KEY = "wrong-key";
  try {
    await fetchNationalFeed();
    check("wrong key rejected", false);
  } catch (e) {
    check("wrong key ⇒ ETHIOCERT_UNAUTHORIZED (401)", e instanceof EthioCertError && e.code === "ETHIOCERT_UNAUTHORIZED" && e.httpStatus === 401);
  }

  // ── 4. Dead endpoint ───────────────────────────────────────────────────────
  process.env.ETHIOCERT_API_URL = "http://localhost:9"; // nothing listens here
  process.env.ETHIOCERT_API_KEY = "x";
  process.env.ETHIOCERT_TIMEOUT_MS = "1500";
  try {
    await fetchNationalFeed();
    check("dead endpoint feed fails loudly", false);
  } catch (e) {
    check("dead endpoint feed ⇒ ETHIOCERT_UNREACHABLE", e instanceof EthioCertError && e.code === "ETHIOCERT_UNREACHABLE");
  }
  try {
    await deliverReport("{}");
    check("dead endpoint delivery fails loudly", false);
  } catch (e) {
    check("dead endpoint delivery ⇒ ETHIOCERT_UNREACHABLE (no silent fixture)", e instanceof EthioCertError && e.code === "ETHIOCERT_UNREACHABLE");
  }
} finally {
  server.stop(true);
}

// ── 5. parseFeedEntry contract ───────────────────────────────────────────────
check("parseFeedEntry rejects non-objects", parseFeedEntry(null) === null && parseFeedEntry("x" as unknown) === null && parseFeedEntry(42 as unknown) === null);
check(
  "parseFeedEntry rejects out-of-range confidence",
  parseFeedEntry({ type: "ip", value: "1.2.3.4", severity: "critical", tlp: "TLP:RED", confidence: 101 }) === null &&
    parseFeedEntry({ type: "ip", value: "1.2.3.4", severity: "critical", tlp: "TLP:RED", confidence: "abc" }) === null
);
check("parseFeedEntry rejects bad enum values", parseFeedEntry({ type: "carrier-pigeon", value: "x", severity: "critical", tlp: "TLP:RED", confidence: 50 }) === null && parseFeedEntry({ type: "ip", value: "1.2.3.4", severity: "apocalyptic", tlp: "TLP:RED", confidence: 50 }) === null);
const defaulted = parseFeedEntry({ type: "ip", value: "192.0.2.7", severity: "critical", tlp: "TLP:RED", confidence: 90 });
check("parseFeedEntry defaults missing titles + bulletin", !!defaulted && defaulted.titleEn.includes("192.0.2.7") && defaulted.titleAm === defaulted.titleEn && defaulted.bulletin === "EC-LIVE" && defaulted.confidence === 90);

console.log(`\nEthio-CERT client unit — ${passed}/${results.length} checks passed\n`);
for (const line of results) console.log(line);
process.exit(passed === results.length ? 0 : 1);
