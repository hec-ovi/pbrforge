#!/usr/bin/env bash
# Starts ComfyUI (ROCm docker) with this box's custom nodes mounted.
# COMFY_DOCKER_DIR: the comfyui-strix-docker checkout (default: sibling of the urbe folder).
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
comfy_dir="${COMFY_DOCKER_DIR:-$here/../../../comfyui-strix-docker}"
[ -f "$comfy_dir/docker-compose.yml" ] || { echo "comfyui docker not found at $comfy_dir (set COMFY_DOCKER_DIR)"; exit 1; }
[ -d "$here/custom_nodes/ComfyUI-seamless-tiling" ] || "$here/setup.sh"
MATERIALS_CUSTOM_NODES="$here/custom_nodes" docker compose \
  -f "$comfy_dir/docker-compose.yml" -f "$here/override.yml" \
  --project-directory "$comfy_dir" up -d
echo "ComfyUI on http://127.0.0.1:8188"
