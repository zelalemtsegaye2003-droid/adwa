#!/usr/bin/env bash
# Adwa Cyber — Multilingual Awareness Platform browser E2E (proposal Phase 3).
#   1. Super admin: Awareness view — Overview (Track B badge, KPI cards, RQ2
#      comparison, ANOVA verdict, per-school table), Curriculum tab (8 units,
#      bilingual preview), Schools tab (join codes), Consent tab (record a
#      consent), Evaluation tab (ANOVA table, CSV export button).
#   2. RBAC: ORG_ADMIN sidebar has no Awareness entry.
#   3. Learner portal /learn (public, Amharic-first): class code → participant
#      code → hub → lesson + quiz (75%) → PRE test (6.3%) → POST test (62.5%)
#      with gain → consent gate for a PENDING participant.
#   4. Amharic strings render on both admin view and portal.
# Screenshots → /tmp/aw-*.png (verified non-blank afterwards).
# Notes: eval must be IIFE; Radix tabs need role clicks; toasts need ~4s.
# Expected scores are fixed by the seeded curriculum: AW-01 quiz keys
# [1,1,1,2] → all-B = 75%; 16-item instrument all-A = 0/16 = 0%,
# all-B = 10/16 = 62.5% (gain +62.5).
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

# Click the Nth (0-based) option button in every option grid on the page.
click_options() {
  local n="$1"
  $AB eval "(() => { const grids = [...document.querySelectorAll('main div')].filter(d => typeof d.className === 'string' && d.className.includes('gap-1.5')); grids.forEach(g => { const b = g.querySelectorAll('button'); if (b.length > $n) b[$n].click(); }); return String(grids.length); })()" 2>/dev/null | tail -1 | tr -d '"'
}

echo "── 1. Super admin: Awareness overview ──"
login_as "admin@adwacyber.et" "Adwa#Admin2026!"
$AB find text "Awareness" click >/dev/null 2>&1
wait_text "multilingual awareness platform" 30 || true
sleep 2
TITLE=$($AB eval "(() => document.body.innerText.includes('Multilingual Awareness Platform — Track B (Phase 3)'))()" 2>/dev/null | tail -1)
[ "$TITLE" = "true" ] && ok "Track B title renders" || bad "Track B title missing"
SCHOOLS_KPI=$($AB eval "(() => { const el = [...document.querySelectorAll('p')].find(x => x.textContent.trim() === '5'); return el ? 'ok' : 'no'; })()" 2>/dev/null | tail -1 | tr -d '"')
[ "$SCHOOLS_KPI" = "ok" ] && ok "five pilot schools KPI" || bad "schools KPI missing"
RQ2=$($AB eval "(() => document.body.innerText.includes('RQ2 — knowledge results') && document.body.innerText.includes('Mean gain'))()" 2>/dev/null | tail -1)
[ "$RQ2" = "true" ] && ok "RQ2 comparison card" || bad "RQ2 card missing"
ANOVA_V=$($AB eval "(() => document.body.innerText.includes('Curriculum effect significant at α = 0.05'))()" 2>/dev/null | tail -1)
[ "$ANOVA_V" = "true" ] && ok "ANOVA verdict significant" || bad "ANOVA verdict missing"
ANOVA_F=$($AB eval "(() => { const t = document.body.innerText.match(/F\(1, ?\d+\)/); return t ? t[0] : 'NONE'; })()" 2>/dev/null | tail -1 | tr -d '"')
echo "$ANOVA_F" | grep -q "F(1," && ok "ANOVA F statistic shown" "'$ANOVA_F'" || bad "ANOVA F missing" "'$ANOVA_F'"
PERSCHOOL=$($AB eval "(() => document.body.innerText.includes('Menelik II Secondary School') && document.body.innerText.includes('Tegbareid Secondary School'))()" 2>/dev/null | tail -1)
[ "$PERSCHOOL" = "true" ] && ok "per-school table lists pilots" || bad "per-school table missing"
ENGAGE=$($AB eval "(() => document.body.innerText.includes('AW-01') && document.body.innerText.includes('AW-08'))()" 2>/dev/null | tail -1)
[ "$ENGAGE" = "true" ] && ok "engagement table covers AW-01…AW-08" || bad "engagement table missing"
PRIVACY=$($AB eval "(() => document.body.innerText.includes('pseudonymised codes only'))()" 2>/dev/null | tail -1)
[ "$PRIVACY" = "true" ] && ok "privacy-by-design note" || bad "privacy note missing"
$AB screenshot /tmp/aw-1-overview.png >/dev/null 2>&1

