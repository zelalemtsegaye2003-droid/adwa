#!/usr/bin/env bun
/**
 * Adwa Cyber — scheduled EPSS refresher (Real-Data Roadmap §5.3).
 *
 * FIRST publishes EPSS scores daily. This script refreshes the EPSS fields of
 * the bundled VAPT feed snapshot from the live API so the offline fallback
 * stays current — wire it as a daily cron job:
 *
 *   bun run vapt:epss        (package.json script)
 *
 * Honesty contract (same pattern as scripts/fetch-intel-snapshots.ts):
 *   - a failed fetch exits 1 and leaves the existing snapshot UNTOUCHED;
 *   - CVEs the API does not return keep their previous value and are listed
 *     in the console output;
 *   - the snapshot's asOf and note record the refresh date, so the UI keeps
 *     labelling the fallback with its true age.
 */
import { readFileSync, writeFileSync } from "fs";

const SNAPSHOT = "src/lib/vapt/vapt-feed-snapshot.json";

interface FeedEntry {
  cve: string;
  epss: number;
  epssPercentile: number | null;
  // …other fields are passed through untouched
  [key: string]: unknown;
}

interface Snapshot {
  asOf: string;
  note: string;
  entries: FeedEntry[];
}

const raw = readFileSync(SNAPSHOT, "utf8");
const snapshot = JSON.parse(raw) as Snapshot;
const cves = snapshot.entries.map((e) => e.cve);

if (cves.length === 0) {
  console.error("Snapshot has no entries — nothing to refresh.");
  process.exit(1);
}

console.log(`Refreshing EPSS for ${cves.length} snapshot CVEs from api.first.org …`);

// ≤ 2 000 characters per request (including commas) — chunk defensively.
const CHUNK = 60;
const fresh = new Map<string, { epss: number; percentile: number; date: string }>();
let failed = false;

for (let i = 0; i < cves.length; i += CHUNK) {
  const part = cves.slice(i, i + CHUNK);
  let ok = false;
  for (let attempt = 1; attempt <= 3 && !ok; attempt++) {
    try {
      const res = await fetch(`https://api.first.org/data/v1/epss?cve=${part.join(",")}`, {
        headers: { "user-agent": "AdwaSec-epss-refresher/1.0", Accept: "application/json" },
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as { status?: string; data?: { cve?: string; epss?: string; percentile?: string; date?: string }[] };
      if (body.status !== "OK" || !Array.isArray(body.data)) throw new Error(`status ${body.status}`);
      for (const d of body.data) {
        if (d.cve && d.epss !== undefined) {
          fresh.set(d.cve, {
            epss: Math.max(0, Math.min(1, Number(d.epss))),
            percentile: Math.max(0, Math.min(1, Number(d.percentile))),
            date: String(d.date ?? "").slice(0, 10),
          });
        }
      }
      ok = true;
    } catch (e) {
      console.warn(`  attempt ${attempt} failed: ${e instanceof Error ? e.message : e}`);
      if (attempt === 3) failed = true;
      else await new Promise((r) => setTimeout(r, 2500 * attempt));
    }
  }
}

if (failed) {
  console.error("EPSS refresh FAILED — the existing snapshot is left untouched (never half-refreshed).");
  process.exit(1);
}

let refreshed = 0;
const kept: string[] = [];
for (const e of snapshot.entries) {
  const hit = fresh.get(e.cve);
  if (hit) {
    e.epss = hit.epss;
    e.epssPercentile = hit.percentile;
    refreshed++;
    console.log(`  ${e.cve}: EPSS ${hit.epss} (${hit.percentile} pctl, ${hit.date})`);
  } else {
    kept.push(e.cve);
    console.log(`  ${e.cve}: no EPSS record returned — previous value kept`);
  }
}

snapshot.asOf = new Date().toISOString();
snapshot.note =
  "Curated service-matchable feed. CVSS v3.1 and KEV from NVD API 2.0; EPSS refreshed live from the FIRST EPSS API on the as-of date above (scripts/fetch-epss.ts — daily cadence). Affected ranges from the published advisories cited per entry.";

writeFileSync(SNAPSHOT, JSON.stringify(snapshot, null, 2));
console.log(`\nWrote ${SNAPSHOT} — ${refreshed}/${snapshot.entries.length} EPSS values refreshed${kept.length ? `, ${kept.length} kept (${kept.join(", ")})` : ""}, asOf ${snapshot.asOf}`);
