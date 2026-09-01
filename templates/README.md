# Templates

ComfyUI workflows in API format, submitted verbatim to POST /prompt after param injection.

- sdxl-tile.json: text to seamless albedo. SDXL with circular padding on UNet and VAE (SeamlessTile + CircularVAEDecode from ComfyUI-seamless-tiling, cloned by comfy/setup.sh).
- sdxl-exact.json: text to a single framed image for exact-alignment entries (doors, screen artwork). Plain SDXL, no circular padding: the image is placed 1:1, it never repeats.
- upscale-4x.json: a provided source image to a 4x version of itself, for screens generated from `screens[].imagePath` instead of diffused. Feed-forward, no sampler and no seed, so the same file always comes back the same picture.

Both SDXL graphs are injected by node id: 3 positive text, 4 negative text, 5 width/height, 6 seed. The upscale graph takes the uploaded file name in node 1.

The checkpoint name in node 1 of the SDXL graphs, and the upscale model name in node 2 of upscale-4x.json, must exist under the ComfyUI models mount; comfy/setup.sh fetches the upscaler.