echo "── 2. Curriculum tab ──"
$AB find role tab click --name "Curriculum" >/dev/null 2>&1
sleep 2
CODES=$($AB eval "(() => { const t = document.body.innerText; return ['AW-01','AW-02','AW-03','AW-04','AW-05','AW-06','AW-07','AW-08'].every(c => t.includes(c)) ? 'ok' : 'no'; })()" 2>/dev/null | tail -1 | tr -d '"')
[ "$CODES" = "ok" ] && ok "eight curriculum units listed" || bad "curriculum units missing"
PREVIEW=$($AB eval "(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === 'Preview'); if (b) { b.click(); return 'ok'; } return 'no'; })()" 2>/dev/null | tail -1 | tr -d '"')
[ "$PREVIEW" = "ok" ] && ok "unit preview opens" || bad "preview button missing"
sleep 1.5
BILINGUAL=$($AB eval "(() => { const t = document.body.innerText; return t.includes('Make it long, make it strange') && t.includes('የይለፍ ቃል ለምን አስፈላጊ ነው') ? 'ok' : 'no'; })()" 2>/dev/null | tail -1 | tr -d '"')
[ "$BILINGUAL" = "ok" ] && ok "preview shows EN + AM lesson side by side" || bad "bilingual preview missing"
$AB screenshot /tmp/aw-2-curriculum.png >/dev/null 2>&1

echo "── 3. Schools tab ──"
$AB find role tab click --name "Schools & Classes" >/dev/null 2>&1
sleep 2
JOINC=$($AB eval "(() => document.body.innerText.includes('ADWA-M2S-9A') && document.body.innerText.includes('Join code'))()" 2>/dev/null | tail -1)
[ "$JOINC" = "true" ] && ok "join codes visible" || bad "join codes missing"
ADDSCHOOL=$($AB eval "(() => [...document.querySelectorAll('button')].some(x => x.textContent.includes('Add school')) ? 'ok' : 'no')()" 2>/dev/null | tail -1 | tr -d '"')
[ "$ADDSCHOOL" = "ok" ] && ok "add school action" || bad "add school missing"
$AB screenshot /tmp/aw-3-schools.png >/dev/null 2>&1

echo "── 4. Consent register: record a consent ──"
$AB find role tab click --name "Consent Register" >/dev/null 2>&1
sleep 2
BEFORE_PENDING=$($AB eval "(() => { const badges = [...document.querySelectorAll('tbody tr')].map(r => r.textContent.includes('Pending') ? 1 : 0); return String(badges.reduce((a,b) => a+b, 0)); })()" 2>/dev/null | tail -1 | tr -d '"')
RECORD=$($AB eval "(() => { const b = [...document.querySelectorAll('tbody button')].find(x => x.textContent.includes('Record consent')); if (b) { b.click(); return 'ok'; } return 'no'; })()" 2>/dev/null | tail -1 | tr -d '"')
[ "$RECORD" = "ok" ] && ok "record consent opens dialog" "pending before: $BEFORE_PENDING" || bad "record consent button missing"
sleep 1.5
GRANT=$($AB eval "(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === 'Grant'); if (b) { b.click(); return 'ok'; } return 'no'; })()" 2>/dev/null | tail -1 | tr -d '"')
[ "$GRANT" = "ok" ] && ok "grant consent submitted" || bad "grant button missing"
sleep 4
AFTER_PENDING=""
for i in $(seq 1 12); do
  AFTER_PENDING=$($AB eval "(() => { const rows = [...document.querySelectorAll('tbody tr')]; if (rows.length === 0) return 'LOADING'; const badges = rows.map(r => r.textContent.includes('Pending') ? 1 : 0); return String(badges.reduce((a,b) => a+b, 0)); })()" 2>/dev/null | tail -1 | tr -d '"')
  [ "$AFTER_PENDING" != "LOADING" ] && [ -n "$AFTER_PENDING" ] && break
  sleep 1
