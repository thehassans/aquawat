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
  $COMPOSE down || true
  $COMPOSE up -d --build
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
