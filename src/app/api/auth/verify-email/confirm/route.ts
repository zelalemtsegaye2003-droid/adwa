/**
 * Adwa Cyber — POST /api/auth/verify-email/confirm
 * Redeems a single-use email-verification token (24 h validity).
 * Unauthenticated by design — the link is opened from an email client.
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { redeemAuthToken } from "@/lib/auth/tokens";
import { rateLimit, clientIp } from "@/lib/auth/rate-limit";
import { audit } from "@/lib/auth/audit";

export async function POST(req: NextRequest) {
  const ip = clientIp(req.headers);

  const perIp = rateLimit(`verify-confirm:ip:${ip}`, 10, 15 * 60);
  if (!perIp.allowed) {
    return NextResponse.json(
      { error: { code: "RATE_LIMITED", message: "Too many attempts. Try again later." } },
      { status: 429, headers: { "Retry-After": String(perIp.retryAfterSeconds) } }
    );
  }

  let token = "";
  try {
    const body = await req.json();
    token = String(body.token ?? "").slice(0, 200);
  } catch {
    return NextResponse.json(
      { error: { code: "BAD_REQUEST", message: "Invalid JSON body." } },
      { status: 400 }
    );
  }
  if (!token) {
    return NextResponse.json(
      { error: { code: "VALIDATION", message: "Verification token is required." } },
      { status: 400 }
    );
  }

  const redeem = await redeemAuthToken(token, "EMAIL_VERIFY");
  if (!redeem.ok) {
    const message =
      redeem.reason === "EXPIRED"
        ? "This verification link has expired. Sign in and request a new one."
        : redeem.reason === "ALREADY_USED"
          ? "This verification link has already been used."
          : "This verification link is invalid.";
    return NextResponse.json({ error: { code: redeem.reason, message } }, { status: 400 });
  }

  const user = await db.user.update({
    where: { id: redeem.userId },
    data: { emailVerifiedAt: new Date() },
    select: { email: true, organizationId: true },
  });

  await audit({
    type: "EMAIL_VERIFIED",
    userId: redeem.userId,
    email: user.email,
    organizationId: user.organizationId,
    ip,
    userAgent: req.headers.get("user-agent"),
  });

  return NextResponse.json({ ok: true, message: "Email verified. Thank you." });
}
