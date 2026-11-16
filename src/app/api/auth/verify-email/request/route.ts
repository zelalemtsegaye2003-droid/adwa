/**
 * Adwa Cyber — POST /api/auth/verify-email/request  (authenticated)
 * Sends (or re-sends) a verification email for the signed-in user.
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth/guard";
import { rateLimit, clientIp } from "@/lib/auth/rate-limit";
import { issueAuthToken } from "@/lib/auth/tokens";
import { sendMail, emailVerificationEmail, activeTransport } from "@/lib/auth/mail";
import { audit } from "@/lib/auth/audit";

export async function POST(req: NextRequest) {
  const guard = await requireAuth(req);
  if (guard.error) return guard.error;
  const user = guard.user;

  const ip = clientIp(req.headers);
  const perUser = rateLimit(`verify-email:user:${user.id}`, 3, 15 * 60);
  if (!perUser.allowed) {
    return NextResponse.json(
      { error: { code: "RATE_LIMITED", message: "Too many requests. Try again later." } },
      { status: 429, headers: { "Retry-After": String(perUser.retryAfterSeconds) } }
    );
  }

  const record = await db.user.findUnique({
    where: { id: user.id },
    select: { emailVerifiedAt: true, name: true, email: true },
  });
  if (!record) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "User not found." } }, { status: 404 });
  }
  if (record.emailVerifiedAt) {
    return NextResponse.json({ ok: true, alreadyVerified: true, message: "Email already verified." });
  }

  const { token } = await issueAuthToken(user.id, "EMAIL_VERIFY", ip);
  const origin = process.env.APP_ORIGIN ?? req.nextUrl.origin;
  const verifyUrl = `${origin}/verify-email?token=${token}`;
  const mail = emailVerificationEmail(record.name, verifyUrl);
  await sendMail({ ...mail, to: record.email });

  await audit({
    type: "EMAIL_VERIFICATION_SENT",
    userId: user.id,
    email: record.email,
    organizationId: user.orgId,
    ip,
    userAgent: req.headers.get("user-agent"),
    detail: `transport=${activeTransport()}`,
  });

  return NextResponse.json({ ok: true, message: "Verification email sent (valid 24 hours)." });
}
