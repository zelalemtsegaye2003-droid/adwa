/** Quick sanity check of the bid matrix + AD attack-path engines. */
import { BID_REQUIREMENTS, bidMatrixSummary, bidMatrixCsv } from "../src/lib/vapt-bid-matrix";
import { AD_NODES, AD_EDGES } from "../src/lib/vapt-ad-paths";
import { computeAdAttackPaths } from "../src/lib/vapt-ad-engine";

const s = bidMatrixSummary();
console.log("BID matrix:", JSON.stringify({
  total: s.total, full: s.full, partial: s.partial, roadmap: s.roadmap,
  pcts: [s.fullPct, s.partialPct, s.roadmapPct],
  sectionTotals: Object.fromEntries(s.sections.map((x) => [x.id, x.total])),
}, null, 1));
console.log("CSV rows:", bidMatrixCsv().split("\n").length - 1);

const ids = new Set(BID_REQUIREMENTS.map((r) => r.id));
if (ids.size !== BID_REQUIREMENTS.length) throw new Error("duplicate bid ids");
if (s.total !== 66) throw new Error(`expected 66 rows, got ${s.total}`);
if (s.full + s.partial + s.roadmap !== s.total) throw new Error("status counts don't add up");

// AD graph
const nodeIds = new Set(AD_NODES.map((n) => n.id));
for (const e of AD_EDGES) {
  if (!nodeIds.has(e.from) || !nodeIds.has(e.to)) throw new Error(`edge references missing node: ${e.from}->${e.to}`);
}

const analysis = computeAdAttackPaths();
console.log("\nAD analysis:", JSON.stringify({
  nodes: analysis.stats.nodes, edges: analysis.stats.edges,
  paths: analysis.stats.paths, shortestHops: analysis.stats.shortestHops,
  t0Pct: analysis.stats.tier0ExposurePct,
  kerb: analysis.stats.kerberoastable, asrep: analysis.stats.asrepRoastable,
  chokepoints: analysis.stats.chokepoints.map((c) => `${c.name}×${c.pathCount}`),
}, null, 1));

for (const p of analysis.paths) {
  console.log(`  ${p.id}: ${p.entryName} -> ${p.targetName} | ${p.length} hops | risk ${p.risk} | ${p.techniques.join("+")} | rem ${p.remediations.length}`);
}

if (analysis.stats.paths < 4) throw new Error("too few paths");
if (analysis.stats.shortestHops !== 4) throw new Error(`expected shortest 4 hops (to Domain Admins), got ${analysis.stats.shortestHops}`);
const toDc = analysis.paths.filter((p) => p.targetId === "c-dc01");
if (!toDc.length || toDc[0].length !== 5) throw new Error(`expected shortest to DC = 5 hops, got ${toDc[0]?.length}`);
if (analysis.stats.tier0ExposurePct !== 100) throw new Error("both entries should reach tier-0");
console.log("\nOK — sanity checks passed");
