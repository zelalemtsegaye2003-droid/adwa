#!/bin/sh
# Adwa Cyber — database backup (SQLite or PostgreSQL, auto-detected).
#
# Creates: backups/adwa-YYYYMMDD-HHMMSS.db.gz  (SQLite)
#          backups/adwa-YYYYMMDD-HHMMSS.sql.gz (PostgreSQL)
# Each backup gets a sidecar .sha256 file. Retention: last 30 backups.
#
# Usage: sh scripts/backup-db.sh
# Cron (daily 02:30): 30 2 * * * cd /opt/adwa && sh scripts/backup-db.sh >> /var/log/adwa-backup.log 2>&1
set -eu
cd "$(dirname "$0")/.."

BACKUP_DIR="${BACKUP_DIR:-backups}"
RETENTION="${RETENTION:-30}"
mkdir -p "$BACKUP_DIR"
STAMP=$(date +%Y%m%d-%H%M%S)

detect_provider() {
  case "${DATABASE_URL:-}" in
    postgresql://*|postgres://*) echo postgres ;;
    *) echo sqlite ;;
  esac
}

PROVIDER=$(detect_provider)

if [ "$PROVIDER" = "postgres" ]; then
  OUT="$BACKUP_DIR/adwa-$STAMP.sql.gz"
  echo "[backup] postgres → $OUT"
  pg_dump "${DATABASE_URL:?DATABASE_URL required for postgres}" | gzip -9 > "$OUT"
else
  # SQLite: file: URL or direct path (default db/custom.db)
  DB_PATH=$(printf '%s' "${DATABASE_URL:-file:db/custom.db}" | sed 's|^file:||')
  if [ ! -f "$DB_PATH" ]; then
    echo "[backup] sqlite database not found at $DB_PATH" >&2
    exit 1
  fi
  OUT="$BACKUP_DIR/adwa-$STAMP.db.gz"
  echo "[backup] sqlite ($DB_PATH) → $OUT"
  python3 scripts/sqlite_tool.py backup "$DB_PATH" "$BACKUP_DIR/.snapshot-$STAMP.db"
  gzip -9 < "$BACKUP_DIR/.snapshot-$STAMP.db" > "$OUT"
  rm -f "$BACKUP_DIR/.snapshot-$STAMP.db"
fi

# Integrity sidecar — restore-db.sh refuses to touch a backup that fails it
if command -v sha256sum >/dev/null 2>&1; then
  sha256sum "$OUT" > "$OUT.sha256"
  echo "[backup] checksum: $(cut -d' ' -f1 "$OUT.sha256" | head -c 16)…"
fi

# Retention: keep the newest $RETENTION backups (+ their sidecars)
ls -1t "$BACKUP_DIR"/adwa-*.gz 2>/dev/null | tail -n +$((RETENTION + 1)) | while read -r old; do
  echo "[backup] pruning $(basename "$old")"
  rm -f "$old" "$old.sha256"
done

echo "[backup] done: $(basename "$OUT") ($(du -h "$OUT" | cut -f1))"
