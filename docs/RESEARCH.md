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

## Reading a photograph into maps (2026-09)

- A photographed albedo carries its gloss and grain in every pixel. Maps read straight out of it put a specular highlight on every bright speck and a smooth patch under every dark blotch, which at night is glitter on the walls and damp-looking concrete.
- The split that works is two blurs of the luminance: a radius of width/384 keeps joints, bricks, aggregate and trowel strokes, and a radius of width/64 holds the photograph's own lighting. What lies between them is shape; what lies below the finer one is the camera's speckle, kept at 0.1 to 0.25 of its amplitude.
- Roughness belongs to the material, not to the pixel: a band of about 0.1 wide, centred a little above the surface's roughness factor, read off a blurred relief. Measured on the cyberpunk library, that takes the neighbouring-pixel step of a roughness map from 4-9/255 down to under 0.2/255, and the normal map's average lean from 30/255 to 4-12/255, where what is left is the surface's real structure.
- A noise field's finest octave has to land above roughly 8 px of the map, or it aliases into sparkle under a moving light. At 1024 over a 6 m road, three octaves from 8 cells puts the aggregate at 5 cm; four puts it on two pixels.
- Repainting a near-grey photograph takes the paint's hue whole and moves only the saturation. Meeting the paint halfway lands on a third hue (grey pulled halfway to blue comes out green), and multiplying the photograph's own saturation amplifies its colour noise.

## Procedural pattern surfaces (2026-09)

Structured surfaces (hexagon walls, panel grids, floor slabs) are arithmetic on where a point sits on the surface in metres, not diffusion: a drawn pattern is crisp at any size, cannot jog where it is cut to tile, and costs a fraction of the file size. Diffusion keeps what it is good at, which is stochastic grain, wear and grime.

- Two numbers carry every pattern: how far the point is from the nearest joint, and one number per cell. The finish reads them; the shapes stay separate from the look.
- Hexagons: the lattice period is (1, sqrt3) in units of one hexagon width, as two staggered lattices; a point takes whichever centre is nearer, and its distance from the boundary is `0.5 - max(|x|/2 + |y|*sqrt3/2, |x|)`. Whole cell counts per tile in both axes are what makes it wrap; hexagons come out regular when the column count is about 1.73 times the row-pair count (7 by 4, 12 by 7).
- The finish, not the pattern, decides how hard it reads: a joint darkens the face by 0.35 to 0.6 and roughens it by 0.4 of that; per-cell tone spread runs 0.03 to 0.12. A printed wall is the same pattern with no joint darkening and a gloss spread of 0.14 to 0.26, so it exists only in the reflection. That is what makes a hexagon wall subtle instead of a drawn grid.
- Scales that read right in a room: floor tiles 0.45 to 0.6 m, hexagons 0.3 to 0.5 m across, ceiling panels 1.2 m, wall hexagons 0.45 to 0.5 m, planks 0.2 m by 1.7 m.
- Joint widths: a live shader draws a 6 mm joint with a 4 mm fade. A baked 1024 map over a 3 m tile is 2.9 mm per pixel, so joints are authored at 12 to 30 mm (panel joints and pavement joints are that wide anyway) and anti-aliased against the pixel they are sampled for.
- Interior roughness: floors 0.22 to 0.55, walls 0.34 to 0.70, ceilings 0.5 to 0.9. No interior surface is metal: a dark colour at low roughness catches the room's own light, where a mirror indoors comes out a hole.
- Palettes that hold up: a cool graphite interior (surfaces 0x3a3d42 to 0x6e7175, structure 0x2b2f34, pale tops 0xc7c3b9, one teal accent 0x1f6f7a, cool white strips 0xbdf0ff) and a warm one (surfaces 0x655a60 to 0x968a8d, plum accent 0x8e2338, warm strips 0xff6478). One saturated accent per room, everything else neutral.
- Emissive strips are authored by luminance, not by a multiplier: 0xbdf0ff carries 0.80 of luminance and 0xff6478 only 0.32, so one strength over both makes one strip architecture and the other a painted line.
- An image laid under a pattern is grain, not a multiplier: divide it by its own mean so it sits around 1, or the colour that was asked for comes out a fraction of itself.

## Facts the design leans on

- ComfyUI runs headless; workflows are API-format JSON submitted to POST /prompt, polled on /history, images fetched from /view. Proven local pattern exists (a prior stdlib-only client).
- The local ComfyUI image is stock: custom nodes (seamless-tiling, controlnet_aux, estimator nodes) must be added via a custom_nodes bind mount or Dockerfile step, or they vanish on rebuild.
- Models on disk today: FLUX.2 klein 4B set only. An SDXL checkpoint must be downloaded (check the local model store first).
- Map conventions: basecolor and emission sRGB, all other maps linear; metallic-roughness workflow (three.js/GLB consumers).
- Prompting for flat tiles (from glb-buildings texture research): "long telephoto lens straight on" instead of render language, name the material finish and scale, seam falls on solid material, standard negative prompt, pure-material-field append for plain surfaces.

## Rejected

- Tiling DiT models with circular padding: no conv layers to pad, confirmed ineffective.
- StableMaterials as the estimator: weights exist but no ComfyUI node.
- Latent rolling and offset-inpaint tiling: workable but inexact; only needed if a DiT model ever becomes mandatory.
