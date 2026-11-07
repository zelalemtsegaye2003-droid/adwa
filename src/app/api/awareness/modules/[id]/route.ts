import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, parseBody } from "@/lib/auth/guard";
import { audit } from "@/lib/auth/audit";

export const runtime = "nodejs";

/**
 * PATCH /api/awareness/modules/[id] — update curriculum content or archive /
 * restore a unit. Every content change bumps the version so teachers can see
 * which edition a class studied.
 */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireAuth(req, "awareness:manage");
  if (guard.error) return guard.error;
  const { user } = guard;
  const { id } = await ctx.params;

  const existing = await db.awarenessModule.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Module not found" }, { status: 404 });

  const parsed = await parseBody(req, (raw) => {
    const b = raw as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    if (typeof b.titleEn === "string" && b.titleEn.trim()) out.titleEn = b.titleEn.trim();
    if (typeof b.titleAm === "string" && b.titleAm.trim()) out.titleAm = b.titleAm.trim();
    if (typeof b.summaryEn === "string" && b.summaryEn.trim()) out.summaryEn = b.summaryEn.trim();
    if (typeof b.summaryAm === "string" && b.summaryAm.trim()) out.summaryAm = b.summaryAm.trim();
    if (typeof b.contentEn === "string" && b.contentEn.trim()) out.contentEn = b.contentEn.trim();
    if (typeof b.contentAm === "string" && b.contentAm.trim()) out.contentAm = b.contentAm.trim();
    if (typeof b.topic === "string" && b.topic.trim()) out.topic = b.topic.trim();
    if (b.durationMin !== undefined && Number(b.durationMin) > 0) out.durationMin = Number(b.durationMin);
    if (typeof b.gradeBand === "string" && b.gradeBand.trim()) out.gradeBand = b.gradeBand.trim();
    if (typeof b.isActive === "boolean") out.isActive = b.isActive;
    return Object.keys(out).length > 0 ? out : null;
  });
  if ("error" in parsed) return parsed.error;

  const isArchiveToggle = typeof parsed.data.isActive === "boolean";
  const mod = await db.awarenessModule.update({
    where: { id },
    data: {
      ...parsed.data,
      // Archiving/restoring is not a content change; keep the version stable.
      version: isArchiveToggle ? existing.version : bump(existing.version),
    },
  });

  await audit({
    type: "AWARENESS_MODULE_UPDATED",
    userId: user.id,
    email: user.email,
    organizationId: null,
    detail: `Module ${mod.code} updated (v${mod.version}${isArchiveToggle ? `, active=${parsed.data.isActive}` : ""})`,
  });

  return NextResponse.json({ module: { id: mod.id, code: mod.code, version: mod.version, isActive: mod.isActive } });
}

function bump(v: string): string {
  const [maj, min] = v.split(".").map((x) => parseInt(x, 10) || 0);
  return `${maj}.${min + 1}`;
}
