import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuthAny } from "@/lib/auth/guard";
import { can } from "@/lib/auth/rbac";
import { audit } from "@/lib/auth/audit";
import { clientIp } from "@/lib/auth/rate-limit";

export const runtime = "nodejs";

function jsonError(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

/**
 * GET /api/rules/links?evidenceId= — rules linked to one evidence document
 * (for the vault details dialog).
 */
export async function GET(req: NextRequest) {
  const guard = await requireAuthAny(req, ["evidence:view-org", "evidence:view-all"]);
  if (guard.error) return guard.error;
  const { user } = guard;

  const evidenceId = req.nextUrl.searchParams.get("evidenceId") ?? "";
  if (!evidenceId) return jsonError(400, "PARAM", "evidenceId is required.");

  const doc = await db.evidenceDocument.findUnique({
    where: { id: evidenceId },
    select: { id: true, organizationId: true, status: true },
  });
  if (!doc || doc.status === "DELETED") return jsonError(404, "NOT_FOUND", "Document not found.");
  if (!can(user.role, "evidence:view-all") && doc.organizationId !== user.orgId) {
    return jsonError(403, "CROSS_TENANT", "This document belongs to another organization.");
  }

  const links = await db.evidenceLink.findMany({
    where: { evidenceId },
    include: {
      rule: { select: { id: true, code: true, article: true, titleEn: true, titleAm: true, severity: true, pillar: true } },
      createdBy: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    links: links.map((l) => ({
      id: l.id,
      ruleId: l.ruleId,
      code: l.rule.code,
      article: l.rule.article,
      titleEn: l.rule.titleEn,
      titleAm: l.rule.titleAm,
      severity: l.rule.severity,
      pillar: l.rule.pillar,
      linkType: l.linkType,
      source: l.source,
      createdBy: l.createdBy.name,
      createdAt: l.createdAt,
    })),
  });
}

/**
 * POST /api/rules/links — link an evidence document to an obligation.
 * Body: { evidenceId, ruleCode | ruleId, linkType? ("SATISFIES" | "SUPPORTS") }
 */
export async function POST(req: NextRequest) {
  const guard = await requireAuthAny(req, ["evidence:upload", "evidence:manage-org", "evidence:manage-all"]);
  if (guard.error) return guard.error;
  const { user } = guard;

  let body: { evidenceId?: string; ruleCode?: string; ruleId?: string; linkType?: string };
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  const evidenceId = (body.evidenceId ?? "").trim();
  const linkType = body.linkType === "SUPPORTS" ? "SUPPORTS" : "SATISFIES";
  if (!evidenceId) return jsonError(400, "PARAM", "evidenceId is required.");
  if (!body.ruleCode && !body.ruleId) return jsonError(400, "PARAM", "Provide ruleCode or ruleId.");

  const doc = await db.evidenceDocument.findUnique({ where: { id: evidenceId } });
  if (!doc || doc.status === "DELETED") return jsonError(404, "NOT_FOUND", "Document not found.");
  if (!can(user.role, "evidence:manage-all") && doc.organizationId !== user.orgId) {
    return jsonError(403, "CROSS_TENANT", "This document belongs to another organization.");
  }

  const rule = body.ruleId
    ? await db.rule.findUnique({ where: { id: body.ruleId } })
    : await db.rule.findUnique({ where: { code: (body.ruleCode ?? "").toUpperCase() } });
  if (!rule || !rule.isActive) {
    return jsonError(404, "RULE_NOT_FOUND", `Rule "${body.ruleCode ?? body.ruleId}" not found in the catalogue.`);
  }

  const existing = await db.evidenceLink.findUnique({
    where: { ruleId_evidenceId: { ruleId: rule.id, evidenceId } },
  });
  if (existing) {
    if (existing.linkType === linkType && existing.source === "MANUAL") {
      return NextResponse.json({ link: existing, duplicate: true });
    }
    // Upgrade an AUTO_TAG link or change its type.
    const updated = await db.evidenceLink.update({
      where: { id: existing.id },
      data: { linkType, source: "MANUAL" },
    });
    return NextResponse.json({ link: updated, updated: true });
  }

  const link = await db.evidenceLink.create({
    data: { ruleId: rule.id, evidenceId, linkType, source: "MANUAL", createdById: user.id },
  });

  await audit({
    type: "EVIDENCE_LINKED",
    userId: user.id,
    email: user.email,
    organizationId: doc.organizationId,
    ip: clientIp(req.headers),
    userAgent: req.headers.get("user-agent"),
    detail: `"${doc.title}" linked to ${rule.code} (${rule.titleEn}) as ${linkType}.`,
  });

  return NextResponse.json({ link }, { status: 201 });
}

/**
 * DELETE /api/rules/links?id=<linkId> — remove a link. Allowed for the link
 * creator, evidence manage permission holders, or the uploader of the doc.
 */
export async function DELETE(req: NextRequest) {
  const guard = await requireAuthAny(req, ["evidence:upload", "evidence:manage-org", "evidence:manage-all"]);
  if (guard.error) return guard.error;
  const { user } = guard;

  const id = req.nextUrl.searchParams.get("id") ?? "";
  if (!id) return jsonError(400, "PARAM", "Link id is required.");

  const link = await db.evidenceLink.findUnique({
    where: { id },
    include: { evidence: { select: { id: true, title: true, organizationId: true, uploadedById: true } }, rule: { select: { code: true } } },
  });
  if (!link) return jsonError(404, "NOT_FOUND", "Link not found.");

  const sameTenant = link.evidence.organizationId === user.orgId;
  if (!can(user.role, "evidence:manage-all") && !sameTenant) {
    return jsonError(403, "CROSS_TENANT", "This link belongs to another organization.");
  }
  const mayDelete =
    can(user.role, "evidence:manage-all") ||
    (can(user.role, "evidence:manage-org") && sameTenant) ||
    link.createdById === user.id ||
    link.evidence.uploadedById === user.id;
  if (!mayDelete) {
    return jsonError(403, "FORBIDDEN", "Only the link creator or an administrator can remove this link.");
  }

  await db.evidenceLink.delete({ where: { id } });

  await audit({
    type: "EVIDENCE_UNLINKED",
    userId: user.id,
    email: user.email,
    organizationId: link.evidence.organizationId,
    ip: clientIp(req.headers),
    userAgent: req.headers.get("user-agent"),
    detail: `"${link.evidence.title}" unlinked from ${link.rule.code}.`,
  });

  return NextResponse.json({ ok: true });
}
