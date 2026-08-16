#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
IMAGE_NAME="${IMAGE_NAME:-mrmodn/wx-backend}"
IMAGE_TAG="${IMAGE_TAG:-20260816-amd64}"
OUTPUT_DIR="${OUTPUT_DIR:-$ROOT_DIR/release}"
IMAGE_REF="$IMAGE_NAME:$IMAGE_TAG"
TAR_PATH="$OUTPUT_DIR/mrmodn-wx-backend-${IMAGE_TAG}.tar"

for required in \
  "$ROOT_DIR/mRModN_WebAndWx_backend/epoch_040.pt" \
  "$ROOT_DIR/mRModN_WebAndWx_backend/data" \
  "$ROOT_DIR/SYSU-MM01/cam1" \
  "$ROOT_DIR/SYSU-MM01/cam6" \
  "$ROOT_DIR/outputs/best.pt"; do
  if [[ ! -e "$required" ]]; then
    echo "Missing required release asset: $required" >&2
    exit 1
  fi
done

mkdir -p "$OUTPUT_DIR"
echo "Building $IMAGE_REF for linux/amd64..."
docker buildx build \
  --platform linux/amd64 \
  --load \
  -f "$ROOT_DIR/Dockerfile.wx-release" \
  -t "$IMAGE_REF" \
  "$ROOT_DIR"

echo "Saving image to $TAR_PATH..."
docker save -o "$TAR_PATH" "$IMAGE_REF"
(cd "$OUTPUT_DIR" && sha256sum "$(basename "$TAR_PATH")" > "$(basename "$TAR_PATH").sha256")
cp "$ROOT_DIR/mRModN_WebAndWx_backend/wx-backend.env.example" "$OUTPUT_DIR/wx-backend.env.example"
cp "$ROOT_DIR/run_wx_backend_release.sh" "$OUTPUT_DIR/run_wx_backend_release.sh"
chmod +x "$OUTPUT_DIR/run_wx_backend_release.sh"
printf '%s\n' "$IMAGE_REF" > "$OUTPUT_DIR/IMAGE_REF"

echo "Release ready:"
ls -lh "$TAR_PATH" "$TAR_PATH.sha256" "$OUTPUT_DIR/wx-backend.env.example" "$OUTPUT_DIR/run_wx_backend_release.sh"
