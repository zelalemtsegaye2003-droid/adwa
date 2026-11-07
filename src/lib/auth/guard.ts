/**
 * Adwa Cyber — API route guards.
 * Usage in a route handler:
 *
 *   const guard = await requireAuth(req, "scans:run-org");
 *   if (guard.error) return guard.error;
 *   const user = guard.user;        // SessionUser
 *   // ... tenant-scoped logic
 */
import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, type SessionUser } from "./session";
import { can, type Permission } from "./rbac";
import { audit } from "./audit";
import { clientIp } from "./rate-limit";

export interface GuardOk {
  error: null;
  user: SessionUser;
}

export interface GuardErr {
  error: NextResponse;
  user: null;
}

export type GuardResult = GuardOk | GuardErr;

function jsonError(status: number, code: string, message: string): NextResponse {
  return NextResponse.json({ error: { code, message } }, { status });
}

/**
 * Require an authenticated session, optionally with a permission.
 * Also enforces same-origin on state-changing verbs (CSRF hardening).
 */
export async function requireAuth(
  req: NextRequest,
  permission?: Permission
): Promise<GuardResult> {
  return requireAuthAny(req, permission ? [permission] : []);
}

/**
 * Effective host of a request. Behind the platform gateway the Host header
 * is rewritten (e.g. "localhost" without port) while the original host is
 * preserved in X-Forwarded-Host — trust the forwarded value when present.
 */
function requestHost(headers: Headers): string | null {
  const xfh = headers.get("x-forwarded-host")?.split(",")[0].trim();
  return xfh || headers.get("host");
}

/**
 * Require an authenticated session with ANY of the given permissions
 * (e.g. SUPER_ADMIN holds `users:view-all` while tenant roles hold
 * `users:view-org` — both may list users, at different scopes).
 */
export async function requireAuthAny(
  req: NextRequest,
  permissions: Permission[]
): Promise<GuardResult> {
  // CSRF hardening: mutating requests must come from our own origin.
  if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
    const origin = req.headers.get("origin");
    if (origin) {
      const host = requestHost(req.headers);
      try {
        if (new URL(origin).host !== host) {
          return { error: jsonError(403, "CROSS_ORIGIN_BLOCKED", "Cross-origin request blocked."), user: null };
        }
      } catch {
        return { error: jsonError(403, "CROSS_ORIGIN_BLOCKED", "Invalid origin header."), user: null };
      }
    }
  }

  const user = await getSessionUser(req);
  if (!user) {
    return {
      error: jsonError(401, "UNAUTHENTICATED", "Authentication required. Sign in again."),
      user: null,
    };
  }

  if (permissions.length > 0 && !permissions.some((p) => can(user.role, p))) {
    await audit({
      type: "ACCESS_DENIED",
      userId: user.id,
      email: user.email,
      organizationId: user.orgId,
      ip: clientIp(req.headers),
      userAgent: req.headers.get("user-agent"),
      detail: `Permission '${permissions.join("' or '")}' required (${user.role})`,
    });
    return {
      error: jsonError(403, "FORBIDDEN", `Your role (${user.role}) lacks the required permission.`),
      user: null,
    };
  }

  return { error: null, user };
}

/** Validate that a JSON body parses and matches a zod-like schema function. */
export async function parseBody<T>(
  req: NextRequest,
  schema: (data: unknown) => T | null
): Promise<{ data: T } | { error: NextResponse }> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return { error: jsonError(400, "INVALID_JSON", "Request body must be valid JSON.") };
  }
  const data = schema(raw);
  if (data === null) {
    return { error: jsonError(400, "INVALID_BODY", "Request body failed validation.") };
  }
  return { data };
}
