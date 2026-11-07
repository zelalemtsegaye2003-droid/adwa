import { NextRequest, NextResponse } from "next/server";
import { createCaptcha } from "@/lib/auth/captcha";
import { rateLimit, clientIp } from "@/lib/auth/rate-limit";

/** GET/POST /api/auth/captcha — issue a fresh one-time SVG captcha challenge. */
async function handle(req: NextRequest) {
  const ip = clientIp(req.headers);
  const rl = rateLimit(`captcha:${ip}`, 30, 60_000); // max 30/min per IP
  if (!rl.allowed) {
    return NextResponse.json(
      { error: { code: "RATE_LIMITED", message: "Too many captcha requests. Try again shortly." } },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } }
    );
  }
  const challenge = await createCaptcha();
  return NextResponse.json(challenge, { headers: { "Cache-Control": "no-store" } });
}

export { handle as GET, handle as POST };
