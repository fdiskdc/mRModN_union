#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
IMAGE_REF="${IMAGE_REF:-$(cat "$SCRIPT_DIR/IMAGE_REF" 2>/dev/null || echo 'mrmodn/wx-backend:20260816-amd64')}"
ENV_FILE="${ENV_FILE:-$SCRIPT_DIR/wx-backend.env}"
CONTAINER_NAME="${CONTAINER_NAME:-mrmodn-wx-backend}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE. Copy wx-backend.env.example to wx-backend.env and fill WX_APPID/WX_SECRET." >&2
  exit 1
fi

docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true
docker run -d \
  --name "$CONTAINER_NAME" \
  --restart always \
  --env-file "$ENV_FILE" \
  -p 127.0.0.1:8000:8000 \
  "$IMAGE_REF"

echo "Started $CONTAINER_NAME. Nginx can continue proxying /rgcnformer/api/v1/ to 127.0.0.1:8000/api/v1/."
echo "Health: curl http://127.0.0.1:8000/api/v1/health"
