#!/usr/bin/env bun
/**
 * Adwa Cyber — production bindings report (Real-Data Roadmap Phase 3).
 *
 * Ops/deploy checklist: prints the same honest registry the SUPER_ADMIN
 * console serves (GET /api/system/bindings), derived from the exact same
 * env-driven functions — but WITHOUT needing the app to be running, so it
 * belongs in the pre-boot go-live checklist:
 *
 *   bun run bindings:report
 *
 * Safe by construction: env var NAMES and booleans only — secret values
 * (API keys, client secrets, SMTP credentials) are never read into a
 * descriptor and never printed.
 */
import { googleConfigured, googleMockMode } from "../src/lib/auth/google";
import { activeTransport } from "../src/lib/auth/mail";
import { bindingStatus } from "../src/lib/ethio/ethiocert-client";
import { ethioWebConfig } from "../src/lib/ethio/ethiocert-web";
import ethiocertApiSnapshot from "../src/lib/ethio/ethio-snapshots/ethiocert-api.json";
import { intelConfig } from "../src/lib/soc/intel-feeds";
import kevSnapshot from "../src/lib/soc/intel-snapshots/kev.json";
import dropSnapshot from "../src/lib/soc/intel-snapshots/spamhaus-drop.json";
import { epssConfig } from "../src/lib/vapt/vapt-epss";
import { FEED_AS_OF } from "../src/lib/vapt/vapt-cve-feed";
import {
  BINDING_DOMAINS,
  BINDING_DOMAIN_META,
  BINDING_STATUSES,
  buildBindingsReport,
  type BindingStatus,
} from "../src/lib/bindings";

const GLYPH: Record<BindingStatus, string> = {
  live: "●",
  mock: "◐",
  fixture: "○",
  snapshot: "◓",
  unconfigured: "○",
  disabled: "⊘",
};

const PAD = 13;

function main() {
  const exchange = bindingStatus();
  const intel = intelConfig();
  const web = ethioWebConfig();

  const report = buildBindingsReport({
    google: { configured: googleConfigured(), mock: googleMockMode() },
    smtp: { hostSet: activeTransport() === "smtp" },
    ethioExchange: { bound: exchange.mode === "live", endpoint: exchange.endpoint },
    ethioWeb: { disabled: web.disabled, snapshotAsOf: ethiocertApiSnapshot.capturedAt.slice(0, 10) },
    intel: {
      off: intel.disabled,
      abusechKey: intel.abusechKey !== null,
      otxKey: intel.otxKey !== null,
      greynoiseKey: intel.greynoiseKey !== null,
      mispBound: intel.mispUrl !== null && intel.mispKey !== null,
      mispUrl: intel.mispUrl,
      virustotalKey: intel.virustotalKey !== null,
      kevSnapshotAsOf: kevSnapshot.capturedAt.slice(0, 10),
      dropSnapshotAsOf: dropSnapshot.capturedAt.slice(0, 10),
    },
    epss: { disabled: epssConfig().disabled },
    vaptFeed: { asOf: FEED_AS_OF.slice(0, 10) },
  });

  const line = "─".repeat(78);
  console.log("\nAdwa Cyber — production bindings registry (Phase 3)");
  console.log(`generated ${new Date().toISOString().replace("T", " ").slice(0, 19)} UTC`);
  console.log(line);
  console.log(
    BINDING_STATUSES.filter((s) => report.summary[s] > 0)
      .map((s) => `${GLYPH[s]} ${s.padEnd(PAD - 2)}${String(report.summary[s]).padStart(2)}`)
      .join("   ")
  );
  console.log(line);

  for (const dom of BINDING_DOMAINS) {
    const rows = report.bindings.filter((b) => b.domain === dom);
    if (rows.length === 0) continue;
    console.log(`\n${BINDING_DOMAIN_META[dom].label.toUpperCase()}`);
    for (const b of rows) {
      console.log(`  ${GLYPH[b.status]} [${b.status.padEnd(PAD)}] ${b.label}`);
      console.log(`      ${b.detail}`);
      const extras: string[] = [];
      if (b.asOf) extras.push(`as-of ${b.asOf}`);
      if (b.refresh) extras.push(`refresh: ${b.refresh}`);
      if (b.docs) extras.push(`docs: ${b.docs}`);
      if (extras.length > 0) console.log(`      ${extras.join(" · ")}`);
      if (b.envKeys.length > 0) console.log(`      env: ${b.envKeys.join(", ")}`);
    }
  }

  console.log(`\n${line}`);
  console.log("Statuses and env var names only — secret values never leave the server.");
  console.log("Ops guide: docs/PRODUCTION_BINDINGS.md");
}

main();
