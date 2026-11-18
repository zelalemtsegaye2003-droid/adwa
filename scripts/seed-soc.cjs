/**
 * Adwa Cyber — SOC / CERT-as-a-Service demo seed (proposal Phase 2).
 *
 * Seeds the 24/7 SOC module with a realistic pilot dataset:
 *  1. Threat indicators from the simulated Ethio-CERT national feed
 *     (a completed INGEST SyncRun), plus member-contributed indicators.
 *  2. One hub-broadcast share (anonymised) and one peer-to-peer share.
 *  3. Incidents across the pilot banks with the full NIST SP 800-61
 *     lifecycle, realistic detection→notification latencies (RQ3: mostly
 *     under 15 minutes), timelines, and matched indicators.
 *
 * Idempotent — deletes prior SOC seed data before re-creating.
 * Usage: node scripts/seed-soc.cjs
 */
const { PrismaClient } = require("@prisma/client");
const db = new PrismaClient();

// D6 guard — refuses to seed a production DB without explicit opt-in
if (process.env.NODE_ENV === "production") {
  var bootstrapOk = process.env.SEED_ON_BOOT === "1" || process.env.ALLOW_DEMO_SEED === "1";
  var guardOk = "bootstrap" === "bootstrap" ? bootstrapOk : process.env.ALLOW_DEMO_SEED === "1";
  if (!guardOk) {
    var needed = "bootstrap" === "bootstrap" ? "SEED_ON_BOOT=1" : "ALLOW_DEMO_SEED=1";
    console.error("[seed-guard] " + "bootstrap" + " seeding refused: NODE_ENV=production without " + needed + " (decision D6 — docs/DECISIONS.md).");
    process.exit(1);
  }
}

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const now = () => new Date();

// Mirrors soc-engine.prioritiseIncident (kept in sync for seed realism).
const SEV_W = { critical: 40, high: 28, medium: 16, low: 8 };
const SECTOR_BOOST = {
  Banking: { bec: 14, ransomware: 12, phishing: 10, credential_stuffing: 10, malware: 8, data_breach: 8 },
};
function prioritise(severity, category, sector, confidence, ageMin) {
  const boost = (SECTOR_BOOST[sector] || {})[category] ?? 0;
  const confTerm = Math.round(((confidence - 50) / 100) * 12);
  const fresh = ageMin <= 15 ? 6 : ageMin <= 60 ? 3 : ageMin <= 240 ? 0 : -4;
  const score = Math.max(0, Math.min(100, (SEV_W[severity] ?? 12) + boost + confTerm + fresh));
  return { score, label: score >= 75 ? "IMMEDIATE" : score >= 50 ? "HIGH" : "ROUTINE" };
}

