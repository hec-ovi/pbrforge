# Facade family surfaces

Built-in ImageGen sources and [prompts](prompts/) support the modular facade families. Runtime geometry supplies joints, fasteners and panel edges.

| Key under `cyberpunk/`, tier `mid` | Variant | Mapping | Surface |
| --- | --- | --- | --- |
| `corporate-panel` | `native` | 1 m tile | Fine charcoal mineral composite. |
| `ivory-panel` | `native`, `cool-grey` | 1 m tile | Warm ivory coating and cool grey tint. |
| `paired-cladding-metal` | `obsidian` | 1 m tile | Dark tint sharing the existing metal relief maps. |
| `corporate-screen` | `native` | Exact 1:2 | Original ivory optical sphere artwork on a cyan display. |
| `portal-limestone` | `native` | Exact 1:1 | Pale fine-veined stone, fit once per portal face. |
| `facade-chrome` | `native` | Exact 1:1 | Accepted photographic brushed steel with polished response, fit once per panel face. |

Sources: `corporate-panel.png`, `ivory-panel.png`, `corporate-screen.png`, `portal-limestone.png`. Chrome reads the accepted `exterior-brushed-steel` basecolor. Reference frames: 14092026_191756, 14092026_193615 and 15092026_132033.

Author through `pbrforge create batch/cyberpunk/facade-families.json`, `pbrforge from-image batch/cyberpunk/portal-limestone.json`, `pbrforge from-image batch/cyberpunk/facade-chrome.json`, then `pbrforge refinish batch/cyberpunk/facade-families-refinish.json`. The polished chrome finish uses the public refinish operation after photo import.
