/**
 * Adwa Cyber — cryptographic primitives for the identity layer.
 * Zero-dependency (node:crypto): scrypt password hashing, SHA-256,
 * CSPRNG tokens and AES-256-GCM secret encryption at rest.
 */
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "crypto";

const SCRYPT_N = 16384; // CPU/memory cost (OWASP-recommended for scrypt)
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LEN = 64;

/** Hash a password with scrypt. Format: scrypt$N$r$p$salt$hash (both hex). */
export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password.normalize("NFKC"), salt, KEY_LEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  });
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt.toString("hex")}$${hash.toString("hex")}`;
}

/** Verify a password against a stored scrypt hash (timing-safe). */
export function verifyPassword(password: string, stored: string): boolean {
  try {
    const [scheme, n, r, p, saltHex, hashHex] = stored.split("$");
    if (scheme !== "scrypt") return false;
    const salt = Buffer.from(saltHex, "hex");
    const expected = Buffer.from(hashHex, "hex");
    const actual = scryptSync(password.normalize("NFKC"), salt, expected.length, {
      N: Number(n),
      r: Number(r),
      p: Number(p),
    });
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

/** SHA-256 hex digest of a string. */
export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/** Opaque, URL-safe CSPRNG token (e.g. refresh tokens, backup codes). */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

/** Timing-safe string comparison (constant time when lengths differ, still safe). */
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) {
    // Compare against itself to keep constant time, then fail.
    timingSafeEqual(ab, ab);
    return false;
  }
  return timingSafeEqual(ab, bb);
}

/** AES-256-GCM encryption key derived from AUTH_SECRET. */
function encryptionKey(): Buffer {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not configured");
  return scryptSync(secret, "adwa-mfa-secret-v1", 32, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P });
}

/** Encrypt a secret (e.g. TOTP seed) at rest. Format: iv:ct:tag (base64url). */
export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("base64url"), ct.toString("base64url"), tag.toString("base64url")].join(":");
}

/** Decrypt a secret encrypted by encryptSecret(). */
export function decryptSecret(payload: string): string {
  const [ivB64, ctB64, tagB64] = payload.split(":");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivB64, "base64url"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(ctB64, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
