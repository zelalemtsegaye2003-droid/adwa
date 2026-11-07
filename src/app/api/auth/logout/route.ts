import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sha256 } from "@/lib/auth/crypto";
import { clearAuthCookies } from "@/lib/auth/session";
import { audit } from "@/lib/auth/audit";
import { clientIp } from "@/lib/auth/rate-limit";
import { getSessionUser } from "@/lib/auth/session";

/** POST /api/auth/logout — revoke the presented refresh token + clear cookies. */
export async function POST(req: NextRequest) {
  const user = await getSessionUser(req);
  const presented = req.cookies.get("adwa_rt")?.value;
  if (presented) {
    await db.refreshToken.updateMany({
      where: { tokenHash: sha256(presented), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
  if (user) {
    await audit({
      type: "LOGOUT",
      userId: user.id,
      email: user.email,
      organizationId: user.orgId,
      ip: clientIp(req.headers),
      userAgent: req.headers.get("user-agent"),
    });
  }
  const res = NextResponse.json({ ok: true });
  clearAuthCookies(res);
  return res;
}
