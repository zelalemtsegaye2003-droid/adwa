/**
 * Adwa Cyber — canonical API error contract.
 *
 * Every error response in this codebase is shaped:
 *   { error: { code: string, message: string, fieldErrors?: Record<string,string> } }
 *
 * `code` is machine-readable (stable for clients/tests); `message` is
 * human-readable (safe to show in a toast); `fieldErrors` maps form field
 * names to inline validation messages.
 *
 * Older routes still return legacy `{ error: "string" }` bodies — the client
 * (src/lib/auth-client.ts) normalizes both shapes, and routes are migrated
 * to `apiError()` as they are touched. New code must use this helper.
 */
import { NextResponse } from "next/server";

export type ApiErrorCode =
  | "VALIDATION"
  | "BAD_REQUEST"
  | "INVALID_JSON"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "CROSS_TENANT"
  | "INCOMPLETE"
  | "ORG_REQUIRED"
  | "FILE_REJECTED"
  | (string & {}); // route-specific codes are allowed, but reuse the above first

export interface ApiErrorBody {
  error: {
    code: ApiErrorCode;
    message: string;
    fieldErrors?: Record<string, string>;
    /** Present only on INCOMPLETE scan submissions: the unanswered rule codes. */
    missing?: string[];
  };
}

/** Build the canonical error body. */
export function apiErrorBody(
  code: ApiErrorCode,
  message: string,
  fieldErrors?: Record<string, string>,
  extra?: Record<string, unknown>
): ApiErrorBody {
  return {
    error: {
      code,
      message,
      ...(fieldErrors ? { fieldErrors } : {}),
      ...(extra ?? {}),
    },
  };
}

/** Return a canonical error response. */
export function apiError(
  status: number,
  code: ApiErrorCode,
  message: string,
  fieldErrors?: Record<string, string>,
  extra?: Record<string, unknown>
): NextResponse {
  return NextResponse.json(apiErrorBody(code, message, fieldErrors, extra), {
    status,
  });
}

/** 400 for a malformed/unparseable JSON request body. */
export function invalidJson(): NextResponse {
  return apiError(400, "INVALID_JSON", "Request body must be valid JSON.");
}
