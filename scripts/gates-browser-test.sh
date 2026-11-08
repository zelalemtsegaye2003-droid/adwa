#!/usr/bin/env bash
# Adwa Cyber — Track C Gate Board browser E2E (proposal Phases 4–5 governance).
#   1. Super admin login → Track C Gates nav visible, board renders
#   2. Deployment-locked banner + 0% readiness + all 8 criteria
#   3. Open the update dialog, satisfy EMA criterion with evidence note
#   4. Readiness updates to 25%, gate still locked; audit-friendly notes show
#   5. CBE org admin: nav item HIDDEN (platform-level, RBAC)
# Screenshots → /tmp/gates-browser-*.png
set -u
AB="agent-browser"
PASS=0; FAIL=0
ok()   { PASS=$((PASS+1)); echo "PASS  $1${2:+ — $2}"; }
bad()  { FAIL=$((FAIL+1)); echo "FAIL  $1${2:+ — $2}"; }
ref_of() { echo "$1" | grep -oE 'ref=e[0-9]+' | head -1 | cut -d= -f2; }
wait_text() {
  local pat="$1" tries="${2:-25}" i
  for ((i = 0; i < tries; i++)); do
    if $AB eval "(() => !!(document.body && document.body.innerText.toLowerCase().includes('$pat')))()" 2>/dev/null | grep -q true; then
      return 0
    fi
    sleep 1
  done
  return 1
}

login_as() {
  local email="$1" pass="$2"
  $AB cookies clear >/dev/null 2>&1
  $AB open http://localhost:3000 >/dev/null 2>&1
  $AB eval "(() => { localStorage.setItem('adwa-lang', 'en'); return 'ok'; })()" >/dev/null 2>&1
  $AB reload >/dev/null 2>&1
  local SNAP=""
  for i in $(seq 1 30); do
    SNAP=$($AB snapshot -i 2>/dev/null)
    echo "$SNAP" | grep -q 'textbox "Email"' && break
    sleep 1
  done
  local ER PR CR CAP
  ER=$(ref_of "$(echo "$SNAP" | grep -m1 'textbox "Email"')")
  PR=$(ref_of "$(echo "$SNAP" | grep -m1 'textbox "Password"')")
  CR=$(ref_of "$(echo "$SNAP" | grep -m1 'textbox "Security check"')")
  for i in $(seq 1 15); do
    $AB eval "(() => !!document.querySelector('img[alt=\"CAPTCHA\"]'))()" 2>/dev/null | grep -q true && break
    sleep 1
  done
  CAP=""
  for i in 1 2 3; do
    CAP=$($AB eval "(() => { const img = document.querySelector('img[alt=\"CAPTCHA\"]'); if (!img) return ''; return [...decodeURIComponent(img.src).matchAll(/<text[^>]*>([^<]+)<\\/text>/g)].map(m => m[1]).join(''); })()" 2>/dev/null | tail -1 | tr -d '"')
    [ -n "$CAP" ] && break
    sleep 1
  done
  $AB fill @$ER "$email" >/dev/null 2>&1
  $AB fill @$PR "$pass" >/dev/null 2>&1
  $AB fill @$CR "$CAP" >/dev/null 2>&1
  $AB find role button click --name "Sign in" >/dev/null 2>&1
}

echo "── 1. Super admin: Track C board ──"
for ATTEMPT in 1 2 3; do
  login_as "admin@adwacyber.et" "Adwa#Admin2026!"
  wait_text "rules enforced" 30 && break
  echo "  attempt $ATTEMPT: retrying login…"
done
wait_text "rules enforced" 10 && ok "super admin login" || bad "super admin login"

NAV=$($AB eval "(() => [...document.querySelectorAll('button')].some(b => b.textContent.includes('Track C Gates')))()" 2>/dev/null | tail -1)
[ "$NAV" = "true" ] && ok "Track C Gates nav item visible (super)" || bad "nav item missing for super"

$AB find role button click --name "Track C Gates" >/dev/null 2>&1
wait_text "gated expansion" 30 && ok "Track C board renders" || bad "board did not render"
$AB screenshot /tmp/gates-browser-1-board.png >/dev/null 2>&1

