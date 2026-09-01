# pbrforge

A themed PBR material library with an AI generator behind it. It stores complete material sets (map files, tiling config, physical properties) under one string key, `theme/kind/tier`, and resolves that key to real maps for any glTF consumer. New materials are generated locally with ComfyUI and SDXL, verified seamless, then written into the database.

Read and write are separate: resolving keys is pure, offline and needs no ComfyUI. Anything already in the database works with nothing else installed.

## Run

```
npm install
npm run resolve -- cyberpunk/window-glass/rich   # look up a key
npm run create -- request.json                   # generate a set (needs ComfyUI)
npm run preview                                  # material sphere viewer with lighting and orbit
npm test
```

`npm run create` also takes an array of requests and skips keys that already exist, so a batch is resumable.

## In

- `resolve(key)` returns the entry for a key or one of its aliases.
- `list(filter?)` returns matching keys, sorted and deterministic.
- `create(request)` generates a full map set, verifies its seams and writes it. The request (`schema/create-request.schema.json`) names the theme, kind, tier, prompt material and options. Basecolor comes from ComfyUI, or is synthesized procedurally when `flatColor` is set (glass, plain colors); normal, roughness, metallic, height and AO always derive in-box from the basecolor.

## Out

A `MaterialEntry` (`schema/material-entry.schema.json`): alignment mode (`tile` or `exact`), physical properties (metallic and roughness factors, transmission for glass, emissive strength, breakable), tiling config in meters covered by one repeat, and one or more variants, each a set of map files. Variant 0 is canonical; a consumer can pick a variant deterministically by seed.

The theme is a folder: `themes/<theme>/theme.json` is the index, `themes/<theme>/assets/<kind>/<tier>/<variant>/` holds the maps. The bundled `cyberpunk` theme covers 29 kinds at four tiers (96 entries plus 20 alias keys): walls, trim, columns, window glass and frames, curtains, doors, balcony slabs and rails, roofs, parapets, signage, ad screens, light fixtures, fire escapes and roof artifacts for exteriors, and plaster, tile, wood, carpet, rubber, concrete, metal, elevator doors, fabric and glass for interiors.

Conventions are fixed, not per entry: metallic-roughness workflow, basecolor and emission sRGB with every other map linear, OpenGL-style normals, glass following glTF `KHR_materials_transmission`.

## Screens

Ad screens invert the usual path. The basecolor is dark display glass and the picture lives in the emission map at high emissive strength. ComfyUI paints each advertisement brandless and flat; the box turns it into a display: the pixel structure of its kind (`led-dot` lattice, `scanline-billboard` bands, `glyph-panel` with no lattice), colour fringing, blown-out hotspots, and the business name stroked in from a built-in alphabet. Because the name never enters the diffusion prompt, rebranding a screen costs no render.

## How it works

Tiling basecolors come out of SDXL through ComfyUI with circular padding, and every tiled set passes a seam gate before it is written: the wrap-edge difference is compared against the worst interior column or row, so grout lines and grids do not false-positive. A failed gate writes nothing. Exact-placement entries (screens, image ads) are 1:1 UV placements with no tiling config and no seam gate. The prompt files live under `prompts/`, one per job, and the research behind the pipeline is in `docs/RESEARCH.md`.

## Using it from an agent or a pipeline

Generation is agentic tooling on top of a plain database. The read path is a pure function of the folder contents, so a build step or a game runtime can ship the theme folder and resolve keys with no model, no GPU and no network; the write path is a CLI a batch or an agent loop drives one request at a time, resumable across runs. `CONTRACT.md` and `schema/` are the full surface.

## Consumers

Geometry tools name their glTF materials with the canonical key and let this resolve it: [buildingforge](../buildingforge) writes `theme/kind/tier` onto every facade material, [interiorforge](../interiorforge) bakes the resolved maps into finished interiors, and [urbe](../urbe), a deterministic city sandbox, textures a whole city from one theme folder.
