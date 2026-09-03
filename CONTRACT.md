# CONTRACT: materials

Purpose: generates and stores themed PBR material sets (maps, tiling config, physical properties) that the geometry layers resolve programmatically by key.

Status: v0.3. Schema stable to build against; additive fields may come, breaking changes go through the orchestrator.

## Key

Primary key: the string `theme/kind/tier`, all lowercase slugs (e.g. `cyberpunk/window-glass/rich`). Consumers (exterior, interior) name GLB materials with exactly this key; the index resolves it to maps, tiling config and alignment mode.

- tier slugs are atlas's, passed verbatim by consumers: `poor`, `mid`, `rich`, `high_rich`.
- kind is an open vocabulary; aliasing is allowed (several keys may resolve to one entry). Guaranteed minimum coverage for theme `cyberpunk`, every kind resolvable at all four tiers: wall, wall-trim, column, window-glass, window-frame, curtain, door, door-glass, balcony-slab, balcony-rail, roof, floor-slab, parapet, signage, ad-screen, light-fixture, fire-escape, aperture-frame, roof-artifact (exterior), plaster, tile, ceiling, wood, carpet, rubber, concrete, metal, elevator_door, fabric, glass (interior), sidewalk, road, curb (ground), plastic (street props), ad-screen-tall (a 9:16 portrait billboard, where `ad-screen` is 16:9), letter-atlas (signage) and ac-unit (a condenser face for the facade). door-glass, balcony-slab, balcony-rail, parapet and aperture-frame resolve via aliases; the four tiers of plastic, of curb and of ad-screen-tall each resolve to one entry, a refuse sack, a kerb stone and a portrait billboard being the same in every district.

## In

- `resolve(key: string): MaterialEntry` resolves a key (or alias) against the database.
- `list(filter?: {theme?, kind?, tier?}): string[]` returns matching keys, sorted, deterministic.
- `create(request: CreateRequest): MaterialEntry` generates a full set, verifies seams, writes it to the database. Request: [schema/create-request.schema.json](schema/create-request.schema.json). Basecolor comes from ComfyUI, from the pattern class below, from a tint of a variant already in the entry (`recolor`), or is synthesized procedurally when `flatColor` is set (glass, plain colors); the other maps always derive in-box. Resolution must fit the physical tile or exact-placement aspect within one pixel. A tile is at most 1,048,576 pixels; an exact sheet is at most 4096 px on either side and 9,437,184 pixels total.
- `append: true` adds the generated variant to the entry the key already resolves to, which keeps its alignment, tiling, aliases and physical; `variantId` names it (and its asset folder). Appending an id that exists is `E_KEY_EXISTS`, so a batch stays resumable. `canonical: true` on an append puts the variant first, so it is the one a consumer gets when it does not pick.
- `recolor` writes a tint variant: another variant of the same entry repainted. The paint's hue is taken whole and `strength` is how much pigment is in it, so a blue paint reads blue over a near-grey photograph. It is the same surface in different paint, so it points at that variant's relief maps instead of copying them.
- `finish` states how a photographed surface is read into relief and gloss (see Finish below). An appended variant inherits the entry's finish, so every photographed variant of one entry shares a band. The pattern, flat, recolor and screen lanes carry their own maps and ignore it.
- `refinish(request: RefinishRequest): { entry, variants }` re-reads the relief, gloss and metallic maps of every photographed variant of an entry from its stored basecolor, under a stated finish and factors, updates the entry, and names the variants it touched. The basecolor is never touched, so a set already approved keeps its look. Request: `{ key, finish?, physical? }`, where `physical` is merged into the entry's before the maps are read. An entry with no photographed variant (a screen, a drawn pattern) is `E_SCHEMA`.

Screens (`emission: "image"`) turn that around: the basecolor is flat dark display glass and the picture lives in the emission map. `screens` lists one display per variant and sets the variant count. ComfyUI paints each advertisement as flat brandless artwork; the box makes it a screen: the pixel structure of its `kind` (`led-dot` dot lattice, `scanline-billboard` scan bands, `glyph-panel` abstract with no lattice), colour fringing, blown-out hotspots, and the `brandName` wordmark stroked in from a built-in alphabet. `brandName` never enters the diffusion prompt, so a screen rebrands without a new render; `businessKind` does steer the artwork. Both take a per-screen override.

