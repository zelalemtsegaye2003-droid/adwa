import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuthAny, parseBody } from "@/lib/auth/guard";
import { can } from "@/lib/auth/rbac";
import { audit } from "@/lib/auth/audit";
import { clientIp } from "@/lib/auth/rate-limit";
import { prioritise } from "@/lib/vapt/vapt-engine";

export const runtime = "nodejs";

const KINDS = ["SERVER", "NETWORK", "FIREWALL", "DATABASE", "AD_IDENTITY", "WEBAPP", "API", "CLOUD", "ENDPOINT", "CONTAINER", "K8S"];
const ENVIRONMENTS = ["PROD", "UAT", "DEV", "DMZ", "EXTERNAL"];
const SURFACES = ["INTERNAL", "EXTERNAL"];
const CRITICALITIES = ["critical", "high", "medium", "low"];

/** GET /api/vapt/assets/[id] — asset detail with its vulnerability history. */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireAuthAny(req, ["vapt:view-org", "vapt:view-all"]);
  if (guard.error) return guard.error;
  const { user } = guard;
  const { id } = await ctx.params;

  const asset = await db.vaptAsset.findUnique({
    where: { id },
    include: {
      organization: { select: { id: true, name: true, nameAm: true } },
      vulnerabilities: { orderBy: { detectedAt: "desc" } },
    },
  });
  if (!asset) return NextResponse.json({ error: "Asset not found" }, { status: 404 });

  const isSuper = can(user.role, "vapt:view-all");
  if (!isSuper && asset.organizationId !== user.orgId) {
    return NextResponse.json({ error: "This asset belongs to another organization" }, { status: 403 });
  }
  return NextResponse.json({ asset });
}

interface PatchBody {
  name?: string;
  kind?: string;
  identifier?: string;
  environment?: string;
  surface?: string;
  criticality?: string;
  osOrPlatform?: string | null;
  tags?: string[];
  managed?: boolean;
  notes?: string | null;
}

function patchSchema(data: unknown): PatchBody | null {
  if (typeof data !== "object" || data === null) return null;
  const d = data as Record<string, unknown>;
  if (d.name !== undefined && (typeof d.name !== "string" || !d.name.trim())) return null;
  if (d.kind !== undefined && !KINDS.includes(d.kind as string)) return null;
  if (d.identifier !== undefined && typeof d.identifier !== "string") return null;
  if (d.environment !== undefined && !ENVIRONMENTS.includes(d.environment as string)) return null;
  if (d.surface !== undefined && !SURFACES.includes(d.surface as string)) return null;
  if (d.criticality !== undefined && !CRITICALITIES.includes(d.criticality as string)) return null;
  if (d.osOrPlatform !== undefined && d.osOrPlatform !== null && typeof d.osOrPlatform !== "string") return null;
  if (d.notes !== undefined && d.notes !== null && typeof d.notes !== "string") return null;
  if (d.tags !== undefined && !Array.isArray(d.tags)) return null;
  if (d.managed !== undefined && typeof d.managed !== "boolean") return null;
  return {
    name: d.name !== undefined ? String(d.name).trim().slice(0, 120) : undefined,
    kind: d.kind as string | undefined,
    identifier: d.identifier !== undefined ? d.identifier.trim() : undefined,
    environment: d.environment as string | undefined,
    surface: d.surface as string | undefined,
    criticality: d.criticality as string | undefined,
    osOrPlatform: d.osOrPlatform === null ? null : typeof d.osOrPlatform === "string" ? d.osOrPlatform.trim().slice(0, 120) : undefined,
    tags: Array.isArray(d.tags) ? d.tags.filter((t) => typeof t === "string" && t.trim()).map((t) => String(t).trim().slice(0, 30)).slice(0, 12) : undefined,
    managed: d.managed as boolean | undefined,
    notes: d.notes === null ? null : typeof d.notes === "string" ? d.notes.trim().slice(0, 400) : undefined,
  };
}

