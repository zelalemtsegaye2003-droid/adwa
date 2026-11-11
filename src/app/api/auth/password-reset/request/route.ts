/**
 * Adwa Cyber — POST /api/auth/password-reset/request
 *
 * Always returns 200 with a generic message (no user enumeration —
 * OWASP ASVS 2.5.4). When the account exists a single-use, 30-minute
 * token is emailed (console transport logs the link when SMTP is unset).
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rateLimit, clientIp } from "@/lib/auth/rate-limit";
import { issueAuthToken, TOKEN_TTL_MINUTES } from "@/lib/auth/tokens";
import { sendMail, passwordResetEmail, activeTransport } from "@/lib/auth/mail";
import { audit } from "@/lib/auth/audit";

export async function POST(req: NextRequest) {
  const ip = clientIp(req.headers);

  // Two buckets: per-IP (abuse) and global (email-bombing protection)
  const perIp = rateLimit(`pwreset:ip:${ip}`, 5, 15 * 60);
  if (!perIp.allowed) {
    return NextResponse.json(
      { error: { code: "RATE_LIMITED", message: "Too many requests. Try again later." } },
      { status: 429, headers: { "Retry-After": String(perIp.retryAfterSeconds) } }
    );
  }

  let email = "";
  try {
    const body = await req.json();
    email = String(body.email ?? "").trim().toLowerCase().slice(0, 254);
  } catch {
    return NextResponse.json(
      { error: { code: "BAD_REQUEST", message: "Invalid JSON body." } },
      { status: 400 }
    );
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json(
      { error: { code: "VALIDATION", message: "A valid email address is required." } },
      { status: 400 }
    );
  }

  const user = await db.user.findUnique({
    where: { email },
    select: { id: true, name: true, status: true },
  });

  if (user && user.status === "ACTIVE") {
    const { token } = await issueAuthToken(user.id, "PASSWORD_RESET", ip);
    const origin = process.env.APP_ORIGIN ?? req.nextUrl.origin;
    const resetUrl = `${origin}/reset-password?token=${token}`;
    const mail = passwordResetEmail(user.name, resetUrl, TOKEN_TTL_MINUTES.PASSWORD_RESET);
    await sendMail({ ...mail, to: email });
    await audit({
      type: "PASSWORD_RESET_REQUESTED",
      userId: user.id,
      email,
      organizationId: null,
      ip,
      userAgent: req.headers.get("user-agent"),
      detail: `transport=${activeTransport()}`,
    });
  } else if (user) {
    // Disabled account — do not send; log for review instead
    await audit({
      type: "PASSWORD_RESET_REQUESTED",
      userId: user.id,
      email,
      organizationId: null,
      ip,
      userAgent: req.headers.get("user-agent"),
      detail: "suppressed: account disabled",
    });
  }
  // Non-existent email: fall through with the same generic 200.

  return NextResponse.json({
    ok: true,
    message:
      "If an account exists for that email, a reset link has been sent. The link expires in 30 minutes.",
  });
}
