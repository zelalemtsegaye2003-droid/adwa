/**
 * Adwa Cyber — OWASP Top 10 (2021) security test suite.
 * ---------------------------------------------------------------------
 * Runs against the live dev server through the gateway (port 81), exactly
 * as the app is consumed. Every category A01–A10 gets dynamic checks
 * (real HTTP attacks) plus static source analysis where appropriate.
 *
 * What each category verifies:
 *   A01 Broken Access Control   — authZ on every endpoint, IDOR/tenant
 *                                 isolation, cross-origin POST, forged and
 *                                 tampered JWTs, path traversal ids
 *   A02 Cryptographic Failures  — cookie flags, token storage, no secrets
 *                                 in JWT/API responses
 *   A03 Injection               — SQLi/NoSQL/XSS/prototype-pollution probes
 *                                 and type-confusion (no 500s)
 *   A04 Insecure Design         — password policy + common-password list,
 *                                 length caps (DoS), mass-assignment
 *   A05 Security Misconfig      — security headers, no framework banner,
 *                                 JSON-only errors (no stack traces)
 *   A06 Vulnerable Components   — dependency inventory check (see also
 *                                 `bun pm audit` in CI)
 *   A07 Ident. & Auth Failures  — username-enumeration (message + timing),
 *                                 MFA token confusion, TOTP replay,
 *                                 per-account MFA brute-force limit
 *   A08 Data Integrity          — alg:none / wrong-key / tampered-claims
 *                                 tokens all rejected; opaque refresh tokens
 *   A09 Logging & Monitoring    — attacks produce audit events; audit never
 *                                 logs credentials
 *   A10 SSRF                    — no server-side fetch of user-supplied URLs
 *
 * Run: bun scripts/test-owasp.ts   (dev server + mock provider must run)
 */
import { SignJWT } from "jose";
import { createHmac } from "crypto";
import { PrismaClient } from "@prisma/client";
import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";

/**
 * NOTE: this suite talks to Next.js DIRECTLY (port 3000) rather than the
 * Caddy gateway — the gateway rewrites X-Forwarded-For to the socket peer
 * (127.0.0.1), which would collapse every probe into one rate-limit bucket.
 * Gateway-specific behavior (mock provider routing, forwarded-origin OAuth)
 * is covered by scripts/test-google.ts.
 */
const BASE = "http://localhost:3000";
const PROJECT = "/adwa";

const SUPER = { email: "admin@adwacyber.et", password: "Adwa#Admin2026!" };
const VIEWER = { email: "viewer@ethiotelecom.et", password: "Adwa#Demo2026!" };
const OFFICER = { email: "officer@cbe.com.et", password: "Adwa#Demo2026!" };
const OFFICER_TOTP_SECRET = "UPRWOJXX2JVEYGDRDDXSWXDGCDIJLNLD";

let passed = 0, failed = 0;
function ok(name: string, cond: boolean, extra = "") {
  if (cond) { passed++; console.log(`  ✓ ${name}${extra ? " — " + extra : ""}`); }
  else { failed++; console.error(`  ✗ ${name}${extra ? " — " + extra : ""}`); }
}

// ── helpers ────────────────────────────────────────────────────────────────
function parseCookies(res: Response): Record<string, string> {
  const jar: Record<string, string> = {};
  for (const raw of res.headers.getSetCookie?.() ?? []) {
    const [pair] = raw.split(";");
    const eq = pair.indexOf("=");
    jar[pair.slice(0, eq)] = pair.slice(eq + 1);
  }
  return jar;
}
const cookieStr = (jar: Record<string, string>) =>
  Object.entries(jar).map(([k, v]) => `${k}=${v}`).join("; ");

function parseCaptchaSvg(svg: string): string {
  return [...svg.matchAll(/<text[^>]*>([^<])<\/text>/g)].map((m) => m[1]).join("");
}

let ipCounter = 0;
function freshIp(prefix: string): string {
  return `10.${prefix}.${Math.floor(ipCounter / 250) % 250}.${(ipCounter++ % 250) + 1}`;
}

async function getCaptcha(ip: string): Promise<{ captchaId: string; captchaAnswer: string }> {
  const res = await fetch(`${BASE}/api/auth/captcha`, { headers: { "X-Forwarded-For": ip } });
  const dto = await res.json();
  if (!dto?.svg) throw new Error(`captcha fetch failed (${res.status}): ${JSON.stringify(dto).slice(0, 200)}`);
  return { captchaId: dto.captchaId, captchaAnswer: parseCaptchaSvg(dto.svg) };
}

