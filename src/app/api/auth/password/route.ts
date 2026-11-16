/**
 * Adwa Cyber — POST /api/auth/password
 *
 * Logged-in password change (self-service, WS-7 Phase A).
 *  - requires the CURRENT password (re-authentication) for password accounts
 *  - Google-only accounts (no passwordHash) may SET an initial password here
 *  - enforces the shared password policy (validatePasswordPolicy)
 *  - on success every session is revoked (sessionsRevokedAt + refresh-token
 *    wipe) — the user signs in again with the new password. Simplest and
 *    safest: no lingering session can outlive a credential change.
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth/guard";
import { hashPassword, verifyPassword } from "@/lib/auth/crypto";
import { validatePasswordPolicy } from "@/lib/auth/passwords";
import { rateLimit, clientIp } from "@/lib/auth/rate-limit";
import { audit } from "@/lib/auth/audit";
import { apiError, invalidJson } from "@/lib/api-error";

export async function POST(req: NextRequest) {
  const guard = await requireAuth(req);
  if (guard.error) return guard.error;
  const { user } = guard;
  const ip = clientIp(req.headers);

  // Per-user bucket (abuse) + per-IP bucket (spray across accounts).
  const perUser = rateLimit(`pwchange:user:${user.id}`, 5, 15 * 60);
  if (!perUser.allowed) {
    return NextResponse.json(
      { error: { code: "RATE_LIMITED", message: "Too many attempts. Try again later." } },
      { status: 429, headers: { "Retry-After": String(perUser.retryAfterSeconds) } }
    );
  }
  const perIp = rateLimit(`pwchange:ip:${ip}`, 20, 15 * 60);
  if (!perIp.allowed) {
    return NextResponse.json(
      { error: { code: "RATE_LIMITED", message: "Too many attempts. Try again later." } },
      { status: 429, headers: { "Retry-After": String(perIp.retryAfterSeconds) } }
    );
  }

  let currentPassword = "";
  let newPassword = "";
  try {
    const body = await req.json();
    currentPassword = typeof body.currentPassword === "string" ? body.currentPassword : "";
    newPassword = typeof body.newPassword === "string" ? body.newPassword : "";
  } catch {
    return invalidJson();
  }

  const row = await db.user.findUnique({
    where: { id: user.id },
    select: { id: true, email: true, name: true, organizationId: true, passwordHash: true },
  });
  if (!row) return apiError(404, "NOT_FOUND", "Account not found.");

  const hasPassword = Boolean(row.passwordHash);

  // Re-authentication: password accounts must prove the current password.
  if (hasPassword) {
    if (!currentPassword) {
      return apiError(400, "VALIDATION", "Your current password is required.");
    }
    if (!verifyPassword(currentPassword, row.passwordHash!)) {
      await audit({
        type: "PASSWORD_CHANGE_FAILED",
        userId: user.id,
        email: user.email,
        organizationId: row.organizationId,
        ip,
        userAgent: req.headers.get("user-agent"),
        detail: "current password did not verify",
      });
      return apiError(400, "WRONG_PASSWORD", "Your current password is incorrect.");
    }
  }

  const policyError = validatePasswordPolicy(newPassword);
  if (policyError) {
    return apiError(400, "WEAK_PASSWORD", policyError);
  }

  // Changing to the same password is rejected (no-op churn + audit noise).
  if (hasPassword && verifyPassword(newPassword, row.passwordHash!)) {
    return apiError(400, "SAME_PASSWORD", "The new password must be different from the current one.");
  }

  await db.$transaction([
    db.user.update({
      where: { id: row.id },
      data: {
        passwordHash: hashPassword(newPassword),
        failedAttempts: 0,
        lockedUntil: null,
        sessionsRevokedAt: new Date(), // kills every outstanding access token
      },
    }),
    // Wipe stored refresh tokens — sessions cannot be silently re-established.
    db.refreshToken.deleteMany({ where: { userId: row.id } }),
  ]);

  await audit({
    type: "PASSWORD_CHANGED",
    userId: row.id,
    email: row.email,
    organizationId: row.organizationId,
    ip,
    userAgent: req.headers.get("user-agent"),
    detail: hasPassword ? "self-service change — all sessions revoked" : "initial password set for Google-only account — all sessions revoked",
  });

  return NextResponse.json({
    ok: true,
    message: "Password changed. All sessions were signed out — sign in again with your new password.",
  });
}
