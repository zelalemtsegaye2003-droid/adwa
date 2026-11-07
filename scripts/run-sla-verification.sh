#!/usr/bin/env bash
# Adwa Cyber — run the dev server + full SLA verification in ONE shell.
# (Background processes are reaped unreliably between tool calls, and a
# lingering next-server can hold port 3000; so: kill by port first, verify
# the port is free, start fresh, prime the page compile, then test.)
set -uo pipefail
cd /home/z/my-project

echo "═══ cleaning up any lingering server ═══"
pkill -f "next dev" 2>/dev/null
pkill -f "next-server" 2>/dev/null
for i in $(seq 1 15); do
  if ss -tln 2>/dev/null | grep -q ":3000 "; then sleep 1; else break; fi
done
if ss -tln 2>/dev/null | grep -q ":3000 "; then
  echo "FATAL: port 3000 still in use"; ss -tlnp 2>/dev/null | grep ":3000 "; exit 1
fi

echo "═══ starting dev server ═══"
./node_modules/.bin/next dev -p 3000 > dev.log 2>&1 &

up=0
for i in $(seq 1 90); do
  if curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/auth/captcha --max-time 3 2>/dev/null | grep -q 200; then
    up=1; echo "server up after ~$((i * 2))s"; break
  fi
  sleep 2
done
if [ "$up" != "1" ]; then echo "FATAL: server did not start"; tail -30 dev.log; pkill -f "next dev"; exit 1; fi

# prime the page bundle so the browser session doesn't race the first compile
curl -s -o /dev/null http://localhost:3000 --max-time 120
sleep 1

echo ""
echo "═══ SLA API E2E ═══"
node scripts/sla-test.mjs 2>&1 | grep -v "prisma:query"
API_RC=${PIPESTATUS[0]}

echo ""
echo "═══ SLA browser E2E ═══"
bash scripts/sla-browser-test.sh 2>&1 | grep -v "prisma:query"
BR_RC=${PIPESTATUS[0]}

echo ""
echo "═══ done (api rc=$API_RC, browser rc=$BR_RC) — stopping server ═══"
pkill -f "next dev" 2>/dev/null; pkill -f "next-server" 2>/dev/null
exit $(( API_RC + BR_RC ))
