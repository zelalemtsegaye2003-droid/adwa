import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
await db.user.updateMany({ data: { failedAttempts: 0, lockedUntil: null } });
console.log("✓ failedAttempts/lockedUntil reset for all users");
await db.$disconnect();
