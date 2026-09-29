# Interior kind finishes

Finishes for the reference-led interior kinds: the E1 luxury apartment, the B3 apartment trims, the R1 office doorway and the poor-building C1/C7 capsules and C4 public restroom. Geometry owns panel joints, slab joints, fixings, reveals, grille outlines and screen bezels; scene light records own the illumination.

Photographic sources are Grok Imagine (`image_gen`) generations with their [prompts](prompts/). The three tiled sources were prepared into wrapping tiles before import: a large-radius tonal flatten removed baked light drift, then two separable offset cross-fades (x then y, 22 % edge band) made both axes wrap. The floor source was darkened to 88 % and the portal stone desaturated to 60 %. The grille face is drawn in code as a regular diamond lattice.

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
| `interior-capsule-enamel/poor` | `worn-ivory` | 1 m, 512² | `composite` pattern | Ivory enamel with scattered grime, scuffs and small chips, roughness 0.55. |
| `c4-laminate/poor` | `stall` | 1 m, 1024² | [c4-stall-laminate.png](c4-stall-laminate.png) | Worn slate blue-grey laminate with hairline scratches and faint grime streaks, roughness 0.55. |

Every tiled variant passes the native wrap gate. Exact faces fit once per receiving face; tiled variants repeat at `variant.tiling ?? entry.tiling`.

```sh
npm run --silent pbrforge -- create batch/cyberpunk/interior-kinds/e1-finishes.json
npm run --silent pbrforge -- create batch/cyberpunk/interior-kinds/e1-lens.json
npm run --silent pbrforge -- create batch/cyberpunk/interior-kinds/b3-trim.json
npm run --silent pbrforge -- create batch/cyberpunk/interior-kinds/capsule-poor.json
npm run --silent pbrforge -- create batch/cyberpunk/interior-kinds/e1-floor.json --native
npm run --silent pbrforge -- create batch/cyberpunk/interior-kinds/r1-portal.json --native
npm run --silent pbrforge -- create batch/cyberpunk/interior-kinds/c4-laminate.json --native
npm run --silent pbrforge -- create batch/cyberpunk/interior-kinds/e1-plates.json --native
npm run --silent pbrforge -- from-image batch/cyberpunk/interior-kinds/e1-grille.json
npm run --silent pbrforge -- refinish batch/cyberpunk/interior-kinds/polish.json
```
