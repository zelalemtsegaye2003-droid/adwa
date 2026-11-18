#!/bin/bash
# Adwa Cyber — CI helper: the four bun auth/compliance suites.
# Same discipline as run-api-tests.sh: fresh dev server per suite (the
# in-memory rate limiter is intentionally persistent per process).
set -u
cd "$(dirname "$(readlink -f "$0")")/.." # repo root, from any cwd

LOG=/tmp/adwa-dev.log
MOCK_G=/tmp/mock-google.log

cleanup() {
  pkill -f 'next dev' 2>/dev/null
  pkill -f 'next-server' 2>/dev/null
  pkill -f 'mini-services/mock' 2>/dev/null
  pkill -f 'bun --hot' 2>/dev/null
}
trap cleanup EXIT

cleanup; sleep 1

# Mock Google provider — needed by test-google; harmless for the others
(cd mini-services/mock-google && nohup bun run dev > "$MOCK_G" 2>&1 &)

start_app() {
  pkill -f 'next dev' 2>/dev/null
  pkill -f 'next-server' 2>/dev/null
  sleep 2
  nohup bun run dev > "$LOG" 2>&1 &
  for i in $(seq 1 60); do
    a=$(curl -s -o /dev/null -w '%{http_code}' --max-time 3 http://localhost:3000/ 2>/dev/null)
    [ "$a" = "200" ] && return 0
    sleep 2
  done
  echo "APP FAILED TO START (status=$a)"; tail -5 "$LOG"; return 1
}

SUITES=(test-auth test-owasp test-compliance test-google)
FAILED=0

echo "── waiting for mock google ─────────────────────────────────"
for i in $(seq 1 30); do
  g=$(curl -s -o /dev/null -w '%{http_code}' --max-time 3 http://localhost:3010/ 2>/dev/null)
  # The mock has no / route (404) — reachability is what matters.
  [ "$g" != "000" ] && break
  sleep 2
done
[ "$g" != "000" ] || { echo "mock google failed to start"; exit 1; }
echo "mock google ready (http $g)"

for s in "${SUITES[@]}"; do
  echo "══ $s ══════════════════════════════════════════════════════"
  bun scripts/reset-locks.ts > /dev/null 2>&1 || true
  if start_app && bun "scripts/$s.ts"; then :; else FAILED=1; echo "^^ SUITE FAILED: $s"; fi
  echo ""
done

if [ $FAILED -eq 0 ]; then echo "ALL AUTH SUITES PASSED"; else echo "SOME AUTH SUITES FAILED"; fi
exit $FAILED
