#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="/home/ubuntu/check-in"
DOMAIN="xn--btvt3a.online"
NODE_VERSION="v24.21.0"

cd "$APP_DIR"
if [[ -n "$(git status --porcelain)" ]]; then
  echo "ERROR: $APP_DIR has local changes; deployment stopped."
  git status --short
  exit 1
fi

if [[ ! -f backend/.env ]]; then
  echo "ERROR: missing $APP_DIR/backend/.env"
  exit 1
fi

git pull --ff-only origin main

if ! command -v uv >/dev/null 2>&1; then
  curl -LsSf https://astral.sh/uv/install.sh | sh
fi
export PATH="$HOME/.local/bin:$PATH"

if [[ ! -s "$HOME/.nvm/nvm.sh" ]]; then
  echo "ERROR: NVM is not installed for ubuntu"
  exit 1
fi
source "$HOME/.nvm/nvm.sh"
nvm use "$NODE_VERSION" >/dev/null

cd "$APP_DIR/backend"
uv sync --frozen
uv run alembic upgrade head

cd "$APP_DIR/frontend"
printf 'NEXT_PUBLIC_API_BASE_URL=https://%s\n' "$DOMAIN" > .env.production
npm ci
npm run build

sudo install -o root -g root -m 0644 "$APP_DIR/deploy/check-in-backend.service" /etc/systemd/system/check-in-backend.service
sudo install -o root -g root -m 0644 "$APP_DIR/deploy/check-in-frontend.service" /etc/systemd/system/check-in-frontend.service
sudo install -o root -g root -m 0644 "$APP_DIR/deploy/nginx-check-in.conf" /etc/nginx/sites-available/check-in
sudo ln -sfn /etc/nginx/sites-available/check-in /etc/nginx/sites-enabled/check-in

sudo systemctl daemon-reload
sudo systemctl enable check-in-backend check-in-frontend
sudo systemctl restart check-in-backend
sleep 2
sudo systemctl restart check-in-frontend
sudo nginx -t
sudo rm -f /etc/nginx/sites-enabled/tech-learn
sudo systemctl reload nginx

curl --fail --silent http://127.0.0.1:8001/health >/dev/null
curl --fail --silent http://127.0.0.1:3000 >/dev/null
curl --fail --silent --insecure --header "Host: $DOMAIN" https://127.0.0.1/ >/dev/null
sudo systemctl disable --now zero-to-tech-backend.service 2>/dev/null || true
sudo nginx -t
sudo systemctl reload nginx
echo "check-in deployment complete"
