/**
 * Adwa Cyber — Track C seed (Phases 4 & 5).
 *
 * Phase 4 (ACFS): seeds the gate-precondition register across the four
 *   domains with a realistic mix of statuses — the gate stays LOCKED
 *   (EHRC due-diligence domain unmet), plus two recorded periodic reviews.
 * Phase 5 (CII): seeds the four TIER1 operators named in the proposal with
 *   MIXED gate states so the gating logic is demonstrable end-to-end:
 *
 *   EEP                 MOU ACTIVE   + INSA ACTIVE  → GATE OPEN (monitoring)
 *   ETHIO-TELECOM       MOU ACTIVE   + INSA UNDER_REVIEW → gated (INSA)
 *   CBE                 MOU LEGAL_REVIEW + INSA GRANTED → gated (MOU)
 *   ETHIOPIAN-AIRLINES  MOU DRAFTING + (no INSA)   → gated (both)
 *
 * CBE and Ethio Telecom are linked to their tenant organizations so their
 * users get the read-only `cii:view-own` feed.
 *
 * Idempotent: wipes and recreates the Track C tables only.
 * Usage: node scripts/seed-trackc.cjs
 */
const { PrismaClient } = require("@prisma/client");
const db = new PrismaClient();

// D6 guard — refuses to seed a production DB without explicit opt-in
if (process.env.NODE_ENV === "production") {
  var bootstrapOk = process.env.SEED_ON_BOOT === "1" || process.env.ALLOW_DEMO_SEED === "1";
  var guardOk = "demo" === "bootstrap" ? bootstrapOk : process.env.ALLOW_DEMO_SEED === "1";
  if (!guardOk) {
    var needed = "demo" === "bootstrap" ? "SEED_ON_BOOT=1" : "ALLOW_DEMO_SEED=1";
    console.error("[seed-guard] " + "demo" + " seeding refused: NODE_ENV=production without " + needed + " (decision D6 — docs/DECISIONS.md).");
    process.exit(1);
  }
}

const DAY = 24 * 60 * 60 * 1000;
const ago = (d) => new Date(Date.now() - d * DAY);
const ahead = (d) => new Date(Date.now() + d * DAY);

// ── Phase 4 — ACFS gate register ─────────────────────────────────────────────

