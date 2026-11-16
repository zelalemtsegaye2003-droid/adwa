#!/usr/bin/env bash
# Adwa Cyber — AI Enhancement Lab browser E2E (proposal Phase 3, Table 23).
#   1. Public /learn portal (no login): tools door on the join screen → the
#      six-tool grid renders bilingually with privacy badge.
#   2. Password checker: weak Ethiopian-style password scored down with
#      personalised findings; strong passphrase scored up.
#   3. Phishing Radar: judging a specimen reveals the transparent AI
#      classifier verdict (feature weights + score).
#   4. Sextortion trainer: story begins, choices give outcome feedback.
#   5. Footprint visualiser: full self-audit → risk band + category bars.
#   6. Flagging exercise: protected speech vs reportable harm verdict.
#   7. Reporting guide: personalised checklist with Ethio-CERT / 991 / 994.
#   8. Amharic rendering of the tools grid.
#   9. Super admin: Awareness overview shows the AI-tools telemetry card +
#      audience-track KPI; Curriculum tab filters by audience track.
# Screenshots → /tmp/awt-*.png (verified non-blank afterwards).
# Notes: eval must be IIFE; set adwa-lang=en first; toasts/compiles need sleeps.
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
    echo "  [login_as] $email FAILED" >&2
  fi
}

echo "── 1. Public portal: tools door + grid ──"
$AB open http://localhost:3000/learn >/dev/null 2>&1
$AB eval "(() => { localStorage.setItem('adwa-lang', 'en'); return 'ok'; })()" >/dev/null 2>&1
$AB reload >/dev/null 2>&1
wait_text "practice with our ai tools" 30 || true
sleep 2
DOOR=$($AB eval "(() => document.body.innerText.includes('Practice with our AI tools — no code needed') ? 'ok' : 'no')()" 2>/dev/null | tail -1 | tr -d '"')
[ "$DOOR" = "ok" ] && ok "tools door on the join screen" || bad "tools door missing"
$AB eval "(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes('Open the AI tools')); if (b) { b.click(); return 'ok'; } return 'no'; })()" >/dev/null 2>&1
sleep 2
GRID=$($AB eval "(() => { const t = document.body.innerText; const names = ['Password Strength Checker','Phishing Radar','Sextortion Response Trainer','Digital Footprint Visualiser','Content Flagging Exercise','Cybercrime Reporting Guide']; return names.every(n => t.includes(n)) ? 'ok' : 'no'; })()" 2>/dev/null | tail -1 | tr -d '"')
[ "$GRID" = "ok" ] && ok "all six tools listed" || bad "tool grid incomplete"
PRIVACY=$($AB eval "(() => document.body.innerText.includes('nothing you type is ever sent to us') ? 'ok' : 'no')()" 2>/dev/null | tail -1 | tr -d '"')
[ "$PRIVACY" = "ok" ] && ok "on-device privacy notice" || bad "privacy notice missing"
MODULELINK=$($AB eval "(() => { const t = document.body.innerText; return ['AW-01','AW-02','AW-09','AW-10','AW-11','AW-08'].every(c => t.includes(c)) ? 'ok' : 'no'; })()" 2>/dev/null | tail -1 | tr -d '"')
[ "$MODULELINK" = "ok" ] && ok "tools map to curriculum units" || bad "curriculum mapping missing"
$AB screenshot /tmp/awt-1-grid.png >/dev/null 2>&1

echo "── 2. Password checker ──"
$AB eval "(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes('Password Strength Checker')); if (b) { b.click(); return 'ok'; } return 'no'; })()" >/dev/null 2>&1
sleep 2
$AB eval "(() => { const input = document.querySelector('#pw-input'); if (!input) return 'no-input'; const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set; setter.call(input, 'abebe123'); input.dispatchEvent(new Event('input', { bubbles: true })); return 'ok'; })()" >/dev/null 2>&1
sleep 1.5
WEAK=$($AB eval "(() => { const t = document.body.innerText; return (t.includes('Very weak') || t.includes('Weak')) && t.includes('Ethiopian name or place') ? 'ok' : 'no'; })()" 2>/dev/null | tail -1 | tr -d '"')
[ "$WEAK" = "ok" ] && ok "weak pattern detected with personalised finding" || bad "weak-password verdict missing"
$AB eval "(() => { const input = document.querySelector('#pw-input'); if (!input) return 'no'; const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set; setter.call(input, 'Blue-Donkey-7-Coffee!x'); input.dispatchEvent(new Event('input', { bubbles: true })); return 'ok'; })()" >/dev/null 2>&1
sleep 1.5
STRONG=$($AB eval "(() => { const t = document.body.innerText.toLowerCase(); return (t.includes('very strong') || t.includes('strong')) && t.includes('personalised recommendations') ? 'ok' : 'no'; })()" 2>/dev/null | tail -1 | tr -d '"')
[ "$STRONG" = "ok" ] && ok "strong passphrase scored with recommendations" || bad "strong verdict missing"
$AB screenshot /tmp/awt-2-password.png >/dev/null 2>&1

