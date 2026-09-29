# Meridian finishes

Built-in Imagegen albedo sources and [prompts](prompts/) for the Meridian tower lobby, apartments, shell and bathrooms. Geometry supplies slab and panel joints, cassette depth, folds and seams. All variants are opaque, nonemissive and carry basecolor, normal, roughness, metallic, height, AO and packed metallic-roughness.

| Key under `cyberpunk/` | Variant | Repeat | Source | Surface |
| --- | --- | --- | --- | --- |
| `meridian-lobby-stone/rich` | `honed` | 2 m | [lobby-stone.png](lobby-stone.png) | Honed warm grey limestone with fossil grain and restrained burnishing. |
| `meridian-wall-mineral/rich` | `field` | 2 m | [wall-mineral.png](wall-mineral.png) | Warm graphite trowelled mineral coating. |
| `meridian-ceiling-metal/rich` | `field` | 1 m | [ceiling-metal-peened.png](ceiling-metal-peened.png) | Peened graphite aluminium, metallic satin. |
| `meridian-roof-mineral/rich` | `field` | 2 m | `exterior-weathered-concrete/mid#native` basecolor | Weathered roof screed with coarser pores and dry roughness. |
| `wall/rich` | `meridian-mineral` | 2 m | [wall-mineral.png](wall-mineral.png) | Shell wall variant on the existing wall kind. |
| `roof/mid` | `meridian-mineral` | 2 m | `exterior-weathered-concrete/mid#native` basecolor | Shell roof variant on the dielectric roof entry; `roof/rich` is metallic. |
| `ivory-panel/rich` | `meridian-satin` | 1 m | [ivory-engineered-mineral.png](ivory-engineered-mineral.png) | Pale warm-neutral engineered mineral for wall fields and ceiling cassettes, satin roughness 0.47. |
| `meridian-upholstery/rich` | `charcoal` | 0.25 m | `fabric/high_rich/1` basecolor | Fine charcoal wool at furniture scale. |
| `meridian-upholstery/rich` | `navy` | 0.25 m | recolor of `charcoal` | Deep navy cloth sharing the charcoal relief maps. |
| `meridian-bedding/rich` | `ivory` | 0.25 m | [bedding.png](bedding.png) | Fine ivory cotton. |
| `meridian-terry/rich` | `ivory` | 0.2 m | [terry.png](terry.png) | Short-loop ivory towelling. |
| `bathroom-glass/rich` | `clear` | 1 m | flat | Low-tint shower glass, transmission 0.9, IOR 1.5, roughness 0.09. |
| `bathroom-mirror/rich` | `silver` | 1 m | flat | Opaque silver, metallic 1, roughness 0.22. |

The photographed variants pass the native 1.2 wrap gate. Appending the photographed `meridian-mineral` variants stores their finish band on `wall/rich` and `roof/mid`; the earlier pattern variants and their maps are unchanged.

```sh
npm run --silent pbrforge -- create batch/cyberpunk/meridian/finishes.json --native
npm run --silent pbrforge -- create batch/cyberpunk/meridian/shell-and-bath.json
npm run --silent pbrforge -- create batch/cyberpunk/meridian/textiles.json
npm run --silent pbrforge -- create batch/cyberpunk/meridian/ivory-panel.json --native
```
