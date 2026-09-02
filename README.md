# pbrforge

A themed PBR material library with an AI generator behind it. It stores complete material sets (map files, tiling config, physical properties) under one string key, `theme/kind/tier`, and resolves that key to real maps for any glTF consumer. New materials are generated locally with ComfyUI and SDXL, verified seamless, then written into the database.

Read and write are separate: resolving keys is pure, offline and needs no ComfyUI. Anything already in the database works with nothing else installed.

## Run

```
npm install
npm run resolve -- cyberpunk/window-glass/rich   # look up a key
npm run create -- request.json                   # generate a set (needs ComfyUI)
npm run preview                                  # material sphere viewer with lighting and orbit
npm run refinish -- request.json                 # re-read the maps of a family under a finish and factors
npm run rebrand -- --theme cyberpunk --businesses businesses.json   # spell business names over the screens of their tier
npm run sheet -- wall                            # contact sheet of a kind, into out/
npm test
```

`npm run create` also takes an array of requests and skips keys that already exist, so a batch is resumable.

## In

- `resolve(key)` returns the entry for a key or one of its aliases.
- `list(filter?)` returns matching keys, sorted and deterministic.
- `create(request)` generates a full map set, verifies its seams and writes it. The request (`schema/create-request.schema.json`) names the theme, kind, tier, prompt material and options. Basecolor comes from ComfyUI, from a drawn pattern, from a tint of a variant already in the entry, or is synthesized from `flatColor` (glass, plain colors); normal, roughness, metallic, height and AO always derive in-box. `append` adds a variant to an entry that exists instead of writing a new one, and `canonical` puts it first. Variants record whether their source was an image, a pattern or a flat field.
- `refinish(request)` re-reads the relief, gloss and metallic maps of a family already in the database from its stored basecolor, under a stated finish and factors.
- `rebrand(request)` writes a `brand:<slug>` variant of the landscape and the portrait screen of a business's tier, its name spelled from the letter atlas over artwork already in the database. No render.

## Out

A `MaterialEntry` (`schema/material-entry.schema.json`): alignment mode (`tile` or `exact`), physical properties (metallic and roughness factors, transmission for glass, emissive strength, breakable), tiling config in meters covered by one repeat, and one or more variants, each a set of map files. Variant 0 is canonical; a consumer can pick a variant deterministically by seed.

The theme is a folder: `themes/<theme>/theme.json` is the index, `themes/<theme>/assets/<kind>/<tier>/<variant>/` holds the maps. The bundled `cyberpunk` theme covers 37 kinds at four tiers (119 entries plus 29 alias keys, 362 variants): walls, trim, columns, window glass and frames, curtains, doors, balcony slabs and rails, roofs, parapets, signage, ad screens landscape and portrait, light fixtures, fire escapes, roof artifacts and AC unit faces for exteriors, plaster, tile, ceilings, wood, carpet, rubber, concrete, metal, elevator doors, fabric and glass for interiors, sidewalk, road, curb and plastic for the street, and a lit letter atlas for signs. The families that cover the most surface carry the most variants per tier: seven walls (four photographed surfaces, two paints and a drawn ochre panel), ten concretes, eight plasters, five tiles, three pavements and four road surfaces, laid out to read apart in tone, cell size and bond. Plaster, concrete, ceiling, roof and floor-slab lead with a plain matte variant, so a face that is not a whole number of tiles shows no cut joint; ceilings are smooth dark paint and keep their panel grid in the optional second variant. Frames and doors are smooth dark painted steel. Columns carry two flat stone tones per tier. Curtains are procedural vertical blinds or plain shades fitted to a 1.5 x 3 m bay.

The whole library sits on a matte floor: every non-emissive entry carries metallic 0 (1 on the metal kinds) and no roughness below 0.45 in its factor, its band or any pixel of its roughness map, glass and lit entries excepted, and a test over the shipped database holds it there. General service metal, fire escapes and rooftop equipment use two flat finishes per tier, dark paint and zinc, with no texture grain. Elevator doors are exact 1:2 procedural faces with fitted center seams. The ground kinds carry the tile sizes the engine lays on its millimetre grid: road 3.5 x 7 m (one lane wide, with wheel tracks), sidewalk 2 x 2 m (1 m slabs with the joint on the tile edge), curb 2 x 0.15 m (two kerb stones), and a light fixture is one luminaire per 0.16 x 0.28 m tile.

Conventions are fixed, not per entry: metallic-roughness workflow, basecolor and emission sRGB with every other map linear, OpenGL-style normals, glass following glTF `KHR_materials_transmission`.

## Patterns

