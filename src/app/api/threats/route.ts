import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuthAny } from "@/lib/auth/guard";
import { can } from "@/lib/auth/rbac";
import { audit } from "@/lib/auth/audit";
import { clientIp } from "@/lib/auth/rate-limit";
import {
  INDICATOR_TYPES, THREAT_CATEGORIES, TLP_MARKINGS,
  classifySensitivity, hybridSharingDecision,
} from "@/lib/soc-engine";

export const runtime = "nodejs";

/** Validates indicator value shape per type (defanged values accepted). */
function validValue(type: string, v: string): boolean {
  const s = v.trim().toLowerCase().replace(/^hxxp/i, "http").replace(/\[:\]/g, ":").replace(/\./g, ".");
  switch (type) {
    case "ip": {
      const parts = s.split(".");
      return parts.length === 4 && parts.every((p) => /^\d{1,3}$/.test(p) && Number(p) <= 255);
    }
    case "domain":
      return /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(s) && s.length <= 253;
    case "url":
      return /^https?:\/\/[^\s]+$/.test(s) && s.length <= 500;
    case "hash_sha256":
      return /^[a-f0-9]{64}$/.test(s);
    case "hash_md5":
      return /^[a-f0-9]{32}$/.test(s);
    case "email":
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
    case "filename":
      return s.length >= 3 && s.length <= 200 && !/[\/\\]/.test(s);
    case "cve":
      return /^cve-\d{4}-\d{4,7}$/i.test(s);
    default:
      return false;
  }
}

/**
 * GET /api/threats — the threat-intelligence hub (hybrid sharing model).
 *
 * Visibility per the AAU Collaborative Framework:
 *  - national feed + platform indicators (organizationId null): everyone
 *  - hub-broadcast indicators (sharing=HUB): every member organisation,
 *    with the originating org anonymised for everyone except the owner
 *  - own-tenant indicators: full detail
 *  - peer-to-peer indicators from other orgs: only if shared with you
 *
 * Filters: severity, category, source, tlp, q (search), active.
 */
export async function GET(req: NextRequest) {
  const guard = await requireAuthAny(req, ["threats:view"]);
  if (guard.error) return guard.error;
  const { user } = guard;

  const isSuper = can(user.role, "soc:view-all");
  const sp = req.nextUrl.searchParams;
  const severity = sp.get("severity") || "";
  const category = sp.get("category") || "";
  const source = sp.get("source") || "";
  const tlp = sp.get("tlp") || "";
  const q = (sp.get("q") || "").toLowerCase().trim();
  const activeOnly = sp.get("active") !== "false";

  // Peer-shared indicator ids visible to this tenant.
  const peerShared = isSuper
    ? []
    : await db.indicatorShare.findMany({
        where: { mode: "PEER_DIRECT", targetOrgId: user.orgId },
        select: { indicatorId: true },
      });
  const peerIds = new Set(peerShared.map((s) => s.indicatorId));

  // Visibility clause (hybrid sharing model) + search must co-exist → wrap in AND.
  const visibility = isSuper
    ? {}
    : {
        OR: [
          { organizationId: null },
          { organizationId: user.orgId },
          { sharing: "HUB" },
          ...(peerIds.size ? [{ id: { in: [...peerIds] } }] : []),
        ],
      };
  const search = q
    ? {
        OR: [
          { value: { contains: q } },
          { titleEn: { contains: q } },
          { titleAm: { contains: q } },
          { descriptionEn: { contains: q } },
        ],
      }
    : {};

  const indicators = await db.threatIndicator.findMany({
    where: {
      isActive: activeOnly ? true : undefined,
      ...(severity ? { severity } : {}),
      ...(category ? { category } : {}),
      ...(source ? { source } : {}),
      ...(tlp ? { tlp } : {}),
      ...(Object.keys(visibility).length || Object.keys(search).length ? { AND: [visibility, search] } : {}),
    },
    include: {
      organization: { select: { id: true, name: true } },
      _count: { select: { shares: true, incidents: true } },
    },
    orderBy: { lastSeenAt: "desc" },
  });

  const visible = indicators.map((i) => {
    const isOwner = i.organizationId === user.orgId;
    // Peer-to-peer grants identity visibility to the trusted partner:
    // a PEER_DIRECT share addressed to this tenant reveals the origin.
    const isPeerTarget = !isSuper && peerIds.has(i.id);
    const revealOrigin = isSuper || isOwner || !i.organizationId || isPeerTarget;
    return {
      id: i.id,
      type: i.type,
      value: i.value,
      titleEn: i.titleEn,
      titleAm: i.titleAm,
      descriptionEn: revealOrigin ? i.descriptionEn : i.descriptionEn, // descriptions are already sanitised
      category: i.category,
      severity: i.severity,
      tlp: i.tlp,
      source: i.source,
      sourceRef: i.sourceRef,
      confidence: i.confidence,
      sensitivity: i.sensitivity,
      sharing: i.sharing,
      // Privacy-preserving sharing: the originating org is NEVER revealed on
      // hub broadcasts — members see "a member organisation" instead.
      organizationId: revealOrigin ? i.organizationId : null,
      origin: revealOrigin ? (i.organization?.name ?? "Ethio-CERT national feed") : "A member organisation",
      originAnonymised: !revealOrigin,
      firstSeenAt: i.firstSeenAt,
      lastSeenAt: i.lastSeenAt,
      sightings: i.sightings,
      expiresAt: i.expiresAt,
      isActive: i.isActive,
      shareCount: i._count.shares,
      incidentCount: i._count.incidents,
    };
  });

  // Severity queue order: critical → high → medium → low, then most recently seen.
  const sevOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  visible.sort((a, b) => (sevOrder[a.severity] ?? 9) - (sevOrder[b.severity] ?? 9) || new Date(b.lastSeenAt).getTime() - new Date(a.lastSeenAt).getTime());

  return NextResponse.json({ indicators: visible, total: visible.length });
}