/** PATCH /api/vapt/assets/[id] — update registry metadata (tenant-isolated). */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireAuthAny(req, ["vapt:manage-org", "vapt:manage-all"]);
  if (guard.error) return guard.error;
  const { user } = guard;
  const { id } = await ctx.params;

  const parsed = await parseBody(req, patchSchema);
  if (parsed.error) return parsed.error;
  const body = parsed.data;

  const existing = await db.vaptAsset.findUnique({ where: { id }, include: { vulnerabilities: { select: { id: true } } } });
  if (!existing) return NextResponse.json({ error: "Asset not found" }, { status: 404 });
  const isSuper = can(user.role, "vapt:manage-all");
  if (!isSuper && existing.organizationId !== user.orgId) {
    return NextResponse.json({ error: "This asset belongs to another organization" }, { status: 403 });
  }

  // Changing the identifier of a web target re-anchors the DAST engine.
  const effectiveKind = body.kind ?? existing.kind;
  if (body.identifier && body.identifier !== existing.identifier) {
    if (effectiveKind === "WEBAPP" || effectiveKind === "API") {
      try {
        const u = new URL(body.identifier);
        if (u.protocol !== "http:" && u.protocol !== "https:") throw new Error("protocol");
        if (u.username || u.password) throw new Error("userinfo");
      } catch {
        return NextResponse.json({ error: "Target must be a valid http(s) URL without credentials" }, { status: 400 });
      }
    }
    const dupe = await db.vaptAsset.findFirst({ where: { organizationId: existing.organizationId, identifier: body.identifier } });
    if (dupe) return NextResponse.json({ error: "Another asset already uses this identifier" }, { status: 409 });
  }

  // A criticality/surface change re-scores the asset's open vulnerabilities
  // (the tender's §custom business-context risk formulas — adjustments must
  // propagate, not silently keep stale priorities).
  const asset = await db.vaptAsset.update({
    where: { id },
    data: {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.kind !== undefined ? { kind: body.kind } : {}),
      ...(body.identifier !== undefined ? { identifier: body.identifier } : {}),
      ...(body.environment !== undefined ? { environment: body.environment } : {}),
      ...(body.surface !== undefined ? { surface: body.surface } : {}),
      ...(body.criticality !== undefined ? { criticality: body.criticality } : {}),
      ...(body.osOrPlatform !== undefined ? { osOrPlatform: body.osOrPlatform } : {}),
      ...(body.tags !== undefined ? { tags: JSON.stringify(body.tags) } : {}),
      ...(body.managed !== undefined ? { managed: body.managed } : {}),
      ...(body.notes !== undefined ? { notes: body.notes } : {}),
      lastSeenAt: new Date(),
    },
  });

  const contextChanged =
    body.criticality !== undefined || body.surface !== undefined || body.environment !== undefined;
  let rescored = 0;
  if (contextChanged) {
    const openish = await db.vaptVulnerability.findMany({
      where: { assetId: id, status: { in: ["open", "in_progress"] } },
    });
    for (const v of openish) {
      const p = prioritise({
        cvssScore: v.cvssScore, epss: v.epss, kev: v.kev,
        assetCriticality: asset.criticality, assetSurface: asset.surface, assetEnvironment: asset.environment,
      });
      if (p.score !== v.priorityScore || p.priorityClass !== v.priorityClass) {
        await db.vaptVulnerability.update({ where: { id: v.id }, data: { priorityScore: p.score, priorityClass: p.priorityClass } });
        rescored++;
      }
    }
  }

  await audit({
    type: "VAPT_ASSET_UPDATED",
    userId: user.id,
    email: user.email,
    organizationId: existing.organizationId,
    ip: clientIp(req.headers),
    userAgent: req.headers.get("user-agent"),
    detail: `Asset "${asset.name}" updated (${[body.criticality && `criticality→${body.criticality}`, body.surface && `surface→${body.surface}`, body.managed !== undefined && `managed→${body.managed}`].filter(Boolean).join(", ") || "metadata"}).`,
  });

  return NextResponse.json({ asset, vulnCount: existing.vulnerabilities.length });
}

/** DELETE /api/vapt/assets/[id] — remove asset + its findings (cascade). */
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireAuthAny(req, ["vapt:manage-org", "vapt:manage-all"]);
  if (guard.error) return guard.error;
  const { user } = guard;
  const { id } = await ctx.params;

  const existing = await db.vaptAsset.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Asset not found" }, { status: 404 });
  const isSuper = can(user.role, "vapt:manage-all");
  if (!isSuper && existing.organizationId !== user.orgId) {
    return NextResponse.json({ error: "This asset belongs to another organization" }, { status: 403 });
  }

  await db.vaptAsset.delete({ where: { id } });
  await audit({
    type: "VAPT_ASSET_DELETED",
    userId: user.id,
    email: user.email,
    organizationId: existing.organizationId,
    ip: clientIp(req.headers),
    userAgent: req.headers.get("user-agent"),
    detail: `Asset "${existing.name}" (${existing.identifier}) and its vulnerability history deleted.`,
  });
  return NextResponse.json({ ok: true });
}
