/**
 * Adwa Cyber — /api/threats/ethio authenticated smoke test (dev server on :3000).
 * Verifies the real-Ethiopian integration end to end: login → GET ethio →
 * contract + real-data invariants (hotline 933, live national API results,
 * GCI 2024 pillars, legal corpus, honesty fields).
 */
const BASE = "http://localhost:3000";
let failed = 0;

function parseCaptchaSvg(svg: string): string {
  return [...svg.matchAll(/<text[^>]*>([^<])<\/text>/g)].map((m) => m[1]).join("");
}

async function main() {
  const cap = await (await fetch(`${BASE}/api/auth/captcha`)).json() as { captchaId: string; svg: string };
  const login = await fetch(`${BASE}/api/auth/login`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@adwacyber.et", password: "Adwa#Admin2026!", captchaId: cap.captchaId, captchaAnswer: parseCaptchaSvg(cap.svg) }),
  });
  if (!login.ok) { console.error("login failed:", login.status, await login.text()); process.exit(1); }
  const cookies = login.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");

  const res = await fetch(`${BASE}/api/threats/ethio`, { headers: { Cookie: cookies } });
  if (!res.ok) { console.error("GET /api/threats/ethio failed:", res.status, await res.text()); process.exit(1); }
  const d = await res.json() as Record<string, any>;

  const cert = d.cert;
  const alerts = cert.alerts, news = cert.news, regs = cert.regulations, gci = cert.gci;
  const checks: [string, boolean, string][] = [
    ["aggregate mode is live or snapshot (honest)", ["live", "snapshot"].includes(d.mode), String(d.mode)],
    ["API base points at the national API", d.web.apiBase === "https://www.ethiocert.gov.et/api", String(d.web.apiBase)],
    ["hotline is the real 933", cert.contact.hotline === "933", cert.contact.hotline],
    ["email is the real one", cert.contact.email === "ethiocert@insa.gov.et", cert.contact.email],
    ["advisories honesty fields set", ["live", "snapshot"].includes(cert.advisories.mode) && !!cert.advisories.asOf, `${cert.advisories.mode} @ ${cert.advisories.asOf}`],
    ["advisories empty state carries the honest note", cert.advisories.entries.length === 0 ? !!cert.advisories.note : true, cert.advisories.note ?? "-"],
    ["alerts feed carries mode + entries", ["live", "snapshot"].includes(alerts.mode) && alerts.entries.length >= 5, `${alerts.mode} · ${alerts.entries.length} alerts`],
    ["alerts carry real severity values", alerts.entries.filter((a: any) => a.severity).length >= 5, alerts.entries.map((a: any) => a.severity).join(",")],
    ["alerts carry real dates", alerts.entries.filter((a: any) => a.date).length >= 5, ""],
    ["national news feed serves the real news", ["live", "snapshot"].includes(news.mode) && news.entries.length >= 10, `${news.mode} · ${news.entries.length} items`],
    ["national news includes the 123456 password item", news.entries.some((n: any) => n.titleEn.includes("123456")), ""],
    ["legal corpus serves 9 instruments", ["live", "snapshot"].includes(regs.mode) && regs.entries.length === 9, `${regs.mode} · ${regs.entries.length}`],
    ["Computer Crime Proclamation present", regs.entries.some((r: any) => r.titleEn.includes("Computer Crime Proclamation")), ""],
    ["regulations link official PDFs", regs.entries.every((r: any) => r.url.includes("ethiocert.gov.et")), ""],
    ["GCI is 2024 with the real pillars", gci.year === 2024 && Math.abs(gci.pillars.legal - 18.83) < 0.01, JSON.stringify(gci.pillars)],
    ["GCI pillars sum to 76.34", Math.abs(gci.pillars.legal + gci.pillars.technical + gci.pillars.organizational + gci.pillars.capacity + gci.pillars.cooperation - 76.34) < 0.01, ""],
    ["GCI timeline 2014→2024 present", Array.isArray(gci.timeline) && gci.timeline.length >= 5, `${gci.timeline?.length ?? 0} points`],
    ["exchange binding reported alongside", cert.exchange.mode === "fixture" || cert.exchange.mode === "live", `${cert.exchange.mode}`],
    ["INSA news yields the 4 real headlines", d.insa.news.entries.length === 4, `got ${d.insa.news.entries.length}`],
    ["INSA news dates are the on-page dates", d.insa.news.entries.every((n: any) => n.date === "2026-11-05"), d.insa.news.entries.map((n: any) => n.date).join(",")],
    ["INSA news title recovered in full", (d.insa.news.entries[0]?.titleEn ?? "").length > 60, d.insa.news.entries[0]?.titleEn?.slice(0, 60) ?? ""],
    ["INSA stats present (5 real facts)", d.insa.stats.length === 5, `got ${d.insa.stats.length}`],
    ["awareness tips are the real six", d.insa.awareness.length === 6, `got ${d.insa.awareness.length}`],
    ["INSA national products (9)", d.insa.products.length === 9, `got ${d.insa.products.length}`],
    ["NBE SBB/96/2025 present", d.nbe.some((x: any) => x.valueEn === "SBB/96/2025"), ""],
    ["NBE awareness source linked", d.nbe.some((x: any) => x.sourceUrl.includes("nbe.gov.et")), ""],
    ["market sizing present", d.market.length === 1 && d.market[0].valueEn.includes("37.67"), ""],
    ["every landscape fact sourceful", [...d.insa.stats, ...d.nbe, ...d.market].every((f: any) => f.sourceUrl.startsWith("https://")), ""],
  ];
  let pass = 0;
  for (const [name, cond, extra] of checks) {
    if (cond) { pass++; console.log(`  ok    ${name}`); }
    else { failed++; console.error(`  FAIL  ${name} — ${extra}`); }
  }
  console.log(`\n${pass} passed, ${failed} failed — /api/threats/ethio smoke`);
  if (failed) process.exit(1);
}
main();
