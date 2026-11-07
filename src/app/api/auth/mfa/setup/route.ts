import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth/guard";
import { generateTotpSecret, otpauthUrl, storeSecret, ISSUER } from "@/lib/auth/totp";
import { audit } from "@/lib/auth/audit";
import { clientIp } from "@/lib/auth/rate-limit";

/**
 * POST /api/auth/mfa/setup — begin MFA enrollment.
 * Generates a TOTP secret (stored encrypted, not yet active) and returns
 * a QR data-URL + otpauth:// URI for authenticator apps.
 */
export async function POST(req: NextRequest) {
  const guard = await requireAuth(req);
  if (guard.error) return guard.error;
  const { user } = guard;

  const full = await db.user.findUnique({ where: { id: user.id } });
  if (!full) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "User not found." } }, { status: 404 });
  }
  if (full.mfaEnabled) {
    return NextResponse.json(
      { error: { code: "MFA_ALREADY_ENABLED", message: "MFA is already enabled. Disable it first to re-enroll." } },
      { status: 409 }
    );
  }

  const secret = generateTotpSecret();
  await db.user.update({
    where: { id: user.id },
    data: { mfaSecret: storeSecret(secret), mfaConfirmedAt: null },
  });

  const uri = otpauthUrl(secret, user.email);
  const qrDataUrl = await QRCode.toDataURL(uri, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 240,
    color: { dark: "#064e3b", light: "#ffffff" }, // emerald-900 on white
  });

  await audit({
    type: "MFA_ENROLLMENT_STARTED",
    userId: user.id,
    email: user.email,
    organizationId: user.orgId,
    ip: clientIp(req.headers),
    detail: "MFA enrollment started (secret generated, pending confirmation).",
  });

  return NextResponse.json({
    secret,
    otpauthUrl: uri,
    qrDataUrl,
    issuer: ISSUER,
    account: user.email,
    instructions:
      "Scan the QR code with Google Authenticator / Authy / Aegis (or enter the key manually), then confirm with the current 6-digit code.",
  });
}
