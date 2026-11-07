import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/crypto";
import { verifyCaptcha } from "@/lib/auth/captcha";
import { signMfaToken } from "@/lib/auth/jwt";
import { issueSession, setAuthCookies } from "@/lib/auth/session";
import { audit } from "@/lib/auth/audit";
import { rateLimit, clientIp } from "@/lib/auth/rate-limit";

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

interface LoginBody {
  email?: string;
  password?: string;
  captchaId?: string;
  captchaAnswer?: string;
  hcaptchaToken?: string;
  recaptchaToken?: string;
}

/**
 * POST /api/auth/login — step 1 of authentication.
 * email + password + captcha →
 *   - MFA off: full session issued (access + refresh cookies).
 *   - MFA on:  5-minute mfaToken returned for step 2 (/api/auth/mfa/verify).
 */
export async function POST(req: NextRequest) {
  const ip = clientIp(req.headers);
  let body: LoginBody;
  try {
    body = (await req.json()) as LoginBody;
  } catch {
    return NextResponse.json(
      { error: { code: "INVALID_JSON", message: "Request body must be valid JSON." } },
      { status: 400 }
    );
  }

  const email = body.email?.trim().toLowerCase() ?? "";
  const password = body.password ?? "";

  if (!email || !password) {
    return NextResponse.json(
      { error: { code: "MISSING_CREDENTIALS", message: "Email and password are required." } },
      { status: 400 }
    );
  }

  // Rate limits: per IP (broad) and per account (targeted).
  const ipRl = rateLimit(`login-ip:${ip}`, 20, 5 * 60_000);
  const acctRl = rateLimit(`login-acct:${email}`, 10, 5 * 60_000);
  if (!ipRl.allowed || !acctRl.allowed) {
    await audit({
      type: "LOGIN_FAILED",
      email,
      ip,
      userAgent: req.headers.get("user-agent"),
      detail: "Rate limited.",
    });
    return NextResponse.json(
      { error: { code: "RATE_LIMITED", message: "Too many attempts. Please wait a few minutes." } },
      { status: 429, headers: { "Retry-After": String(Math.max(ipRl.retryAfterSeconds, acctRl.retryAfterSeconds)) } }
    );
  }

  // CAPTCHA — always verified before touching password state.
  const captchaOk = await verifyCaptcha({
    captchaId: body.captchaId,
    captchaAnswer: body.captchaAnswer,
    hcaptchaToken: body.hcaptchaToken,
    recaptchaToken: body.recaptchaToken,
    remoteIp: ip,
  });
  if (!captchaOk) {
    await audit({
      type: "CAPTCHA_FAILED",
      email,
      ip,
      userAgent: req.headers.get("user-agent"),
    });
    return NextResponse.json(
      { error: { code: "CAPTCHA_FAILED", message: "Captcha verification failed. Please try the new challenge." } },
      { status: 400 }
    );
  }

  const user = await db.user.findUnique({
    where: { email },
    include: { organization: { select: { id: true, name: true } } },
  });

  const genericFail = NextResponse.json(
    { error: { code: "INVALID_CREDENTIALS", message: "Invalid email or password." } },
    { status: 401 }
  );

  if (!user || !user.passwordHash) {
    await audit({
      type: "LOGIN_FAILED",
      userId: user?.id,
      email,
      organizationId: user?.organizationId,
      ip,
      userAgent: req.headers.get("user-agent"),
      detail: user ? "Google-only account tried password login." : "Unknown email.",
    });
    return genericFail;
  }

  if (user.status !== "ACTIVE") {
    await audit({
      type: "LOGIN_FAILED",
      userId: user.id,
      email,
      organizationId: user.organizationId,
      ip,
      userAgent: req.headers.get("user-agent"),
      detail: "Account disabled.",
    });
    return NextResponse.json(
      { error: { code: "ACCOUNT_DISABLED", message: "This account has been disabled. Contact your administrator." } },
      { status: 403 }
    );
  }

  // Account lockout.
  if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
    await audit({
      type: "LOGIN_LOCKED",
      userId: user.id,
      email,
      organizationId: user.organizationId,
      ip,
      userAgent: req.headers.get("user-agent"),
    });
    const mins = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60_000);
    return NextResponse.json(
      {
        error: {
          code: "ACCOUNT_LOCKED",
          message: `Account temporarily locked after repeated failures. Try again in ~${mins} minute(s).`,
        },
      },
      { status: 423 }
    );
  }

  if (!verifyPassword(password, user.passwordHash)) {
    const attempts = user.failedAttempts + 1;
    const shouldLock = attempts >= MAX_FAILED_ATTEMPTS;
    await db.user.update({
      where: { id: user.id },
      data: {
        failedAttempts: shouldLock ? 0 : attempts,
        lockedUntil: shouldLock ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null,
      },
    });
    await audit({
      type: "LOGIN_FAILED",
      userId: user.id,
      email,
      organizationId: user.organizationId,
      ip,
      userAgent: req.headers.get("user-agent"),
      detail: `Wrong password (attempt ${attempts}/${MAX_FAILED_ATTEMPTS}${shouldLock ? " — locked" : ""}).`,
    });
    if (shouldLock) {
      await audit({
        type: "ACCOUNT_LOCKED",
        userId: user.id,
        email,
        organizationId: user.organizationId,
        ip,
        userAgent: req.headers.get("user-agent"),
        detail: `Locked for ${LOCK_MINUTES} minutes.`,
      });
    }
    return genericFail;
  }

  // Password OK → reset failure counters.
  await db.user.update({
    where: { id: user.id },
    data: { failedAttempts: 0, lockedUntil: null },
  });

  // MFA branch: issue short-lived challenge token, never full session.
  if (user.mfaEnabled && user.mfaSecret) {
    const mfaToken = await signMfaToken(user.id);
    await audit({
      type: "MFA_CHALLENGE",
      userId: user.id,
      email,
      organizationId: user.organizationId,
      ip,
      userAgent: req.headers.get("user-agent"),
      detail: "Password verified; TOTP challenge issued.",
    });
    return NextResponse.json({
      mfaRequired: true,
      mfaToken,
      email: user.email,
      hint: "Enter the 6-digit code from your authenticator app, or a backup code.",
    });
  }

  // No MFA → issue full session.
  const tokens = await issueSession(user, req);
  await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await audit({
    type: "LOGIN_SUCCESS",
    userId: user.id,
    email,
    organizationId: user.organizationId,
    ip,
    userAgent: req.headers.get("user-agent"),
  });

  const res = NextResponse.json({
    mfaRequired: false,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      orgId: user.organizationId,
      orgName: user.organization?.name ?? null,
      mfaEnabled: user.mfaEnabled,
    },
  });
  setAuthCookies(res, tokens.accessToken, tokens.refreshToken);
  return res;
}
