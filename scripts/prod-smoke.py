#!/usr/bin/env python3
"""Prod smoke test: captcha parse -> login -> authed API round-trip."""
import json, re, sys, urllib.request

# NOTE: in production the session cookies are Secure-flagged (HTTPS-only).
# This harness runs over plain HTTP, so it carries Set-Cookie manually
# instead of via a cookie jar — mirroring what Caddy TLS does in prod.
BASE = "http://localhost:3100"
COOKIE = ""

def get(path):
    headers = {"Cookie": COOKIE} if COOKIE else {}
    req = urllib.request.Request(f"{BASE}{path}", headers=headers)
    try:
        return urllib.request.urlopen(req)
    except urllib.error.HTTPError as e:
        return e

def post(path, body):
    global COOKIE
    req = urllib.request.Request(
        f"{BASE}{path}", data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json", "X-Forwarded-For": "10.99.1.1"}, method="POST")
    try:
        r = urllib.request.urlopen(req)
    except urllib.error.HTTPError as e:
        r = e
    setc = r.headers.get_all("Set-Cookie") or []
    names = ("adwa_at", "adwa_rt")
    kept = [c.split(";")[0] for c in setc if c.split("=", 1)[0] in names]
    if kept:
        COOKIE = "; ".join(kept)
    return r

# 1. captcha
dto = json.loads(get("/api/auth/captcha").read())
answer = "".join(re.findall(r'<text[^>]*>([^<])</text>', dto["svg"]))
assert answer, "captcha answer not parsed"
print(f"captcha ok (answer len {len(answer)})")

# 2. login
r = post("/api/auth/login", {
    "email": "admin@adwacyber.et", "password": "Adwa#Admin2026!",
    "captchaId": dto["captchaId"], "captchaAnswer": answer})
login = json.loads(r.read())
assert r.status == 200, f"login failed {r.status}: {login}"
print(f"login ok -> {login.get('user',{}).get('email')} role={login.get('user',{}).get('role')}")

# 3. authed /api/rules
rules = json.loads(get("/api/rules").read())
print(f"authed /api/rules ok -> {rules['total']} rules ({len(rules['rules'])} listed)")
assert rules["total"] >= 77, f"expected 77 rules, got {rules['total']}"

# 4. authed /api/stats
stats = json.loads(get("/api/stats").read())
print(f"authed /api/stats ok -> keys: {sorted(stats)[:6]}...")

# 5. authed /api/gates (Track C)
gates = json.loads(get("/api/gates").read())
criteria_n = sum(len(p["criteria"]) for p in gates["phases"])
print(f"authed /api/gates ok -> {criteria_n} gate criteria across {[p['phase'] for p in gates['phases']]}")
assert criteria_n == 8

# 6. /api/auth/me + refresh
me = json.loads(get("/api/auth/me").read())
print(f"/api/auth/me ok -> {me.get('user',{}).get('email')}")

print("\nALL PROD SMOKE CHECKS PASSED")