LOCKED=$($AB eval "(() => document.body.innerText.includes('Deployment locked'))()" 2>/dev/null | tail -1)
[ "$LOCKED" = "true" ] && ok "deployment-locked posture banner" || bad "locked banner missing"
N4=$($AB eval "(() => document.body.innerText.includes('Phase 4') && document.body.innerText.includes('Phase 5'))()" 2>/dev/null | tail -1)
[ "$N4" = "true" ] && ok "both phase panels (P4 ACFS + P5 CII)" || bad "phase panels missing"
EMA=$($AB eval "(() => document.body.innerText.includes('Signed EMA partnership'))()" 2>/dev/null | tail -1)
[ "$EMA" = "true" ] && ok "EMA partnership criterion listed" || bad "EMA criterion missing"
ZERO=$($AB eval "(() => document.body.innerText.includes('0%'))()" 2>/dev/null | tail -1)
[ "$ZERO" = "true" ] && ok "readiness 0% after suite reset" || bad "readiness not 0%"

echo "── 2. Satisfy the EMA criterion via the dialog ──"
# reset criterion state first via API is done in suite; open the EMA row's Update dialog
$AB eval "(() => { const row = [...document.querySelectorAll('div')].find(d => d.textContent.includes('EMA_PARTNERSHIP') && d.querySelector('button')); if (row) { const btn = [...row.querySelectorAll('button')].find(b => b.textContent.includes('Update')); if (btn) { btn.click(); return 'clicked'; } } return 'none'; })()" 2>/dev/null | tail -1
sleep 2
DLG=$($AB eval "(() => !!document.querySelector('[role=\"dialog\"]'))()" 2>/dev/null | tail -1)
[ "$DLG" = "true" ] && ok "update dialog opens" || bad "dialog did not open"
$AB find role button click --name "Satisfied" >/dev/null 2>&1
sleep 1
NOTE_REF=$($AB snapshot -i 2>/dev/null | grep -m1 'textbox "Evidence note"' | ref_of "$(grep -m1 'textbox \"Evidence note\"' /dev/stdin <<< '')")
# fill the note via eval (robust against ref drift)
$AB eval "(() => { const ta = document.querySelector('[role=\"dialog\"] textarea'); if (ta) { const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set; setter.call(ta, 'Signed EMA partnership letter, ref EMA/2026/114 (browser test)'); ta.dispatchEvent(new Event('input', { bubbles: true })); return 'filled'; } return 'none'; })()" 2>/dev/null | tail -1
sleep 1
$AB find role button click --name "Save" >/dev/null 2>&1
sleep 3
PCT=$($AB eval "(() => document.body.innerText.includes('25%'))()" 2>/dev/null | tail -1)
[ "$PCT" = "true" ] && ok "readiness updates to 25%" || bad "readiness did not update"
STILL=$($AB eval "(() => document.body.innerText.includes('Deployment locked'))()" 2>/dev/null | tail -1)
[ "$STILL" = "true" ] && ok "gate still locked at 25% (enforcement intact)" || bad "gate opened too early"
NOTE=$($AB eval "(() => document.body.innerText.includes('EMA/2026/114'))()" 2>/dev/null | tail -1)
[ "$NOTE" = "true" ] && ok "evidence note displayed on the criterion" || bad "evidence note not shown"
$AB screenshot /tmp/gates-browser-2-updated.png >/dev/null 2>&1

echo "── 3. CBE org admin: nav hidden (RBAC) ──"
login_as "admin@cbe.com.et" "Adwa#Demo2026!"
wait_text "rules enforced" 30
NAV2=$($AB eval "(() => [...document.querySelectorAll('button')].some(b => b.textContent.includes('Track C Gates')))()" 2>/dev/null | tail -1)
[ "$NAV2" != "true" ] && ok "Track C Gates hidden for ORG_ADMIN" || bad "nav leaked to tenant admin"

echo ""
echo "RESULT: $PASS passed, $FAIL failed"
for f in /tmp/gates-browser-*.png; do
  [ -s "$f" ] && echo "  shot: $f ($(stat -c%s "$f") bytes)" || echo "  shot MISSING: $f"
done
[ "$FAIL" = "0" ] && exit 0 || exit 1
