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

  echo "Starting edge + data services..."
  $COMPOSE up -d edge mongo redis mongo-backup || true

  BUILD_SHA="$(git rev-parse HEAD)"
  echo "Building backend images (${BUILD_SHA})..."
  if ! $COMPOSE build --build-arg BUILD_SHA="$BUILD_SHA" backend pdf-worker; then
    echo "=== backend image build failed ==="
    exit 1
  fi

  echo "Building frontend image..."
  if ! $COMPOSE build --build-arg BUILD_SHA="$BUILD_SHA" frontend; then
    echo "=== frontend image build failed ==="
    exit 1
  fi

  echo "Starting backend workers..."
  $COMPOSE up -d --remove-orphans backend pdf-worker

  echo "Waiting for backend readiness (up to 4 minutes)..."
  ready=0
  for _ in $(seq 1 48); do
    body="$($COMPOSE exec -T backend wget -qO- http://127.0.0.1:3000/api/health/ready 2>/dev/null || true)"
    if echo "$body" | grep -Eq '"status"[[:space:]]*:[[:space:]]*"READY"'; then
      ready=1
      break
    fi
    sleep 5
  done

  if [ "$ready" -ne 1 ]; then
    echo "=== backend not ready — recent logs ==="
    $COMPOSE ps -a || true
    $COMPOSE logs --tail=120 backend mongo redis pdf-worker 2>/dev/null || $COMPOSE logs --tail=120
    exit 1
  fi

  echo "Starting frontend..."
  $COMPOSE up -d frontend

  echo "Running containers:"
  $COMPOSE ps
fi

echo "Updating Node modules and restarting app..."
if [ -d "$DEPLOY_PATH/backend" ]; then
  mkdir -p "$DEPLOY_PATH/backend/tmp" "$DEPLOY_PATH/tmp"
  touch "$DEPLOY_PATH/backend/tmp/restart.txt" "$DEPLOY_PATH/tmp/restart.txt"
fi

if command -v pm2 &>/dev/null; then
  pm2 reload all || pm2 restart all || true
fi

echo "Deployment complete."
