# Gutierrez office finishes

Built-in Imagegen artwork and its [prompt](prompts/teal-copper-art-v1.md) for the corporate office. The picture frame and hood are separate geometry.

| Key under `cyberpunk/`, tier `rich` | Variant | Mapping | Source | Surface |
| --- | --- | --- | --- | --- |
| `gutierrez-art` | `teal-copper` | Exact 2:1, 1024 x 512 | [teal-copper-art-v1.png](teal-copper-art-v1.png), 1774 x 887 | Original abstract painting in matte teal and copper pigment, fit once to a 1.28 x 0.64 m image plane. Metallic 0, roughness 0.76, no emission. |
| `gutierrez-lacquer` | `ink` | 0.25 m, 256² | `composite` pattern | Smooth ink-charcoal dielectric lacquer for fitted wall panels, flat normals, roughness 0.29, no wear. |

```sh
npm run --silent pbrforge -- from-image batch/cyberpunk/gutierrez/art.json
npm run --silent pbrforge -- create batch/cyberpunk/gutierrez/lacquer.json
```
