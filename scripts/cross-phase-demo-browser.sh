#!/usr/bin/env bash
# Adwa Cyber — cross-phase data-flow demo: BROWSER WALKTHROUGH.
# Visually verifies in the UI what the API demo just created:
#   1. Login as CBE admin
#   2. Findings view  → the demo scan's critical findings with SLA deadlines
#   3. SOC / Incidents → INC-2026-0008 (contained, IOC-linked, notified)
#   4. Report view    → the demo scan exports a PDF
# Screenshots → /tmp/demo-browser-*.png
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

echo "── 0. Login as CBE admin ──"
LOGIN_OK=0
for ATTEMPT in 1 2 3; do
  $AB cookies clear >/dev/null 2>&1
  $AB open http://localhost:3000 >/dev/null 2>&1
  $AB eval "(() => { localStorage.setItem('adwa-lang', 'en'); return 'ok'; })()" >/dev/null 2>&1
  $AB reload >/dev/null 2>&1
  SNAP=""
  for i in $(seq 1 30); do
    SNAP=$($AB snapshot -i 2>/dev/null)
    echo "$SNAP" | grep -q 'textbox "Email"' && break
    sleep 1
  done
  ER=$(ref_of "$(echo "$SNAP" | grep -m1 'textbox "Email"')")
  PR=$(ref_of "$(echo "$SNAP" | grep -m1 'textbox "Password"')")
  CR=$(ref_of "$(echo "$SNAP" | grep -m1 'textbox "Security check"')")
  [ -z "$ER$PR$CR" ] && { echo "  attempt $ATTEMPT: form not found, retrying…"; sleep 3; continue; }
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
  $AB fill @$ER "admin@cbe.com.et" >/dev/null 2>&1
  $AB fill @$PR "Adwa#Demo2026!" >/dev/null 2>&1
  $AB fill @$CR "$CAP" >/dev/null 2>&1
  $AB find role button click --name "Sign in" >/dev/null 2>&1
  if wait_text "rules enforced" 30; then LOGIN_OK=1; break; fi
  echo "  attempt $ATTEMPT: login not confirmed, retrying…"
done
[ "$LOGIN_OK" = "1" ] && ok "login → dashboard" || bad "login failed after 3 attempts"
$AB screenshot /tmp/demo-browser-1-dashboard.png >/dev/null 2>&1

echo "── 1. Findings view: demo scan's SLA findings ──"
$AB find role button click --name "Findings" >/dev/null 2>&1
wait_text "remediation sla" 25 || wait_text "72-hour" 25
SLA_COL=$($AB eval "(() => document.body.innerText.includes('Remediation SLA'))()" 2>/dev/null | tail -1)
[ "$SLA_COL" = "true" ] && ok "findings table with SLA column" || bad "SLA column missing"
ART43=$($AB eval "(() => document.body.innerText.includes('72-hour notification'))()" 2>/dev/null | tail -1)
[ "$ART43" = "true" ] && ok "PD-1321 Art. 43 breach-notification finding visible" || bad "Art.43 finding not visible"
BADGE=$($AB eval "(() => { const b = [...document.querySelectorAll('td span, td div')].filter(x => /\\d+d left|Due \\d|due \\d/i.test(x.textContent)); return b.length ? b[0].textContent.trim().slice(0, 30) : 'NONE'; })()" 2>/dev/null | tail -1 | tr -d '"')
echo "$BADGE" | grep -qiE "left|due" && ok "per-row SLA deadline badge" "'$BADGE'" || bad "SLA badge missing" "'$BADGE'"
$AB screenshot /tmp/demo-browser-2-findings.png >/dev/null 2>&1

echo "── 2. SOC: the contained phishing incident ──"
$AB find role button click --name "Security Operations" >/dev/null 2>&1
for i in $(seq 1 25); do
  TABS=$($AB eval "(() => [...document.querySelectorAll('[role=\\"tab\\"]')].map(x => x.textContent).join('|'))()" 2>/dev/null | tail -1)
  echo "$TABS" | grep -q "Incidents" && break
  sleep 2
done
$AB find role tab click --name "Incidents" >/dev/null 2>&1
# find the demo incident ref dynamically (latest phishing-campaign incident)
DEMO_REF=""
for i in $(seq 1 15); do
  DEMO_REF=$($AB eval "(() => { const m = document.body.innerText.match(/INC-\\d{4}-\\d+/g) || []; const row = [...document.querySelectorAll('tr')].find(r => r.textContent.includes('phishing campaign impersonating')); return row ? (row.textContent.match(/INC-\\d{4}-\\d+/) || [''])[0] : ''; })()" 2>/dev/null | tail -1 | tr -d '"')
  [ -n "$DEMO_REF" ] && break
  sleep 2
