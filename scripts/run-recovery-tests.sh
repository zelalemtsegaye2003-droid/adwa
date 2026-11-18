#!/bin/bash
# Adwa Cyber — self-service recovery suite runner.
# Starts next dev, runs scripts/test-password-reset.ts, tears down.
# (Everything in one call: long-lived background processes may be reaped
# between separate shell invocations.)
set -u
cd "$(dirname "$(readlink -f "$0")")/.." # repo root, from any cwd

LOG=/tmp/adwa-dev.log

cleanup() {
  pkill -f 'next dev' 2>/dev/null
  pkill -f 'next-server' 2>/dev/null
  pkill -f 'bun run dev' 2>/dev/null
}
trap cleanup EXIT

cleanup; sleep 1

echo "── starting next dev ──────────────────────────────────────"
nohup bun run dev > "$LOG" 2>&1 &

ready=""
for i in $(seq 1 60); do
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 3 http://localhost:3000/ 2>/dev/null)
  if [ "$code" = "200" ]; then ready=1; break; fi
  sleep 2
done
if [ -z "$ready" ]; then
  echo "SERVER FAILED TO START (code=$code)"
  tail -8 "$LOG" 2>/dev/null
  exit 1
fi
echo "server ready"

bun scripts/reset-locks.ts > /dev/null 2>&1

echo "── running recovery suite ─────────────────────────────────"
timeout -k 10 240 bun scripts/test-password-reset.ts
status=$?

if [ $status -eq 0 ]; then
  echo "RECOVERY SUITE: PASS"
else
  echo "RECOVERY SUITE: FAIL (exit $status)"
  echo "── last server log lines ──"
  rg -v "prisma:query" "$LOG" | tail -10
fi
exit $status
