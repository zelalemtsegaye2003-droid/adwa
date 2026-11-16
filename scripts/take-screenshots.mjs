/**
 * Adwa Sec startup package — live-platform screenshot tour.
 * Logs in via the API (solving the SVG captcha exactly like the test suite),
 * injects auth cookies into Playwright, then walks the app views.
 * Output: /adwa/download/screenshots/shot-NN-*.png
 */
import { chromium } from "playwright";
import fs from "fs";

const BASE = "http://localhost:3000";
const OUT = "/adwa/download/screenshots";
const CREDS = { email: "admin@adwacyber.et", password: "Adwa#Admin2026!" }; // SUPER_ADMIN, MFA off
const IP = "10.88.3.21"; // distinct pseudo-IP so rate limits don't collide

function parseCaptchaSvg(svg) {
  return [...svg.matchAll(/<text[^>]*>([^<])<\/text>/g)].map((m) => m[1]).join("");
}

async function login() {
  const cap = await (await fetch(`${BASE}/api/auth/captcha`, { headers: { "X-Forwarded-For": IP } })).json();
  if (!cap.captchaId) throw new Error("captcha fetch failed: " + JSON.stringify(cap));
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Forwarded-For": IP },
    body: JSON.stringify({ ...CREDS, captchaId: cap.captchaId, captchaAnswer: parseCaptchaSvg(cap.svg) }),
  });
  const setCookies = res.headers.getSetCookie?.() ?? [];
  const jar = setCookies.map((raw) => {
    const [pair] = raw.split(";");
    const eq = pair.indexOf("=");
    return { name: pair.slice(0, eq), value: pair.slice(eq + 1) };
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`login failed ${res.status}: ${JSON.stringify(body)}`);
  return jar;
}

const shots = [];
async function snap(page, name, waitMs = 1400) {
  await page.waitForTimeout(waitMs);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
  shots.push(name);
  console.log("  saved:", name);
}

async function sidebar(page, label) {
  await page.locator(`button:has-text("${label}")`).first().click();
  await page.waitForLoadState("networkidle").catch(() => {});
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const jar = await login();
  console.log("API login OK, cookies:", jar.map((c) => c.name).join(", "));

  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 1600, height: 1000 },
    deviceScaleFactor: 2,
  });
  await ctx.addCookies(
    jar.map((c) => ({ name: c.name, value: c.value, domain: "localhost", path: "/" }))
  );
  const page = await ctx.newPage();

  // 1 — public login screen (no cookies yet): use a bare context
  const anon = await browser.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2 });
  const anonPage = await anon.newPage();
  await anonPage.goto(BASE, { waitUntil: "networkidle" });
  await snap(anonPage, "shot-01-login");
  await anon.close();

  // 2 — dashboard
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.waitForTimeout(1800);
  await page.screenshot({ path: `${OUT}/shot-02-dashboard.png`, fullPage: true });
  shots.push("shot-02-dashboard");
  console.log("  saved: shot-02-dashboard");

  // 3 — VAPT Center overview
  await sidebar(page, "VAPT Center");
  await snap(page, "shot-03-vapt-overview");

  // 4 — AD Attack Paths
  await page.getByRole("tab", { name: "AD Attack Paths" }).click();
  await snap(page, "shot-04-ad-attack-paths", 2600);

  // 5 — Bid Matrix
  await page.getByRole("tab", { name: "Bid Matrix (LOT4)" }).click();
  await snap(page, "shot-05-bid-matrix", 2000);

  // 6 — Findings
  await sidebar(page, "Findings");
  await snap(page, "shot-06-findings");

  // 7 — Security Operations (SOC)
  await sidebar(page, "Security Operations");
  await snap(page, "shot-07-soc");

  // 8 — Evidence Library
  await sidebar(page, "Evidence Library");
  await snap(page, "shot-08-evidence");

  // 9 — Awareness
  await sidebar(page, "Awareness");
  await snap(page, "shot-09-awareness", 2000);

  // 10 — same AD Attack Paths in Amharic (language toggle shows አማ while in EN)
  await sidebar(page, "VAPT Center");
  await page.getByRole("tab", { name: "AD Attack Paths" }).click();
  await page.locator('button:has-text("አማ")').first().click();
  await snap(page, "shot-10-ad-attack-paths-amharic", 2600);

  await browser.close();
  console.log("\nCaptured", shots.length, "screenshots to", OUT);
})().catch((e) => { console.error("FATAL:", e.message); process.exit(1); });