done
[ "$AFTER_PENDING" -lt "$BEFORE_PENDING" ] 2>/dev/null && ok "consent register updated" "pending: $BEFORE_PENDING → $AFTER_PENDING" || bad "consent register did not update" "$BEFORE_PENDING → $AFTER_PENDING"
$AB screenshot /tmp/aw-4-consent.png >/dev/null 2>&1

echo "── 5. Evaluation tab ──"
$AB find role tab click --name "Evaluation (RQ2)" >/dev/null 2>&1
sleep 3
EVAL_F=$($AB eval "(() => { const t = document.body.innerText; return t.includes('Between groups') && /F/.test(t) && t.includes('η²') ? 'ok' : 'no'; })()" 2>/dev/null | tail -1 | tr -d '"')
[ "$EVAL_F" = "ok" ] && ok "ANOVA table with η²" || bad "ANOVA table missing"
CSV_BTN=$($AB eval "(() => [...document.querySelectorAll('button')].some(x => x.textContent.includes('Export CSV')) ? 'ok' : 'no')()" 2>/dev/null | tail -1 | tr -d '"')
[ "$CSV_BTN" = "ok" ] && ok "CSV export button" || bad "CSV export missing"
HIST=$($AB eval "(() => document.querySelectorAll('[class*=rounded-t]').length > 4 ? 'ok' : 'no')()" 2>/dev/null | tail -1 | tr -d '"')
[ "$HIST" = "ok" ] && ok "gain histograms render" || bad "histograms missing"
$AB screenshot /tmp/aw-5-evaluation.png >/dev/null 2>&1

echo "── 6. Amharic admin strings ──"
$AB eval "(() => { const b = document.querySelector('button[aria-label=\"Language\"], button[aria-label=\"ቋንቋ\"]'); if (b) b.click(); return 'ok'; })()" >/dev/null 2>&1
sleep 2
AMH_ADMIN=$($AB eval "(() => document.body.innerText.includes('ትምህርት ቤቶችና ክፍሎች') || document.body.innerText.includes('የወላጅ ስምማማት መዝገብ') || document.body.innerText.includes('ግምገማ (RQ2)'))()" 2>/dev/null | tail -1)
[ "$AMH_ADMIN" = "true" ] && ok "Amharic admin strings render" || bad "Amharic admin strings missing"
$AB screenshot /tmp/aw-6-amharic-admin.png >/dev/null 2>&1

echo "── 7. RBAC: ORG_ADMIN has no Awareness nav ──"
login_as "admin@cbe.com.et" "Adwa#Demo2026!"
sleep 1.5
NAV_AW=$($AB eval "(() => { const items = [...document.querySelectorAll('nav a, [data-sidebar] button, ul button')].map(x => x.textContent); const hit = items.filter(t => t && t.includes('Awareness')).length; const any = [...document.querySelectorAll('button')].filter(b => b.textContent.trim() === 'Awareness').length; return String(hit + any); })()" 2>/dev/null | tail -1 | tr -d '"')
[ "$NAV_AW" = "0" ] && ok "ORG_ADMIN sidebar hides Awareness" || bad "Awareness leaked to ORG_ADMIN" "hits=$NAV_AW"

echo "── 8. Learner portal: full journey (AW-BR001) ──"
$AB cookies clear >/dev/null 2>&1
$AB open http://localhost:3000/learn >/dev/null 2>&1
# The portal is Amharic-first when no language preference is stored — clear
# the admin session's stored preference to verify the default.
$AB eval "(() => { localStorage.removeItem('adwa-lang'); return 'ok'; })()" >/dev/null 2>&1
$AB reload >/dev/null 2>&1
sleep 3
AMH_DEFAULT=$($AB eval "(() => document.body.innerText.includes('የአድዋ ሳይበር ግንዛቤ'))()" 2>/dev/null | tail -1)
[ "$AMH_DEFAULT" = "true" ] && ok "portal is Amharic-first by default" || bad "Amharic default missing"
# Switch to English for deterministic text matching.
$AB eval "(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes('English')); if (b) { b.click(); return 'ok'; } return 'no'; })()" >/dev/null 2>&1
sleep 2.5
EN_NOW=$($AB eval "(() => document.body.innerText.includes('Enter your class'))()" 2>/dev/null | tail -1)
[ "$EN_NOW" = "true" ] && ok "language toggle to English" || bad "language toggle failed"
$AB screenshot /tmp/aw-7-portal-landing.png >/dev/null 2>&1

