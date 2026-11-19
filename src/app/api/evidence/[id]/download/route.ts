import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuthAny } from "@/lib/auth/guard";
import { can } from "@/lib/auth/rbac";
import { audit } from "@/lib/auth/audit";
import { clientIp } from "@/lib/auth/rate-limit";
import { readEvidenceFile, sha256Hex } from "@/lib/compliance/evidence";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/evidence/[id]/download — stream a stored artefact.
 *
 * On every download the SHA-256 of the stored file is recomputed and compared
 * with the checksum recorded at upload time. A mismatch blocks the download and
 * raises an EVIDENCE_INTEGRITY_WARNING in the audit trail (tamper evidence).
 * `?inline=1` serves inline for previews (images / PDF) — default is attachment.
 */
export async function GET(req: NextRequest, ctx: Ctx) {
  const guard = await requireAuthAny(req, ["evidence:view-org", "evidence:view-all"]);
  if (guard.error) return guard.error;
  const { user } = guard;
  const { id } = await ctx.params;

  const doc = await db.evidenceDocument.findUnique({ where: { id } });
  if (!doc || doc.status === "DELETED") {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Document not found." } }, { status: 404 });
  }

  const isSuper = can(user.role, "evidence:view-all");
  if (!isSuper && doc.organizationId !== user.orgId) {
    return NextResponse.json(
      { error: { code: "CROSS_TENANT", message: "This document belongs to another organization." } },
      { status: 403 }
    );
  }

  const data = await readEvidenceFile(doc.organizationId, doc.storedName);
  if (!data) {
    await audit({
      type: "EVIDENCE_INTEGRITY_WARNING",
      userId: user.id,
      email: user.email,
      organizationId: doc.organizationId,
      ip: clientIp(req.headers),
      detail: `Stored file missing on disk for "${doc.title}" (${doc.storedName}).`,
    });
    return NextResponse.json(
      { error: { code: "FILE_MISSING", message: "The stored file could not be read. Contact your administrator." } },
      { status: 410 }
    );
  }

  // ── Integrity gate: recompute SHA-256 and compare with the upload anchor ──
  const actual = sha256Hex(data);
  if (actual !== doc.checksum) {
    await audit({
      type: "EVIDENCE_INTEGRITY_WARNING",
      userId: user.id,
      email: user.email,
      organizationId: doc.organizationId,
      ip: clientIp(req.headers),
      detail: `CHECKSUM MISMATCH for "${doc.title}" (${doc.fileName}): stored ${doc.checksum.slice(0, 16)}…, on disk ${actual.slice(0, 16)}… — download blocked.`,
    });
    return NextResponse.json(
      {
        error: {
          code: "INTEGRITY_FAILED",
          message: "Integrity check failed: the stored file no longer matches its recorded checksum. The download was blocked and the security team has been notified.",
        },
      },
      { status: 409 }
    );
  }

  await db.evidenceDocument.update({
    where: { id },
    data: { downloads: { increment: 1 }, lastVerifiedAt: new Date() },
  });

  await audit({
    type: "EVIDENCE_DOWNLOAD",
    userId: user.id,
    email: user.email,
    organizationId: doc.organizationId,
    ip: clientIp(req.headers),
    detail: `"${doc.title}" (${doc.fileName}) downloaded — sha256 verified.`,
  });

  const inline = req.nextUrl.searchParams.get("inline") === "1";
  const asciiName = doc.fileName.replace(/[^\w.\- ]/g, "_");
  const disposition = `${inline ? "inline" : "attachment"}; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(doc.fileName)}`;

  return new NextResponse(new Uint8Array(data), {
    status: 200,
    headers: {
      "Content-Type": doc.mimeType,
      "Content-Length": String(data.length),
      "Content-Disposition": disposition,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
      "X-Checksum-Sha256": doc.checksum,
    },
  });
}
