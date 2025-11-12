#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
COMPOSE_FILE="$ROOT_DIR/docker-compose.yml"

if [ ! -f "$COMPOSE_FILE" ]; then
  echo "docker-compose.yml not found" >&2
  exit 1
fi

if docker compose version >/dev/null 2>&1; then
  DC="docker compose"
else
  DC="docker-compose"
fi

NO_CACHE=""
if [ "${1:-}" = "--no-cache" ]; then
  NO_CACHE="--no-cache"
fi

echo "Building images"
$DC -f "$COMPOSE_FILE" build --pull $NO_CACHE
echo "Recreating containers"
$DC -f "$COMPOSE_FILE" up -d --remove-orphans
echo "Services status"
$DC -f "$COMPOSE_FILE" ps
echo "Waiting for health checks"

wait_for_health() {
  name="$1"
  timeout="${2:-180}"
  elapsed=0
  while true; do
    status=$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{end}}' "$name" 2>/dev/null || echo "unknown")
    if [ "$status" = "healthy" ]; then
      echo "$name healthy"
      break
    fi
    sleep 3
    elapsed=$((elapsed+3))
    if [ "$elapsed" -ge "$timeout" ]; then
      echo "$name not healthy after $timeout seconds" >&2
      docker logs --tail 50 "$name" || true
      exit 1
    fi
  done
}

wait_for_health appsking_backend 180
wait_for_health appsking_frontend 180
echo "Deployment complete"