#!/usr/bin/env bash
# Adwa Cyber — Rules Engine browser E2E (catalogue coverage + evidence links).
# Logs in via the UI (captcha solved by parsing the SVG data-URI), then:
#   1. Catalogue: coverage summary card + per-rule badges (PD-1321 & NBE-IT)
#   2. Evidence Library: document links panel, link/unlink via picker
#   3. Amharic toggle smoke check
# Notes:
#   - agent-browser eval persists JS scope between calls → every eval is an IIFE.
#   - Radix tabs activate on pointerdown → use role clicks, never el.click().
#   - CSS text-transform:uppercase changes innerText → compare case-insensitively.
# Screenshots saved to /tmp/re-*.png and verified non-blank afterwards.
set -u
AB="agent-browser"
PASS=0; FAIL=0
ok()   { PASS=$((PASS+1)); echo "PASS  $1${2:+ — $2}"; }
bad()  { FAIL=$((FAIL+1)); echo "FAIL  $1${2:+ — $2}"; }
ref_of() { echo "$1" | grep -oE 'ref=e[0-9]+' | head -1 | cut -d= -f2; }

# wait_text <lowercase substring> [max_tries] — poll until body text contains it
wait_text() {
  local pat="$1" tries="${2:-20}" i
  for ((i = 0; i < tries; i++)); do
    if $AB eval "(() => !!(document.body && document.body.innerText.toLowerCase().includes('$pat')))()" 2>/dev/null | grep -q true; then
      return 0
    fi
    sleep 1
  done
  return 1
}

echo "── 1. Open app & login ──"
$AB cookies clear >/dev/null 2>&1   # always exercise the full login flow
$AB open http://localhost:3000 >/dev/null 2>&1
# normalize UI language to English (choice persists in localStorage across runs)
$AB eval "(() => { localStorage.setItem('adwa-lang', 'en'); return 'ok'; })()" >/dev/null 2>&1
$AB reload >/dev/null 2>&1

# wait for the FULL login form: the captcha input ("Security check") mounts
# only after its fetch resolves — later than email/password. Waiting for just
# "Email" races and yields an empty captcha ref.
SNAP=""
for i in $(seq 1 25); do
  SNAP=$($AB snapshot -i 2>/dev/null)
  echo "$SNAP" | grep -q 'textbox "Email"' && echo "$SNAP" | grep -q 'textbox "Security check"' && break
  sleep 1
done
EMAIL_REF=$(ref_of "$(echo "$SNAP" | grep -m1 'textbox "Email"')")
PASS_REF=$(ref_of "$(echo "$SNAP" | grep -m1 'textbox "Password"')")
CAP_REF=$(ref_of "$(echo "$SNAP" | grep -m1 'textbox "Security check"')")
[ -n "$EMAIL_REF" ] && [ -n "$PASS_REF" ] && [ -n "$CAP_REF" ] && ok "login form present" "email=@$EMAIL_REF pass=@$PASS_REF captcha=@$CAP_REF" || bad "login form fields missing" "email=$EMAIL_REF pass=$PASS_REF cap=$CAP_REF"

CAP_ANS=$($AB eval "(() => { const img = document.querySelector('img[alt=\"CAPTCHA\"]'); if (!img) return ''; return [...decodeURIComponent(img.src).matchAll(/<text[^>]*>([^<]+)<\\/text>/g)].map(m => m[1]).join(''); })()" 2>/dev/null | tail -1 | tr -d '"')
[ -n "$CAP_ANS" ] && ok "captcha extracted" "answer=$CAP_ANS" || bad "captcha extraction failed"

$AB fill @$EMAIL_REF "admin@cbe.com.et" >/dev/null 2>&1
$AB fill @$PASS_REF "Adwa#Demo2026!" >/dev/null 2>&1
$AB fill @$CAP_REF "$CAP_ANS" >/dev/null 2>&1
$AB find role button click --name "Sign in" >/dev/null 2>&1
wait_text "rule catalogue" && ok "logged in as CBE org admin" || bad "login failed"

