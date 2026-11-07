import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth/guard";
import { can } from "@/lib/auth/rbac";
import { audit } from "@/lib/auth/audit";
import { clientIp } from "@/lib/auth/rate-limit";
import {
  checkFileType,
  sanitizeDisplayFileName,
  makeStoredName,
  writeEvidenceFile,
  sha256Hex,
  EVIDENCE_CATEGORIES,
  type EvidenceCategory,
} from "@/lib/evidence";

export const runtime = "nodejs";

function bad(status: number, code: string, message: string, fieldErrors?: Record<string, string>) {
  return NextResponse.json({ error: { code, message, ...(fieldErrors ? { fieldErrors } : {}) } }, { status });
}

/**
 * POST /api/evidence/upload — multipart upload of a compliance artefact.
 * Fields: file, title, category, description?, tags?, organizationId? (super
 * admin only), replaceId? (upload a new version of an existing document).
 */
export async function POST(req: NextRequest) {
  const guard = await requireAuth(req, "evidence:upload");
  if (guard.error) return guard.error;
  const { user } = guard;
  const isSuper = can(user.role, "evidence:manage-all");

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return bad(400, "INVALID_FORM", "Expected multipart/form-data with a file field.");
  }

  const file = form.get("file");
  if (!file || typeof file === "string" || typeof (file as File).arrayBuffer !== "function") {
    return bad(400, "NO_FILE", "Attach a file to upload.");
  }
  const upload = file as File;

  const title = String(form.get("title") ?? "").trim();
  const category = String(form.get("category") ?? "OTHER").trim();
  const description = String(form.get("description") ?? "").trim();
  const tags = String(form.get("tags") ?? "").trim();
  const replaceId = String(form.get("replaceId") ?? "").trim();
  const requestedOrg = String(form.get("organizationId") ?? "").trim();

  const fileName = sanitizeDisplayFileName(upload.name || "file");

  // ── Validation ────────────────────────────────────────────────────────────
  const head = Buffer.from(await upload.arrayBuffer());
  const typeCheck = checkFileType(fileName, upload.type || "application/octet-stream", upload.size, head.subarray(0, 8));
  if (!typeCheck.ok) {
    await audit({
      type: "EVIDENCE_REJECTED",
      userId: user.id,
      email: user.email,
      organizationId: user.orgId,
      ip: clientIp(req.headers),
      detail: `${fileName} rejected: ${typeCheck.reason}`,
    });
    return bad(400, "FILE_REJECTED", typeCheck.reason ?? "File rejected.");
  }

  const fieldErrors: Record<string, string> = {};
  if (title.length < 3 || title.length > 160) fieldErrors.title = "Title must be 3–160 characters.";
  if (!EVIDENCE_CATEGORIES.includes(category as EvidenceCategory)) {
    fieldErrors.category = "Choose a valid category.";
  }
  if (description.length > 1000) fieldErrors.description = "Description is too long (max 1000).";
  if (Object.keys(fieldErrors).length > 0) {
    return bad(400, "VALIDATION", "Please fix the highlighted fields.", fieldErrors);
  }

  // ── Target tenant ─────────────────────────────────────────────────────────
  const organizationId = isSuper ? requestedOrg : user.orgId;
  if (!organizationId) {
    return bad(400, "ORG_REQUIRED", "Select the organization this evidence belongs to.");
  }
  const org = await db.organization.findUnique({ where: { id: organizationId }, select: { id: true, name: true } });
  if (!org) return bad(404, "ORG_NOT_FOUND", "Target organization not found.");

  // ── Version chain (optional) ──────────────────────────────────────────────
  let previous: { id: string; version: number; rootId: string | null; title: string } | null = null;
  if (replaceId) {
    const prev = await db.evidenceDocument.findUnique({ where: { id: replaceId } });
    if (!prev || prev.status === "DELETED") return bad(404, "NOT_FOUND", "Document to replace not found.");
    if (prev.organizationId !== organizationId) {
      return bad(403, "CROSS_TENANT", "The document belongs to another organization.");
    }
    previous = { id: prev.id, version: prev.version, rootId: prev.rootId, title: prev.title };
  }

  // ── Persist ───────────────────────────────────────────────────────────────
  const checksum = sha256Hex(head);
  const storedName = makeStoredName(fileName);
  await writeEvidenceFile(organizationId, storedName, head);

  const created = await db.evidenceDocument.create({
    data: {
      title,
      description: description || null,
      category,
      tags: tags || null,
      fileName,
      storedName,
      mimeType: upload.type || typeCheck.type!.mimes[0],
      fileSize: upload.size,
      checksum,
      status: "ACTIVE",
      version: previous ? previous.version + 1 : 1,
      rootId: previous ? previous.rootId ?? previous.id : null,
      organizationId,
      uploadedById: user.id,
    },
  });

  if (previous) {
    await db.evidenceDocument.update({
      where: { id: previous.id },
      data: { status: "SUPERSEDED" },
    });
  }

  await audit({
    type: "EVIDENCE_UPLOADED",
    userId: user.id,
    email: user.email,
    organizationId,
    ip: clientIp(req.headers),
    userAgent: req.headers.get("user-agent"),
    detail: `"${title}" (${fileName}, ${upload.size} B, sha256 ${checksum.slice(0, 12)}…) v${created.version}${previous ? ` replacing v${previous.version}` : ""} stored for ${org.name}.`,
  });

  return NextResponse.json({ document: { id: created.id, title: created.title, version: created.version } }, { status: 201 });
}
