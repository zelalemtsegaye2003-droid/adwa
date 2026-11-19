/**
 * Adwa Cyber — System Bindings console DOM verification (Phase 3).
 * Asserts the console renders the full registry: summary chips, 6 domain
 * groups, 14 binding rows with status badges and env-var chips, and that
 * nothing overflows horizontally (the alignment lesson from the VAPT fix).
 */
import { chromium } from "playwright";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const IP = "10.88.4.23";

function parseCaptchaSvg(svg) {
  return [...svg.matchAll(/<text[^>]*>([^<]+)<\/text>/g)].map((m) => m[1]).join("");
}

const cap = await (await fetch(`${BASE}/api/auth/captcha`, { headers: { "X-Forwarded-For": IP } })).json();
const res = await fetch(`${BASE}/api/auth/login`, {
  method: "POST",
  headers: { "Content-Type": "application/json", "X-Forwarded-For": IP },
  body: JSON.stringify({ email: "admin@adwacyber.et", password: "Adwa#Admin2026!", captchaId: cap.captchaId, captchaAnswer: parseCaptchaSvg(cap.svg) }),
});
if (!res.ok) throw new Error(`login failed: ${res.status}`);
const jar = res.headers.getSetCookie().map((raw) => {
  const [pair] = raw.split(";");
  const eq = pair.indexOf("=");
  return { name: pair.slice(0, eq), value: pair.slice(eq + 1) };
});

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await context.addCookies(jar.map((c) => ({ ...c, domain: "localhost", path: "/" })));
const page = await context.newPage();
await page.goto(BASE + "/", { waitUntil: "networkidle" });
await page.waitForTimeout(1000);
await page.getByRole("button", { name: /System Bindings/i }).first().click();
await page.waitForTimeout(2000);

const checks = [];
const expect = (name, ok, extra = "") => { checks.push(ok); console.log(`${ok ? "✓" : "✗ FAIL"} ${name}${extra ? " — " + extra : ""}`); };

const hero = await page.locator("h1").first().textContent().catch(() => null);
expect("hero shows the console title", /Production Bindings/i.test(hero ?? ""), hero ?? "");

const summary = await page.getByText("Binding posture").count();
expect("summary strip present", summary > 0);

const statusBadges = await page.locator("[data-slot=badge], .inline-flex.items-center.rounded-full.border").count();
expect("status badges render", statusBadges >= 20, `${statusBadges} badges`);

const envChips = await page.locator("code.font-mono").count();
expect("env var mono chips render (14 rows worth)", envChips >= 30, `${envChips} env chips`);

for (const dom of ["Identity", "Mail", "National ecosystem", "Threat intelligence", "Enrichment", "VAPT"]) {
  const n = await page.getByRole("heading", { name: new RegExp(dom, "i") }).count();
  expect(`domain group renders: ${dom}`, n > 0);
}

const rows = await page.locator("div.rounded-lg.border.bg-muted\\/30").count();
expect("14 binding rows render", rows === 14, `${rows} rows`);

const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
expect("no horizontal overflow", overflow <= 0, `${overflow}px`);

const secrets = await page.content();
expect("no literal secret values in DOM", !/Adwa#(Admin|Demo)2026/.test(secrets));

await browser.close();
console.log("");
if (checks.some((c) => !c)) { console.log("DOM VERIFICATION FAILED"); process.exit(1); }
console.log("DOM VERIFICATION PASSED");
