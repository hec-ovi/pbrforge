# CONTRACT: materials

Purpose: generates and stores themed PBR material sets (maps, tiling config, physical properties) that the geometry layers resolve programmatically by key.

Status: v0.2. Schema stable to build against; additive fields may come, breaking changes go through the orchestrator.

## Key

Primary key: the string `theme/kind/tier`, all lowercase slugs (e.g. `cyberpunk/window-glass/rich`). Consumers (exterior, interior) name GLB materials with exactly this key; the index resolves it to maps, tiling config and alignment mode.

- tier slugs are atlas's, passed verbatim by consumers: `poor`, `mid`, `rich`, `high_rich`.
- kind is an open vocabulary; aliasing is allowed (several keys may resolve to one entry). Guaranteed minimum coverage for theme `cyberpunk`, every kind resolvable at all four tiers: wall, wall-trim, column, window-glass, window-frame, curtain, door, door-glass, balcony-slab, balcony-rail, roof, floor-slab, parapet, signage, ad-screen, light-fixture, fire-escape, aperture-frame, roof-artifact (exterior), plaster, tile, ceiling, wood, carpet, rubber, concrete, metal, elevator_door, fabric, glass (interior), sidewalk, road (ground) and letter-atlas (signage). door-glass, balcony-slab, balcony-rail, parapet and aperture-frame resolve via aliases.

## In

- `resolve(key: string): MaterialEntry` resolves a key (or alias) against the database.
- `list(filter?: {theme?, kind?, tier?}): string[]` returns matching keys, sorted, deterministic.
- `create(request: CreateRequest): MaterialEntry` generates a full set, verifies seams, writes it to the database. Request: [schema/create-request.schema.json](schema/create-request.schema.json). Basecolor comes from ComfyUI, from the pattern class below, from a tint of a variant already in the entry (`recolor`), or is synthesized procedurally when `flatColor` is set (glass, plain colors); the other maps always derive in-box.
- `append: true` adds the generated variant to the entry the key already resolves to, which keeps its alignment, tiling, aliases and physical; `variantId` names it (and its asset folder). Appending an id that exists is `E_KEY_EXISTS`, so a batch stays resumable.
- `recolor` writes a tint variant: the basecolor of another variant of the same entry pulled toward a color. It is the same surface in different paint, so it points at that variant's relief maps instead of copying them.

Screens (`emission: "image"`) turn that around: the basecolor is flat dark display glass and the picture lives in the emission map. `screens` lists one display per variant and sets the variant count. ComfyUI paints each advertisement as flat brandless artwork; the box makes it a screen: the pixel structure of its `kind` (`led-dot` dot lattice, `scanline-billboard` scan bands, `glyph-panel` abstract with no lattice), colour fringing, blown-out hotspots, and the `brandName` wordmark stroked in from a built-in alphabet. `brandName` never enters the diffusion prompt, so a screen rebrands without a new render; `businessKind` does steer the artwork. Both take a per-screen override.

CLI: `npm run resolve -- <key>`, `npm run create -- <request.json>` (a single request or an array; array mode skips keys that already exist, so batches are resumable).

## Pattern class

A variant whose maps are drawn from parameters instead of photographed: `pattern` in the create request states the shapes and colors, and the box renders basecolor, relief and gloss in code, anti-aliased and periodic over one tile by construction. No diffusion, no ComfyUI, small files, and crisp at any distance. It resolves under the same key and the same MaterialEntry shape as everything else, so a consumer never asks which class a variant is: it reads the maps.

Kinds and the parameters each one reads (full ranges in the request schema):

| kind | draws | reads |
| --- | --- | --- |
| `hexagon` | a hexagon grid, as edges or as gloss only | cells (columns, row pairs), line, sheen, joint |
| `panel-grid` | inset panels with chamfered edges and a flat recess | cells, line, bevel, depth, joint, bond |
| `slab` | large flush slabs cut by a narrow groove | cells, line, bevel, variation, bond |
| `stripe` | bands across one axis | cells, axis, split, line |
| `two-tone` | one split across the tile with a trim line | axis, split, line, three colors |
| `noise` | mottling in one to four octaves: plain wall to asphalt | cells, octaves, depth |
| `glyph-atlas` | the letter sheet below: one lit glyph per cell | line (core width), bevel (halo reach), three colors |

