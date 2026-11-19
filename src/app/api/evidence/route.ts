import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuthAny } from "@/lib/auth/guard";
import { can } from "@/lib/auth/rbac";
import { EVIDENCE_CATEGORIES, type EvidenceCategory } from "@/lib/compliance/evidence";

/**
 * GET /api/evidence — the tenant evidence library with filters + roll-up stats.
 * Query: search, category, status (ACTIVE|ARCHIVED|SUPERSEDED|ALL), org (super
 * admin only), rootId (version chain).
 */
export async function GET(req: NextRequest) {
  const guard = await requireAuthAny(req, ["evidence:view-org", "evidence:view-all"]);
  if (guard.error) return guard.error;
  const { user } = guard;

  const isSuper = can(user.role, "evidence:view-all");
  const sp = req.nextUrl.searchParams;
  const search = (sp.get("search") ?? "").trim().toLowerCase();
  const category = sp.get("category") ?? "";
  const status = (sp.get("status") ?? "ACTIVE").toUpperCase();
  const rootId = sp.get("rootId") ?? "";
  const orgFilter = isSuper ? sp.get("org") ?? "" : "";

  // Tenant scoping: org users are pinned to their own organization.
  const where: Record<string, unknown> = {
    ...(isSuper ? (orgFilter ? { organizationId: orgFilter } : {}) : { organizationId: user.orgId ?? "__none__" }),
    status: status === "ALL" ? { not: "DELETED" } : status,
  };
  if (category && EVIDENCE_CATEGORIES.includes(category as EvidenceCategory)) {
    where.category = category;
  }
  if (rootId) {
    where.OR = [{ id: rootId }, { rootId }];
  }
  if (search) {
    const contains = { contains: search };
    where.AND = [
      {
        OR: [{ title: contains }, { fileName: contains }, { description: contains }, { tags: contains }],
      },
    ];
  }

  const docs = await db.evidenceDocument.findMany({
    where,
    orderBy: [{ createdAt: "desc" }],
    include: {
      organization: { select: { id: true, name: true } },
      uploadedBy: { select: { id: true, name: true, email: true } },
    },
  });

  // Roll-up stats over the tenant scope (ignoring UI filters except org).
  const statsWhere = isSuper
    ? orgFilter
      ? { organizationId: orgFilter, status: { not: "DELETED" } }
      : { status: { not: "DELETED" } }
    : { organizationId: user.orgId ?? "__none__", status: { not: "DELETED" } };

  const allDocs = await db.evidenceDocument.findMany({
    where: statsWhere,
    select: { category: true, fileSize: true, downloads: true, status: true, rootId: true },
  });

  const byCategory: Record<string, number> = {};
  let storageBytes = 0;
  let totalDownloads = 0;
  for (const d of allDocs) {
    byCategory[d.category] = (byCategory[d.category] ?? 0) + 1;
    storageBytes += d.fileSize;
    totalDownloads += d.downloads;
  }

  return NextResponse.json({
    documents: docs.map((d) => ({
      id: d.id,
      title: d.title,
      description: d.description,
      category: d.category,
      tags: d.tags,
      fileName: d.fileName,
      mimeType: d.mimeType,
      fileSize: d.fileSize,
      checksum: d.checksum,
      status: d.status,
      version: d.version,
      rootId: d.rootId,
      downloads: d.downloads,
      lastVerifiedAt: d.lastVerifiedAt,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
      organizationId: d.organizationId,
      orgName: d.organization.name,
      uploadedBy: { id: d.uploadedBy.id, name: d.uploadedBy.name, email: d.uploadedBy.email },
      isSelfUpload: d.uploadedById === user.id,
    })),
    stats: {
      total: allDocs.length,
      active: allDocs.filter((d) => d.status === "ACTIVE").length,
      archived: allDocs.filter((d) => d.status === "ARCHIVED").length,
      superseded: allDocs.filter((d) => d.status === "SUPERSEDED").length,
      versionedChains: new Set(allDocs.filter((d) => d.rootId).map((d) => d.rootId)).size,
      storageBytes,
      totalDownloads,
      byCategory,
    },
    scope: isSuper ? (orgFilter || "all") : "org",
  });
}
