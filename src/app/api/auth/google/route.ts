import { NextRequest, NextResponse } from "next/server";
import { googleConfigured, googleAuthUrl, requestOrigin } from "@/lib/auth/google";
import { randomToken } from "@/lib/auth/crypto";
import { rateLimit, clientIp } from "@/lib/auth/rate-limit";

/**
 * GET /api/auth/google — redirect to Google's OAuth consent screen.
 * A CSRF `state` is set in a short-lived cookie and checked on callback.
 */
export async function GET(req: NextRequest) {
  const origin = requestOrigin(req.headers, req.nextUrl.origin);
  if (!googleConfigured()) {
    return NextResponse.redirect(new URL("/?authError=google_not_configured", origin));
  }

  const ip = clientIp(req.headers);
  const rl = rateLimit(`google-start:${ip}`, 20, 5 * 60_000);
  if (!rl.allowed) {
    return NextResponse.redirect(new URL("/?authError=rate_limited", origin));
  }

  const state = randomToken(16);
  const res = NextResponse.redirect(googleAuthUrl(origin, state));
  res.cookies.set("adwa_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/api/auth/google",
    maxAge: 600,
  });
  return res;
}
