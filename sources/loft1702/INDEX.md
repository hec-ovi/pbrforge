# Loft 1702 finishes

A built-in Imagegen marble source and its [prompt](prompts/pale-marble.md) for the loft apartment. Geometry owns slab joints; scene light records own the illumination.

| Key under `cyberpunk/`, tier `rich` | Variant | Repeat | Source | Surface |
| --- | --- | --- | --- | --- |
| `loft1702-stone` | `pale` | 2 m, 512² | [pale-marble.png](pale-marble.png) | Continuous pale grey-white veined marble, polished roughness 0.28, no baked grout or reflections. |
| `loft1702-rug` | `woven-source`, `red` | 0.4 m | `carpet/poor/2` basecolor | Fine woven rug; `red` is a restrained deep red recolor sharing the source relief maps. |
| `light-fixture` (existing key) | `loft-red` | 1 m, 128² | flat | Red cove lens basecolor and emission. |

The marble imports as a whole-image 512² downsample, which passes the native wrap gate (1.07 and 1.10).

```sh
npm run --silent pbrforge -- create batch/cyberpunk/loft1702/red-details.json
npm run --silent pbrforge -- create batch/cyberpunk/loft1702/pale-stone.json --native
npm run --silent pbrforge -- refinish batch/cyberpunk/loft1702/polish.json
```
