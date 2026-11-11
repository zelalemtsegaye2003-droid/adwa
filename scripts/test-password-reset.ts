/**
 * Adwa Cyber — self-service account recovery tests (dev server, port 3000).
 * Covers: password-reset request/confirm lifecycle, user-enumeration
 * resistance, weak-password rejection, single-use tokens, session
 * revocation on reset, email verification, rate limiting, audit trail.
 *
 * Run: bun scripts/test-password-reset.ts
 * Requires: the dev server console-transport mail log at /tmp/adwa-dev.log
 * (scripts/run-api-tests.sh pipes the server there).
 */
import { readFileSync } from "fs";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const BASE = "http://localhost:3000";
const DEV_LOG = "/tmp/adwa-dev.log";

const SUPER = { email: "admin@adwacyber.et", password: "Adwa#Admin2026!" };
const VIEWER = { email: "viewer@ethiotelecom.et", password: "Adwa#Demo2026!" };

let passed = 0, failed = 0;
function ok(name: string, cond: boolean, extra = "") {
  if (cond) { passed++; console.log(`  ✓ ${name}${extra ? " — " + extra : ""}`); }
  else { failed++; console.error(`  ✗ ${name}${extra ? " — " + extra : ""}`); }
}

// Hard per-request timeout — the suite must hang never, fail loudly instead.
const T = 20_000;
const rawFetch = globalThis.fetch;
globalThis.fetch = ((input: any, init?: any) =>
  rawFetch(input, { ...init, signal: AbortSignal.timeout(T) })) as typeof fetch;

function section(name: string) { console.log(`── ${name} ─────────────────────────────────────────`); }

function parseCaptchaSvg(svg: string): string {
  const chars = [...svg.matchAll(/<text[^>]*>([^<])<\/text>/g)].map((m) => m[1]);
  return chars.join("");
}

async function getCaptcha(ip: string): Promise<{ captchaId: string; captchaAnswer: string }> {
  const res = await fetch(`${BASE}/api/auth/captcha`, { headers: { "X-Forwarded-For": ip } });
  const dto = await res.json();
  return { captchaId: dto.captchaId, captchaAnswer: parseCaptchaSvg(dto.svg) };
}

function parseCookies(res: Response): Record<string, string> {
  const jar: Record<string, string> = {};
  for (const raw of res.headers.getSetCookie?.() ?? []) {
    const [pair] = raw.split(";");
    const eq = pair.indexOf("=");
    jar[pair.slice(0, eq)] = pair.slice(eq + 1);
  }
  return jar;
}

function cookieHeader(jar: Record<string, string>): string {
  return Object.entries(jar).map(([k, v]) => `${k}=${v}`).join("; ");
}

async function login(creds: { email: string; password: string }, ip: string) {
  const captcha = await getCaptcha(ip);
  return fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Forwarded-For": ip },
    body: JSON.stringify({ ...creds, ...captcha }),
  });
}

/** Extract the newest reset/verify token for a user from the console mail log. */
function extractTokenFromLog(kind: "reset-password" | "verify-email", logSizeHint = 0): string | null {
  let log = "";
  try { log = readFileSync(DEV_LOG, "utf8"); } catch { return null; }
  const slice = logSizeHint > 0 ? log.slice(Math.max(0, logSizeHint - 2000)) : log;
  const re = new RegExp(`/${kind}\\?token=([A-Za-z0-9_-]{20,60})`, "g");
  const hits = [...slice.matchAll(re)];
  return hits.length ? hits[hits.length - 1][1] : null;
}

function logSize(): number {
  try { return readFileSync(DEV_LOG, "utf8").length; } catch { return 0; }
}

