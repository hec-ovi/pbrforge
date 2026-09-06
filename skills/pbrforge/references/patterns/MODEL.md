# Pattern model

A pattern is arithmetic on a point in metres. No SVG, no photo, no ComfyUI.

`Pattern.sample(u, v, du, dv)` wraps UV into one tile, then `texel(at)` runs. `at.x/at.y` are metres on the tile; `at.px/at.py` are the pixel size in metres (anti-alias with `line()` / `smoothstep`).

Each texel returns:

- `color` sRGB 0..1
- `height` 0..1, midplane 0.5
- `roughness` 0..1
- `opacity` only on decals

`create` rasters that, then writes **normal** and **AO** from height, **metallic** from `physical.metallicFactor`, **packed** from roughness + metallic.

`finish(face, cell, joint, at, relief)` is the shared cell/joint helper: tone spread, grain, joint darkening, height from `depth`, roughness from the entry factor plus sheen and joint.

Coordinates wrap. Same spec + seed + world size always draws the same maps.
