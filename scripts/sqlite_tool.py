#!/usr/bin/env python3
"""Adwa Cyber — SQLite backup/restore helper (no sqlite3 CLI needed).

Used by scripts/backup-db.sh and scripts/restore-db.sh. Python's sqlite3
.backup() produces a consistent snapshot even while the app is writing.

Usage:
  python3 scripts/sqlite_tool.py backup  <db-path> <out-db>
  python3 scripts/sqlite_tool.py verify  <db-path>            (integrity_check)
"""
import sqlite3
import sys


def backup(db_path: str, out_path: str) -> None:
    src = sqlite3.connect(db_path)
    dst = sqlite3.connect(out_path)
    try:
        src.backup(dst)  # consistent online snapshot
    finally:
        dst.close()
        src.close()
    print(f"[sqlite] snapshot {db_path} -> {out_path}")


def verify(db_path: str) -> None:
    con = sqlite3.connect(db_path)
    try:
        row = con.execute("PRAGMA integrity_check;").fetchone()
    finally:
        con.close()
    status = row[0] if row else "error"
    print(f"[sqlite] integrity_check: {status}")
    if status != "ok":
        sys.exit(1)


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(2)
    cmd, db_path = sys.argv[1], sys.argv[2]
    if cmd == "backup" and len(sys.argv) == 4:
        backup(db_path, sys.argv[3])
    elif cmd == "verify":
        verify(db_path)
    else:
        print(__doc__)
        sys.exit(2)
