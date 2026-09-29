# Interior kind finishes

Finishes for the reference-led interior kinds: the E1 luxury apartment, the B3 apartment trims, the R1 rich office and the poor-building capsules, corridors, restroom, studios and Japantown rooms (C1 to C7). Geometry owns panel joints, slab joints, fixings, reveals, grille outlines and screen bezels; scene light records own the illumination.

Photographic sources are Grok Imagine (`image_gen`) generations with their [prompts](prompts/). Tiled photographic sources were prepared into wrapping tiles before import: a large-radius tonal flatten removed baked light drift where needed, then two separable offset cross-fades (x then y, 22 % edge band, 30 % for the lagging) made both axes wrap. The E1 floor was darkened to 88 %, the portal stone desaturated to 60 %, the graphite veneer darkened to 85 % and the burl desaturated to 85 %. Regular structure is drawn in code over the generated surfaces: the grille face is a diamond lattice; the C4 floor cuts nine different 0.4 m crops of the terracotta generation into a 3 x 3 grid with 6 mm dark grout and softly darkened glaze rims; the C6 padding multiplies the plum vinyl by a 2 x 2 square cushion profile; the C2 lagging adds two 35 mm darker straps per metre across U.

| Key under `cyberpunk/` | Variant | Mapping | Source | Surface |
| --- | --- | --- | --- | --- |
| `e1-panel/high_rich` | `cream` | 1 m, 512² | `composite` pattern | Warm cream satin lacquer, faint moulded grain, roughness 0.45, flat joints-free field. |
| `e1-ceiling/high_rich` | `gloss-black` | 1 m, 512² | `composite` pattern | Near-black high-gloss lacquer, roughness 0.1, no visible grain. |
| `e1-floor/high_rich` | `dark-stone` | 1.5 m, 1024² | [e1-floor-stone.png](e1-floor-stone.png) | Dark teal-grey polished limestone, faint hairline veins, roughness 0.16 after polish. |
| `e1-housing/high_rich` | `cool-grey` | 1 m, 512² | `brushed-metal` pattern | Pale cool grey-blue satin metal, fine vertical brushing, metallic 1, roughness 0.38. |
| `e1-splash/high_rich` | `tan` | 1 m, 512² | `composite` pattern | Warm tan satin laminate, roughness 0.5. |
| `e1-worktop/high_rich` | `steel` | 1 m, 512² | `brushed-metal` pattern | Dark satin stainless with a slight blue cast, brushing along x, metallic 1, roughness 0.34. |
| `e1-grille/high_rich` | `diamond` | exact 3:1, 1536 x 512 | [e1-diamond-grille.png](e1-diamond-grille.png) | Black painted diamond expanded mesh over a dark void, about 34 x 17 mm cells on a 1.2 m face, roughness 0.5. |
| `e1-glass/high_rich` | `caustic` | exact 2:1, 1024 x 512 | [e1-caustic-glass.png](e1-caustic-glass.png) | Lit caustic water glass, white and cyan ripples over deep teal; identical basecolor and emission, strength 10, roughness 0.05. |
| `e1-screen/high_rich` | `vending` | exact 16:9, 1024 x 576 | [e1-vending-screen.png](e1-vending-screen.png) | Kitchen vending and status display: five glowing product emblems with amber price tags on black; emission strength 8, roughness 0.06. |
| `light-fixture/high_rich` (existing key) | `e1-cyan` | 1 m, 128² | flat | Cyan reveal lens, `#12c3ff` basecolor and color-mask emission. |
| `b3-trim/rich` | `gold` | 0.5 m, 512² | `brushed-metal` pattern | Brushed gold plinth and counter trim, brushing along x, metallic 1, roughness 0.3. |
| `r1-portal/rich` | `stone` | 2 m, 1024² | [r1-portal-stone.png](r1-portal-stone.png) | Honed dark graphite stone, roughness 0.38 after polish. |
| `interior-capsule-enamel/poor` | `worn-ivory` | 1 m, 512² | [capsule-worn-ivory.png](capsule-worn-ivory.png) | Ivory satin enamel with a soft grime haze, fine scuffs and small chips showing a darker base, roughness 0.55. |
| `c4-laminate/poor` | `stall` | 1 m, 1024² | [c4-stall-laminate.png](c4-stall-laminate.png) | Worn slate blue-grey laminate with hairline scratches and faint grime streaks, roughness 0.55. |
| `r1-veneer/rich` | `graphite` | 1.5 m, 1024² | [r1-graphite-veneer.png](r1-graphite-veneer.png) | Dark charcoal veneer with a faint green cast, straight vertical grain, roughness 0.46 to 0.64. |
| `r1-veneer/rich` | `blue-grey` | 1 m, 1024² | [r1-bluegrey-timber.png](r1-bluegrey-timber.png) | Pale blue-grey stained timber with straight rift grain for the door pier; shares the entry finish. |
| `r1-floor/rich` | `walnut` | 2 m, 1024² | [r1-walnut-floor.png](r1-walnut-floor.png) | Warm golden-brown walnut, long straight grain along U, low gloss, roughness 0.4 after polish; board joints are geometry. |
| `r1-ceiling/rich` | `walnut` | 3 m, 1024² | [r1-walnut-ceiling.png](r1-walnut-ceiling.png) | Continuous warm walnut veneer, fine straight grain along U, no plank joints, roughness 0.5 to 0.6. |
| `r1-leather/rich` | `teal-navy` | 0.5 m, 512² | [r1-teal-navy-leather.png](r1-teal-navy-leather.png) | Teal-navy pebbled leather with a soft sheen, roughness 0.38 after polish. |
| `r1-burl/rich` | `walnut` | 0.5 m, 1024² | [r1-walnut-burl.png](r1-walnut-burl.png) | Dark walnut burl with warm orange figure, polished roughness 0.22. |
| `c7-plate/poor` | `cream` | 1 m, 512² | [c7-cream-plate.png](c7-cream-plate.png) | Warm beige cream paint with faint scuffs and a soft grime haze. |
| `c2-paint/poor` | `green` | 2 m, 1024² | [c2-olive-paint.png](c2-olive-paint.png) | Matte olive grey-green corridor paint with faint water streaks and scuffs. |
| `c2-trunk/poor` | `insulated` | 1 m, 512² | [c2-trunk-lagging.png](c2-trunk-lagging.png) | Dirty ochre canvas pipe lagging, two darker straps per metre across U; U runs along the pipe. |
| `c4-tile/poor` | `terracotta` | 1.2 m, 1024² | [c4-terracotta-tile.png](c4-terracotta-tile.png) | Worn glazed orange-brown 0.4 m square tiles, 3 x 3 per repeat, dark recessed grout. |
| `c4-paint/poor` | `teal` | 2 m, 1024² | [c4-teal-paint.png](c4-teal-paint.png) | Deep teal green paint with a grime haze and faint drip streaks. |
| `c6-padded/poor` | `plum` | 0.5 m, 512² | [c6-plum-quilt.png](c6-plum-quilt.png) | Dark plum quilted vinyl, 2 x 2 square cushions per repeat with sunken seams. |
| `light-fixture/poor` (existing key) | `c-red`, `c-magenta` | 1 m, 128² | flat | Neon tube lenses, `#ff1419` and `#ff4dbf` basecolor and color-mask emission. |

