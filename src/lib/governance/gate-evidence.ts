/**
 * Adwa Cyber — Track C gate-evidence storage (server only).
 *
 * Gate criteria (proposal Phases 4–5) are platform-level governance records,
 * so their artefacts live in a PLATFORM directory (.data/gate-evidence/),
 * deliberately outside the per-tenant evidence vault: a signed EMA letter or
 * an EHRC due-diligence report belongs to the venture's institutional
 * posture, never to a bank tenant.
 *
 * The storage model mirrors the tenant vault's security posture (src/lib/compliance/evidence.ts):
 *  - files stored outside the web root under a server-generated storedName
 *    (random hex + allow-listed extension) — original filenames are metadata
 *    only, so path traversal is structurally impossible;
 *  - strict allow-list (extension + declared MIME + magic bytes) via the
 *    shared checkFileType();
 *  - SHA-256 recorded at upload and re-verified on download (tamper evidence
 *    for exactly the records a funder, regulator or university partner asks
 *    to see).
 */
import { createHash } from "crypto";
import fs from "fs";
import path from "path";
import { checkFileType, makeStoredName, dataRoot } from "../compliance/evidence";

export { formatBytes } from "../compliance/evidence-shared";

const STORAGE_ROOT = dataRoot("gate-evidence");

/** Validate an uploaded artefact with the shared allow-list. */
export function checkGateFileType(fileName: string, declaredMime: string, size: number, bufferHead: Buffer) {
  return checkFileType(fileName, declaredMime, size, bufferHead);
}

export function sha256Hex(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

export async function ensureGateDir(): Promise<void> {
  await fs.promises.mkdir(STORAGE_ROOT, { recursive: true });
}

export async function writeGateEvidenceFile(storedName: string, data: Buffer): Promise<void> {
  await ensureGateDir();
  await fs.promises.writeFile(path.join(STORAGE_ROOT, storedName), data, { mode: 0o600 });
}

/**
 * Absolute path of a stored gate artefact. storedName is validated against
 * ^[0-9a-f]{32}(\.\w+)?$ so no traversal can occur even with a tampered DB.
 */
export function gateEvidenceFilePath(storedName: string): string | null {
  if (!/^[0-9a-f]{32}(\.[a-z0-9]{1,8})?$/.test(storedName)) return null;
  return path.join(STORAGE_ROOT, storedName);
}

export async function readGateEvidenceFile(storedName: string): Promise<Buffer | null> {
  const p = gateEvidenceFilePath(storedName);
  if (!p) return null;
  try {
    return await fs.promises.readFile(p);
  } catch {
    return null;
  }
}

/** True when the on-disk bytes still hash to the recorded checksum. */
export function verifyChecksum(buf: Buffer, checksum: string): boolean {
  return sha256Hex(buf) === checksum.toLowerCase();
}

export { makeStoredName };
