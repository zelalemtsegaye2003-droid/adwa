/** Clean leftover test artifacts and re-verify seed state. */
import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();

async function main() {
  // Remove test-created users/orgs from earlier failed runs
  const del = await db.user.deleteMany({
    where: {
      OR: [
        { email: { startsWith: "temp" } },
        { email: { startsWith: "tempx" } },
        { email: { startsWith: "locktest" } },
        { email: { startsWith: "esc" } },
        { email: { startsWith: "founder" } },
        { email: { startsWith: "evil" } },
      ],
    },
  });
  await db.organization.deleteMany({ where: { name: "Test MFI" } });
  // Clear used captcha challenges + old auth events noise from testing
  await db.captchaChallenge.deleteMany({});
  await db.authEvent.deleteMany({});
  await db.refreshToken.deleteMany({});
  // Unlock any locked accounts
  await db.user.updateMany({ data: { failedAttempts: 0, lockedUntil: null } });

  console.log("deleted test users:", del.count);
  const users = await db.user.findMany({
    select: { email: true, role: true, mfaEnabled: true, status: true },
    orderBy: { createdAt: "asc" },
  });
  for (const u of users) console.log(`  ${u.email.padEnd(28)} ${u.role.padEnd(19)} mfa=${u.mfaEnabled} ${u.status}`);
  console.log("orgs:", await db.organization.count(), "| rules:", await db.rule.count(), "| scans:", await db.scan.count());
  await db.$disconnect();
}
main();
