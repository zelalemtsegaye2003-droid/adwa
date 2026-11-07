"use client";

/**
 * Adwa Cyber — client-side auth utilities.
 * `api()` is a fetch wrapper that transparently refreshes an expired access
 * token once and retries the original request (silent re-authentication).
 */

export interface MeResponse {
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    roleLabel: string;
    orgId: string | null;
    orgName: string | null;
    orgSector: string | null;
    orgStatus: string | null;
    mfaEnabled: boolean;
    authProvider: string;
    lastLoginAt: string | null;
    createdAt: string | null;
    avatarUrl: string | null;
  };
  permissions: string[];
}

export interface ApiError {
  code: string;
  message: string;
  fieldErrors?: Record<string, string>;
}

let refreshing: Promise<boolean> | null = null;

/** Try to refresh the session (single-flight: concurrent callers share it). */
export function tryRefresh(): Promise<boolean> {
  if (!refreshing) {
    refreshing = fetch("/api/auth/refresh", { method: "POST", credentials: "same-origin" })
      .then((r) => r.ok)
      .catch(() => false)
      .finally(() => {
        setTimeout(() => (refreshing = null), 50);
      });
  }
  return refreshing;
}

export class ApiCallError extends Error {
  code: string;
  status: number;
  fieldErrors?: Record<string, string>;
  constructor(status: number, apiError: ApiError) {
    super(apiError.message);
    this.status = status;
    this.code = apiError.code;
    this.fieldErrors = apiError.fieldErrors;
  }
}

/** Authenticated fetch with one transparent refresh+retry on 401. */
export async function api<T = unknown>(
  path: string,
  init: RequestInit = {},
  retry = true
): Promise<T> {
  const res = await fetch(path, {
    ...init,
    credentials: "same-origin",
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(init.headers ?? {}),
      "X-Requested-With": "adwa-cyber",
    },
  });

  if (res.status === 401 && retry && !path.startsWith("/api/auth/")) {
    const refreshed = await tryRefresh();
    if (refreshed) return api<T>(path, init, false);
  }

  const isJson = res.headers.get("content-type")?.includes("application/json");
  const data = isJson ? await res.json().catch(() => null) : null;

  if (!res.ok) {
    const err = (data as { error?: ApiError } | null)?.error ?? {
      code: "UNKNOWN",
      message: `Request failed (${res.status})`,
    };
    throw new ApiCallError(res.status, err);
  }
  return data as T;
}

export const ROLE_COLORS: Record<string, string> = {
  SUPER_ADMIN:
    "bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800",
  ORG_ADMIN:
    "bg-teal-100 text-teal-900 border-teal-300 dark:bg-teal-950 dark:text-teal-300 dark:border-teal-800",
  COMPLIANCE_OFFICER:
    "bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800",
  AUDITOR:
    "bg-stone-100 text-stone-800 border-stone-300 dark:bg-stone-900 dark:text-stone-300 dark:border-stone-700",
  VIEWER:
    "bg-neutral-100 text-neutral-700 border-neutral-300 dark:bg-neutral-900 dark:text-neutral-300 dark:border-neutral-700",
};

export const ROLE_SHORT: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  ORG_ADMIN: "Org Admin",
  COMPLIANCE_OFFICER: "Officer",
  AUDITOR: "Auditor",
  VIEWER: "Viewer",
};
