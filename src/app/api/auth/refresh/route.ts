import { NextRequest, NextResponse } from "next/server";
import { rotateRefreshToken, setAuthCookies, clearAuthCookies } from "@/lib/auth/session";
import { audit } from "@/lib/auth/audit";
import { clientIp } from "@/lib/auth/rate-limit";

/**
 * POST /api/auth/refresh — silent re-authentication.
 * Rotates the refresh token (reuse detection built in) and sets fresh cookies.
 */
export async function POST(req: NextRequest) {
  const result = await rotateRefreshToken(req);
  if (!result.ok) {
    const res = NextResponse.json(
      { error: { code: result.reason ?? "REFRESH_FAILED", message: "Session expired. Please sign in again." } },
      { status: result.status }
    );
    if (result.reason === "TOKEN_REUSE_DETECTED") clearAuthCookies(res);
    return res;
  }

  await audit({
    type: "TOKEN_REFRESHED",
    userId: result.user!.id,
    email: result.user!.email,
    organizationId: result.user!.organizationId,
    ip: clientIp(req.headers),
    userAgent: req.headers.get("user-agent"),
  });

  const res = NextResponse.json({ ok: true });
  setAuthCookies(res, result.accessToken!, result.refreshToken!);
  return res;
}