const ACFS_ITEMS = [
  // EMA_PARTNERSHIP
  { domain: "EMA_PARTNERSHIP", code: "EMA-01", titleEn: "Signed cooperation MOU with the Ethiopian Media Authority", titleAm: "ከኢትዮጵያ የመገናኛ ብዙኀን ባለሥልጣን ጋር የተፈረመ የትብብር ውል", description: "The ACFS may not be designed or deployed without a standing cooperation agreement with the EMA defining category governance.", status: "SATISFIED", owner: "Executive Director", evidenceRef: "GOV-VAULT/2026/EMA-MOU", sortOrder: 1 },
  { domain: "EMA_PARTNERSHIP", code: "EMA-02", titleEn: "Joint category-classification working group constituted", titleAm: "የጋራ የምድብ መከፋፈያ የሥራ ቡድን ተቋቁሟል", description: "EMA + Adwa Cyber joint working group with published terms of reference and named members.", status: "SATISFIED", owner: "Policy Lead", evidenceRef: "EMA/WG-TOR/2026", sortOrder: 2 },
  { domain: "EMA_PARTNERSHIP", code: "EMA-03", titleEn: "Quarterly joint review calendar adopted", titleAm: "የሩብ ዓመት የጋራ ግምገማ መቀመጫ ተቀብሏል", description: "Standing quarterly review of category definitions with published minutes.", status: "IN_PROGRESS", owner: "Policy Lead", sortOrder: 3 },
  // EHRC_DUE_DILIGENCE
  { domain: "EHRC_DUE_DILIGENCE", code: "EHRC-01", titleEn: "Human-rights impact assessment of draft filtering categories", titleAm: "የረቂቅ ምድቦች የሰብዓዊ መብት ተጽዕኖ ግምገማ", description: "Independent HRIA of every draft category against the Ethiopian Constitution Art. 29 and ICCPR Art. 19 standards.", status: "IN_PROGRESS", owner: "Policy Lead", notes: "Draft HRIA circulated to reviewers; field interviews scheduled.", sortOrder: 1 },
  { domain: "EHRC_DUE_DILIGENCE", code: "EHRC-02", titleEn: "EHRC review and no-objection letter", titleAm: "የEHRC ግምገማ እና የመቃወም የሌለው ደብዳቤ", description: "Formal EHRC clearance that the framework meets human-rights due-diligence standards.", status: "BLOCKED", owner: "Executive Director", notes: "Awaiting EHRC Council decision — expected Q3.", sortOrder: 2 },
  { domain: "EHRC_DUE_DILIGENCE", code: "EHRC-03", titleEn: "Independent academic validation study", titleAm: "ገለልተኛ የትምህርት ማረጋገጫ ጥናት", description: "Partner-university study on over-blocking and false-positive rates for the proposed categories.", status: "NOT_STARTED", sortOrder: 3 },
  // TRANSPARENCY_FRAMEWORK
  { domain: "TRANSPARENCY_FRAMEWORK", code: "TRA-01", titleEn: "Blocking categories published in the Federal Negarit Gazette", titleAm: "የማገጃ ምድቦች በፌዴራል ንጋሪት ጋዜታ ታትመዋል", description: "Every filtering category must be public law before it can be enforced.", status: "SATISFIED", owner: "Legal Counsel", evidenceRef: "Negarit-Gazette/2026/Art-14", sortOrder: 1 },
  { domain: "TRANSPARENCY_FRAMEWORK", code: "TRA-02", titleEn: "Two-tier appeals mechanism with documented SLAs", titleAm: "ባለ ሁለት ደረጃ ይግባኝ መግለጫ ከሰነድ SLA ጋር", description: "First appeal to an independent review panel, second to a court; 15-working-day response SLA.", status: "EVIDENCE_SUBMITTED", owner: "Legal Counsel", evidenceRef: "GOV-VAULT/2026/APPEALS-CHARTER", sortOrder: 2 },
  { domain: "TRANSPARENCY_FRAMEWORK", code: "TRA-03", titleEn: "Judicial oversight protocol for emergency blocking", titleAm: "ለአስቸኳይ ማገጃ የፍትሕ ክለሳ ሠነድ", description: "Emergency blocks lapse within 48h absent ex-post judicial confirmation.", status: "IN_PROGRESS", owner: "Legal Counsel", sortOrder: 3 },
  { domain: "TRANSPARENCY_FRAMEWORK", code: "TRA-04", titleEn: "Quarterly transparency audit published externally", titleAm: "የሩብ ዓመት ግልጽነት ኦዲት ለውጫዊ ታትማል", description: "Independent audit of blocking volumes, appeal outcomes and error rates, published quarterly.", status: "NOT_STARTED", sortOrder: 4 },
  { domain: "TRANSPARENCY_FRAMEWORK", code: "TRA-05", titleEn: "90-day retention limit with automated purge", titleAm: "የ90 ቀን ጥበቃ ገደብ ከራስ-ሰር ማጽዳት ጋር", description: "No filtered-traffic data may be retained beyond 90 days; purge is automated and audited.", status: "EVIDENCE_SUBMITTED", owner: "CTO", evidenceRef: "GOV-VAULT/2026/RETENTION-POLICY", sortOrder: 5 },
  // DEDICATED_FUNDING
  { domain: "DEDICATED_FUNDING", code: "FND-01", titleEn: "Dedicated budget line approved by the board", titleAm: "በቦርድ የተጸደቀ የተመደበ የበጀት መስመር", description: "A ring-fenced institutional budget line, not project funding.", status: "SATISFIED", owner: "CFO", evidenceRef: "BOARD-RES/2026/07", sortOrder: 1 },
  { domain: "DEDICATED_FUNDING", code: "FND-02", titleEn: "Three-year funding commitment secured", titleAm: "የሦስት ዓመት የገንዘብ ቁርጠኝነት ተገኝቷል", description: "Multi-year commitment covering operations, audits and the appeals mechanism.", status: "IN_PROGRESS", owner: "CFO", sortOrder: 2 },
];

