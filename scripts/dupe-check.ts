import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
const dupes = await db.$queryRaw<Array<{learnerId: string; kind: string; c: BigInt}>>`
  SELECT "learnerId", kind, COUNT(*) as c FROM "AwarenessAssessment"
  GROUP BY "learnerId", kind HAVING COUNT(*) > 1 LIMIT 5`;
console.log("duplicate (learnerId,kind) sittings:", dupes.length, dupes.map(d => `${d.learnerId}:${d.kind}x${d.c}`).join(", "));
const total = await db.awarenessAssessment.count();
const naStale = await db.scanResult.count({ where: { answer: "na" } });
const scans = await db.scan.count();
console.log(`assessments=${total} scanResults(answer=na)=${naStale} scans=${scans}`);
await db.$disconnect();
