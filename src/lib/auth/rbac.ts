/**
 * Adwa Cyber — Role-Based Access Control matrix.
 *
 * Tenancy model:
 *  - Organization = tenant. Every non-SUPER_ADMIN user belongs to exactly one
 *    organization and its access is scoped to that tenant.
 *  - SUPER_ADMIN is Adwa Cyber platform staff (no tenant) with cross-tenant
 *    rights: onboarding organizations, managing tenant administrators and
 *    viewing platform-wide analytics.
 */
import type { AppRole } from "./jwt";

export const ROLES: AppRole[] = [
  "SUPER_ADMIN",
  "ORG_ADMIN",
  "COMPLIANCE_OFFICER",
  "AUDITOR",
  "VIEWER",
];

/** Tenant-scoped roles that belong to an organization. */
export const ORG_ROLES: AppRole[] = [
  "ORG_ADMIN",
  "COMPLIANCE_OFFICER",
  "AUDITOR",
  "VIEWER",
];

export type Permission =
  | "orgs:view-all"
  | "orgs:manage"
  | "org:view-own"
  | "org:edit-own"
  | "users:view-org"
  | "users:manage-org"
  | "users:view-all"
  | "users:manage-all"
  | "catalogue:view"
  | "scans:view-org"
  | "scans:view-all"
  | "scans:run-org"
  | "scans:run-any-org"
  | "findings:view-org"
  | "findings:view-all"
  | "findings:manage-org"
  | "findings:manage-all"
  | "audit:view-org"
  | "audit:view-all"
  | "evidence:view-org"
  | "evidence:view-all"
  | "evidence:upload"
  | "evidence:manage-org"
  | "evidence:manage-all"
  // SOC / CERT-as-a-Service (proposal Phase 2)
  | "soc:view-org"
  | "soc:view-all"
  | "soc:manage-org"
  | "soc:manage-all"
  | "threats:view"
  | "threats:contribute"
  | "threats:sync"
  // Multilingual awareness platform (proposal Phase 3, Track B).
  // Platform-level mission programme: school data (minors, pseudonymised)
  // must never be visible to commercial tenants — SUPER_ADMIN (the education
  // lead's platform account) only.
  | "awareness:manage"
  // Track C gated expansion (proposal Phases 4–5 governance, roadmap §3.2
  // Table 2 + §14). Gate-criteria records are platform-level governance:
  // SUPER_ADMIN reads/updates; no commercial tenant access by design.
  | "governance:view"
  | "governance:manage"
  // Track C Phase 4 (ACFS): the content-filtering precondition register is
  // platform governance — SUPER_ADMIN only (tenants get 403 by design).
  | "acfs:manage"
  // Track C Phase 5 (CII): platform staff manage the readiness register;
  // tenant roles may view their OWN operator's readiness, read-only.
  | "cii:manage"
  | "cii:view-own"
  // VAPT Center (NBE/NCB/S/02/2026/27 LOT4 — vulnerability assessment &
  // penetration testing). Tenant roles run scans and work the remediation
  // queue for their own organization; read-only roles observe.
  | "vapt:view-org"
  | "vapt:view-all"
  | "vapt:manage-org"
  | "vapt:manage-all";

const MATRIX: Record<AppRole, Permission[]> = {
  SUPER_ADMIN: [
    "orgs:view-all",
    "orgs:manage",
    "users:view-all",
    "users:manage-all",
    "catalogue:view",
    "scans:view-all",
    "scans:run-any-org",
    "findings:view-all",
    "findings:manage-all",
    "audit:view-all",
    "evidence:view-all",
    "evidence:upload",
    "evidence:manage-all",
    "soc:view-all",
    "soc:manage-all",
    "threats:view",
    "threats:contribute",
    "threats:sync",
    "awareness:manage",
    "governance:view",
    "governance:manage",
    "acfs:manage",
    "cii:manage",
    "vapt:view-all",
    "vapt:manage-all",
  ],
  ORG_ADMIN: [
    "org:view-own",
    "org:edit-own",
    "users:view-org",
    "users:manage-org",
    "catalogue:view",
    "scans:view-org",
    "scans:run-org",
    "findings:view-org",
    "findings:manage-org",
    "audit:view-org",
    "evidence:view-org",
    "evidence:upload",
    "evidence:manage-org",
    "soc:view-org",
    "soc:manage-org",
    "threats:view",
    "threats:contribute",
    "threats:sync",
    "cii:view-own",
    "vapt:view-org",
    "vapt:manage-org",
  ],
  COMPLIANCE_OFFICER: [
    "org:view-own",
    "catalogue:view",
    "scans:view-org",
    "scans:run-org",
    "findings:view-org",
    "findings:manage-org",
    "evidence:view-org",
    "evidence:upload",
    "soc:view-org",
    "soc:manage-org",
    "threats:view",
    "threats:contribute",
    "threats:sync",
    "cii:view-own",
    "vapt:view-org",
    "vapt:manage-org",
  ],
  AUDITOR: [
    "org:view-own",
    "catalogue:view",
    "scans:view-org",
    "findings:view-org",
    "audit:view-org",
    "evidence:view-org",
    "soc:view-org",
    "threats:view",
    "vapt:view-org",
  ],
  VIEWER: ["org:view-own", "catalogue:view", "scans:view-org", "findings:view-org", "evidence:view-org", "soc:view-org", "threats:view", "vapt:view-org"],
};

export function can(role: AppRole | string | undefined, permission: Permission): boolean {
  if (!role) return false;
  const perms = MATRIX[role as AppRole];
  return Boolean(perms?.includes(permission));
}

export function permissionsOf(role: AppRole | string): Permission[] {
  return MATRIX[role as AppRole] ?? [];
}

/** Human-readable role label. */
export const ROLE_LABELS: Record<AppRole, string> = {
  SUPER_ADMIN: "Platform Super Admin",
  ORG_ADMIN: "Organization Admin",
  COMPLIANCE_OFFICER: "Compliance Officer",
  AUDITOR: "Auditor (read-only)",
  VIEWER: "Viewer",
};

/** Which org-scoped roles an org admin may assign to users in its tenant. */
export const ASSIGNABLE_ORG_ROLES: AppRole[] = [
  "ORG_ADMIN",
  "COMPLIANCE_OFFICER",
  "AUDITOR",
  "VIEWER",
];
