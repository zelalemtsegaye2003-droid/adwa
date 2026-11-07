/**
 * Adwa Cyber — Evidence Vault storage & validation library (server only).
 *
 * Security model:
 *  - Files are stored OUTSIDE the web root under .data/evidence/<orgId>/ with a
 *    server-generated storedName (random hex + sanitized extension). The
 *    original filename is metadata only — it never touches the filesystem, so
 *    path traversal via crafted filenames is structurally impossible.
 *  - Uploads pass a strict allow-list (extension + declared MIME + magic-byte
 *    sniffing) and a hard size cap.
 *  - SHA-256 checksums are recorded at upload and re-verified on download to
 *    provide tamper evidence (NBE SBB/83/2022 record-integrity expectations).
 */
import { createHash, randomBytes } from "crypto";
import fs from "fs";
import path from "path";
import { MAX_FILE_BYTES } from "./evidence-shared";

export { EVIDENCE_CATEGORIES, CATEGORY_LABELS, MAX_FILE_BYTES, formatBytes } from "./evidence-shared";
export type { EvidenceCategory } from "./evidence-shared";

// ── Upload allow-list ────────────────────────────────────────────────────────

interface AllowedType {
  ext: string;
  mimes: string[];
  /** First bytes that MUST match (hex). null = text formats, no signature. */
  magic: string[] | null;
  label: string;
}

/** Strict allow-list: extension AND declared MIME AND magic bytes must agree. */
export const ALLOWED_TYPES: AllowedType[] = [
  { ext: "pdf", mimes: ["application/pdf"], magic: ["25504446"], label: "PDF document" },
  { ext: "png", mimes: ["image/png"], magic: ["89504e47"], label: "PNG image" },
  { ext: "jpg", mimes: ["image/jpeg", "image/jpg"], magic: ["ffd8ff"], label: "JPEG image" },
  { ext: "jpeg", mimes: ["image/jpeg", "image/jpg"], magic: ["ffd8ff"], label: "JPEG image" },
  { ext: "docx", mimes: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"], magic: ["504b0304"], label: "Word document" },
  { ext: "xlsx", mimes: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"], magic: ["504b0304"], label: "Excel workbook" },
  { ext: "csv", mimes: ["text/csv", "application/vnd.ms-excel"], magic: null, label: "CSV data" },
  { ext: "txt", mimes: ["text/plain"], magic: null, label: "Text file" },
  { ext: "zip", mimes: ["application/zip", "application/x-zip-compressed"], magic: ["504b0304"], label: "ZIP archive" },
];

export interface TypeCheckResult {
  ok: boolean;
  reason?: string;
  type?: AllowedType;
}

/**
 * Validate an uploaded file: extension, declared MIME, magic bytes and size.
 * `bufferHead` only needs the first 8 bytes.
 */
export function checkFileType(
  fileName: string,
  declaredMime: string,
  size: number,
  bufferHead: Buffer
): TypeCheckResult {
  if (size <= 0) return { ok: false, reason: "The file is empty." };
  if (size > MAX_FILE_BYTES) {
    return { ok: false, reason: `File exceeds the ${Math.round(MAX_FILE_BYTES / (1024 * 1024))} MB limit.` };
  }

  const ext = fileName.includes(".") ? fileName.split(".").pop()!.toLowerCase() : "";
  const type = ALLOWED_TYPES.find((t) => t.ext === ext);
  if (!type) {
    return {
      ok: false,
      reason: `Type .${ext || "?"} not allowed. Accepted: ${ALLOWED_TYPES.map((t) => "." + t.ext).join(", ")}.`,
    };
  }
  if (!type.mimes.includes(declaredMime.toLowerCase())) {
    return { ok: false, reason: `Declared type "${declaredMime}" does not match extension .${ext}.` };
  }
  if (type.magic) {
    const headHex = bufferHead.subarray(0, 4).toString("hex");
    if (!type.magic.some((m) => headHex.startsWith(m))) {
      return { ok: false, reason: `File content does not match a valid ${type.label} (magic-byte check failed).` };
    }
  }
  return { ok: true, type };
}

// ── Filenames & paths ────────────────────────────────────────────────────────

/** Keep only safe characters from the original filename (display only). */
export function sanitizeDisplayFileName(name: string): string {
  const base = name.split(/[/\\]/).pop() ?? "file"; // strip any path components
  const cleaned = base.replace(/[^\w.\- ()\u1200-\u137F]/g, "_").slice(0, 180);
  return cleaned || "file";
}

/** Server-controlled on-disk name: random hex + allow-listed extension only. */
export function makeStoredName(originalName: string): string {
  const extMatch = ALLOWED_TYPES.find(
    (t) => originalName.includes(".") && t.ext === originalName.split(".").pop()!.toLowerCase()
  );
  return randomBytes(16).toString("hex") + (extMatch ? "." + extMatch.ext : "");
}

const STORAGE_ROOT = path.join(process.cwd(), ".data", "evidence");

export function orgStorageDir(orgId: string): string {
  return path.join(STORAGE_ROOT, orgId);
}

/**
 * Absolute path of a stored evidence file. storedName is validated against
 * ^[0-9a-f]{32}(\.\w+)?$ so no traversal can occur even with a tampered DB.
 */
export function evidenceFilePath(orgId: string, storedName: string): string | null {
  if (!/^[0-9a-f]{32}(\.[a-z0-9]{1,8})?$/.test(storedName)) return null;
  if (!/^[a-z0-9]{20,}$/i.test(orgId)) return null;
  return path.join(orgStorageDir(orgId), storedName);
}

export async function ensureOrgDir(orgId: string): Promise<void> {
  await fs.promises.mkdir(orgStorageDir(orgId), { recursive: true });
}

export async function writeEvidenceFile(orgId: string, storedName: string, data: Buffer): Promise<void> {
  await ensureOrgDir(orgId);
  await fs.promises.writeFile(path.join(orgStorageDir(orgId), storedName), data, { mode: 0o600 });
}

export async function readEvidenceFile(orgId: string, storedName: string): Promise<Buffer | null> {
  const p = evidenceFilePath(orgId, storedName);
  if (!p) return null;
  try {
    return await fs.promises.readFile(p);
  } catch {
    return null;
  }
}

export async function deleteEvidenceFile(orgId: string, storedName: string): Promise<void> {
  const p = evidenceFilePath(orgId, storedName);
  if (!p) return;
  try {
    await fs.promises.unlink(p);
  } catch {
    /* already gone */
  }
}

// ── Checksums ────────────────────────────────────────────────────────────────

export function sha256Hex(data: Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}
