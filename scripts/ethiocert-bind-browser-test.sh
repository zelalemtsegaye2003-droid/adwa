#!/usr/bin/env bash
# Adwa Cyber — Ethio-CERT exchange binding browser E2E (sync layer).
#   1. CBE admin: Threat Intel tab — "Live exchange · localhost:3020" binding
#      badge; upward report delivers and the toast carries the EC-RCPT receipt.
#   2. Super admin: overview sync runs show LIVE / FIXTURE source chips and
#      the receipt line; ingest via the exchange shows dedupe counts.
#   3. Amharic: binding badge renders in Amharic.
# Screenshots → /tmp/bind-*.png (verified non-blank afterwards).
# Notes: eval must be IIFE (persistent JS scope); Radix tabs need role clicks;
# toasts need ~4s to clear.
set -u
AB="agent-browser"
PASS=0; FAIL=0
ok()   { PASS=$((PASS+1)); echo "PASS  $1${2:+ — $2}"; }
bad()  { FAIL=$((FAIL+1)); echo "FAIL  $1${2:+ — $2}"; }
ref_of() { echo "$1" | grep -oE 'ref=e[0-9]+' | head -1 | cut -d= -f2; }

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

login_as() {
  local email="$1" pass="$2"
  $AB cookies clear >/dev/null 2>&1
  $AB open http://localhost:3000 >/dev/null 2>&1
  $AB eval "(() => { localStorage.setItem('adwa-lang', 'en'); return 'ok'; })()" >/dev/null 2>&1
  $AB reload >/dev/null 2>&1
  local SNAP=""
  for i in $(seq 1 25); do
    SNAP=$($AB snapshot -i 2>/dev/null)
    echo "$SNAP" | grep -q 'textbox "Email"' && echo "$SNAP" | grep -q 'textbox "Security check"' && break
    sleep 1
  done
  local ER PR CR CAP
  ER=$(ref_of "$(echo "$SNAP" | grep -m1 'textbox "Email"')")
  PR=$(ref_of "$(echo "$SNAP" | grep -m1 'textbox "Password"')")
  CR=$(ref_of "$(echo "$SNAP" | grep -m1 'textbox "Security check"')")
  for i in $(seq 1 15); do
    if $AB eval "(() => !!document.querySelector('img[alt=\"CAPTCHA\"]'))()" 2>/dev/null | grep -q true; then
      break
    fi
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
  if wait_text "rule catalogue" 30; then
    echo "  [login_as] $email OK" >&2
  else
    echo "  [login_as] $email FAILED (cap=$CAP refs=$ER/$PR/$CR)" >&2
  fi
}

echo "── 1. CBE admin: Threat Intel binding badge + upward delivery ──"
login_as "admin@cbe.com.et" "Adwa#Demo2026!"
$AB find text "Security Operations" click >/dev/null 2>&1
wait_text "security operations centre" 30
$AB find role tab click --name "Threat Intel" >/dev/null 2>&1
wait_text "ethio-cert synchronisation" 30
sleep 2
BADGE=$($AB eval "(() => document.body.innerText.includes('Live exchange · localhost:3020'))()" 2>/dev/null | tail -1)
[ "$BADGE" = "true" ] && ok "live binding badge on sync panel" || bad "live binding badge missing"
$AB screenshot /tmp/bind-1-badge.png >/dev/null 2>&1
$AB find role button click --name "Report upward (anonymised)" >/dev/null 2>&1
sleep 4
RECEIPT_TOAST=$($AB eval "(() => { const all = [...document.querySelectorAll('[data-sonner-toast], [role=status], body')].map(x => x.textContent).join(' '); return all.includes('EC-RCPT-') ? 'ok' : 'no'; })()" 2>/dev/null | tail -1 | tr -d '"')
[ "$RECEIPT_TOAST" = "ok" ] && ok "upward report toast carries exchange receipt" || bad "receipt toast missing"
$AB screenshot /tmp/bind-2-report-toast.png >/dev/null 2>&1

