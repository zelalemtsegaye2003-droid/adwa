import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth/guard";
import { audit } from "@/lib/auth/audit";
import { clientIp } from "@/lib/auth/rate-limit";
import { sanitizeDisplayFileName } from "@/lib/evidence";
import {
  checkGateFileType,
  makeStoredName,
  sha256Hex,
  writeGateEvidenceFile,
  formatBytes,
} from "@/lib/gate-evidence";

export const runtime = "nodejs";

/**
 * POST /api/gates/[id]/evidence — attach a governance artefact to a Track C
 * gate criterion (multipart: file, description?).
 *
 * Platform-level (governance:manage, SUPER_ADMIN): signed instruments, EHRC
 * reports, funding letters. The artefact is SHA-256 sealed at upload and
 * stored outside the web root under a server-generated name; the attachment
 * is written to the criterion's GateEvent timeline. This is the register a
 * funder, regulator, or university partner audits — satisfaction without an
 * artefact is refused by PATCH /api/gates/[id].
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireAuth(req, "governance:manage");
  if (guard.error) return guard.error;
  const { user } = guard;
  const { id } = await ctx.params;

  const gate = await db.expansionGate.findUnique({ where: { id }, select: { id: true, phase: true, code: true } });
  if (!gate) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Gate criterion not found." } }, { status: 404 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json(
      { error: { code: "BAD_FORM", message: "Expected multipart/form-data with a `file` field." } },
      { status: 400 }
    );
  }
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: { code: "NO_FILE", message: "A `file` field is required." } },
      { status: 400 }
    );
  }
  const description = typeof form.get("description") === "string" ? String(form.get("description")).trim().slice(0, 500) : null;

  const data = Buffer.from(await file.arrayBuffer());
  const typeCheck = checkGateFileType(file.name, file.type, data.length, data.subarray(0, 8));
  if (!typeCheck.ok) {
    return NextResponse.json({ error: { code: "BAD_FILE", message: typeCheck.reason } }, { status: 400 });
  }

  const checksum = sha256Hex(data);
  const storedName = makeStoredName(file.name);
  await writeGateEvidenceFile(storedName, data);

  const doc = await db.gateEvidence.create({
    data: {
      gateId: id,
      fileName: sanitizeDisplayFileName(file.name),
      storedName,
      mimeType: file.type,
      fileSize: data.length,
      checksum,
      ...(description ? { description } : {}),
      uploadedById: user.id,
    },
  });

  await db.gateEvent.create({
    data: {
      gateId: id,
      actorId: user.id,
      kind: "EVIDENCE_ATTACHED",
      evidenceId: doc.id,
      note: description ? `${doc.fileName} — ${description}`.slice(0, 1000) : doc.fileName,
    },
  });

  await audit({
    type: "GATE_EVIDENCE_ATTACHED",
    userId: user.id,
    email: user.email,
    organizationId: null, // platform-level governance record
    ip: clientIp(req.headers),
    userAgent: req.headers.get("user-agent"),
    detail: `Track C gate ${gate.phase}/${gate.code}: evidence attached — ${doc.fileName} (${formatBytes(doc.fileSize)}, sha256 ${checksum.slice(0, 12)}…)`,
  });

  return NextResponse.json(
    {
      evidence: {
        id: doc.id,
        fileName: doc.fileName,
        description: doc.description,
        mimeType: doc.mimeType,
        fileSize: doc.fileSize,
        checksum: doc.checksum,
        uploadedBy: { name: user.name },
        createdAt: doc.createdAt,
      },
    },
    { status: 201 }
  );
}
