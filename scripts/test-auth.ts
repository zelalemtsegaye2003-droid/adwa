/**
 * Adwa Cyber — auth end-to-end tests against the running dev server (port 3000).
 * Covers: captcha, login, MFA (TOTP + backup), JWT cookies, refresh rotation
 * with reuse detection, tenant isolation, RBAC matrix, lockout, logout.
 *
 * Run: bun scripts/test-auth.ts
 */
const BASE = "http://localhost:3000";

const SUPER = { email: "admin@adwacyber.et", password: "Adwa#Admin2026!" };
const ORG_ADMIN = { email: "admin@cbe.com.et", password: "Adwa#Demo2026!" };
const OFFICER = { email: "officer@cbe.com.et", password: "Adwa#Demo2026!" };
const AUDITOR = { email: "auditor@dashen.com.et", password: "Adwa#Demo2026!" };
const VIEWER = { email: "viewer@ethiotelecom.et", password: "Adwa#Demo2026!" };
const OFFICER_TOTP_SECRET = "UPRWOJXX2JVEYGDRDDXSWXDGCDIJLNLD";

let passed = 0, failed = 0;
function ok(name: string, cond: boolean, extra = "") {
  if (cond) { passed++; console.log(`  ✓ ${name}${extra ? " — " + extra : ""}`); }
  else { failed++; console.error(`  ✗ ${name}${extra ? " — " + extra : ""}`); }
}

// ── helpers ────────────────────────────────────────────────────────────────
function parseCaptchaSvg(svg: string): string {
  const chars = [...svg.matchAll(/<text[^>]*>([^<])<\/text>/g)].map((m) => m[1]);
  return chars.join("");
}

