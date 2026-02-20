#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DB_PATH="$ROOT_DIR/dev.db"

sqlite3 "$DB_PATH" < "$ROOT_DIR/scripts/init_db.sql"

echo "Initialized SQLite database at $DB_PATH"
