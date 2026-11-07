import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyMfaToken } from "@/lib/auth/jwt";
import { decryptSecret } from "@/lib/auth/crypto";
import { verifyTotp, matchBackupCode } from "@/lib/auth/totp";
import { issueSession, setAuthCookies } from "@/lib/auth/session";
import { audit } from "@/lib/auth/audit";
import { rateLimit, clientIp } from "@/lib/auth/rate-limit";

interface MfaVerifyBody {
  mfaToken?: string;
  code?: string;
}

/**
 * POST /api/auth/mfa/verify — step 2 of authentication.
 * Exchanges the 5-minute mfaToken + TOTP/backup code for a full session.
 */
export async function POST(req: NextRequest) {
  const ip = clientIp(req.headers);
  let body: MfaVerifyBody;
  try {
    body = (await req.json()) as MfaVerifyBody;
  } catch {
    return NextResponse.json(
      { error: { code: "INVALID_JSON", message: "Request body must be valid JSON." } },
      { status: 400 }
    );
  }

  const rl = rateLimit(`mfa:${ip}`, 15, 5 * 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: { code: "RATE_LIMITED", message: "Too many MFA attempts. Please wait." } },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } }
    );
  }

  const claims = body.mfaToken ? await verifyMfaToken(body.mfaToken) : null;
  if (!claims) {
    return NextResponse.json(
      { error: { code: "MFA_TOKEN_INVALID", message: "Challenge expired — please sign in again." } },
      { status: 401 }
    );
  }

  const user = await db.user.findUnique({
    where: { id: claims.sub },
    include: { organization: { select: { id: true, name: true } } },
  });
  if (!user || user.status !== "ACTIVE" || !user.mfaEnabled || !user.mfaSecret) {
    return NextResponse.json(
      { error: { code: "MFA_NOT_APPLICABLE", message: "MFA is not active for this account." } },
      { status: 400 }
    );
  }

  const code = body.code?.trim() ?? "";
  let passed = false;
  let usedBackupIndex = -1;

  try {
    const secret = decryptSecret(user.mfaSecret);
    passed = verifyTotp(secret, code);
  } catch {
    passed = false;
  }

  if (!passed && user.backupCodes) {
    try {
      const stored = JSON.parse(user.backupCodes) as string[];
      usedBackupIndex = matchBackupCode(stored, code);
      if (usedBackupIndex >= 0) {
        // Consume the backup code (one-time use).
        stored.splice(usedBackupIndex, 1);
        await db.user.update({
          where: { id: user.id },
          data: { backupCodes: JSON.stringify(stored) },
        });
        passed = true;
      }
    } catch {
      /* invalid JSON backup codes — ignore */
    }
  }

  if (!passed) {
    await audit({
      type: "MFA_FAILED",
      userId: user.id,
      email: user.email,
      organizationId: user.organizationId,
      ip,
      userAgent: req.headers.get("user-agent"),
    });
    return NextResponse.json(
      { error: { code: "MFA_CODE_INVALID", message: "Invalid or expired code. Check your authenticator and try again." } },
      { status: 401 }
    );
  }

  const tokens = await issueSession(user, req);
  await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await audit({
    type: "MFA_PASSED",
    userId: user.id,
    email: user.email,
    organizationId: user.organizationId,
    ip,
    userAgent: req.headers.get("user-agent"),
    detail: usedBackupIndex >= 0 ? "Backup code used." : "TOTP verified.",
  });

  const res = NextResponse.json({
    mfaRequired: false,
    usedBackupCode: usedBackupIndex >= 0,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      orgId: user.organizationId,
      orgName: user.organization?.name ?? null,
      mfaEnabled: true,
    },
  });
  setAuthCookies(res, tokens.accessToken, tokens.refreshToken);
  return res;
}