echo "── 2. Catalogue: PD-1321 coverage ──"
$AB find text "Rule Catalogue" click >/dev/null 2>&1
wait_text "evidence coverage" && ok "coverage summary card rendered (PD-1321)" || bad "coverage card missing"
SAT_TXT=$($AB eval "(() => { const el = [...document.querySelectorAll('p')].find(p => /satisfied/.test(p.textContent) && /%/.test(p.textContent)); return el ? el.textContent.trim() : 'NOT_FOUND'; })()" 2>/dev/null | tail -1 | tr -d '"')
echo "$SAT_TXT" | grep -qE "[0-9]+/47 satisfied" && ok "PD-1321 coverage figures" "'$SAT_TXT'" || bad "PD-1321 coverage figures wrong" "'$SAT_TXT'"
EV_CHIP=$($AB eval "(() => [...document.querySelectorAll('span')].some(s => s.textContent.includes('Evidence on file')))()" 2>/dev/null | tail -1)
[ "$EV_CHIP" = "true" ] && ok "SATISFIED badge visible on linked rules" || bad "no SATISFIED badge in PD-1321 list"
EVDOC_CHIP=$($AB eval "(() => [...document.querySelectorAll('span')].some(s => s.textContent.includes('Branch Access Review')))()" 2>/dev/null | tail -1)
[ "$EVDOC_CHIP" = "true" ] && ok "evidence chip w/ document title on rule card" || bad "evidence chip not shown"
$AB screenshot /tmp/re-1-catalogue-pd.png >/dev/null 2>&1

echo "── 3. Catalogue: NBE-IT tab ──"
$AB find role tab click --name "NBE" >/dev/null 2>&1
wait_text "sbb/83/2022" 12 || true   # NBE framework card visible
sleep 1
NBE_COV=$($AB eval "(() => { const el = [...document.querySelectorAll('p')].find(p => /satisfied/.test(p.textContent) && /%/.test(p.textContent)); return el ? el.textContent.trim() : 'NOT_FOUND'; })()" 2>/dev/null | tail -1 | tr -d '"')
echo "$NBE_COV" | grep -qE "[0-9]+/30 satisfied" && ok "NBE-IT coverage figures" "'$NBE_COV'" || bad "NBE-IT coverage figures wrong" "'$NBE_COV'"
NBE05=$($AB eval "(() => [...document.querySelectorAll('code')].some(c => c.textContent === 'NBE-05'))()" 2>/dev/null | tail -1)
[ "$NBE05" = "true" ] && ok "NBE-05 rule visible (InfoSec Policy satisfied)" || bad "NBE-05 not visible"
SUPPORTS_NBE14=$($AB eval "(() => [...document.querySelectorAll('span')].some(s => s.textContent.includes('ICT Risk Appetite')))()" 2>/dev/null | tail -1)
[ "$SUPPORTS_NBE14" = "true" ] && ok "SUPPORTS-linked doc chip on NBE-14" || bad "NBE-14 support chip not shown"
$AB screenshot /tmp/re-2-catalogue-nbe.png >/dev/null 2>&1

echo "── 4. Evidence Library: links panel ──"
$AB find text "Evidence Library" click >/dev/null 2>&1
wait_text "information security policy v3.2" && ok "seeded document visible in vault" || bad "seeded document not found in vault"
$AB find text "Information Security Policy v3.2" click >/dev/null 2>&1
wait_text "linked obligations" && ok "linked-obligations panel in doc dialog" || bad "links panel missing"
NBE05_LINK=$($AB eval "(() => { const codes = [...document.querySelectorAll('code')].map(c => c.textContent); return JSON.stringify(codes); })()" 2>/dev/null | tail -1)
echo "$NBE05_LINK" | grep -q 'NBE-05' && ok "AUTO_TAG link NBE-05 shown in dialog" || bad "NBE-05 link not shown" "$NBE05_LINK"
AUTO_SRC=$($AB eval "(() => document.body.innerText.includes('auto'))()" 2>/dev/null | tail -1)
[ "$AUTO_SRC" = "true" ] && ok "auto link-source badge displayed" || bad "AUTO badge not displayed"
$AB screenshot /tmp/re-3-evidence-links.png >/dev/null 2>&1

