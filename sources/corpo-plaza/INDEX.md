# Corpo Plaza apartment finishes

Built-in Imagegen albedo sources and [prompts](prompts/) for the private corporate apartment furniture and its public hotel counterparts. Geometry owns seams, padded divisions, folds, joints, bowls and trim; scene lights own the illumination.

| Key under `cyberpunk/`, tier `rich` | Variant | Repeat | Source | Surface |
| --- | --- | --- | --- | --- |
| `corpo-plaza-veneer` | `walnut` | 1 m | [walnut-veneer.png](walnut-veneer.png) | Medium continuous walnut veneer without plank joints, for furniture and stair caps. |
| `corpo-plaza-veneer` | `smoked` | 1 m | [walnut-smoked.png](walnut-smoked.png) | Darker image edit of the walnut veneer for cabinets and shelves. |
| `corpo-plaza-stone` | `polished` | 2 m | [charcoal-stone.png](charcoal-stone.png) | Dark charcoal stone with calm taupe veins, roughness 0.19. |
| `corpo-plaza-stone` | `basin` | 0.5 m | `mineral` pattern | Near-black polished mineral with flat normals for troughs and bowls. |
| `corpo-plaza-leather` | `cream` | 0.2 m | [cream-leather.png](cream-leather.png) | Fine pebbled cream leather, roughness 0.34. |
| `corpo-plaza-bedding` | `botanical` | 2 m | [botanical-sateen.png](botanical-sateen.png) | Midnight navy sateen with a muted gold botanical print as pigment, no emission. |
| `corpo-plaza-rug` | `charcoal` | 0.4 m | `carpet/high_rich/1` basecolor | Fine charcoal cut pile. |
| `corpo-plaza-glass` | `clear` | 1 m | flat | Transmission 1, roughness 0.015, IOR 1.45. |
| `corpo-plaza-mirror` | `silver` | 1 m | flat | Opaque polished silver, metallic 1, roughness 0.035. |
| `biotechnica-upholstery` | `ivory` | 0.2 m | [Meridian bedding](../meridian/bedding.png) | Pale tightly woven public seating cloth. |
| `biotechnica-rug` | `woven-source`, `ivory` | 0.4 m | `carpet/poor/2` basecolor | Fine woven rug; `ivory` is a quiet beige recolor sharing the source relief maps. |
| `light-fixture` (existing key) | `corpo-amber` | 1 m | flat | Amber trough diffuser basecolor and emission. |

The veneer, polished stone and leather come through the photographic `from-image` lane, which has no seam gate. Their basecolor wrap scores exceed the 1.2 native threshold (walnut 2.46 and smoked 3.03 top to bottom, stone 1.29 and leather 1.24 left to right), so a long run can show its 1 m, 2 m or 0.2 m repeat. Every other tiled variant here passes the native seam check.

Author in this order; it reproduces the published maps:

```sh
npm run --silent pbrforge -- create batch/cyberpunk/corpo-plaza/finishes.json
npm run --silent pbrforge -- from-image batch/cyberpunk/corpo-plaza/veneer.json
npm run --silent pbrforge -- from-image batch/cyberpunk/corpo-plaza/smoked-veneer.json
npm run --silent pbrforge -- from-image batch/cyberpunk/corpo-plaza/stone.json
npm run --silent pbrforge -- from-image batch/cyberpunk/corpo-plaza/leather.json
npm run --silent pbrforge -- refinish batch/cyberpunk/corpo-plaza/polish.json
npm run --silent pbrforge -- create batch/cyberpunk/corpo-plaza/basin-and-rug.json
```

The imports are dry; `polish.json` then sets the polished veneer, stone and leather response. The basin pattern is appended after the polish so it inherits the polished entry values.
