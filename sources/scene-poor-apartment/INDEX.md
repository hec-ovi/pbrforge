# Scene: the poor apartment (Interior C8)

Finishes for the poor apartment Interior authors as a scene (its style `c8`): the night-shift tenant's flat
in a poor tower, after the user's gold-standard Cyberpunk captures 2026-10-04 173732 to 173853. Every
tiled surface is drawn in code from periodic noise by
[author-scene-poor-apartment.mjs](../../scripts/author-scene-poor-apartment.mjs), so each wraps by
construction and passes the native seam gate; the fitted faces (screens, print, decals) are drawn as SVG
with exact lettering, or keyed and worn from the retained Grok art, by
[author-scene-faces.mjs](../../scripts/author-scene-faces.mjs). Geometry owns tile joints of the
surfaces it builds, panel seams and frames; light records own the illumination.

## Tiled surfaces (prepared native maps)

| Key under `cyberpunk/` | Variant | Repeat | Surface |
| --- | --- | --- | --- |
| `scene-paint/poor` | `teal-chipped` | 2 m | Dark teal paint over grey-blue plaster, small flakes gathered in drifts, grimy, faint streaks. |
| `scene-paint/poor` | `stained-ceiling` | 3 m | Dun ceiling paint yellowed by smoke, a leak's tide marks. |
| `scene-floor-tile/poor` | `cream-cracked` | 1.2 m | Cream glazed 0.42 m tiles on the diagonal, eight glazes per repeat, dark sunken grout, cracks, stains. |
| `scene-wall-tile/poor` | `grimy-white` | 1 m | White 0.1 m glazed wall tiles gone grey, dirty grout, stained and mismatched tiles, drips. |
| `scene-paint/poor` | `dark-wainscot`, `mauve` | 2 m | Green-black gloss wainscot scuffed pale; dull mauve kitchen paint with chips. |
| `scene-leather/poor` | `oxblood` | 0.5 m | Oxblood vinyl, fine pebble, cracked and paled where sat on. |
| `scene-rug/poor` | `striped`, `blue-runner` | 1 m | Flat-woven striped rug (U along the rug), broken bands; blue-grey looped runner. |
| `scene-steel/poor` | `black` | 1 m | Charcoal powder-coat shelving steel rubbed to bare metal, a little rust. |
| `scene-laminate/poor` | `desk-brown`, `pass-rose` | 1 m | Brown wood-print desk laminate; rose wood-print pass-through laminate. |
| `scene-fabric/poor` | `terry` | 0.5 m | Off-white terry cloth greyed by washing. |
| `scene-sheer/poor` | `shower` | 1 m | Sheer shower plastic about a third opaque (`BLEND`), limescale and creases. |
| `scene-enamel/poor` | `red-tool`, `washer-white`, `bin-slate`, `bottle-green`, `bottle-amber`, `bottle-clear`, `vinyl-grey`, `rubber-black`, `fan-white`, `towel-blue`, `blanket`, `ceramic-white`, `rust-steel` | 0.5 m | Flat enamels, glass, plastics and cloth of the small things, each with its own wear. |

## Fitted faces

| Key under `cyberpunk/` | Variants | Aspect | Face |
| --- | --- | --- | --- |
| `scene-screen/poor` | `pod-panel` | 1:2 | The wardrobe pod's cyan status glass, emissive 6. |
| `scene-monitor/poor` | `monitor` | 16:9 | A night-shift work queue on near-black, emissive 4. |
| `scene-tube/poor` | `cold-tube`, `bath-tube` | 4:1 | Fluorescent diffusers, cold blue-white and greenish, emissive 9. |
| `scene-newsprint/poor` | `newspaper` | 4:3 | An open tabloid spread on grey newsprint. |
| `scene-print/poor` | `pizza-lid` | 1:1 | A kraft pizza lid with the Slice 24 roundel. |
| `scene-can/poor` | `can-blue`, `can-red`, `can-green` | 2:1 | Can wraps, U round the can. |
| `scene-paper/poor` | `papers` | 1:1.414 | A payslip with an OVERDUE stamp. |
| `scene-graffiti/poor` | `graffiti-tags-1`, `graffiti-tags-2`, `graffiti-lattice` | 2:1 | Grok's marker sheets keyed from black to alpha (`BLEND` decals, 2 m). |
| `scene-decal/poor` | `stickers`, `water-stain`, `spill`, `mirror-crack` | 1:1 | Sticker scatter, a run water stain, a dried spill, a mirror's crack star (`BLEND` decals). |
| `scene-notice/poor` | `dream-levy`, `compute` | 1:1.414 | Grok's two notices worn on our side: creased, grimy edges, a stain, a torn top edge, tape. |
| `scene-poster/poor` | `vesper`, `mire-archive` | 2:3 | Grok's posters pasted and left: grimy edges, a crease, a corner peeling off, tape. |

```sh
npm run build
node scripts/author-scene-poor-apartment.mjs
node scripts/author-scene-faces.mjs
```
