# Materials index

Version: 0.16.36.

| Surface | Purpose | Input / output | Dependencies |
| --- | --- | --- | --- |
| [Materials](../CONTRACT.md) | Resolve and author PBR sets. | [Create](../schema/create-request.schema.json), [API types](../src/api-types.ts) / [entry](../schema/material-entry.schema.json), [theme](../schema/theme-index.schema.json) | Node.js, Ajv, Sharp; optional ComfyUI. Atlas binding data only. |
| [CLI](../src/cli/CONTRACT.md) | One JSON process per operation. | Verb arguments / JSON envelope | Materials, from-image. |
| [From-image](../src/from-image/CONTRACT.md) | Derive dry PBR from one opaque photo. | [Request](../src/from-image/request.schema.json) / material entry | Materials database and map writers. |
| [Preview](../src/ui/CONTRACT.md) | Browse maps and render a PBR sphere. | [Layout](../schema/preview-view-layout.schema.json), theme index / DOM and canvas | Materials data, browser APIs, Three.js. |

## Agent and consumer entry points

- [Root skill](../SKILL.md): calls, defaults, errors and a copyable example.
- [Authoring skill](../skills/pbrforge/SKILL.md): CLI workflow; [pattern resolver](../skills/pbrforge/references/patterns/INDEX.md) and [photo framing](../skills/pbrforge/references/from-image.md) supply detail.
- [Consumer bindings](../CONTRACT.md#consumer-bindings): exterior, streets, markings, scenic rooms and hydrology, with schemas.
- [Catalog](../themes/cyberpunk/theme.json): authored keys, variants, dimensions and map references.
- [Issues](ISSUES.md): open decisions and boundary proposals for the orchestrator.

## Authored resources

- [Native street surfaces](../sources/streets/scene-native/CONTRACT.md): original scans, UV rules, shader equations and source hashes for ordinary streets and hardware.
- [Street sources](../sources/streets/INDEX.md) and [recipes](../batch/cyberpunk/street-image-finishes.json): continuous photographic finish fields.
- [Street prop sources](../sources/street-props/INDEX.md) and [recipes](../batch/cyberpunk/street-props/): cardboard, wood, coating and polymer.
- [Exterior sources](../sources/exterior-native/INDEX.md) and [recipes](../batch/cyberpunk/exterior-native/): cast, weathered and graphite concrete.
- [Accepted Exterior finishes](../sources/exterior-native/accepted.json): fourteen native sets, exact counterparts and original source hashes.
- [Exterior accent recipes](../batch/cyberpunk/exterior-accents.json): blue and gold frame coatings with canonical `coat` variants.
- [Interior sources](../sources/interiors/INDEX.md) and [recipes](../batch/cyberpunk/interiors/): luxury, damaged and capsule finishes.
- [Room plates](../sources/window-rooms/INDEX.md) and [screen artwork](../sources/ads-codex/PROMPTS.md): retained images and authoring prompts.
- [Paired facade recipes](../batch/cyberpunk/paired-facade.json): lounge backplate, photographed graphite metal, periodic aluminum brushing, clear glazing and room/light surface states.
- [ComfyUI workflows](../templates/README.md): photographic and upscale templates.