Shared over all of them: `colors` (face first), `depth` (relief), `joint` (how much darker and rougher a joint reads), `variation` (tone per cell), `sheen` (gloss per cell), `grain` (fine mottling). `line` and `bevel` are in metres, read against the entry's `tiling.worldSize`; `cells` are whole counts per tile, which is what makes the pattern wrap. On an `exact` entry the sheet stands in for the tile, so those two are fractions of the sheet (of a cell, for `glyph-atlas`).

Cyberpunk pattern library, per tier: plaster (`hex`, `panel`, `two-tone`), tile (`slab`), concrete (`panel`, one panel per tile so joints land on whole-tile faces), ceiling (`panel`, `plain`), sidewalk (`slab`, `bond`), road (`street`, `highway`), light-fixture (`strip`, `panel`: dark housing, lit diffuser). wall and concrete also carry tint variants of their photographed surfaces, so adjacent buildings read as different paint.

## Letter atlas

`cyberpunk/letter-atlas/<tier>` is one `exact` sheet of lit glyph cells for the modular sign system: aspect 4:3, 1024 by 768, two variants, `neon` (thin core, wide halo) and `panel` (backlit diffuser). The emission map carries the lit glyph; the basecolor is the unlit tube over a dark plate.

The grid is 8 columns by 6 rows, row-major, and the charset is `ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-.,'!?:/&+` plus a trailing space, 47 characters in 48 cells. A consumer maps one letter to `index = charset.indexOf(letter.toUpperCase())` and the UV rect `[ (index % 8) / 8, floor(index / 8) / 6, 1/8, 1/6 ]`. An unknown character has no index and gets a blank cell.

## Out

MaterialEntry: [schema/material-entry.schema.json](schema/material-entry.schema.json). Alignment (`tile` or `exact`), physical properties (breakable, factors, transmission for glass, emissive strength), tiling config (meters covered by one tile repeat; consumers lay UVs as 1 UV unit = 1 tile), and one or more variants, each a set of map files. Variant 0 is canonical; consumers may pick variants deterministically by seed. A variant carries `class` (`image` by default, `pattern` when it was drawn from parameters): provenance only, the map set and its use are identical.

Theme database: `themes/<theme>/theme.json` ([schema/theme-index.schema.json](schema/theme-index.schema.json)) plus map files under `themes/<theme>/assets/<kind>/<tier>/<variant>/`. The JSON is the index; the folder is the theme. First theme: `cyberpunk`.

Conventions (fixed, not per entry):
- Metallic-roughness workflow. basecolor and emission are sRGB; normal, roughness, metallic, height, ao are linear. Normals are OpenGL-style, +Y up.
- Tiled maps are seamless at exact resolution, verified; never stretched, never cut mid-feature.
- `exact` entries (screens, image ads, the letter atlas) are 1:1 UV placements: no tiling config, aspect ratio instead, and no seam gate. Screen entries carry flat normal, height and ao: a display has no relief.
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
- A key present in the index always has every referenced map file on disk. Variants may point at the same map file (a tint shares the relief it was made from).
- Every `tile` entry passed the seam check (50 percent offset in x and y, no visible seam) before it was written. Pattern variants are periodic over one tile by construction and pass the same gate.
- Generation is deterministic per lane: the same pattern parameters, or the same seed and prompt, draw the same maps.
- All maps of one variant share one resolution and are pixel-aligned with each other.
- Generation is agentic tooling on top; the database read path works standalone with no ComfyUI and no other layer present.

## Preview

`npm run preview`: the classic material sphere viewer (lighting, orbit), loads any key from the database. UI in `src/ui/` with `views/`, `widgets/`, `components/`.

## Depends on

None (root of the dependency graph).
