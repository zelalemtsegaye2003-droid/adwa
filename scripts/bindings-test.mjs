/**
 * Adwa Cyber — production bindings registry verification
 * (Real-Data Roadmap Phase 3). --------------------------------------------
 * Verifies the honesty contract of GET /api/system/bindings against the
 * dev stack in its DEFAULT (unbound) configuration:
 *
 *   1. RBAC: unauthenticated → 401; ORG_ADMIN and VIEWER → 403
 *      (orgs:manage is SUPER_ADMIN-only); SUPER_ADMIN → 200.
 *   2. Shape: generatedAt + summary + bindings[]; every descriptor carries
 *      the full honesty contract (id, domain, label, status, detail,
 *      envKeys) and NOTHING beyond the closed descriptor field set.
 *   3. Closed sets: status ∈ {live, mock, fixture, snapshot, unconfigured,
 *      disabled}; domain ∈ {identity, mail, national, intel, enrichment,
 *      vapt}; unknown ids are never invented.
 *   4. Deterministic default posture (the CI default env):
 *        google-sso            unconfigured  (button honestly hidden)
 *        smtp-mail             unconfigured  (console transport)
 *        ethiocert-exchange     fixture       (bundled demo indicators)
 *        ethio-web             live          (public pages, no key needed)
 *        cisa-kev              live          (no key needed)
 *        spamhaus-drop         live          (no key needed)
 *        abusech/otx/greynoise/virustotal   unconfigured (key required)
 *        misp-exchange         unconfigured
 *        epss-live             live
 *        vapt-feed             snapshot      (bundled, as-of labelled)
 *   5. Summary arithmetic: counts per status match the actual rows and sum
 *      to the total binding count.
 *   6. Secret guard: no descriptor field is a long secret-shaped string —
 *      the registry is names-and-booleans by design, and the response text
 *      contains no value-looking tokens for any env var name it lists.
 *
 * Usage: node scripts/bindings-test.mjs   (dev server running on :3000)
 */
const BASE = process.env.BASE_URL ?? "http://localhost:3000";

async function jfetch(url, opts = {}) {
  const r = await fetch(url, opts);
  let body = null;
  const ct = r.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) body = await r.json();
  else body = { raw: (await r.text()).slice(0, 120) };
  return { status: r.status, body, text: JSON.stringify(body) };
}

function solveCaptcha(svg) {
  return [...svg.matchAll(/<text[^>]*>([^<]+)<\/text>/g)].map((m) => m[1]).join("");
}

async function loginWithCookie(email, password) {
  const cap = await jfetch(`${BASE}/api/auth/captcha`);
  const r = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, captchaId: cap.body.captchaId, captchaAnswer: solveCaptcha(cap.body.svg) }),
  });
  if (!r.ok) throw new Error(`login failed for ${email}: ${r.status}`);
  const cookie = r.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
  return cookie;
}

const STATUSES = ["live", "mock", "fixture", "snapshot", "unconfigured", "disabled"];
const DOMAINS = ["identity", "mail", "national", "intel", "enrichment", "vapt"];
const DESCRIPTOR_FIELDS = new Set(["id", "domain", "label", "status", "detail", "envKeys", "asOf", "refresh", "docs"]);

const DEFAULT_POSTURE = {
  "google-sso": "unconfigured",
  "smtp-mail": "unconfigured",
  "ethiocert-exchange": "fixture",
  "ethio-web": "live",
  "cisa-kev": "live",
  "spamhaus-drop": "live",
  "abusech-urlhaus": "unconfigured",
  "abusech-threatfox": "unconfigured",
  "alienvault-otx": "unconfigured",
  "greynoise": "unconfigured",
  "misp-exchange": "unconfigured",
  "virustotal": "unconfigured",
  "epss-live": "live",
  "vapt-feed": "snapshot",
};

let failed = 0;
function check(name, ok, extra = "") {
  if (!ok) failed += 1;
  console.log(`${ok ? "✓" : "✗ FAIL"} ${name}${extra ? ` — ${extra}` : ""}`);
}

