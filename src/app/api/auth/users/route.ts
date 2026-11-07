import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuthAny } from "@/lib/auth/guard";
import { hashPassword } from "@/lib/auth/crypto";
import { can, ASSIGNABLE_ORG_ROLES, ORG_ROLES, ROLES } from "@/lib/auth/rbac";
import { audit } from "@/lib/auth/audit";
import { clientIp } from "@/lib/auth/rate-limit";
import type { AppRole } from "@/lib/auth/jwt";

/** GET /api/auth/users — tenant user directory (org-scoped, or all for SUPER_ADMIN). */
export async function GET(req: NextRequest) {
  const guard = await requireAuthAny(req, ["users:view-org", "users:view-all"]);
  if (guard.error) return guard.error;
  const { user } = guard;

  const isSuper = can(user.role, "users:view-all");
  const where = isSuper ? {} : { organizationId: user.orgId ?? "__none__" };

  const users = await db.user.findMany({
    where,
    orderBy: { createdAt: "asc" },
    include: { organization: { select: { id: true, name: true } } },
  });

  return NextResponse.json({
    users: users.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      status: u.status,
      mfaEnabled: u.mfaEnabled,
      authProvider: u.authProvider,
      organizationId: u.organizationId,
      orgName: u.organization?.name ?? null,
      lastLoginAt: u.lastLoginAt,
      createdAt: u.createdAt,
      isSelf: u.id === user.id,
    })),
    assignableRoles: isSuper ? ROLES : ASSIGNABLE_ORG_ROLES,
  });
}

interface CreateBody {
  name?: string;
  email?: string;
  role?: string;
  password?: string;
  organizationId?: string;
}

/** POST /api/auth/users — provision a user (org admins scope to their tenant). */
export async function POST(req: NextRequest) {
  const guard = await requireAuthAny(req, ["users:manage-org", "users:manage-all"]);
  if (guard.error) return guard.error;
  const { user } = guard;

  let body: CreateBody;
  try {
    body = (await req.json()) as CreateBody;
  } catch {
    return NextResponse.json(
      { error: { code: "INVALID_JSON", message: "Request body must be valid JSON." } },
      { status: 400 }
    );
  }

  const isSuper = can(user.role, "users:manage-all");
  const name = body.name?.trim() ?? "";
  const email = body.email?.trim().toLowerCase() ?? "";
  const password = body.password ?? "";
  const role = body.role ?? "";

  // Target tenant: super admins may pick any; org admins are pinned to their own.
  const organizationId = isSuper ? body.organizationId ?? null : user.orgId;

  const fieldErrors: Record<string, string> = {};
  if (name.length < 2) fieldErrors.name = "Name is required.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fieldErrors.email = "A valid email is required.";
  if (password.length < 10 || !/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    fieldErrors.password = "At least 10 characters with letters and numbers.";
  }
  if (!isSuper && !ORG_ROLES.includes(role as AppRole)) {
    fieldErrors.role = `Role must be one of: ${ASSIGNABLE_ORG_ROLES.join(", ")}.`;
  }
  if (isSuper && !ROLES.includes(role as AppRole)) {
    fieldErrors.role = `Role must be one of: ${ROLES.join(", ")}.`;
  }
  if (isSuper && role !== "SUPER_ADMIN" && !organizationId) {
    fieldErrors.organizationId = "Organization is required for tenant roles.";
  }
  if (Object.keys(fieldErrors).length > 0) {
    return NextResponse.json(
      { error: { code: "VALIDATION", message: "Please fix the highlighted fields.", fieldErrors } },
      { status: 400 }
    );
  }

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json(
      { error: { code: "EMAIL_TAKEN", message: "A user with this email already exists." } },
      { status: 409 }
    );
  }

  if (organizationId) {
    const org = await db.organization.findUnique({ where: { id: organizationId } });
    if (!org) {
      return NextResponse.json(
        { error: { code: "ORG_NOT_FOUND", message: "Target organization not found." } },
        { status: 404 }
      );
    }
  }

  const created = await db.user.create({
    data: {
      email,
      name,
      passwordHash: hashPassword(password),
      role,
      organizationId: role === "SUPER_ADMIN" ? null : organizationId,
      authProvider: "LOCAL",
    },
    include: { organization: { select: { name: true } } },
  });

  await audit({
    type: "USER_CREATED",
    userId: created.id,
    email,
    organizationId: created.organizationId,
    ip: clientIp(req.headers),
    userAgent: req.headers.get("user-agent"),
    detail: `${role} ${email} provisioned by ${user.email}.`,
  });

  return NextResponse.json(
    {
      user: {
        id: created.id,
        email: created.email,
        name: created.name,
        role: created.role,
        status: created.status,
        orgName: created.organization?.name ?? null,
        mfaEnabled: false,
        authProvider: "LOCAL",
        lastLoginAt: null,
        createdAt: created.createdAt,
        isSelf: false,
      },
    },
    { status: 201 }
  );
}
