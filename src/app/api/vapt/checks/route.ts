import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuthAny, parseBody } from "@/lib/auth/guard";
import { can } from "@/lib/auth/rbac";
import { audit } from "@/lib/auth/audit";
import { clientIp } from "@/lib/auth/rate-limit";
import { parseCheckYaml } from "@/lib/vapt/vapt-checks";
import { appendVaptAudit } from "@/lib/vapt/vapt-audit";

export const runtime = "nodejs";

/** GET /api/vapt/checks — the organization's custom-check library. */
export async function GET(req: NextRequest) {
  const guard = await requireAuthAny(req, ["vapt:view-org", "vapt:view-all"]);
  if (guard.error) return guard.error;
  const { user } = guard;

  const isSuper = can(user.role, "vapt:view-all");
  const orgParam = req.nextUrl.searchParams.get("org") || "";
  const organizationId = isSuper ? orgParam || null : user.orgId;

  const checks = await db.vaptCustomCheck.findMany({
    where: organizationId ? { organizationId } : {},
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return NextResponse.json({ checks });
}

interface CheckBody {
  organizationId?: string;
  name?: string;
  yaml?: string;
  enabled?: boolean;
}

function checkSchema(data: unknown): CheckBody | null {
  if (typeof data !== "object" || data === null) return null;
  const d = data as Record<string, unknown>;
  return {
    organizationId: typeof d.organizationId === "string" ? d.organizationId : undefined,
    name: typeof d.name === "string" ? d.name.trim().slice(0, 120) : undefined,
    yaml: typeof d.yaml === "string" ? d.yaml.slice(0, 8_000) : undefined,
    enabled: d.enabled !== false,
  };
}

/**
 * POST /api/vapt/checks — register a custom check (YAML, declarative).
 * The YAML is parsed and validated NOW (no execution surface — matchers only);
 * malformed definitions are rejected with the parser's message.
 */
export async function POST(req: NextRequest) {
  const guard = await requireAuthAny(req, ["vapt:manage-org", "vapt:manage-all"]);
  if (guard.error) return guard.error;
  const { user } = guard;

  const parsed = await parseBody(req, checkSchema);
  if (parsed.error) return parsed.error;
  const body = parsed.data;

  const isSuper = can(user.role, "vapt:manage-all");
  const organizationId = isSuper ? body.organizationId : user.orgId;
  if (!organizationId) return NextResponse.json({ error: "organizationId is required" }, { status: 400 });
  if (!isSuper && body.organizationId && body.organizationId !== user.orgId) {
    return NextResponse.json({ error: "You can only create checks for your own organization" }, { status: 403 });
  }
  const org = await db.organization.findUnique({ where: { id: organizationId } });
  if (!org) return NextResponse.json({ error: "Organization not found" }, { status: 404 });

  if (!body.name || !body.yaml) {
    return NextResponse.json({ error: "name and yaml are required" }, { status: 400 });
  }
  let def;
  try {
    def = parseCheckYaml(body.yaml);
  } catch (err) {
    return NextResponse.json(
      { error: `Invalid check YAML: ${err instanceof Error ? err.message : String(err)}` },
      { status: 400 }
    );
  }

  const check = await db.vaptCustomCheck.create({
    data: {
      organizationId,
      name: body.name,
      yaml: body.yaml,
      enabled: body.enabled !== false,
      createdById: user.id,
    },
  });

  await appendVaptAudit({
    type: "CHECK_CREATED",
    actorId: user.id,
    actorEmail: user.email,
    organizationId,
    target: body.name,
    action: `Custom check "${body.name}" registered (${def.match.length} matcher(s), severity ${def.severity})`,
    result: "created — sandboxed declarative matcher, no execution surface",
    payload: { checkId: check.id, matchers: def.match.map((m) => m.type) },
  });
  await audit({
    type: "VAPT_CHECK_CREATED",
    userId: user.id,
    email: user.email,
    organizationId,
    ip: clientIp(req.headers),
    userAgent: req.headers.get("user-agent"),
    detail: `VAPT custom check "${body.name}" created by ${user.email}.`,
  });

  return NextResponse.json({ check, parsedDefinition: def }, { status: 201 });
}
