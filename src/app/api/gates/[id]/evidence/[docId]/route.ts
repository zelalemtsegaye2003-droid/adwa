import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth/guard";
import { audit } from "@/lib/auth/audit";
import { clientIp } from "@/lib/auth/rate-limit";
import { readGateEvidenceFile, verifyChecksum } from "@/lib/governance/gate-evidence";

export const runtime = "nodejs";

/**
 * GET /api/gates/[id]/evidence/[docId] — download a governance artefact.
 * The stored bytes are re-hashed and compared against the upload-time
 * SHA-256 before being served: a mismatch is a 409 INTEGRITY_FAIL, never a
 * silent serve of tampered evidence. Governance viewers (SUPER_ADMIN) —
 * this is the verification path a funder, regulator, or university partner
 * walks.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string; docId: string }> }) {
  const guard = await requireAuth(req, "governance:view");
  if (guard.error) return guard.error;
  const { user } = guard;
  const { id, docId } = await ctx.params;

  const doc = await db.gateEvidence.findUnique({
    where: { id: docId },
    include: { gate: { select: { phase: true, code: true } }, uploadedBy: { select: { name: true } } },
  });
  if (!doc || doc.gateId !== id) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Evidence artefact not found on this criterion." } }, { status: 404 });
  }

  const bytes = await readGateEvidenceFile(doc.storedName);
  if (!bytes) {
    return NextResponse.json(
      { error: { code: "FILE_MISSING", message: "Stored artefact is missing from the platform vault — investigate immediately." } },
      { status: 410 }
    );
  }
  if (!verifyChecksum(bytes, doc.checksum)) {
    await audit({
      type: "GATE_EVIDENCE_INTEGRITY_FAIL",
      userId: user.id,
      email: user.email,
      organizationId: null,
      ip: clientIp(req.headers),
      userAgent: req.headers.get("user-agent"),
      detail: `Track C gate ${doc.gate.phase}/${doc.gate.code}: INTEGRITY FAIL on ${doc.fileName} — stored bytes no longer match the sealed SHA-256.`,
    });
    return NextResponse.json(
      { error: { code: "INTEGRITY_FAIL", message: "Stored artefact no longer matches its sealed SHA-256 checksum. Download refused; the incident has been audit-logged." } },
      { status: 409 }
    );
  }

  await audit({
    type: "GATE_EVIDENCE_DOWNLOADED",
    userId: user.id,
    email: user.email,
    organizationId: null,
    ip: clientIp(req.headers),
    userAgent: req.headers.get("user-agent"),
    detail: `Track C gate ${doc.gate.phase}/${doc.gate.code}: ${doc.fileName} downloaded and checksum verified.`,
  });

  return new NextResponse(new Uint8Array(bytes), {
    status: 200,
    headers: {
      "Content-Type": doc.mimeType || "application/octet-stream",
      "Content-Disposition": `attachment; filename="${doc.fileName.replace(/"/g, "")}"`,
      "X-Checksum-Sha256": doc.checksum,
      "Cache-Control": "no-store",
    },
  });
}
