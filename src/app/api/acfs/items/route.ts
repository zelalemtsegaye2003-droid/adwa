import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, parseBody } from "@/lib/auth/guard";
import { audit } from "@/lib/auth/audit";
import { clientIp } from "@/lib/auth/rate-limit";
import { ACFS_DOMAINS, ACFS_STATUSES } from "@/lib/governance/acfs-gates";

export const runtime = "nodejs";

/**
 * POST /api/acfs/items — add a custom precondition requirement to a gate
 * domain (SUPER_ADMIN). The seeded register covers the proposal's four
 * domains; governance may extend it as consultations surface new conditions.
 */
export async function POST(req: NextRequest) {
  const guard = await requireAuth(req, "acfs:manage");
  if (guard.error) return guard.error;
  const { user } = guard;

  const parsed = await parseBody(req, (raw) => {
    if (typeof raw !== "object" || raw === null) return null;
    const b = raw as Record<string, unknown>;
    if (typeof b.domain !== "string" || !(ACFS_DOMAINS as readonly string[]).includes(b.domain)) return null;
    if (typeof b.titleEn !== "string" || b.titleEn.trim().length < 3) return null;
    const status = typeof b.status === "string" && (ACFS_STATUSES as readonly string[]).includes(b.status) ? b.status : "NOT_STARTED";
    return {
      domain: b.domain,
      titleEn: b.titleEn.trim(),
      titleAm: typeof b.titleAm === "string" && b.titleAm.trim() ? b.titleAm.trim() : b.titleEn.trim(),
      description: typeof b.description === "string" ? b.description.trim() : null,
      status,
      owner: typeof b.owner === "string" && b.owner.trim() ? b.owner.trim() : null,
      dueDate: typeof b.dueDate === "string" && b.dueDate ? new Date(b.dueDate) : null,
      notes: typeof b.notes === "string" ? b.notes.trim() : null,
    };
  });
  if (parsed.error) return parsed.error;
  const data = parsed.data;

  // Stable code: next sequence within the domain (EMA-04, TRA-06, …).
  const prefix = data.domain.slice(0, 3);
  const existing = await db.acfsGateItem.findMany({ where: { domain: data.domain }, select: { code: true, sortOrder: true } });
  let next = existing.length + 1;
  const codes = new Set(existing.map((e) => e.code));
  while (codes.has(`${prefix}-${String(next).padStart(2, "0")}`)) next++;
  const code = `${prefix}-${String(next).padStart(2, "0")}`;

  const item = await db.acfsGateItem.create({
    data: { ...data, code, sortOrder: Math.max(...existing.map((e) => e.sortOrder), 0) + 10 },
  });

  await audit({
    type: "ACFS_ITEM_CREATED",
    userId: user.id,
    email: user.email,
    organizationId: user.orgId,
    ip: clientIp(req.headers),
    userAgent: req.headers.get("user-agent"),
    detail: `ACFS precondition ${code} added to ${data.domain}: "${data.titleEn}"`,
  });

  return NextResponse.json({ item }, { status: 201 });
}
