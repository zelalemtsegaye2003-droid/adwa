import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth/crypto";
import { verifyCaptcha } from "@/lib/auth/captcha";
import { issueSession, setAuthCookies } from "@/lib/auth/session";
import { audit } from "@/lib/auth/audit";
import { rateLimit, clientIp } from "@/lib/auth/rate-limit";

interface RegisterBody {
  organizationName?: string;
  organizationNameAm?: string;
  sector?: string;
  contactEmail?: string;
  adminName?: string;
  adminEmail?: string;
  password?: string;
  captchaId?: string;
  captchaAnswer?: string;
}

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || `org-${Date.now()}`
  );
}

/**
 * POST /api/auth/register — self-service tenant onboarding.
 * Creates a new Organization + its first ORG_ADMIN, then signs them in.
 * Any signed-in SUPER_ADMIN registering an org does NOT get auto-signed-in
 * as that org's admin.
 */
export async function POST(req: NextRequest) {
  const ip = clientIp(req.headers);
  let body: RegisterBody;
  try {
    body = (await req.json()) as RegisterBody;
  } catch {
    return NextResponse.json(
      { error: { code: "INVALID_JSON", message: "Request body must be valid JSON." } },
      { status: 400 }
    );
  }

  const rl = rateLimit(`register:${ip}`, 5, 60 * 60_000); // 5/hour per IP
  if (!rl.allowed) {
    return NextResponse.json(
      { error: { code: "RATE_LIMITED", message: "Too many registrations from this network." } },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } }
    );
  }

  const captchaOk = await verifyCaptcha({
    captchaId: body.captchaId,
    captchaAnswer: body.captchaAnswer,
    remoteIp: ip,
  });
  if (!captchaOk) {
    await audit({ type: "CAPTCHA_FAILED", email: body.adminEmail?.toLowerCase() ?? "", ip, detail: "register" });
    return NextResponse.json(
      { error: { code: "CAPTCHA_FAILED", message: "Captcha verification failed. Please try the new challenge." } },
      { status: 400 }
    );
  }

  const orgName = body.organizationName?.trim() ?? "";
  const adminName = body.adminName?.trim() ?? "";
  const adminEmail = body.adminEmail?.trim().toLowerCase() ?? "";
  const password = body.password ?? "";

  const fieldErrors: Record<string, string> = {};
  if (orgName.length < 2) fieldErrors.organizationName = "Organization name is required.";
  if (adminName.length < 2) fieldErrors.adminName = "Administrator name is required.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail)) fieldErrors.adminEmail = "A valid email is required.";
  if (password.length < 10 || !/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    fieldErrors.password = "Password must be at least 10 characters and include letters and numbers.";
  }
  if (Object.keys(fieldErrors).length > 0) {
    return NextResponse.json(
      { error: { code: "VALIDATION", message: "Please fix the highlighted fields.", fieldErrors } },
      { status: 400 }
    );
  }

  const existingUser = await db.user.findUnique({ where: { email: adminEmail } });
  if (existingUser) {
    return NextResponse.json(
      {
        error: {
          code: "EMAIL_TAKEN",
          message: "This email already has an account. Sign in instead, or use a different email.",
        },
      },
      { status: 409 }
    );
  }

  // Unique slug.
  let slug = slugify(orgName);
  const slugTaken = await db.organization.findUnique({ where: { slug } });
  if (slugTaken) slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;

  const org = await db.organization.create({
    data: {
      name: orgName,
      nameAm: body.organizationNameAm?.trim() ?? "",
      slug,
      sector: body.sector?.trim() || "Other",
      contactEmail: body.contactEmail?.trim() || adminEmail,
      status: "onboarding",
    },
  });

  const user = await db.user.create({
    data: {
      email: adminEmail,
      name: adminName,
      passwordHash: hashPassword(password),
      role: "ORG_ADMIN",
      organizationId: org.id,
      authProvider: "LOCAL",
      lastLoginAt: new Date(),
    },
  });

  await audit({
    type: "REGISTER_ORG",
    userId: user.id,
    email: user.email,
    organizationId: org.id,
    ip,
    userAgent: req.headers.get("user-agent"),
    detail: `Organization '${orgName}' onboarded with first admin ${adminEmail}.`,
  });
  await audit({
    type: "USER_CREATED",
    userId: user.id,
    email: user.email,
    organizationId: org.id,
    ip,
    detail: `ORG_ADMIN ${adminEmail} created via self-registration.`,
  });

  // Sign the new admin straight in.
  const tokens = await issueSession(user, req);
  const res = NextResponse.json(
    {
      organization: { id: org.id, name: org.name },
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        orgId: org.id,
        orgName: org.name,
        mfaEnabled: false,
      },
    },
    { status: 201 }
  );
  setAuthCookies(res, tokens.accessToken, tokens.refreshToken);
  return res;
}
