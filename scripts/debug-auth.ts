/** Debug: org admin role patch + super user listing */
const BASE = "http://localhost:3000";

function parseCookies(res: Response): Record<string, string> {
  const jar: Record<string, string> = {};
  for (const raw of res.headers.getSetCookie?.() ?? []) {
    const [pair] = raw.split(";");
    const eq = pair.indexOf("=");
    jar[pair.slice(0, eq)] = pair.slice(eq + 1);
  }
  return jar;
}
function cookieHeader(jar: Record<string, string>) {
  return Object.entries(jar).map(([k, v]) => `${k}=${v}`).join("; ");
}
async function getCaptcha() {
  const res = await fetch(`${BASE}/api/auth/captcha`);
  const dto = await res.json();
  const chars = [...dto.svg.matchAll(/<text[^>]*>([^<])<\/text>/g)].map((m) => m[1]);
  return { captchaId: dto.captchaId, captchaAnswer: chars.join("") };
}
async function login(email: string, password: string) {
  const captcha = await getCaptcha();
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: BASE },
    body: JSON.stringify({ email, password, ...captcha }),
  });
  const body = await res.json().catch(() => null);
  return { res, body, jar: parseCookies(res) };
}
async function api(path: string, jar: Record<string, string>, init: RequestInit = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      Cookie: cookieHeader(jar),
      Origin: BASE,
    },
  });
  return { res, body: await res.json().catch(() => null) };
}

async function main() {
  const super_ = await login("admin@adwacyber.et", "Adwa#Admin2026!");
  console.log("super login:", super_.res.status);

  // list users as super
  const superUsers = await api("/api/auth/users", super_.jar);
  console.log("super list users:", superUsers.res.status, "count:", superUsers.body?.users?.length);
  if (superUsers.res.status !== 200) console.log("ERROR:", JSON.stringify(superUsers.body));

  const oa = await login("admin@cbe.com.et", "Adwa#Demo2026!");
  console.log("org admin login:", oa.res.status);

  // create temp user
  const created = await api("/api/auth/users", oa.jar, {
    method: "POST",
    body: JSON.stringify({ name: "Temp X", email: `tempx${Date.now()}@cbe.com.et`, role: "AUDITOR", password: "Temp#Pass2026" }),
  });
  console.log("create:", created.res.status, JSON.stringify(created.body));

  // patch role
  const patched = await api(`/api/auth/users/${created.body?.user?.id}`, oa.jar, {
    method: "PATCH",
    body: JSON.stringify({ role: "VIEWER" }),
  });
  console.log("patch role:", patched.res.status, JSON.stringify(patched.body));

  // list as super again
  const superUsers2 = await api("/api/auth/users", super_.jar);
  console.log("super list users #2:", superUsers2.res.status, "count:", superUsers2.body?.users?.length);
  const dashenUser = superUsers2.body?.users?.find((u: any) => u.email === "auditor@dashen.com.et");
  console.log("dashen user found:", Boolean(dashenUser));

  // cleanup
  if (created.body?.user?.id) {
    await api(`/api/auth/users/${created.body.user.id}`, super_.jar, { method: "PATCH", body: JSON.stringify({ status: "DISABLED" }) });
  }
}
main().catch(console.error);
