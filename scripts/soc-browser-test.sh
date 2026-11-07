#!/usr/bin/env bash
# Adwa Cyber — SOC / CERT-as-a-Service browser E2E (proposal Phase 2).
#   1. CBE admin: SOC page — Overview metrics (RQ3 median, pipeline, forecast,
#      sync panel), Incidents tab (queue, detail dialog, notify + lifecycle
#      advance), Threat Intel tab (hub, create indicator, report upward)
#   2. Super admin: platform incidents + national-feed ingest button
#   3. Amharic SOC strings render
# Screenshots → /tmp/soc-*.png (verified non-blank afterwards).
# Notes: eval must be IIFE (persistent JS scope); Radix widgets (tabs,
# selects) need role clicks with real pointer events; toasts need ~4s to clear.
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

echo "── 1. CBE admin: SOC overview ──"
login_as "admin@cbe.com.et" "Adwa#Demo2026!"
$AB find text "Security Operations" click >/dev/null 2>&1
wait_text "cert-as-a-service" 30 || wait_text "security operations centre" 30
SOC_HDR=$($AB eval "(() => document.body.innerText.includes('Security Operations Centre'))()" 2>/dev/null | tail -1)
[ "$SOC_HDR" = "true" ] && ok "SOC page renders" || bad "SOC page missing"
PHASE2=$($AB eval "(() => document.body.innerText.includes('CERT-as-a-Service pilot'))()" 2>/dev/null | tail -1)
[ "$PHASE2" = "true" ] && ok "Phase 2 pilot badge present" || bad "Phase 2 badge missing"
# Overview metrics: open incidents card + RQ3 median card
OPEN_CARD=$($AB eval "(() => { const p = [...document.querySelectorAll('p')].find(x => /open incidents/.test(x.textContent)); return p ? p.previousElementSibling?.textContent ?? 'NONE' : 'NONE'; })()" 2>/dev/null | tail -1 | tr -d '"')
[ "${OPEN_CARD:-x}" -ge 1 ] 2>/dev/null && ok "open incidents metric card" "n=$OPEN_CARD" || bad "open incidents card" "$OPEN_CARD"
RQ3_CARD=$($AB eval "(() => { const p = [...document.querySelectorAll('p')].find(x => /RQ3 target/.test(x.textContent)); return p ? p.textContent.trim() : 'NONE'; })()" 2>/dev/null | tail -1 | tr -d '"')
echo "$RQ3_CARD" | grep -q "15 min" && ok "RQ3 target card" "'$RQ3_CARD'" || bad "RQ3 card" "'$RQ3_CARD'"
MEDIAN_OK=$($AB eval "(() => { const cards = [...document.querySelectorAll('p')].filter(x => /median detection/i.test(x.textContent)); return cards.length > 0 ? 'ok' : 'no'; })()" 2>/dev/null | tail -1 | tr -d '"')
[ "$MEDIAN_OK" = "ok" ] && ok "median latency metric present" || bad "median latency missing"
TARGET_MET=$($AB eval "(() => document.body.innerText.toLowerCase().includes('target met'))()" 2>/dev/null | tail -1)
[ "$TARGET_MET" = "true" ] && ok "RQ3 'target met' state (median 8′ ≤ 15′)" || bad "RQ3 state wrong"
PIPELINE=$($AB eval "(() => document.body.innerText.includes('NIST SP 800-61'))()" 2>/dev/null | tail -1)
[ "$PIPELINE" = "true" ] && ok "NIST SP 800-61 pipeline panel" || bad "pipeline panel missing"
FORECAST=$($AB eval "(() => document.body.innerText.toLowerCase().includes('predictive threat forecast'))()" 2>/dev/null | tail -1)
[ "$FORECAST" = "true" ] && ok "predictive threat forecast panel" || bad "forecast panel missing"
SYNC_PANEL=$($AB eval "(() => document.body.innerText.includes('Ethio-CERT synchronisation'))()" 2>/dev/null | tail -1)
[ "$SYNC_PANEL" = "true" ] && ok "Ethio-CERT sync panel on overview" || bad "sync panel missing"
$AB screenshot /tmp/soc-1-overview.png >/dev/null 2>&1