Structured surfaces are drawn, not diffused. A `pattern` in the request states shapes and colors and the box renders the maps in code: hexagon grids, inset panel grids, large floor and pavement slabs, stripes, two-tone blocking, noise in up to four octaves for asphalt, that asphalt with two wheel tracks worn along the lane, the same asphalt after rain with damp patches pooled in its low spots, a luminaire with a lens, a hot centre and a housing bezel, and a condenser face with a wire grille over its fan. Every one is anti-aliased against the pixel it is sampled for and periodic over one tile by construction, so it is crisp at any distance, tiles with nothing to hide, and costs a few tens of kilobytes. Joint and chamfer widths are in metres and read against the entry's tiling, so a joint is the same width on a 3 m wall and a 12 m one.

A pattern variant resolves under the same key and the same entry shape as a photographed one: consumers read maps and never ask which class a variant is. Diffusion keeps what it is good at, which is grain, wear and grime.

The same lane draws the letter atlas: one lit glyph per cell in an 8 by 6 grid, as a neon tube or a backlit panel, so a sign system spells any name by picking cells. `signage` supplies the dark flat casing and backing plate around those lit cells. The grid and charset are in `CONTRACT.md`.

## Finish

A photograph carries its gloss and grain in every pixel. Read straight out, bright specks come back shiny and dark blotches come back damp, which at night is glitter on the walls and wet patches on dry concrete. Every photographed entry states a finish instead: the band its roughness map stays inside, and how much of the pixel-scale speckle survives into the relief. Structure above the feature scale (joints, bricks, aggregate, trowel strokes) comes through at full gain, so a wall keeps its shape and loses its sparkle. The bands per kind and tier are in `CONTRACT.md`.

## Screens

Ad screens invert the usual path. The basecolor is dark display glass and the picture lives in the emission map at high emissive strength. ComfyUI paints each advertisement brandless and flat; the box turns it into a display: the pixel structure of its kind (`led-dot` lattice, `scanline-billboard` bands, `glyph-panel` with no lattice), colour fringing, blown-out hotspots, and the business name stroked in from a built-in alphabet. Because the name never enters the diffusion prompt, rebranding a screen costs no render.

A screen can also be painted from a picture that already exists: `imagePath` on a screen names a file, which goes through a ComfyUI 4x upscale and then the same display treatment, so a billboard-scale screen carries real detail instead of an enlarged thumbnail.

Every screen keeps the brandless picture it shows beside its maps. That is what the rebrand lane works from: `npm run rebrand` takes the businesses of a named world, a list of `{ brandName, businessKind, tier }` (`batch/cyberpunk/businesses.json` shows the shape), and writes for each one a `brand:<slug>` variant of `ad-screen` and of `ad-screen-tall` at its tier. The name is spelled over the artwork of one of the tier's screens from the letter atlas cells, neon on the poor and mid tiers and backlit panel on the rich ones, centred over the bottom of the picture on one line or broken over two at the space nearest the middle, then shown through the same LED or scanline structure as the screen it came from. Pure image work, no ComfyUI, and the same list writes the same maps every time, so a district renames its screens as often as the world is renamed. A consumer takes the variant by id: `entry.variants.find((v) => v.id === 'brand:kiro-s-clinic')`.

The library ships one sample business so the shape is visible. A world's own screens are the world's, not the library's: copy the theme folder into the world, point the lane at it with `--themes <dir>` and run it against that world's business list. Both the maps and the index entries land in that copy, and rerunning the same list writes the same maps, so a world regenerates its screens whenever its names change instead of storing them here. An empty list is fine: a world with no advertising parcel brands nothing.

## How it works

Tiling basecolors come out of SDXL through ComfyUI with circular padding, and every tiled set passes a seam gate before it is written: the wrap-edge difference is compared against the worst interior column or row, so grout lines and grids do not false-positive. A failed gate writes nothing. Exact-placement entries (screens, image ads) are 1:1 UV placements with no tiling config and no seam gate. The prompt files live under `prompts/`, one per job, and the research behind the pipeline is in `docs/RESEARCH.md`.

## Using it from an agent or a pipeline

Generation is agentic tooling on top of a plain database. The read path is a pure function of the folder contents, so a build step or a game runtime can ship the theme folder and resolve keys with no model, no GPU and no network; the write path is a CLI a batch or an agent loop drives one request at a time, resumable across runs. `CONTRACT.md` and `schema/` are the full surface.

## Consumers

Geometry tools name their glTF materials with the canonical key and let this resolve it: [buildingforge](../buildingforge) writes `theme/kind/tier` onto every facade material, [interiorforge](../interiorforge) bakes the resolved maps into finished interiors, and [urbe](../urbe), a deterministic city sandbox, textures a whole city from one theme folder.
