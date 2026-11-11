import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
console.log("evidenceLinks:", await db.evidenceLink.count());
console.log("evidence docs:", await db.evidenceDocument.count());
const perRule = await db.evidenceLink.groupBy({ by: ["ruleId"], _count: true });
console.log("rules with links:", perRule.length);
await db.$disconnect();
