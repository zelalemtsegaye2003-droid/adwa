import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
const scans = await db.scan.findMany({ select: { id: true, name: true, status: true, startedAt: true }, orderBy: { startedAt: "asc" } });
console.log(`scans: ${scans.length}`);
for (const s of scans) console.log(`  ${s.name} [${s.status}] ${s.startedAt.toISOString().slice(0, 16)}`);
const ev = await db.evidenceDocument.count();
const rules = await db.rule.count();
console.log(`evidence: ${ev}, rules: ${rules}`);
await db.$disconnect();
