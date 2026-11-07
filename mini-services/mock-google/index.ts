/**
 * Adwa Cyber — DEVELOPMENT MOCK of Google's OAuth 2.0 / OIDC provider.
 * ---------------------------------------------------------------------
 * Purpose: exercise the platform's "Sign in with Google" code path
 * (state CSRF check → code exchange → RS256 ID-token verification
 * against a JWKS → account provisioning) without real Google credentials.
 *
 * Endpoints (also mirrored under /mock-google/* for gateway routing):
 *   GET  /auth?client_id&redirect_uri&response_type&scope&state  → consent page
 *   GET  /consent?account&redirect_uri&state                     → 302 code
 *   POST /token   (form: grant_type, code, client_id, client_secret, redirect_uri)
 *   GET  /certs   → JWKS
 *
 * Keys: an RSA-2048 keypair is generated once and persisted to .key.json so
 * restarts keep the same kid/JWKS.
 *
 * This service MUST NOT be exposed in production.
 */
import {
  createHash,
  createPublicKey,
  createSign,
  generateKeyPairSync,
  randomBytes,
} from "crypto";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

const PORT = 3010;
const KEY_FILE = join(import.meta.dir, ".key.json");

// Client credentials the mock accepts (must match GOOGLE_CLIENT_ID/SECRET
// configured on the platform).
const CLIENT_ID = process.env.MOCK_CLIENT_ID ?? "adwa-dev-mock-client.apps.googleusercontent.com";
const CLIENT_SECRET = process.env.MOCK_CLIENT_SECRET ?? "adwa-dev-mock-secret";

// ── persistent RSA keypair ────────────────────────────────────────────────
interface KeyMaterial {
  kid: string;
  privatePem: string;
  publicJwk: { kty: string; n: string; e: string };
}
let keys: KeyMaterial;
{
  if (existsSync(KEY_FILE)) {
    keys = JSON.parse(readFileSync(KEY_FILE, "utf8")) as KeyMaterial;
  } else {
    const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const jwk = publicKey.export({ format: "jwk" }) as {
      kty: string; n: string; e: string;
    };
    keys = {
      kid: `mock-${randomBytes(6).toString("hex")}`,
      privatePem: privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
      publicJwk: jwk,
    };
    writeFileSync(KEY_FILE, JSON.stringify(keys));
  }
}

// ── demo identities ───────────────────────────────────────────────────────
// Mirrors the seeded platform data so each account exercises a different
// branch of the callback logic:
//  1. kidist  → no local account, but tenant domain cbe.com.et is known
//               (Organization.contactEmail) → auto-provisioned as VIEWER
//  2. dawit   → existing LOCAL account (AUDITOR) → googleId linked, logs in
//  3. officer → existing account with platform MFA enforced → Google refused
//  4. abel    → gmail.com, no matching tenant → not provisioned
const ACCOUNTS = [
  { name: "Kidist Alemu", email: "kidist@cbe.com.et", tag: "CBE Workspace — new account" },
  { name: "Dawit Haile", email: "auditor@dashen.com.et", tag: "Dashen Workspace — links to existing account" },
  { name: "Selam Bekele", email: "officer@cbe.com.et", tag: "MFA-enforced account" },
  { name: "Abel Mengesha", email: "abel.mengesha@gmail.com", tag: "Personal Gmail — no tenant" },
];

// ── authorization codes (single-use, 10 min) ─────────────────────────────
interface IssuedCode { account: number; redirectUri: string; expiresAt: number }
const codes = new Map<string, IssuedCode>();

// ── JWT helpers (zero-dependency RS256) ──────────────────────────────────
const b64u = (buf: Buffer | string) => Buffer.from(buf).toString("base64url");

function signIdToken(accountIdx: number): string {
  const acc = ACCOUNTS[accountIdx];
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: "https://accounts.google.com",
    azp: CLIENT_ID,
    aud: CLIENT_ID,
    sub: createHash("sha256").update(`google-mock:${acc.email}`).digest("hex").slice(0, 32),
    email: acc.email,
    email_verified: true,
    name: acc.name,
    at_hash: b64u(createHash("sha256").update(randomBytes(16)).digest()).slice(0, 16),
    iat: now,
    exp: now + 3600,
  };
  const header = { alg: "RS256", typ: "JWT", kid: keys.kid };
  const h = b64u(JSON.stringify(header));
  const p = b64u(JSON.stringify(payload));
  const signer = createSign("RSA-SHA256");
  signer.update(`${h}.${p}`);
  const sig = signer.sign(keys.privatePem);
  return `${h}.${p}.${b64u(sig)}`;
}

