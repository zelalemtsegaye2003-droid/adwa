import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth/guard";
import { decryptSecret } from "@/lib/auth/crypto";
import { verifyTotp, generateBackupCodes } from "@/lib/auth/totp";
import { audit } from "@/lib/auth/audit";
import { clientIp } from "@/lib/auth/rate-limit";

interface EnableBody {
  code?: string;
}

/**
 * POST /api/auth/mfa/enable — confirm MFA enrollment.
 * Verifies a live TOTP code, activates MFA and returns one-time backup codes
 * (shown exactly once).
 */
export async function POST(req: NextRequest) {
  const guard = await requireAuth(req);
  if (guard.error) return guard.error;
  const { user } = guard;

  let body: EnableBody;
  try {
    body = (await req.json()) as EnableBody;
  } catch {
    return NextResponse.json(
      { error: { code: "INVALID_JSON", message: "Request body must be valid JSON." } },
      { status: 400 }
    );
  }

  const full = await db.user.findUnique({ where: { id: user.id } });
  if (!full) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "User not found." } }, { status: 404 });
  }
  if (full.mfaEnabled) {
    return NextResponse.json(
      { error: { code: "MFA_ALREADY_ENABLED", message: "MFA is already enabled." } },
      { status: 409 }
    );
  }
  if (!full.mfaSecret) {
    return NextResponse.json(
      { error: { code: "NO_PENDING_ENROLLMENT", message: "Start enrollment with /api/auth/mfa/setup first." } },
      { status: 400 }
    );
  }

  let secret: string;
  try {
    secret = decryptSecret(full.mfaSecret);
  } catch {
    return NextResponse.json(
      { error: { code: "SECRET_ERROR", message: "Stored secret unreadable. Restart enrollment." } },
      { status: 500 }
    );
  }

  if (!verifyTotp(secret, body.code ?? "")) {
    await audit({
      type: "MFA_FAILED",
      userId: user.id,
      email: user.email,
      organizationId: user.orgId,
      ip: clientIp(req.headers),
      detail: "Enrollment confirmation failed (wrong code).",
    });
    return NextResponse.json(
      { error: { code: "MFA_CODE_INVALID", message: "That code did not match. Check the app and try again." } },
      { status: 400 }
    );
  }

  const backup = generateBackupCodes();
  await db.user.update({
    where: { id: user.id },
    data: {
      mfaEnabled: true,
      mfaConfirmedAt: new Date(),
      backupCodes: JSON.stringify(backup.hashed),
    },
  });

  await audit({
    type: "MFA_ENABLED",
    userId: user.id,
    email: user.email,
    organizationId: user.orgId,
    ip: clientIp(req.headers),
    detail: "MFA activated (TOTP). 10 backup codes issued.",
  });

  return NextResponse.json({
    enabled: true,
    backupCodes: backup.plain,
    notice: "Store these backup codes securely — they will never be shown again.",
  });
}
