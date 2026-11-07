import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();

async function main() {
  const orgs = await p.organization.findMany({ select: { id: true, name: true, sector: true, status: true } });
  const rules = await p.rule.count();
  const scans = await p.scan.count();
  console.log("orgs:", JSON.stringify(orgs, null, 1));
  console.log("rules:", rules, "| scans:", scans);
  await p.$disconnect();
}
main();
