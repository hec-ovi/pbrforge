# Templates

ComfyUI workflows in API format, submitted verbatim to POST /prompt after param injection.

- sdxl-tile.json: text to seamless albedo. SDXL with circular padding on UNet and VAE (SeamlessTile + CircularVAEDecode from ComfyUI-seamless-tiling, cloned by comfy/setup.sh).
- sdxl-exact.json: text to a single framed image for exact-alignment entries (doors, screen artwork). Plain SDXL, no circular padding: the image is placed 1:1, it never repeats.

Both are injected by node id: 3 positive text, 4 negative text, 5 width/height, 6 seed.

The checkpoint name in node 1 must exist under the ComfyUI models/checkpoints mount.