const ACFS_DECISIONS = [
  {
    decision: "REMAINED_LOCKED",
    rationale: "Q2 2026 periodic review: EMA partnership and the dedicated budget line are satisfied. The EHRC due-diligence domain remains unmet (human-rights impact assessment in progress; no-objection letter pending). The gate stays shut and no filtering engineering has commenced.",
    decidedBy: "Adwa Cyber Governance Board",
  },
  {
    decision: "REMAINED_LOCKED",
    rationale: "Q3 2026 periodic review: transparency-framework evidence submitted for the appeals mechanism and the 90-day retention policy. EHRC clearance is still outstanding. The gate remains shut; the register is published to demonstrate exactly why.",
    decidedBy: "Adwa Cyber Governance Board",
  },
];

// ── Phase 5 — CII operators, MOUs, INSA authorisations, systems ─────────────

async function orgIdBySlug(slug) {
  const org = await db.organization.findUnique({ where: { slug }, select: { id: true } });
  return org?.id ?? null;
}

async function main() {
  console.log("Seeding Track C (Phases 4 & 5)…\n");

  // ── Wipe (idempotent) ──────────────────────────────────────────────────
  await db.ciiSystem.deleteMany();
  await db.ciiAuthorization.deleteMany();
  await db.ciiMou.deleteMany();
  await db.ciiOperator.deleteMany();
  await db.acfsGateDecision.deleteMany();
  await db.acfsGateItem.deleteMany();

  // ── Phase 4: ACFS ──────────────────────────────────────────────────────
  for (const item of ACFS_ITEMS) {
    await db.acfsGateItem.create({ data: item });
  }
  for (const d of ACFS_DECISIONS) {
    await db.acfsGateDecision.create({ data: d });
  }
  const satisfied = ACFS_ITEMS.filter((i) => i.status === "SATISFIED").length;
  console.log(`Phase 4 (ACFS): ${ACFS_ITEMS.length} preconditions across 4 domains — ${satisfied} satisfied → gate LOCKED; ${ACFS_DECISIONS.length} periodic reviews recorded.`);

  // ── Phase 5: CII ───────────────────────────────────────────────────────
  const cbeOrg = await orgIdBySlug("commercial-bank-of-ethiopia-cbe");
  const telecomOrg = await orgIdBySlug("ethio-telecom");

  const seed = [
    {
      code: "EEP", name: "Ethiopian Electric Power", nameAm: "የኢትዮጵያ ኤሌክትሪክ ኃይል", sector: "Energy", orgId: null,
      mous: [
        { version: 1, status: "ACTIVE", scope: ["NETFLOW", "DNS_LOGS", "SIEM_ALERTS", "OT_TELEMETRY"], dataTerms: "90-day retention; quarterly scope audit; no cross-border transfer; incident-only access to OT telemetry.", signedAt: ago(370), expiresAt: ahead(730) },
      ],
      auths: [
        { reference: "INSA/CII/2025/017", status: "ACTIVE", issuedAt: ago(350), expiresAt: ahead(380), scope: "OT telemetry + national-grid SOC alerting" },
      ],
      systems: [
        { name: "National Grid SCADA (Addis–Dire Dawa corridor)", nameAm: "ብሔራዊ የኤሌክትሪክ መስመር SCADA", category: "SCADA", criticality: "CRITICAL", readiness: "MONITORING_AUTHORIZED" },
        { name: "Grid Telemetry Historian", nameAm: "የግሪድ ቴሌሜትሪ መዝገብ", category: "DATA_CENTER", criticality: "HIGH", readiness: "MONITORING_AUTHORIZED" },
        { name: "Corporate ERP (Finance)", nameAm: "የድርጅት ERP (ፋይናንስ)", category: "ERP", criticality: "CRITICAL", readiness: "AGENT_READY" },
      ],
    },
    {
      code: "ETHIO-TELECOM", name: "Ethio Telecom", nameAm: "ኢትዮ ቴሌኮም", sector: "Telecommunications", orgId: telecomOrg,
      mous: [
        { version: 1, status: "ACTIVE", scope: ["NETFLOW", "DNS_LOGS", "BGP_FLOWS", "SIEM_ALERTS"], dataTerms: "90-day retention; metadata only — no payload capture; quarterly scope audit.", signedAt: ago(270), expiresAt: ahead(740) },
      ],
      auths: [
        { reference: "INSA/CII/2026/041", status: "UNDER_REVIEW", scope: "Backbone flow telemetry + DNS abuse feeds" },
      ],
      systems: [
        { name: "National Backbone OTN Ring", nameAm: "ብሔራዊ የግንኙነት ዋና መስመር (OTN)", category: "NETWORK_BACKBONE", criticality: "CRITICAL", readiness: "AGENT_READY" },
        { name: "Adama National Data Center", nameAm: "የአዳማ ብሔራዊ ዳታ ማዕከል", category: "DATA_CENTER", criticality: "HIGH", readiness: "INVENTORY_MAPPED" },
      ],
    },
    {
      code: "CBE", name: "Commercial Bank of Ethiopia", nameAm: "የኢትዮጵያ ንግድ ባንክ", sector: "Banking", orgId: cbeOrg,
      mous: [
        { version: 1, status: "LEGAL_REVIEW", scope: ["SIEM_ALERTS", "AUTH_LOGS", "FRAUD_TELEMETRY"], dataTerms: "Draft terms: no customer-data content; aggregated fraud signals only; 90-day retention." },
      ],
      auths: [
        { reference: "INSA/CII/2026/052", status: "GRANTED", issuedAt: ago(100), expiresAt: ahead(260), scope: "Core-banking security telemetry (aggregated)" },
      ],
      systems: [
        { name: "Core Banking System (CABS)", nameAm: "ዋና የባንክ ሥርዓት (CABS)", category: "CORE_BANKING", criticality: "CRITICAL", readiness: "AGENT_READY" },
        { name: "Payment Switch (EthSwitch Link)", nameAm: "የክፍያ መቀየሪያ (EthSwitch)", category: "PAYMENT_SWITCH", criticality: "CRITICAL", readiness: "INVENTORY_MAPPED" },
      ],
    },
    {
      code: "ETHIOPIAN-AIRLINES", name: "Ethiopian Airlines", nameAm: "የኢትዮጵያ አየር መንገድ", sector: "Aviation", orgId: null,
      mous: [
        { version: 1, status: "DRAFTING", scope: ["RESERVATION_LOGS", "NETWORK_FLOW"] },
      ],
      auths: [],
      systems: [
        { name: "Passenger Reservation Integration", nameAm: "የተሳፋሪ ቦታ ማስያዣ መስክ", category: "RESERVATION", criticality: "CRITICAL", readiness: "REGISTERED" },
      ],
    },
  ];

  for (const s of seed) {
    const op = await db.ciiOperator.create({
      data: {
        code: s.code, name: s.name, nameAm: s.nameAm, sector: s.sector,
        tier: "TIER1", orgId: s.orgId,
        contactEmail: { EEP: "cio@eep.com.et", "ETHIO-TELECOM": "security@ethiotelecom.et", CBE: "ciso@cbe.com.et", "ETHIOPIAN-AIRLINES": "cio@ethiopianairlines.com" }[s.code] ?? null,
      },
    });
    for (const m of s.mous) {
      await db.ciiMou.create({ data: { operatorId: op.id, version: m.version, status: m.status, scope: JSON.stringify(m.scope), dataTerms: m.dataTerms ?? null, signedAt: m.signedAt ?? null, expiresAt: m.expiresAt ?? null } });
    }
    for (const a of s.auths) {
      await db.ciiAuthorization.create({ data: { operatorId: op.id, reference: a.reference, status: a.status, issuedAt: a.issuedAt ?? null, expiresAt: a.expiresAt ?? null, scope: a.scope ?? null } });
    }
    for (const sys of s.systems) {
      await db.ciiSystem.create({ data: { operatorId: op.id, name: sys.name, nameAm: sys.nameAm ?? null, category: sys.category, criticality: sys.criticality, readiness: sys.readiness } });
    }
    const mou = s.mous[0]?.status ?? "—";
    const auth = s.auths[0]?.status ?? "NONE";
    const open = s.mous.some((m) => m.status === "ACTIVE" || m.status === "SIGNED") && s.auths.some((a) => a.status === "ACTIVE" || a.status === "GRANTED");
    console.log(`Phase 5 (CII): ${s.code.padEnd(18)} MOU=${mou.padEnd(13)} INSA=${(auth || "NONE").padEnd(13)} gate=${open ? "OPEN ✓" : "GATED ✗"} systems=${s.systems.length}${s.orgId ? " (tenant-linked)" : ""}`);
  }

  console.log("\nTrack C seed complete.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
