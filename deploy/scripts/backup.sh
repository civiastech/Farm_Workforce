#!/usr/bin/env sh
# Creates a compressed PostgreSQL backup in ./backups, keeps the newest $KEEP locally,
# optionally copies it off the server with rclone, and optionally pings a heartbeat URL.
#
# Schedule it with cron on the server, e.g. daily at 02:30:
#   30 2 * * * cd /srv/farm-workforce-platform && ./deploy/scripts/backup.sh >> backups/backup.log 2>&1
#
# Settings, read from the environment or from .env (see .env.production.example):
#   BACKUP_REMOTE          rclone destination, e.g. "b2:fwp-backups" or "r2:fwp-backups/db".
#                          Configure the remote once with `rclone config` (or docker, see DEPLOYMENT.md).
#   BACKUP_REMOTE_DAYS     delete off-site copies older than this many days (default 30).
#   BACKUP_HEARTBEAT_URL   pinged after a successful backup (and /fail on failure), e.g. a
#                          healthchecks.io check, so you are alerted if backups stop.
#   KEEP                   local backups to keep (default 14).
set -eu

# Read KEY from the environment, else from .env, without sourcing .env (values may contain spaces).
setting() {
  eval "value=\${$1:-}"
  if [ -z "$value" ] && [ -f .env ]; then
    value=$(sed -n "s/^$1=//p" .env | tail -n 1 | sed 's/^["'\'']//; s/["'\'']$//')
  fi
  printf '%s' "$value"
}

KEEP="${KEEP:-14}"
REMOTE=$(setting BACKUP_REMOTE)
REMOTE_DAYS=$(setting BACKUP_REMOTE_DAYS)
REMOTE_DAYS="${REMOTE_DAYS:-30}"
HEARTBEAT=$(setting BACKUP_HEARTBEAT_URL)

COMPOSE="docker compose -f compose.yaml -f compose.prod.yaml"
[ "${LOCAL:-}" = "1" ] && COMPOSE="docker compose"

ping_heartbeat() {
  [ -n "$HEARTBEAT" ] && curl -fsS -m 10 --retry 3 -o /dev/null "$HEARTBEAT$1" || true
}
trap 'status=$?; [ $status -ne 0 ] && ping_heartbeat /fail; exit $status' EXIT

# Runs rclone from the host if installed, otherwise from its official image using the host's config.
if command -v rclone >/dev/null 2>&1; then
  RCLONE_BACKUPS="backups"
  rclone_run() { rclone "$@"; }
else
  RCLONE_BACKUPS="/backups"
  rclone_run() {
    docker run --rm \
      -v "$HOME/.config/rclone:/config/rclone" \
      -v "$(pwd)/backups:/backups" \
      rclone/rclone:1.69 "$@"
  }
fi

mkdir -p backups
name="fwp-$(date -u +%Y%m%dT%H%M%SZ).sql.gz"
file="backups/$name"

$COMPOSE exec -T db pg_dump -U fwp -d fwp --format=plain --no-owner --clean --if-exists | gzip -9 > "$file.partial"
# An empty or truncated dump must never replace a good one.
gzip -t "$file.partial"
mv "$file.partial" "$file"
echo "$(date -u +%FT%TZ) backup written: $file ($(du -h "$file" | cut -f1))"

# Retention: delete all but the newest $KEEP local backups.
ls -1t backups/fwp-*.sql.gz 2>/dev/null | tail -n "+$((KEEP + 1))" | while read -r old; do rm -f -- "$old"; done

if [ -n "$REMOTE" ]; then
  rclone_run copyto "$RCLONE_BACKUPS/$name" "$REMOTE/$name"
  rclone_run delete --min-age "${REMOTE_DAYS}d" --include "fwp-*.sql.gz" "$REMOTE"
  echo "$(date -u +%FT%TZ) copied off-site: $REMOTE/$name (keeping ${REMOTE_DAYS} days)"
else
  echo "$(date -u +%FT%TZ) WARNING: BACKUP_REMOTE is not set; this backup exists only on this server"
fi

ping_heartbeat ""
