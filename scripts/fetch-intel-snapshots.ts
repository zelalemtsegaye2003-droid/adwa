#!/usr/bin/env bun
/**
 * Adwa Cyber — public-intel snapshot builder (Real-Data Roadmap Phase 1).
 *
 * Rebuilds the bundled offline snapshots for the SOC public-feed connectors
 * from the LIVE sources — the same contract scripts/fetch-vapt-feed.ts uses:
 *
 *   CISA KEV        https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json
 *                  (public domain; by default the RECENT-ADDITIONS subset of
 *                   the last --days N days is bundled; --days 0 = full catalog)
 *   Spamhaus DROP   https://www.spamhaus.org/drop/drop.txt
 *                  (full hijacked-netblock list; attribution header preserved)
 *
 * Output:
 *   src/lib/soc/intel-snapshots/kev.json
 *   src/lib/soc/intel-snapshots/spamhaus-drop.json
 *
 * A failed live fetch is an ERROR (exit 1) — the previous snapshot is left
 * untouched, never silently overwritten with stale or partial data. The
 * platform serves these files only when the live source is unreachable, and
 * always labels them as snapshots with their capture date.
 *
 * Usage: bun scripts/fetch-intel-snapshots.ts [--days 30]
 */
import { writeFileSync } from "fs";

const KEV_URL = "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json";
const DROP_URL = "https://www.spamhaus.org/drop/drop.txt";

const argDays = Number((process.argv.find((a) => a.startsWith("--days")) ?? "--days=30").split("=")[1] ?? 30);
const days = Number.isFinite(argDays) && argDays >= 0 ? argDays : 30;
const capturedAt = new Date().toISOString();

const UA = "AdwaSec/1.0 (threat-intel snapshot builder)";
let failed = 0;

// ── 1. CISA KEV ─────────────────────────────────────────────────────────────
console.log(`Fetching CISA KEV catalog from www.cisa.gov …`);
let kevWritten = false;
try {
  const res = await fetch(KEV_URL, { headers: { "User-Agent": UA, Accept: "application/json" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = (await res.json()) as {
    title?: string;
    catalogVersion?: string;
    dateReleased?: string;
    count?: number;
    vulnerabilities?: unknown[];
  };
  const vulns = Array.isArray(body.vulnerabilities) ? body.vulnerabilities : [];
  const catalogVersion = String(body.catalogVersion ?? "").trim();
  const catalogCount = Number(body.count ?? vulns.length);
  if (!vulns.length || !catalogVersion) throw new Error("catalog payload missing vulnerabilities/catalogVersion");

  const cutoff = days > 0 ? new Date(Date.now() - days * 86_400_000) : null;
  const subset = cutoff
    ? vulns.filter((v) => {
        const added = new Date(String((v as Record<string, unknown>).dateAdded ?? ""));
        return !Number.isNaN(added.getTime()) && added >= cutoff;
      })
    : vulns;

  const snapshot = {
    source: "cisa_kev",
    sourceUrl: KEV_URL,
    capturedAt,
    catalogVersion,
    dateReleased: String(body.dateReleased ?? ""),
    catalogCount,
    note:
      subset.length === vulns.length
        ? `CISA KEV catalog snapshot — FULL catalog (${catalogCount} entries), captured verbatim from the live CISA JSON feed. Public domain (CISA terms of use).`
        : `CISA KEV catalog snapshot — RECENT ADDITIONS subset (entries added within the last ${days} days, ${subset.length} of ${catalogCount} catalog entries). Captured verbatim from the live CISA JSON feed. Public domain (CISA terms of use). The live connector ingests the full catalog.`,
    entries: subset.map((v) => v as Record<string, unknown>),
  };
  writeFileSync("src/lib/soc/intel-snapshots/kev.json", JSON.stringify(snapshot, null, 2));
  console.log(`  Wrote kev.json — ${subset.length} entries (catalog v${catalogVersion}, ${catalogCount} total, dateReleased ${body.dateReleased ?? "?"})`);
  kevWritten = true;
} catch (err) {
  failed++;
  console.error(`  KEV capture FAILED: ${err instanceof Error ? err.message : err} — existing snapshot left untouched`);
}

// ── 2. Spamhaus DROP ─────────────────────────────────────────────────────────
console.log(`Fetching Spamhaus DROP list …`);
let dropWritten = false;
try {
  const res = await fetch(DROP_URL, { headers: { "User-Agent": UA, Accept: "text/plain" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  if (!/Spamhaus DROP/i.test(text)) throw new Error("payload does not look like the DROP list");

  let listHeader = "";
  let lastModified = "";
  const seen = new Set<string>();
  const entries: { cidr: string; sbl: string }[] = [];
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (t.startsWith(";")) {
      if (!listHeader && /Spamhaus DROP List/i.test(t)) listHeader = t.replace(/^;\s*/, "");
      if (!lastModified && /^;\s*Last-Modified:/i.test(t)) lastModified = t.replace(/^;\s*Last-Modified:\s*/i, "");
      continue;
    }
    const m = /^([0-9.]+\/\d+)\s*;\s*(SBL[0-9]+)\s*$/i.exec(t);
    if (m && !seen.has(m[1])) {
      seen.add(m[1]); // the live list occasionally repeats a netblock — dedupe
      entries.push({ cidr: m[1], sbl: m[2] });
    }
  }
  if (!entries.length) throw new Error("no netblock lines parsed");

  const snapshot = {
    source: "spamhaus_drop",
    sourceUrl: DROP_URL,
    capturedAt,
    listHeader,
    lastModified,
    count: entries.length,
    note: "Captured verbatim from the live Spamhaus DROP feed (full list). Terms: The Spamhaus Project SLU — DROP is published for free operational use; keep the attribution header.",
    entries,
  };
  writeFileSync("src/lib/soc/intel-snapshots/spamhaus-drop.json", JSON.stringify(snapshot, null, 2));
  console.log(`  Wrote spamhaus-drop.json — ${entries.length} netblocks (list ${lastModified || listHeader})`);
  dropWritten = true;
} catch (err) {
  failed++;
  console.error(`  DROP capture FAILED: ${err instanceof Error ? err.message : err} — existing snapshot left untouched`);
}

console.log(
  kevWritten || dropWritten
    ? `\nSnapshot rebuild finished: KEV ${kevWritten ? "✓" : "✗"} · DROP ${dropWritten ? "✓" : "✗"} (captured ${capturedAt})`
    : "\nSnapshot rebuild failed for every source — nothing written."
);
if (failed > 0) process.exit(1);
