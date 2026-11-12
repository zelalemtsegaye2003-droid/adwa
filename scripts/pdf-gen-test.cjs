// Standalone generator test — renders the seeded CBE Q4 scan to EN + AM PDFs.
const { PrismaClient } = require("@prisma/client");
const db = new PrismaClient();
const { generateReportPdf } = require("/home/z/my-project/src/lib/report-pdf.ts");

(async () => {
  const scan = await db.scan.findFirst({
    where: { status: "complete", name: { contains: "Q4 full compliance" } },
    include: {
      organization: { select: { name: true, nameAm: true, sector: true } },
      framework: { select: { code: true, name: true, nameAm: true, instrumentNo: true, issuer: true } },
      results: {
        include: { rule: { select: { code: true, titleEn: true, titleAm: true, remediationEn: true, remediationAm: true, severity: true, article: true, penaltyRef: true, pillar: true } } },
        orderBy: { riskRank: "desc" },
      },
    },
  });
  if (!scan) { console.log("no scan found"); process.exit(1); }
  console.log("scan:", scan.name, "| org:", scan.organization.name, "| findings:", scan.findingsCount);

  for (const lang of ["en", "am"]) {
    const { buffer, hash, pages } = await generateReportPdf(scan, lang);
    const fs = require("fs");
    fs.writeFileSync(`/tmp/report-test-${lang}.pdf`, buffer);
    console.log(`${lang}: ${pages} page(s), ${buffer.length} bytes, hash=${hash}`);
  }
  await db.$disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
