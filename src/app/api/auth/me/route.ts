import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth/guard";
import { permissionsOf, ROLE_LABELS } from "@/lib/auth/rbac";
import type { AppRole } from "@/lib/auth/jwt";

/** GET /api/auth/me — current identity, tenant and effective permissions. */
export async function GET(req: NextRequest) {
  const guard = await requireAuth(req);
  if (guard.error) return guard.error;
  const { user } = guard;

  const full = await db.user.findUnique({
    where: { id: user.id },
    include: { organization: { select: { id: true, name: true, sector: true, status: true } } },
  });

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      roleLabel: ROLE_LABELS[user.role as AppRole] ?? user.role,
      orgId: user.orgId,
      orgName: full?.organization?.name ?? null,
      orgSector: full?.organization?.sector ?? null,
      orgStatus: full?.organization?.status ?? null,
      mfaEnabled: full?.mfaEnabled ?? false,
      authProvider: full?.authProvider ?? "LOCAL",
      googleLinked: Boolean(full?.googleId),
      lastLoginAt: full?.lastLoginAt ?? null,
      createdAt: full?.createdAt ?? null,
      avatarUrl: full?.avatarUrl ?? null,
    },
    permissions: permissionsOf(user.role),
  });
}
