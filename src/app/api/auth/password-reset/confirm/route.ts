/**
 * Adwa Cyber — POST /api/auth/password-reset/confirm
 *
 * Redeems a single-use token and sets the new password. On success every
 * existing session is revoked (sessionsRevokedAt bump + refresh-token
 * wipe) so a stolen password cannot outlive its reset.
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth/crypto";
import { validatePasswordPolicy } from "@/lib/auth/passwords";
import { redeemAuthToken } from "@/lib/auth/tokens";
import { rateLimit, clientIp } from "@/lib/auth/rate-limit";
import { audit } from "@/lib/auth/audit";

export async function POST(req: NextRequest) {
  const ip = clientIp(req.headers);

  const perIp = rateLimit(`pwreset-confirm:ip:${ip}`, 10, 15 * 60);
  if (!perIp.allowed) {
    return NextResponse.json(
      { error: { code: "RATE_LIMITED", message: "Too many attempts. Try again later." } },
      { status: 429, headers: { "Retry-After": String(perIp.retryAfterSeconds) } }
    );
  }

  let token = "";
  let password = "";
  try {
    const body = await req.json();
    token = String(body.token ?? "").slice(0, 200);
    password = String(body.password ?? "");
  } catch {
    return NextResponse.json(
      { error: { code: "BAD_REQUEST", message: "Invalid JSON body." } },
      { status: 400 }
    );
  }

  if (!token) {
    return NextResponse.json(
      { error: { code: "VALIDATION", message: "Reset token is required." } },
      { status: 400 }
    );
  }

  const policyError = validatePasswordPolicy(password);
  if (policyError) {
    return NextResponse.json(
      { error: { code: "WEAK_PASSWORD", message: policyError } },
      { status: 400 }
    );
  }

  const redeem = await redeemAuthToken(token, "PASSWORD_RESET");
  if (!redeem.ok) {
    const message =
      redeem.reason === "EXPIRED"
        ? "This reset link has expired. Request a new one."
        : redeem.reason === "ALREADY_USED"
          ? "This reset link has already been used. Request a new one."
          : "This reset link is invalid. Request a new one.";
    return NextResponse.json(
      { error: { code: redeem.reason, message } },
      { status: 400 }
    );
  }

  const user = await db.user.update({
    where: { id: redeem.userId },
    data: {
      passwordHash: hashPassword(password),
      failedAttempts: 0,
      lockedUntil: null,
      sessionsRevokedAt: new Date(), // kills every outstanding access token
    },
    select: { email: true, name: true, organizationId: true },
  });

  // Wipe stored refresh tokens — sessions cannot be silently re-established
  await db.refreshToken.deleteMany({ where: { userId: redeem.userId } });

  await audit({
    type: "PASSWORD_RESET_COMPLETED",
    userId: redeem.userId,
    email: user.email,
    organizationId: user.organizationId,
    ip,
    userAgent: req.headers.get("user-agent"),
    detail: "all sessions revoked",
  });

  return NextResponse.json({
    ok: true,
    message: "Password updated. Sign in with your new password.",
  });
}
