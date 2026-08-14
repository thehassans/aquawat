#!/bin/bash
set -e

DEPLOY_PATH="/var/www/vhosts/maqder.com/httpdocs"
LOCK_FILE="/var/lock/maqder-deploy.lock"
mkdir -p /var/lock
exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  echo "Another Maqder deploy is already running — aborting to avoid compose races"
  exit 1
fi

cd "$DEPLOY_PATH"

echo "Pulling latest code..."
git fetch origin main
git reset --hard origin/main

# Detect docker compose command
COMPOSE=""
if docker compose version &>/dev/null; then
  COMPOSE="docker compose"
elif docker-compose version &>/dev/null; then
  COMPOSE="docker-compose"
fi

if [ -n "$COMPOSE" ]; then
  echo "Deploying with $COMPOSE..."
  # Keep the public edge proxy up so visitors see the updating page
  # instead of Nginx 502 while images rebuild (do not compose down).
  ERROR_DOCS="/var/www/vhosts/maqder.com/error_docs"
  if [ -d "$ERROR_DOCS" ] && [ -f "$DEPLOY_PATH/frontend/public/updating.html" ]; then
    cp -f "$DEPLOY_PATH/frontend/public/updating.html" "$ERROR_DOCS/502.html" || true
    cp -f "$DEPLOY_PATH/frontend/public/updating.html" "$ERROR_DOCS/503.html" || true
    cp -f "$DEPLOY_PATH/frontend/public/updating.html" "$ERROR_DOCS/504.html" || true
  fi
  $COMPOSE stop frontend || true
  docker rm -f maqder_frontend || true
  $COMPOSE up -d edge || true
  $COMPOSE up -d --build --remove-orphans
  echo "Running containers:"
  $COMPOSE ps
fi

# Always trigger Plesk / Passenger / PM2 restarts as fallback or native runner
echo "Updating Node modules and restarting app..."
if [ -d "$DEPLOY_PATH/backend" ]; then
  mkdir -p "$DEPLOY_PATH/backend/tmp" "$DEPLOY_PATH/tmp"
  touch "$DEPLOY_PATH/backend/tmp/restart.txt" "$DEPLOY_PATH/tmp/restart.txt"
fi

if command -v pm2 &>/dev/null; then
  pm2 reload all || pm2 restart all || true
fi

echo "Deployment complete."