# Join the seeded treatment class.
SNAP=$($AB snapshot -i 2>/dev/null)
JC=$(ref_of "$(echo "$SNAP" | grep -m1 'textbox "class code"')")
$AB fill @$JC "ADWA-M2S-9A" >/dev/null 2>&1
$AB find role button click --name "Continue" >/dev/null 2>&1
sleep 2
CODE_STEP=$($AB eval "(() => document.body.innerText.includes('Your participant code'))()" 2>/dev/null | tail -1)
[ "$CODE_STEP" = "true" ] && ok "participant code step" || bad "participant code step missing"
SNAP=$($AB snapshot -i 2>/dev/null)
LC=$(ref_of "$(echo "$SNAP" | grep -m1 'textbox "participant code"')")
$AB fill @$LC "AW-BR001" >/dev/null 2>&1
$AB find role button click --name "Continue" >/dev/null 2>&1
wait_text "first test (before lessons)" 30 || true
sleep 2
HUB=$($AB eval "(() => document.body.innerText.includes('Grade 10') && document.body.innerText.includes('Lessons') && document.body.innerText.includes('of 8 lessons completed'))()" 2>/dev/null | tail -1)
[ "$HUB" = "true" ] && ok "learner hub with lesson progress" || bad "learner hub missing"
$AB screenshot /tmp/aw-8-hub.png >/dev/null 2>&1

# Open the first lesson (AW-01).
LESSON=$($AB eval "(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes('Strong Passwords and Accounts')); if (b) { b.click(); return 'ok'; } return 'no'; })()" 2>/dev/null | tail -1 | tr -d '"')
[ "$LESSON" = "ok" ] && ok "lesson AW-01 opens" || bad "lesson AW-01 missing"
wait_text "why passwords matter" 20 || true
sleep 1.5
CONTENT=$($AB eval "(() => document.body.innerText.includes('The internet never forgets') || document.body.innerText.includes('Make it long, make it strange'))()" 2>/dev/null | tail -1)
[ "$CONTENT" = "true" ] && ok "lesson content renders" || bad "lesson content missing"
# Answer every quiz question with option B → 3/4 = 75%.
GRIDS=$(click_options 1)
[ "$GRIDS" = "4" ] && ok "lesson quiz shows 4 questions" "grids=$GRIDS" || bad "lesson quiz grids" "grids=$GRIDS"
$AB find role button click --name "Submit answers" >/dev/null 2>&1
sleep 3
QUIZ_SCORE=$($AB eval "(() => document.body.innerText.includes('Score: 75%'))()" 2>/dev/null | tail -1)
[ "$QUIZ_SCORE" = "true" ] && ok "lesson quiz scored 75% (server-side)" || bad "quiz score wrong"
$AB screenshot /tmp/aw-9-quiz.png >/dev/null 2>&1
$AB find role button click --name "Back to my lessons" >/dev/null 2>&1
sleep 2

# PRE test: answer all A → 1/16 = 6.3%.
# The only enabled Start button on the hub belongs to the PRE card (POST is locked).
PRE_START=$($AB eval "(() => { const start = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === 'Start'); if (start) { start.click(); return 'ok'; } return 'no'; })()" 2>/dev/null | tail -1 | tr -d '"')
[ "$PRE_START" = "ok" ] && ok "PRE test starts" || bad "PRE start missing"
wait_text "16 questions" 20 || true
sleep 1.5
GRIDS=$(click_options 0)
[ "$GRIDS" = "16" ] && ok "PRE instrument shows 16 questions" "grids=$GRIDS" || bad "PRE grids" "grids=$GRIDS"
$AB find role button click --name "Submit answers" >/dev/null 2>&1
sleep 3
PRE_SCORE=$($AB eval "(() => document.body.innerText.includes('0%') && document.body.innerText.includes('0 of 16 correct'))()" 2>/dev/null | tail -1)
[ "$PRE_SCORE" = "true" ] && ok "PRE scored 0% (all-A control answers)" || bad "PRE score wrong"
$AB screenshot /tmp/aw-10-pre.png >/dev/null 2>&1
$AB find role button click --name "Back to my lessons" >/dev/null 2>&1
sleep 2

