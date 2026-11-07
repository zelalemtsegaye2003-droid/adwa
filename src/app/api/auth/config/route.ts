import { NextResponse } from "next/server";
import { googleConfigured } from "@/lib/auth/google";
import { captchaConfig } from "@/lib/auth/captcha";

/**
 * GET /api/auth/config — public auth configuration for the login screen.
 * Tells the client which providers are available (never leaks secrets).
 */
export async function GET() {
  return NextResponse.json({
    googleEnabled: googleConfigured(),
    captcha: captchaConfig(),
    passwordPolicy: {
      minLength: 10,
      hint: "At least 10 characters with letters and numbers.",
    },
  });
}
