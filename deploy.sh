#!/bin/bash
set -e

DEPLOY_PATH="/var/www/vhosts/maqder.com/httpdocs"
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
  ERROR_DOCS="/var/www/vhosts/maqder.com/error_docs"
  if [ -d "$ERROR_DOCS" ] && [ -f "$DEPLOY_PATH/frontend/public/updating.html" ]; then
    cp -f "$DEPLOY_PATH/frontend/public/updating.html" "$ERROR_DOCS/502.html" || true
    cp -f "$DEPLOY_PATH/frontend/public/updating.html" "$ERROR_DOCS/503.html" || true
    cp -f "$DEPLOY_PATH/frontend/public/updating.html" "$ERROR_DOCS/504.html" || true
  fi

  # Drop deprecated cron-worker container from earlier compose files.
  docker rm -f maqder_cron_worker 2>/dev/null || true

  BUILD_SHA="$(git rev-parse HEAD)"
  export BUILD_SHA

  # Keep edge + current frontend up while images rebuild (no compose down).
  $COMPOSE up -d edge || true
  if ! $COMPOSE up -d --build --remove-orphans; then
    echo "=== docker compose up failed — recent logs ==="
    $COMPOSE ps -a || true
    $COMPOSE logs --tail=120 backend frontend mongo redis pdf-worker 2>/dev/null || $COMPOSE logs --tail=120
    exit 1
  fi

  # Backend-only image rebuilds change the container IP. Older frontend nginx
  # configs cache that IP at start — force a frontend refresh after every deploy.
  $COMPOSE up -d --force-recreate --no-deps frontend || $COMPOSE restart frontend || true

  echo "Running containers:"
  $COMPOSE ps
fi

echo "Updating Node modules and restarting app..."
if [ -d "$DEPLOY_PATH/backend" ]; then
  mkdir -p "$DEPLOY_PATH/backend/tmp" "$DEPLOY_PATH/tmp" "$DEPLOY_PATH/logs"
  touch "$DEPLOY_PATH/backend/tmp/restart.txt" "$DEPLOY_PATH/tmp/restart.txt"
fi

if command -v pm2 &>/dev/null; then
  pm2 reload all || pm2 restart all || true
fi

echo "Deployment complete."
