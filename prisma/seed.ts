// Seed: regulatory frameworks + obligation catalogues + pilot organizations +
// demo scans evaluated by the engine.
//
// Frameworks:
//   PD-1321 — Personal Data Protection Proclamation No. 1321/2024 (47 rules)
//   NBE-IT  — NBE IT & Cybersecurity: SBB/83/2022 · MFI/33/2022 ·
//             Proclamation No. 1426/2026 critical-infrastructure duties (30 rules)
//
// USER-SAFE: organizations are upserted by slug (never deleted), so tenant
// users and their organization links survive re-seeding.
// Run: bun prisma/seed.ts
import { PrismaClient } from "@prisma/client";
import { RULES } from "../src/lib/compliance/rules-data";
import { NBE_RULES } from "../src/lib/compliance/nbe-rules-data";
import { evaluate, pillarConfFromJson, type PillarConf, type Answer } from "../src/lib/compliance/engine";
import { assertSeedAllowed } from "../scripts/seed-guard";

const db = new PrismaClient();

// D6 guard — refuses to seed a production DB without explicit opt-in
assertSeedAllowed("bootstrap");

function weightFor(severity: string): number {
  return severity === "critical" ? 3 : severity === "high" ? 2 : 1;
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48);
}

// ── Framework definitions ────────────────────────────────────────────────────
const FRAMEWORKS = [
  {
    code: "PD-1321",
    name: "Personal Data Protection",
    nameAm: "የግል ውሂብ ጥበቃ",
    issuer: "House of Peoples' Representatives",
    instrument: "Proclamation",
    instrumentNo: "No. 1321/2024",
    descriptionEn:
      "The 47 obligations of the Ethiopian Personal Data Protection Proclamation No. 1321/2024 — processing registers, lawful bases, data-subject rights, breach notification, penalties of up to 4% of global turnover, and data sovereignty.",
    descriptionAm:
      "የኢትዮጵያ የግል ውሂብ ጥበቃ አዋጅ ቁጥር 1321/2024 ማንነት — 47 ግዴታዎች፤ የማቀናበሪያ መዝገቦች፣ ሕጋዊ መሠረቶች፣ የውሂብ ባለቤት መብቶች፣ የጥሰት ማሳወቂያ እና የውሂብ ሉዓዊነት።",
    pillars: JSON.stringify([
      { name: "Legal", nameAm: "ሕጋዊ", weight: 0.35 },
      { name: "Technical", nameAm: "ቴክኒካል", weight: 0.3 },
      { name: "Organisational", nameAm: "ድርጅታዊ", weight: 0.2 },
      { name: "Awareness", nameAm: "ግንዛቤ", weight: 0.15 },
    ]),
    sectorScope: "all",
    sourceUrl: "https://chilot.me/wp-content/uploads/2024/10/Personal-Data-Protection-Proclamation-1321-2024.pdf",
    sortOrder: 1,
  },
  {
    code: "NBE-IT",
    name: "NBE IT & Cybersecurity",
    nameAm: "የኢትዮጵያ ብሔራዊ ባንክ አይቲና ሳይበር ደህንነት",
    issuer: "National Bank of Ethiopia",
    instrument: "Directive",
    instrumentNo: "SBB/83/2022 · MFI/33/2022 · Procl. 1426/2026",
    descriptionEn:
      "IT governance, automation, risk-management and cyber-security obligations for NBE-regulated banks (SBB/83/2022) and microfinance institutions (MFI/33/2022), extended with the critical-infrastructure duties of the Cybersecurity Proclamation No. 1426/2026 — including 48-hour National-CERT (Ethio-CERT) incident reporting.",
    descriptionAm:
      "ለብሔራዊ ባንክ የሚታዩ ባንኮች (SBB/83/2022) እና የማይክሮፋይናንስ ተቋማት (MFI/33/2022) የአይቲ አስተዳደር፣ ራስ-ሰርነት፣ የስጋት አስተዳደርና የሳይበር ደህንነት ግዴታዎች፤ በአዋጅ ቁጥር 1426/2026 የትልቅ መሠረተ ልማት ሚናዎች ተጨምረዋል — 48 ሰዓታዊ ወደ ኢትዮ-CERT ሪፖርትን ጨምሮ።",
    pillars: JSON.stringify([
      { name: "Governance", nameAm: "የአስተዳደር ሥርዓት", weight: 0.2 },
      { name: "Automation", nameAm: "ራስ-ሰርነት", weight: 0.15 },
      { name: "Risk Management", nameAm: "የስጋት አስተዳደር", weight: 0.25 },
      { name: "Cyber Security", nameAm: "የሳይበር ደህንነት", weight: 0.25 },
      { name: "Continuity", nameAm: "ቀጣይነትና መልሶ ማቋቋም", weight: 0.15 },
    ]),
    sectorScope: "banking",
    sourceUrl: "https://nbe.gov.et/wp-content/uploads/2023/09/SBB-83-2022.pdf",
    sortOrder: 2,
  },
];

