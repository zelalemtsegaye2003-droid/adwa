/**
 * Adwa Cyber — outbound mail abstraction for account recovery.
 *
 * Transports, chosen automatically:
 *   1. SMTP  — when SMTP_HOST is configured (uses nodemailer via dynamic
 *              import, so the dependency is optional at build time).
 *   2. console — always logs; the DEFAULT in dev and as a fallback so a
 *              missing SMTP config never silently swallows a reset link.
 *
 * Security: mail bodies never contain passwords. Reset links carry a
 * single-use token bound to a SHA-256 hash stored server-side.
 */

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export type MailTransport = "smtp" | "console";

export function activeTransport(): MailTransport {
  return process.env.SMTP_HOST ? "smtp" : "console";
}

const FROM = process.env.MAIL_FROM ?? "Adwa Cyber <no-reply@adwacyber.et>";
const APP_NAME = "Adwa Cyber";

async function sendViaSmtp(msg: MailMessage): Promise<void> {
  // Dynamic import keeps builds green when nodemailer is not installed;
  // SMTP_HOST being set is an explicit operator promise that it is.
  const mod = (await import("nodemailer")).default;
  const transport = mod.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  });
  await transport.sendMail({ from: FROM, ...msg });
}

export async function sendMail(msg: MailMessage): Promise<void> {
  if (activeTransport() === "smtp") {
    await sendViaSmtp(msg);
    return;
  }
  // Console transport — the token URL lands in the server log where the
  // operator (dev, or a pilot admin without SMTP yet) can retrieve it.
  console.log(
    `\n━━━ [mail:console] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `To:      ${msg.to}\nSubject: ${msg.subject}\n` +
      `─`.repeat(52) + `\n${msg.text}\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`
  );
}

/** Branded email templates (plain-text first — deliverability + a11y). */
export function passwordResetEmail(name: string, resetUrl: string, ttlMinutes: number) {
  const subject = `${APP_NAME} — password reset request`;
  const text =
    `Hello ${name},\n\n` +
    `We received a request to reset your ${APP_NAME} password.\n\n` +
    `Open this link to choose a new password (valid for ${ttlMinutes} minutes,\n` +
    `single use):\n\n${resetUrl}\n\n` +
    `If you did not request this, you can ignore this email — your current\n` +
    `password remains active and all existing sessions stay signed in.\n\n` +
    `— The ${APP_NAME} team`;
  const html =
    `<p>Hello ${name},</p>` +
    `<p>We received a request to reset your ${APP_NAME} password.</p>` +
    `<p><a href="${resetUrl}">Choose a new password</a> ` +
    `(valid ${ttlMinutes} minutes, single use).</p>` +
    `<p>If you did not request this, ignore this email — your current password remains active.</p>` +
    `<p>— The ${APP_NAME} team</p>`;
  return { to: "", subject, text, html } as MailMessage;
}

export function emailVerificationEmail(name: string, verifyUrl: string) {
  const subject = `${APP_NAME} — confirm your email address`;
  const text =
    `Hello ${name},\n\n` +
    `Welcome to ${APP_NAME}. Please confirm this email address:\n\n${verifyUrl}\n\n` +
    `The link is valid for 24 hours.\n\n— The ${APP_NAME} team`;
  const html =
    `<p>Hello ${name},</p><p>Welcome to ${APP_NAME}. Please confirm your email address:</p>` +
    `<p><a href="${verifyUrl}">Confirm email</a> (valid 24 hours).</p>` +
    `<p>— The ${APP_NAME} team</p>`;
  return { to: "", subject, text, html } as MailMessage;
}
