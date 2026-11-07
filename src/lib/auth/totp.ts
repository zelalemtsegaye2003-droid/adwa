/**
 * Adwa Cyber — RFC 6238 TOTP (Time-based One-Time Password) with HMAC-SHA1.
 * Compatible with Google Authenticator, Microsoft Authenticator, Authy, Aegis…
 * Implemented directly on node:crypto — no third-party dependency.
 */
import { createHmac, randomBytes } from "crypto";
import { encryptSecret, sha256, safeEqual } from "./crypto";

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
export const TOTP_PERIOD = 30; // seconds — the standard window
export const TOTP_DIGITS = 6;
export const ISSUER = "Adwa Cyber";

/** Generate a cryptographically random base32 TOTP secret (160 bits). */
export function generateTotpSecret(): string {
  const buf = randomBytes(20);
  return base32Encode(buf);
}

export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
}

export function base32Decode(input: string): Buffer {
  const clean = input.replace(/=+$/, "").replace(/\s+/g, "").toUpperCase();
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const char of clean) {
    const idx = BASE32_ALPHABET.indexOf(char);
    if (idx === -1) throw new Error(`Invalid base32 character: ${char}`);
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** Raw HOTP (RFC 4226) for a specific counter. */
function hotp(secret: Buffer, counter: number): string {
  const buf = Buffer.alloc(8);
  // Write the 64-bit big-endian counter (JS numbers are safe up to 2^53).
  buf.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  buf.writeUInt32BE(counter % 0x100000000, 4);
  const hmac = createHmac("sha1", secret).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const bin =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return (bin % 10 ** TOTP_DIGITS).toString().padStart(TOTP_DIGITS, "0");
}

/** Compute the TOTP code for a unix timestamp. */
export function totpAt(secret: string, timestampMs: number): string {
  const counter = Math.floor(timestampMs / 1000 / TOTP_PERIOD);
  return hotp(base32Decode(secret), counter);
}

/** Current TOTP code for a base32 secret. */
export function currentTotp(secret: string): string {
  return totpAt(secret, Date.now());
}

/**
 * Verify a submitted code against the secret with a ±1 step drift window
 * (standard practice: previous, current and next 30-second windows).
 */
export function verifyTotp(secret: string, code: string): boolean {
  const normalized = code.replace(/\D/g, "");
  if (normalized.length !== TOTP_DIGITS) return false;
  const now = Date.now();
  for (const drift of [-1, 0, 1]) {
    const expected = totpAt(secret, now + drift * TOTP_PERIOD * 1000);
    if (safeEqual(normalized, expected)) return true;
  }
  return false;
}

/** otpauth:// provisioning URI understood by every authenticator app. */
export function otpauthUrl(secret: string, email: string): string {
  const label = encodeURIComponent(`${ISSUER}:${email}`);
  const params = new URLSearchParams({
    secret,
    issuer: ISSUER,
    algorithm: "SHA1",
    digits: String(TOTP_DIGITS),
    period: String(TOTP_PERIOD),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}

/** Encrypt a TOTP secret for at-rest storage (AES-256-GCM). */
export function storeSecret(secret: string): string {
  return encryptSecret(secret);
}

/** Generate 10 one-time backup codes; returns { plain (show once), hashed (store) }. */
export function generateBackupCodes(): { plain: string[]; hashed: string[] } {
  const plain: string[] = [];
  for (let i = 0; i < 10; i++) {
    const raw = randomBytes(5).toString("hex").toUpperCase(); // 10 hex chars
    const formatted = `${raw.slice(0, 5)}-${raw.slice(5)}`;
    plain.push(formatted);
  }
  return { plain, hashed: plain.map((c) => sha256(c)) };
}

/** Consume a backup code: returns index if valid (caller must remove it), else -1. */
export function matchBackupCode(storedHashed: string[], submitted: string): number {
  const normalized = submitted.trim().toUpperCase();
  for (let i = 0; i < storedHashed.length; i++) {
    if (safeEqual(sha256(normalized), storedHashed[i])) return i;
  }
  return -1;
}
