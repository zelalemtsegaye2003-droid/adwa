/**
 * Re-encrypt the seeded officer's TOTP secret under the current AUTH_SECRET
 * (needed after AUTH_SECRET rotation — AES-256-GCM key is derived from it).
 */
import { PrismaClient } from "@prisma/client";
import { encryptSecret } from "../src/lib/auth/crypto";

const OFFICER = "officer@cbe.com.et";
// The TOTP seed the test-suite expects (matches Google Authenticator entry).
const SEED = "UPRWOJXX2JVEYGDRDDXSWXDGCDIJLNLD";

const db = new PrismaClient();
const user = await db.user.findUnique({ where: { email: OFFICER } });
if (!user) throw new Error("officer not found — run scripts/seed-users.ts first");
if (!user.mfaEnabled) throw new Error("officer MFA not enabled");

await db.user.update({
  where: { id: user.id },
  data: { mfaSecret: encryptSecret(SEED), mfaConfirmedAt: new Date() },
});
console.log("✓ officer TOTP secret re-encrypted under current AUTH_SECRET");
await db.$disconnect();