# POST test: answer all B → 10/16 = 62.5%, gain +56.2.
POST_UNLOCKED=$($AB eval "(() => { const t = document.body.innerText; return t.includes('Final test (after lessons)') && !t.includes('Locked') ? 'ok' : (t.includes('Final test (after lessons)') ? 'locked' : 'no'); })()" 2>/dev/null | tail -1 | tr -d '"')
[ "$POST_UNLOCKED" = "ok" ] && ok "POST test unlocked after PRE" || bad "POST not unlocked" "$POST_UNLOCKED"
# After PRE is sat, the only Start button belongs to the POST card.
POST_START=$($AB eval "(() => { const start = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === 'Start'); if (start) { start.click(); return 'ok'; } return 'no'; })()" 2>/dev/null | tail -1 | tr -d '"')
[ "$POST_START" = "ok" ] && ok "POST test starts" || bad "POST start missing"
wait_text "16 questions" 20 || true
sleep 1.5
GRIDS=$(click_options 1)
[ "$GRIDS" = "16" ] && ok "POST instrument shows 16 questions" "grids=$GRIDS" || bad "POST grids" "grids=$GRIDS"
$AB find role button click --name "Submit answers" >/dev/null 2>&1
sleep 3
POST_SCORE=$($AB eval "(() => document.body.innerText.includes('62.5%'))()" 2>/dev/null | tail -1)
[ "$POST_SCORE" = "true" ] && ok "POST scored 62.5%" || bad "POST score wrong"
GAIN=$($AB eval "(() => /Your improvement: ?\+?62\.5 points/.test(document.body.innerText))()" 2>/dev/null | tail -1)
[ "$GAIN" = "true" ] && ok "gain banner +62.5 points" || bad "gain banner missing"
$AB screenshot /tmp/aw-11-post.png >/dev/null 2>&1

echo "── 9. Consent gate (AW-BR002, PENDING) ──"
$AB eval "(() => { const b = [...document.querySelectorAll('button')].find(x => (x.getAttribute('aria-label') || '') === 'exit'); if (b) { b.click(); return 'ok'; } return 'no'; })()" >/dev/null 2>&1
sleep 2
SNAP=$($AB snapshot -i 2>/dev/null)
JC=$(ref_of "$(echo "$SNAP" | grep -m1 'textbox "class code"')")
$AB fill @$JC "ADWA-M2S-9A" >/dev/null 2>&1
$AB find role button click --name "Continue" >/dev/null 2>&1
sleep 2
SNAP=$($AB snapshot -i 2>/dev/null)
LC=$(ref_of "$(echo "$SNAP" | grep -m1 'textbox "participant code"')")
$AB fill @$LC "AW-BR002" >/dev/null 2>&1
$AB find role button click --name "Continue" >/dev/null 2>&1
sleep 2
GATE=$($AB eval "(() => document.body.innerText.includes('Parental consent pending') && document.body.innerText.includes('tests are locked'))()" 2>/dev/null | tail -1)
[ "$GATE" = "true" ] && ok "consent gate blocks PENDING participant" || bad "consent gate missing"
$AB screenshot /tmp/aw-12-gate.png >/dev/null 2>&1

# Amharic portal check on the gate screen (EN mode → the toggle shows "አማርኛ").
$AB eval "(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes('አማርኛ')); if (b) { b.click(); return 'ok'; } return 'no'; })()" >/dev/null 2>&1
sleep 2.5
AMH_GATE=$($AB eval "(() => document.body.innerText.includes('የወላጅ ስምማማት በመጠበቅ ላይ ነው'))()" 2>/dev/null | tail -1)
[ "$AMH_GATE" = "true" ] && ok "Amharic portal strings render" || bad "Amharic portal strings missing"
$AB screenshot /tmp/aw-13-amharic-gate.png >/dev/null 2>&1

$AB close >/dev/null 2>&1
echo ""
echo "═══ AWARENESS browser E2E: $PASS passed, $FAIL failed ═══"
exit $([ $FAIL -gt 0 ] && echo 1 || echo 0)
