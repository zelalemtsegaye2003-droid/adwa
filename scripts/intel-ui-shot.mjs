/**
 * Adwa Cyber — SOC threat-intel panel UI capture.
 * Logs in as SUPER_ADMIN, runs one public-intel sync (so the hub carries
 * CISA KEV + Spamhaus DROP rows and the feed chips show LIVE/SNAPSHOT/key
 * states), then screenshots the Threat Intelligence tab (light + dark).
 * Output: /tmp/render/intel-soc-light.png, /tmp/render/intel-soc-dark.png
 */
import { chromium } from "playwright";
import fs from "fs";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const IP = "10.88.3.22";

function parseCaptchaSvg(svg) {
  return [...svg.matchAll(/<text[^>]*>([^<])<\/text>/g)].map((m) => m[1]).join("");
}

async function login() {
  const cap = await (await fetch(`${BASE}/api/auth/captcha`, { headers: { "X-Forwarded-For": IP } })).json();
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Forwarded-For": IP },
    body: JSON.stringify({ email: "admin@adwacyber.et", password: "Adwa#Admin2026!", captchaId: cap.captchaId, captchaAnswer: parseCaptchaSvg(cap.svg) }),
  });
  const setCookies = res.headers.getSetCookie?.() ?? [];
  const jar = setCookies.map((raw) => {
    const [pair] = raw.split(";");
    const eq = pair.indexOf("=");
    return { name: pair.slice(0, eq), value: pair.slice(eq + 1) };
  });
  return jar;
}

const jar = await login();
console.log("logged in");

// Run one public-intel sync so the panel and hub carry live data.
const sync = await fetch(`${BASE}/api/threats/intel`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Cookie: jar.map((c) => `${c.name}=${c.value}`).join("; ") },
  body: JSON.stringify({ source: "all" }),
});
const syncBody = await sync.json().catch(() => ({}));
console.log("intel sync:", sync.status, JSON.stringify(syncBody.totals ?? syncBody.error ?? {}));

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
  // Views switch via the sidebar (internal state, not URL params).
  await page.getByRole("button", { name: /Security Operations/i }).first().click();
  await page.waitForTimeout(1500);
  // Then activate the "Threat Intel" tab inside the SOC view.
  await page.getByRole("tab", { name: /Threat Intel/i }).click();
  await page.waitForTimeout(2000);
  fs.mkdirSync("/tmp/render", { recursive: true });
  await page.screenshot({ path: `/tmp/render/intel-soc-${label}.png` });
  console.log(`captured /tmp/render/intel-soc-${label}.png`);
  await page.close();
}
await browser.close();