A screen can be painted from a picture that already exists instead: `imagePath` on a `screens[]` entry names a file relative to the box folder. A source large enough to cover the requested resolution is fitted locally. An undersized source goes through the deterministic ComfyUI 4x upscale first. Nothing downstream changes: the same lattice, fringing, hotspots and wordmark run over it, and the diffusion prompt is never built. A path with no file behind it is `E_SCHEMA`.

Every screen variant keeps the brandless picture it shows beside its maps, with the display it is shown on (`screen` on the variant, see Out). That is what the rebrand lane composites a name over.

- `rebrand(request: RebrandRequest): Branded[]` spells the businesses of a named world over the screens of their tier, one `brand:<slug>` variant per business on `ad-screen` and on `ad-screen-tall`, with no render (see Rebrand below).

CLI: `npm run resolve -- <key>`, `npm run create -- <request.json>` (a single request or an array; array mode skips keys that already exist, so batches are resumable), `npm run refinish -- <request.json>` (re-reads every key in the file that states a finish), `npm run rebrand -- --theme <theme> --businesses <businesses.json>` (`--themes <dir>` points it at another database folder).

## Finish

A photograph carries its own gloss and grain in every pixel. Read straight out, bright specks come back shiny and dark blotches come back damp, which at night is glitter on the walls and wet patches on dry concrete. The finish is what the surface is instead:

- `roughness: [min, max]` is the band the roughness map stays inside. It is read off a blurred relief, so gloss moves over centimetres of surface and never per pixel. Default: the entry's `roughnessFactor` plus or minus 0.05.
- `grain` (default 0.2) is how much of the pixel-scale speckle survives into the relief. Everything above the feature scale (joints, bricks, aggregate, trowel strokes) comes through at full gain either way.
- `relief` (default 2) is the gain on that feature-scale relief.

Dry matte is the default across the library: moisture staining and heavy grime live in the poor tier's basecolor and nowhere else. The whole library sits on a matte floor: every non-emissive entry carries metallic 0 (1 on the metal kinds: metal, window-frame, door, wall-trim, elevator_door, fire-escape, roof-artifact and the zinc roof) and no roughness below 0.45, in its factor, its band and every pixel of its roughness map, so nothing sparkles under a street lamp. Glass (an entry with transmission) and lit entries (screens, light fixtures and the letter atlas) are the exceptions. Bands per kind and tier, all four tiers left to right (poor, mid, rich, high_rich):

| kind | poor | mid | rich | high_rich |
| --- | --- | --- | --- | --- |
| wall | 0.88-0.96 | 0.82-0.92 | 0.70-0.80 | 0.56-0.66 |
| plaster | 0.88-0.95 | 0.80-0.88 | 0.66-0.74 | 0.55-0.65 |
| tile | 0.56-0.64 | 0.51-0.59 | 0.46-0.54 | 0.45-0.52 |
| every other photographed kind | the roughness factor, plus or minus 0.05, floored at 0.46 | | | |

Grain and relief ramp with the tier for every photographed kind: grain 0.25, 0.2, 0.15, 0.1 and relief 2, 2, 1.6, 1.2. Steel parts do not use photographed surfaces: `metal`, `fire-escape` and `roof-artifact` carry flat dark paint and zinc, while `elevator_door` draws its fitted center seam. Fire-escape and roof-artifact maps are 256 px over 0.5 m, enough for shaped rails, treads and equipment shells without carrying a pattern over them. `concrete`, `floor-slab` and `roof` are also fully deterministic, with no photographed grain. Finished `wood` drops to grain 0.08 and 0.06 on its two upper tiers. A drawn pattern states its own gloss instead: it sits at the entry's roughness factor, plus the joint bump (`joint` times 0.4) on the joint lines and the `sheen` spread from cell to cell. Asphalt is a three-octave noise field, so its finest aggregate sits around five centimetres of road and not on one pixel.

## Floors and balconies

