import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { googleConfigured, exchangeCode, verifyGoogleIdToken } from "@/lib/auth/google";
import { issueSession, setAuthCookies } from "@/lib/auth/session";
import { audit } from "@/lib/auth/audit";
import { clientIp, rateLimit } from "@/lib/auth/rate-limit";

/**
 * GET /api/auth/google/callback — finish "Sign in with Google".
 * Verifies state cookie + code, verifies Google's signed ID token against
 * its JWKS, upserts the local account and issues a platform session.
 */
export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const fail = (reason: string) =>
    NextResponse.redirect(new URL(`/?authError=${encodeURIComponent(reason)}`, origin));

  if (!googleConfigured()) return fail("google_not_configured");

  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const oauthError = req.nextUrl.searchParams.get("error");
  if (oauthError) return fail(oauthError);
  if (!code || !state) return fail("google_missing_code");

  // CSRF: state must match the cookie set at flow start.
  const expectedState = req.cookies.get("adwa_oauth_state")?.value;
  if (!expectedState || expectedState !== state) {
    await audit({ type: "GOOGLE_LOGIN_FAILED", email: "(unknown)", ip: clientIp(req.headers), detail: "state mismatch" });
    return fail("google_state_mismatch");
  }

  const ip = clientIp(req.headers);
  const rl = rateLimit(`google-cb:${ip}`, 15, 5 * 60_000);
  if (!rl.allowed) return fail("rate_limited");

  const tokenRes = await exchangeCode(code, origin);
  if (!tokenRes.id_token || tokenRes.error) {
    await audit({
      type: "GOOGLE_LOGIN_FAILED",
      email: "(unknown)",
      ip,
      detail: tokenRes.error_description ?? tokenRes.error ?? "token exchange failed",
    });
    return fail("google_exchange_failed");
  }

  const claims = await verifyGoogleIdToken(tokenRes.id_token);
  if (!claims || !claims.email_verified) {
    await audit({
      type: "GOOGLE_LOGIN_FAILED",
      email: claims?.email ?? "(unknown)",
      ip,
      detail: claims ? "email not verified" : "id token verification failed",
    });
    return fail("google_verification_failed");
  }

  const email = claims.email.toLowerCase();
  const existing = await db.user.findUnique({
    where: { email },
    include: { organization: { select: { id: true, name: true } } },
  });

  // Google-only account creation is allowed for e-mail domains that already
  // own a tenant (contactEmail match) — otherwise they must be provisioned by
  // an admin, to prevent uninvited tenant access.
  let user = existing;
  if (!user) {
    const domain = email.split("@")[1] ?? "";
    const org = await db.organization.findFirst({
      where: { contactEmail: { endsWith: `@${domain}` } },
    });
    if (org) {
      user = await db.user.create({
        data: {
          email,
          name: claims.name ?? email.split("@")[0],
          avatarUrl: claims.picture ?? null,
          role: "VIEWER",
          organizationId: org.id,
          authProvider: "GOOGLE",
          googleId: claims.sub,
          lastLoginAt: new Date(),
        },
        include: { organization: { select: { id: true, name: true } } },
      });
      await audit({
        type: "USER_CREATED",
        userId: user.id,
        email,
        organizationId: org.id,
        ip,
        detail: "Google-only account auto-provisioned as VIEWER (matching tenant domain).",
      });
    } else {
      await audit({
        type: "GOOGLE_LOGIN_FAILED",
        email,
        ip,
        detail: "No account and no matching tenant domain — not provisioned.",
      });
      return fail("google_no_account");
    }
  } else {
    if (user.status !== "ACTIVE") {
      await audit({ type: "GOOGLE_LOGIN_FAILED", userId: user.id, email, ip, detail: "account disabled" });
      return fail("account_disabled");
    }
    // Link googleId on first Google login of a local account.
    if (!user.googleId) {
      await db.user.update({
        where: { id: user.id },
        data: { googleId: claims.sub, avatarUrl: user.avatarUrl ?? claims.picture ?? null },
      });
    }
  }

  // MFA note: if the local account has MFA enabled, Google login is refused —
  // the native TOTP factor must be satisfied. (Google account protection is
  // external and not under platform control.)
  if (user.mfaEnabled) {
    await audit({
      type: "GOOGLE_LOGIN_FAILED",
      userId: user.id,
      email,
      organizationId: user.organizationId,
      ip,
      detail: "Account has enforced platform MFA — password+TOTP login required.",
    });
    return fail("google_mfa_required");
  }

  await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await audit({
    type: "GOOGLE_LOGIN",
    userId: user.id,
    email,
    organizationId: user.organizationId,
    ip,
    userAgent: req.headers.get("user-agent"),
  });

  const tokens = await issueSession(user, req);
  const res = NextResponse.redirect(new URL("/?google=success", origin));
  setAuthCookies(res, tokens.accessToken, tokens.refreshToken);
  res.cookies.set("adwa_oauth_state", "", { path: "/api/auth/google", maxAge: 0 });
  return res;
}
