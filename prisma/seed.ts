// Seed: 47 rules + pilot organizations + two demo scans evaluated by the engine.
// Run: bun prisma/seed.ts
import { PrismaClient } from "@prisma/client";
import { RULES } from "../src/lib/rules-data";
import { evaluate, type Answer } from "../src/lib/engine";

const db = new PrismaClient();

function weightFor(severity: string): number {
  return severity === "critical" ? 3 : severity === "high" ? 2 : 1;
}

async function main() {
  console.log("Seeding rule catalogue…");
  await db.scanResult.deleteMany();
  await db.scan.deleteMany();
  await db.rule.deleteMany();
  await db.organization.deleteMany();

  for (const r of RULES) {
    await db.rule.create({
      data: {
        code: r.code,
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
  console.log(`  ${RULES.length} rules inserted`);

  const orgs = [
    { name: "Commercial Bank of Ethiopia (CBE)", nameAm: "የኢትዮጵያ ንግድ ባንክ", sector: "Banking", tier: "enterprise", status: "pilot-complete", contactEmail: "ciso@cbe.com.et", notes: "Anchor pilot (proposal Table 34), Phase 1 + 2" },
    { name: "Dashen Bank", nameAm: "ዳሼን ባንክ", sector: "Banking", tier: "enterprise", status: "active", contactEmail: "security@dashenbank.com", notes: "Anchor pilot (proposal Table 34), Phase 1 + 2 + 5" },
    { name: "Wasasa MFI", nameAm: "ዋሳሳ አ.ተ.መ.ጠ", sector: "Microfinance", tier: "mid-market", status: "pilot-complete", contactEmail: "info@wasasamfi.com", notes: "MFI pilot (proposal Table 34)" },
    { name: "Oromia MFI", nameAm: "ኦሮሚያ አ.ተ.መ.ጠ", sector: "Microfinance", tier: "enterprise", status: "onboarding", contactEmail: "info@oromiamefi.com", notes: "MFI pilot (proposal Table 34)" },
    { name: "Amhara MFI", nameAm: "አማራ አ.ተ.መ.ጠ", sector: "Microfinance", tier: "enterprise", status: "onboarding", contactEmail: "info@amharamfi.com", notes: "MFI pilot (proposal Table 34)" },
    { name: "Ethio Telecom", nameAm: "ኢትዮ ቴሌኮም", sector: "Telecom", tier: "enterprise", status: "onboarding", contactEmail: "security@ethiotelecom.et", notes: "Pilot partner + hosting/sovereignty alliance" },
  ];
  for (const o of orgs) await db.organization.create({ data: o });
  console.log(`  ${orgs.length} organizations inserted`);

  const rules = await db.rule.findMany({ orderBy: { sortOrder: "asc" } });
  const engineRules = rules.map((r) => ({
    code: r.code, article: r.article, titleEn: r.titleEn, titleAm: r.titleAm,
    statementEn: r.statementEn, statementAm: r.statementAm,
    remediationEn: r.remediationEn, remediationAm: r.remediationAm,
    pillar: r.pillar, severity: r.severity, penaltyRef: r.penaltyRef, weight: r.weight,
  }));

  // Demo scan 1 — CBE: strong posture, sovereignty + rights gaps (realistic mix)
  const cbeOverrides: Record<string, Answer> = {
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

  // Demo scan 2 — Wasasa MFI: weaker posture (typical pre-audit MFI)
  const wasasaOverrides: Record<string, Answer> = {
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

  async function seedScan(
    orgName: string, scanName: string, overrides: Record<string, Answer>,
    daysAgo: number, minutes: number, remediatedTop: number
  ) {
    const org = await db.organization.findFirstOrThrow({ where: { name: { contains: orgName } } });
    const answers = rules.map((r) => ({
      ruleCode: r.code,
      answer: overrides[r.code] ?? "partial",
    }));
    const out = evaluate(engineRules, answers);
    const startedAt = new Date(Date.now() - daysAgo * 24 * 3600 * 1000);
    const completedAt = new Date(startedAt.getTime() + minutes * 60 * 1000);

    const scan = await db.scan.create({
      data: {
        organizationId: org.id,
        name: scanName,
        status: "complete",
        auditorName: "Adwa Compliance Engine v1.0",
        overallScore: out.overallScore,
        pillarScores: JSON.stringify(out.pillarScores),
        findingsCount: out.findingsCount,
        criticalFindings: out.criticalFindings,
        startedAt,
        completedAt,
        durationMinutes: minutes,
      },
    });

    for (let i = 0; i < rules.length; i++) {
      const r = rules[i];
      const res = out.results[i];
      // remediate the top-N highest-risk findings to populate tracking states
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
      `  scan "${scanName}" — score ${out.overallScore}%, ${out.findingsCount} findings (${out.criticalFindings} critical), ${minutes} min`
    );
  }

  await seedScan("Commercial Bank of Ethiopia", "Q4 full compliance audit — 47 rules", cbeOverrides, 9, 38, 6);
  await seedScan("Wasasa MFI", "Baseline compliance assessment — 47 rules", wasasaOverrides, 3, 24, 4);

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