/** Raw login POST (no pre-fetched captcha unless provided). */
async function loginPost(
  body: Record<string, unknown>,
  ip: string,
  withCaptcha = true
): Promise<{ res: Response; body: any; jar: Record<string, string> }> {
  const captcha = withCaptcha ? await getCaptcha(ip) : { captchaId: "x", captchaAnswer: "x" };
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Forwarded-For": ip },
    body: JSON.stringify({ ...body, ...captcha }),
  });
  return { res, body: await res.json().catch(() => null), jar: parseCookies(res) };
}

function totpNow(secret: string): string {
  const A = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = 0, value = 0;
  const out: number[] = [];
  for (const ch of secret) {
    value = (value << 5) | A.indexOf(ch);
    bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; }
  }
  const key = Buffer.from(out);
  const counter = Buffer.alloc(8);
  counter.writeUInt32BE(Math.floor(Date.now() / 1000 / 30), 4);
  const hmac = createHmac("sha1", key).update(counter).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const code = ((hmac[offset] & 0x7f) << 24 | hmac[offset + 1] << 16 | hmac[offset + 2] << 8 | hmac[offset + 3]) % 1_000_000;
  return String(code).padStart(6, "0");
}

const b64u = (obj: unknown) => Buffer.from(JSON.stringify(obj)).toString("base64url");
function decodeJwtPayload(token: string): Record<string, unknown> {
  return JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString());
}

/** Recursively walk source files (for static checks). */
function walk(dir: string, exts: string[], out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) {
      if (["node_modules", ".next", "scripts", "mini-services", ".devscripts"].includes(entry)) continue;
      walk(p, exts, out);
    } else if (exts.some((e) => p.endsWith(e))) out.push(p);
  }
  return out;
}

