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
