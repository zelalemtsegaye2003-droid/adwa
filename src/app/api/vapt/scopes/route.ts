import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuthAny, parseBody } from "@/lib/auth/guard";
import { can } from "@/lib/auth/rbac";
import { audit } from "@/lib/auth/audit";
import { clientIp } from "@/lib/auth/rate-limit";
import { parseScopeTargets } from "@/lib/vapt/vapt-scope";
import { appendVaptAudit } from "@/lib/vapt/vapt-audit";

export const runtime = "nodejs";

/**
 * GET /api/vapt/scopes — authorization-scope register (tenant-scoped).
 * Viewers see the scope list; the four-eyes state (requester ≠ approver) is
 * visible per scope so auditors can verify the rule at a glance.
 */
export async function GET(req: NextRequest) {
  const guard = await requireAuthAny(req, ["vapt:view-org", "vapt:view-all"]);
  if (guard.error) return guard.error;
  const { user } = guard;

  const isSuper = can(user.role, "vapt:view-all");
  const orgParam = req.nextUrl.searchParams.get("org") || "";
  const organizationId = isSuper ? orgParam || null : user.orgId;

  const scopes = await db.vaptScope.findMany({
    where: organizationId ? { organizationId } : {},
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      requestedBy: { select: { id: true, email: true, name: true } },
      approvedBy: { select: { id: true, email: true, name: true } },
      organization: { select: { id: true, name: true } },
    },
  });
  const now = new Date();
  return NextResponse.json({
    scopes: scopes.map((s) => ({
      ...s,
      targetsParsed: parseScopeTargets(s.targets) ?? [],
      fourEyes: !!s.approvedById && s.approvedById !== s.requestedById,
      live: s.status === "APPROVED" && new Date(s.validFrom) <= now && now <= new Date(s.validUntil),
    })),
  });
}

interface ScopeBody {
  organizationId?: string;
  name?: string;
  targets?: unknown; // [{ kind, value }]
  owner?: string;
  authorizationNote?: string;
  validFrom?: string;
  validUntil?: string;
  intrusiveAllowed?: boolean;
}

function scopeSchema(data: unknown): ScopeBody | null {
  if (typeof data !== "object" || data === null) return null;
  const d = data as Record<string, unknown>;
  return {
    organizationId: typeof d.organizationId === "string" ? d.organizationId : undefined,
    name: typeof d.name === "string" ? d.name.trim().slice(0, 120) : undefined,
    targets: d.targets,
    owner: typeof d.owner === "string" ? d.owner.trim().slice(0, 120) : undefined,
    authorizationNote: typeof d.authorizationNote === "string" ? d.authorizationNote.trim().slice(0, 400) : undefined,
    validFrom: typeof d.validFrom === "string" ? d.validFrom : undefined,
    validUntil: typeof d.validUntil === "string" ? d.validUntil : undefined,
    intrusiveAllowed: d.intrusiveAllowed === true,
  };
}

/**
 * POST /api/vapt/scopes — request an authorization scope (DRAFT).
 * The scope only authorizes scans after a SECOND user approves it
 * (PATCH on /api/vapt/scopes/[id]) — the four-eyes rule from plan §1.
 */
export async function POST(req: NextRequest) {
  const guard = await requireAuthAny(req, ["vapt:manage-org", "vapt:manage-all"]);
  if (guard.error) return guard.error;
  const { user } = guard;

  const parsed = await parseBody(req, scopeSchema);
  if (parsed.error) return parsed.error;
  const body = parsed.data;

  const isSuper = can(user.role, "vapt:manage-all");
  const organizationId = isSuper ? body.organizationId : user.orgId;
  if (!organizationId) return NextResponse.json({ error: "organizationId is required" }, { status: 400 });
  if (!isSuper && body.organizationId && body.organizationId !== user.orgId) {
    return NextResponse.json({ error: "You can only create scopes for your own organization" }, { status: 403 });
  }
  const org = await db.organization.findUnique({ where: { id: organizationId } });
  if (!org) return NextResponse.json({ error: "Organization not found" }, { status: 404 });

  if (!body.name || !body.targets || !body.owner || !body.authorizationNote || !body.validFrom || !body.validUntil) {
    return NextResponse.json(
      { error: "name, targets, owner, authorizationNote, validFrom and validUntil are all required — a scope is a written authorization object, not a bare IP list." },
      { status: 400 }
    );
  }
  const validTargets = parseScopeTargets(JSON.stringify(body.targets));
  if (!validTargets || !validTargets.length) {
    return NextResponse.json(
      { error: "targets must be a non-empty array of { kind: 'cidr'|'ip'|'domain'|'url', value } entries with valid values." },
      { status: 400 }
    );
  }
  const from = new Date(body.validFrom);
  const until = new Date(body.validUntil);
  if (Number.isNaN(from.getTime()) || Number.isNaN(until.getTime()) || until <= from) {
    return NextResponse.json({ error: "validUntil must be after validFrom" }, { status: 400 });
  }
  if (until.getTime() - from.getTime() > 366 * 86_400_000) {
    return NextResponse.json({ error: "A scope may span at most one year — re-authorize annually." }, { status: 400 });
  }

  const scope = await db.vaptScope.create({
    data: {
      organizationId,
      name: body.name,
      targets: JSON.stringify(validTargets),
      owner: body.owner,
      authorizationNote: body.authorizationNote,
      validFrom: from,
      validUntil: until,
      status: "DRAFT",
      intrusiveAllowed: body.intrusiveAllowed === true,
      requestedById: user.id,
    },
  });

  await appendVaptAudit({
    type: "SCOPE_CREATED",
    actorId: user.id,
    actorEmail: user.email,
    organizationId,
    target: scope.name,
    action: `Authorization scope "${scope.name}" requested (${validTargets.length} target(s), window ${body.validFrom} → ${body.validUntil})`,
    result: "DRAFT — awaiting a second user's approval (four-eyes)",
    payload: { scopeId: scope.id, targets: validTargets, owner: body.owner, intrusiveAllowed: scope.intrusiveAllowed },
  });
  await audit({
    type: "VAPT_SCOPE_CREATED",
    userId: user.id,
    email: user.email,
    organizationId,
    ip: clientIp(req.headers),
    userAgent: req.headers.get("user-agent"),
    detail: `VAPT scope "${scope.name}" requested by ${user.email} — awaiting four-eyes approval.`,
  });

  return NextResponse.json({ scope: { ...scope, targetsParsed: validTargets } }, { status: 201 });
}