// ── Organizations (upserted by slug — users and links preserved) ─────────────
const ORGS = [
  { name: "Commercial Bank of Ethiopia (CBE)", nameAm: "የኢትዮጵያ ንግድ ባንክ", sector: "Banking", tier: "enterprise", status: "pilot-complete", contactEmail: "info@cbe.com.et", notes: "Anchor pilot (proposal Table 34), Phase 1 + 2" },
  { name: "Dashen Bank", nameAm: "ዳሼን ባንክ", sector: "Banking", tier: "enterprise", status: "active", contactEmail: "info@dashen.com.et", notes: "Anchor pilot (proposal Table 34), Phase 1 + 2 + 5" },
  { name: "Wasasa MFI", nameAm: "ዋሳሳ አ.ተ.መ.ጠ", sector: "Microfinance", tier: "mid-market", status: "pilot-complete", contactEmail: "info@wasasamfi.com", notes: "MFI pilot (proposal Table 34)" },
  { name: "Oromia MFI", nameAm: "ኦሮሚያ አ.ተ.መ.ጠ", sector: "Microfinance", tier: "enterprise", status: "onboarding", contactEmail: "info@oromiamefi.com", notes: "MFI pilot (proposal Table 34)" },
  { name: "Amhara MFI", nameAm: "አማራ አ.ተ.መ.ጠ", sector: "Microfinance", tier: "enterprise", status: "onboarding", contactEmail: "info@amharamfi.com", notes: "MFI pilot (proposal Table 34)" },
  { name: "Ethio Telecom", nameAm: "ኢትዮ ቴሌኮም", sector: "Telecom", tier: "enterprise", status: "onboarding", contactEmail: "security@ethiotelecom.et", notes: "Pilot partner + hosting/sovereignty alliance" },
];