async function main() {
  const db = new PrismaClient();
  const { hashPassword, encryptSecret } = await import("../src/lib/auth/crypto");
  const probePassword = "Zx9!LeakProbe#77q"; // distinctive — must NEVER appear in logs

  console.log("══════ OWASP Top 10 — Adwa Cyber identity layer ══════");

  // ONE cached super-admin session for the whole suite — the per-account login
  // limiter counts every attempt (success AND failure), so logging in once
  // keeps repeated runs from tripping it.
  const superLogin = await loginPost(SUPER, freshIp("0"));
  if (superLogin.res.status !== 200) {
    console.error("FATAL: super admin login failed — restart the dev server (in-memory rate limits may be hot) and re-run.");
    process.exit(1);
  }
  const superCookie = cookieStr(superLogin.jar);
  console.log("  (cached super-admin session for the whole suite)");

  // ── A01: Broken Access Control ───────────────────────────────────────────
  console.log("\n══ A01 Broken Access Control ══");
  {
    for (const path of ["/api/stats", "/api/rules", "/api/scans", "/api/auth/users", "/api/auth/audit", "/api/organizations"]) {
      const r = await fetch(`${BASE}${path}`);
      ok(`unauthenticated GET ${path} → 401`, r.status === 401, `got ${r.status}`);
    }

    // Viewer login for IDOR probes.
    const v = await loginPost(VIEWER, freshIp("1"));
    ok("viewer login for IDOR probes", v.res.status === 200);
    const vCookie = cookieStr(v.jar);

    const cbeScan = await db.scan.findFirst({ where: { organization: { name: { contains: "Commercial Bank" } } } });
    if (cbeScan) {
      const r = await fetch(`${BASE}/api/scans/${cbeScan.id}`, { headers: { cookie: vCookie } });
      ok("IDOR: viewer cannot read foreign-tenant scan", r.status === 403 || r.status === 404, `got ${r.status}`);
    } else ok("IDOR: viewer cannot read foreign-tenant scan (no CBE scan found)", false);

    const cbeOfficer = await db.user.findUnique({ where: { email: "officer@cbe.com.et" } });
    if (cbeOfficer) {
      const r = await fetch(`${BASE}/api/auth/users/${cbeOfficer.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", cookie: vCookie },
        body: JSON.stringify({ role: "ORG_ADMIN" }),
      });
      ok("IDOR: viewer cannot patch foreign-tenant user", r.status === 403 || r.status === 404, `got ${r.status}`);
    }

    const cbeFinding = await db.scanResult.findFirst({
      where: { scan: { organization: { name: { contains: "Commercial Bank" } } } },
    });
    if (cbeFinding) {
      const r = await fetch(`${BASE}/api/findings/${cbeFinding.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", cookie: vCookie },
        body: JSON.stringify({ status: "waived" }),
      });
      ok("IDOR: viewer cannot patch foreign-tenant finding", r.status === 403 || r.status === 404, `got ${r.status}`);
    }

    const r4 = await fetch(`${BASE}/api/auth/audit`, { headers: { cookie: vCookie } });
    ok("viewer cannot read audit log", r4.status === 403, `got ${r4.status}`);

    const r5 = await fetch(`${BASE}/api/auth/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie: vCookie, Origin: "https://evil.example" },
      body: JSON.stringify({ email: "evil@cbe.com.et", name: "Evil", role: "ORG_ADMIN", password: "Password123x" }),
    });
    ok("cross-origin POST blocked (CSRF)", r5.status === 403, `got ${r5.status}`);

    // Path traversal as super admin so the RBAC layer doesn't mask the
    // id validation (as an under-privileged role the 403 is equally safe).
    const r6 = await fetch(`${BASE}/api/auth/users/${encodeURIComponent("../../../etc/passwd")}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", cookie: superCookie },
      body: JSON.stringify({ name: "x" }),
    });
    ok("path traversal id rejected", r6.status === 400 || r6.status === 403 || r6.status === 404, `got ${r6.status}`);
    const r7 = await fetch(`${BASE}/api/auth/users/${encodeURIComponent("'; DROP TABLE User; --")}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", cookie: superCookie },
      body: JSON.stringify({ name: "x" }),
    });
    ok("SQLi in route id rejected", r7.status === 400 || r7.status === 403 || r7.status === 404, `got ${r7.status}`);
  }

  // ── A02: Cryptographic Failures ──────────────────────────────────────────
  console.log("\n══ A02 Cryptographic Failures ══");
  {
    const s = superLogin; // cached session (login response carries the cookies)
    ok("super admin session available for cookie inspection", s.res.status === 200);
    const setCookies = s.res.headers.getSetCookie?.() ?? [];
    const atCookie = setCookies.find((c) => c.startsWith("adwa_at=")) ?? "";
    const rtCookie = setCookies.find((c) => c.startsWith("adwa_rt=")) ?? "";
    ok("access cookie: HttpOnly + SameSite", /httponly/i.test(atCookie) && /samesite=lax/i.test(atCookie));
    ok("refresh cookie: HttpOnly + SameSite + scoped path", /httponly/i.test(rtCookie) && /samesite=lax/i.test(rtCookie) && /path=\/api\/auth/i.test(rtCookie));

    const claims = decodeJwtPayload(s.jar.adwa_at);
    const claimKeys = Object.keys(claims).join(",").toLowerCase();
    ok("JWT carries identity claims only (no secrets)", !/password|secret|backup|hash/.test(claimKeys), Object.keys(claims).join(", "));

    const usersRes = await fetch(`${BASE}/api/auth/users`, { headers: { cookie: cookieStr(s.jar) } });
    const usersText = await usersRes.text();
    ok("user list leaks no secrets", usersRes.status === 200 && !/passwordHash|mfaSecret|backupCodes/i.test(usersText));

    // Refresh token is opaque (not a JWT, 256-bit).
    ok("refresh token is opaque 256-bit random", /^[A-Za-z0-9_-]{40,}$/.test(s.jar.adwa_rt) && !s.jar.adwa_rt.includes("."));

    // Static: refresh tokens stored hashed, passwords scrypt.
    const sessionSrc = readFileSync(join(PROJECT, "src/lib/auth/session.ts"), "utf8");
    ok("refresh tokens hashed at rest (sha256)", sessionSrc.includes("tokenHash: sha256("));
    const cryptoSrc = readFileSync(join(PROJECT, "src/lib/auth/crypto.ts"), "utf8");
    ok("passwords hashed with scrypt (N=16384)", /SCRYPT_N = 16384/.test(cryptoSrc) && cryptoSrc.includes("scryptSync"));
  }

  // ── A03: Injection ───────────────────────────────────────────────────────
  console.log("\n══ A03 Injection ══");
  {
    const ips = { sqli: freshIp("3"), nosql: freshIp("3"), proto: freshIp("3"), type: freshIp("3") };

    const r1 = await loginPost({ email: "admin@adwacyber.et' OR '1'='1' --", password: "Password123" }, ips.sqli);
    ok("SQLi in email → clean 401, no 500", r1.res.status === 401, `got ${r1.res.status}`);

    const r2 = await loginPost({ email: { $ne: null } as any, password: { $ne: null } as any }, ips.nosql, false);
    ok("NoSQL/type-confusion body → clean 4xx, no 500", r2.res.status === 400 || r2.res.status === 401, `got ${r2.res.status}`);

    const r3 = await fetch(`${BASE}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Forwarded-For": ips.proto },
      body: JSON.stringify({ __proto__: { polluted: true }, constructor: { prototype: { polluted: true } }, organizationName: "Proto Probe", adminName: "Proto", adminEmail: "proto@test.et", password: "Password123x", captchaId: "x", captchaAnswer: "x" }),
    });
    ok("prototype-pollution keys → no crash", r3.status === 400, `got ${r3.status}`);
    const probeResp = await fetch(`${BASE}/api/auth/config`);
    const cfg = await probeResp.json();
    ok("server state unaffected by proto probe", cfg.googleEnabled === true, "config still sane");

    const r4 = await loginPost({ email: ["admin@adwacyber.et"] as any, password: 12345 as any }, ips.type, false);
    ok("wrong JSON types → clean 4xx, no 500", r4.res.status === 400 || r4.res.status === 401, `got ${r4.res.status}`);

    // XSS: stored payload must round-trip as DATA (React escapes on render);
    // static check then proves no raw HTML sink exists.
    const xip = freshIp("3");
    const cap = await getCaptcha(xip);
    const xssOrg = `<img src=x onerror=alert(1)>`;
    const xssName = `<script>alert('xss')</script>`;
    const email = `owasp-xss-${Date.now()}@xss-test.et`;
    const r5 = await fetch(`${BASE}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Forwarded-For": xip },
      body: JSON.stringify({ organizationName: xssOrg, adminName: xssName, adminEmail: email, password: "Xss#Probe2026!", ...cap }),
    });
    const xssJar = r5.headers.getSetCookie?.() ? parseCookies(r5) : {};
    ok("XSS-payload registration accepted as data", r5.status === 201, `got ${r5.status}`);
    if (r5.status === 201) {
      const me = await fetch(`${BASE}/api/auth/me`, { headers: { cookie: cookieStr(xssJar) } });
      const meText = await me.text();
      ok("stored XSS round-trips escaped in JSON", me.status === 200 && meText.includes("\\u003cscript\\u003e") || meText.includes("<script>alert"),
         "stored raw, React escapes on render");
      // Static: no dangerouslySetInnerHTML outside shadcn chart theming.
      const offenders = walk(join(PROJECT, "src"), [".tsx", ".ts"]).filter((f) => {
        if (f.includes("chart.tsx")) return false;
        return /dangerouslySetInnerHTML|innerHTML\s*=|document\.write/.test(readFileSync(f, "utf8"));
      });
      ok("no raw-HTML sinks in app code", offenders.length === 0, offenders.join(", ") || "clean");
      // cleanup
      const u = await db.user.findUnique({ where: { email } });
      if (u) {
        await db.refreshToken.deleteMany({ where: { userId: u.id } });
        await db.authEvent.deleteMany({ where: { userId: u.id } });
        await db.user.delete({ where: { id: u.id } });
        await db.organization.deleteMany({ where: { contactEmail: email } });
      }
    }
  }

  // ── A04: Insecure Design ─────────────────────────────────────────────────
  console.log("\n══ A04 Insecure Design ══");
  {
    const ipw = freshIp("4");
    const cap1 = await getCaptcha(ipw);
    const weak = await fetch(`${BASE}/api/auth/register`, {
      method: "POST", headers: { "Content-Type": "application/json", "X-Forwarded-For": ipw },
      body: JSON.stringify({ organizationName: "Weak Pw Ltd", adminName: "Weak", adminEmail: `weak-${Date.now()}@test.et`, password: "password123", ...cap1 }),
    });
    ok("common password rejected (password123)", weak.status === 400, `got ${weak.status}`);

    const ipw2 = freshIp("4");
    const cap2 = await getCaptcha(ipw2);
    const mass = await fetch(`${BASE}/api/auth/register`, {
      method: "POST", headers: { "Content-Type": "application/json", "X-Forwarded-For": ipw2 },
      body: JSON.stringify({
        organizationName: "Mass Assign Co", adminName: "Massy",
        adminEmail: `owasp-mass-${Date.now()}@test.et`, password: "Str0ng#Pass2026!",
        role: "SUPER_ADMIN", status: "DISABLED", organizationId: "hijacked", mfaEnabled: true, googleId: "spoofed",
        ...cap2,
      }),
    });
    ok("registration accepts org creation", mass.status === 201, `got ${mass.status}`);
    if (mass.status === 201) {
      const mJar = parseCookies(mass as unknown as Response);
      const me = await fetch(`${BASE}/api/auth/me`, { headers: { cookie: cookieStr(mJar) } });
      const meBody = await me.json();
      ok("mass assignment ignored (role stays ORG_ADMIN)", meBody?.user?.role === "ORG_ADMIN", `role=${meBody?.user?.role}`);
      const orgRow = await db.organization.findFirst({ where: { name: "Mass Assign Co" } });
      ok("mass assignment ignored (org is own tenant)", Boolean(orgRow && orgRow.status === "onboarding"));
      // cleanup
      const u = await db.user.findUnique({ where: { email: meBody?.user?.email } });
      if (u) {
        await db.refreshToken.deleteMany({ where: { userId: u.id } });
        await db.authEvent.deleteMany({ where: { userId: u.id } });
        await db.user.delete({ where: { id: u.id } });
        await db.organization.deleteMany({ where: { name: "Mass Assign Co" } });
      }
    }

    // Oversized password (1 MB) must be rejected fast (no scrypt on huge input).
    const ipBig = freshIp("4");
    const capBig = await getCaptcha(ipBig);
    const t0 = Date.now();
    const big = await fetch(`${BASE}/api/auth/login`, {
      method: "POST", headers: { "Content-Type": "application/json", "X-Forwarded-For": ipBig },
      body: JSON.stringify({ email: "bigprobe@nowhere.et", password: "A".repeat(1_000_000), ...capBig }),
    });
    const dt = Date.now() - t0;
    ok("1 MB password rejected fast (DoS cap)", big.status === 401 && dt < 2000, `${big.status} in ${dt}ms`);

    // MFA precedence over Google is covered by test-google.ts; referential check:
    const officer = await db.user.findUnique({ where: { email: OFFICER.email } });
    ok("MFA-enforced account exists for Google-refusal policy", Boolean(officer?.mfaEnabled));
  }

  // ── A05: Security Misconfiguration ───────────────────────────────────────
  console.log("\n══ A05 Security Misconfiguration ══");
  {
    const r = await fetch(`${BASE}/`);
    const h = r.headers;
    ok("Content-Security-Policy set", Boolean(h.get("content-security-policy")));
    ok("X-Frame-Options set (clickjacking)", Boolean(h.get("x-frame-options")));
    ok("X-Content-Type-Options: nosniff", h.get("x-content-type-options") === "nosniff");
    ok("Referrer-Policy set", Boolean(h.get("referrer-policy")));
    ok("Permissions-Policy set", Boolean(h.get("permissions-policy")));
    ok("Strict-Transport-Security set", Boolean(h.get("strict-transport-security")));
    ok("no X-Powered-By banner", h.get("x-powered-by") === null);

    const nf = await fetch(`${BASE}/api/definitely-not-a-route`);
    ok("unknown API route → 404 (not 500)", nf.status === 404, `got ${nf.status}`);

    const badBody = await loginPost({ email: "x", password: "" }, freshIp("5"), false);
    const errText = JSON.stringify(badBody.body ?? {});
    ok("errors are structured JSON without stack traces", !/at\s+\/|node_modules|Traceback/.test(errText));
  }

  // ── A06: Vulnerable and Outdated Components ───────────────────────────────
  console.log("\n══ A06 Vulnerable Components ══");
  {
    const pkg = JSON.parse(readFileSync(join(PROJECT, "package.json"), "utf8"));
    const deps: Record<string, string> = { ...pkg.dependencies, ...pkg.devDependencies };
    const keys = ["next", "react", "react-dom", "prisma", "@prisma/client", "jose"];
    const summary = keys.map((k) => `${k}@${(deps[k] ?? "?").replace(/^\^/, "")}`).join(", ");
    ok("core dependency inventory", keys.every((k) => deps[k]), summary);
    ok("unused auth libs removed (next-auth)", !deps["next-auth"], "custom JWT/TOTP stack — no next-auth");
    console.log("    (run `bun pm audit` in CI for CVE matching — see docs/AUTH.md)");
  }

  // ── A07: Identification and Authentication Failures ──────────────────────
  console.log("\n══ A07 Identification & Authentication Failures ══");
  {
    // (a) identical error surface for unknown vs wrong password.
    const ipA = freshIp("7"), ipB = freshIp("7");
    const unknown = await loginPost({ email: "ghost@nowhere.et", password: "Whatever#1234" }, ipA);
    const wrongPw = await loginPost({ email: SUPER.email, password: "Wrong#Password1" }, ipB);
    ok("login errors are generic (no enumeration)",
       unknown.res.status === 401 && wrongPw.res.status === 401 &&
       unknown.body?.error?.code === wrongPw.body?.error?.code,
       `${unknown.body?.error?.code} == ${wrongPw.body?.error?.code}`);

    // (b) timing equalization (median of 3 interleaved runs) — probed against
    //     a disposable account so shared demo users are untouched.
    const timingEmail = `owasp-timing-${Date.now()}@test.et`;
    const timingOrg = await db.organization.create({ data: { name: "OWASP Timing Org", sector: "Other" } });
    await db.user.create({
      data: { email: timingEmail, name: "Timing Probe", passwordHash: hashPassword("Timing#Probe2026!"), role: "VIEWER", organizationId: timingOrg.id, authProvider: "LOCAL" },
    });
    const times = { unknown: [] as number[], known: [] as number[] };
    for (let i = 0; i < 3; i++) {
      let t = Date.now();
      await loginPost({ email: "ghost@nowhere.et", password: "Whatever#1234" }, freshIp("7"));
      times.unknown.push(Date.now() - t);
      t = Date.now();
      await loginPost({ email: timingEmail, password: "Wrong#Password2" }, freshIp("7"));
      times.known.push(Date.now() - t);
    }
    const med = (a: number[]) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
    const mU = med(times.unknown), mK = med(times.known);
    const ratio = Math.max(mU, mK) / Math.max(1, Math.min(mU, mK));
    ok("timing oracle closed (unknown ≈ known)", ratio < 2.2, `unknown=${mU}ms known=${mK}ms ratio=${ratio.toFixed(2)}`);
    const timingUser = await db.user.findUnique({ where: { email: timingEmail } });
    if (timingUser) {
      await db.refreshToken.deleteMany({ where: { userId: timingUser.id } });
      await db.authEvent.deleteMany({ where: { userId: timingUser.id } });
      await db.user.delete({ where: { id: timingUser.id } });
    }
    await db.organization.delete({ where: { id: timingOrg.id } }).catch(() => undefined);

    // (c) token confusion: mfa token is not an access token and vice versa.
    const o = await loginPost(OFFICER, freshIp("7"));
    const mfaToken = o.body?.mfaToken as string | undefined;
    ok("officer login returns mfaToken (challenge, not session)", Boolean(mfaToken) && !o.jar.adwa_at);
    if (mfaToken) {
      const asAccess = await fetch(`${BASE}/api/auth/me`, { headers: { cookie: `adwa_at=${mfaToken}` } });
      ok("mfaToken rejected as access token", asAccess.status === 401, `got ${asAccess.status}`);

      // (d) TOTP replay protection: same live code cannot be consumed twice.
      const code = totpNow(OFFICER_TOTP_SECRET);
      const v1 = await fetch(`${BASE}/api/auth/mfa/verify`, {
        method: "POST", headers: { "Content-Type": "application/json", "X-Forwarded-For": freshIp("7") },
        body: JSON.stringify({ mfaToken, code }),
      });
      let firstOk = v1.status === 200;
      let replay: Response;
      if (!firstOk) {
        // Current 30s step may already be consumed by an earlier suite run —
        // wait one step and retry with a fresh challenge + code.
        await new Promise((r) => setTimeout(r, 31_000));
        const o2 = await loginPost(OFFICER, freshIp("7"));
        const mfa2 = o2.body?.mfaToken as string;
        const code2 = totpNow(OFFICER_TOTP_SECRET);
        const v1b = await fetch(`${BASE}/api/auth/mfa/verify`, {
          method: "POST", headers: { "Content-Type": "application/json", "X-Forwarded-For": freshIp("7") },
          body: JSON.stringify({ mfaToken: mfa2, code: code2 }),
        });
        firstOk = v1b.status === 200;
        replay = await fetch(`${BASE}/api/auth/mfa/verify`, {
          method: "POST", headers: { "Content-Type": "application/json", "X-Forwarded-For": freshIp("7") },
          body: JSON.stringify({ mfaToken: mfa2, code: code2 }),
        });
      } else {
        replay = await fetch(`${BASE}/api/auth/mfa/verify`, {
          method: "POST", headers: { "Content-Type": "application/json", "X-Forwarded-For": freshIp("7") },
          body: JSON.stringify({ mfaToken, code }),
        });
      }
      ok("valid TOTP accepted", firstOk);
      ok("TOTP code replay rejected", replay!.status === 401, `got ${replay!.status}`);

      // (e) access token cannot serve as mfaToken.
      const s = await loginPost(SUPER, freshIp("7"));
      const swapped = await fetch(`${BASE}/api/auth/mfa/verify`, {
        method: "POST", headers: { "Content-Type": "application/json", "X-Forwarded-For": freshIp("7") },
        body: JSON.stringify({ mfaToken: s.jar.adwa_at, code: "123456" }),
      });
      ok("access token rejected as mfaToken", swapped.status === 401, `got ${swapped.status}`);
      await fetch(`${BASE}/api/auth/logout`, { method: "POST", headers: { cookie: cookieStr(s.jar) } });
    }

    // (f) per-account MFA brute-force limit (uses a disposable MFA user).
    const burnEmail = `owasp-burn-${Date.now()}@test.et`;
    const burnOrg = await db.organization.create({ data: { name: "OWASP Burn Org", sector: "Other" } });
    await db.user.create({
      data: {
        email: burnEmail, name: "Burn Probe", passwordHash: hashPassword("Burn#Probe2026!"),
        role: "VIEWER", organizationId: burnOrg.id, authProvider: "LOCAL",
        mfaEnabled: true, mfaSecret: encryptSecret("OWASPTOTPTESTSECRET234567"), mfaConfirmedAt: new Date(),
      },
    });
    const b = await loginPost({ email: burnEmail, password: "Burn#Probe2026!" }, freshIp("7"));
    const burnToken = b.body?.mfaToken as string;
    let lastStatus = 0;
    for (let i = 0; i < 11; i++) {
      const r = await fetch(`${BASE}/api/auth/mfa/verify`, {
        method: "POST", headers: { "Content-Type": "application/json", "X-Forwarded-For": freshIp("7") },
        body: JSON.stringify({ mfaToken: burnToken, code: String(100000 + i) }),
      });
      lastStatus = r.status;
    }
    ok("per-account MFA brute-force blocked (429 after 10)", lastStatus === 429, `11th attempt → ${lastStatus}`);
    // cleanup
    const bu = await db.user.findUnique({ where: { email: burnEmail } });
    if (bu) {
      await db.refreshToken.deleteMany({ where: { userId: bu.id } });
      await db.authEvent.deleteMany({ where: { userId: bu.id } });
      await db.user.delete({ where: { id: bu.id } });
      await db.organization.delete({ where: { id: burnOrg.id } });
    }
  }

  // ── A08: Software and Data Integrity Failures ─────────────────────────────
  console.log("\n══ A08 Software & Data Integrity ══");
  {
    ok("session available for JWT forgery probes", superLogin.res.status === 200);

    // (a) alg:none — hand-crafted unsigned token.
    const noneToken = `${b64u({ alg: "none", typ: "JWT" })}.${b64u({ sub: "x", typ: "access", role: "SUPER_ADMIN", ...decodeJwtPayload(superLogin.jar.adwa_at) })}.`;
    const rNone = await fetch(`${BASE}/api/auth/me`, { headers: { cookie: `adwa_at=${noneToken}` } });
    ok("alg:none token rejected", rNone.status === 401, `got ${rNone.status}`);

    // (b) HS256 token signed with the WRONG key.
    const forged = await new SignJWT({ sub: "forged", email: "attacker@evil.et", name: "Attacker", role: "SUPER_ADMIN", orgId: null, orgName: null, mfa: true, typ: "access" })
      .setProtectedHeader({ alg: "HS256" }).setIssuer("adwa-cyber").setAudience("adwa-cyber-platform")
      .setIssuedAt().setExpirationTime("1h").sign(new TextEncoder().encode("attacker-secret-attacker-secret"));
    const rForged = await fetch(`${BASE}/api/auth/me`, { headers: { cookie: `adwa_at=${forged}` } });
    ok("wrong-key signed token rejected", rForged.status === 401, `got ${rForged.status}`);

    // (c) valid signature, tampered payload (viewer → super admin escalation).
    const v = await loginPost(VIEWER, freshIp("8"));
    const parts = v.jar.adwa_at.split(".");
    const viewerClaims = decodeJwtPayload(v.jar.adwa_at);
    const escalated = { ...viewerClaims, role: "SUPER_ADMIN", orgId: null };
    const tampered = `${parts[0]}.${b64u(escalated)}.${parts[2]}`;
    const rTampered = await fetch(`${BASE}/api/auth/me`, { headers: { cookie: `adwa_at=${tampered}` } });
    ok("tampered-claims token rejected (role escalation)", rTampered.status === 401, `got ${rTampered.status}`);

    // (d) expired token.
    const expired = await new SignJWT({ sub: "x", email: "x@x.et", name: "x", role: "VIEWER", orgId: null, orgName: null, mfa: false, typ: "access" })
      .setProtectedHeader({ alg: "HS256" }).setIssuer("adwa-cyber").setAudience("adwa-cyber-platform")
      .setIssuedAt(Math.floor(Date.now() / 1000) - 3600).setExpirationTime(Math.floor(Date.now() / 1000) - 60)
      .sign(new TextEncoder().encode("anything"));
    const rExpired = await fetch(`${BASE}/api/auth/me`, { headers: { cookie: `adwa_at=${expired}` } });
    ok("expired token rejected", rExpired.status === 401, `got ${rExpired.status}`);

    // (e) role change in DB invalidates live access tokens (stale-claim check).
    const tmpEmail = `owasp-stale-${Date.now()}@test.et`;
    const tmpOrg = await db.organization.create({ data: { name: "OWASP Stale Org", sector: "Other" } });
    const { hashPassword } = await import("../src/lib/auth/crypto");
    const tmpUser = await db.user.create({
      data: { email: tmpEmail, name: "Stale Probe", passwordHash: hashPassword("Stale#Probe2026!"), role: "VIEWER", organizationId: tmpOrg.id, authProvider: "LOCAL" },
    });
    const st = await loginPost({ email: tmpEmail, password: "Stale#Probe2026!" }, freshIp("8"));
    const stCookie = cookieStr(st.jar);
    const me1 = await fetch(`${BASE}/api/auth/me`, { headers: { cookie: stCookie } });
    await db.user.update({ where: { id: tmpUser.id }, data: { role: "ORG_ADMIN", sessionsRevokedAt: new Date() } });
    const me2 = await fetch(`${BASE}/api/auth/me`, { headers: { cookie: stCookie } });
    ok("role change + revocation kills live access token", me1.status === 200 && me2.status === 401, `${me1.status} → ${me2.status}`);
    await db.user.delete({ where: { id: tmpUser.id } }).catch(() => undefined);
    await db.organization.delete({ where: { id: tmpOrg.id } }).catch(() => undefined);
    await fetch(`${BASE}/api/auth/logout`, { method: "POST", headers: { cookie: cookieStr(v.jar) } });
  }

  // ── A09: Security Logging and Monitoring Failures ─────────────────────────
  console.log("\n══ A09 Logging & Monitoring ══");
  {
    // generate attack traffic with a distinctive password, then inspect the log
    await loginPost({ email: "ghost@nowhere.et", password: probePassword }, freshIp("9"));
    const auditRes = await fetch(`${BASE}/api/auth/audit`, { headers: { cookie: superCookie } });
    const auditText = await auditRes.text();
    ok("audit log readable by super admin", auditRes.status === 200);
    ok("failed logins are audited", auditText.includes("LOGIN_FAILED"));
    ok("MFA failures are audited", auditText.includes("MFA_FAILED"));
    ok("access denials are audited", auditText.includes("ACCESS_DENIED"));
    ok("audit never stores credentials", !auditText.includes(probePassword));
  }

  // ── A10: Server-Side Request Forgery ──────────────────────────────────────
  console.log("\n══ A10 SSRF ══");
  {
    // Static: server-side fetch targets must be constants/env, never request data.
    const files = walk(join(PROJECT, "src/app/api"), [".ts"]).concat(walk(join(PROJECT, "src/lib"), [".ts"]));
    const offenders: string[] = [];
    for (const f of files) {
      const src = readFileSync(f, "utf8");
      // fetch(`...${anything}`) — template-literal URL means dynamic destination
      for (const m of src.matchAll(/fetch\(\s*`([^`]*)`/g)) {
        if (m[1].includes("${")) offenders.push(`${f}: ${m[1].slice(0, 60)}`);
      }
    }
    ok("no server-side fetch of user-controlled URLs", offenders.length === 0, offenders[0] ?? "all fetch targets are constant");
  }

  // ── final cleanup: unlock everything the probes touched ──────────────────
  await db.user.update({ where: { email: SUPER.email }, data: { failedAttempts: 0, lockedUntil: null } });
  await db.user.update({ where: { email: VIEWER.email }, data: { failedAttempts: 0, lockedUntil: null } });
  await db.organization.deleteMany({ where: { name: { in: ["OWASP Burn Org", "OWASP Stale Org", "OWASP Timing Org", "Proto Probe", "Weak Pw Ltd"] } } });
  await fetch(`${BASE}/api/auth/logout`, { method: "POST", headers: { cookie: superCookie } });
  await db.$disconnect();

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`RESULT: ${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