/**
 * POST /api/threats — contribute an indicator to the hub.
 * The engine classifies its sensitivity (category + TLP + confidence) and
 * makes the hybrid sharing decision (anonymised hub vs peer-to-peer), which
 * is recorded on the indicator and returned to the analyst.
 */
export async function POST(req: NextRequest) {
  const guard = await requireAuthAny(req, ["threats:contribute"]);
  if (guard.error) return guard.error;
  const { user } = guard;

  const body = await req.json();
  const type = String(body.type || "");
  const value = typeof body.value === "string" ? body.value.trim() : "";
  const category = String(body.category || "");
  const severity = String(body.severity || "");
  const tlp = TLP_MARKINGS.includes(body.tlp) ? body.tlp : "TLP:AMBER";

  if (!INDICATOR_TYPES.includes(type as (typeof INDICATOR_TYPES)[number])) {
    return NextResponse.json({ error: `type must be one of ${INDICATOR_TYPES.join(", ")}` }, { status: 400 });
  }
  if (!validValue(type, value)) {
    return NextResponse.json({ error: `"${value.slice(0, 80)}" is not a valid ${type} indicator.` }, { status: 400 });
  }
  if (!THREAT_CATEGORIES.includes(category as (typeof THREAT_CATEGORIES)[number])) {
    return NextResponse.json({ error: `category must be one of ${THREAT_CATEGORIES.join(", ")}` }, { status: 400 });
  }
  if (!["critical", "high", "medium", "low"].includes(severity)) {
    return NextResponse.json({ error: "severity must be critical | high | medium | low" }, { status: 400 });
  }
  const titleEn = typeof body.titleEn === "string" ? body.titleEn.trim().slice(0, 200) : "";
  if (titleEn.length < 5) {
    return NextResponse.json({ error: "titleEn must be at least 5 characters." }, { status: 400 });
  }
  const titleAm = typeof body.titleAm === "string" && body.titleAm.trim() ? body.titleAm.trim().slice(0, 200) : titleEn;
  const confidence = Math.max(0, Math.min(100, Number(body.confidence ?? 60)));

  const existing = await db.threatIndicator.findUnique({ where: { type_value: { type, value } } });
  if (existing) {
    return NextResponse.json({ error: `This ${type} indicator already exists in the hub (sightings: ${existing.sightings}).` }, { status: 409 });
  }

  const sensitivity = classifySensitivity(category, tlp, confidence);
  const decision = hybridSharingDecision({ tlp, sensitivity, category });

  const isSuper = can(user.role, "soc:manage-all");
  const indicator = await db.threatIndicator.create({
    data: {
      type,
      value,
      titleEn,
      titleAm,
      descriptionEn: typeof body.descriptionEn === "string" ? body.descriptionEn.trim().slice(0, 1000) : null,
      descriptionAm: typeof body.descriptionAm === "string" ? body.descriptionAm.trim().slice(0, 1000) : null,
      category,
      severity,
      tlp,
      source: "ORG_UPLOAD",
      confidence,
      sensitivity,
      sharing: decision.mode,
      organizationId: isSuper ? (typeof body.organizationId === "string" ? body.organizationId : null) : user.orgId,
      createdById: user.id,
    },
  });

  await audit({
    type: "THREAT_CREATED",
    userId: user.id,
    email: user.email,
    organizationId: indicator.organizationId,
    ip: clientIp(req.headers),
    userAgent: req.headers.get("user-agent"),
    detail: `Indicator ${type} ${value} (${severity}/${category}, ${tlp}) added to the hub — routing: ${decision.mode} (${decision.reason})`,
  });

  return NextResponse.json({ indicator, sharingDecision: decision }, { status: 201 });
}
