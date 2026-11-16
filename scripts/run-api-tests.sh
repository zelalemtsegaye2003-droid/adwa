#!/bin/bash
# Adwa Cyber — one-shot dev stack + API test runner.
# The sandbox reaps background processes when a shell call ends, so the
# server and the mini-services must live within a single call: this script
# starts them, waits for readiness, runs the suites, then tears down.
# Usage: bash scripts/run-api-tests.sh [suite ...]   (default: all suites)
set -u
cd /adwa

LOG=/tmp/adwa-dev.log
MOCK_G=/tmp/mock-google.log
MOCK_EC=/tmp/mock-ethiocert.log

cleanup() {
  pkill -f 'next dev' 2>/dev/null
  pkill -f 'next-server' 2>/dev/null
  pkill -f 'mini-services/mock' 2>/dev/null
  pkill -f 'bun --hot' 2>/dev/null
}
trap cleanup EXIT

cleanup; sleep 1

echo "── starting mini-services + next dev ──────────────────────────"
(cd mini-services/mock-google && nohup bun run dev > "$MOCK_G" 2>&1 &)
(cd mini-services/mock-ethiocert && nohup bun run dev > "$MOCK_EC" 2>&1 &)
nohup bun run dev > "$LOG" 2>&1 &

ready=""
for i in $(seq 1 90); do
  a=$(curl -s -o /dev/null -w '%{http_code}' --max-time 3 http://localhost:3000/ 2>/dev/null)
  g=$(curl -s -o /dev/null -w '%{http_code}' --max-time 3 http://localhost:3010/ 2>/dev/null)
  e=$(curl -s -o /dev/null -w '%{http_code}' --max-time 3 http://localhost:3020/ 2>/dev/null)
  if [ "$a" = "200" ] && [ "$g" != "000" ] && [ "$e" = "200" ]; then ready=1; break; fi
  sleep 2
done
if [ -z "$ready" ]; then
  echo "STACK FAILED TO START (app=$a google=$g ethiocert=$e)"
  tail -5 "$LOG" "$MOCK_EC" 2>/dev/null
  exit 1
fi
echo "stack ready (app=200 google=$g ethiocert=200)"
echo ""

SUITES=("$@")
if [ ${#SUITES[@]} -eq 0 ]; then
  SUITES=(ethiocert-bind-test soc-test sla-test report-test rules-engine-test scan-lifecycle-test evidence-security-test gates-test trackc-test awareness-test awareness-tools-api-test vapt-test)
fi

restart_app() {
  pkill -f 'next dev' 2>/dev/null
  pkill -f 'next-server' 2>/dev/null
  sleep 2
  nohup bun run dev > "$LOG" 2>&1 &
  for i in $(seq 1 60); do
    a=$(curl -s -o /dev/null -w '%{http_code}' --max-time 3 http://localhost:3000/ 2>/dev/null)
    [ "$a" = "200" ] && return 0
    sleep 2
  done
  echo "APP FAILED TO RESTART (status=$a)"; tail -5 "$LOG"; return 1
}

FAILED=0
for s in "${SUITES[@]}"; do
  echo "══ $s ════════════════════════════════════════════════════════"
  # Fresh server per suite: the in-memory login rate limiter is by design
  # persistent within a server lifetime (see download/README.md).
  restart_app || { FAILED=1; echo "^^ SUITE SKIPPED: $s"; continue; }
  # SOC-dependent suites need deterministic incident/indicator state (the
  # suites themselves mutate the lifecycle as part of the test).
  case "$s" in
    ethiocert-bind-test|soc-test) node scripts/seed-soc.cjs > /dev/null || { FAILED=1; echo "seed-soc failed"; continue; } ;;
    sla-test)       node scripts/seed-sla.cjs  > /dev/null || { FAILED=1; echo "seed-sla failed"; continue; } ;;
    rules-engine-test) node scripts/seed-evidence-links.cjs > /dev/null || { FAILED=1; echo "seed-evidence-links failed"; continue; } ;;
    gates-test)     bun scripts/seed-gates.ts  > /dev/null 2>&1 || true ;;
    trackc-test)    node scripts/seed-trackc.cjs > /dev/null || { FAILED=1; echo "seed-trackc failed"; continue; } ;;
    awareness-test) node scripts/seed-awareness.cjs > /dev/null || { FAILED=1; echo "seed-awareness failed"; continue; } ;;
    vapt-test)      bun scripts/seed-vapt.ts > /dev/null 2>&1 || { FAILED=1; echo "seed-vapt failed"; continue; } ;;
  esac
  if node "scripts/$s.mjs"; then :; else FAILED=1; echo "^^ SUITE FAILED: $s"; fi
  echo ""
done

if [ $FAILED -eq 0 ]; then echo "ALL API SUITES PASSED"; else echo "SOME SUITES FAILED"; fi
exit $FAILED