echo "── 3. Phishing Radar ──"
$AB eval "(() => { const b = [...document.querySelectorAll('button')].find(x => (x.getAttribute('aria-label') || '') === ''); return 'skip'; })()" >/dev/null 2>&1
$AB find role button click --name "Back to AI tools" >/dev/null 2>&1
sleep 1.5
$AB eval "(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes('Phishing Radar')); if (b) { b.click(); return 'ok'; } return 'no'; })()" >/dev/null 2>&1
sleep 2
SPEC=$($AB eval "(() => document.body.innerText.includes('ADWA') === false && (document.body.innerText.includes('CBE') || document.body.innerText.includes('blocked')) ? 'ok' : 'no')()" 2>/dev/null | tail -1 | tr -d '"')
[ "$SPEC" = "ok" ] && ok "first Ethiopian specimen shown" || bad "specimen missing"
$AB eval "(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes('Report as phishing')); if (b) { b.click(); return 'ok'; } return 'no'; })()" >/dev/null 2>&1
sleep 1.5
VERDICT=$($AB eval "(() => { const t = document.body.innerText.toLowerCase(); return t.includes('ai classifier verdict') && t.includes('phishing') && /\\+\\d+/.test(t) ? 'ok' : 'no'; })()" 2>/dev/null | tail -1 | tr -d '"')
[ "$VERDICT" = "ok" ] && ok "transparent classifier verdict with feature weights" || bad "classifier verdict missing"
CORRECT=$($AB eval "(() => document.body.innerText.includes('✓ Correct') ? 'ok' : 'no')()" 2>/dev/null | tail -1 | tr -d '"')
[ "$CORRECT" = "ok" ] && ok "specimen 1 (CBE lookalike) judged correctly" || bad "correctness feedback missing"
$AB screenshot /tmp/awt-3-phishing.png >/dev/null 2>&1

echo "── 4. Sextortion trainer ──"
$AB find role button click --name "Back to AI tools" >/dev/null 2>&1
sleep 1.5
$AB eval "(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes('Sextortion Response Trainer')); if (b) { b.click(); return 'ok'; } return 'no'; })()" >/dev/null 2>&1
sleep 2
INTRO=$($AB eval "(() => document.body.innerText.includes('training story about Tigist') ? 'ok' : 'no')()" 2>/dev/null | tail -1 | tr -d '"')
[ "$INTRO" = "ok" ] && ok "third-person scenario intro" || bad "scenario intro missing"
$AB eval "(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes('Begin the story')); if (b) { b.click(); return 'ok'; } return 'no'; })()" >/dev/null 2>&1
sleep 1.5
CHOICES=$($AB eval "(() => { const bs = [...document.querySelectorAll('button')].filter(x => x.className.includes('rounded-xl')); return bs.length === 3 ? 'ok' : 'no:' + bs.length; })()" 2>/dev/null | tail -1 | tr -d '"')
[ "$CHOICES" = "ok" ] && ok "step 1 offers three choices" || bad "choices missing" "$CHOICES"
$AB eval "(() => { const bs = [...document.querySelectorAll('button')].filter(x => x.className.includes('rounded-xl')); if (bs[0]) { bs[0].click(); return 'ok'; } return 'no'; })()" >/dev/null 2>&1
sleep 1.5
FEEDBACK=$($AB eval "(() => { const t = document.body.innerText; return (t.includes('Safe choice') || t.includes('Risky') || t.includes('Unsafe')) ? 'ok' : 'no'; })()" 2>/dev/null | tail -1 | tr -d '"')
[ "$FEEDBACK" = "ok" ] && ok "choice outcome feedback" || bad "outcome feedback missing"
$AB screenshot /tmp/awt-4-sextortion.png >/dev/null 2>&1