async function main() {
  console.log("── production bindings registry (Phase 3) ───────────────────");

  // 1. RBAC
  const anon = await jfetch(`${BASE}/api/system/bindings`);
  check("unauthenticated GET → 401", anon.status === 401, `status ${anon.status}`);

  const orgAdmin = await loginWithCookie("admin@cbe.com.et", "Adwa#Demo2026!");
  const oa = await jfetch(`${BASE}/api/system/bindings`, { headers: { Cookie: orgAdmin } });
  check("ORG_ADMIN GET → 403 (orgs:manage is SUPER-only)", oa.status === 403, `status ${oa.status}`);

  const viewer = await loginWithCookie("viewer@ethiotelecom.et", "Adwa#Demo2026!");
  const vw = await jfetch(`${BASE}/api/system/bindings`, { headers: { Cookie: viewer } });
  check("VIEWER GET → 403", vw.status === 403, `status ${vw.status}`);

  const superAdmin = await loginWithCookie("admin@adwacyber.et", "Adwa#Admin2026!");
  const res = await jfetch(`${BASE}/api/system/bindings`, { headers: { Cookie: superAdmin } });
  check("SUPER_ADMIN GET → 200", res.status === 200, `status ${res.status}`);
  if (res.status !== 200) { console.log(res.text.slice(0, 300)); process.exit(1); }

  const body = res.body;
  const bindings = body.bindings ?? [];

  // 2. Shape
  check("report carries generatedAt + summary + bindings", Boolean(body.generatedAt && body.summary && Array.isArray(bindings)), `${bindings.length} bindings`);
  check("generatedAt is an ISO timestamp", /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(body.generatedAt), body.generatedAt);

  // 3. Closed sets + descriptor field whitelist (the secret guard: no
  //    extra field can ever smuggle a value out)
  let allFieldsOk = true;
  let allSetsOk = true;
  for (const b of bindings) {
    for (const k of Object.keys(b)) if (!DESCRIPTOR_FIELDS.has(k)) { allFieldsOk = false; }
    if (!STATUSES.includes(b.status) || !DOMAINS.includes(b.domain)) allSetsOk = false;
    if (typeof b.id !== "string" || typeof b.label !== "string" || typeof b.detail !== "string" || !Array.isArray(b.envKeys)) allSetsOk = false;
  }
  check("every descriptor uses exactly the closed field set (names only, no value fields)", allFieldsOk);
  check("status/domain/id/label/detail/envKeys well-formed on every row", allSetsOk);

  // 4. Deterministic default posture
  const byId = Object.fromEntries(bindings.map((b) => [b.id, b]));
  for (const [id, expected] of Object.entries(DEFAULT_POSTURE)) {
    check(`default posture: ${id} → ${expected}`, byId[id]?.status === expected, `got ${byId[id]?.status ?? "MISSING"}`);
  }
  check("registry size is the documented 14 bindings", bindings.length === 14, `${bindings.length}`);

  // 5. Summary arithmetic
  let summaryOk = true;
  for (const s of STATUSES) {
    const actual = bindings.filter((b) => b.status === s).length;
    if ((body.summary[s] ?? 0) !== actual) summaryOk = false;
  }
  const sum = STATUSES.map((s) => body.summary[s] ?? 0).reduce((a, c) => a + c, 0);
  check("summary counts match the actual rows", summaryOk);
  check("summary sums to the binding count", sum === bindings.length, `${sum}`);

  // 6. Honesty details on the fixture/mock rows explain what is served
  check("fixture row explains fixture mode", /fixture mode/i.test(byId["ethiocert-exchange"]?.detail ?? ""));
  check("unconfigured google row explains the hidden button", /login screen/i.test(byId["google-sso"]?.detail ?? ""));
  check("keyless feeds carry no key env requirement", (byId["cisa-kev"]?.envKeys ?? []).every((k) => !/API_KEY|AUTH_KEY|SECRET|CLIENT_ID/.test(k)));
  check("vapt-feed carries an as-of label", /^\d{4}-\d{2}-\d{2}$/.test(byId["vapt-feed"]?.asOf ?? ""), byId["vapt-feed"]?.asOf);
  check("google-sso points at its setup doc", (byId["google-sso"]?.docs ?? "") === "docs/GOOGLE_SSO_SETUP.md");

  // 7. No secret-shaped values anywhere in the response
  const secretish = /(?:[A-Za-z0-9_-]{28,})/.exec(res.text.replace(/generatedAt/g, ""));
  check("no secret-shaped tokens in the response", !secretish, secretish?.[0]?.slice(0, 20) ?? "");

  console.log("");
  if (failed > 0) {
    console.log(`BINDINGS SUITE: ${failed} check(s) FAILED`);
    process.exit(1);
  }
  console.log("BINDINGS SUITE PASSED");
}

main().catch((e) => {
  console.error("suite error:", e);
  process.exit(1);
});