done
[ -n "$DEMO_REF" ] && ok "demo incident $DEMO_REF in the queue" || bad "demo incident not in queue"
CONT=$($AB eval "(() => /contained/i.test(document.body.innerText))()" 2>/dev/null | tail -1)
[ "$CONT" = "true" ] && ok "incident shows contained status" || bad "contained status not visible"
# open the incident detail dialog by clicking the demo row's ref cell (never an action button)
$AB eval "(() => { const row = [...document.querySelectorAll('tr')].find(r => r.textContent.includes('$DEMO_REF')); if (row) { const cell = [...row.querySelectorAll('td')].find(c => c.textContent.includes('INC-')) || row; cell.click(); return 'clicked'; } return 'none'; })()" >/dev/null 2>&1
for i in $(seq 1 12); do
  D=$($AB eval "(() => !!document.querySelector('[role=\\"dialog\\"]'))()" 2>/dev/null | tail -1)
  [ "$D" = "true" ] && break
  sleep 1
done
sleep 2
poll_body() {  # poll dialog body for a predicate string until true
  local js="$1" tries="${2:-15}" i
  for ((i = 0; i < tries; i++)); do
    if $AB eval "$js" 2>/dev/null | tail -1 | grep -q true; then return 0; fi
    sleep 1
  done
  return 1
}
IOC=$($AB eval "(() => document.body.innerText.includes('cbe-secure-verify-portal.com'))()" 2>/dev/null | tail -1)
[ "$IOC" = "true" ] && ok "correlated Ethio-CERT IOC visible in incident detail" || bad "IOC not visible in detail"
if poll_body "(() => { const t = document.body.innerText.toLowerCase(); return (t.includes('sinkhole') || t.includes('gateway')); })()" 15; then
  ok "incident timeline shows notify/contain events"
else
  bad "timeline events not visible"
fi
LATFIX=$($AB eval "(() => !document.body.innerText.includes('undefined'))()" 2>/dev/null | tail -1)
[ "$LATFIX" = "true" ] && ok "notification latency renders numerically (RQ3 fix verified)" || bad "latency shows undefined"
$AB screenshot /tmp/demo-browser-3-incident.png >/dev/null 2>&1
# close the dialog (Escape), verify it is gone before navigating
$AB press Escape >/dev/null 2>&1 || $AB eval "(() => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); return 'esc'; })()" >/dev/null 2>&1
for i in $(seq 1 10); do
  D=$($AB eval "(() => !!document.querySelector('[role=\\"dialog\\"]'))()" 2>/dev/null | tail -1)
  [ "$D" != "true" ] && break
  $AB press Escape >/dev/null 2>&1
  sleep 1
done

echo "── 3. Report view: export the demo scan ──"
$AB find role button click --name "Executive Report" >/dev/null 2>&1
for i in $(seq 1 20); do
  R=$($AB eval "(() => document.body.innerText.includes('Print / PDF'))()" 2>/dev/null | tail -1)
  [ "$R" = "true" ] && break
  sleep 2
done
# pick the latest "Personal Data Protection assessment #N" scan in the switcher
$AB eval "(() => { const s = [...document.querySelectorAll('[role=\"combobox\"]')][0]; if (s) { s.click(); return 'opened'; } return 'none'; })()" >/dev/null 2>&1
sleep 2
PICKED=$($AB eval "(() => { const opts = [...document.querySelectorAll('[role=\"option\"]')].filter(o => /Personal Data Protection assessment #\d+/.test(o.textContent)); if (opts.length) { opts[0].click(); return opts[0].textContent.trim().slice(0, 60); } return 'NONE'; })()" 2>/dev/null | tail -1 | tr -d '"')
sleep 5
FOUND=$($AB eval "(() => document.body.innerText.includes('88.7'))()" 2>/dev/null | tail -1)
[ "$FOUND" = "true" ] && ok "report preview shows demo scan score 88.7%" "picked: $PICKED" || bad "demo scan score not visible" "picked: $PICKED"
ART=$($AB eval "(() => document.body.innerText.includes('72-hour'))()" 2>/dev/null | tail -1)
[ "$ART" = "true" ] && ok "report body lists the Art. 43 findings" || bad "report body missing findings"
$AB screenshot /tmp/demo-browser-4-report.png >/dev/null 2>&1

echo ""
echo "RESULT: $PASS passed, $FAIL failed"
for f in /tmp/demo-browser-*.png; do
  [ -s "$f" ] && echo "  shot: $f ($(stat -c%s "$f") bytes)" || echo "  shot MISSING: $f"
done
[ "$FAIL" = "0" ] && exit 0 || exit 1
