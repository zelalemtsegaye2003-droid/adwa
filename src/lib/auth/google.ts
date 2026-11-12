/**
 * Adwa Cyber — "Sign in with Google" (OAuth 2.0 / OpenID Connect).
 *
 * Flow: /api/auth/google → 302 to Google's consent screen →
 *       /api/auth/google/callback?code=… → token exchange →
 *       ID token verified against Google's JWKS (jose createRemoteJWKSet) →
 *       user upsert + platform session issued.
 *
 * Configure via .env:
 *   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
 * The redirect URI is derived from the request origin:
 *   {origin}/api/auth/google/callback
 *
 * Endpoint overrides (for dev/test deployments — defaults hit real Google):
 *   GOOGLE_AUTH_BASE  authorization endpoint. When it starts with "/" it is
 *                     treated as a same-origin gateway path (e.g.
 *                     "/mock-google/auth?XTransformPort=3010") so the
 *                     browser can reach an in-sandbox mock provider.
 *   GOOGLE_TOKEN_URL  token endpoint (server-to-server).
 *   GOOGLE_JWKS_URL   JSON Web Key Set endpoint (server-to-server).
 */
import { createRemoteJWKSet, jwtVerify } from "jose";

export interface GoogleIdClaims {
  sub: string; // stable Google account id
  email: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
}

export function googleConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

/** True when a non-Google authorization endpoint is wired in (dev mock). */
export function googleMockMode(): boolean {
  return googleConfigured() && Boolean(process.env.GOOGLE_AUTH_BASE);
}

export function redirectUri(origin: string): string {
  return `${origin}/api/auth/google/callback`;
}

/**
 * Public origin of a request. Behind the gateway/any reverse proxy the app
 * port differs from the public one, so forwarded headers win when present.
 */
export function requestOrigin(headers: Headers, fallbackOrigin: string): string {
  const host = headers.get("x-forwarded-host")?.split(",")[0].trim() || headers.get("host");
  if (host) {
    const proto = headers.get("x-forwarded-proto")?.split(",")[0].trim() || "http";
    return `${proto}://${host}`;
  }
  return fallbackOrigin;
}

/** Build the OAuth 2.0 authorization URL (Google, or override endpoint). */
export function googleAuthUrl(origin: string, state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri(origin),
    response_type: "code",
    scope: "openid email profile",
    access_type: "online",
    include_granted_scopes: "true",
    prompt: "select_account",
    state,
  });
  const base = process.env.GOOGLE_AUTH_BASE?.trim();
  if (base && base.startsWith("/")) {
    // Same-origin gateway path (dev mock provider behind Caddy XTransformPort).
    const sep = base.includes("?") ? "&" : "?";
    return `${origin}${base}${sep}${params.toString()}`;
  }
  const authBase = base && /^https?:\/\//.test(base) ? base : "https://accounts.google.com/o/oauth2/v2/auth";
  return `${authBase}?${params.toString()}`;
}

interface TokenResponse {
  access_token?: string;
  id_token?: string;
  error?: string;
  error_description?: string;
}

/** Exchange the authorization code for tokens. */
export async function exchangeCode(code: string, origin: string): Promise<TokenResponse> {
  const tokenUrl = process.env.GOOGLE_TOKEN_URL?.trim() || "https://oauth2.googleapis.com/token";
  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: redirectUri(origin),
      grant_type: "authorization_code",
    }),
  });
  return (await res.json()) as TokenResponse;
}

// Google's JWKS endpoint (cached by jose) — overridable for dev/test.
const JWKS = createRemoteJWKSet(
  new URL(process.env.GOOGLE_JWKS_URL?.trim() || "https://www.googleapis.com/oauth2/v3/certs")
);

/** Verify a Google ID token's signature, issuer and audience. */
export async function verifyGoogleIdToken(idToken: string): Promise<GoogleIdClaims | null> {
  try {
    const { payload } = await jwtVerify(idToken, JWKS, {
      issuer: ["https://accounts.google.com", "accounts.google.com"],
      audience: process.env.GOOGLE_CLIENT_ID!,
    });
    if (!payload.email) return null;
    return {
      sub: String(payload.sub),
      email: String(payload.email),
      email_verified: payload.email_verified === true,
      name: payload.name ? String(payload.name) : undefined,
      picture: payload.picture ? String(payload.picture) : undefined,
    };
  } catch {
    return null;
  }
}