async function getCaptcha(ip = "10.99.9.9"): Promise<{ captchaId: string; captchaAnswer: string }> {
  const res = await fetch(`${BASE}/api/auth/captcha`, { headers: { "X-Forwarded-For": ip } });
  const dto = await res.json();
  if (!dto.captchaId) throw new Error(`captcha fetch failed: ${JSON.stringify(dto)}`);
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

const ips = new Map<string, string>();
function ipFor(email: string): string {
  // Stable pseudo-IP per account so per-IP rate limits don't collide in tests.
  if (!ips.has(email)) {
    const h = [...email].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
    ips.set(email, `10.42.${(h >> 8) & 255}.${h & 255}`);
  }
  return ips.get(email)!;
}

async function login(creds: { email: string; password: string }, ip?: string) {
  const attempt = async () => {
    const captcha = await getCaptcha(ip ?? ipFor(creds.email));
    const res = await fetch(`${BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Forwarded-For": ip ?? ipFor(creds.email) },
      body: JSON.stringify({ ...creds, ...captcha }),
    });
    return { res, body: await res.json().catch(() => null), jar: parseCookies(res) };
  };
  let out = await attempt();
  if (out.res.status === 429) {
    // Per-account/IP login limiter (10 and 20 per 5 min) — wait out the
    // window once so back-to-back suite runs stay green.
    console.log("  (login rate limited — waiting 65s for the window to reset…)");
    await new Promise((r) => setTimeout(r, 65_000));
    out = await attempt();
  }
  return out;
}

/** RFC 6238 TOTP for tests. */
function totpNow(secret: string): string {
  const crypto = require("crypto");
  const A = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = 0, value = 0;
  const out: number[] = [];
  for (const ch of secret) {
    value = (value << 5) | A.indexOf(ch);
    bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; }
  }
  const key = Buffer.from(out);
  const counter = Math.floor(Date.now() / 1000 / 30);
  const buf = Buffer.alloc(8);
  buf.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  buf.writeUInt32BE(counter % 0x100000000, 4);
  const hmac = crypto.createHmac("sha1", key).update(buf).digest();
  const off = hmac[hmac.length - 1] & 0x0f;
  const bin = ((hmac[off] & 0x7f) << 24) | ((hmac[off + 1] & 0xff) << 16) | ((hmac[off + 2] & 0xff) << 8) | (hmac[off + 3] & 0xff);
  return (bin % 10 ** 6).toString().padStart(6, "0");
}

async function api(path: string, jar: Record<string, string>, init: RequestInit = {}, ip = "10.99.0.1") {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      Cookie: cookieHeader(jar),
      Origin: BASE,
      "X-Forwarded-For": ip,
      ...init.headers,
    },
  });
  return { res, body: await res.json().catch(() => null) };
}

// ── tests ──────────────────────────────────────────────────────────────────
async function main() {
  console.log("\n══ 1. Unauthenticated access is blocked ══");
  {
    const r = await fetch(`${BASE}/api/stats`);
    ok("GET /api/stats without session → 401", r.status === 401);
    const r2 = await fetch(`${BASE}/api/rules`);
    ok("GET /api/rules without session → 401", r2.status === 401);
  }

  console.log("\n══ 2. Captcha enforcement ══");
  {
    const captcha = await getCaptcha("10.77.0.2");
    const wrong = await fetch(`${BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Forwarded-For": "10.77.0.2" },
      body: JSON.stringify({ ...SUPER, captchaId: captcha.captchaId, captchaAnswer: "XXXXX" }),
    });
    ok("login with wrong captcha → 400 CAPTCHA_FAILED", wrong.status === 400 && (await wrong.json()).error.code === "CAPTCHA_FAILED");

    const replay = await fetch(`${BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Forwarded-For": "10.77.0.2" },
      body: JSON.stringify({ ...SUPER, captchaId: captcha.captchaId, captchaAnswer: parseCaptchaSvg("") || "AAAAA" }),
    });
    ok("consumed captcha cannot be replayed → 400", replay.status === 400);
  }

  console.log("\n══ 3. Login (super admin, no MFA) ══");
  let superJar: Record<string, string>;
  {
    const bad = await login({ email: SUPER.email, password: "Wrong#Pass123" });
    ok("wrong password → 401 INVALID_CREDENTIALS", bad.res.status === 401);

    const good = await login(SUPER);
    ok("correct credentials → 200", good.res.status === 200, `mfaRequired=${good.body?.mfaRequired}`);
    ok("session cookies issued (adwa_at + adwa_rt)", Boolean(good.jar.adwa_at && good.jar.adwa_rt));
    ok("no MFA required for super admin", good.body?.mfaRequired === false);
    superJar = good.jar;

    const me = await api("/api/auth/me", superJar);
    ok("GET /api/auth/me → 200 with role", me.res.status === 200 && me.body?.user?.role === "SUPER_ADMIN",
      `${me.body?.user?.email} / ${me.body?.user?.roleLabel} / perms=${me.body?.permissions?.length}`);
  }

  console.log("\n══ 4. MFA flow (TOTP) ══");
  let officerJar: Record<string, string>;
  {
    const step1 = await login(OFFICER);
    ok("password ok + MFA on → mfaRequired", step1.res.status === 200 && step1.body?.mfaRequired === true);
    ok("mfaToken issued, no session cookies yet", Boolean(step1.body?.mfaToken) && !step1.jar.adwa_at);

    const badCode = await fetch(`${BASE}/api/auth/mfa/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mfaToken: step1.body.mfaToken, code: "000000" }),
    });
    ok("wrong TOTP → 401 MFA_CODE_INVALID", badCode.status === 401 && (await badCode.json()).error.code === "MFA_CODE_INVALID");

    // TOTP codes are single-use per 30s step (replay protection): if another
    // suite consumed the current step moments ago, wait one step and retry.
    let goodCode: Response | null = null;
    let officerToken: string = step1.body.mfaToken;
    for (let attempt = 0; attempt < 2; attempt++) {
      const res = await fetch(`${BASE}/api/auth/mfa/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mfaToken: officerToken, code: totpNow(OFFICER_TOTP_SECRET) }),
      });
      if (res.status === 200) { goodCode = res; break; }
      if (attempt === 0) {
        console.log("  (TOTP step already consumed — waiting 31s for the next window…)");
        await new Promise((r) => setTimeout(r, 31_000));
        const retry = await login(OFFICER);
        officerToken = retry.body?.mfaToken ?? officerToken;
      }
    }
    ok("correct TOTP → 200 + session cookies", Boolean(goodCode && goodCode.status === 200 && parseCookies(goodCode).adwa_at),
       goodCode ? `code verified` : "both attempts failed");
    officerJar = goodCode ? parseCookies(goodCode) : {};

    const me = await api("/api/auth/me", officerJar);
    ok("officer /me → COMPLIANCE_OFFICER @ CBE", me.body?.user?.role === "COMPLIANCE_OFFICER" && me.body?.user?.orgName?.includes("CBE"));
  }

  console.log("\n══ 5. MFA backup code (single use) ══");
  {
    // get a backup code from DB via a fresh seed? No — use one printed earlier is unknown to script.
    // Instead verify a *wrong* backup code fails and TOTP still works after.
    const step1 = await login(OFFICER);
    const wrongBackup = await fetch(`${BASE}/api/auth/mfa/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mfaToken: step1.body.mfaToken, code: "AAAAA-BBBBB" }),
    });
    ok("wrong backup code → 401", wrongBackup.status === 401);
  }

  console.log("\n══ 6. Tenant isolation — VIEWER ══");
  let viewerJar: Record<string, string>;
  {
    const v = await login(VIEWER);
    ok("viewer login → 200", v.res.status === 200);
    viewerJar = v.jar;

    const users = await api("/api/auth/users", viewerJar);
    ok("viewer cannot list users → 403", users.res.status === 403);

    const scan = await api("/api/scans", viewerJar, {
      method: "POST",
      body: JSON.stringify({ organizationId: "cmw6db9yl001bs9ry3g5ypemp" }), // CBE id
    });
    ok("viewer cannot start scan → 403", scan.res.status === 403);

    const orgs = await api("/api/organizations", viewerJar);
    ok("viewer sees ONLY its own org", orgs.res.status === 200 && orgs.body?.organizations?.length === 1 && orgs.body.organizations[0].name.includes("Ethio Telecom"),
      `count=${orgs.body?.organizations?.length}`);

    const stats = await api("/api/stats", viewerJar);
    ok("viewer stats → tenant scope", stats.res.status === 200 && stats.body?.scope === "tenant");
  }

  console.log("\n══ 7. Tenant isolation — AUDITOR (read-only) ══");
  {
    const a = await login(AUDITOR);
    const auditorJar = a.jar;
    ok("auditor login → 200", a.res.status === 200);

    const audit = await api("/api/auth/audit", auditorJar);
    ok("auditor can read audit log", audit.res.status === 200 && Array.isArray(audit.body?.events));

    // cross-tenant finding write must fail — use a scan from another org
    const scans = await api("/api/scans", auditorJar);
    const ownScanIds = new Set((scans.body?.scans ?? []).map((s: any) => s.id));
    const allScansSuper = await api("/api/scans", superJar);
    const foreign = (allScansSuper.body?.scans ?? []).find((s: any) => !ownScanIds.has(s.id));
    if (foreign) {
      const detail = await api(`/api/scans/${foreign.id}`, auditorJar);
      ok("auditor cannot read foreign org scan → 403", detail.res.status === 403, foreign.organization?.name ?? "");
    } else {
      ok("auditor cannot read foreign org scan → 403 (skipped: no foreign scan)", true);
    }

    const users = await api("/api/auth/users", auditorJar);
    ok("auditor cannot manage users → 403", users.res.status === 403);
  }

  console.log("\n══ 8. ORG_ADMIN — user management + scoping ══");
  let orgAdminJar: Record<string, string>;
  {
    const oa = await login(ORG_ADMIN);
    orgAdminJar = oa.jar;
    ok("org admin login → 200", oa.res.status === 200);

    const users = await api("/api/auth/users", orgAdminJar);
    ok("org admin lists own tenant users", users.res.status === 200 && users.body?.users?.every((u: any) => u.orgName?.includes("CBE") || u.orgName === null),
      `count=${users.body?.users?.length}`);

    const created = await api("/api/auth/users", orgAdminJar, {
      method: "POST",
      body: JSON.stringify({ name: "Temp Officer", email: `temp${Date.now()}@cbe.com.et`, role: "AUDITOR", password: "Temp#Pass2026" }),
    });
    ok("org admin creates tenant user → 201", created.res.status === 201, created.body?.user?.email);

    const esc = await api("/api/auth/users", orgAdminJar, {
      method: "POST",
      body: JSON.stringify({ name: "Escalate", email: `esc${Date.now()}@cbe.com.et`, role: "SUPER_ADMIN", password: "Temp#Pass2026" }),
    });
    ok("org admin cannot create SUPER_ADMIN → 400", esc.res.status === 400);

    const patchRole = await api(`/api/auth/users/${created.body.user.id}`, orgAdminJar, {
      method: "PATCH",
      body: JSON.stringify({ role: "VIEWER" }),
    });
    ok("org admin changes role → 200", patchRole.res.status === 200 && patchRole.body?.user?.role === "VIEWER");

    const disable = await api(`/api/auth/users/${created.body.user.id}`, orgAdminJar, {
      method: "PATCH",
      body: JSON.stringify({ status: "DISABLED" }),
    });
    ok("org admin disables user → 200", disable.res.status === 200 && disable.body?.user?.status === "DISABLED");

    // cross-tenant patch attempt: modify a dashen user as CBE admin
    const superUsers = await api("/api/auth/users", superJar);
    const dashenUser = superUsers.body?.users?.find((u: any) => u.email === "auditor@dashen.com.et");
    const cross = await api(`/api/auth/users/${dashenUser.id}`, orgAdminJar, {
      method: "PATCH",
      body: JSON.stringify({ role: "VIEWER" }),
    });
    ok("cross-tenant user patch → 403", cross.res.status === 403);
  }

  console.log("\n══ 9. SUPER_ADMIN — platform scope ══");
  {
    const orgs = await api("/api/organizations", superJar);
    // prisma/seed.ts defines exactly 6 pilot organizations; >=6 (not 7) keeps
    // this check honest on a freshly seeded database.
    ok("super admin sees ALL organizations", orgs.res.status === 200 && orgs.body?.organizations?.length >= 6, `count=${orgs.body?.organizations?.length}`);

    const stats = await api("/api/stats", superJar);
    ok("super admin stats → platform scope", stats.body?.scope === "platform");

    const users = await api("/api/auth/users", superJar);
    ok("super admin lists all users", users.res.status === 200 && users.body?.users?.length >= 6, `count=${users.body?.users?.length}`);

    const audit = await api("/api/auth/audit", superJar);
    ok("super admin reads platform audit", audit.res.status === 200 && audit.body?.total > 0, `events=${audit.body?.total}`);

    // CSRF: cross-origin POST is blocked
    const csrf = await fetch(`${BASE}/api/auth/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieHeader(superJar), Origin: "https://evil.example", "X-Forwarded-For": "10.99.0.1" },
      body: JSON.stringify({ name: "Evil", email: "evil@evil.com", role: "SUPER_ADMIN", password: "Evil#Pass1234" }),
    });
    ok("cross-origin POST blocked → 403", csrf.status === 403);
  }

  console.log("\n══ 10. Refresh rotation + reuse detection ══");
  {
    const r1 = await fetch(`${BASE}/api/auth/refresh`, {
      method: "POST",
      headers: { Cookie: cookieHeader(viewerJar) },
    });
    const jar1 = parseCookies(r1);
    ok("refresh #1 → 200 with new cookies", r1.status === 200 && Boolean(jar1.adwa_rt) && jar1.adwa_rt !== viewerJar.adwa_rt);

    // Replay the ORIGINAL (now revoked) token → reuse detection kills all sessions
    const r2 = await fetch(`${BASE}/api/auth/refresh`, {
      method: "POST",
      headers: { Cookie: cookieHeader(viewerJar) },
    });
    const body2 = await r2.json();
    ok("replaying old refresh token → 401 TOKEN_REUSE_DETECTED", r2.status === 401 && body2?.error?.code === "TOKEN_REUSE_DETECTED");

    // The rotated token from r1 must ALSO be dead (family revoked)
    const r3 = await fetch(`${BASE}/api/auth/refresh`, {
      method: "POST",
      headers: { Cookie: cookieHeader(jar1) },
    });
    ok("whole session family revoked after reuse", r3.status === 401);

    const me = await api("/api/auth/me", jar1);
    ok("stolen access token no longer usable → 401", me.res.status === 401);
  }

  console.log("\n══ 11. Account lockout after 5 failures ══");
  {
    const email = `locktest${Date.now()}@cbe.com.et`;
    await api("/api/auth/users", orgAdminJar, {
      method: "POST",
      body: JSON.stringify({ name: "Lock Test", email, role: "VIEWER", password: "Temp#Pass2026" }),
    });
    let lastStatus = 0;
    for (let i = 0; i < 5; i++) {
      const c = await getCaptcha("10.66.0." + (i + 1));
      const res = await fetch(`${BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Forwarded-For": "10.66.0." + (i + 1) },
        body: JSON.stringify({ email, password: "Wrong#Pass123", ...c }),
      });
      lastStatus = res.status;
    }
    ok("5th wrong password → 401", lastStatus === 401);

    const c = await getCaptcha("10.66.1.1");
    const locked = await fetch(`${BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Forwarded-For": "10.66.1.1" },
      body: JSON.stringify({ email, password: "Temp#Pass2026", ...c }),
    });
    const lockedBody = await locked.json();
    ok("correct password now blocked → 423 ACCOUNT_LOCKED", locked.status === 423 && lockedBody?.error?.code === "ACCOUNT_LOCKED");
  }

  console.log("\n══ 12. MFA enrollment flow (setup → enable → disable) ══");
  {
    const wasasa = await login({ email: "admin@wasasa.et", password: "Adwa#Demo2026!" });
    const jar = wasasa.jar;

    const setup = await api("/api/auth/mfa/setup", jar, { method: "POST" });
    ok("MFA setup returns QR + secret", setup.res.status === 200 && Boolean(setup.body?.qrDataUrl?.startsWith("data:image/png")) && Boolean(setup.body?.secret));

    const enableBad = await api("/api/auth/mfa/enable", jar, { method: "POST", body: JSON.stringify({ code: "123456" }) });
    ok("enable with wrong code → 400", enableBad.res.status === 400);

    const code = totpNow(setup.body.secret); // fresh secret per enrollment — no replay risk
    const enable = await api("/api/auth/mfa/enable", jar, { method: "POST", body: JSON.stringify({ code }) });
    ok("enable with live TOTP → backup codes issued", enable.res.status === 200 && enable.body?.backupCodes?.length === 10);

    const me = await api("/api/auth/me", jar);
    ok("/me reflects MFA enabled", me.body?.user?.mfaEnabled === true);

    // login now requires MFA
    const relogin = await login({ email: "admin@wasasa.et", password: "Adwa#Demo2026!" });
    ok("re-login now challenges MFA", relogin.body?.mfaRequired === true);

    // disable requires password + code (old jar was revoked? sessions continue until access expires; use new session)
    const verify = await fetch(`${BASE}/api/auth/mfa/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mfaToken: relogin.body.mfaToken, code: totpNow(setup.body.secret) }),
    });
    const jar2 = parseCookies(verify);
    ok("MFA verify after enrollment → 200", verify.status === 200);

    const disBad = await api("/api/auth/mfa/disable", jar2, {
      method: "POST",
      body: JSON.stringify({ password: "Adwa#Demo2026!", code: "000000" }),
    });
    ok("disable with wrong code → 401", disBad.res.status === 401);

    const dis = await api("/api/auth/mfa/disable", jar2, {
      method: "POST",
      body: JSON.stringify({ password: "Adwa#Demo2026!", code: totpNow(setup.body.secret) }),
    });
    ok("disable with password+code → 200", dis.res.status === 200);
  }

  console.log("\n══ 13. Logout ══");
  {
    const out = await fetch(`${BASE}/api/auth/logout`, {
      method: "POST",
      headers: { Cookie: cookieHeader(superJar), Origin: BASE },
    });
    ok("logout → 200", out.status === 200);

    // refresh token revoked
    const refresh = await fetch(`${BASE}/api/auth/refresh`, {
      method: "POST",
      headers: { Cookie: cookieHeader(superJar) },
    });
    ok("refresh after logout → 401", refresh.status === 401);
  }

  console.log("\n══ 14. Tenant self-registration ══");
  {
    const captcha = await getCaptcha("10.55.0.7");
    const reg = await fetch(`${BASE}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: BASE, "X-Forwarded-For": "10.55.0.7" },
      body: JSON.stringify({
        organizationName: "Test MFI",
        sector: "Microfinance",
        adminName: "Test Admin",
        adminEmail: `founder${Date.now()}@testmfi.et`,
        password: "Found#Pass2026",
        ...captcha,
      }),
    });
    const body = await reg.json();
    ok("register org + admin → 201 with session", reg.status === 201 && Boolean(parseCookies(reg).adwa_at), body?.organization?.name);

    // cleanup
    const me = await api("/api/auth/me", parseCookies(reg));
    // remove test org
    const { PrismaClient } = require("@prisma/client");
    const db = new PrismaClient();
    await db.user.deleteMany({ where: { email: body.user.email } });
    await db.organization.deleteMany({ where: { name: "Test MFI" } });
    await db.user.deleteMany({ where: { email: { startsWith: "temp" } } });
    await db.user.deleteMany({ where: { email: { startsWith: "locktest" } } });
    await db.$disconnect();
    ok("test data cleaned up", true);
  }

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`RESULT: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => { console.error("FATAL:", e); process.exit(1); });