Every tiled variant passes the native wrap gate. Exact faces fit once per receiving face; tiled variants repeat at `variant.tiling ?? entry.tiling`.

```sh
npm run --silent pbrforge -- create batch/cyberpunk/interior-kinds/e1-finishes.json
npm run --silent pbrforge -- create batch/cyberpunk/interior-kinds/e1-lens.json
npm run --silent pbrforge -- create batch/cyberpunk/interior-kinds/b3-trim.json
npm run --silent pbrforge -- create batch/cyberpunk/interior-kinds/e1-floor.json --native
npm run --silent pbrforge -- create batch/cyberpunk/interior-kinds/r1-portal.json --native
npm run --silent pbrforge -- create batch/cyberpunk/interior-kinds/c4-laminate.json --native
npm run --silent pbrforge -- create batch/cyberpunk/interior-kinds/capsule-poor.json --native
npm run --silent pbrforge -- create batch/cyberpunk/interior-kinds/e1-plates.json --native
npm run --silent pbrforge -- from-image batch/cyberpunk/interior-kinds/e1-grille.json
npm run --silent pbrforge -- create batch/cyberpunk/interior-kinds/r1-finishes.json --native
npm run --silent pbrforge -- create batch/cyberpunk/interior-kinds/c-finishes.json --native
npm run --silent pbrforge -- create batch/cyberpunk/interior-kinds/c-lenses.json
npm run --silent pbrforge -- refinish batch/cyberpunk/interior-kinds/polish.json
```