echo "── 2. Incidents tab: queue + detail + notify + advance ──"
$AB find role tab click --name "Incidents" >/dev/null 2>&1
wait_text "inc-2026-" 30 || true
sleep 1.5
INC_ROWS=$($AB eval "(() => document.querySelectorAll('tbody tr').length)()" 2>/dev/null | tail -1 | tr -d '"')
[ "${INC_ROWS:-0}" -ge 4 ] && ok "incident queue rows" "n=$INC_ROWS" || bad "incident queue rows" "n=$INC_ROWS"
PRIORITY_HDR=$($AB eval "(() => [...document.querySelectorAll('th')].some(x => x.textContent.trim() === 'Priority'))()" 2>/dev/null | tail -1)
[ "$PRIORITY_HDR" = "true" ] && ok "priority column present" || bad "priority column missing"
RQ3_HDR=$($AB eval "(() => [...document.querySelectorAll('th')].some(x => x.textContent.trim() === 'RQ3 latency'))()" 2>/dev/null | tail -1)
[ "$RQ3_HDR" = "true" ] && ok "RQ3 latency column present" || bad "RQ3 latency column missing"
LATENCY_CHIP=$($AB eval "(() => { const b = [...document.querySelectorAll('td span, td div')].filter(x => /\\d+(\\.\\d+)? min/i.test(x.textContent)); return b.length ? b[0].textContent.trim().slice(0, 20) : 'NONE'; })()" 2>/dev/null | tail -1 | tr -d '"')
echo "$LATENCY_CHIP" | grep -qiE "min" && ok "notification latency chips render" "'$LATENCY_CHIP'" || bad "latency chips missing" "'$LATENCY_CHIP'"
$AB screenshot /tmp/soc-2-incidents.png >/dev/null 2>&1

# open the seeded un-notified ransomware incident (INC-2026-0006)
$AB find text "INC-2026-0006" click >/dev/null 2>&1
sleep 2
DIALOG_REF=$($AB eval "(() => { const h = [...document.querySelectorAll('[role=dialog] h2, [role=dialog] h3')]; const el = h.find(x => x.textContent.includes('INC-2026-0006')); return el ? 'ok' : 'no'; })()" 2>/dev/null | tail -1 | tr -d '"')
[ "$DIALOG_REF" = "ok" ] && ok "incident detail dialog opens" || bad "detail dialog missing"
TIMELINE=$($AB eval "(() => document.body.innerText.includes('Incident timeline'))()" 2>/dev/null | tail -1)
[ "$TIMELINE" = "true" ] && ok "timeline section present" || bad "timeline missing"
MATCHED=$($AB eval "(() => document.body.innerText.includes('Matched indicators'))()" 2>/dev/null | tail -1)
[ "$MATCHED" = "true" ] && ok "matched indicators section present" || bad "matched indicators missing"
IND_IN_DIALOG=$($AB eval "(() => document.body.innerText.includes('nta-update.exe'))()" 2>/dev/null | tail -1)
[ "$IND_IN_DIALOG" = "true" ] && ok "linked TLP:RED indicator shown in detail" || bad "linked indicator missing"
$AB screenshot /tmp/soc-3-detail.png >/dev/null 2>&1

# notify the organisation (RQ3 flow)
$AB find role button click --name "Notify organisation" >/dev/null 2>&1
sleep 4
NOTIFIED_CHIP=$($AB eval "(() => { const dlg = document.querySelector('[role=dialog]'); return dlg && dlg.textContent.includes('Notified:') ? 'ok' : 'no'; })()" 2>/dev/null | tail -1 | tr -d '"')
[ "$NOTIFIED_CHIP" = "ok" ] && ok "notify stamps 'Notified:' + latency" || bad "notify chip missing"
NOTIFY_EVENT=$($AB eval "(() => { const dlg = document.querySelector('[role=dialog]'); return dlg && dlg.textContent.toLowerCase().includes('notified') && /latency/i.test(dlg.textContent) ? 'ok' : 'no'; })()" 2>/dev/null | tail -1 | tr -d '"')
[ "$NOTIFY_EVENT" = "ok" ] && ok "NOTIFIED timeline event visible" || bad "NOTIFIED event missing"
# advance detected → triaged
$AB find role button click --name "Advance to Triaged" >/dev/null 2>&1
sleep 4
ADVANCED=$($AB eval "(() => { const dlg = document.querySelector('[role=dialog]'); return dlg && dlg.textContent.includes('Triaged') ? 'ok' : 'no'; })()" 2>/dev/null | tail -1 | tr -d '"')
[ "$ADVANCED" = "ok" ] && ok "lifecycle advance detected → triaged" || bad "advance failed"
NEXT_BTN=$($AB eval "(() => { const dlg = document.querySelector('[role=dialog]'); return dlg && dlg.textContent.includes('Advance to Contained') ? 'ok' : 'no'; })()" 2>/dev/null | tail -1 | tr -d '"')
[ "$NEXT_BTN" = "ok" ] && ok "next-step button updates (→ Contained)" || bad "next-step button wrong"
$AB press Escape >/dev/null 2>&1
sleep 1
$AB screenshot /tmp/soc-4-notified.png >/dev/null 2>&1