async function main() {
  console.log("── SOC seed: clearing previous SOC data ──");
  await db.incidentIndicator.deleteMany();
  await db.incidentEvent.deleteMany();
  await db.incident.deleteMany();
  await db.indicatorShare.deleteMany();
  await db.syncRun.deleteMany();
  await db.threatIndicator.deleteMany({ where: { OR: [
    { source: "ETHIO_CERT" }, { source: "ORG_UPLOAD" }, { source: "MISP_FEED" }, { source: "ANALYST" },
    { source: "CISA_KEV" }, { source: "SPAMHAUS_DROP" }, { source: "URLHAUS" }, { source: "THREATFOX" }, { source: "OTX" },
  ] } });

  const orgs = await db.organization.findMany();
  const byName = (n) => orgs.find((o) => o.name.toLowerCase().includes(n.toLowerCase()));
  const cbe = byName("Commercial Bank");
  const dashen = byName("Dashen");
  const amhara = byName("Amhara");
  if (!cbe || !dashen || !amhara) {
    console.log("  ? Pilot orgs not found (need CBE, Dashen, Amhara) — run prisma/seed.ts first.");
    return;
  }
  const admin = await db.user.findFirst({ where: { organizationId: cbe.id, role: "ORG_ADMIN" } });
  const platformAdmin = await db.user.findFirst({ where: { role: "SUPER_ADMIN" } });
  const dashenAdmin = await db.user.findFirst({ where: { organizationId: dashen.id } });
  const wasasa = byName("Wasasa");

  // ── 1. National feed indicators (Ethio-CERT INGEST) ───────────────────────
  console.log("── Ethio-CERT national feed (INGEST) ──");
  const feed = [
    { type: "domain", value: "cbe-secure-verify-portal.com", titleEn: "Bank impersonation phishing domain", titleAm: "የባንክ ማንነት የሚስበ የማጭበርበር ገጽ", category: "phishing", severity: "critical", tlp: "TLP:AMBER", confidence: 92, sensitivity: 2, sharing: "HUB", bulletin: "EC-BUL-2026-041" },
    { type: "ip", value: "203.0.113.66", titleEn: "Active credential-stuffing source", titleAm: "ንቁ የይለፍ ቃል መሞከሪያ ምንጭ", category: "credential_stuffing", severity: "high", tlp: "TLP:AMBER", confidence: 85, sensitivity: 3, sharing: "HUB", bulletin: "EC-BUL-2026-042" },
    { type: "hash_sha256", value: "9f2c4a71e8d3b5067c1a9e4f8b2d6a3c5e7f1b9d8a6c4e2f0d3b5a7c9e1f4b6d", titleEn: "Mobile banking trojan dropper (Fleckpe-family)", titleAm: "የሞባይል ባንክ ትሮጃን መስቫሽ", category: "malware", severity: "critical", tlp: "TLP:AMBER", confidence: 88, sensitivity: 2, sharing: "HUB", bulletin: "EC-BUL-2026-043" },
    { type: "domain", value: "ethiotelecom-bill-pay.online", titleEn: "Utility-bill phishing domain", titleAm: "የኤሌክትሪክ ክፍያ ማጭበርበሪያ ገጽ", category: "phishing", severity: "high", tlp: "TLP:GREEN", confidence: 78, sensitivity: 1, sharing: "HUB", bulletin: "EC-BUL-2026-044" },
    { type: "email", value: "procurement-ethiopian-airports.net@mail.cf", titleEn: "BEC sender impersonating procurement staff", titleAm: "የግዥ ሠራተኛ ሆኖ የሚቀርጥ የBEC ላኪ", category: "bec", severity: "high", tlp: "TLP:AMBER", confidence: 81, sensitivity: 3, sharing: "HUB", bulletin: "EC-BUL-2026-045" },
    { type: "url", value: "hxxp://198.51.100.23/nta-update.exe", titleEn: "Ransomware staging URL (lockbit-style)", titleAm: "የራንሶምዌር ዝግጅት አድራሻ", category: "ransomware", severity: "critical", tlp: "TLP:RED", confidence: 90, sensitivity: 4, sharing: "P2P", bulletin: "EC-BUL-2026-046" },
    { type: "ip", value: "192.0.2.140", titleEn: "DDoS bootstresser C2", titleAm: "የDDoS ጥቃት መቆጣጠሪያ", category: "ddos", severity: "medium", tlp: "TLP:GREEN", confidence: 72, sensitivity: 2, sharing: "HUB", bulletin: "EC-BUL-2026-047" },
    { type: "filename", value: "NBE_circular_2026_DBS-41.docm", titleEn: "Macro-enabled lure document impersonating NBE circular", titleAm: "የኤንቢኢ ዘመናዊ ሆኖ የቀረጸ ማታለያ ሰነድ", category: "malware", severity: "high", tlp: "TLP:AMBER", confidence: 83, sensitivity: 3, sharing: "HUB", bulletin: "EC-BUL-2026-048" },
  ];
  const feedIds = {};
  for (const f of feed) {
    const { bulletin, ...rest } = f;
    const ind = await db.threatIndicator.create({
      data: {
        ...rest,
        source: "ETHIO_CERT",
        sourceRef: bulletin,
        organizationId: null,
        createdById: null,
        firstSeenAt: new Date(now().getTime() - 2 * DAY),
        lastSeenAt: new Date(now().getTime() - 3 * HOUR),
        sightings: Math.floor(Math.random() * 4) + 2,
      },
    });
    feedIds[f.value] = ind.id;
  }
  await db.syncRun.create({
    data: {
      direction: "INGEST", status: "success", ingested: feed.length, updated: 0,
      triggeredById: platformAdmin?.id ?? admin?.id,
      detail: `Ethio-CERT national feed: ${feed.length} new indicator(s), 0 refreshed`,
      createdAt: new Date(now().getTime() - 2 * HOUR),
    },
  });
  console.log(`  + ${feed.length} national-feed indicators + 1 INGEST sync run`);

  // ── 2. Member-contributed indicators + shares ──────────────────────────────
  console.log("── Member contributions & hybrid sharing ──");
  const cbeInd = await db.threatIndicator.create({
    data: {
      type: "domain", value: "awash-mobile-rewards.app", 
      titleEn: "Fake mobile-banking rewards app (Awash impersonation)",
      titleAm: "ውሸታዊ የሞባይል ባንክ ሽልማት መተግበሪያ",
      descriptionEn: "Contributed by a member bank: unofficial APK overlaying the real mobile-banking app to capture PINs; distributed via social-media lures.",
      category: "malware", severity: "high", tlp: "TLP:AMBER", confidence: 86, sensitivity: 3,
      sharing: "HUB", source: "ORG_UPLOAD", organizationId: cbe.id, createdById: admin?.id,
      firstSeenAt: new Date(now().getTime() - 5 * DAY), lastSeenAt: new Date(now().getTime() - 6 * HOUR), sightings: 5,
    },
  });
  await db.indicatorShare.create({
    data: { indicatorId: cbeInd.id, mode: "HUB_BROADCAST", targetOrgId: null, sharedById: admin?.id ?? platformAdmin?.id, anonymised: true },
  });

  const awashInd = await db.threatIndicator.create({
    data: {
      type: "email", value: "ceo-office.disbursements@mail-secure.cf",
      titleEn: "CEO fraud sender targeting finance staff (sensitive — P2P)",
      titleAm: "የፋይናንስ ሠራተኞችን የሚያሳብድ የገዢ ማጭበርበሪያ (ስሜታዊ — P2P)",
      descriptionEn: "Business-email-compromise attempt referencing a live vendor payment; the reporter asked for identity protection.",
      category: "bec", severity: "critical", tlp: "TLP:AMBER+STRICT", confidence: 89, sensitivity: 4,
      sharing: "P2P", source: "ORG_UPLOAD", organizationId: dashen.id, createdById: dashenAdmin?.id,
      firstSeenAt: new Date(now().getTime() - 1 * DAY), lastSeenAt: new Date(now().getTime() - 2 * HOUR), sightings: 2,
    },
  });
  await db.indicatorShare.create({
    data: { indicatorId: awashInd.id, mode: "PEER_DIRECT", targetOrgId: wasasa.id, sharedById: dashenAdmin?.id ?? platformAdmin?.id, anonymised: false },
  });
  console.log("  + 1 hub broadcast (anonymised), 1 peer share Dashen → Wasasa");

  // ── 3. Incidents (NIST SP 800-61 lifecycle) ────────────────────────────────
  console.log("── Incidents ──");
  let seq = 0;
  const mkRef = () => `INC-2026-${String(++seq).padStart(4, "0")}`;

  async function createIncident(cfg) {
    const { org, title, titleAm, description, category, severity, source, detectionMethod, detectedAt, notifyMin, steps, indicators, actor } = cfg;
    const pri = prioritise(severity, category, org.sector, 75, 30);
    const events = [{ type: "DETECTED", note: `Priority ${pri.score}/100 (${pri.label})`, at: detectedAt, actor }];
    const stamps = { detectedAt };
    if (notifyMin !== null) stamps.notifiedAt = new Date(detectedAt.getTime() + notifyMin * MIN);
    let prev = detectedAt;
    for (const s of steps) {
      prev = new Date(prev.getTime() + s.afterMin * MIN);
      stamps[s.field] = prev;
      events.push({ type: s.event, note: s.note ?? null, at: prev, actor });
    }
    if (stamps.notifiedAt) {
      events.splice(1, 0, {
        type: "NOTIFIED",
        note: `Organisation notified — detection→notification latency ${notifyMin} min (RQ3 target: median ≤ 15 min)`,
        at: stamps.notifiedAt, actor,
      });
    }
    const inc = await db.incident.create({
      data: {
        organizationId: org.id, ref: mkRef(), title, titleAm, description,
        category, severity, source, detectionMethod,
        status: steps.length ? steps[steps.length - 1].status : "detected",
        priorityScore: pri.score, priorityLabel: pri.label,
        detectedAt: stamps.detectedAt,
        notifiedAt: stamps.notifiedAt ?? null,
        triagedAt: stamps.triagedAt ?? null,
        containedAt: stamps.containedAt ?? null,
        eradicatedAt: stamps.eradicatedAt ?? null,
        recoveredAt: stamps.recoveredAt ?? null,
        closedAt: stamps.closedAt ?? null,
        events: { create: events.map((e) => ({ type: e.type, note: e.note, actorId: e.actor?.id ?? null, createdAt: e.at })) },
      },
    });
    for (const indValue of indicators ?? []) {
      const indId = feedIds[indValue] ?? (indValue === "APK" ? cbeInd.id : indValue === "CEO" ? awashInd.id : null);
      if (indId) {
        await db.incidentIndicator.create({ data: { incidentId: inc.id, indicatorId: indId } });
        await db.threatIndicator.update({ where: { id: indId }, data: { sightings: { increment: 1 }, lastSeenAt: now() } });
      }
    }
    console.log(`  + ${inc.ref} [${severity}/${category}] ${org.name} — ${stamps.notifiedAt ? `notified ${notifyMin}′` : "NOT notified"} · ${inc.status}`);
    return inc;
  }

  // Closed phishing incident at CBE (latency 6 min, resolved fast)
  await createIncident({
    org: cbe, title: "SMS phishing wave impersonating the bank's card centre", titleAm: "የካርድ ማዕከል ሆኖ የተላከ የኤስኤምኤስ ማጭበርበር",
    description: "SOC detected a burst of SMS lures pointing at a look-alike domain; card-operations and communications teams coordinated takedown.",
    category: "phishing", severity: "high", source: "SOC_MONITOR", detectionMethod: "threat_intel_match",
    detectedAt: new Date(now().getTime() - 6 * DAY), notifyMin: 6,
    steps: [
      { status: "triaged", field: "triagedAt", event: "TRIAGE", afterMin: 4, note: "Correlated with national-feed indicator EC-BUL-2026-041." },
      { status: "contained", field: "containedAt", event: "CONTAIN", afterMin: 35, note: "Domain blocked at DNS resolvers; SMS gateway filter updated." },
      { status: "eradicated", field: "eradicatedAt", event: "ERADICATE", afterMin: 90, note: "Registrar takedown completed; customer comms issued." },
      { status: "recovered", field: "recoveredAt", event: "RECOVER", afterMin: 60 },
      { status: "closed", field: "closedAt", event: "CLOSE", afterMin: 120, note: "No customer losses confirmed; post-incident review scheduled." },
    ],
    indicators: ["cbe-secure-verify-portal.com"], actor: admin,
  });

  // Closed BEC at Dashen (latency 11 min)
  await createIncident({
    org: dashen, title: "Vendor invoice-redirection attempt (BEC)", titleAm: "የአቅራቢ ኢንቮይስ መቀየሪያ ሙከራ (BEC)",
    description: "Finance staff received a payment-redirection request from a spoofed executive address; blocked after verification call.",
    category: "bec", severity: "critical", source: "SOC_MONITOR", detectionMethod: "behavioural",
    detectedAt: new Date(now().getTime() - 4 * DAY), notifyMin: 11,
    steps: [
      { status: "triaged", field: "triagedAt", event: "TRIAGE", afterMin: 6 },
      { status: "contained", field: "containedAt", event: "CONTAIN", afterMin: 25, note: "Payment halted pending verification; sender domain blocked." },
      { status: "eradicated", field: "eradicatedAt", event: "ERADICATE", afterMin: 70, note: "Mail rules hardened; finance retrained." },
      { status: "recovered", field: "recoveredAt", event: "RECOVER", afterMin: 40 },
      { status: "closed", field: "closedAt", event: "CLOSE", afterMin: 90 },
    ],
    indicators: ["procurement-ethiopian-airports.net@mail.cf", "CEO"], actor: dashenAdmin,
  });

  // Contained credential-stuffing at CBE (latency 8 min)
  await createIncident({
    org: cbe, title: "Credential-stuffing burst against online banking", titleAm: "በመስመር ላይ ባንክ ላይ የይለፍ ቃል መሞከር",
    description: "Distributed login attempts from a rotating proxy pool; rate-limiting and step-up authentication blunted the wave.",
    category: "credential_stuffing", severity: "high", source: "SOC_MONITOR", detectionMethod: "anomaly",
    detectedAt: new Date(now().getTime() - 2 * DAY), notifyMin: 8,
    steps: [
      { status: "triaged", field: "triagedAt", event: "TRIAGE", afterMin: 5, note: "Source IP matched national feed EC-BUL-2026-042." },
      { status: "contained", field: "containedAt", event: "CONTAIN", afterMin: 45, note: "IP ranges null-routed; forced password resets for 214 flagged accounts." },
    ],
    indicators: ["203.0.113.66"], actor: admin,
  });

  // Triaged + notified malware at Amhara (latency 14 min — inside target)
  await createIncident({
    org: amhara, title: "Macro lure document opened by a compliance officer", titleAm: "በቅጥ አሳሽ የተከፈተ ማክሮ ማታለያ ሰነድ",
    description: "EDR flagged the NBE-circular lure document; endpoint isolated pending eradication.",
    category: "malware", severity: "high", source: "SOC_MONITOR", detectionMethod: "signature",
    detectedAt: new Date(now().getTime() - 1 * DAY), notifyMin: 14,
    steps: [
      { status: "triaged", field: "triagedAt", event: "TRIAGE", afterMin: 9, note: "Hash matched national feed EC-BUL-2026-048." },
    ],
    indicators: ["NBE_circular_2026_DBS-41.docm"], actor: admin,
  });

  // Detected, notified at 21 min (above target — keeps the median honest)
  await createIncident({
    org: cbe, title: "Slow DDoS probe against the internet-banking gateway", titleAm: "በበርና ግቢ በር ላይ ዝግተኛ የDDoS ሙከራ",
    description: "Low-and-slow volumetric pattern absorbed by scrubbing; monitoring continues.",
    category: "ddos", severity: "medium", source: "SOC_MONITOR", detectionMethod: "anomaly",
    detectedAt: new Date(now().getTime() - 10 * HOUR), notifyMin: 21,
    steps: [],
    indicators: ["192.0.2.140"], actor: admin,
  });

  // Detected, NOT yet notified — exercises the notify action + RQ3 flow
  const fresh = await createIncident({
    org: cbe, title: "Ransomware staging URL contacted by a branch workstation", titleAm: "በቅርንብ ሠራተኛ ኮምፒውተር የተጠራ የራንሶምዌር አድራሻ",
    description: "DNS log shows a workstation resolving the defanged staging URL from the TLP:RED national indicator; awaiting analyst confirmation before containment.",
    category: "ransomware", severity: "critical", source: "THREAT_MATCH", detectionMethod: "threat_intel_match",
    detectedAt: new Date(now().getTime() - 40 * MIN), notifyMin: null,
    steps: [], indicators: ["hxxp://198.51.100.23/nta-update.exe"], actor: admin,
  });
  console.log(`  → ${fresh.ref} left un-notified for the RQ3 notify flow`);

  const incCount = await db.incident.count();
  const indCount = await db.threatIndicator.count();
  console.log(`\nDone. ${indCount} indicator(s), ${incCount} incident(s) seeded.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
