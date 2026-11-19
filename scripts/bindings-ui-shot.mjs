/**
 * Adwa Cyber — System Bindings console UI capture (Phase 3).
 * Logs in as SUPER_ADMIN, opens the new "System Bindings" tab and
 * screenshots the production-bindings console (light + dark).
 * Output: /tmp/render/bindings-light.png, /tmp/render/bindings-dark.png
 */
import { chromium } from "playwright";
import fs from "fs";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const IP = "10.88.4.22";

function parseCaptchaSvg(svg) {
  return [...svg.matchAll(/<text[^>]*>([^<]+)<\/text>/g)].map((m) => m[1]).join("");
}

async function login() {
  const cap = await (await fetch(`${BASE}/api/auth/captcha`, { headers: { "X-Forwarded-For": IP } })).json();
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Forwarded-For": IP },
    body: JSON.stringify({ email: "admin@adwacyber.et", password: "Adwa#Admin2026!", captchaId: cap.captchaId, captchaAnswer: parseCaptchaSvg(cap.svg) }),
  });
  if (!res.ok) throw new Error(`login failed: ${res.status}`);
  const setCookies = res.headers.getSetCookie?.() ?? [];
  return setCookies.map((raw) => {
    const [pair] = raw.split(";");
    const eq = pair.indexOf("=");
    return { name: pair.slice(0, eq), value: pair.slice(eq + 1) };
  });
}

const jar = await login();
console.log("logged in");

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
await context.addCookies(jar.map((c) => ({ ...c, domain: "localhost", path: "/" })));

for (const [label, dark] of [["light", false], ["dark", true]]) {
  const page = await context.newPage();
  if (dark) {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.addInitScript(() => { try { localStorage.setItem("ui-theme", "dark"); } catch {} });
  }
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  await page.getByRole("button", { name: /System Bindings/i }).first().click();
  await page.waitForTimeout(2000);
  fs.mkdirSync("/tmp/render", { recursive: true });
  await page.screenshot({ path: `/tmp/render/bindings-${label}.png`, fullPage: true });
  console.log(`captured /tmp/render/bindings-${label}.png`);
  await page.close();
}
await browser.close();
