# Hiromi terrace fern

A built-in Imagegen leaf lamina and its [prompt](prompts/fern-lamina.md) for the modeled roof terrace ferns. Geometry owns leaflet outlines, frond curvature and paired pinnae; no variant uses alpha silhouettes or leaf cards.

| Key under `cyberpunk/`, tier `mid` | Variant | Mapping | Source | Surface |
| --- | --- | --- | --- | --- |
| `hiromi-fern` | `leaf` | Exact 1:1, 512² | [fern-lamina.png](fern-lamina.png) | Opaque green lamina with the midrib along V at U = 0.5 and fine side veins, roughness 0.57. |
| `hiromi-fern` | `shade` | Exact 1:1, 512² | recolor of `leaf` | Darker mature pinna sharing the leaf response maps. |
| `hiromi-fern-stem` | `rachis` | 0.12 m, 256² | `veneer` pattern | Fine longitudinal matte green-brown stem fibres, roughness 0.72. |

Fit one complete 0..1 leaf map to each narrow curved leaflet with the midrib along its length. Stems use metric UVs.

```sh
npm run --silent pbrforge -- from-image batch/cyberpunk/hiromi-fern/leaf.json
npm run --silent pbrforge -- create batch/cyberpunk/hiromi-fern/stem-and-shade.json
```
