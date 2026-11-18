/** Engine smoke test: run the REAL infra scan against the lab target. */
import { runInfraScan, infraVulnsFromReport, SAFE_DEFAULT } from "../src/lib/vapt-netengine";
import { runDastScan, dastVulnsFromReport } from "../src/lib/vapt-engine";

const HOST = "127.0.0.1";
const PORTS = [3021, 3022, 3060, 3061, 3062];

const cfg = { ...SAFE_DEFAULT, ports: PORTS, connectTimeoutMs: 800, bannerTimeoutMs: 1500 };
const report = await runInfraScan(HOST, cfg);
console.log("reachable:", report.reachable, "| open:", report.openPorts.join(","));
for (const b of report.banners) console.log(`banner :${b.port} →`, b.banner.trim().slice(0, 80));
for (const c of report.serviceChecks) console.log(`check  :${c.port} ${c.id} → hit=${c.hit} (${c.detail})`);

const drafts = infraVulnsFromReport(report, "asset-lab");
console.log(`\nINFRA drafts: ${drafts.length}`);
for (const d of drafts) console.log(`  [${d.severityFromCvss ?? ""}] ${d.cveId ?? "—"} ${d.title} (cvss ${d.cvssScore}, epss ${d.epss}, kev ${d.kev})`);

const dast = await runDastScan("http://127.0.0.1:3060");
console.log(`\nDAST reachable=${dast.reachable} checks=${dast.checks.length} fails=${dast.checks.filter((c) => c.result === "fail").length}`);
const dd = dastVulnsFromReport(dast);
console.log(`DAST drafts: ${dd.length}`);
for (const d of dd) console.log(`  ${d.title} (cvss ${d.cvssScore})`);
