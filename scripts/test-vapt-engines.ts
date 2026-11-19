/**
 * Engine smoke test — the REAL SNMP / DB-audit / EASM engines against the
 * protocol labs. Run: bun scripts/test-vapt-engines.ts
 * (starts its own lab instances on 127.0.0.1 — the ports are the same ones
 * the vuln-lab uses; ensure it is not already running.)
 */
import { runSnmpAudit, snmpVulnsFromReport } from "../src/lib/vapt/vapt-snmp";
import { auditDatabase, dbVulnsFromReport } from "../src/lib/vapt/vapt-db-audit";
import { discoverSubdomains, type CrtShEntry } from "../src/lib/vapt/vapt-easm";
import { startProtocolLabs } from "../mini-services/vuln-lab/protocol-labs";

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

async function main(): Promise<void> {
  startProtocolLabs();
  await new Promise((r) => setTimeout(r, 400));

  // ── SNMP engine ──────────────────────────────────────────────────────────
  console.log("\n[1] SNMP engine vs lab agent (udp/3161)");
  const snmp = await runSnmpAudit("127.0.0.1", 3161, { timeoutMs: 1200 });
  check("snmp reachable", snmp.reachable);
  check("snmp v2c accepted with default 'public'", snmp.defaultCommunities.includes("public"));
  check("snmp v2c accepted with default 'private'", snmp.defaultCommunities.includes("private"));
  check("snmp sysDescr captured", /Cisco IOS/.test(snmp.system.sysDescr ?? ""));
  check("snmp sysName captured", snmp.system.sysName === "CBE-DSW-01");
  check("snmp v3 noAuthNoPriv answered", snmp.v3 === "noAuthNoPriv");
  check("snmp v3 engineId discovered", (snmp.v3EngineId ?? "").length > 0);
  const snmpDrafts = snmpVulnsFromReport(snmp);
  check("snmp findings: 2 default communities + v3 noAuth", snmpDrafts.length === 3, `got ${snmpDrafts.length}`);
  check("snmp evidence carries sysDescr", JSON.stringify(snmpDrafts[0]?.evidence).includes("Cisco IOS"));
  console.log(snmpDrafts.map((d) => `      - ${d.title} (cvss ${d.cvssScore})`).join("\n"));

  // ── DB audit engine: MongoDB no-auth ────────────────────────────────────
  console.log("\n[2] DB-audit engine vs MongoDB no-auth lab (tcp/3160)");
  const mongoNoAuth = await auditDatabase("127.0.0.1", 3160, {}, 2500);
  check("mongo detected", mongoNoAuth.protocol === "mongo");
  check("mongo reachable", mongoNoAuth.reachable);
  check("mongo auth NOT enforced (finding)", mongoNoAuth.mongo && mongoNoAuth.mongo.authEnabled === false);
  check("mongo version 4.0.10 read", mongoNoAuth.mongo?.version === "4.0.10");
  check("mongo database inventory read", (mongoNoAuth.mongo?.databases ?? []).includes("bankdb"));
  const mDrafts = dbVulnsFromReport(mongoNoAuth);
  check("mongo findings: no-auth + EOL", mDrafts.length === 2, `got ${mDrafts.length}`);
  mDrafts.forEach((d) => console.log(`      - ${d.title} (cvss ${d.cvssScore})`));

  // ── DB audit engine: MariaDB auth-enabled ───────────────────────────────
  console.log("\n[3] DB-audit engine vs MariaDB auth lab (tcp/3162)");
  const myNoCred = await auditDatabase("127.0.0.1", 3162, {}, 2500);
  check("mysql detected (handshake)", myNoCred.protocol === "mysql");
  check("mysql version from banner", (myNoCred.mysql?.version ?? "").startsWith("5.5.62"));
  check("mysql root/empty rejected (auth enforced)", myNoCred.mysql?.authEnabled === true);
  check("mysql loginOk false without creds", myNoCred.mysql?.loginOk === undefined || myNoCred.mysql?.loginOk === false);
  const myDraftsNoCred = dbVulnsFromReport(myNoCred);
  check("mysql EOL finding even without creds (banner version)", myDraftsNoCred.length === 1, `got ${myDraftsNoCred.length}`);

  const myCred = await auditDatabase("127.0.0.1", 3162, { mysql: { user: "audit", password: "AdwaAudit2026!" } }, 2500);
  check("mysql credentialed login OK", myCred.mysql?.loginOk === true, `failure: ${myCred.mysql?.loginFailure ?? "?"}`);
  check("mysql @@version_comment via query", myCred.mysql?.comment === "MariaDB Server");
  const myDraftsCred = dbVulnsFromReport(myCred);
  check("mysql EOL finding with credentialed evidence", myDraftsCred.length === 1 && /5\.5\.62/.test(myDraftsCred[0].title));

  const myBadCred = await auditDatabase("127.0.0.1", 3162, { mysql: { user: "audit", password: "wrong" } }, 2500);
  check("mysql wrong password rejected", myBadCred.mysql?.loginOk === false);

  // ── DB audit engine: MongoDB SCRAM-SHA-256 ───────────────────────────────
  console.log("\n[4] DB-audit engine vs MongoDB SCRAM lab (tcp/3164)");
  const scNoCred = await auditDatabase("127.0.0.1", 3164, {}, 2500);
  check("scram mongo detected", scNoCred.protocol === "mongo");
  check("scram mongo auth enforced (code 13)", scNoCred.mongo?.authEnabled === true);

  const scCred = await auditDatabase("127.0.0.1", 3164, { mongo: { user: "audit", password: "AdwaAudit2026!" } }, 3000);
  check("scram-SHA-256 login succeeded", scCred.mongo?.scramOk === true, `failure: ${scCred.mongo?.scramFailure ?? "?"}`);
  check("scram credentialed buildInfo version 5.0.5", scCred.mongo?.version === "5.0.5");
  check("scram credentialed listDatabases", (scCred.mongo?.databases ?? []).includes("bankcore"));
  const scDrafts = dbVulnsFromReport(scCred);
  check("scram EOL finding (5.0.5 → 2024-10)", scDrafts.length === 1 && /MongoDB 5\.0/.test(scDrafts[0].title), `got ${scDrafts.length}`);
  scDrafts.forEach((d) => console.log(`      - ${d.title} (cvss ${d.cvssScore})`));

  const scBadCred = await auditDatabase("127.0.0.1", 3164, { mongo: { user: "audit", password: "wrong" } }, 3000);
  check("scram wrong password fails cleanly", scBadCred.mongo?.scramOk === false);

  // ── EASM engine (fixture-injected transports) ────────────────────────────
  console.log("\n[5] EASM discovery (CT-log parse + DNS on recorded fixture)");
  const fixture: CrtShEntry[] = [
    { issuer_ca_id: 1, issuer_name: "C=US, O=Let's Encrypt, CN=E1", common_name: "nbe.gov.et", name_value: "nbe.gov.et\nwww.nbe.gov.et", id: 101, not_before: "2025-01-01T00:00:00" },
    { issuer_ca_id: 2, issuer_name: "C=US, O=Let's Encrypt, CN=E5", name_value: "portal.nbe.gov.et", id: 102, not_before: "2025-02-01T00:00:00" },
    { issuer_ca_id: 3, issuer_name: "C=US, O=Let's Encrypt, CN=R3", name_value: "*.nbe.gov.et", id: 103, not_before: "2025-03-01T00:00:00" },
    { issuer_ca_id: 4, issuer_name: "C=US, O=Let's Encrypt, CN=R3", name_value: "mail.nbe.gov.et\nvpn.nbe.gov.et", id: 104, not_before: "2025-04-01T00:00:00" },
    { issuer_ca_id: 5, issuer_name: "C=US, O=DigiCert", name_value: "unrelated.example.com", id: 105, not_before: "2025-05-01T00:00:00" },
  ];
  const fakeResolver = async (name: string): Promise<string[]> => {
    const table: Record<string, string[]> = {
      "www.nbe.gov.et": ["196.188.44.10"],
      "portal.nbe.gov.et": ["196.188.44.20"],
      "mail.nbe.gov.et": ["196.188.44.25"],
    };
    return table[name] ?? [];
  };
  const easm = await discoverSubdomains("nbe.gov.et", { fetcher: async () => fixture, resolver: fakeResolver });
  const names = easm.hosts.map((h) => h.name).sort();
  check("easm wildcard entry collapsed", !names.some((n) => n.includes("*")));
  check("easm discovered 4 names", names.length === 4, `got ${names.join(", ")}`);
  check("easm resolved www/portal/mail", easm.hosts.filter((h) => h.resolved).length === 3);
  check("easm vpn.nbe.gov.et unresolved (NXDOMAIN simulated)", easm.hosts.find((h) => h.name === "vpn.nbe.gov.et")?.resolved === false);
  check("easm CT source recorded", easm.hosts[0].sources.ct?.entryId !== undefined);

  console.log(`\n${fail === 0 ? "ALL ENGINE CHECKS PASSED" : "FAILURES: " + fail}  (${pass} passed / ${fail} failed)`);
  process.exit(fail === 0 ? 0 : 1);
}

void main();
