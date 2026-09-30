#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="/home/ubuntu/check-in"
ENV_FILE="$APP_DIR/backend/.env"
BACKUP_DIR="/home/ubuntu/check-in-backups"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
STAMP="$(date +%Y%m%d-%H%M%S)"
WORK_DIR="$BACKUP_DIR/.in-progress-$STAMP"

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"
mkdir -p "$WORK_DIR"
trap 'rm -rf "$WORK_DIR"' EXIT

if [[ ! -f "$ENV_FILE" ]]; then
  echo "missing environment file: $ENV_FILE" >&2
  exit 1
fi

set -a
source "$ENV_FILE"
set +a

echo "[$(date --iso-8601=seconds)] backing up database"
pg_dump --dbname="$DATABASE_URL" --format=custom --file="$WORK_DIR/check-in-$STAMP.dump"

echo "[$(date --iso-8601=seconds)] backing up media"
tar -C "$APP_DIR/backend/data" -czf "$WORK_DIR/check-in-media-$STAMP.tar.gz" media

mv "$WORK_DIR"/* "$BACKUP_DIR/"
rm -rf "$WORK_DIR"
find "$BACKUP_DIR" -maxdepth 1 -type f -mtime "+$RETENTION_DAYS" -delete

echo "[$(date --iso-8601=seconds)] backup complete"
