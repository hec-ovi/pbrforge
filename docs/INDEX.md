# Materials index

Version: 0.25.0.

| Surface | Purpose | Input / output | Dependencies |
| --- | --- | --- | --- |
| [Materials](../CONTRACT.md) | Resolve and author PBR sets. | [Create](../schema/create-request.schema.json), [API types](../src/api-types.ts) / [entry](../schema/material-entry.schema.json), [theme](../schema/theme-index.schema.json) | Node.js, Ajv, Sharp; optional ComfyUI. Atlas binding data only. |
| [Compression](../src/compress/CONTRACT.md) | Encode PNG masters beside their catalog paths. | [Options and summary](../src/compress/types.ts), theme / KTX2 files and map references | Materials schema, local KTX CLI, CPU temperature sensors. |
| [CLI](../src/cli/CONTRACT.md) | One JSON process per operation. | Verb arguments / JSON envelope | Materials, from-image. |
| [From-image](../src/from-image/CONTRACT.md) | Derive dry PBR from one opaque photo. | [Request](../src/from-image/request.schema.json) / material entry | Materials database and map writers. |
| [Preview](../src/ui/CONTRACT.md) | Browse maps and render a PBR sphere. | [Layout](../schema/preview-view-layout.schema.json), theme index / DOM and canvas | Materials data, browser APIs, Three.js. |
| [Native street surfaces](../sources/streets/scene-native/CONTRACT.md) | Original scans and renderer-neutral shading parameters. | Surface identity, geometry attributes / [binding](../bindings/street-native.json) | Binding schema; no renderer. |

## Agent and consumer entry points

- [Root skill](../SKILL.md): calls, defaults, errors and a copyable example.
- [Authoring skill](../skills/pbrforge/SKILL.md): CLI workflow; [pattern resolver](../skills/pbrforge/references/patterns/INDEX.md) and [photo framing](../skills/pbrforge/references/from-image.md) supply detail.
- [Consumer bindings](../CONTRACT.md#consumer-bindings): exterior, streets, markings, scenic rooms and hydrology, with schemas.
- [Catalog](../themes/cyberpunk/theme.json): authored keys, variants, dimensions and map references.
- [Issues](ISSUES.md): open decisions, boundary proposals and the [2026-09-18 look pass](ISSUES.md#look-pass-2026-09-18).

## Authored resources

- [Facade patterns](../batch/cyberpunk/facade-patterns.json): metre scaled blades, head combs, corner fixings and panel joints, authored through the Materials create schema and published as named catalog variants.

- [Facade family surfaces](../sources/facade-families/INDEX.md): precision charcoal panels, ivory and grey coatings, portrait screen art, portal stone and polished steel.

- [Garden tower recipes](../batch/cyberpunk/garden-tower.json): pale podium concrete, foliage and reflective black glazing.

- [Native street surfaces](../sources/streets/scene-native/CONTRACT.md): UV rules, shader equations and source hashes for ordinary streets and hardware.
- [Street sources](../sources/streets/INDEX.md) and [recipes](../batch/cyberpunk/street-image-finishes.json): continuous photographic finish fields.
- [Street prop sources](../sources/street-props/INDEX.md) and [recipes](../batch/cyberpunk/street-props/): cardboard, wood, coating and polymer.
- [Exterior sources](../sources/exterior-native/INDEX.md) and [recipes](../batch/cyberpunk/exterior-native/): cast, weathered and graphite concrete.
- [Accepted Exterior finishes](../sources/exterior-native/accepted.json): fourteen native sets, exact counterparts and original source hashes.
- The canonical `cyberpunk/concrete-monolith-graphite/mid#graphite` roof binding shares the existing monolith graphite maps and scale. Its separate identity lets one exterior select weathered walls and graphite roofs without conflicting variant choices on one key.
- [Exterior accent recipes](../batch/cyberpunk/exterior-accents.json): blue and gold frame coatings with canonical `coat` variants.
- [Interior sources](../sources/interiors/INDEX.md) and [recipes](../batch/cyberpunk/interiors/): luxury, damaged and capsule finishes, plus [capsule and service coatings](../sources/interiors/INDEX.md#capsule-and-service-finishes), a hexagonal floor, worn gunmetal, linen and fine satin alloy.
- Apartment style sources and recipes: [Corpo Plaza](../sources/corpo-plaza/INDEX.md) veneer, stone, leather, textiles, glass and mirror; [Meridian](../sources/meridian/INDEX.md) lobby stone, mineral walls, ceiling metal, shell, textiles and bathroom optics; [Sandra Dorsett](../sources/sandra-dorsett/INDEX.md) tatami and lattice infill; [Gutierrez](../sources/gutierrez/INDEX.md) artwork and lacquer; [Loft 1702](../sources/loft1702/INDEX.md) marble, rug and red lens.
- [Interior kind sources](../sources/interior-kinds/INDEX.md) and [recipes](../batch/cyberpunk/interior-kinds/): E1 apartment panels, gloss ceiling, polished floor, housings, worktop, grille, caustic glass, vending screen and cyan lens; B3 gold trim; R1 portal stone, veneers, walnut floor and ceiling, leather and burl; worn capsule enamel, C2 corridor paint and pipe lagging, C4 stall laminate, terracotta tile and teal paint, C6 quilted padding, C7 cream plates and poor-tier neon lenses.
- [Terrace fern sources](../sources/hiromi-fern/INDEX.md) and [recipes](../batch/cyberpunk/hiromi-fern/): exact leaflet lamina and stem fibres.
- [Manufactured interior recipes](../batch/cyberpunk/interior-manufactured.json): metric alloy and polymer surfaces, localized poor-tier oxidation, restrained holograms and exterior service-alloy aliases.
- [Room plates](../sources/window-rooms/INDEX.md) and [screen artwork](../sources/ads-codex/PROMPTS.md): retained images and authoring prompts.
- [Paired facade recipes](../batch/cyberpunk/paired-facade.json): lounge backplate, photographed graphite metal, periodic aluminum brushing, clear glazing and room/light surface states.
- [ComfyUI workflows](../templates/README.md): photographic and upscale templates.

- [District street recipes](../batch/cyberpunk/district-streets.json): fine hexagonal paving and glossy district panels, curbs and junction coatings. Native bindings expose the same authored maps to Streets; [marquee run sources](../sources/streets/INDEX.md#marquee-run) add the channel and frame finishes and the dot-matrix LED face.

- [Used urban surface remaster](../sources/surface-remaster/INDEX.md): generated sources, keys, physical scales, shared masks and decal layout.
- [Surface detail binding](../bindings/surface-detail.json): engine roles, texture hashes and repeat sizes.
- [0.22.1 release manifest](../releases/surface-remaster-0.22.1.json): checked PNG/KTX2 overlay inventory, including the sealed-street refinement.

- [Street variation sources](../sources/street-variants/INDEX.md), [companion binding](../bindings/street-variants.json) and [selection contract](../sources/street-variants/CONTRACT.md): coordinated distinct condition variants, preserving native surface identity and UVs.

- [Highway concrete sources](../sources/highway-concrete/INDEX.md): formed deck/barrier, soffit and pier candidates with physical scale and placement-weathering requirements.
- [Interior floor authoring inventory](../sources/interior-floors/integration-manifest.json): clinic studs, quarter-turn utility ribs, red stone and grey stone, with portable import recipes and full PNG/KTX hashes.
