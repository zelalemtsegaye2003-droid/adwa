/**
 * Adwa Cyber — "Sign in with Google" end-to-end test against the dev server
 * and the mock provider (mini-services/mock-google, port 3010).
 *
 * Walks the REAL browser redirect chain with manual redirect following,
 * through the Caddy gateway (port 81) exactly like the preview panel:
 *   /api/auth/google → mock /auth (consent) → click account → callback → /me
 *
 * Covers: state CSRF cookie, account auto-provisioning (tenant domain match),
 * linking to an existing LOCAL account, MFA-precedence refusal, closed
 * provisioning for unknown domains, state-mismatch rejection, single-use codes.
 *
 * Run: bun scripts/test-google.ts
 */
const BASE = "http://localhost:81"; // Caddy gateway — resolves XTransformPort

let passed = 0, failed = 0;
function ok(name: string, cond: boolean, extra = "") {
  if (cond) { passed++; console.log(`  ✓ ${name}${extra ? " — " + extra : ""}`); }
  else { failed++; console.error(`  ✗ ${name}${extra ? " — " + extra : ""}`); }
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

const cookieStr = (jar: Record<string, string>) =>
  Object.entries(jar).map(([k, v]) => `${k}=${v}`).join("; ");

/** Extract the on-page link for an account (like a browser click). */
function accountLink(html: string, account: number): string {
  const m = html.match(new RegExp(`href="(/mock-google/consent\\?account=${account}&[^"]*)"`));
  return m ? m[1].replace(/&amp;/g, "&") : "";
}

/** Start flow → render consent → return { jar, authUrl, html }. Retries once if rate-limited. */
async function beginFlow(): Promise<{ jar: Record<string, string>; html: string; authUrl: URL }> {
  for (let attempt = 0; ; attempt++) {
    const start = await fetch(`${BASE}/api/auth/google`, { redirect: "manual" });
    const jar = parseCookies(start);
    const authUrl = new URL(start.headers.get("location") ?? "");
    if (authUrl.searchParams.get("authError") === "rate_limited" || authUrl.pathname === "/") {
      if (attempt === 0) {
        console.log("  (rate limited — waiting 65s for the window to reset…)");
        await new Promise((r) => setTimeout(r, 65_000));
        continue;
      }
      throw new Error("still rate limited after waiting — run again in a few minutes");
    }
    const res = await fetch(authUrl, { headers: { cookie: cookieStr(jar) } });
    return { jar, html: await res.text(), authUrl };
  }
}

/** Full happy-path walk for an account → session cookies (or null). */
async function loginWithAccount(account: number): Promise<{ jar: Record<string, string>; finalLocation: string } | null> {
  const flow = await beginFlow();
  const link = accountLink(flow.html, account);
  if (!link) return null;
  const choice = await fetch(`${BASE}${link}`, { headers: { cookie: cookieStr(flow.jar) }, redirect: "manual" });
  const cbUrl = choice.headers.get("location") ?? "";
  if (!cbUrl) return null;
  const cb = await fetch(cbUrl, { headers: { cookie: cookieStr(flow.jar) }, redirect: "manual" });
  return { jar: { ...flow.jar, ...parseCookies(cb) }, finalLocation: cb.headers.get("location") ?? "" };
}

async function main() {
  console.log("══ Google OAuth end-to-end (mock provider, via gateway) ══");

  // ── 1. Flow start ───────────────────────────────────────────────────────
  const flow = await beginFlow();
  ok("GET /api/auth/google redirects to consent", flow.html.includes("Choose an account"));
  ok("state cookie set (adwa_oauth_state)", Boolean(flow.jar.adwa_oauth_state));
  ok("redirect routes through gateway mock path",
     flow.authUrl.pathname === "/mock-google/auth" && flow.authUrl.searchParams.get("XTransformPort") === "3010");
  ok("consent lists demo identities", flow.html.includes("auditor@dashen.com.et") && flow.html.includes("kidist@cbe.com.et"));
  ok("account links preserve gateway port", accountLink(flow.html, 1).includes("XTransformPort=3010"));

  // ── 2. Account 1 (Dawit) — existing LOCAL account → link + login ────────
  {
    const r = await loginWithAccount(1);
    ok("code issued → 302 back to callback with session", Boolean(r && r.jar.adwa_at && r.jar.adwa_rt), r?.finalLocation.slice(0, 40) ?? "");
    const me = await fetch(`${BASE}/api/auth/me`, { headers: { cookie: cookieStr(r!.jar) } });
    const meBody = await me.json();
    ok("linked account logs in as AUDITOR", me.status === 200 && meBody?.user?.email === "auditor@dashen.com.et" && meBody?.user?.role === "AUDITOR",
       `${meBody?.user?.email} (${meBody?.user?.role})`);
    ok("Google identity linked to the local account", meBody?.user?.googleLinked === true);
    await fetch(`${BASE}/api/auth/logout`, { method: "POST", headers: { cookie: cookieStr(r!.jar) } });
  }

  // ── 3. Account 0 (Kidist) — no account, tenant domain known → provision ─
  {
    const r = await loginWithAccount(0);
    ok("unknown identity gets session (auto-provision)", Boolean(r?.jar.adwa_at));
    const me = await fetch(`${BASE}/api/auth/me`, { headers: { cookie: cookieStr(r!.jar) } });
    const meBody = await me.json();
    ok("auto-provisioned as VIEWER at CBE", me.status === 200 && meBody?.user?.email === "kidist@cbe.com.et" && meBody?.user?.role === "VIEWER" && /Commercial Bank/.test(meBody?.user?.orgName ?? ""),
       `${meBody?.user?.email} → ${meBody?.user?.role} @ ${meBody?.user?.orgName}`);
    await fetch(`${BASE}/api/auth/logout`, { method: "POST", headers: { cookie: cookieStr(r!.jar) } });
  }

  // ── 4. Account 2 (officer, MFA enforced) → Google refused ───────────────
  {
    const r = await loginWithAccount(2);
    ok("MFA-enforced account refused via Google", (r?.finalLocation ?? "").includes("authError=google_mfa_required"));
  }

  // ── 5. Account 3 (gmail, no tenant) → closed provisioning ───────────────
  {
    const r = await loginWithAccount(3);
    ok("unknown-domain identity NOT provisioned", (r?.finalLocation ?? "").includes("authError=google_no_account"));
  }

  // ── 6. State mismatch (CSRF) → rejected ──────────────────────────────────
  {
    const f3 = await beginFlow();
    const link = accountLink(f3.html, 1).replace(/state=[^&]*/, "state=forged-state");
    // Hop 1: mock consent issues a code bound to the forged state.
    const choice = await fetch(`${BASE}${link}`, { headers: { cookie: "adwa_oauth_state=legit-but-different" }, redirect: "manual" });
    // Hop 2: platform callback — state param ≠ state cookie → reject.
    const cb = await fetch(choice.headers.get("location") ?? "", { headers: { cookie: "adwa_oauth_state=legit-but-different" }, redirect: "manual" });
    ok("forged state rejected", (cb.headers.get("location") ?? "").includes("authError=google_state_mismatch"));
  }

  // ── 7. Code is single-use ────────────────────────────────────────────────
  {
    const f2 = await beginFlow();
    const link = accountLink(f2.html, 1);
    const choice = await fetch(`${BASE}${link}`, { headers: { cookie: cookieStr(f2.jar) }, redirect: "manual" });
    const cbUrl = choice.headers.get("location") ?? "";
    const cb = await fetch(cbUrl, { headers: { cookie: cookieStr(f2.jar) }, redirect: "manual" });
    ok("first use of code succeeds", [302, 307].includes(cb.status) && Boolean(parseCookies(cb).adwa_at));
    const replay = await fetch(cbUrl, { headers: { cookie: cookieStr(f2.jar) }, redirect: "manual" });
    const replayJar = parseCookies(replay);
    ok("code replay → exchange fails, no session",
       (replay.headers.get("location") ?? "").includes("authError=google_exchange_failed") && !replayJar.adwa_at,
       (replay.headers.get("location") ?? "").slice(0, 60));
  }

  // ── cleanup: remove the auto-provisioned demo user ──────────────────────
  const { PrismaClient } = await import("@prisma/client");
  const db = new PrismaClient();
  const kidist = await db.user.findUnique({ where: { email: "kidist@cbe.com.et" } });
  if (kidist) {
    await db.refreshToken.deleteMany({ where: { userId: kidist.id } });
    await db.authEvent.deleteMany({ where: { userId: kidist.id } });
    await db.user.delete({ where: { id: kidist.id } });
    console.log("  (cleaned up auto-provisioned kidist@cbe.com.et)");
  }
  // Keep the linked googleId? Remove so tests stay repeatable.
  await db.user.update({ where: { email: "auditor@dashen.com.et" }, data: { googleId: null } });
  await db.$disconnect();

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`RESULT: ${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
