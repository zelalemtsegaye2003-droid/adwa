#!/usr/bin/env bash
# UI audit against the ALREADY-RUNNING dev server on :3000 (Next 16 refuses a second dev server).
set -uo pipefail
cd /home/z/my-project
PORT=3000
OUT=/tmp/shots
mkdir -p $OUT; rm -f $OUT/*.png
ab() { agent-browser "$@" 2>&1; }
getref() { echo "$1" | grep -F -- "$2" | grep -o "ref=e[0-9]*" | head -1 | cut -d= -f2; }
snap() { agent-browser snapshot -i 2>&1; }
ab set viewport 1440 900 >/dev/null
ab open http://localhost:$PORT/ >/dev/null; sleep 3
S=$(snap); DEMO=$(getref "$S" 'Demo accounts')
ab click @$DEMO >/dev/null; sleep 1
S=$(snap); ADMIN=$(getref "$S" 'Platform Super Admin')
ab click @$ADMIN >/dev/null; sleep 1
CAP=$(ab eval "decodeURIComponent(document.querySelector('img[src^=data]').src).match(/<text[^>]*>[^<]*<\/text>/g).map(t=>{const m=t.match(/x=\\\"([0-9.]+)\\\"/);return {ch:t.match(/>([^<]*)</)[1], x:parseFloat(m[1])}}).sort((a,b)=>a.x-b.x).map(o=>o.ch).join('')" | tr -d '"')
S=$(snap); SEC=$(getref "$S" 'textbox "Security check"')
SIGN=$(getref "$S" 'button "Sign in"')
ab fill @$SEC "$CAP" >/dev/null
ab click @$SIGN >/dev/null; sleep 6
echo "login: $(ab eval "document.body.innerText.slice(0,40)" | tr -d '"')"
ab screenshot $OUT/00-dashboard.png >/dev/null
S=$(snap); VAPT=$(getref "$S" '"VAPT Center"')
ab click @$VAPT >/dev/null; sleep 5
ab screenshot --full $OUT/01-vapt-overview.png >/dev/null
echo "vapt overview captured"
S=$(snap)
for T in "Assets & Attack Surface" "Scans" "Vulnerabilities" "Scopes & Authorization" "EASM Discovery" "AD Attack Paths" "Bid Matrix"; do
  R=$(getref "$S" "\"$T\"")
  if [ -n "$R" ]; then
    ab click @$R >/dev/null; sleep 4
    N=$(echo "$T" | tr -cd '[:alnum:]' | cut -c1-20)
    ab screenshot --full $OUT/02-vapt-$N.png >/dev/null
    echo "  ok: $T"
    S=$(snap)
  else
    echo "  MISSING: $T"
  fi
done
for V in "Findings" "Security Operations" "Awareness" "Track C Gates" "Compliance Scans" "Evidence Library" "Executive Report" "Team & Roles" "Audit Log"; do
  S=$(snap)
  R=$(getref "$S" "\"$V\"")
  if [ -n "$R" ]; then
    ab click @$R >/dev/null; sleep 4
    N=$(echo "$V" | tr -cd '[:alnum:]' | cut -c1-20)
    ab screenshot --full $OUT/03-view-$N.png >/dev/null
    echo "  view ok: $V"
  else
    echo "  view MISSING: $V"
  fi
done
ls $OUT/ | head -30
echo "==> done"
