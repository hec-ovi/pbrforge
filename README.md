# pbrforge

A themed PBR material library with an AI generator behind it. It stores complete material sets (map files, tiling config, physical properties) under one string key, `theme/kind/tier`, and resolves that key to real maps for any glTF consumer. New materials are generated locally with ComfyUI and SDXL, verified seamless, then written into the database.

Read and write are separate: resolving keys is pure, offline and needs no ComfyUI. Anything already in the database works with nothing else installed.

## Run

```
npm install
npm run resolve -- cyberpunk/window-glass/rich   # look up a key
npm run create -- request.json                   # generate a set (needs ComfyUI)
npm run preview                                  # material sphere viewer with lighting and orbit
npm run refinish -- request.json                 # re-read the maps of a family under a finish
npm run sheet -- wall                            # contact sheet of a kind, into out/
npm test
```

`npm run create` also takes an array of requests and skips keys that already exist, so a batch is resumable.

## In

- `resolve(key)` returns the entry for a key or one of its aliases.
- `list(filter?)` returns matching keys, sorted and deterministic.
- `create(request)` generates a full map set, verifies its seams and writes it. The request (`schema/create-request.schema.json`) names the theme, kind, tier, prompt material and options. Basecolor comes from ComfyUI, from a drawn pattern, from a tint of a variant already in the entry, or is synthesized from `flatColor` (glass, plain colors); normal, roughness, metallic, height and AO always derive in-box. `append` adds a variant to an entry that exists instead of writing a new one.
- `refinish(request)` re-reads the relief and gloss maps of a family already in the database from its stored basecolor, under a stated finish.

## Out

A `MaterialEntry` (`schema/material-entry.schema.json`): alignment mode (`tile` or `exact`), physical properties (metallic and roughness factors, transmission for glass, emissive strength, breakable), tiling config in meters covered by one repeat, and one or more variants, each a set of map files. Variant 0 is canonical; a consumer can pick a variant deterministically by seed.

The theme is a folder: `themes/<theme>/theme.json` is the index, `themes/<theme>/assets/<kind>/<tier>/<variant>/` holds the maps. The bundled `cyberpunk` theme covers 33 kinds at four tiers (112 entries plus 20 alias keys, 316 variants): walls, trim, columns, window glass and frames, curtains, doors, balcony slabs and rails, roofs, parapets, signage, ad screens, light fixtures, fire escapes and roof artifacts for exteriors, plaster, tile, ceilings, wood, carpet, rubber, concrete, metal, elevator doors, fabric and glass for interiors, sidewalk and road for the ground, and a lit letter atlas for signs. The families that cover the most surface carry the most variants per tier: seven walls (four photographed surfaces and three paints), nine concretes, seven plasters, five tiles, three pavements and three road surfaces, laid out to read apart in tone, cell size and bond.

Conventions are fixed, not per entry: metallic-roughness workflow, basecolor and emission sRGB with every other map linear, OpenGL-style normals, glass following glTF `KHR_materials_transmission`.

## Patterns

Structured surfaces are drawn, not diffused. A `pattern` in the request states shapes and colors and the box renders the maps in code: hexagon grids, inset panel grids, large floor and pavement slabs, stripes, two-tone blocking, and noise in up to four octaves for asphalt. Every one is anti-aliased against the pixel it is sampled for and periodic over one tile by construction, so it is crisp at any distance, tiles with nothing to hide, and costs a few tens of kilobytes. Joint and chamfer widths are in metres and read against the entry's tiling, so a joint is the same width on a 3 m wall and a 12 m one.

A pattern variant resolves under the same key and the same entry shape as a photographed one: consumers read maps and never ask which class a variant is. Diffusion keeps what it is good at, which is grain, wear and grime.

The same lane draws the letter atlas: one lit glyph per cell in an 8 by 6 grid, as a neon tube or a backlit panel, so a sign system spells any name by picking cells. The grid and charset are in `CONTRACT.md`.

## Finish

A photograph carries its gloss and grain in every pixel. Read straight out, bright specks come back shiny and dark blotches come back damp, which at night is glitter on the walls and wet patches on dry concrete. Every photographed entry states a finish instead: the band its roughness map stays inside, and how much of the pixel-scale speckle survives into the relief. Structure above the feature scale (joints, bricks, aggregate, trowel strokes) comes through at full gain, so a wall keeps its shape and loses its sparkle. The bands per kind and tier are in `CONTRACT.md`.

## Screens

Ad screens invert the usual path. The basecolor is dark display glass and the picture lives in the emission map at high emissive strength. ComfyUI paints each advertisement brandless and flat; the box turns it into a display: the pixel structure of its kind (`led-dot` lattice, `scanline-billboard` bands, `glyph-panel` with no lattice), colour fringing, blown-out hotspots, and the business name stroked in from a built-in alphabet. Because the name never enters the diffusion prompt, rebranding a screen costs no render.

## How it works

Tiling basecolors come out of SDXL through ComfyUI with circular padding, and every tiled set passes a seam gate before it is written: the wrap-edge difference is compared against the worst interior column or row, so grout lines and grids do not false-positive. A failed gate writes nothing. Exact-placement entries (screens, image ads) are 1:1 UV placements with no tiling config and no seam gate. The prompt files live under `prompts/`, one per job, and the research behind the pipeline is in `docs/RESEARCH.md`.

## Using it from an agent or a pipeline

Generation is agentic tooling on top of a plain database. The read path is a pure function of the folder contents, so a build step or a game runtime can ship the theme folder and resolve keys with no model, no GPU and no network; the write path is a CLI a batch or an agent loop drives one request at a time, resumable across runs. `CONTRACT.md` and `schema/` are the full surface.

## Consumers

Geometry tools name their glTF materials with the canonical key and let this resolve it: [buildingforge](../buildingforge) writes `theme/kind/tier` onto every facade material, [interiorforge](../interiorforge) bakes the resolved maps into finished interiors, and [urbe](../urbe), a deterministic city sandbox, textures a whole city from one theme folder.