`floor-slab` (with `balcony-slab` aliased to it) covers 3 x 3 m at 512 px. `plain` is canonical, completely flat and joint-free, so any floor, roof terrace or balcony face can use it without a cropped pattern. `large-slab` is a 1.5 m square grid; `bond` is a 1 x 0.75 m running bond. The two patterned variants are selected only for zones whose bounds hold whole repeats. All three are dry matte dielectric surfaces, from roughness 0.82 to 0.58 by tier.

`roof` also covers 3 x 3 m at 512 px. `plain` is the joint-free canonical deck. `seam` adds restrained half-metre roofing courses or standing seams, and `service-panel` adds a 1 m grid; both are selected only on roof zones that hold whole repeats. Every variant is matte and grain-free. The rich tier is dark zinc at metallic 1; the other tiers are dielectric roof membranes.

## Concrete

`concrete` covers 3 x 3 m at 512 px with four deterministic variants: subtly mottled `plain` (canonical), `panel`, `rib` and `block`. `panel` stacks two 3 x 1.5 m precast modules per tile, giving each panel the reference's 2:1 aspect with a chamfered joint on the tile edge and horizontal centre. Relief, tonal drift and fine grain decrease by tier; none comes from a photograph. A consumer uses `plain` on arbitrary faces and reserves the other variants for faces whose bounds hold whole repeats.

## Frame steel

`window-frame` (with `balcony-rail` and `aperture-frame` aliased to it), `door` (the leaf and its casing) and `wall-trim` are one smooth dark steel at every tier: one flat `paint` variant, synthesized and never photographed, tile 0.5 x 0.5 m at 256 px for the frames and the door (2 mm per pixel) and 1 x 1 m for the trim, metallic 1, roughness a constant 0.5, a flat normal, and nothing in the basecolor beyond a tonal drift under two percent, so a 0.06 m member shows no speckle, no grain and no repeat. The frame and the leaf share the same near-black paint (`#24272b` and `#25282c`), the trim sits a shade lighter (`#2a2d31`), and the door is laid with the same world-metre UVs as the frames. `column` uses the same flat lane for two honed stone tones per tier (`plain`, then `warm`), from chalky concrete at roughness 0.76 to black stone at 0.54. Its 1.5 x 3 m tile is 256 x 512 px, so texel density is equal on both axes. Held by a test over the shipped database.

`elevator_door` is exact on a 1:2 face at 512 x 1024 px. Its two variants are drawn two-leaf steel doors with the only relief at the outer edge and center seam, roughness 0.75 down to 0.52 by tier, metallic 1, and no photographic marks. A consumer maps one complete door face to UV 0..1.

## Ground

The ground kinds carry the tile sizes the engine lays on its 1 mm grid, so a cut lands on a joint and never inside a slab:

| kind | tile | maps | variants |
| --- | --- | --- | --- |
| `road` | 3.5 x 7 m, one lane wide, V along the lane | 512 x 1024 | `street` (canonical) and `highway` wear two wheel tracks 0.4 m wide at 0.8 m either side of the lane centre, darker and damp (roughness 0.5 in the track, the factor between); `patched` and `puddle` are isotropic |
| `sidewalk` | 2 x 2 m | 1024 | `slab` (canonical): 1 m squares with the joint on the tile edge; `bond`: 1 x 0.5 m running; `plate`: one 2 m plate |
| `curb` | 2 x 0.15 m, one entry at all tiers | 1280 x 96 | `stone`: two 1 m kerb stones with a chamfered arris |

Lay `road` with U across the lane from its left boundary so the tracks sit under the wheels; a consumer that lays planar world UVs over a merged roadway takes `patched` or `puddle`. Lay `sidewalk` with its UV origin on the kerb line so the first joint runs parallel to it. The `curb` tile spans the 0.15 m face with V from the road up, and the same tile lays the 0.15 m top. `puddle` is asphalt after rain: damp patches pooled in the low spots, flat and dark, roughness 0.5 inside them.

