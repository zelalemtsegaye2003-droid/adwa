#!/usr/bin/env bash
# VLM audit of every captured screenshot — report text alignment/overlap defects.
set -uo pipefail
OUT=/tmp/shots
REPORT=/tmp/shots/audit-report.txt
: > "$REPORT"

PROMPT='You are a strict UI QA reviewer for a web dashboard screenshot. List ONLY real visual defects involving text: (1) overlapping or colliding text, (2) text touching/cramped against neighboring columns or elements with no spacing, (3) awkward mid-word wrapping of long tokens (URLs/IPs), (4) truncated text that loses meaning, (5) misaligned table columns. For each: location + one-line description. If none, answer exactly: CLEAN. Max 120 words.'

for f in "$OUT"/0*.png; do
  name=$(basename "$f")
  echo "── auditing $name" >&2
  z-ai vision -p "$PROMPT" -i "$f" 2>/dev/null | python3 -c "
import json,sys
s=sys.stdin.read(); i=s.find('{')
try:
    j=json.loads(s[i:]); print(j['choices'][0]['message']['content'].strip())
except Exception:
    print('VLM_ERROR')
" > /tmp/one.txt
  echo "===== $name =====" >> "$REPORT"
  cat /tmp/one.txt >> "$REPORT"
  echo >> "$REPORT"
done
echo "report written to $REPORT"
