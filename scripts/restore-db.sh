#!/bin/sh
# Adwa Cyber — database restore with integrity verification.
#
# Verifies the sha256 sidecar, then restores:
#   SQLite:      sh scripts/restore-db.sh backups/adwa-YYYYMMDD-HHMMSS.db.gz
#   PostgreSQL:  sh scripts/restore-db.sh backups/adwa-YYYYMMDD-HHMMSS.sql.gz
#
# DANGER: overwrites the current database. The app must be stopped first
# (the script checks for a listening app on :3000 and refuses otherwise).
set -eu
cd "$(dirname "$0")/.."

if [ $# -ne 1 ]; then
  echo "Usage: sh scripts/restore-db.sh <backup-file.gz>" >&2
  exit 1
fi
FILE=$1

if [ ! -f "$FILE" ]; then
  echo "[restore] backup not found: $FILE" >&2
  exit 1
fi
if [ ! -f "$FILE.sha256" ]; then
  echo "[restore] missing checksum sidecar $FILE.sha256 — refusing" >&2
  exit 1
fi

# Refuse to restore over a live app (SQLite corruption risk)
if command -v curl >/dev/null 2>&1; then
  if curl -s -o /dev/null --max-time 2 http://localhost:3000/api/health; then
    echo "[restore] app appears to be running on :3000 — stop it first" >&2
    exit 1
  fi
fi

echo "[restore] verifying checksum…"
sha256sum -c "$FILE.sha256"

case "$FILE" in
  *.db.gz)
    DB_PATH=$(printf '%s' "${DATABASE_URL:-file:db/custom.db}" | sed 's|^file:||')
    echo "[restore] sqlite → $DB_PATH"
    mkdir -p "$(dirname "$DB_PATH")"
    gunzip -c "$FILE" > "$DB_PATH.restore"
    # Sanity check: the restored file must be a valid SQLite database
    python3 scripts/sqlite_tool.py verify "$DB_PATH.restore"
    mv "$DB_PATH" "$DB_PATH.pre-restore.$(date +%Y%m%d%H%M%S)"
    mv "$DB_PATH.restore" "$DB_PATH"
    echo "[restore] done (previous DB kept as $DB_PATH.pre-restore.*)"
    ;;
  *.sql.gz)
    echo "[restore] postgres"
    gunzip -c "$FILE" | psql "${DATABASE_URL:?DATABASE_URL required for postgres}"
    echo "[restore] done"
    ;;
  *)
    echo "[restore] unknown backup type: $FILE" >&2
    exit 1
    ;;
esac
echo "[restore] restart the app, then run: bun scripts/check-db.ts"
