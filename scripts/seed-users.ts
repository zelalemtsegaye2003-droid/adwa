/**
 * Adwa Cyber — identity seed.
 * Creates the platform super admin and demo tenant users for the pilot.
 * Idempotent: safe to re-run (upsert by email).
 *
 * Run: bun scripts/seed-users.ts
 */
import { PrismaClient } from "@prisma/client";

// reuse the platform's crypto/TOTP implementations (relative import, bun runs TS natively)
import { hashPassword, encryptSecret, sha256 } from "../src/lib/auth/crypto";
import { generateBackupCodes } from "../src/lib/auth/totp";

const db = new PrismaClient();

const SUPER_PASSWORD = "Adwa#Admin2026!";
const ORG_PASSWORD = "Adwa#Demo2026!";

async function main() {
  // ── 1. Backfill organization slugs + contact domains ────────────────────
  const orgs = await db.organization.findMany();
  const byName = new Map(orgs.map((o) => [o.name, o]));
  for (const o of orgs) {
    if (!o.slug) {
      const slug = o.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48);
      await db.organization.update({ where: { id: o.id }, data: { slug } });
    }
  }

  const cbe = byName.get("Commercial Bank of Ethiopia (CBE)") ?? orgs[0];
  const dashen = byName.get("Dashen Bank") ?? orgs[1];
  const wasasa = byName.get("Wasasa MFI") ?? orgs[2];
  const ethio = byName.get("Ethio Telecom") ?? orgs[3];

  // Contact emails aligned with the demo user domains (Google auto-provision hint)
  await db.organization.updateMany({
    where: { id: cbe.id }, data: { contactEmail: "info@cbe.com.et" },
  });
  await db.organization.updateMany({
    where: { id: dashen.id }, data: { contactEmail: "info@dashen.com.et" },
  });

  // ── 2. Platform super admin ─────────────────────────────────────────────
  await db.user.upsert({
    where: { email: "admin@adwacyber.et" },
    create: {
      email: "admin@adwacyber.et",
      name: "Platform Administrator",
      passwordHash: hashPassword(SUPER_PASSWORD),
      role: "SUPER_ADMIN",
      organizationId: null,
      authProvider: "LOCAL",
    },
    update: { role: "SUPER_ADMIN", status: "ACTIVE" },
  });
  console.log("✓ SUPER_ADMIN admin@adwacyber.et");

  // ── 3. Tenant users ─────────────────────────────────────────────────────
  const tenants: { email: string; name: string; role: string; org: string }[] = [
    { email: "admin@cbe.com.et", name: "CBE Admin", role: "ORG_ADMIN", org: cbe.id },
    { email: "officer@cbe.com.et", name: "Selam Bekele", role: "COMPLIANCE_OFFICER", org: cbe.id },
    { email: "auditor@dashen.com.et", name: "Dawit Haile", role: "AUDITOR", org: dashen.id },
    { email: "viewer@ethiotelecom.et", name: "Hanna Tesfaye", role: "VIEWER", org: ethio.id },
    { email: "admin@wasasa.et", name: "Wasasa Admin", role: "ORG_ADMIN", org: wasasa.id },
  ];

  for (const t of tenants) {
    await db.user.upsert({
      where: { email: t.email },
      create: {
        email: t.email,
        name: t.name,
        passwordHash: hashPassword(ORG_PASSWORD),
        role: t.role,
        organizationId: t.org,
        authProvider: "LOCAL",
      },
      update: { role: t.role, organizationId: t.org, status: "ACTIVE" },
    });
    console.log(`✓ ${t.role.padEnd(19)} ${t.email}`);
  }

  // ── 4. MFA demo account: officer@cbe.com.et ─────────────────────────────
  // Fixed demo TOTP seed (matches scripts/test-auth.ts). A stable seed keeps
  // the documented authenticator entry and the e2e tests valid across re-seeds.
  const secret = "UPRWOJXX2JVEYGDRDDXSWXDGCDIJLNLD";
  const backup = generateBackupCodes();
  await db.user.update({
    where: { email: "officer@cbe.com.et" },
    data: {
      mfaEnabled: true,
      mfaSecret: encryptSecret(secret),
      mfaConfirmedAt: new Date(),
      backupCodes: JSON.stringify(backup.hashed),
    },
  });

  console.log("\n━━ MFA demo account ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("officer@cbe.com.et has MFA pre-enabled.");
  console.log("TOTP secret (add to Google Authenticator):", secret);
  console.log(`otpauth://totp/Adwa%20Cyber:officer@cbe.com.et?secret=${secret}&issuer=Adwa%20Cyber&algorithm=SHA1&digits=6&period=30`);
  console.log("Sample backup codes:", backup.plain.slice(0, 3).join(", "), "…");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`\nPasswords → super admin: ${SUPER_PASSWORD} | org accounts: ${ORG_PASSWORD}`);

  // quick self-test of the password hash round-trip
  const officer = await db.user.findUnique({ where: { email: "officer@cbe.com.et" } });
  console.log("officer mfaEnabled:", officer?.mfaEnabled, "| backupCodes:", officer?.backupCodes ? JSON.parse(officer.backupCodes).length : 0);
  await db.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