echo "── 3. Threat Intel tab: hub + contribute + report upward ──"
$AB find role tab click --name "Threat Intel" >/dev/null 2>&1
wait_text "threat intelligence hub" 30 || true
sleep 1.5
TI_ROWS=$($AB eval "(() => document.querySelectorAll('tbody tr').length)()" 2>/dev/null | tail -1 | tr -d '"')
[ "${TI_ROWS:-0}" -ge 9 ] && ok "threat hub rows (feed + members)" "n=$TI_ROWS" || bad "threat hub rows" "n=$TI_ROWS"
NATIONAL=$($AB eval "(() => [...document.querySelectorAll('tbody td')].some(td => td.textContent.trim() === 'Ethio-CERT'))()" 2>/dev/null | tail -1)
[ "$NATIONAL" = "true" ] && ok "Ethio-CERT national-feed source badges" || bad "national feed badges missing"
TLP_BADGE=$($AB eval "(() => document.body.innerText.includes('TLP:RED'))()" 2>/dev/null | tail -1)
[ "$TLP_BADGE" = "true" ] && ok "TLP markings render" || bad "TLP markings missing"
OWN_ORIGIN=$($AB eval "(() => document.body.innerText.includes('Commercial Bank of Ethiopia'))()" 2>/dev/null | tail -1)
[ "$OWN_ORIGIN" = "true" ] && ok "own contributed indicator shows owner identity" || bad "owner identity missing on own indicator"
$AB screenshot /tmp/soc-5-threats.png >/dev/null 2>&1

# contribute an indicator
TEST_DOM="soc-e2e-$(date +%s).example.org"
$AB find role button click --name "Contribute indicator" >/dev/null 2>&1
sleep 1.5
VR=$($AB snapshot -i 2>/dev/null | grep -m1 'textbox "Value"')
TR=$(ref_of "$(echo "$VR")")
$AB fill @$TR "$TEST_DOM" >/dev/null 2>&1
TT=$($AB snapshot -i 2>/dev/null | grep -m1 'textbox "Title (English)"')
TR2=$(ref_of "$(echo "$TT")")
$AB fill @$TR2 "Browser E2E contributed indicator" >/dev/null 2>&1
$AB find role button click --name "Save" >/dev/null 2>&1
sleep 4.5
NEW_ROW=$($AB eval "(() => document.body.innerText.includes('$TEST_DOM') ? 'ok' : 'no')()" 2>/dev/null | tail -1 | tr -d '"')
[ "$NEW_ROW" = "ok" ] && ok "contributed indicator appears in hub" "$TEST_DOM" || bad "contributed indicator missing"
$AB screenshot /tmp/soc-6-contributed.png >/dev/null 2>&1

# report upward (anonymised) — toast carries the exchange receipt (LIVE
# binding) or the sha256 hash prefix (pilot fixture, no exchange configured)
$AB find role button click --name "Report upward (anonymised)" >/dev/null 2>&1
sleep 2.5
REPORTED=$($AB eval "(() => { const t = [...document.querySelectorAll('[data-sonner-toast], [role=status], body')]; const all = t.map(x => x.textContent).join(' '); return /sha256 [a-f0-9]{6,}/i.test(all) || /EC-RCPT-[A-Z0-9]+/.test(all) ? 'ok' : 'no'; })()" 2>/dev/null | tail -1 | tr -d '"')
[ "$REPORTED" = "ok" ] && ok "upward report toast with receipt/sha256" || bad "upward report toast missing"
$AB screenshot /tmp/soc-7-report.png >/dev/null 2>&1

