#!/usr/bin/env sh
# Restores a backup created by backup.sh. THIS REPLACES THE CURRENT DATABASE CONTENTS.
#   ./deploy/scripts/restore.sh backups/fwp-20260101T023000Z.sql.gz
set -eu

file="${1:?Usage: restore.sh <backup.sql.gz>}"
[ -f "$file" ] || { echo "No such file: $file" >&2; exit 1; }

COMPOSE="docker compose -f compose.yaml -f compose.prod.yaml"
[ "${LOCAL:-}" = "1" ] && COMPOSE="docker compose"

printf 'This will overwrite the database with %s. Type "restore" to continue: ' "$file"
read -r answer
[ "$answer" = "restore" ] || { echo "Aborted."; exit 1; }

$COMPOSE stop api web
gunzip -c "$file" | $COMPOSE exec -T db psql -U fwp -d fwp --single-transaction --set ON_ERROR_STOP=1 >/dev/null
$COMPOSE up -d --wait api web
echo "Restore complete."
