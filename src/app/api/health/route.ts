/**
 * Adwa Cyber — liveness/readiness probe (uptime monitoring target).
 * Public and unauthenticated by design; exposes no tenant data.
 * Returns 200 when the app can serve traffic, 503 when degraded.
 */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const startedAt = Date.now();
  const checks: Record<string, { ok: boolean; latencyMs?: number; error?: string }> = {};

  // Database connectivity (SELECT 1 — provider-agnostic, works on SQLite & PostgreSQL)
  try {
    const t0 = Date.now();
    await db.$queryRaw`SELECT 1`;
    checks.database = { ok: true, latencyMs: Date.now() - t0 };
  } catch (err) {
    checks.database = { ok: false, error: err instanceof Error ? err.message : "unknown" };
  }

  // Auth secret must be configured or every login 500s — surface it here
  checks.authSecret = { ok: Boolean(process.env.AUTH_SECRET) };

  const allOk = Object.values(checks).every((c) => c.ok);
  const body = {
    status: allOk ? "ok" : "degraded",
    checks,
    version: process.env.npm_package_version ?? "0.2.1",
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
    responseMs: Date.now() - startedAt,
  };

  return NextResponse.json(body, {
    status: allOk ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}
