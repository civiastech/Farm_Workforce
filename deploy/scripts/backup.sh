#!/usr/bin/env sh
# Creates a compressed PostgreSQL backup in ./backups and keeps the most recent $KEEP files.
# Schedule it with cron on the server, e.g. daily at 02:30:
#   30 2 * * * cd /srv/farm-workforce-platform && ./deploy/scripts/backup.sh >> backups/backup.log 2>&1
# Copy backups off the server too (e.g. rclone to object storage) — a backup on the same disk is not a backup.
set -eu

KEEP="${KEEP:-14}"
COMPOSE="docker compose -f compose.yaml -f compose.prod.yaml"
[ "${LOCAL:-}" = "1" ] && COMPOSE="docker compose"

mkdir -p backups
file="backups/fwp-$(date -u +%Y%m%dT%H%M%SZ).sql.gz"

$COMPOSE exec -T db pg_dump -U fwp -d fwp --format=plain --no-owner --clean --if-exists | gzip -9 > "$file.partial"
mv "$file.partial" "$file"
echo "$(date -u +%FT%TZ) backup written: $file ($(du -h "$file" | cut -f1))"

# Retention: delete all but the newest $KEEP backups.
ls -1t backups/fwp-*.sql.gz 2>/dev/null | tail -n "+$((KEEP + 1))" | while read -r old; do rm -f -- "$old"; done