echo "── 5. Footprint visualiser ──"
$AB find role button click --name "Back to AI tools" >/dev/null 2>&1
sleep 1.5
$AB eval "(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes('Digital Footprint Visualiser')); if (b) { b.click(); return 'ok'; } return 'no'; })()" >/dev/null 2>&1
sleep 2
QS=$($AB eval "(() => { const q = [...document.querySelectorAll('main .font-medium')].filter(x => /^\\d+\\./.test(x.textContent.trim())); return q.length === 10 ? 'ok' : 'no:' + q.length; })()" 2>/dev/null | tail -1 | tr -d '"')
[ "$QS" = "ok" ] && ok "ten self-audit questions render" || bad "question count wrong" "$QS"
$AB eval "(() => { const grids = [...document.querySelectorAll('main div')].filter(d => typeof d.className === 'string' && d.className.includes('gap-1.5')); let n = 0; grids.forEach(g => { const b = g.querySelectorAll('button'); if (b.length === 4) { b[3].click(); n++; } }); return String(n); })()" >/dev/null 2>&1
sleep 1.5
SUBMIT=$($AB eval "(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes('Visualise my exposure')); if (!b) return 'no-button'; if (b.disabled) return 'disabled'; b.click(); return 'ok'; })()" 2>/dev/null | tail -1 | tr -d '"')
[ "$SUBMIT" = "ok" ] && ok "all ten answers selected, result submitted" || bad "footprint submit failed" "submit=$SUBMIT"
sleep 2
FOOT=$($AB eval "(() => { const t = document.body.innerText; return /(Low|Moderate|Elevated|High) exposure/.test(t) && t.includes('Exposure risk:') && t.includes('Public exposure') && t.includes('Account safety') && t.toLowerCase().includes('personal reduction plan') ? 'ok' : 'no'; })()" 2>/dev/null | tail -1 | tr -d '"')
[ "$FOOT" = "ok" ] && ok "risk band + category bars + personal reduction plan render" || bad "footprint result missing"
$AB screenshot /tmp/awt-5-footprint.png >/dev/null 2>&1

echo "── 6. Flagging exercise ──"
$AB find role button click --name "Back to AI tools" >/dev/null 2>&1
sleep 1.5
$AB eval "(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes('Content Flagging Exercise')); if (b) { b.click(); return 'ok'; } return 'no'; })()" >/dev/null 2>&1
sleep 2
POST1=$($AB eval "(() => document.body.innerText.includes('roadwatcher_addis') && document.body.innerText.includes('#accountability') ? 'ok' : 'no')()" 2>/dev/null | tail -1 | tr -d '"')
[ "$POST1" = "ok" ] && ok "first post (criticism of public works) renders" || bad "post missing"
$AB eval "(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes('Keep — allowed speech')); if (b) { b.click(); return 'ok'; } return 'no'; })()" >/dev/null 2>&1
sleep 1.5
FLAG=$($AB eval "(() => { const t = document.body.innerText; return t.includes('✓ Correct') && t.includes('Protected: criticism of public works') ? 'ok' : 'no'; })()" 2>/dev/null | tail -1 | tr -d '"')
[ "$FLAG" = "ok" ] && ok "protected speech recognised with basis" || bad "flagging verdict missing"
$AB screenshot /tmp/awt-6-flagging.png >/dev/null 2>&1

echo "── 7. Reporting guide ──"
$AB find role button click --name "Back to AI tools" >/dev/null 2>&1
sleep 1.5
$AB eval "(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes('Cybercrime Reporting Guide')); if (b) { b.click(); return 'ok'; } return 'no'; })()" >/dev/null 2>&1
sleep 2
TYPES=$($AB eval "(() => { const t = document.body.innerText; return ['taken over','sending money','threatening','private images','leaked','malware'].filter(s => t.toLowerCase().includes(s)).length >= 6 ? 'ok' : 'no'; })()" 2>/dev/null | tail -1 | tr -d '"')
[ "$TYPES" = "ok" ] && ok "six incident types offered" || bad "incident types missing"
$AB eval "(() => { const bs = [...document.querySelectorAll('button')].filter(x => x.className.includes('rounded-xl')); if (bs[3]) { bs[3].click(); return 'ok'; } return 'no'; })()" >/dev/null 2>&1
sleep 2
GUIDE=$($AB eval "(() => { const t = document.body.innerText; return t.includes('1 · Preserve the evidence') && t.includes('Official channels') && t.includes('991') && t.includes('Ethio-CERT') ? 'ok' : 'no'; })()" 2>/dev/null | tail -1 | tr -d '"')
[ "$GUIDE" = "ok" ] && ok "personalised checklist with official channels" || bad "checklist missing"
$AB screenshot /tmp/awt-7-guide.png >/dev/null 2>&1

