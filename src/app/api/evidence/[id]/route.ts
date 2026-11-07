import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuthAny } from "@/lib/auth/guard";
import { can } from "@/lib/auth/rbac";
import { audit } from "@/lib/auth/audit";
import { clientIp } from "@/lib/auth/rate-limit";
import { EVIDENCE_CATEGORIES, type EvidenceCategory } from "@/lib/evidence";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

function jsonError(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

async function loadDoc(id: string) {
  return db.evidenceDocument.findUnique({
    where: { id },
    include: { organization: { select: { name: true } } },
  });
}

/** Can this user mutate this document? Manage permission, or own upload. */
function canMutate(
  user: { id: string; role: string; orgId: string | null },
  doc: { uploadedById: string; organizationId: string }
): boolean {
  if (can(user.role, "evidence:manage-all")) return true;
  if (can(user.role, "evidence:manage-org") && doc.organizationId === user.orgId) return true;
  // Officers may curate their own uploads (metadata, archive) without manage rights.
  return doc.uploadedById === user.id && doc.organizationId === user.orgId;
}

interface PatchBody {
  title?: string;
  description?: string;
  category?: string;
  tags?: string;
  action?: "archive" | "restore";
}

/** PATCH /api/evidence/[id] — edit metadata or archive/restore (soft lifecycle). */
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const guard = await requireAuthAny(req, ["evidence:upload", "evidence:manage-org", "evidence:manage-all"]);
  if (guard.error) return guard.error;
  const { user } = guard;
  const { id } = await ctx.params;

  let body: PatchBody;
  try {
    body = (await req.json()) as PatchBody;
  } catch {
    return jsonError(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  const doc = await loadDoc(id);
  if (!doc || doc.status === "DELETED") return jsonError(404, "NOT_FOUND", "Document not found.");
  if (doc.organizationId !== user.orgId && !can(user.role, "evidence:view-all")) {
    return jsonError(403, "CROSS_TENANT", "This document belongs to another organization.");
  }
  if (!canMutate(user, doc)) {
    return jsonError(403, "FORBIDDEN", "Only the uploader or an organization admin can modify this document.");
  }

  const auditBase = {
    userId: user.id,
    email: user.email,
    organizationId: doc.organizationId,
    ip: clientIp(req.headers),
    userAgent: req.headers.get("user-agent"),
  };

  // ── Lifecycle actions ─────────────────────────────────────────────────────
  if (body.action === "archive" || body.action === "restore") {
    if (body.action === "archive") {
      if (doc.status !== "ACTIVE") return jsonError(409, "BAD_STATE", "Only active documents can be archived.");
      await db.evidenceDocument.update({ where: { id }, data: { status: "ARCHIVED" } });
      await audit({ ...auditBase, type: "EVIDENCE_ARCHIVED", detail: `"${doc.title}" archived.` });
      return NextResponse.json({ ok: true, status: "ARCHIVED" });
    }
    // restore
    if (doc.status !== "ARCHIVED") return jsonError(409, "BAD_STATE", "Only archived documents can be restored.");
    // One ACTIVE version per chain.
    const chainRoot = doc.rootId ?? doc.id;
    const clash = await db.evidenceDocument.findFirst({
      where: { OR: [{ id: chainRoot }, { rootId: chainRoot }], status: "ACTIVE", NOT: { id: doc.id } },
      select: { id: true },
    });
    if (clash) {
      return jsonError(409, "CHAIN_ACTIVE", "A newer version of this document is already active.");
    }
    await db.evidenceDocument.update({ where: { id }, data: { status: "ACTIVE" } });
    await audit({ ...auditBase, type: "EVIDENCE_RESTORED", detail: `"${doc.title}" restored to active.` });
    return NextResponse.json({ ok: true, status: "ACTIVE" });
  }

  // ── Metadata edit ─────────────────────────────────────────────────────────
  const fieldErrors: Record<string, string> = {};
  const title = body.title?.trim();
  if (title !== undefined && (title.length < 3 || title.length > 160)) {
    fieldErrors.title = "Title must be 3–160 characters.";
  }
  const description = body.description?.trim();
  if (description !== undefined && description.length > 1000) {
    fieldErrors.description = "Description is too long (max 1000).";
  }
  const category = body.category?.trim();
  if (category !== undefined && !EVIDENCE_CATEGORIES.includes(category as EvidenceCategory)) {
    fieldErrors.category = "Choose a valid category.";
  }
  if (Object.keys(fieldErrors).length > 0) {
    return NextResponse.json(
      { error: { code: "VALIDATION", message: "Please fix the highlighted fields.", fieldErrors } },
      { status: 400 }
    );
  }

  await db.evidenceDocument.update({
    where: { id },
    data: {
      ...(title !== undefined ? { title } : {}),
      ...(description !== undefined ? { description: description || null } : {}),
      ...(category !== undefined ? { category } : {}),
      ...(body.tags !== undefined ? { tags: String(body.tags).trim() || null } : {}),
    },
  });

  await audit({
    ...auditBase,
    type: "EVIDENCE_UPDATED",
    detail: `Metadata of "${title ?? doc.title}" updated.`,
  });

  return NextResponse.json({ ok: true });
}

/** DELETE /api/evidence/[id] — soft delete (manage permission required). */
export async function DELETE(req: NextRequest, ctx: Ctx) {
  const guard = await requireAuthAny(req, ["evidence:manage-org", "evidence:manage-all"]);
  if (guard.error) return guard.error;
  const { user } = guard;
  const { id } = await ctx.params;

  const doc = await loadDoc(id);
  if (!doc || doc.status === "DELETED") return jsonError(404, "NOT_FOUND", "Document not found.");
  if (can(user.role, "evidence:manage-org") && doc.organizationId !== user.orgId) {
    return jsonError(403, "CROSS_TENANT", "This document belongs to another organization.");
  }

  // Soft delete: the record is hidden from the library; the stored file and
  // audit trail are preserved for forensic review (NBE record-retention).
  await db.evidenceDocument.update({ where: { id }, data: { status: "DELETED" } });

  await audit({
    type: "EVIDENCE_DELETED",
    userId: user.id,
    email: user.email,
    organizationId: doc.organizationId,
    ip: clientIp(req.headers),
    detail: `"${doc.title}" (${doc.fileName}) soft-deleted by ${user.email}. File retained for forensics.`,
  });

  return NextResponse.json({ ok: true });
}
