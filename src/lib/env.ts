/**
 * Adwa Cyber — boot-time environment validation (fail fast, not 500 later).
 *
 * Runs when the Prisma client singleton (src/lib/db.ts) is first imported by
 * the running server. Skipped entirely during `next build` (NEXT_PHASE) so
 * container builds never need production secrets.
 *
 * In production a bad config THROWS with a clear message (container exits,
 * orchestrator restarts, operator reads the log). In dev it only warns.
 */
import { existsSync, statSync } from "fs";
import path from "path";

export interface EnvIssue {
  key: string;
  problem: string;
  hint?: string;
}

const isProd = process.env.NODE_ENV === "production";
const isBuildPhase = process.env.NEXT_PHASE === "phase-production-build";

function databaseIssues(): EnvIssue[] {
  const url = process.env.DATABASE_URL;
  if (!url) {
    return [
      {
        key: "DATABASE_URL",
        problem: "is not set",
        hint: "Copy .env.example to .env — dev uses SQLite (file:…), production uses postgresql://…",
      },
    ];
  }
  if (!/^(file:|postgres(?:ql)?:\/\/)/.test(url)) {
    return [
      {
        key: "DATABASE_URL",
        problem: `has an unsupported scheme: ${url.split(":")[0]}:`,
        hint: "Use file:<path> (dev) or postgresql://user:pass@host:5432/db (production)",
      },
    ];
  }
  return [];
}

function authSecretIssues(): EnvIssue[] {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    return [
      {
        key: "AUTH_SECRET",
        problem: "is not set",
        hint: "Generate one: openssl rand -base64 48 (64+ chars). Without it sessions and MFA seeds cannot be encrypted.",
      },
    ];
  }
  // bcrypt-style base64 of 48 bytes → 64 chars; accept raw >= 48 too.
  if (secret.length < 48) {
    return [
      {
        key: "AUTH_SECRET",
        problem: `is too short (${secret.length} chars)`,
        hint: "Use at least 48 chars (openssl rand -base64 48). Rotating it invalidates sessions + MFA seeds.",
      },
    ];
  }
  return [];
}

function dataDirIssues(): EnvIssue[] {
  const dir = process.env.DATA_DIR;
  if (!dir) return []; // default ./.data — checked lazily by the evidence module
  try {
    if (!existsSync(dir)) return [];
    const st = statSync(dir);
    if (!st.isDirectory()) return [{ key: "DATA_DIR", problem: `${dir} exists but is not a directory` }];
    if (isProd && !(st.mode & 0o200)) {
      return [{ key: "DATA_DIR", problem: `${dir} is not writable by this process` }];
    }
  } catch {
    return [{ key: "DATA_DIR", problem: `cannot stat ${dir}` }];
  }
  return [];
}

/** All detected issues (empty = healthy). Exported for tests. */
export function collectEnvIssues(): EnvIssue[] {
  return [...databaseIssues(), ...authSecretIssues(), ...dataDirIssues()];
}

let validated = false;

/**
 * Validate once per process. Production: throw on the first blocking issue.
 * Dev: print a loud warning. Never runs during `next build`.
 */
export function validateEnv(): void {
  if (validated || isBuildPhase) return;
  validated = true;
  const issues = collectEnvIssues();
  if (!issues.length) return;
  const rendered = issues.map((i) => `  ✗ ${i.key} ${i.problem}${i.hint ? `\n      → ${i.hint}` : ""}`).join("\n");
  if (isProd) {
    throw new Error(
      `Adwa Cyber refused to start — environment misconfiguration:\n${rendered}\nFix .env (see .env.example) and restart.`
    );
  }
  console.warn(`⚠ Environment warnings (non-blocking in dev):\n${rendered}`);
}

/** Human-readable runtime facts for /api/health. */
export function envSummary(): { database: "sqlite" | "postgresql" | "unconfigured"; transport: "smtp" | "console"; dataDir: string } {
  const url = process.env.DATABASE_URL ?? "";
  return {
    database: url.startsWith("file:") ? "sqlite" : url ? "postgresql" : "unconfigured",
    transport: process.env.SMTP_HOST ? "smtp" : "console",
    dataDir: process.env.DATA_DIR ?? path.join(process.cwd(), ".data"),
  };
}
