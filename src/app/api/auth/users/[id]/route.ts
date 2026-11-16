import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuthAny } from "@/lib/auth/guard";
import { can, ASSIGNABLE_ORG_ROLES, ROLES } from "@/lib/auth/rbac";
import { hashPassword } from "@/lib/auth/crypto";
import { revokeAllSessions } from "@/lib/auth/session";
import { isCommonPassword } from "@/lib/auth/passwords";
import { audit } from "@/lib/auth/audit";
import { clientIp } from "@/lib/auth/rate-limit";
import type { AppRole } from "@/lib/auth/jwt";

interface PatchBody {
  role?: string;
  status?: string;
  name?: string;
  password?: string; // admin-initiated reset
}

/**
 * PATCH /api/auth/users/[id] — change role / status / name / reset password.
 * Org admins may only touch users inside their tenant; role changes revoke
 * stale sessions (JWT claims carry the role).
 */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireAuthAny(req, ["users:manage-org", "users:manage-all"]);
  if (guard.error) return guard.error;
  const { user } = guard;
  const { id } = await ctx.params;
  if (!/^[a-zA-Z0-9_-]{10,}$/.test(id)) {
    return NextResponse.json({ error: { code: "BAD_ID", message: "Invalid user id." } }, { status: 400 });
  }

  let body: PatchBody;
  try {
    body = (await req.json()) as PatchBody;
  } catch {
    return NextResponse.json(
      { error: { code: "INVALID_JSON", message: "Request body must be valid JSON." } },
      { status: 400 }
    );
  }

  const target = await db.user.findUnique({ where: { id } });
  if (!target) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "User not found." } }, { status: 404 });
  }

  const isSuper = can(user.role, "users:manage-all");
  if (!isSuper && target.organizationId !== user.orgId) {
    return NextResponse.json(
      { error: { code: "CROSS_TENANT", message: "You can only manage users in your own organization." } },
      { status: 403 }
    );
  }

  const data: Record<string, unknown> = {};
  const changes: string[] = [];

  if (body.role !== undefined) {
    const allowed = isSuper ? ROLES : ASSIGNABLE_ORG_ROLES;
    if (!allowed.includes(body.role as AppRole)) {
      return NextResponse.json(
        { error: { code: "ROLE_NOT_ALLOWED", message: `Role must be one of: ${allowed.join(", ")}.` } },
        { status: 400 }
      );
    }
    if (target.id === user.id && body.role !== user.role) {
      return NextResponse.json(
        { error: { code: "SELF_ROLE_CHANGE", message: "You cannot change your own role." } },
        { status: 400 }
      );
    }
    data.role = body.role;
    data.organizationId = isSuper && body.role === "SUPER_ADMIN" ? null : target.organizationId;
    changes.push(`role ${target.role} → ${body.role}`);
  }

  if (body.status !== undefined) {
    if (!["ACTIVE", "DISABLED"].includes(body.status)) {
      return NextResponse.json(
        { error: { code: "BAD_STATUS", message: "Status must be ACTIVE or DISABLED." } },
        { status: 400 }
      );
    }
    if (target.id === user.id && body.status === "DISABLED") {
      return NextResponse.json(
        { error: { code: "SELF_DISABLE", message: "You cannot disable your own account." } },
        { status: 400 }
      );
    }
    data.status = body.status;
    changes.push(`status ${target.status} → ${body.status}`);
  }

  if (body.name !== undefined) {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (name.length < 2 || name.length > 100) {
      return NextResponse.json(
        { error: { code: "BAD_NAME", message: "Name must be 2–100 characters." } },
        { status: 400 }
      );
    }
    data.name = name;
    changes.push("name updated");
  }

  if (body.password !== undefined) {
    const pw = typeof body.password === "string" ? body.password : "";
    if (pw.length < 10 || pw.length > 200 || !/[a-zA-Z]/.test(pw) || !/[0-9]/.test(pw) || isCommonPassword(pw)) {
      return NextResponse.json(
        { error: { code: "WEAK_PASSWORD", message: "Password must be 10–200 chars with letters and numbers, not a common password." } },
        { status: 400 }
      );
    }
    data.passwordHash = hashPassword(pw);
    data.failedAttempts = 0;
    data.lockedUntil = null;
    changes.push("password reset");
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json(
      { error: { code: "EMPTY_PATCH", message: "Nothing to update." } },
      { status: 400 }
    );
  }

  const updated = await db.user.update({ where: { id }, data });

  // Role/status/password changes invalidate existing sessions.
  if (body.role !== undefined || body.status === "DISABLED" || body.password !== undefined) {
    await revokeAllSessions(id);
  }

  await audit({
    type: body.status === "DISABLED" ? "USER_DISABLED" : "USER_UPDATED",
    userId: updated.id,
    email: updated.email,
    organizationId: updated.organizationId,
    ip: clientIp(req.headers),
    userAgent: req.headers.get("user-agent"),
    detail: `${changes.join("; ")} — by ${user.email}.`,
  });

  return NextResponse.json({
    user: {
      id: updated.id,
      email: updated.email,
      name: updated.name,
      role: updated.role,
      status: updated.status,
      mfaEnabled: updated.mfaEnabled,
      organizationId: updated.organizationId,
      lastLoginAt: updated.lastLoginAt,
    },
  });
}