async function main() {
  // 1. Frameworks (upsert by code)
  console.log("Seeding regulatory frameworks…");
  for (const f of FRAMEWORKS) {
    await db.framework.upsert({ where: { code: f.code }, create: f, update: f });
  }
  console.log(`  ${FRAMEWORKS.length} frameworks upserted`);

  // 2. Wipe scans (results cascade), then rebuild each framework's rule set.
  //    Scans are demo data; rules are fully derived from the seed files.
  console.log("Rebuilding rule catalogues…");
  await db.scanResult.deleteMany();
  await db.scan.deleteMany();
  await db.rule.deleteMany();

  const catalogues: Record<string, { rules: typeof RULES; conf: PillarConf }> = {};
  for (const f of FRAMEWORKS) {
    const fw = await db.framework.findUniqueOrThrow({ where: { code: f.code } });
    const seeds = f.code === "PD-1321" ? RULES : NBE_RULES;
    for (const r of seeds) {
      await db.rule.create({
        data: {
          code: r.code,
          frameworkId: fw.id,
          sortOrder: r.sortOrder,
          article: r.article,
          articleSubject: r.articleSubject,
          titleEn: r.titleEn,
          titleAm: r.titleAm,
          statementEn: r.statementEn,
          statementAm: r.statementAm,
          questionEn: r.questionEn,
          questionAm: r.questionAm,
          checkLogic: r.checkLogic,
          remediationEn: r.remediationEn,
          remediationAm: r.remediationAm,
          pillar: r.pillar,
          severity: r.severity,
          priority: r.priority,
          penaltyRef: r.penaltyRef,
          weight: weightFor(r.severity),
        },
      });
    }
    catalogues[f.code] = { rules: seeds, conf: pillarConfFromJson(fw.pillars) };
    console.log(`  ${f.code}: ${seeds.length} obligations`);
  }

  // 3. Organizations — upsert by slug (preserves ids → tenant users keep links)
  console.log("Upserting organizations…");
  for (const o of ORGS) {
    const slug = slugify(o.name);
    const existing = await db.organization.findUnique({ where: { slug } });
    if (existing) {
      await db.organization.update({ where: { id: existing.id }, data: o });
    } else {
      await db.organization.create({ data: { ...o, slug } });
    }
  }
  console.log(`  ${ORGS.length} organizations ensured`);

  // 4. Demo scans per framework
  // PD-1321 — CBE: strong posture, sovereignty + rights gaps (realistic mix)
  const cbePd: Record<string, Answer> = {
    "ART2-01": "yes", "ART2-02": "yes", "ART2-03": "partial", "ART2-04": "yes",
    "ART2-05": "yes", "ART2-06": "partial", "ART2-07": "yes", "ART2-08": "yes",
    "ART6-01": "yes", "ART6-02": "yes", "ART6-03": "partial", "ART6-04": "yes",
    "ART6-05": "yes", "ART6-06": "yes", "ART6-07": "partial",
    "ART7-01": "yes",
    "ART8-01": "yes", "ART8-02": "yes", "ART8-03": "yes", "ART8-04": "partial", "ART8-05": "yes",
    "ART9-01": "yes", "ART9-02": "yes", "ART9-03": "yes", "ART9-04": "yes",
    "ART11-01": "partial", "ART11-02": "yes", "ART11-03": "no",
    "ART15-01": "yes", "ART15-02": "yes", "ART15-03": "partial",
    "ART17-01": "yes", "ART17-02": "yes", "ART17-03": "partial",
    "ART22-01": "partial", "ART22-02": "no", "ART22-03": "partial",
    "ART24-01": "partial", "ART24-02": "partial", "ART24-03": "no", "ART24-04": "partial",
    "ART24-05": "yes", "ART24-06": "yes", "ART24-07": "yes",
    "ART43-01": "yes", "ART43-02": "yes",
    "ART52-01": "partial",
  };

  // PD-1321 — Wasasa MFI: weaker posture (typical pre-audit MFI)
  const wasasaPd: Record<string, Answer> = {
    "ART2-01": "partial", "ART2-02": "no", "ART2-03": "no", "ART2-04": "partial",
    "ART2-05": "yes", "ART2-06": "partial", "ART2-07": "no", "ART2-08": "partial",
    "ART6-01": "partial", "ART6-02": "partial", "ART6-03": "partial", "ART6-04": "yes",
    "ART6-05": "partial", "ART6-06": "partial", "ART6-07": "no",
    "ART7-01": "partial",
    "ART8-01": "yes", "ART8-02": "partial", "ART8-03": "no", "ART8-04": "partial", "ART8-05": "no",
    "ART9-01": "partial", "ART9-02": "no", "ART9-03": "partial", "ART9-04": "partial",
    "ART11-01": "na", "ART11-02": "na", "ART11-03": "na",
    "ART15-01": "partial", "ART15-02": "no", "ART15-03": "no",
    "ART17-01": "yes", "ART17-02": "yes", "ART17-03": "partial",
    "ART22-01": "yes", "ART22-02": "yes", "ART22-03": "partial",
    "ART24-01": "partial", "ART24-02": "no", "ART24-03": "no", "ART24-04": "partial",
    "ART24-05": "partial", "ART24-06": "yes", "ART24-07": "no",
    "ART43-01": "partial", "ART43-02": "partial",
    "ART52-01": "no",
  };

  // NBE-IT — CBE: mostly compliant bank; 48h CERT reporting + corrective SLAs strong,
  // Fayda linkage and certification renewals lagging
  const cbeNbe: Record<string, Answer> = {
    "NBE-01": "yes", "NBE-02": "yes", "NBE-03": "yes", "NBE-04": "yes",
    "NBE-05": "yes", "NBE-06": "yes", "NBE-07": "partial",
    "NBE-08": "yes", "NBE-09": "yes", "NBE-10": "partial", "NBE-11": "partial",
    "NBE-12": "yes", "NBE-13": "yes", "NBE-14": "yes", "NBE-15": "yes",
    "NBE-16": "yes", "NBE-17": "yes", "NBE-18": "partial",
    "NBE-19": "yes", "NBE-20": "yes", "NBE-21": "partial", "NBE-22": "partial",
    "NBE-23": "yes", "NBE-24": "yes", "NBE-25": "yes",
    "NBE-26": "yes", "NBE-27": "yes", "NBE-28": "yes", "NBE-29": "partial",
    "NBE-30": "yes",
  };

  // NBE-IT — Dashen: governance in place, DR/BCP gaps and certification missing
  const dashenNbe: Record<string, Answer> = {
    "NBE-01": "yes", "NBE-02": "yes", "NBE-03": "yes", "NBE-04": "yes",
    "NBE-05": "partial", "NBE-06": "yes", "NBE-07": "partial",
    "NBE-08": "yes", "NBE-09": "partial", "NBE-10": "partial", "NBE-11": "no",
    "NBE-12": "yes", "NBE-13": "partial", "NBE-14": "yes", "NBE-15": "partial",
    "NBE-16": "yes", "NBE-17": "partial", "NBE-18": "partial",
    "NBE-19": "partial", "NBE-20": "partial", "NBE-21": "no", "NBE-22": "no",
    "NBE-23": "partial", "NBE-24": "partial", "NBE-25": "yes",
    "NBE-26": "partial", "NBE-27": "partial", "NBE-28": "partial", "NBE-29": "no",
    "NBE-30": "partial",
  };

  async function seedScan(
    orgName: string, frameworkCode: string, scanName: string,
    overrides: Record<string, Answer>, daysAgo: number, minutes: number, remediatedTop: number
  ) {
    const org = await db.organization.findFirstOrThrow({ where: { name: { contains: orgName } } });
    const fw = await db.framework.findUniqueOrThrow({ where: { code: frameworkCode } });
    const { rules: seeds, conf } = catalogues[frameworkCode];

    const answers = seeds.map((r) => ({
      ruleCode: r.code,
      answer: overrides[r.code] ?? "partial",
    }));
    const engineRules = seeds.map((r) => ({
      code: r.code, article: r.article, titleEn: r.titleEn, titleAm: r.titleAm,
      statementEn: r.statementEn, statementAm: r.statementAm,
      remediationEn: r.remediationEn, remediationAm: r.remediationAm,
      pillar: r.pillar, severity: r.severity, penaltyRef: r.penaltyRef,
      weight: weightFor(r.severity),
    }));
    const out = evaluate(engineRules, answers, conf);
    const startedAt = new Date(Date.now() - daysAgo * 24 * 3600 * 1000);
    const completedAt = new Date(startedAt.getTime() + minutes * 60 * 1000);

    const scan = await db.scan.create({
      data: {
        organizationId: org.id,
        frameworkId: fw.id,
        name: scanName,
        status: "complete",
        auditorName: "Adwa Compliance Engine v1.1",
        overallScore: out.overallScore,
        pillarScores: JSON.stringify(out.pillarScores),
        findingsCount: out.findingsCount,
        criticalFindings: out.criticalFindings,
        startedAt,
        completedAt,
        durationMinutes: minutes,
      },
    });

    const dbRules = await db.rule.findMany({
      where: { frameworkId: fw.id },
      orderBy: { sortOrder: "asc" },
    });
    for (let i = 0; i < dbRules.length; i++) {
      const r = dbRules[i];
      const res = out.results[i];
      const planIdx = out.remediationPlan.findIndex((p) => p.code === r.code);
      const status =
        res.isFinding && planIdx >= 0 && planIdx < remediatedTop
          ? planIdx < remediatedTop / 2 ? "remediated" : "in_progress"
          : "open";
      await db.scanResult.create({
        data: {
          scanId: scan.id,
          ruleId: r.id,
          answer: res.answer,
          // Seeded scans are complete evaluations — every answer is explicit.
          answeredAt: scan.completedAt ?? new Date(),
          evidenceNote:
            res.answer === "yes"
              ? "Evidence pack verified by engine (configuration export + policy document)."
              : res.answer === "na"
                ? "Not applicable — no such processing at this organisation."
                : "Gap identified by engine check; see remediation plan.",
          score: res.score,
          riskRank: res.riskRank,
          findingEn: res.findingEn,
          findingAm: res.findingAm,
          status,
        },
      });
    }
    console.log(
      `  scan "${scanName}" [${frameworkCode}] — score ${out.overallScore}%, ${out.findingsCount} findings (${out.criticalFindings} critical), ${minutes} min`
    );
  }

  await seedScan("Commercial Bank of Ethiopia", "PD-1321", "Q4 full compliance audit — 47 rules", cbePd, 9, 38, 6);
  await seedScan("Wasasa MFI", "PD-1321", "Baseline compliance assessment — 47 rules", wasasaPd, 3, 24, 4);
  await seedScan("Commercial Bank of Ethiopia", "NBE-IT", "NBE IT & cyber-security audit — 30 obligations", cbeNbe, 6, 31, 5);
  await seedScan("Dashen Bank", "NBE-IT", "NBE supervisory readiness check — 30 obligations", dashenNbe, 2, 27, 3);

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
