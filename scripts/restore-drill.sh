#!/bin/bash
# Adwa Cyber — restore drill: prove backups actually restore.
#
# 1. take a backup via scripts/backup-db.sh (into a scratch dir)
# 2. restore it into a scratch DB copy
# 3. verify integrity + row counts match the live database
#
# Run: bash scripts/restore-drill.sh
set -eu
cd "$(dirname "$0")/.."

DB_PATH=$(printf '%s' "${DATABASE_URL:-file:db/custom.db}" | sed 's|^file:||')

WORK=$(mktemp -d)
BACKUP_DIR="$WORK/backups"

echo "── 1. backup ───────────────────────────────────────────────"
DATABASE_URL="file:$DB_PATH" BACKUP_DIR="$BACKUP_DIR" sh scripts/backup-db.sh
B=$(ls -1 "$BACKUP_DIR"/adwa-*.db.gz | head -1)
echo "backup: $B"

echo "── 2. row counts before ────────────────────────────────────"
COUNTS="SELECT (SELECT COUNT(*) FROM User) || ' users, ' || (SELECT COUNT(*) FROM Rule) || ' rules, ' || (SELECT COUNT(*) FROM Scan) || ' scans';"
BEFORE=$(python3 -c "import sqlite3,sys;print(sqlite3.connect('$DB_PATH').execute(\"$COUNTS\").fetchone()[0])")
echo "before: $BEFORE"

echo "── 3. restore into a scratch copy ──────────────────────────"
RESTORED="$WORK/restored.db"
gunzip -c "$B" > "$RESTORED"
python3 scripts/sqlite_tool.py verify "$RESTORED"
AFTER=$(python3 -c "import sqlite3,sys;print(sqlite3.connect('$RESTORED').execute(\"$COUNTS\").fetchone()[0])")
echo "after:  $AFTER"

echo "── 4. checksum verification (tamper detection) ─────────────"
cd "$BACKUP_DIR" && sha256sum -c "$(basename "$B").sha256"

if [ "$BEFORE" = "$AFTER" ]; then
  echo "DRILL PASSED — backup restores to identical state"
  cd - > /dev/null
  rm -rf "$WORK"
else
  echo "DRILL FAILED — state mismatch!" >&2
  echo "workdir kept: $WORK" >&2
  exit 1
fi
