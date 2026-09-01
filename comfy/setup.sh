#!/usr/bin/env bash
# Fetches what the generation templates need beyond a stock ComfyUI: custom node
# packs (git-ignored, kept here) and the upscale model (into the models mount).
# COMFY_MODELS: the folder mounted at /app/ComfyUI/models.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
models="${COMFY_MODELS:-$HOME/models/comfyui}"
mkdir -p "$here/custom_nodes" "$models/upscale_models"

clone() {
  local url="$1" dir="$here/custom_nodes/$2"
  if [ -d "$dir" ]; then git -C "$dir" pull --ff-only; else git clone --depth 1 "$url" "$dir"; fi
}
clone https://github.com/spinagon/ComfyUI-seamless-tiling ComfyUI-seamless-tiling
echo "custom nodes ready in $here/custom_nodes"

upscaler="$models/upscale_models/4x-UltraSharp.safetensors"
if [ -f "$upscaler" ]; then
  echo "upscale model already at $upscaler"
else
  curl -fL -o "$upscaler" https://huggingface.co/Kim2091/UltraSharp/resolve/main/4x-UltraSharp.safetensors
  echo "upscale model fetched to $upscaler"
fi
