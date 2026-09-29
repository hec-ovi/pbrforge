# Sandra Dorsett tatami and lattice infill

Built-in Imagegen albedo sources and [prompts](prompts/) for the tatami apartment. Geometry owns the timber lattice, cabinets and floor slabs.

| Key under `cyberpunk/`, tier `mid` | Variant | Repeat | Source | Surface |
| --- | --- | --- | --- | --- |
| `sandra-tatami` | `bordered` | 1.8 m | [tatami-bordered.png](tatami-bordered.png) | Two parallel 0.9 x 1.8 m woven rush mats with narrow charcoal cloth edges, so metric floor UVs keep the mat size. |
| `sandra-tatami` | `woven` | 0.45 m | [tatami-woven.png](tatami-woven.png) | Continuous tan rush weave without borders, for fitted details. |
| `sandra-frosted-glass` | `infill` | 1 m | flat | Pale translucent lattice infill, transmission 0.78, roughness 0.32, IOR 1.45. |

Both tatami variants pass the native 1.2 wrap gate at 1024² and 512².

```sh
npm run --silent pbrforge -- create batch/cyberpunk/sandra-dorsett/tatami.json --native
npm run --silent pbrforge -- create batch/cyberpunk/sandra-dorsett/frosted-glass.json
```