echo "── 2. Super admin: LIVE runs, receipt line, exchange ingest ──"
login_as "admin@adwacyber.et" "Adwa#Admin2026!"
$AB find text "Security Operations" click >/dev/null 2>&1
wait_text "security operations centre" 30
sleep 2
SUPER_BADGE=$($AB eval "(() => document.body.innerText.includes('Live exchange · localhost:3020'))()" 2>/dev/null | tail -1)
[ "$SUPER_BADGE" = "true" ] && ok "live binding badge on super overview" || bad "super overview badge missing"
LIVE_CHIP=$($AB eval "(() => { const badges = [...document.querySelectorAll('span')].filter(x => x.textContent.trim() === 'LIVE'); return badges.length >= 1 ? badges.length : 0; })()" 2>/dev/null | tail -1 | tr -d '"')
[ "${LIVE_CHIP:-0}" -ge 1 ] && ok "LIVE source chip on sync runs" "n=$LIVE_CHIP" || bad "LIVE chip missing" "n=$LIVE_CHIP"
FIXTURE_CHIP=$($AB eval "(() => { const badges = [...document.querySelectorAll('span')].filter(x => x.textContent.trim() === 'FIXTURE'); return badges.length >= 1 ? badges.length : 0; })()" 2>/dev/null | tail -1 | tr -d '"')
[ "${FIXTURE_CHIP:-0}" -ge 1 ] && ok "FIXTURE source chip on seeded run" "n=$FIXTURE_CHIP" || bad "FIXTURE chip missing" "n=$FIXTURE_CHIP"
RECEIPT_LINE=$($AB eval "(() => document.body.innerText.includes('Receipt EC-RCPT-'))()" 2>/dev/null | tail -1)
[ "$RECEIPT_LINE" = "true" ] && ok "receipt shown on the LIVE report run" || bad "receipt line missing"
$AB screenshot /tmp/bind-3-super-runs.png >/dev/null 2>&1
$AB find role tab click --name "Threat Intel" >/dev/null 2>&1
wait_text "ethio-cert synchronisation" 30
sleep 2
$AB find role button click --name "Pull national feed" >/dev/null 2>&1
sleep 4
INGEST_TOAST=$($AB eval "(() => { const all = [...document.querySelectorAll('[data-sonner-toast], [role=status], body')].map(x => x.textContent).join(' '); return /0 new/i.test(all) && /8 refreshed/i.test(all) ? 'ok' : 'no'; })()" 2>/dev/null | tail -1 | tr -d '"')
[ "$INGEST_TOAST" = "ok" ] && ok "exchange ingest toast (0 new · 8 refreshed)" || bad "ingest toast wrong"
$AB screenshot /tmp/bind-4-ingest.png >/dev/null 2>&1

echo "── 3. Amharic binding strings ──"
$AB eval "(() => { const b = document.querySelector('button[aria-label=\"Language\"], button[aria-label=\"ቋንቋ\"]'); if (b) b.click(); return 'ok'; })()" >/dev/null 2>&1
sleep 2
AMH_BADGE=$($AB eval "(() => document.body.innerText.includes('ቀጥታ ትስስር') && document.body.innerText.includes('ከኢትዮ-CERT ጋር ማመሳሰል'))()" 2>/dev/null | tail -1)
[ "$AMH_BADGE" = "true" ] && ok "Amharic binding badge renders" || bad "Amharic binding strings missing"
$AB screenshot /tmp/bind-5-amharic.png >/dev/null 2>&1

$AB close >/dev/null 2>&1
echo ""
echo "═══ Ethio-CERT binding browser E2E: $PASS passed, $FAIL failed ═══"

# screenshots non-blank
BLANK=0
for f in /tmp/bind-*.png; do
  [ -s "$f" ] || { BLANK=1; echo "EMPTY screenshot: $f"; }
done
[ $BLANK -eq 0 ] && echo "screenshots OK" || echo "screenshots BLANK/EMPTY"
exit $([ $FAIL -gt 0 ] && echo 1 || echo 0)
