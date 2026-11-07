/**
 * Adwa Cyber — professional CAPTCHA service.
 *
 * Primary provider: self-hosted SVG CAPTCHA (works fully offline):
 *  - 5-character unambiguous alphanumeric code (0/O/1/I/L excluded)
 *  - per-character rotation, baseline jitter, wave distortion, noise paths
 *  - one-time challenges with 5-minute expiry, case-insensitive answer
 *
 * Optional providers (enabled via env, no code change needed):
 *  - hCaptcha   (HCAPTCHA_SECRET)
 *  - reCAPTCHA  (RECAPTCHA_SECRET)  — client token verified server-side
 */
import { db } from "@/lib/db";
import { sha256 } from "./crypto";

const CAPTCHA_TTL_MS = 5 * 60 * 1000;
const SAFE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O/1/I/L

export interface CaptchaChallengeDto {
  captchaId: string;
  svg: string; // inline SVG markup
  expiresAt: string;
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomColor(min = 40, max = 160): string {
  const h = randInt(0, 360);
  const s = randInt(45, 75);
  const l = randInt(min, max);
  return `hsl(${h} ${s}% ${l}%)`;
}

/** Render a distorted SVG captcha for the given code. */
function renderSvg(code: string): string {
  const width = 220;
  const height = 80;
  const chars = code.split("");

  // Per-character glyph transforms.
  const glyphEls = chars
    .map((ch, i) => {
      const x = 26 + i * 38 + randInt(-4, 4);
      const y = height / 2 + randInt(-6, 8);
      const rotate = randInt(-24, 24);
      const fontSize = randInt(34, 42);
      const color = randomColor(25, 55);
      const dy = randInt(-5, 5);
      return `<text x="${x}" y="${y}" dy="${dy}" font-family="'Georgia','Times New Roman',serif" font-size="${fontSize}" font-weight="700" fill="${color}" text-anchor="middle" transform="rotate(${rotate} ${x} ${y})">${ch}</text>`;
    })
    .join("");

  // Wave distortion paths across the text.
  const waves = Array.from({ length: 2 })
    .map(() => {
      const y0 = randInt(10, height - 10);
      const color = randomColor(30, 70);
      const d = `M 0 ${y0} C ${width * 0.25} ${y0 + randInt(-22, 22)}, ${width * 0.55} ${y0 + randInt(-22, 22)}, ${width} ${y0 + randInt(-14, 14)}`;
      return `<path d="${d}" fill="none" stroke="${color}" stroke-width="${randInt(1, 2)}" opacity="0.55"/>`;
    })
    .join("");

  // Speckle noise.
  const dots = Array.from({ length: 26 })
    .map(
      () =>
        `<circle cx="${randInt(2, width - 2)}" cy="${randInt(2, height - 2)}" r="${randInt(1, 2.4)}" fill="${randomColor(20, 80)}" opacity="0.5"/>`
    )
    .join("");

  // Interference line.
  const line = `<line x1="${randInt(0, 30)}" y1="${randInt(5, height - 5)}" x2="${width - randInt(0, 30)}" y2="${randInt(5, height - 5)}" stroke="${randomColor(30, 70)}" stroke-width="1.2" opacity="0.4"/>`;

  const gradId = `g${randInt(1000, 9999)}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="CAPTCHA challenge"><defs><linearGradient id="${gradId}" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#ecfdf5"/><stop offset="100%" stop-color="#d1fae5"/></linearGradient></defs><rect width="${width}" height="${height}" rx="10" fill="url(#${gradId})"/><rect width="${width}" height="${height}" rx="10" fill="none" stroke="#a7f3d0" stroke-width="2"/>${dots}${waves}${line}${glyphEls}</svg>`;
}

function randomCode(length = 5): string {
  return Array.from({ length })
    .map(() => SAFE_CHARS[randInt(0, SAFE_CHARS.length - 1)])
    .join("");
}

/** Clean up expired challenges (cheap, probabilistic). */
async function cleanup(): Promise<void> {
  if (Math.random() < 0.15) {
    await db.captchaChallenge.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  }
}

/** Create a fresh built-in captcha challenge. */
export async function createCaptcha(): Promise<CaptchaChallengeDto> {
  await cleanup();
  const code = randomCode();
  const created = await db.captchaChallenge.create({
    data: {
      answerHash: sha256(code.toUpperCase()),
      expiresAt: new Date(Date.now() + CAPTCHA_TTL_MS),
    },
  });
  return {
    captchaId: created.id,
    svg: renderSvg(code),
    expiresAt: created.expiresAt.toISOString(),
  };
}

/**
 * Verify a captcha answer. Provider is auto-detected:
 *  - builtin:   { captchaId, captchaAnswer }
 *  - hcaptcha:  { hcaptchaToken }            (remote IP verified by hCaptcha)
 *  - recaptcha: { recaptchaToken }
 * Single-use: consumed challenges can never be replayed.
 */
export async function verifyCaptcha(input: {
  captchaId?: string;
  captchaAnswer?: string;
  hcaptchaToken?: string;
  recaptchaToken?: string;
  remoteIp?: string;
}): Promise<boolean> {
  // ── hCaptcha ────────────────────────────────────────────────────────────
  const hcSecret = process.env.HCAPTCHA_SECRET;
  if (input.hcaptchaToken) {
    if (!hcSecret) return false;
    try {
      const res = await fetch("https://api.hcaptcha.com/siteverify", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          secret: hcSecret,
          response: input.hcaptchaToken,
          remoteip: input.remoteIp ?? "",
        }),
      });
      const data = (await res.json()) as { success: boolean };
      return data.success === true;
    } catch {
      return false;
    }
  }

  // ── Google reCAPTCHA v2/v3 ──────────────────────────────────────────────
  const rcSecret = process.env.RECAPTCHA_SECRET;
  if (input.recaptchaToken) {
    if (!rcSecret) return false;
    try {
      const res = await fetch("https://www.google.com/recaptcha/api/siteverify", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          secret: rcSecret,
          response: input.recaptchaToken,
        }),
      });
      const data = (await res.json()) as { success: boolean; score?: number };
      return data.success === true && (data.score === undefined || data.score >= 0.4);
    } catch {
      return false;
    }
  }

  // ── Built-in SVG captcha ────────────────────────────────────────────────
  if (!input.captchaId || !input.captchaAnswer) return false;
  const challenge = await db.captchaChallenge.findUnique({ where: { id: input.captchaId } });
  if (!challenge) return false;
  // Consume immediately (single-use, even on failure).
  await db.captchaChallenge.delete({ where: { id: challenge.id } }).catch(() => undefined);
  if (challenge.consumedAt) return false;
  if (challenge.expiresAt.getTime() < Date.now()) return false;
  return sha256(input.captchaAnswer.trim().toUpperCase()) === challenge.answerHash;
}

/** Advertise which providers the client should render. */
export function captchaConfig(): { builtin: true; hcaptchaSiteKey?: string; recaptchaSiteKey?: string } {
  return {
    builtin: true,
    hcaptchaSiteKey: process.env.HCAPTCHA_SITE_KEY || undefined,
    recaptchaSiteKey: process.env.RECAPTCHA_SITE_KEY || undefined,
  };
}
