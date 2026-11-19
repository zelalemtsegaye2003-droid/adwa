/**
 * Adwa Cyber — POST /api/evidence/upload
 *
 * Multipart: file · title · category · description? · tags?
 *            organizationId? (SUPER_ADMIN only) · replaceId? (new version)
 *
 * Security model (docs/EVIDENCE.md):
 *  - strict allow-list (extension + declared MIME + magic bytes) & size cap
 *  - server-generated storedName (random hex + safe ext) outside the web
 *    root — original filenames are display metadata only
 *  - SHA-256 recorded at upload, re-verified on every download
 *  - tenant-scoped; AUDITOR/VIEWER get 403 (evidence:upload permission)
 *  - tags matching Rule codes create AUTO_TAG evidence↔obligation links
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuthAny } from "@/lib/auth/guard";
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
} from "@/lib/compliance/evidence";

const MAX = { title: 200, description: 1000, tags: 400 };

function fieldError(fieldErrors: Record<string, string>, status = 400) {
  return NextResponse.json(
    { error: { code: "VALIDATION", message: "Please correct the highlighted fields.", fieldErrors } },
    { status }
  );
}

export async function POST(req: NextRequest) {
  const guard = await requireAuthAny(req, ["evidence:upload"]);
  if (guard.error) return guard.error;
  const { user } = guard;

  // ── Parse multipart form ───────────────────────────────────────────────────
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json(
      { error: { code: "BAD_REQUEST", message: "Multipart form data expected." } },
      { status: 400 }
    );
  }

  const file = form.get("file");
  const title = String(form.get("title") ?? "").trim();
  const category = String(form.get("category") ?? "OTHER");
  const description = String(form.get("description") ?? "").trim();
  const tags = String(form.get("tags") ?? "").trim();
  const replaceIdRaw = String(form.get("replaceId") ?? "").trim();
  const orgIdRaw = String(form.get("organizationId") ?? "").trim();

  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: { code: "VALIDATION", message: "A file is required." } },
      { status: 400 }
    );
  }

  // ── Field validation ───────────────────────────────────────────────────────
  const fieldErrors: Record<string, string> = {};
  if (title.length < 1 || title.length > MAX.title) fieldErrors.title = "Title is required (max 200 characters).";
  if (!EVIDENCE_CATEGORIES.includes(category as EvidenceCategory)) fieldErrors.category = "Unknown category.";
  if (description.length > MAX.description) fieldErrors.description = "Description is too long (max 1000 characters).";
  if (tags.length > MAX.tags) fieldErrors.tags = "Tags are too long (max 400 characters).";
  if (Object.keys(fieldErrors).length) return fieldError(fieldErrors);

  // ── Target organisation (tenant scoping) ───────────────────────────────────
  const isSuper = can(user.role, "evidence:manage-all");
  let organizationId: string | null;
  if (isSuper && orgIdRaw) {
    const org = await db.organization.findUnique({ where: { id: orgIdRaw }, select: { id: true } });
    if (!org) {
      return NextResponse.json(
        { error: { code: "VALIDATION", message: "Unknown organization." } },
        { status: 400 }
      );
    }
    organizationId = org.id;
  } else if (isSuper) {
    return NextResponse.json(
      { error: { code: "ORG_REQUIRED", message: "Select the organization this evidence belongs to." } },
      { status: 400 }
    );
  } else {
    organizationId = user.orgId;
    if (!organizationId) {
      return NextResponse.json(
        { error: { code: "ORG_REQUIRED", message: "Your account has no organization." } },
        { status: 400 }
      );
    }
  }

  // ── Version chain (replaceId → new version of an existing document) ────────
  let replaceTarget: { id: string; version: number; rootId: string | null; organizationId: string; status: string } | null = null;
  if (replaceIdRaw) {
    replaceTarget = await db.evidenceDocument.findUnique({
      where: { id: replaceIdRaw },
      select: { id: true, version: true, rootId: true, organizationId: true, status: true },
    });
    if (!replaceTarget || replaceTarget.organizationId !== organizationId) {
      // Cross-tenant replace attempts are indistinguishable from missing docs
      return NextResponse.json(
        { error: { code: "CROSS_TENANT", message: "This document belongs to another organization." } },
        { status: 403 }
      );
    }
    if (replaceTarget.status !== "ACTIVE") {
      return NextResponse.json(
        { error: { code: "CHAIN_ACTIVE", message: "Only the active version can be replaced." } },
        { status: 409 }
      );
    }
  }

  // ── File validation (allow-list + magic bytes + size) ──────────────────────
  const buffer = Buffer.from(await file.arrayBuffer());
  const typeCheck = checkFileType(file.name, file.type || "application/octet-stream", buffer.length, buffer.subarray(0, 8));
  if (!typeCheck.ok) {
    return NextResponse.json(
      { error: { code: "FILE_REJECTED", message: typeCheck.reason ?? "File rejected." } },
      { status: 400 }
    );
  }

  const fileName = sanitizeDisplayFileName(file.name);
  const storedName = makeStoredName(file.name);
  const checksum = sha256Hex(buffer);

  // ── Persist ────────────────────────────────────────────────────────────────
  await writeEvidenceFile(organizationId, storedName, buffer);

  const document = await db.evidenceDocument.create({
    data: {
      title,
      description: description || null,
      category,
      tags: tags || null,
      fileName,
      storedName,
      mimeType: file.type || "text/plain",
      fileSize: buffer.length,
      checksum,
      status: "ACTIVE",
      version: replaceTarget ? replaceTarget.version + 1 : 1,
      rootId: replaceTarget ? (replaceTarget.rootId ?? replaceTarget.id) : null,
      organizationId,
      uploadedById: user.id,
    },
  });

  if (replaceTarget) {
    await db.evidenceDocument.update({
      where: { id: replaceTarget.id },
      data: { status: "SUPERSEDED" },
    });
  }

  // ── AUTO_TAG: tags that reference rule codes become evidence links ────────
  const codeList = tags
    .split(",")
    .map((c) => c.trim().toUpperCase())
    .filter((c) => c.length >= 2 && c.length <= 20)
    .slice(0, 20);

  let autoLinked = 0;
  if (codeList.length) {
    const rules = await db.rule.findMany({
      where: { isActive: true, code: { in: codeList } },
      select: { id: true, code: true },
    });
    for (const rule of rules) {
      try {
        await db.evidenceLink.create({
          data: {
            ruleId: rule.id,
            evidenceId: document.id,
            linkType: "SATISFIES",
            source: "AUTO_TAG",
            createdById: user.id,
          },
        });
        autoLinked++;
        await audit({
          type: "EVIDENCE_AUTO_LINKED",
          userId: user.id,
          email: user.email,
          organizationId,
          ip: clientIp(req.headers),
          detail: `Rule ${rule.code} auto-linked to "${title}" from upload tag.`,
        });
      } catch {
        /* unique(ruleId, evidenceId) — already linked, skip */
      }
    }
  }

  await audit({
    type: "EVIDENCE_UPLOADED",
    userId: user.id,
    email: user.email,
    organizationId,
    ip: clientIp(req.headers),
    userAgent: req.headers.get("user-agent"),
    detail: `"${title}" (${fileName}, ${buffer.length} B, sha256 ${checksum.slice(0, 16)}…)${replaceTarget ? ` as v${document.version}` : ""}${autoLinked ? `, ${autoLinked} auto-link(s)` : ""}`,
  });

  return NextResponse.json(
    {
      document: {
        id: document.id,
        title: document.title,
        description: document.description,
        category: document.category,
        tags: document.tags,
        fileName: document.fileName,
        mimeType: document.mimeType,
        fileSize: document.fileSize,
        checksum: document.checksum,
        status: document.status,
        version: document.version,
        rootId: document.rootId,
        organizationId: document.organizationId,
        uploadedById: document.uploadedById,
        createdAt: document.createdAt,
        autoLinked,
      },
    },
    { status: 201 }
  );
}
