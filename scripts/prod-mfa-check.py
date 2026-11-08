#!/usr/bin/env python3
"""Prod MFA check: officer login requires TOTP; verify with the known seed."""
import base64, hashlib, hmac, json, re, struct, time, urllib.request

BASE = "http://localhost:3100"
SEED = "UPRWOJXX2JVEYGDRDDXSWXDGCDIJLNLD"

def totp(key_b32, t=None, step=30, digits=6):
    key = base64.b32decode(key_b32)
    counter = struct.unpack(">Q", struct.pack(">Q", int((t or time.time()) // step)))[0]
    mac = hmac.new(key, struct.pack(">Q", int((t or time.time()) // step)), hashlib.sha1).digest()
    o = mac[-1] & 0x0F
    code = (struct.unpack(">I", mac[o:o+4])[0] & 0x7FFFFFFF) % (10 ** digits)
    return f"{code:06d}"

def get(path, cookie=""):
    req = urllib.request.Request(f"{BASE}{path}", headers={"Cookie": cookie} if cookie else {})
    try:
        return urllib.request.urlopen(req)
    except urllib.error.HTTPError as e:
        return e

def post(path, body, cookie=""):
    req = urllib.request.Request(
        f"{BASE}{path}", data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json", "X-Forwarded-For": "10.99.3.3",
                 **({"Cookie": cookie} if cookie else {})}, method="POST")
    try:
        return urllib.request.urlopen(req)
    except urllib.error.HTTPError as e:
        return e

# step 1: password -> expect MFA_REQUIRED
dto = json.loads(get("/api/auth/captcha").read())
ans = "".join(re.findall(r'<text[^>]*>([^<])</text>', dto["svg"]))
r = post("/api/auth/login", {"email": "officer@cbe.com.et", "password": "Adwa#Demo2026!",
                             "captchaId": dto["captchaId"], "captchaAnswer": ans})
body = json.loads(r.read())
assert r.status == 200 and body.get("mfaRequired") is True, f"expected MFA_REQUIRED, got {r.status}: {body}"
print("password step ok -> mfaRequired=True")
token = body.get("mfaToken")
assert token, "no mfaToken"

# step 2: TOTP verify
code = totp(SEED)
r2 = post("/api/auth/mfa/verify", {"mfaToken": token, "code": code})
b2 = json.loads(r2.read())
assert r2.status == 200, f"TOTP verify failed {r2.status}: {b2}"
print(f"TOTP verify ok (code {code}) -> {b2.get('user',{}).get('email')}")

# step 3: authed call with the cookie
names = ("adwa_at", "adwa_rt")
ck = "; ".join(c.split(";")[0] for c in (r2.headers.get_all("Set-Cookie") or [])
               if c.split("=", 1)[0] in names)
me = json.loads(get("/api/auth/me", ck).read())
assert me.get("user", {}).get("email") == "officer@cbe.com.et", me
print("MFA-complete session ok ->", me["user"]["email"], f"(role {me['user']['role']})")
print("\nMFA PROD CHECK PASSED")