// ── HTML ─────────────────────────────────────────────────────────────────
const escape = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

function consentPage(params: URLSearchParams): Response {
  const redirectUri = params.get("redirect_uri") ?? "";
  const state = params.get("state") ?? "";
  // Preserve the gateway port hint (XTransformPort) so links keep routing to
  // this service when accessed through the Caddy gateway.
  const xtp = params.get("XTransformPort");
  const gw = xtp ? `&XTransformPort=${encodeURIComponent(xtp)}` : "";
  const rows = ACCOUNTS.map(
    (a, i) => `
      <a class="acct" href="/mock-google/consent?account=${i}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}${gw}">
        <span class="avatar" aria-hidden="true">${a.name.split(" ").map((w) => w[0]).slice(0, 2).join("")}</span>
        <span class="who">
          <span class="name">${escape(a.name)}</span>
          <span class="email">${escape(a.email)}</span>
          <span class="tag">${escape(a.tag)}</span>
        </span>
      </a>`
  ).join("");
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Sign in with Google (dev mock)</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center;
         font-family: Roboto, "Segoe UI", system-ui, sans-serif; background:#f6f8fc; color:#202124; padding:16px; }
  .banner { position:fixed; top:0; left:0; right:0; background:#b45309; color:#fff; text-align:center;
            font-size:12px; padding:4px 8px; letter-spacing:.04em; }
  .card { background:#fff; border-radius:28px; box-shadow:0 1px 3px rgba(60,64,67,.3), 0 4px 8px 3px rgba(60,64,67,.15);
          max-width:400px; width:100%; padding:38px 32px; }
  h1 { font-size:22px; font-weight:400; margin:0 0 6px; text-align:center; }
  .sub { font-size:15px; color:#5f6368; text-align:center; margin-bottom:26px; }
  .sub b { color:#202124; font-weight:500; }
  .logo-row { display:flex; justify-content:center; margin-bottom:14px; }
  .logo { width:40px; height:40px; }
  .acct { display:flex; align-items:center; gap:12px; padding:11px 14px; border:1px solid #dadce0;
          border-radius:12px; margin-bottom:10px; text-decoration:none; color:inherit; transition:background .15s, box-shadow .15s; }
  .acct:hover, .acct:focus-visible { background:#f0f4ff; box-shadow:0 1px 4px rgba(60,64,67,.2); outline:none; }
  .avatar { width:38px; height:38px; border-radius:50%; background:#1a73e8; color:#fff; font-size:14px; font-weight:500;
            display:inline-flex; align-items:center; justify-content:center; flex:none; }
  .who { min-width:0; display:flex; flex-direction:column; }
  .name { font-size:14px; font-weight:500; }
  .email { font-size:13px; color:#5f6368; }
  .tag { font-size:11px; color:#9aa0a6; margin-top:2px; }
  .cancel { display:block; text-align:center; margin-top:16px; color:#1a73e8; font-size:13px; text-decoration:none; }
  .foot { margin-top:20px; font-size:11px; color:#9aa0a6; text-align:center; line-height:1.5; }
</style></head>
<body>
  <div class="banner">DEVELOPMENT MOCK PROVIDER — simulates accounts.google.com for testing. Not affiliated with Google.</div>
  <main class="card">
    <div class="logo-row">
      <svg class="logo" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
    </div>
    <h1>Choose an account</h1>
    <p class="sub">to continue to <b>Adwa Cyber</b></p>
    ${rows}
    <a class="cancel" href="/mock-google/cancel?redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}${gw}">Cancel</a>
    <p class="foot">This page is served by <code>mini-services/mock-google</code> (port ${PORT}).<br/>
    Codes are single-use; ID tokens are RS256-signed and verified by the platform against <code>/certs</code>.</p>
  </main>
</body></html>`;
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
}

// ── request handler ──────────────────────────────────────────────────────
Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);
    // Accept both direct paths (/auth) and gateway paths (/mock-google/auth).
    const path = url.pathname.replace(/^\/mock-google/, "");

    if (path === "/health") return new Response("ok");

    // ── authorization endpoint ────────────────────────────────────────────
    if (req.method === "GET" && path === "/auth") {
      const p = url.searchParams;
      if (p.get("client_id") !== CLIENT_ID) {
        return new Response("invalid client_id", { status: 400 });
      }
      const redirectUri = p.get("redirect_uri") ?? "";
      if (!/\/api\/auth\/google\/callback$/.test(redirectUri)) {
        return new Response("invalid redirect_uri", { status: 400 });
      }
      if (p.get("response_type") !== "code") {
        return new Response("unsupported response_type", { status: 400 });
      }
      if (!(p.get("scope") ?? "").includes("openid")) {
        return new Response("scope must include openid", { status: 400 });
      }
      return consentPage(p);
    }

    // ── consent decision ──────────────────────────────────────────────────
    if (req.method === "GET" && path === "/consent") {
      const p = url.searchParams;
      const account = Number(p.get("account"));
      const redirectUri = p.get("redirect_uri") ?? "";
      const state = p.get("state") ?? "";
      if (!Number.isInteger(account) || account < 0 || account >= ACCOUNTS.length) {
        return new Response("unknown account", { status: 400 });
      }
      if (!/\/api\/auth\/google\/callback$/.test(redirectUri)) {
        return new Response("invalid redirect_uri", { status: 400 });
      }
      const code = `mock-code-${randomBytes(16).toString("hex")}`;
      codes.set(code, { account, redirectUri, expiresAt: Date.now() + 10 * 60_000 });
      const back = new URL(redirectUri);
      back.searchParams.set("code", code);
      back.searchParams.set("state", state);
      return Response.redirect(back.toString(), 302);
    }

    // ── cancel → access_denied ────────────────────────────────────────────
    if (req.method === "GET" && path === "/cancel") {
      const redirectUri = url.searchParams.get("redirect_uri") ?? "";
      const state = url.searchParams.get("state") ?? "";
      const back = new URL(redirectUri);
      back.searchParams.set("error", "access_denied");
      back.searchParams.set("state", state);
      return Response.redirect(back.toString(), 302);
    }

    // ── token endpoint ────────────────────────────────────────────────────
    if (req.method === "POST" && path === "/token") {
      const form = new URLSearchParams(await req.text());
      const fail = (error: string, desc: string) =>
        new Response(JSON.stringify({ error, error_description: desc }), {
          status: 400,
          headers: { "content-type": "application/json" },
        });
      if (form.get("grant_type") !== "authorization_code") {
        return fail("unsupported_grant_type", "only authorization_code is supported");
      }
      if (form.get("client_id") !== CLIENT_ID || form.get("client_secret") !== CLIENT_SECRET) {
        return fail("invalid_client", "bad client credentials");
      }
      const code = form.get("code") ?? "";
      const issued = codes.get(code);
      codes.delete(code); // single use
      if (!issued) return fail("invalid_grant", "unknown or reused code");
      if (issued.expiresAt < Date.now()) return fail("invalid_grant", "code expired");
      if (form.get("redirect_uri") !== issued.redirectUri) {
        return fail("invalid_grant", "redirect_uri mismatch");
      }
      return new Response(
        JSON.stringify({
          access_token: `mock-at-${randomBytes(12).toString("hex")}`,
          id_token: signIdToken(issued.account),
          token_type: "Bearer",
          expires_in: 3599,
          scope: "openid email profile",
        }),
        { headers: { "content-type": "application/json", "cache-control": "no-store" } }
      );
    }

    // ── JWKS ──────────────────────────────────────────────────────────────
    if (req.method === "GET" && (path === "/certs" || path === "/.well-known/jwks.json")) {
      return new Response(
        JSON.stringify({ keys: [{ ...keys.publicJwk, alg: "RS256", use: "sig", kid: keys.kid }] }),
        { headers: { "content-type": "application/json", "cache-control": "public, max-age=300" } }
      );
    }

    return new Response("not found", { status: 404 });
  },
});

console.log(`[mock-google] listening on :${PORT} — client ${CLIENT_ID}`);
console.log("[mock-google] DEVELOPMENT ONLY — never expose in production.");
