/**
 * Adwa Cyber — single-use recovery tokens (password reset / email verify).
 *
 * Design:
 *  - token = 32 random bytes, base64url (43 chars, URL-safe)
 *  - DB stores only sha256(token); a database leak cannot be replayed
 *  - atomic redemption: UPDATE ... WHERE consumedAt IS NULL AND expiresAt > now
 *    so concurrent or replayed redeems race safely to exactly one winner
 *  - per-user live-token cap: a new request supersedes previous unused tokens
 */
import { createHash, randomBytes } from "crypto";
import { db } from "@/lib/db";

export type AuthTokenType = "PASSWORD_RESET" | "EMAIL_VERIFY";

export const TOKEN_TTL_MINUTES: Record<AuthTokenType, number> = {
  PASSWORD_RESET: 30,
  EMAIL_VERIFY: 24 * 60,
};

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export interface IssuedToken {
  token: string; // the raw token — ONLY in the outbound email, never stored
  expiresAt: Date;
}

/** Mint a token of the given type, invalidating previous unused ones. */
export async function issueAuthToken(
  userId: string,
  type: AuthTokenType,
  requestIp?: string | null
): Promise<IssuedToken> {
  // Supersede: consume any prior live tokens of the same type
  await db.authToken.updateMany({
    where: { userId, type, consumedAt: null },
    data: { consumedAt: new Date() },
  });

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MINUTES[type] * 60_000);
  await db.authToken.create({
    data: {
      userId,
      type,
      tokenHash: sha256Hex(token),
      expiresAt,
      requestIp: requestIp ?? null,
    },
  });
  return { token, expiresAt };
}

export type RedeemResult =
  | { ok: true; userId: string }
  | { ok: false; reason: "NOT_FOUND" | "EXPIRED" | "ALREADY_USED" };

/** Atomically redeem (single-use). Losers see EXPIRED/ALREADY_USED/NOT_FOUND. */
export async function redeemAuthToken(
  token: string,
  type: AuthTokenType
): Promise<RedeemResult> {
  const record = await db.authToken.findUnique({
    where: { tokenHash: sha256Hex(token) },
    select: { id: true, userId: true, type: true, expiresAt: true, consumedAt: true },
  });
  if (!record || record.type !== type) return { ok: false, reason: "NOT_FOUND" };
  if (record.consumedAt) return { ok: false, reason: "ALREADY_USED" };
  if (record.expiresAt.getTime() <= Date.now()) return { ok: false, reason: "EXPIRED" };

  const now = new Date();
  const winner = await db.authToken.updateMany({
    where: { id: record.id, consumedAt: null, expiresAt: { gt: now } },
    data: { consumedAt: now },
  });
  if (winner.count !== 1) return { ok: false, reason: "ALREADY_USED" };
  return { ok: true, userId: record.userId };
}
