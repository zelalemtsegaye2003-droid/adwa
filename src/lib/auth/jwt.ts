/**
 * Adwa Cyber — JWT issuing/verification (HS256 via `jose`).
 *
 * Token types:
 *  - "access": short-lived API credential (15 min) — carries identity claims.
 *  - "mfa":    intermediate challenge token (5 min) — issued after a valid
 *              password step when MFA is enabled; exchanged for full tokens
 *              only after a correct TOTP / backup code.
 */
import { SignJWT, jwtVerify } from "jose";

export const ACCESS_TTL_SECONDS = 60 * 15; // 15 minutes
export const MFA_TTL_SECONDS = 60 * 5; // 5 minutes
export const ISSUER = "adwa-cyber";
export const AUDIENCE = "adwa-cyber-platform";

export type AppRole =
  | "SUPER_ADMIN"
  | "ORG_ADMIN"
  | "COMPLIANCE_OFFICER"
  | "AUDITOR"
  | "VIEWER";

export interface AccessClaims {
  sub: string; // user id
  email: string;
  name: string;
  role: AppRole;
  orgId: string | null;
  orgName: string | null;
  mfa: boolean; // whether the session completed MFA (or MFA is off)
  typ: "access";
  iat?: number; // issued-at (unix seconds, floored by jose)
  iatMs?: number; // exact issued-at in milliseconds — used for revocation checks
                 // (floored-second `iat` cannot distinguish before/after a
                 //  revocation inside the same second; see getSessionUser)
}

export interface MfaClaims {
  sub: string; // user id
  typ: "mfa";
}

function secretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not configured");
  return new TextEncoder().encode(secret);
}

export async function signAccessToken(claims: Omit<AccessClaims, "typ">): Promise<string> {
  return new SignJWT({ ...claims, typ: "access", iatMs: Date.now() })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TTL_SECONDS}s`)
    .setJti(crypto.randomUUID())
    .sign(secretKey());
}

export async function signMfaToken(userId: string): Promise<string> {
  return new SignJWT({ typ: "mfa" })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${MFA_TTL_SECONDS}s`)
    .setJti(crypto.randomUUID())
    .sign(secretKey());
}

/** Verify an access token and return its claims, or null when invalid/expired. */
export async function verifyAccessToken(token: string): Promise<AccessClaims | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey(), {
      issuer: ISSUER,
      audience: AUDIENCE,
    });
    if (payload.typ !== "access") return null;
    return payload as unknown as AccessClaims;
  } catch {
    return null;
  }
}

/** Verify an MFA challenge token, or null when invalid/expired. */
export async function verifyMfaToken(token: string): Promise<MfaClaims | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey(), {
      issuer: ISSUER,
      audience: AUDIENCE,
    });
    if (payload.typ !== "mfa") return null;
    return { sub: String(payload.sub), typ: "mfa" };
  } catch {
    return null;
  }
}
