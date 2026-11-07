#!/usr/bin/env bash
# Adwa Cyber — Remediation SLA browser E2E.
#   1. CBE org admin: findings view — SLA summary chips, SLA column badges,
#      SLA filter, remediate → CLOSED_ON_TIME flow
#   2. Super admin: dashboard overdue banner + Wasasa OVERDUE rows
# Screenshots → /tmp/sla-*.png (verified non-blank afterwards).
# Notes: eval must be IIFE (persistent JS scope); Radix widgets need role
# clicks (pointer events), plain buttons can be eval-clicked.
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
  # wait for the FULL form: the captcha input ("Security check") mounts only
  # after its fetch resolves — later than email/password. Waiting for just
  # "Email" races and yields an empty captcha ref.
  for i in $(seq 1 25); do
    SNAP=$($AB snapshot -i 2>/dev/null)
    echo "$SNAP" | grep -q 'textbox "Email"' && echo "$SNAP" | grep -q 'textbox "Security check"' && break
    sleep 1
  done
  local ER PR CR CAP
  ER=$(ref_of "$(echo "$SNAP" | grep -m1 'textbox "Email"')")
  PR=$(ref_of "$(echo "$SNAP" | grep -m1 'textbox "Password"')")
  CR=$(ref_of "$(echo "$SNAP" | grep -m1 'textbox "Security check"')")
  # the captcha <img> mounts AFTER its fetch resolves (later than the text
  # fields) — poll for it or the answer extraction races ahead and fails
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

echo "── 1. CBE admin: findings view SLA UI ──"
login_as "admin@cbe.com.et" "Adwa#Demo2026!"
$AB find text "Findings" click >/dev/null 2>&1 || $AB find role link click --name "Findings" >/dev/null 2>&1
wait_text "remediation sla" || wait_text "on track"
SLA_HDR=$($AB eval "(() => document.body.innerText.toLowerCase().includes('remediation sla'))()" 2>/dev/null | tail -1)
[ "$SLA_HDR" = "true" ] && ok "SLA summary section present" || bad "SLA summary missing"
wait_text "compliance scans" 15 || true   # wait for table headers (data loaded)
sleep 1
ONTRACK_CHIP=$($AB eval "(() => { const chips = [...document.querySelectorAll('p')].filter(p => /\\bdays? left|on track/i.test(p.textContent)); return chips.length > 0 ? 'ok' : 'no'; })()" 2>/dev/null | tail -1 | tr -d '"')
[ "$ONTRACK_CHIP" = "ok" ] && ok "summary chips render" || bad "summary chips missing"
SLA_COL=$($AB eval "(() => JSON.stringify([...document.querySelectorAll('th')].map(x => x.textContent.trim())))()" 2>/dev/null | tail -1)
echo "$SLA_COL" | grep -q 'Remediation SLA' && ok "SLA column in findings table" || bad "SLA column missing" "$SLA_COL"
BADGE=$($AB eval "(() => { const b = [...document.querySelectorAll('td span, td div')].filter(x => /\\d+d left|Due \\d|due \\d/i.test(x.textContent)); return b.length ? b[0].textContent.trim().slice(0, 30) : 'NONE'; })()" 2>/dev/null | tail -1 | tr -d '"')
echo "$BADGE" | grep -qiE "left|due" && ok "per-row SLA badge with deadline hint" "'$BADGE'" || bad "per-row SLA badge missing" "'$BADGE'"
$AB screenshot /tmp/sla-1-findings-cbe.png >/dev/null 2>&1

echo "── 2. SLA filter: overdue only (CBE → empty) ──"
SLA_SEL=$($AB eval "(() => { const triggers = [...document.querySelectorAll('[role=combobox]')]; return triggers.length; })()" 2>/dev/null | tail -1 | tr -d '"')
echo "  (comboboxes: $SLA_SEL)"
# 4th filter = SLA. Open it via keyboard-ish approach: click then arrow.
$AB find role combobox click --name "All deadlines" >/dev/null 2>&1 || $AB find role combobox click --name "Overdue only" >/dev/null 2>&1
sleep 1
$AB find role option click --name "Overdue" >/dev/null 2>&1 || $AB find role option click --name "Overdue only" >/dev/null 2>&1
sleep 2
EMPTY_ROWS=$($AB eval "(() => { const rows = [...document.querySelectorAll('tbody tr')]; return rows.length; })()" 2>/dev/null | tail -1 | tr -d '"')
[ "$EMPTY_ROWS" = "0" ] && ok "CBE overdue filter → 0 rows" || bad "CBE overdue filter rows" "got $EMPTY_ROWS"
# reset the SLA filter back to "All deadlines" (the trigger's accessible name
# is its aria-label, which does NOT change with the selected value)
$AB find role combobox click --name "All deadlines" >/dev/null 2>&1
sleep 1
$AB find role option click --name "All deadlines" >/dev/null 2>&1
sleep 2.5
ROW_CNT_AFTER_RESET=$($AB eval "(() => document.querySelectorAll('tbody tr').length)()" 2>/dev/null | tail -1 | tr -d '"')
[ "${ROW_CNT_AFTER_RESET:-0}" -gt 0 ] && ok "filter reset shows all rows" || bad "filter reset failed" "rows=$ROW_CNT_AFTER_RESET"

