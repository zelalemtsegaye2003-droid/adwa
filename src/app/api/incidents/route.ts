import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuthAny } from "@/lib/auth/guard";
import { can } from "@/lib/auth/rbac";
import { audit } from "@/lib/auth/audit";
import { clientIp } from "@/lib/auth/rate-limit";
import { prioritiseIncident, INCIDENT_CATEGORIES, DETECTION_METHODS, INCIDENT_SOURCES } from "@/lib/soc-engine";

export const runtime = "nodejs";

/**
 * GET /api/incidents — SOC incident queue (NIST SP 800-61 lifecycle).
 * Tenant users see their organisation's incidents; SUPER_ADMIN sees all
 * (optionally scoped with ?org=<id>). Filters: status, severity, category.
 * Each row is enriched with the detection→notification latency (RQ3).
 */
export async function GET(req: NextRequest) {
  const guard = await requireAuthAny(req, ["soc:view-org", "soc:view-all"]);
  if (guard.error) return guard.error;
  const { user } = guard;

  const isSuper = can(user.role, "soc:view-all");
  const sp = req.nextUrl.searchParams;
  const orgParam = sp.get("org") || "";
  const statusFilter = sp.get("status") || "";
  const severityFilter = sp.get("severity") || "";
  const categoryFilter = sp.get("category") || "";

  const organizationId = isSuper ? orgParam || null : user.orgId;
  if (!isSuper && !organizationId) {
    return NextResponse.json({ error: { code: "ORG_REQUIRED", message: "Your account has no organization." } }, { status: 400 });
  }

  const incidents = await db.incident.findMany({
    where: {
      ...(organizationId ? { organizationId } : {}),
      ...(statusFilter ? { status: statusFilter } : {}),
      ...(severityFilter ? { severity: severityFilter } : {}),
      ...(categoryFilter ? { category: categoryFilter } : {}),
    },
    include: {
      organization: { select: { id: true, name: true, nameAm: true, sector: true } },
      assignee: { select: { id: true, name: true } },
      _count: { select: { events: true, indicators: true } },
    },
    orderBy: { detectedAt: "desc" },
  });

  const now = new Date();
  const enriched = incidents.map((i) => ({
    ...i,
    notificationLatencyMin:
      i.notifiedAt
        ? Math.round(((new Date(i.notifiedAt).getTime() - new Date(i.detectedAt).getTime()) / 60_000) * 10) / 10
        : null,
    ageMinutes: Math.round((now.getTime() - new Date(i.detectedAt).getTime()) / 60_000),
  }));

  // Queue order: priority score desc, then newest first.
  enriched.sort((a, b) => (b.priorityScore ?? 0) - (a.priorityScore ?? 0) || b.ageMinutes - a.ageMinutes);

  return NextResponse.json({
    scope: isSuper ? (organizationId ? "org" : "platform") : "tenant",
    incidents: enriched,
  });
}

/**
 * POST /api/incidents — record a newly detected incident.
 * The soc-engine prioritises it immediately (severity × sector targeting ×
 * confidence × freshness) so the SOC queue is ordered by actionable risk.
 */
export async function POST(req: NextRequest) {
  const guard = await requireAuthAny(req, ["soc:manage-org", "soc:manage-all"]);
  if (guard.error) return guard.error;
  const { user } = guard;

  const body = await req.json();
  const isSuper = can(user.role, "soc:manage-all");
  // An org user may only create incidents for its own tenant; passing a
  // foreign organizationId is an explicit cross-tenant attempt → 403.
  if (!isSuper && typeof body.organizationId === "string" && body.organizationId !== user.orgId) {
    return NextResponse.json({ error: "Incidents can only be created for your own organization." }, { status: 403 });
  }
  const organizationId = isSuper && typeof body.organizationId === "string" ? body.organizationId : user.orgId;
  if (!organizationId) {
    return NextResponse.json({ error: { code: "ORG_REQUIRED", message: "No target organization." } }, { status: 400 });
  }
  if (!isSuper && organizationId !== user.orgId) {
    return NextResponse.json({ error: "Incidents can only be created for your own organization." }, { status: 403 });
  }

  const title = typeof body.title === "string" ? body.title.trim().slice(0, 200) : "";
  if (title.length < 5) {
    return NextResponse.json({ error: "Title must be at least 5 characters." }, { status: 400 });
  }
  const category = String(body.category || "");
  const severity = String(body.severity || "");
  if (!INCIDENT_CATEGORIES.includes(category as (typeof INCIDENT_CATEGORIES)[number])) {
    return NextResponse.json({ error: `category must be one of ${INCIDENT_CATEGORIES.join(", ")}` }, { status: 400 });
  }
  if (!["critical", "high", "medium", "low"].includes(severity)) {
    return NextResponse.json({ error: "severity must be critical | high | medium | low" }, { status: 400 });
  }
  const source = INCIDENT_SOURCES.includes(body.source) ? body.source : "SOC_MONITOR";
  const detectionMethod = DETECTION_METHODS.includes(body.detectionMethod) ? body.detectionMethod : "signature";
  const detectedAt = body.detectedAt ? new Date(body.detectedAt) : new Date();
  if (isNaN(detectedAt.getTime())) {
    return NextResponse.json({ error: "detectedAt must be a valid ISO date." }, { status: 400 });
  }
  const description = typeof body.description === "string" ? body.description.trim().slice(0, 2000) : null;

  const org = await db.organization.findUnique({ where: { id: organizationId }, select: { sector: true, name: true } });
  const ageMinutes = Math.max(0, (Date.now() - detectedAt.getTime()) / 60_000);
  const pri = prioritiseIncident({
    severity,
    category,
    orgSector: org?.sector,
    confidence: typeof body.confidence === "number" ? body.confidence : 70,
    ageMinutes,
  });

  // Human-readable incident reference: INC-2026-0007
  const year = new Date().getFullYear();
  const count = await db.incident.count();
  const ref = `INC-${year}-${String(count + 1).padStart(4, "0")}`;

  const incident = await db.incident.create({
    data: {
      organizationId,
      ref,
      title,
      titleAm: typeof body.titleAm === "string" && body.titleAm.trim() ? body.titleAm.trim().slice(0, 200) : "",
      description,
      category,
      severity,
      source,
      detectionMethod,
      detectedAt,
      priorityScore: pri.score,
      priorityLabel: pri.label,
      events: {
        create: {
          type: "DETECTED",
          note: `Priority ${pri.score}/100 (${pri.label}) — ${pri.rationale}`,
          actorId: user.id,
        },
      },
    },
    include: { organization: { select: { id: true, name: true, sector: true } } },
  });

  await audit({
    type: "INCIDENT_CREATED",
    userId: user.id,
    email: user.email,
    organizationId,
    ip: clientIp(req.headers),
    userAgent: req.headers.get("user-agent"),
    detail: `Incident ${ref} (${severity}/${category}) for ${org?.name ?? organizationId}: "${title}" — priority ${pri.score}/100 ${pri.label}`,
  });

  return NextResponse.json({ incident, prioritisation: pri }, { status: 201 });
}