`light-fixture` is one luminaire per tile of 0.16 x 0.28 m at 256 x 448 px, so a fixture face of that size spans exactly one tile. `lamp` (canonical) is a recessed lens with a hot centre inside a 26 mm housing, `strip` one uniform diffuser whose housing is the fixture geometry, `panel` an even diffuser vignetting into an 18 mm frame; emission comes off the lens. Emissive strength is 1.2, set so the lens renders its falloff instead of clipping to a solid face: at the size a facade samples one fixture, the housing stays unlit, about half the face carries the gradient and only the hot centre blooms. Held by a test over the shipped database.

## AC unit

`ac-unit` is the condenser exterior hangs on a facade: one face per unit, `exact` on a 1 x 1 m square at 1024 px, so the box's front carries it 1:1 and its sides take the same face or a painted flat. `grille` (canonical) is a painted housing with a folded edge lip and a round flange around a wire grille, rings at 18 mm on four spokes, over the dark fan cavity with the hub and blades behind; painted, metallic 0. The tier is the age: poor is chalky off-white with rust at the flange and grime down the housing at roughness 0.7, mid light grey with some grime, rich clean pale grey, high_rich graphite and near clean at 0.5.

## Window glass

A pane at full transmission is an open hole: it passes everything the renderer puts behind it and keeps none of the reflection in front of it, so a facade reads as empty frames. A window keeps part of the light instead, which is what lets the environment read on the glass. Reflection itself comes from the renderer's environment; the entry's job is to leave room for it.

`transmission` is the glTF `KHR_materials_transmission` factor and `tint` is the glass's own colour. Roughness stays low, so the roughness band is the factor plus or minus 0.05, the default of the table above.

The tier is the building. poor and mid are residential windows: neutral glass, worn at the bottom of the range. rich and high_rich are office curtain wall: blue-green coated, the lowest transmission in the family, so reflection dominates.

| kind | tier | transmission | tint | roughness factor |
| --- | --- | --- | --- | --- |
| window-glass (`door-glass` aliases to it) | poor | 0.60 | `#b4b8b4` neutral | 0.15 |
| | mid | 0.52 | `#bcc4c2` neutral | 0.10 |
| | rich | 0.42 | `#93b4ac` blue-green | 0.06 |
| | high_rich | 0.35 | `#7fa5a6` blue-green | 0.04 |

The interior `glass` kind is clear glazing for partitions and carries its own values.

## Curtains

`curtain` covers a 1.5 x 3 m window bay at 384 x 768 px, equal density on both axes. Every tier carries `blind` (canonical), twelve vertical 0.125 m slats with shallow deterministic pleats, and `shade`, a plain matte blackout cloth. Neither uses a photographed weave, so minified window coverings keep their shape without moire or grain.

## Sign casing