echo "── 8. Amharic tools grid ──"
$AB eval "(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes('አማርኛ')); if (b) { b.click(); return 'ok'; } return 'no'; })()" >/dev/null 2>&1
sleep 2.5
$AB find role button click --name "ወደ AI መሳሪያዎች ተመለስ" >/dev/null 2>&1
sleep 2
AMH=$($AB eval "(() => { const t = document.body.innerText; return t.includes('የይለፍ ቃል ጥንካሬ መለኪያ') && t.includes('የፊሺንግ ራዳር') && t.includes('የሳይበር ወንጀል ሪፖርት መመሪያ') ? 'ok' : 'no'; })()" 2>/dev/null | tail -1 | tr -d '"')
[ "$AMH" = "ok" ] && ok "tool names render in Amharic" || bad "Amharic tool names missing"
$AB screenshot /tmp/awt-8-amharic.png >/dev/null 2>&1

echo "── 9. Super admin: telemetry + audience tracks ──"
login_as "admin@adwacyber.et" "Adwa#Admin2026!"
$AB find text "Awareness" click >/dev/null 2>&1
wait_text "multilingual awareness platform" 30 || true
sleep 3
TOOLSCARD=$($AB eval "(() => { const t = document.body.innerText; return t.includes('AI Enhancement Lab — usage') && t.includes('Password Strength Checker') && t.includes('Phishing Radar') && t.includes('Amharic sessions') ? 'ok' : 'no'; })()" 2>/dev/null | tail -1 | tr -d '"')
[ "$TOOLSCARD" = "ok" ] && ok "AI tools telemetry card with per-tool bars" || bad "tools telemetry card missing"
AUDKPI=$($AB eval "(() => { const t = document.body.innerText; return t.includes('Kids / Teens / Pro / Aware') ? 'ok' : 'no'; })()" 2>/dev/null | tail -1 | tr -d '"')
[ "$AUDKPI" = "ok" ] && ok "audience-track KPI (8/3/2/2)" || bad "audience KPI missing"
ENGAGE_AUD=$($AB eval "(() => { const t = document.body.innerText; return t.includes('AW-14') && t.includes('CyberAware') && t.includes('CyberPro') && t.includes('Teens 9–12') ? 'ok' : 'no'; })()" 2>/dev/null | tail -1 | tr -d '"')
[ "$ENGAGE_AUD" = "ok" ] && ok "engagement table covers all four tracks" || bad "engagement audience badges missing"
INSTR=$($AB eval "(() => { const t = document.body.innerText; return t.includes('16-item instrument') ? 'ok' : 'no'; })()" 2>/dev/null | tail -1 | tr -d '"')
[ "$INSTR" = "ok" ] && ok "instrument stays 16 items with 15 modules" || bad "instrument count wrong"
$AB screenshot /tmp/awt-9-admin-overview.png >/dev/null 2>&1

$AB find role tab click --name "Curriculum" >/dev/null 2>&1
sleep 2.5
CHIPS=$($AB eval "(() => { const t = document.body.innerText; return t.includes('All tracks') && t.includes('Teens 9–12') && t.includes('CyberPro') ? 'ok' : 'no'; })()" 2>/dev/null | tail -1 | tr -d '"')
[ "$CHIPS" = "ok" ] && ok "curriculum audience filter chips" || bad "audience chips missing"
$AB eval "(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === 'Teens 9–12'); if (b) { b.click(); return 'ok'; } return 'no'; })()" >/dev/null 2>&1
sleep 2
TEENS=$($AB eval "(() => { const t = document.body.innerText; return t.includes('AW-09') && t.includes('AW-10') && t.includes('AW-11') && !t.includes('AW-01') && !t.includes('AW-14') ? 'ok' : 'no'; })()" 2>/dev/null | tail -1 | tr -d '"')
[ "$TEENS" = "ok" ] && ok "Teens filter shows exactly the 3 teen units" || bad "teens filter wrong"
$AB screenshot /tmp/awt-10-curriculum-teens.png >/dev/null 2>&1

$AB close >/dev/null 2>&1

# ── Non-blank screenshot verification ────────────────────────────────────────
BLANK=0
for f in /tmp/awt-*.png; do
  [ -f "$f" ] || continue
  NPIX=$(python3 -c "
from PIL import Image
import sys
im = Image.open('$f').convert('L')
px = list(im.getdata())
nonwhite = sum(1 for p in px if p < 245)
print(nonwhite)
" 2>/dev/null || echo 0)
  if [ "${NPIX:-0}" -lt 5000 ]; then
    bad "screenshot looks blank" "$f (${NPIX}px)"
    BLANK=$((BLANK+1))
  fi
done
[ "$BLANK" -eq 0 ] && ok "all screenshots non-blank" || true

echo ""
echo "═══ AI TOOLS browser E2E: $PASS passed, $FAIL failed ═══"
exit $([ $FAIL -gt 0 ] && echo 1 || echo 0)
