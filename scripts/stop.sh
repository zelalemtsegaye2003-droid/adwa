#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Adwa Cyber — stop every local service started for development.
#
#   app            → http://localhost:3000  (bun run dev / bun run start)
#   mock-google    → http://localhost:3010  (mini-services/mock-google)
#   mock-ethiocert → http://localhost:3020  (mini-services/mock-ethiocert)
#
# Usage:  bash scripts/stop.sh     (graceful SIGTERM, force-kill after 3 s)
#         bash scripts/stop.sh -9  (immediate force kill)
# Safe to run when nothing is running — it just reports "nothing to stop".
# ─────────────────────────────────────────────────────────────────────────────
set -u

PORTS="3000 3010 3020"

# PIDs of processes listening on $1 (tries ss first, falls back to lsof).
pids_on_port() {
  local port="$1" pids=""
  if command -v ss >/dev/null 2>&1; then
    pids="$(ss -tlnp 2>/dev/null | grep -v '^State' | awk -v p=":$port\$" '$4 ~ p' \
            | grep -oE 'pid=[0-9]+' | cut -d= -f2 | sort -u | tr '\n' ' ')"
  fi
  if [ -z "${pids// /}" ] && command -v lsof >/dev/null 2>&1; then
    pids="$(lsof -ti tcp:"$port" 2>/dev/null | sort -u | tr '\n' ' ')"
  fi
  echo "$pids"
}

# Signal every listener on our ports. Prints what it did; returns 0 if it
# signalled at least one process.
signal_port_listeners() {
  local sig="$1" found_any=0 port pids
  for port in $PORTS; do
    pids="$(pids_on_port "$port")"
    if [ -n "${pids// /}" ]; then
      echo "→ port $port: sending SIG$sig to PID(s) $pids"
      # shellcheck disable=SC2086
      kill -"$sig" $pids 2>/dev/null || true
      found_any=1
    fi
  done
  [ "$found_any" = "1" ] && return 0 || return 1
}

# Catch wrapper processes that no longer hold the port themselves
# (e.g. `next dev` parent shells after the server child already died).
sweep_leftovers() {
  local sig="$1"
  pkill -"$sig" -f "next dev -p 3000" 2>/dev/null || true
  pkill -"$sig" -f "next-server" 2>/dev/null || true
  pkill -"$sig" -f "bun --hot index.ts" 2>/dev/null || true
}

if [ "${1:-}" = "-9" ]; then
  signal_port_listeners KILL || { echo "Nothing to stop — no services on ports $PORTS."; exit 0; }
  sweep_leftovers KILL
  echo "All services stopped (forced)."
  exit 0
fi

if ! signal_port_listeners TERM; then
  sweep_leftovers TERM
  echo "Nothing to stop — no services on ports $PORTS."
  exit 0
fi

# Give the processes up to 3 s to exit cleanly, then force anything left.
sleep 3
signal_port_listeners KILL || true
sweep_leftovers KILL
echo "All Adwa Cyber services stopped (ports $PORTS)."