echo "── 4. Wasasa admin: peer share + anonymised hub origin ──"
login_as "admin@wasasa.et" "Adwa#Demo2026!"
$AB find text "Security Operations" click >/dev/null 2>&1
wait_text "security operations centre" 30 || true
$AB find role tab click --name "Threat Intel" >/dev/null 2>&1
sleep 2.5
PEER_VISIBLE=$($AB eval "(() => document.body.innerText.includes('ceo-office.disbursements@mail-secure.cf'))()" 2>/dev/null | tail -1)
[ "$PEER_VISIBLE" = "true" ] && ok "peer-shared P2P indicator visible to the trusted partner" || bad "peer-shared indicator missing for Wasasa"
PEER_IDENTITY=$($AB eval "(() => { const rows = [...document.querySelectorAll('tbody tr')]; const row = rows.find(r => r.textContent.includes('ceo-office.disbursements')); return row && row.textContent.includes('Dashen Bank') ? 'ok' : 'no'; })()" 2>/dev/null | tail -1 | tr -d '"')
[ "$PEER_IDENTITY" = "ok" ] && ok "peer share reveals the reporter identity (Dashen)" || bad "peer share identity missing"
ANON=$($AB eval "(() => document.body.innerText.toLowerCase().includes('anonymised origin'))()" 2>/dev/null | tail -1)
[ "$ANON" = "true" ] && ok "hub indicators from other orgs show anonymised origin" || bad "anonymised origin missing"
$AB screenshot /tmp/soc-8-wasasa.png >/dev/null 2>&1

echo "── 5. Super admin: platform incidents + national feed ingest ──"
login_as "admin@adwacyber.et" "Adwa#Admin2026!"
$AB find text "Security Operations" click >/dev/null 2>&1
wait_text "security operations centre" 30 || true
sleep 1.5
PLATFORM_SCOPE=$($AB eval "(() => document.body.innerText.includes('Incidents total') || document.querySelectorAll('p').length > 0 ? 'ok' : 'no')()" 2>/dev/null | tail -1 | tr -d '"')
$AB find role tab click --name "Incidents" >/dev/null 2>&1
sleep 2.5
PLATFORM_ORG_COL=$($AB eval "(() => [...document.querySelectorAll('th')].some(x => x.textContent.trim() === 'Organization') && document.body.innerText.includes('Commercial Bank of Ethiopia'))()" 2>/dev/null | tail -1)
[ "$PLATFORM_ORG_COL" = "true" ] && ok "super sees platform-wide incidents (org column)" || bad "platform scope missing"
$AB find role tab click --name "Threat Intel" >/dev/null 2>&1
sleep 2
INGEST_BTN=$($AB eval "(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes('Pull national feed')); return b ? 'ok' : 'no'; })()" 2>/dev/null | tail -1 | tr -d '"')
[ "$INGEST_BTN" = "ok" ] && ok "ingest button visible for super admin" || bad "ingest button missing"
$AB find role button click --name "Pull national feed" >/dev/null 2>&1
sleep 2.5
INGEST_TOAST=$($AB eval "(() => { const all = [...document.querySelectorAll('[data-sonner-toast], [role=status], body')].map(x => x.textContent).join(' '); return /\\d+ new/i.test(all) ? 'ok' : 'no'; })()" 2>/dev/null | tail -1 | tr -d '"')
[ "$INGEST_TOAST" = "ok" ] && ok "ingest toast shows dedupe counts" || bad "ingest toast missing"
$AB screenshot /tmp/soc-9-super.png >/dev/null 2>&1

echo "── 6. Amharic SOC strings ──"
$AB eval "(() => { const b = document.querySelector('button[aria-label=\"Language\"], button[aria-label=\"ቋንቋ\"]'); if (b) b.click(); return 'ok'; })()" >/dev/null 2>&1
sleep 2
AMH=$($AB eval "(() => document.body.innerText.includes('የደህንነት ሥራ ማዕከል') || document.body.innerText.includes('የስጋት መረጃ ማዕከል') || document.body.innerText.includes('ክፍት ክስተቶች'))()" 2>/dev/null | tail -1)
[ "$AMH" = "true" ] && ok "Amharic SOC strings render" || bad "Amharic SOC strings missing"
$AB screenshot /tmp/soc-10-amharic.png >/dev/null 2>&1

$AB close >/dev/null 2>&1
echo ""
echo "═══ SOC browser E2E: $PASS passed, $FAIL failed ═══"
exit $([ $FAIL -gt 0 ] && echo 1 || echo 0)
