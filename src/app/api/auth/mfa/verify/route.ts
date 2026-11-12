import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyMfaToken } from "@/lib/auth/jwt";
import { decryptSecret } from "@/lib/auth/crypto";
import { verifyTotpStep, matchBackupCode } from "@/lib/auth/totp";
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
 * Hardening: per-account attempt limit (A07) and TOTP replay protection —
 * a code accepted once can never be accepted again (its time step is
 * remembered; older or equal steps are rejected).
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

  // A03/A04: type guard + length cap before any crypto work.
  if (typeof body.code !== "undefined" && (typeof body.code !== "string" || body.code.length > 20)) {
    return NextResponse.json(
      { error: { code: "MFA_CODE_INVALID", message: "Invalid or expired code." } },
      { status: 401 }
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

  // A07: per-account attempt limit — a distributed attacker with many IPs
  // still cannot brute-force codes for a single account.
  const acctRl = rateLimit(`mfa-acct:${user.id}`, 10, 5 * 60_000);
  if (!acctRl.allowed) {
    await audit({
      type: "MFA_FAILED",
      userId: user.id,
      email: user.email,
      organizationId: user.organizationId,
      ip,
      detail: "Per-account MFA attempt limit exceeded.",
    });
    return NextResponse.json(
      { error: { code: "RATE_LIMITED", message: "Too many MFA attempts for this account. Please sign in again later." } },
      { status: 429 }
    );
  }

  const code = typeof body.code === "string" ? body.code.trim() : "";
  let passed = false;
  let usedBackupIndex = -1;
  let totpStep: number | null = null;

  try {
    const secret = decryptSecret(user.mfaSecret);
    const step = verifyTotpStep(secret, code);
    if (step !== null) {
      // A07 replay protection: only accept steps strictly newer than the
      // highest one already consumed (blocks reusing an intercepted code).
      if (user.lastTotpCounter === null || step > user.lastTotpCounter) {
        passed = true;
        totpStep = step;
      }
    }
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
  await db.user.update({
    where: { id: user.id },
    data: {
      lastLoginAt: new Date(),
      // Remember the consumed TOTP step for replay protection.
      ...(totpStep !== null ? { lastTotpCounter: totpStep } : {}),
    },
  });
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
