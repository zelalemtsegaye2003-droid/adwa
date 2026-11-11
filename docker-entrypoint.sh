#!/bin/sh
# Adwa Cyber — container entrypoint: migrate → seed → serve.
set -e

: "${DATABASE_URL:?DATABASE_URL must point at PostgreSQL, e.g. postgresql://adwa:secret@db:5432/adwa}"
: "${AUTH_SECRET:?AUTH_SECRET is required (64+ chars — generate with: openssl rand -base64 48)}"

echo "[entrypoint] applying schema…"
# Prisma db push retries until the DB accepts connections (compose healthcheck
# usually makes the first try succeed already).
i=0
until bunx prisma db push --skip-generate --accept-data-loss 2>/dev/null; do
  i=$((i + 1))
  if [ "$i" -ge 30 ]; then
    echo "[entrypoint] database never became ready — aborting" >&2
    exit 1
  fi
  sleep 2
done
echo "[entrypoint] schema applied"

if [ "${SEED_ON_BOOT:-1}" = "1" ]; then
  echo "[entrypoint] seeding (idempotent)…"
  bun prisma/seed.ts            || echo "[entrypoint] WARN: base seed exited non-zero"
  bun scripts/seed-users.ts     || true
  bun scripts/seed-soc.cjs      || true
  bun scripts/seed-gates.ts     || true
fi

echo "[entrypoint] starting server on :${PORT:-3000}"
exec bun .next/standalone/server.js
