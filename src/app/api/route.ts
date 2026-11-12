import { NextResponse } from "next/server";
import { envSummary } from "@/lib/env";

/** Service identification for the API root (was "Hello, world!"). */
export async function GET() {
  const env = envSummary();
  return NextResponse.json({
    service: "adwa-cyber",
    status: "ok",
    api: "/api/health",
    database: env.database,
  });
}
