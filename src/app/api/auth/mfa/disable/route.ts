import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth/guard";
import { verifyPassword, decryptSecret } from "@/lib/auth/crypto";
import { verifyTotp } from "@/lib/auth/totp";
import { revokeAllSessions, clearAuthCookies } from "@/lib/auth/session";
import { audit } from "@/lib/auth/audit";
import { clientIp } from "@/lib/auth/rate-limit";

interface DisableBody {
  password?: string;
  code?: string;
}

/**
 * POST /api/auth/mfa/disable — turn MFA off.
 * Requires BOTH the account password and a valid TOTP/backup code
 * (re-authentication), then revokes all sessions.
 */
export async function POST(req: NextRequest) {
  const guard = await requireAuth(req);
  if (guard.error) return guard.error;
  const { user } = guard;

  let body: DisableBody;
  try {
    body = (await req.json()) as DisableBody;
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
  if (!full.mfaEnabled) {
    return NextResponse.json(
      { error: { code: "MFA_NOT_ENABLED", message: "MFA is not enabled for this account." } },
      { status: 400 }
    );
  }

  // Re-auth factor 1: password.
  if (!full.passwordHash || !verifyPassword(body.password ?? "", full.passwordHash)) {
    return NextResponse.json(
      { error: { code: "PASSWORD_INVALID", message: "Password incorrect." } },
      { status: 401 }
    );
  }

  // Re-auth factor 2: current TOTP code (backup codes not accepted here).
  let ok = false;
  if (full.mfaSecret) {
    try {
      ok = verifyTotp(decryptSecret(full.mfaSecret), body.code ?? "");
    } catch {
      ok = false;
    }
  }
  if (!ok) {
    return NextResponse.json(
      { error: { code: "MFA_CODE_INVALID", message: "Invalid or expired code." } },
      { status: 401 }
    );
  }

  await db.user.update({
    where: { id: user.id },
    data: {
      mfaEnabled: false,
      mfaSecret: null,
      mfaConfirmedAt: null,
      backupCodes: null,
    },
  });
  await revokeAllSessions(user.id); // force re-login everywhere

  await audit({
    type: "MFA_DISABLED",
    userId: user.id,
    email: user.email,
    organizationId: user.orgId,
    ip: clientIp(req.headers),
    detail: "MFA disabled after password+TOTP re-authentication. All sessions revoked.",
  });

  const res = NextResponse.json({ enabled: false });
  clearAuthCookies(res); // current session was revoked too
  return res;
}
