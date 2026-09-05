#!/bin/bash
set -e

DEPLOY_PATH="/var/www/vhosts/maqder.com/httpdocs"
cd "$DEPLOY_PATH"

# CI rsyncs the tree from GitHub Actions (Plesk often cannot resolve github.com).
# Manual runs on the server can still git-pull when DNS works.
if [ "${SKIP_GIT:-0}" = "1" ]; then
  echo "Skipping git pull (SKIP_GIT=1 — code already synced by CI)."
else
  echo "Pulling latest code..."
  rm -f .git/index.lock
  find .git -maxdepth 2 -name "*.lock" -type f -mmin +2 -delete 2>/dev/null || true
  if ! git fetch origin main; then
    echo "git fetch failed. If DNS cannot resolve github.com, deploy via GitHub Actions (rsync) instead."
    exit 128
  fi
  git reset --hard origin/main
fi

# Reuse the live compose project so mongo/redis volumes are NOT recreated empty.
detect_compose_project() {
  for c in maqder_backend maqder_mongo maqder_edge maqder_frontend maqder_redis; do
    if docker inspect "$c" >/dev/null 2>&1; then
      p=$(docker inspect -f '{{index .Config.Labels "com.docker.compose.project"}}' "$c" 2>/dev/null || true)
      if [ -n "$p" ] && [ "$p" != "<no value>" ]; then
        echo "$p"
        return 0
      fi
    fi
  done
  # Fallback: directory name (Plesk path ends in httpdocs)
  basename "$DEPLOY_PATH"
}

export COMPOSE_PROJECT_NAME="$(detect_compose_project)"
echo "Using compose project: ${COMPOSE_PROJECT_NAME}"

# Plesk host DNS is often broken for Docker Hub / GitHub.
ensure_docker_registry_dns() {
  if getent hosts registry-1.docker.io >/dev/null 2>&1; then
    echo "registry-1.docker.io resolves OK"
    return 0
  fi
  echo "WARNING: cannot resolve registry-1.docker.io — applying DNS fallbacks"

  if [ -f /etc/resolv.conf ] && ! grep -qE '8\.8\.8\.8|1\.1\.1\.1' /etc/resolv.conf 2>/dev/null; then
    printf '\n# maqder deploy DNS fallback\nnameserver 8.8.8.8\nnameserver 1.1.1.1\n' >> /etc/resolv.conf || true
  fi

  mkdir -p /etc/docker
  python3 - <<'PY' || true
import json
from pathlib import Path
p = Path("/etc/docker/daemon.json")
data = {}
if p.exists():
    try:
        data = json.loads(p.read_text() or "{}")
    except Exception:
        data = {}
if not isinstance(data, dict):
    data = {}
dns = list(data.get("dns") or [])
for ns in ("8.8.8.8", "1.1.1.1"):
    if ns not in dns:
        dns.append(ns)
data["dns"] = dns
p.write_text(json.dumps(data, indent=2) + "\n")
print("Updated /etc/docker/daemon.json dns=", dns)
PY

  if command -v systemctl >/dev/null 2>&1; then
    systemctl restart docker || true
  elif command -v service >/dev/null 2>&1; then
    service docker restart || true
  fi
  sleep 4
  if getent hosts registry-1.docker.io >/dev/null 2>&1; then
    echo "registry-1.docker.io resolves after DNS fix"
  else
    echo "WARNING: registry-1.docker.io still unresolved — builds will use --pull never (cached bases only)"
  fi
}

# Detect docker compose command
COMPOSE=""
if docker compose version &>/dev/null; then
  COMPOSE="docker compose"
elif docker-compose version &>/dev/null; then
  COMPOSE="docker-compose"
fi

