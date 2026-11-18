#!/usr/bin/env bash
# Objective DOM overlap audit: for each view, walk all leaf text nodes and
# report pairs of DIFFERENT elements whose rendered text boxes truly intersect.
set -uo pipefail
cd /home/z/my-project
OUT=/tmp/overlap-report.txt
: > $OUT

bunx next dev -p 3100 >/tmp/dev3100.log 2>&1 &
SRV=$!
for i in $(seq 1 60); do code=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3100/ || true); [ "$code" = "200" ] && break; sleep 1; done
echo "server $code"
ab() { agent-browser "$@" 2>&1; }
getref() { echo "$1" | grep -F -- "$2" | grep -o "ref=e[0-9]*" | head -1 | cut -d= -f2; }
snap() { agent-browser snapshot -i 2>&1; }

ab set viewport 1440 900 >/dev/null
ab open http://localhost:3100/ >/dev/null; sleep 3
S=$(snap); DEMO=$(getref "$S" 'Demo accounts'); ab click @$DEMO >/dev/null; sleep 1
S=$(snap); ADMIN=$(getref "$S" 'Platform Super Admin'); ab click @$ADMIN >/dev/null; sleep 1
CAP=$(ab eval "decodeURIComponent(document.querySelector('img[src^=data]').src).match(/<text[^>]*>[^<]*<\/text>/g).map(t=>{const m=t.match(/x=\\\"([0-9.]+)\\\"/);return {ch:t.match(/>([^<]*)</)[1], x:parseFloat(m[1])}}).sort((a,b)=>a.x-b.x).map(o=>o.ch).join('')" | tr -d '"')
S=$(snap); SEC=$(getref "$S" 'textbox "Security check"'); SIGN=$(getref "$S" 'button "Sign in"')
ab fill @$SEC "$CAP" >/dev/null; ab click @$SIGN >/dev/null; sleep 4
echo "login ok"

DETECT='(() => {
  const out = [];
  const els = Array.from(document.querySelectorAll("main *, aside *")).filter(el => {
    if (el.children.length) return false;
    const t = (el.child && el.child.textContent || el.textContent || "").trim();
    return t.length > 0;
  });
  const rects = els.map(el => ({ el, r: el.getBoundingClientRect() })).filter(x => x.r.width > 4 && x.r.height > 4);
  for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) {
    const a = rects[i], b = rects[j];
    if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
    const ox = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left);
    const oy = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
    if (ox > 3 && oy > 3) {
      const sa = getComputedStyle(a.el), sb = getComputedStyle(b.el);
      if (sa.position === "fixed" || sb.position === "fixed" || sa.position === "sticky" || sb.position === "sticky") continue;
      out.push({
        a: a.el.tagName + ":" + (a.el.textContent || "").slice(0, 30),
        b: b.el.tagName + ":" + (b.el.textContent || "").slice(0, 30),
        ox: Math.round(ox), oy: Math.round(oy),
        ay: Math.round(a.r.top), ax: Math.round(a.r.left)
      });
    }
  }
  return JSON.stringify({ pageH: document.documentElement.scrollHeight, overlaps: out.slice(0, 30) });
})()'

audit() {
  NAME="$1"; SEL="$2"
  echo "===== $NAME =====" | tee -a $OUT
  R=$(ab eval "$DETECT" | tr -d '"' | sed 's/\\n/\n/g')
  echo "$R" | head -60 | tee -a $OUT
}

# dashboard
audit "dashboard" ""
S=$(snap); V=$(getref "$S" '"VAPT Center"'); ab click @$V >/dev/null; sleep 5
audit "vapt-overview" ""
S=$(snap)
for T in "Assets & Attack Surface" "Scans" "Vulnerabilities" "Scopes & Authorization" "EASM Discovery" "AD Attack Paths"; do
  R=$(getref "$S" "\"$T\"")
  if [ -n "$R" ]; then ab click @$R >/dev/null; sleep 4; audit "vapt-$T" ""; S=$(snap); fi
done
S=$(snap)
for V in "Findings" "Security Operations" "Awareness" "Track C Gates" "Executive Report" "Team & Roles" "Audit Log" "Evidence Library"; do
  R=$(getref "$S" "\"$V\"")
  if [ -n "$R" ]; then ab click @$R >/dev/null; sleep 4; audit "view-$V" ""; S=$(snap); fi
done
kill $SRV 2>/dev/null
echo done