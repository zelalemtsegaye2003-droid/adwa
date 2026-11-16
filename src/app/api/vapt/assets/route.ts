import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuthAny, parseBody } from "@/lib/auth/guard";
import { can } from "@/lib/auth/rbac";
import { audit } from "@/lib/auth/audit";
import { clientIp } from "@/lib/auth/rate-limit";

export const runtime = "nodejs";

const KINDS = ["SERVER", "NETWORK", "FIREWALL", "DATABASE", "AD_IDENTITY", "WEBAPP", "API", "CLOUD", "ENDPOINT", "CONTAINER", "K8S"];
const ENVIRONMENTS = ["PROD", "UAT", "DEV", "DMZ", "EXTERNAL"];
const SURFACES = ["INTERNAL", "EXTERNAL"];
const CRITICALITIES = ["critical", "high", "medium", "low"];

/** A web/API asset's identifier must be an http(s) URL — the DAST engine's target. */
function validateIdentifier(kind: string, identifier: string): string | null {
  if (kind === "WEBAPP" || kind === "API") {
    try {
      const u = new URL(identifier);
      if (u.protocol !== "http:" && u.protocol !== "https:") return "Target must start with http:// or https://";
      if (u.username || u.password) return "Target URL must not carry credentials";
      if (identifier.length > 200) return "Target URL too long";
      return null;
    } catch {
      return "Target must be a valid http(s) URL (e.g. https://app.bank.et)";
    }
  }
  if (!identifier.trim()) return "Identifier (IP / hostname) is required";
  if (identifier.length > 200) return "Identifier too long";
  return null;
}

interface AssetBody {
  organizationId?: string;
  name: string;
  kind: string;
  identifier: string;
  environment: string;
  surface: string;
  criticality: string;
  osOrPlatform?: string;
  tags?: string[];
  managed?: boolean;
  notes?: string;
}

function assetSchema(data: unknown): AssetBody | null {
  if (typeof data !== "object" || data === null) return null;
  const d = data as Record<string, unknown>;
  if (typeof d.name !== "string" || !d.name.trim()) return null;
  if (typeof d.kind !== "string" || !KINDS.includes(d.kind)) return null;
  if (typeof d.identifier !== "string") return null;
  return {
    organizationId: typeof d.organizationId === "string" ? d.organizationId : undefined,
    name: d.name.trim().slice(0, 120),
    kind: d.kind,
    identifier: d.identifier.trim(),
    environment: ENVIRONMENTS.includes(d.environment as string) ? (d.environment as string) : "PROD",
    surface: SURFACES.includes(d.surface as string) ? (d.surface as string) : "INTERNAL",
    criticality: CRITICALITIES.includes(d.criticality as string) ? (d.criticality as string) : "medium",
    osOrPlatform: typeof d.osOrPlatform === "string" ? d.osOrPlatform.trim().slice(0, 120) : undefined,
    tags: Array.isArray(d.tags) ? d.tags.filter((t) => typeof t === "string" && t.trim()).map((t) => String(t).trim().slice(0, 30)).slice(0, 12) : [],
    managed: typeof d.managed === "boolean" ? d.managed : true,
    notes: typeof d.notes === "string" ? d.notes.trim().slice(0, 400) : undefined,
  };
}

/**
 * GET /api/vapt/assets — attack-surface registry (EASM).
 * Each row carries open-vulnerability counts and priority rollups.
 */
export async function GET(req: NextRequest) {
  const guard = await requireAuthAny(req, ["vapt:view-org", "vapt:view-all"]);
  if (guard.error) return guard.error;
  const { user } = guard;

  const isSuper = can(user.role, "vapt:view-all");
  const orgParam = req.nextUrl.searchParams.get("org") || "";
  const organizationId = isSuper ? orgParam || null : user.orgId;

  const assets = await db.vaptAsset.findMany({
    where: organizationId ? { organizationId } : {},
    orderBy: { createdAt: "asc" },
    include: {
      organization: { select: { id: true, name: true, nameAm: true } },
      vulnerabilities: { select: { severity: true, status: true, priorityScore: true, kev: true } },
    },
  });

  return NextResponse.json({
    scope: isSuper ? (organizationId ? "org" : "platform") : "tenant",
    assets: assets.map((a) => {
      const openish = a.vulnerabilities.filter((v) => v.status === "open" || v.status === "in_progress");
      return {
        id: a.id,
        name: a.name,
        kind: a.kind,
        identifier: a.identifier,
        environment: a.environment,
        surface: a.surface,
        criticality: a.criticality,
        osOrPlatform: a.osOrPlatform,
        tags: JSON.parse(a.tags) as string[],
        managed: a.managed,
        notes: a.notes,
        lastSeenAt: a.lastSeenAt,
        organization: a.organization,
        vulnCount: a.vulnerabilities.length,
        openCount: openish.length,
        criticalOpen: openish.filter((v) => v.severity === "critical").length,
        kevOpen: openish.filter((v) => v.kev).length,
        topPriority: openish.reduce((m, v) => Math.max(m, v.priorityScore), 0),
      };
    }),
  });
}

/** POST /api/vapt/assets — register an asset in the attack-surface registry. */
export async function POST(req: NextRequest) {
  const guard = await requireAuthAny(req, ["vapt:manage-org", "vapt:manage-all"]);
  if (guard.error) return guard.error;
  const { user } = guard;

  const parsed = await parseBody(req, assetSchema);
  if (parsed.error) return parsed.error;
  const body = parsed.data;

  const isSuper = can(user.role, "vapt:manage-all");
  const organizationId = isSuper ? body.organizationId : user.orgId;
  if (!organizationId) {
    return NextResponse.json({ error: "organizationId is required" }, { status: 400 });
  }
  if (!isSuper && body.organizationId && body.organizationId !== user.orgId) {
    return NextResponse.json({ error: "You can only register assets for your own organization" }, { status: 403 });
  }
  const org = await db.organization.findUnique({ where: { id: organizationId } });
  if (!org) return NextResponse.json({ error: "Organization not found" }, { status: 404 });

  const idErr = validateIdentifier(body.kind, body.identifier);
  if (idErr) return NextResponse.json({ error: idErr }, { status: 400 });

  // Duplicate guard: same org + identifier already registered.
  const dupe = await db.vaptAsset.findFirst({ where: { organizationId, identifier: body.identifier } });
  if (dupe) {
    return NextResponse.json(
      { error: `An asset with this identifier already exists (${dupe.name})` },
      { status: 409 }
    );
  }

  const asset = await db.vaptAsset.create({
    data: {
      organizationId,
      name: body.name,
      kind: body.kind,
      identifier: body.identifier,
      environment: body.environment,
      surface: body.surface,
      criticality: body.criticality,
      osOrPlatform: body.osOrPlatform ?? null,
      tags: JSON.stringify(body.tags ?? []),
      managed: body.managed ?? true,
      notes: body.notes ?? null,
    },
  });

  await audit({
    type: "VAPT_ASSET_CREATED",
    userId: user.id,
    email: user.email,
    organizationId,
    ip: clientIp(req.headers),
    userAgent: req.headers.get("user-agent"),
    detail: `Asset "${asset.name}" (${asset.kind}, ${asset.identifier}, ${asset.surface}/${asset.environment}) registered for ${org.name}.`,
  });

  return NextResponse.json({ asset }, { status: 201 });
}
