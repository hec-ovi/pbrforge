# CONTRACT: materials

Purpose: generates and stores themed PBR material sets (maps, tiling config, physical properties) that the geometry layers resolve programmatically by key.

Status: v0.1. Schema stable to build against; additive fields may come, breaking changes go through the orchestrator.

## Key

Primary key: the string `theme/kind/tier`, all lowercase slugs (e.g. `cyberpunk/window-glass/rich`). Consumers (exterior, interior) name GLB materials with exactly this key; the index resolves it to maps, tiling config and alignment mode.

- tier slugs are atlas's, passed verbatim by consumers: `poor`, `mid`, `rich`, `high_rich`.
- kind is an open vocabulary; aliasing is allowed (several keys may resolve to one entry). Guaranteed minimum coverage for theme `cyberpunk`, every kind resolvable at all four tiers: wall, wall-trim, column, window-glass, window-frame, curtain, door, door-glass, balcony-slab, balcony-rail, roof, floor-slab, parapet, signage, ad-screen, light-fixture, fire-escape, aperture-frame, roof-artifact (exterior) and plaster, tile, wood, carpet, rubber, concrete, metal, elevator_door, fabric, glass (interior). door-glass, balcony-slab, balcony-rail, parapet and aperture-frame resolve via aliases.

## In

- `resolve(key: string): MaterialEntry` resolves a key (or alias) against the database.
- `list(filter?: {theme?, kind?, tier?}): string[]` returns matching keys, sorted, deterministic.
- `create(request: CreateRequest): MaterialEntry` generates a full set, verifies seams, writes it to the database. Request: [schema/create-request.schema.json](schema/create-request.schema.json). Basecolor comes from ComfyUI, or is synthesized procedurally when `flatColor` is set (glass, plain colors); the other maps always derive in-box.

Screens (`emission: "image"`) turn that around: the basecolor is flat dark display glass and the picture lives in the emission map. `screens` lists one display per variant and sets the variant count. ComfyUI paints each advertisement as flat brandless artwork; the box makes it a screen: the pixel structure of its `kind` (`led-dot` dot lattice, `scanline-billboard` scan bands, `glyph-panel` abstract with no lattice), colour fringing, blown-out hotspots, and the `brandName` wordmark stroked in from a built-in alphabet. `brandName` never enters the diffusion prompt, so a screen rebrands without a new render; `businessKind` does steer the artwork. Both take a per-screen override.

CLI: `npm run resolve -- <key>`, `npm run create -- <request.json>` (a single request or an array; array mode skips keys that already exist, so batches are resumable).

## Out

MaterialEntry: [schema/material-entry.schema.json](schema/material-entry.schema.json). Alignment (`tile` or `exact`), physical properties (breakable, factors, transmission for glass, emissive strength), tiling config (meters covered by one tile repeat; consumers lay UVs as 1 UV unit = 1 tile), and one or more variants, each a set of map files. Variant 0 is canonical; consumers may pick variants deterministically by seed.

Theme database: `themes/<theme>/theme.json` ([schema/theme-index.schema.json](schema/theme-index.schema.json)) plus map files under `themes/<theme>/assets/<kind>/<tier>/<variant>/`. The JSON is the index; the folder is the theme. First theme: `cyberpunk`.

Conventions (fixed, not per entry):
- Metallic-roughness workflow. basecolor and emission are sRGB; normal, roughness, metallic, height, ao are linear. Normals are OpenGL-style, +Y up.
- Tiled maps are seamless at exact resolution, verified; never stretched, never cut mid-feature.
- `exact` entries (screens, video ads, image ads) are 1:1 UV placements: no tiling config, aspect ratio instead, and no seam gate. Screen entries carry flat normal, height and ao: a display has no relief.
- Glass semantics follow glTF `KHR_materials_transmission` (+ `KHR_materials_emissive_strength` for emissives).

## Errors

Thrown as `MaterialsError { code, message, details? }`, closed set:
- `E_SCHEMA`: request or index fails schema validation; message names the path.
- `E_KEY_NOT_FOUND`: key and aliases resolve to nothing.
- `E_KEY_EXISTS`: create would overwrite an existing key without `overwrite: true`.
- `E_THEME_NOT_FOUND`: theme folder or theme.json missing.
- `E_COMFY_UNAVAILABLE`: ComfyUI not reachable or not ready.
- `E_GENERATION_FAILED`: workflow submitted but failed or timed out.
- `E_SEAM_CHECK_FAILED`: generated set failed the seam verification; nothing is written.

## Invariants

- Resolution is pure and deterministic: same database state, same key, same entry.
- A key present in the index always has every referenced map file on disk.
- Every `tile` entry passed the seam check (50 percent offset in x and y, no visible seam) before it was written.
- All maps of one variant share one resolution and are pixel-aligned with each other.
- Generation is agentic tooling on top; the database read path works standalone with no ComfyUI and no other layer present.

## Preview

`npm run preview`: the classic material sphere viewer (lighting, orbit), loads any key from the database. UI in `src/ui/` with `views/`, `widgets/`, `components/`.

## Depends on

None (root of the dependency graph).