if [ -n "$COMPOSE" ]; then
  echo "Deploying with $COMPOSE (project=${COMPOSE_PROJECT_NAME})..."
  ERROR_DOCS="/var/www/vhosts/maqder.com/error_docs"
  if [ -d "$ERROR_DOCS" ] && [ -f "$DEPLOY_PATH/frontend/public/updating.html" ]; then
    cp -f "$DEPLOY_PATH/frontend/public/updating.html" "$ERROR_DOCS/502.html" || true
    cp -f "$DEPLOY_PATH/frontend/public/updating.html" "$ERROR_DOCS/503.html" || true
    cp -f "$DEPLOY_PATH/frontend/public/updating.html" "$ERROR_DOCS/504.html" || true
  fi

  # Drop deprecated cron-worker container from earlier compose files.
  docker rm -f maqder_cron_worker 2>/dev/null || true

  if [ -n "${BUILD_SHA:-}" ]; then
    export BUILD_SHA
  elif command -v git &>/dev/null && [ -d .git ]; then
    BUILD_SHA="$(git rev-parse HEAD 2>/dev/null || true)"
    export BUILD_SHA
  fi
  echo "BUILD_SHA=${BUILD_SHA:-unknown}"

  # Load images pre-built by GitHub Actions (no Docker Hub DNS required).
  # Prefer split backend/frontend zstd (fast CI transfer); keep combined/gzip for older runs.
  ensure_zstd() {
    if command -v zstd >/dev/null 2>&1; then
      return 0
    fi
    apt-get update -qq && apt-get install -y -qq zstd >/dev/null 2>&1 \
      || yum install -y -q zstd >/dev/null 2>&1 \
      || true
    command -v zstd >/dev/null 2>&1
  }

  if [ -f /tmp/maqder-backend.tar.zst ] && [ -f /tmp/maqder-frontend.tar.zst ]; then
    echo "Loading split pre-built images (backend + frontend)..."
    if ! ensure_zstd; then
      echo "ERROR: zstd is required to load maqder-*.tar.zst"
      exit 1
    fi
    zstd -d -c /tmp/maqder-backend.tar.zst | docker load
    zstd -d -c /tmp/maqder-frontend.tar.zst | docker load
    docker tag maqder-backend:latest maqder-pdf-worker:latest
  elif [ -f /tmp/maqder-app-images.tar.zst ]; then
    echo "Loading pre-built images from /tmp/maqder-app-images.tar.zst ..."
    if ! ensure_zstd; then
      echo "ERROR: zstd is required to load maqder-app-images.tar.zst"
      exit 1
    fi
    zstd -d -c /tmp/maqder-app-images.tar.zst | docker load
  elif [ -f /tmp/maqder-app-images.tar.gz ]; then
    echo "Loading pre-built images from /tmp/maqder-app-images.tar.gz ..."
    gunzip -c /tmp/maqder-app-images.tar.gz | docker load
  elif [ -f "$DEPLOY_PATH/maqder-app-images.tar.gz" ]; then
    echo "Loading pre-built images from maqder-app-images.tar.gz ..."
    gunzip -c "$DEPLOY_PATH/maqder-app-images.tar.gz" | docker load
  fi

  # Stable image names (see docker-compose.yml image: keys)
  for img in maqder-backend maqder-frontend maqder-pdf-worker; do
    if docker image inspect "${img}:latest" >/dev/null 2>&1; then
      echo "Image ready: ${img}:latest"
    fi
  done

  if [ "${USE_PREBUILT_IMAGES:-0}" != "1" ]; then
    ensure_docker_registry_dns
  fi

  # Fixed container_name values conflict across compose projects. Remove only
  # app containers so compose can recreate them; leave mongo/redis running.
  echo "Recreating app containers (keeping mongo/redis)..."
  for c in maqder_edge maqder_frontend maqder_backend maqder_pdf_worker; do
    docker rm -f "$c" 2>/dev/null || true
  done

  # Prefer cached base images when building on the server.
  PULL_FLAG=(--pull never)
  if getent hosts registry-1.docker.io >/dev/null 2>&1; then
    PULL_FLAG=(--pull missing)
  fi

  if [ "${USE_PREBUILT_IMAGES:-0}" = "1" ]; then
    echo "Starting stack with pre-built images (--no-build)..."
    # Bring data plane first if missing, then app services.
    $COMPOSE up -d --no-build mongo redis || true
    if ! $COMPOSE up -d --no-build --remove-orphans \
        edge backend frontend pdf-worker mongo redis mongo-backup; then
      echo "=== docker compose up --no-build failed — recent logs ==="
      $COMPOSE ps -a || true
      docker ps -a --format 'table {{.Names}}\t{{.Status}}\t{{.Image}}' | head -40 || true
      $COMPOSE logs --tail=80 backend frontend edge 2>/dev/null || true
      exit 1
    fi
  elif ! $COMPOSE up -d --build "${PULL_FLAG[@]}" --remove-orphans; then
    echo "Build with ${PULL_FLAG[*]} failed — retrying with --pull never..."
    if ! $COMPOSE up -d --build --pull never --remove-orphans; then
      echo "=== docker compose up failed — recent logs ==="
      $COMPOSE ps -a || true
      $COMPOSE logs --tail=120 backend frontend mongo redis pdf-worker 2>/dev/null || $COMPOSE logs --tail=120
      docker images | head -40 || true
      exit 1
    fi
  fi

  # Backend image IP can change — refresh frontend nginx upstream.
  $COMPOSE up -d --force-recreate --no-deps --no-build frontend \
    || $COMPOSE up -d --force-recreate --no-deps frontend \
    || $COMPOSE restart frontend \
    || true

  echo "Running containers:"
  $COMPOSE ps
  docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Image}}' | head -30 || true
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
