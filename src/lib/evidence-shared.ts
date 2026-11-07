/**
 * Adwa Cyber — Evidence Vault shared constants (safe for client & server).
 * Keep this module free of Node-only imports ("crypto", "fs") so client
 * components can import categories / labels / formatters.
 */

export const EVIDENCE_CATEGORIES = [
  "POLICY",
  "AUDIT_REPORT",
  "CERTIFICATE",
  "TRAINING_RECORD",
  "INCIDENT_LOG",
  "ASSESSMENT",
  "CONFIG_EXPORT",
  "OTHER",
] as const;

export type EvidenceCategory = (typeof EVIDENCE_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<EvidenceCategory, [string, string]> = {
  POLICY: ["Policy / procedure", "ፖሊሲ / አሠራር"],
  AUDIT_REPORT: ["Audit report", "የኦዲት ሪፖርት"],
  CERTIFICATE: ["Certificate", "ማረጋገጫ"],
  TRAINING_RECORD: ["Training record", "የስልጠና መዝገብ"],
  INCIDENT_LOG: ["Incident log", "የክስተት መዝገብ"],
  ASSESSMENT: ["Risk assessment", "የስጋት ግምገማ"],
  CONFIG_EXPORT: ["Technical config", "ቴክኒካል ማስተካከያ"],
  OTHER: ["Other", "ሌላ"],
};

export const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

/** Client-side extensions accepted (mirrors the server allow-list). */
export const ACCEPTED_EXTENSIONS = ["pdf", "png", "jpg", "jpeg", "docx", "xlsx", "csv", "txt", "zip"];

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function fileExt(fileName: string): string {
  return fileName.includes(".") ? fileName.split(".").pop()!.toLowerCase() : "";
}

export function isPreviewable(mimeType: string): boolean {
  return mimeType.startsWith("image/") || mimeType === "application/pdf";
}