`signage` is the non-emissive casing and backing plate behind the separate `letter-atlas` glyphs. It carries `casing` (canonical) and a muted color `backplate`, both flat dielectric paint on a 0.5 m tile at 256 px, roughness 0.72 down to 0.52 by tier. Illumination comes only from the fitted glyph cells, so the sign keeps a dark housing around its letters.

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
| `lane` | asphalt with two wheel tracks worn along it | everything `noise` reads, plus axis (the lane's direction), split (track spacing across the tile), line (track width), wear |
| `puddle` | a noise field with damp patches pooled over it | everything `noise` reads, plus wet, plus a third color for the patch |
| `lamp` | one luminaire: a housing bezel around a lens with a hot centre | line (bezel width), bevel (chamfer to the lens), split (hot centre reach), three colors (lens, housing, centre) |
| `glyph-atlas` | the letter sheet below: one lit glyph per cell | line (core width), bevel (halo reach), three colors |
| `grille` | one condenser face: a wire grille of rings on four spokes over the fan cavity, in a painted housing with a flange, dirt at the edges | line (ring pitch), bevel (flange width), split (grille diameter over the face), joint (how dark the wire reads), wear (dirt), three colors (paint, cavity, dirt) |

Inside a puddle the surface goes flat, dark and damp: one level over the asphalt, so the normal map is unbroken there, and roughness 0.5, the same a wheel track wears to, so a lamp lands on it as a soft reflection. `wet` moves the waterline, 0 leaving it dry and 0.5 flooding about half the tile; the mask is two octaves of the same wrapping lattice as the asphalt, so puddles tile with the road they sit in. A lane's tracks darken the asphalt by up to 35 percent and pull its roughness toward the same 0.5 by `wear`, breathing along the run on the lane's own lattice.

Shared over all of them: `colors` (face first), `depth` (relief), `joint` (how much darker and rougher a joint reads), `variation` (tone per cell), `sheen` (gloss per cell), `grain` (fine mottling). `line` and `bevel` are in metres, read against the entry's `tiling.worldSize`; `cells` are whole counts per tile, which is what makes the pattern wrap. On an `exact` entry the sheet stands in for the tile, so those two are fractions of the sheet (of a cell, for `glyph-atlas`).

Cyberpunk pattern library, per tier: plaster (`plain`, canonical, then `hex`, `panel`, `two-tone`), tile (`slab`, `mosaic`, `bond`), concrete (`plain`, canonical, then 2:1 `panel`, `rib` and `block`), ceiling (`plain`, canonical: smooth dark paint, then `panel`: restrained 0.5 m insets), floor-slab (`plain`, canonical and joint-free, then `large-slab` and `bond` for whole-repeat zones), roof (`plain`, canonical and joint-free, then `seam` and `service-panel` for whole-repeat zones), wall (`panel-ochre`: ochre painted precast panels with chamfered seams, tonal variation only), elevator doors (`split`, then `graphite`: two leaves with an exact center seam), curtains (`blind`, then `shade`: shallow vertical slats or plain cloth), fabric (`flat`: even upholstery cloth, matte, whose normal map leans under one code value off flat, so a part small enough to minify a photographed weave has nothing left to alias), sidewalk (`slab`, `bond`, `plate`), road (`street`, `highway`, `patched`, `puddle`), curb (`stone`), plastic (`bag`: crumpled near-black sheet at 0.55 roughness, the sheen of a refuse sack), light-fixture (`lamp`, `strip`, `panel`), ac-unit (`grille`). Variants of one kind are laid out to read apart at a glance: they differ in tone, in cell size and in bond, not in fine detail. Wall and plaster also carry tint variants of their photographed surfaces, so adjacent buildings read as different paint.

## Rebrand

A business of the named world gets its own screens. `rebrand({ theme, businesses })` writes, for every business, one variant of `<theme>/ad-screen/<tier>` and one of `<theme>/ad-screen-tall/<tier>`: the brandless artwork of a screen variant already in that entry with the brand name spelled over it from `<theme>/letter-atlas/<tier>` cells, shown through the same display as the screen it came from. Image work only: no ComfyUI, no render, and the same list writes the same maps every time. `businesses` is [schema/rebrand-request.schema.json](schema/rebrand-request.schema.json), a list of `{ brandName, businessKind, tier }`, `businessKind` one of the parcel types that advertise: `hotel`, `commerce`, `mall`, `restaurant`, `coffee_shop`, `corpo`, `clinic`.

- Variant id: `brand:<slug>`, the name lowercased with every run of characters outside `a-z0-9` collapsed to one hyphen, so `Kiro's Clinic` is `brand:kiro-s-clinic`. A consumer resolves the entry and takes `variants.find((v) => v.id === 'brand:' + slug)`, the way it picks any variant by id. The maps live under `assets/<kind>/<tier>/brand/<slug>/`.
- Which picture: a stable pick among the entry's screen variants (those carrying `screen`), from `businessKind` and the slug together, so a name always lands on the same picture and a street of businesses spreads over the tier's artwork.
- The wordmark: the name trimmed, single-spaced and uppercased, every character one cell of the atlas. It sits centred over the bottom of the picture, cap height a tenth of a landscape screen's height or 0.16 of a portrait screen's width. A line wider than 0.86 of the screen breaks at the space nearest its middle; a line still too wide shrinks to fit. poor and mid spell in the `neon` sheet, rich and high_rich in `panel`. The picture under the letters goes behind a soft dark scrim, so the name reads over any artwork.
- A brand variant shares the base variant's surface maps (basecolor, relief, gloss) and carries its own emission. The base variants and their files stay untouched, and rerunning the same list replaces the same variants with the same maps.
- `ad-screen-tall` is one entry across tiers, so a business's tall variant lands on that entry whichever tier it states, spelled in its own tier's look.

An empty list is valid input: a world with no advertising parcel brands nothing and the lane returns an empty result. Errors, thrown before anything is written: a business kind outside the parcel types, a name with a character outside the atlas charset after uppercasing, or a name with no letter or digit to make a slug of is `E_SCHEMA`; a tier with no `ad-screen`, `ad-screen-tall` or `letter-atlas` entry, or an entry with no screen variant behind it, is `E_KEY_NOT_FOUND`.

`batch/cyberpunk/businesses.json` is the request shape with one business, and its two variants ship in the database as the sample. A world's own brands belong to that world: point `--themes <dir>` at the world's copy of the theme folder, and the maps and index entries land there. The shipped library carries only the sample, held by a test that every map the index references is in the repo, so a fresh clone resolves every key.

## Letter atlas

`cyberpunk/letter-atlas/<tier>` is one `exact` sheet of lit glyph cells for the modular sign system: aspect 4:3, 1024 by 768, two variants, `neon` (thin core, wide halo) and `panel` (backlit diffuser). The emission map carries the lit glyph; the basecolor is the unlit tube over a dark plate.

The grid is 8 columns by 6 rows, row-major, and the charset is `ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-.,'!?:/&+` plus a trailing space, 47 characters in 48 cells. A consumer maps one letter to `index = charset.indexOf(letter.toUpperCase())` and the UV rect `[ (index % 8) / 8, floor(index / 8) / 6, 1/8, 1/6 ]`. An unknown character has no index and gets a blank cell.

## Out

MaterialEntry: [schema/material-entry.schema.json](schema/material-entry.schema.json). Alignment (`tile` or `exact`), physical properties (breakable, factors, transmission for glass, emissive strength), tiling config (meters covered by one tile repeat; consumers lay UVs as 1 UV unit = 1 tile), and one or more variants, each a set of map files. Variant 0 is canonical (the plain or the lead variant of its kind); consumers may pick variants deterministically by seed or by id (`flat`, `plain`, `brand:<slug>`). A variant carries `class` (`image` by default, `pattern` when drawn from parameters, `flat` when synthesized from one color): provenance only, the map set and its use are identical. Structured exterior variants also carry `layout`: visible material family, module dimensions, joint width, stable world origin and orientation in metres. Fine grain is independent and does not create layout seams. A screen variant painted by the create lane also carries `screen`: the display it is shown on (`kind`, `pitch`) and `artwork`, the brandless picture behind its emission, which the rebrand lane composites over; consumers never bind it. An entry with photographed variants also carries the `finish` its maps were read under.

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
- Generation is deterministic per lane: the same pattern parameters, the same seed and prompt, or the same provided source file, draw the same maps.
- Structured exterior variants publish their visible module dimensions, joint width, stable origin and orientation in `layout`. Consumers place the tile from that origin instead of restarting UVs on each polygon.
- All maps of one variant share one resolution and are pixel-aligned with each other. Resolution has the same aspect as the physical tile or exact-placement face within one pixel, so maps are never stretched or rotated. Tile maps are at most 1,048,576 pixels; exact sheets are at most 4096 px on either side and 9,437,184 pixels total. Checked against the files in the shipped database.
- A rebrand never touches a base variant or its files: a brand variant points at the base's surface maps and carries its own emission, and the same business list writes the same maps every time.
- Generation is agentic tooling on top; the database read path and the rebrand lane work standalone with no ComfyUI and no other layer present.
- Matte floor: every non-emissive entry carries metallic 0 or 1 and no roughness below 0.45 in its factor, its finish band and every pixel of every variant's roughness map, and its metallic map is a constant fill of the factor; glass (transmission above 0) and lit entries (an emission map) are exempt. Checked by a test over the shipped database.

## Preview

`npm run preview`: the classic material sphere viewer (lighting, orbit), loads any key from the database. UI in `src/ui/` with `views/`, `widgets/`, `components/`.

`npm run sheet -- <kind> [tier]`: a contact sheet of every variant of a kind, basecolor, roughness and normal side by side, written to `out/`. A family is checked as a family: whether its variants read apart, and whether the gloss map is calm.

## Depends on

None (root of the dependency graph).
