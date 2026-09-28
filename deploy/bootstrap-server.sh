#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="/home/ubuntu/check-in"
DOMAIN="xn--btvt3a.online"

if [[ "$(id -u)" -eq 0 ]]; then
  SUDO=""
else
  SUDO="sudo"
fi

cd "$APP_DIR"

if ! command -v psql >/dev/null 2>&1; then
  $SUDO apt-get update
  $SUDO DEBIAN_FRONTEND=noninteractive apt-get install -y postgresql postgresql-contrib curl
fi
$SUDO systemctl enable --now postgresql

if ! $SUDO -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='checkin'" | grep -q 1; then
  DB_PASSWORD="$(openssl rand -hex 24)"
  $SUDO -u postgres psql -v ON_ERROR_STOP=1 -c "CREATE USER checkin WITH PASSWORD '$DB_PASSWORD';"
else
  echo "PostgreSQL role checkin already exists; preserving its password."
  DB_PASSWORD="${CHECKIN_DB_PASSWORD:-}"
  if [[ -z "$DB_PASSWORD" && ! -f backend/.env ]]; then
    echo "ERROR: set CHECKIN_DB_PASSWORD because the existing checkin role password is unknown."
    exit 1
  fi
fi

if ! $SUDO -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='check_in'" | grep -q 1; then
  $SUDO -u postgres createdb -O checkin check_in
fi

if [[ ! -f backend/.env ]]; then
  VIEWER_PASSWORD="$(openssl rand -hex 12)"
  UPLOADER_PASSWORD="$(openssl rand -hex 12)"
  ADMIN_PASSWORD="$(openssl rand -hex 12)"
  JWT_SECRET="$(openssl rand -hex 32)"
  cat > backend/.env <<EOF
DATABASE_URL=postgresql+asyncpg://checkin:${DB_PASSWORD}@localhost:5432/check_in
VIEWER_PASSWORD=${VIEWER_PASSWORD}
UPLOADER_PASSWORD=${UPLOADER_PASSWORD}
ADMIN_PASSWORD=${ADMIN_PASSWORD}
JWT_SECRET=${JWT_SECRET}
FACE_MATCH_THRESHOLD=0.60
MEDIA_DIR=./data/media
FRONTEND_ORIGIN=https://${DOMAIN}
EOF
  chmod 600 backend/.env
  cat > backend/INITIAL-CREDENTIALS.txt <<EOF
Generated on $(date -Is)
VIEWER_PASSWORD=${VIEWER_PASSWORD}
UPLOADER_PASSWORD=${UPLOADER_PASSWORD}
ADMIN_PASSWORD=${ADMIN_PASSWORD}
EOF
  chmod 600 backend/INITIAL-CREDENTIALS.txt
fi

bash "$APP_DIR/deploy/deploy.sh"
echo "Initial credentials are in $APP_DIR/backend/INITIAL-CREDENTIALS.txt"
