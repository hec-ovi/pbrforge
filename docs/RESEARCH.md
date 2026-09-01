# Research conclusions: PBR generation with ComfyUI (2026-08)

Full detail with sources lives in `.research/comfyui-pbr-generation/FINDINGS.md` (git-ignored, local). This file keeps only what the box builds on.

## Chosen pipeline

1. Base color generation: SDXL at 1024x1024 with circular padding (spinagon/ComfyUI-seamless-tiling: SeamlessTile + MakeCircularVAE). SDXL is the only mainstream model where tiling is architecturally exact (conv U-Net; DiT models like FLUX and Z-Image cannot tile this way), and it is the fastest option on this hardware (18.4 s per 1024 image on Strix Halo ROCm, 4.2x faster than FLUX.1-dev).
2. Map estimation from the generated albedo, as a swappable stage:
   - default lane (permissive licenses): Marigold-IID appearance (albedo, roughness, metallic) + DSINE normal (comfyui_controlnet_aux) + height integrated from normal + AO computed from height and normal.
   - optional lane: Ubisoft CHORD (best measured basecolor and metalness, tileable outputs via circular padding, height via ChordNormalToHeight). Research-only copyleft license, gated HF download, needs a manual accept. Off until the user opts in.
3. Emission: derived procedurally from the base color (luminance or color mask, soft threshold and falloff). No shipped model generates emission maps; for cyberpunk neon this derivation is the primary path.
4. Glass and other transparents: physical properties (transmission, tint, IOR, roughness) are authored values in the database entry, not estimated maps; generation contributes only surface-detail maps. Consumers use glTF KHR_materials_transmission semantics.
5. Exact-alignment materials (screens, video ads, image ads): 1:1 UV, no tiling machinery, base color + emission + low fixed roughness.
6. Resolution: generate and ship 1024. If 2K is ever needed: wrap-pad, upscale, crop (plain ESRGAN zero-padding breaks seams). Never diffusion-upscale a tile.
7. Verification on every set (hard requirement): 50 percent offset in x and y must show no seam, plus a 3x3 tiled render check. The tiling transform applies identically to every map of a set; delighting applies to albedo only.

## Generation lessons (validated on hardware)

- Checkpoint: RealVisXL V5.0 (photoreal SDXL fine-tune). Base SDXL over-structures flat material fields into abstract 3D collages; the fine-tune resolves metals, stone, fabric, wood.
- Describe the surface material, never the building element: "window frame metal" draws frames, "column cladding panels" draws blocks. Real photographic materials only; invented ones (composite cladding, solar-skin) go abstract.
- Near-uniform surfaces (glass, plain colors) cannot be diffused: CFG forces structure. They use the flat synthesis path (flatColor + seeded wrap noise), no ComfyUI involved.
- Regular geometry (solar cell grids) comes out warped; prefer concepts without strict regularity.
- Tile lane prompts: description + tile suffix + material-field block, negative without uniformity or symmetry terms (negating those poisons flat fields). Exact lane: bare description with concrete object anchors (a handle, a kick plate), minimal negative.
- Composed objects (door, elevator_door) still tend to collage; usable results need anchors and stay on the polish list.
- Ad screens: prompt the advertisement, never the screen. Asking for a glowing neon billboard image gives coloured plastic slabs. The artwork is generated flat (studio light, no glow, no lettering, no perspective, no building) and every display phenomenon is applied procedurally over it: dot lattice or scan bands, per-channel fringing, blown-out hotspots bleeding past the gaps, plus the same lattice faintly imprinted in the near-black basecolor so an unlit screen still reads as one.
- Ad prompt technique, three compared at one seed: "studio advertising photograph, flat frontal composition, one subject filling the frame, plain solid saturated backdrop" wins. A magazine-page framing brings the page fold, body columns and paper margins; a poster key-visual framing brings white paper and a duplicated product. Negative must carry text, letters, logo (the wordmark is composited later), halftone and dots (the structure is ours), and child/teenager (ad subjects otherwise skew young).
- Brand names are stroked in from a built-in geometric alphabet, not diffused: SDXL garbles lettering, and a composited wordmark lets one render serve any business name.
- Seam gate: wrap-edge mean diff relative to the worst interior column or row, threshold 1.2. Comparing to the global mean false-positives on grid textures (grout on the wrap column).

## Facts the design leans on

- ComfyUI runs headless; workflows are API-format JSON submitted to POST /prompt, polled on /history, images fetched from /view. Proven local pattern exists (censurado brain client, stdlib only).
- The local ComfyUI image (comfyui-strix-docker) is stock: custom nodes (seamless-tiling, controlnet_aux, estimator nodes) must be added via a custom_nodes bind mount or Dockerfile step, or they vanish on rebuild.
- Models on disk today: FLUX.2 klein 4B set only. An SDXL checkpoint must be downloaded (check ~/models first).
- Map conventions: basecolor and emission sRGB, all other maps linear; metallic-roughness workflow (three.js/GLB consumers).
- Prompting for flat tiles (from glb-buildings texture research): "long telephoto lens straight on" instead of render language, name the material finish and scale, seam falls on solid material, standard negative prompt, pure-material-field append for plain surfaces.

## Rejected

- Tiling DiT models with circular padding: no conv layers to pad, confirmed ineffective.
- StableMaterials as the estimator: weights exist but no ComfyUI node.
- Latent rolling and offset-inpaint tiling: workable but inexact; only needed if a DiT model ever becomes mandatory.
