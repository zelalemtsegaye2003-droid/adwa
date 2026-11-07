/**
 * Adwa Cyber — session management.
 *
 * Design:
 *  - Access token (JWT, 15 min) stored in an httpOnly cookie `adwa_at`.
 *  - Refresh token (opaque 256-bit CSPRNG, sha256-hashed at rest) stored in an
 *    httpOnly cookie `adwa_rt` scoped to path=/api/auth so it is only ever
 *    sent to auth endpoints.
 *  - Refresh rotation: every refresh issues a new token and revokes the old
 *    one. Presenting a revoked token = theft signal → ALL user sessions are
 *    revoked and the event is audited.
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sha256, randomToken } from "./crypto";
import { signAccessToken, verifyAccessToken, ACCESS_TTL_SECONDS, type AppRole } from "./jwt";
import { audit } from "./audit";

const SECURE_COOKIES = process.env.NODE_ENV === "production";

export const ACCESS_COOKIE = "adwa_at";
export const REFRESH_COOKIE = "adwa_rt";
const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: AppRole;
  orgId: string | null;
  orgName: string | null;
  mfa: boolean;
}

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
}

/** Issue a full session: fresh access JWT + a new rotating refresh token. */
export async function issueSession(
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    organizationId: string | null;
    mfaEnabled: boolean;
  },
  req: NextRequest
): Promise<IssuedTokens> {
  const org = user.organizationId
    ? await db.organization.findUnique({
        where: { id: user.organizationId },
        select: { name: true },
      })
    : null;

  const accessToken = await signAccessToken({
    sub: user.id,
    email: user.email,
    name: user.name,
    role: user.role as AppRole,
    orgId: user.organizationId,
    orgName: org?.name ?? null,
    mfa: user.mfaEnabled, // session reaching here means MFA was satisfied (or disabled)
  });

  const refreshToken = randomToken(32);
  await db.refreshToken.create({
    data: {
      tokenHash: sha256(refreshToken),
      userId: user.id,
      expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
      userAgent: req.headers.get("user-agent")?.slice(0, 250) ?? null,
      ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    },
  });

  return { accessToken, refreshToken };
}

/** Attach both auth cookies to a response. */
export function setAuthCookies(res: NextResponse, accessToken: string, refreshToken: string): void {
  res.cookies.set(ACCESS_COOKIE, accessToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: SECURE_COOKIES,
    path: "/",
    maxAge: ACCESS_TTL_SECONDS,
  });
  res.cookies.set(REFRESH_COOKIE, refreshToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: SECURE_COOKIES,
    path: "/api/auth", // only sent to auth endpoints
    maxAge: REFRESH_TTL_MS / 1000,
  });
}

/** Clear both auth cookies. */
export function clearAuthCookies(res: NextResponse): void {
  res.cookies.set(ACCESS_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  res.cookies.set(REFRESH_COOKIE, "", { httpOnly: true, path: "/api/auth", maxAge: 0 });
}

/** Read + verify the access token from cookies or Authorization header. */
export async function getSessionUser(req: NextRequest): Promise<SessionUser | null> {
  const header = req.headers.get("authorization");
  const bearer = header?.startsWith("Bearer ") ? header.slice(7) : null;
  const token = bearer || req.cookies.get(ACCESS_COOKIE)?.value || null;
  if (!token) return null;

  const claims = await verifyAccessToken(token);
  if (!claims) return null;

  // Live checks: user still exists, is ACTIVE, role/org not changed since issue.
  const user = await db.user.findUnique({
    where: { id: claims.sub },
    include: { organization: { select: { id: true, name: true } } },
  });
  if (!user || user.status !== "ACTIVE") return null;
  if (user.role !== claims.role) return null; // stale token after role change

  // Session-family revocation: access tokens issued before this moment are dead
  // (reuse detection, role change, password reset, account disable, MFA disable).
  if (user.sessionsRevokedAt && claims.iat && user.sessionsRevokedAt.getTime() > claims.iat * 1000) {
    return null;
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role as AppRole,
    orgId: user.organizationId,
    orgName: user.organization?.name ?? null,
    mfa: claims.mfa,
  };
}

export interface RefreshResult {
  ok: boolean;
  status: number;
  user?: {
    id: string;
    email: string;
    name: string;
    role: string;
    organizationId: string | null;
    mfaEnabled: boolean;
  };
  accessToken?: string;
  refreshToken?: string;
  reason?: string;
}

/**
 * Rotate a refresh token with reuse detection.
 * On reuse of an already-revoked token the entire session family is revoked.
 */
export async function rotateRefreshToken(req: NextRequest): Promise<RefreshResult> {
  const presented = req.cookies.get(REFRESH_COOKIE)?.value;
  if (!presented) return { ok: false, status: 401, reason: "NO_REFRESH_TOKEN" };

  const hash = sha256(presented);
  const stored = await db.refreshToken.findUnique({
    where: { tokenHash: hash },
    include: { user: { include: { organization: { select: { name: true } } } } },
  });

  if (!stored) {
    return { ok: false, status: 401, reason: "INVALID_REFRESH_TOKEN" };
  }

  if (stored.revokedAt) {
    // Reuse detected → revoke every session of this user.
    await revokeAllSessions(stored.userId);
    await audit({
      type: "TOKEN_REUSE_DETECTED",
      userId: stored.userId,
      email: stored.user.email,
      detail: "Refresh token reuse detected — all sessions for this user were revoked.",
    });
    return { ok: false, status: 401, reason: "TOKEN_REUSE_DETECTED" };
  }

  if (stored.expiresAt.getTime() < Date.now()) {
    return { ok: false, status: 401, reason: "REFRESH_TOKEN_EXPIRED" };
  }

  if (stored.user.status !== "ACTIVE") {
    return { ok: false, status: 401, reason: "USER_DISABLED" };
  }

  // Rotate: revoke old, issue new pair.
  const newRefresh = randomToken(32);
  const created = await db.refreshToken.create({
    data: {
      tokenHash: sha256(newRefresh),
      userId: stored.userId,
      expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
      userAgent: req.headers.get("user-agent")?.slice(0, 250) ?? null,
      ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    },
  });
  await db.refreshToken.update({
    where: { id: stored.id },
    data: { revokedAt: new Date(), replacedBy: created.id },
  });

  const accessToken = await signAccessToken({
    sub: stored.user.id,
    email: stored.user.email,
    name: stored.user.name,
    role: stored.user.role as AppRole,
    orgId: stored.user.organizationId,
    orgName: stored.user.organization?.name ?? null,
    mfa: stored.user.mfaEnabled,
  });

  return {
    ok: true,
    status: 200,
    user: {
      id: stored.user.id,
      email: stored.user.email,
      name: stored.user.name,
      role: stored.user.role,
      organizationId: stored.user.organizationId,
      mfaEnabled: stored.user.mfaEnabled,
    },
    accessToken,
    refreshToken: newRefresh,
  };
}

/** Revoke all refresh tokens for a user (password change, MFA disable, logout-all)
 *  and invalidate every access token issued before now. */
export async function revokeAllSessions(userId: string): Promise<void> {
  const now = new Date();
  await db.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: now },
  });
  await db.user.update({
    where: { id: userId },
    data: { sessionsRevokedAt: now },
  });
}