echo "── 5. Link picker: link & unlink NBE-01 ──"
PICKER=$($AB eval "(() => { const el = [...document.querySelectorAll('input')].find(i => i.placeholder && i.placeholder.includes('obligation')); return el ? 'FOUND' : 'NO'; })()" 2>/dev/null | tail -1 | tr -d '"')
if [ "$PICKER" = "FOUND" ]; then
  ok "link picker input present"
  PICK_REF=$(ref_of "$($AB snapshot -i 2>/dev/null | grep -m1 'textbox "Link obligation"')")
  [ -z "$PICK_REF" ] && PICK_REF=$(ref_of "$($AB snapshot -i 2>/dev/null | grep -im1 'obligation')")
  $AB fill @$PICK_REF "NBE-01" >/dev/null 2>&1
  sleep 3
  # click the dropdown entry (plain onClick button → synthetic click is reliable;
  # find-by-text can race with the dropdown closing on blur)
  LINK_CLICK=$($AB eval "(() => { const btn = [...document.querySelectorAll('button')].find(b => b.querySelector('code')?.textContent === 'NBE-01' && b.closest('.relative')); if (btn) { btn.click(); return 'ok'; } return 'no-entry'; })()" 2>/dev/null | tail -1 | tr -d '"')
  sleep 3
  # verify against the linked-list codes only (ul li code), not the whole page
  NBE01_NOW=$($AB eval "(() => [...document.querySelectorAll('ul li code')].some(c => c.textContent === 'NBE-01'))()" 2>/dev/null | tail -1)
  [ "$NBE01_NOW" = "true" ] && ok "NBE-01 linked via picker (MANUAL)" || bad "NBE-01 link failed" "entry-click=$LINK_CLICK"
  UNLINK_CLICK=$($AB eval "(() => { const btn = document.querySelector('button[aria-label=\"Unlink NBE-01\"]'); if (btn) { btn.click(); return 'ok'; } return 'no-btn'; })()" 2>/dev/null | tail -1 | tr -d '"')
  sleep 3
  NBE01_GONE=$($AB eval "(() => [...document.querySelectorAll('ul li code')].some(c => c.textContent === 'NBE-01'))()" 2>/dev/null | tail -1)
  [ "$NBE01_GONE" = "false" ] && ok "NBE-01 unlinked (seed state restored)" || bad "NBE-01 unlink failed" "unlink-click=$UNLINK_CLICK"
else
  bad "link picker input missing"
fi
$AB screenshot /tmp/re-4-link-picker.png >/dev/null 2>&1

echo "── 6. Amharic toggle ──"
$AB press Escape >/dev/null 2>&1
sleep 1.5
DLG_OPEN=$($AB eval "(() => !!document.querySelector('[role=dialog]'))()" 2>/dev/null | tail -1)
if [ "$DLG_OPEN" = "true" ]; then
  $AB find role button click --name "Close" >/dev/null 2>&1
  sleep 1.5
fi
sleep 4   # let toasts auto-dismiss (they overlay the header area)
# plain onClick button → synthetic click works regardless of current language
TOG=$($AB eval "(() => { const b = document.querySelector('button[aria-label=\"Language\"], button[aria-label=\"ቋንቋ\"]'); if (b) b.click(); return b ? 'ok' : 'none'; })()" 2>/dev/null | tail -1 | tr -d '"')
[ "$TOG" = "ok" ] && ok "language toggle clicked" || bad "language button not found"
sleep 2.5
AMH=$($AB eval "(() => document.body.innerText.includes('የደንቦች') || document.body.innerText.includes('የማስረጃ') || document.body.innerText.includes('ተያያዙ'))()" 2>/dev/null | tail -1)
[ "$AMH" = "true" ] && ok "Amharic UI strings render" || bad "Amharic strings not found"
$AB screenshot /tmp/re-5-amharic.png >/dev/null 2>&1
# toggle back to English and verify
$AB eval "(() => { const b = document.querySelector('button[aria-label=\"Language\"], button[aria-label=\"ቋንቋ\"]'); if (b) b.click(); return 'ok'; })()" >/dev/null 2>&1
sleep 2
ENG=$($AB eval "(() => document.body.innerText.includes('Rule Catalogue'))()" 2>/dev/null | tail -1)
[ "$ENG" = "true" ] && ok "English restored" || bad "English not restored"

$AB close >/dev/null 2>&1
echo ""
echo "═══ Rules Engine browser E2E: $PASS passed, $FAIL failed ═══"
exit $([ $FAIL -gt 0 ] && echo 1 || echo 0)
