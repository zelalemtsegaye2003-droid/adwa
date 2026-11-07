/**
 * Adwa Cyber — security audit trail for the identity layer.
 * Every authentication-relevant event is recorded for compliance review
 * (ISO 27037-style event logging; visible to tenant admins & auditors).
 */
import { db } from "@/lib/db";

export type AuthEventType =
  | "LOGIN_SUCCESS"
  | "LOGIN_FAILED"
  | "LOGIN_LOCKED"
  | "ACCOUNT_LOCKED"
  | "MFA_CHALLENGE"
  | "MFA_PASSED"
  | "MFA_FAILED"
  | "MFA_ENROLLMENT_STARTED"
  | "MFA_ENABLED"
  | "MFA_DISABLED"
  | "CAPTCHA_FAILED"
  | "LOGOUT"
  | "TOKEN_REFRESHED"
  | "TOKEN_REUSE_DETECTED"
  | "SESSIONS_REVOKED"
  | "REGISTER_ORG"
  | "USER_CREATED"
  | "USER_UPDATED"
  | "USER_DISABLED"
  | "GOOGLE_LOGIN"
  | "GOOGLE_LOGIN_FAILED"
  | "ACCESS_DENIED"
  | "EVIDENCE_UPLOADED"
  | "EVIDENCE_DOWNLOAD"
  | "EVIDENCE_UPDATED"
  | "EVIDENCE_ARCHIVED"
  | "EVIDENCE_RESTORED"
  | "EVIDENCE_DELETED"
  | "EVIDENCE_REJECTED"
  | "EVIDENCE_INTEGRITY_WARNING"
  | "EVIDENCE_LINKED"
  | "EVIDENCE_UNLINKED"
  | "EVIDENCE_AUTO_LINKED"
  | "SCAN_STARTED"
  | "SCAN_COMPLETED"
  | "SCAN_DELETED"
  | "FINDING_STATUS_CHANGED"
  | "REPORT_EXPORTED"
  // SOC / CERT-as-a-Service (proposal Phase 2)
  | "INCIDENT_CREATED"
  | "INCIDENT_STATUS_CHANGED"
  | "INCIDENT_NOTIFIED"
  | "THREAT_CREATED"
  | "THREAT_UPDATED"
  | "THREAT_SHARED"
  | "ETHIOCERT_SYNC"
  // Multilingual awareness platform (proposal Phase 3, Track B)
  | "AWARENESS_MODULE_CREATED"
  | "AWARENESS_MODULE_UPDATED"
  | "AWARENESS_QUESTION_ADDED"
  | "AWARENESS_QUESTION_UPDATED"
  | "AWARENESS_SCHOOL_CREATED"
  | "AWARENESS_CLASS_CREATED"
  | "AWARENESS_LEARNERS_ISSUED"
  | "AWARENESS_CONSENT_RECORDED";

export interface AuditInput {
  type: AuthEventType;
  userId?: string | null;
  email: string;
  organizationId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  detail?: string | null;
}

/** Record an auth event. Never throws — audit must not break the request path. */
export async function audit(input: AuditInput): Promise<void> {
  try {
    await db.authEvent.create({
      data: {
        type: input.type,
        userId: input.userId ?? null,
        email: input.email,
        organizationId: input.organizationId ?? null,
        ip: input.ip ?? null,
        userAgent: input.userAgent?.slice(0, 250) ?? null,
        detail: input.detail?.slice(0, 500) ?? null,
      },
    });
  } catch (err) {
    console.error("[audit] failed to record event", input.type, err);
  }
}