echo "── 3. Remediate a CBE finding → Closed on time ──"
# The row status trigger is a Radix combobox labelled "Status <RULE-CODE>" —
# target it deterministically by accessible name (agent-browser sends real
# pointer events, which Radix needs). Remember the rule code so the SAME row
# is re-checked after each transition (other rows may already be remediated
# from the seed, so global text checks are meaningless).
ROW_OK=$($AB eval "(() => { const rows = [...document.querySelectorAll('tbody tr')]; return rows.length > 0 ? 'ok' : 'no'; })()" 2>/dev/null | tail -1 | tr -d '"')
if [ "$ROW_OK" = "ok" ]; then
  FIRST_RULE=$($AB eval "(() => document.querySelector('tbody tr code')?.textContent ?? 'none')()" 2>/dev/null | tail -1 | tr -d '"')
  $AB find role combobox click --name "Status $FIRST_RULE" >/dev/null 2>&1
  sleep 1
  $AB find role option click --name "Remediated" >/dev/null 2>&1
  sleep 3.5
  CLOSED=$($AB eval "(() => { const row = [...document.querySelectorAll('tbody tr')].find(r => r.querySelector('code')?.textContent === '$FIRST_RULE'); return row ? (row.textContent.includes('Closed on time') ? 'yes' : 'no-badge') : 'row-gone'; })()" 2>/dev/null | tail -1 | tr -d '"')
  [ "$CLOSED" = "yes" ] && ok "remediated finding shows 'Closed on time'" "rule=$FIRST_RULE" || bad "CLOSED_ON_TIME badge missing after remediation" "$CLOSED"
  # reopen the SAME row to restore seed state
  $AB find role combobox click --name "Status $FIRST_RULE" >/dev/null 2>&1
  sleep 1
  $AB find role option click --name "Open" >/dev/null 2>&1
  sleep 3.5
  RESTORED=$($AB eval "(() => { const row = [...document.querySelectorAll('tbody tr')].find(r => r.querySelector('code')?.textContent === '$FIRST_RULE'); if (!row) return 'row-gone'; if (row.textContent.includes('Closed on time')) return 'still-closed'; return /On track|Due soon/.test(row.textContent) ? 'ok' : 'no-open-badge'; })()" 2>/dev/null | tail -1 | tr -d '"')
  [ "$RESTORED" = "ok" ] && ok "reopened → on-track badge (seed state restored)" "rule=$FIRST_RULE" || bad "reopen failed" "$RESTORED"
else
  bad "no finding rows to remediate"
fi
$AB screenshot /tmp/sla-2-remediated.png >/dev/null 2>&1

echo "── 4. Super admin: overdue banner + Wasasa overdue rows ──"
$AB press Escape >/dev/null 2>&1
login_as "admin@adwacyber.et" "Adwa#Admin2026!"
wait_text "overdue remediations" 40 && ok "dashboard overdue banner present" || bad "dashboard overdue banner missing"
BANNER_TXT=$($AB eval "(() => { const p = [...document.querySelectorAll('p')].find(x => /overdue remediations/.test(x.textContent)); return p ? p.textContent.trim() : 'NONE'; })()" 2>/dev/null | tail -1 | tr -d '"')
echo "$BANNER_TXT" | grep -qE "^[0-9]+ overdue" && ok "banner counts overdue items" "'$BANNER_TXT'" || bad "banner text wrong" "'$BANNER_TXT'"
$AB screenshot /tmp/sla-3-dashboard-overdue.png >/dev/null 2>&1

$AB find text "Findings" click >/dev/null 2>&1
wait_text "remediation sla" 30
wait_text "compliance scans" 30 || true
sleep 2
OVERDUE_BADGE=$($AB eval "(() => [...document.querySelectorAll('td')].some(td => td.textContent.trim().includes('Overdue')))()" 2>/dev/null | tail -1)
[ "$OVERDUE_BADGE" = "true" ] && ok "OVERDUE badges visible in super-admin findings" || bad "OVERDUE badges missing"
DAYS_OVER=$($AB eval "(() => { const el = [...document.querySelectorAll('span')].find(s => /\\dd over/i.test(s.textContent)); return el ? el.textContent.trim() : 'NONE'; })()" 2>/dev/null | tail -1 | tr -d '"')
echo "$DAYS_OVER" | grep -qiE "over" && ok "days-over hint rendered" "'$DAYS_OVER'" || bad "days-over hint missing" "'$DAYS_OVER'"
$AB screenshot /tmp/sla-4-findings-overdue.png >/dev/null 2>&1

echo "── 5. Amharic SLA strings ──"
$AB eval "(() => { const b = document.querySelector('button[aria-label=\"Language\"], button[aria-label=\"ቋንቋ\"]'); if (b) b.click(); return 'ok'; })()" >/dev/null 2>&1
sleep 2
AMH=$($AB eval "(() => document.body.innerText.includes('የማስተካከያ ጊዜ ገደብ') || document.body.innerText.includes('ዘግያል') || document.body.innerText.includes('በጊዜው ላይ'))()" 2>/dev/null | tail -1)
[ "$AMH" = "true" ] && ok "Amharic SLA strings render" || bad "Amharic SLA strings missing"
$AB screenshot /tmp/sla-5-amharic.png >/dev/null 2>&1

$AB close >/dev/null 2>&1
echo ""
echo "═══ SLA browser E2E: $PASS passed, $FAIL failed ═══"
exit $([ $FAIL -gt 0 ] && echo 1 || echo 0)