async function main() {
  section("password reset: request");
  const mark0 = logSize();

  const reqIp = "10.77.50.1";
  const r1 = await fetch(`${BASE}/api/auth/password-reset/request`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Forwarded-For": reqIp },
    body: JSON.stringify({ email: VIEWER.email }),
  });
  ok("request for existing account → 200 ok:true", r1.status === 200 && (await r1.json()).ok === true);

  const r2 = await fetch(`${BASE}/api/auth/password-reset/request`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Forwarded-For": "10.77.50.2" },
    body: JSON.stringify({ email: "nobody@nowhere.et" }),
  });
  const b2 = await r2.json();
  ok("request for unknown email → same generic 200 (no enumeration)", r2.status === 200 && b2.ok === true);

  const r3 = await fetch(`${BASE}/api/auth/password-reset/request`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Forwarded-For": "10.77.50.3" },
    body: JSON.stringify({ email: "not-an-email" }),
  });
  ok("invalid email shape → 400", r3.status === 400);

  const token = extractTokenFromLog("reset-password", mark0);
  ok("single-use token issued and mailed (console transport)", Boolean(token), token ? `token …${token.slice(-6)}` : "not found in log");

  section("password reset: confirm");
  const NEW_PASSWORD = "Adwa#Reset2026x";

  const weak = await fetch(`${BASE}/api/auth/password-reset/confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Forwarded-For": "10.77.51.1" },
    body: JSON.stringify({ token, password: "short1" }),
  });
  ok("weak password rejected → 400 WEAK_PASSWORD", weak.status === 400 && (await weak.json()).error.code === "WEAK_PASSWORD");

  const common = await fetch(`${BASE}/api/auth/password-reset/confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Forwarded-For": "10.77.51.2" },
    body: JSON.stringify({ token, password: "password1234" }),
  });
  ok("common password rejected → 400", common.status === 400);

  const bogus = await fetch(`${BASE}/api/auth/password-reset/confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Forwarded-For": "10.77.51.3" },
    body: JSON.stringify({ token: "AAAA-invalid-token-AAAA", password: NEW_PASSWORD }),
  });
  ok("invalid token rejected → 400 NOT_FOUND", bogus.status === 400 && (await bogus.json()).error.code === "NOT_FOUND");

  // Sign in BEFORE the reset so we can prove session revocation afterwards
  const preLogin = await login(VIEWER, "10.77.52.1");
  const preJar = parseCookies(preLogin);
  ok("viewer can sign in with old password before reset", preLogin.status === 200);

  const confirm = await fetch(`${BASE}/api/auth/password-reset/confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Forwarded-For": "10.77.51.4" },
    body: JSON.stringify({ token, password: NEW_PASSWORD }),
  });
  ok("valid token + policy-ok password → 200", confirm.status === 200);

  const replay = await fetch(`${BASE}/api/auth/password-reset/confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Forwarded-For": "10.77.51.5" },
    body: JSON.stringify({ token, password: "Another#2026x" }),
  });
  ok("token is single-use → replay 400 ALREADY_USED", replay.status === 400 && (await replay.json()).error.code === "ALREADY_USED");

  const oldPass = await login(VIEWER, "10.77.52.2");
  ok("old password no longer works → 401", oldPass.status === 401);

  const newPass = await login({ email: VIEWER.email, password: NEW_PASSWORD }, "10.77.52.3");
  const newJar = newPass.status === 200 ? parseCookies(newPass) : {};
  ok("new password works → 200", newPass.status === 200);

  const stale = await fetch(`${BASE}/api/auth/me`, { headers: { Cookie: cookieHeader(preJar) } });
  ok("pre-reset session revoked → /me 401", stale.status === 401);

  if (newJar.adwa_at) {
    const fresh = await fetch(`${BASE}/api/auth/me`, { headers: { Cookie: cookieHeader(newJar) } });
    ok("post-reset session valid → /me 200", fresh.status === 200);
  }

  section("email verification");
  // Idempotency: a previous run may have already verified this email
  await db.user.update({ where: { email: VIEWER.email }, data: { emailVerifiedAt: null } });
  const markV = logSize();
  const vReq = await fetch(`${BASE}/api/auth/verify-email/request`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Forwarded-For": "10.77.53.1", Cookie: cookieHeader(newJar) },
  });
  ok("verify request (authenticated) → 200", vReq.status === 200);

  const vToken = extractTokenFromLog("verify-email", markV);
  ok("verification token mailed", Boolean(vToken));

  if (vToken) {
    const vBad = await fetch(`${BASE}/api/auth/verify-email/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Forwarded-For": "10.77.53.2" },
      body: JSON.stringify({ token: "bogus" }),
    });
    ok("bogus verification token → 400", vBad.status === 400);

    const vOk = await fetch(`${BASE}/api/auth/verify-email/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Forwarded-For": "10.77.53.3" },
      body: JSON.stringify({ token: vToken }),
    });
    ok("valid verification token → 200", vOk.status === 200);

    const me = await fetch(`${BASE}/api/auth/me`, { headers: { Cookie: cookieHeader(newJar) } });
    const meDto = await me.json();
    ok("/me reports emailVerified=true", meDto.user?.emailVerified === true);

    const vAgain = await fetch(`${BASE}/api/auth/verify-email/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Forwarded-For": "10.77.53.4" },
      body: JSON.stringify({ token: vToken }),
    });
    ok("verification token single-use → 400", vAgain.status === 400);
  }

  section("logged-in password change (WS-7)");
  const CHANGE_IP = "10.77.60.1";
  // newJar = current session of the viewer (password = NEW_PASSWORD at this point)
  const pcHeaders = { "Content-Type": "application/json", "X-Forwarded-For": CHANGE_IP, Cookie: cookieHeader(newJar) };

  const pcNoAuth = await fetch(`${BASE}/api/auth/password`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Forwarded-For": "10.77.60.2" },
    body: JSON.stringify({ currentPassword: NEW_PASSWORD, newPassword: "Whatever#2026z" }),
  });
  ok("unauthenticated change → 401", pcNoAuth.status === 401);

  const pcWrong = await fetch(`${BASE}/api/auth/password`, {
    method: "POST", headers: pcHeaders,
    body: JSON.stringify({ currentPassword: "Definitely#Wrong1", newPassword: "Whatever#2026z" }),
  });
  ok("wrong current password → 400 WRONG_PASSWORD", pcWrong.status === 400 && (await pcWrong.json()).error.code === "WRONG_PASSWORD");

  const pcWeak = await fetch(`${BASE}/api/auth/password`, {
    method: "POST", headers: pcHeaders,
    body: JSON.stringify({ currentPassword: NEW_PASSWORD, newPassword: "password1234" }),
  });
  ok("weak/common new password → 400 WEAK_PASSWORD", pcWeak.status === 400 && (await pcWeak.json()).error.code === "WEAK_PASSWORD");

  const pcSame = await fetch(`${BASE}/api/auth/password`, {
    method: "POST", headers: pcHeaders,
    body: JSON.stringify({ currentPassword: NEW_PASSWORD, newPassword: NEW_PASSWORD }),
  });
  ok("same password → 400 SAME_PASSWORD", pcSame.status === 400 && (await pcSame.json()).error.code === "SAME_PASSWORD");

  const CHANGED_PASSWORD = "Adwa#Changed2026y";
  const pcOk = await fetch(`${BASE}/api/auth/password`, {
    method: "POST", headers: pcHeaders,
    body: JSON.stringify({ currentPassword: NEW_PASSWORD, newPassword: CHANGED_PASSWORD }),
  });
  ok("valid change → 200 ok:true", pcOk.status === 200 && (await pcOk.json()).ok === true);

  const pcStale = await fetch(`${BASE}/api/auth/me`, { headers: { Cookie: cookieHeader(newJar) } });
  ok("all sessions revoked on change → /me 401", pcStale.status === 401);

  const pcOldLogin = await login({ email: VIEWER.email, password: NEW_PASSWORD }, "10.77.60.3");
  ok("pre-change password no longer works → 401", pcOldLogin.status === 401);

  const pcNewLogin = await login({ email: VIEWER.email, password: CHANGED_PASSWORD }, "10.77.60.4");
  const pcNewJar = pcNewLogin.status === 200 ? parseCookies(pcNewLogin) : {};
  ok("changed password signs in → 200", pcNewLogin.status === 200);

  // Restore the demo password through the same endpoint (also proves the
  // per-user rate bucket allows the documented 5 changes / 15 min).
  const pcRestore = await fetch(`${BASE}/api/auth/password`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Forwarded-For": "10.77.60.5", Cookie: cookieHeader(pcNewJar) },
    body: JSON.stringify({ currentPassword: CHANGED_PASSWORD, newPassword: VIEWER.password }),
  });
  ok("demo password restored via change endpoint", pcRestore.status === 200);
  const pcCheck = await login(VIEWER, "10.77.60.6");
  ok("restored demo password signs in → 200", pcCheck.status === 200);

  section("audit trail");
  const superLogin = await login(SUPER, "10.77.54.1");
  const superJar = parseCookies(superLogin);
  const auditRes = await fetch(`${BASE}/api/auth/audit?limit=100`, { headers: { Cookie: cookieHeader(superJar) } });
  const auditDto = await auditRes.json();
  const types = new Set((auditDto.events ?? []).map((e: { type: string }) => e.type));
  ok("PASSWORD_RESET_REQUESTED audited", types.has("PASSWORD_RESET_REQUESTED"));
  ok("PASSWORD_RESET_COMPLETED audited", types.has("PASSWORD_RESET_COMPLETED"));
  ok("EMAIL_VERIFICATION_SENT audited", types.has("EMAIL_VERIFICATION_SENT"));
  ok("EMAIL_VERIFIED audited", types.has("EMAIL_VERIFIED"));
  ok("PASSWORD_CHANGED audited", types.has("PASSWORD_CHANGED"));
  ok("PASSWORD_CHANGE_FAILED audited", types.has("PASSWORD_CHANGE_FAILED"));

  section("rate limiting");
  const floodIp = "10.77.55.9";
  let lastStatus = 0;
  for (let i = 0; i < 6; i++) {
    const r = await fetch(`${BASE}/api/auth/password-reset/request`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Forwarded-For": floodIp },
      body: JSON.stringify({ email: "rate@test.et" }),
    });
    lastStatus = r.status;
  }
  ok("6th request from one IP → 429 RATE_LIMITED", lastStatus === 429);

  // Restore the original demo password so other suites stay green
  const mark1 = logSize();
  await fetch(`${BASE}/api/auth/password-reset/request`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Forwarded-For": "10.77.56.1" },
    body: JSON.stringify({ email: VIEWER.email }),
  });
  const restoreToken = extractTokenFromLog("reset-password", mark1);
  if (restoreToken) {
    await fetch(`${BASE}/api/auth/password-reset/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Forwarded-For": "10.77.56.2" },
      body: JSON.stringify({ token: restoreToken, password: VIEWER.password }),
    });
    const check = await login(VIEWER, "10.77.56.3");
    ok("demo password restored for other suites", check.status === 200);
  } else {
    ok("demo password restored for other suites", false, "restore token not found");
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => { console.error("suite crashed:", err); process.exit(1); });
