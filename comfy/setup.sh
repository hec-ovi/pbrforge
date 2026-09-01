#!/usr/bin/env bash
# Clones the custom node packs the generation templates need (git-ignored).
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
mkdir -p "$here/custom_nodes"
clone() {
  local url="$1" dir="$here/custom_nodes/$2"
  if [ -d "$dir" ]; then git -C "$dir" pull --ff-only; else git clone --depth 1 "$url" "$dir"; fi
}
clone https://github.com/spinagon/ComfyUI-seamless-tiling ComfyUI-seamless-tiling
echo "custom nodes ready in $here/custom_nodes"
