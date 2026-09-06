# Box map

- Street source finishes: [recipes](../batch/cyberpunk/street-image-finishes.json) and [source index](../sources/streets/INDEX.md), continuous image-derived road/precast/graphite candidates with per-family tone and finish; construction bindings select precast and graphite at physical scale.
- Street markings: [bindings](../bindings/street-markings.json) and [schema](../schema/street-markings.schema.json), continuous white and dark-orange coatings for Engine-owned line, arrow and crossing geometry.

- Local tiled albedo: `sourceAlbedo` in [create request](../schema/create-request.schema.json), imports an opaque continuous source locally through the shared photographed PBR and seam-checked writer.

- Localized damp finish: [response schema](../schema/surface-response.schema.json), shared smooth coverage coordinates roughness, albedo darkening and relief on continuous mineral maps; dry area remains dominant.

- Packed material response: [pack request](../schema/pack-request.schema.json), additive RGB metallic-roughness maps for glTF, generated from the separate absolute maps through one shared writer.

- Street construction finishes: [recipes](../batch/cyberpunk/street-construction.json) and `constructionSurfaces` in [street bindings](../bindings/street-styles.json), continuous role finishes for Atlas-owned slab pitches, joints and residual regions. Role mapping is in the [Ground contract](../CONTRACT.md#ground).

- Street families: [bindings/street-styles.json](../bindings/street-styles.json), seeded maintained, salvaged and industrial road defaults with independent fitted-paving finishes; [schema](../schema/street-styles.schema.json) and [recipes](../batch/cyberpunk/street-surfaces.json). An optional construction road binding overrides that default. Geometry owns borders and curb joints.

- Door finishes and coverings: [door finish recipes](../batch/cyberpunk/door-finishes.json) add satin and scuffed coatings; [curtain recipes](../batch/cyberpunk/curtain.json) publish complete dark charcoal covering families.

- Scenic room surfaces: [bindings/window-room-surfaces.json](../bindings/window-room-surfaces.json), five explicit receiving faces and seeded back-image pools; [schema](../schema/window-room-surfaces.schema.json).
- Exterior surface recipes: [batch/cyberpunk/exterior-surfaces.json](../batch/cyberpunk/exterior-surfaces.json), continuous concrete, 7 m panels, metallic louvres and fitted translucent grime.

- Exterior styles: [bindings/exterior-styles.json](../bindings/exterior-styles.json), nine complete palettes in three groups; [schema](../schema/exterior-styles.schema.json) and [recipes](../batch/cyberpunk/exterior-finishes.json) define their bindings and generated finishes.

- Window room plates: [batch/cyberpunk/window-room.json](../batch/cyberpunk/window-room.json), exact office, apartment and lobby imagery imported by [src/gen/ImagePlate.ts](../src/gen/ImagePlate.ts); source prompts in [sources/window-rooms/INDEX.md](../sources/window-rooms/INDEX.md).

- Door coating recipe: [batch/cyberpunk/door.json](../batch/cyberpunk/door.json), deterministic graphite paint with tiered wear on the canonical door keys.

- root box: [CONTRACT.md](../CONTRACT.md). `src/index.ts` exports resolve, list, create, refinish, rebrand and pack; `src/api-types.ts` specifies their package-only structures. `src/db` owns the theme index and files. `src/gen` owns ComfyUI generation, deterministic maps, patterns, screens, refinish, rebrand and packed material response. `bindings` carries consumer key mappings. `themes` is the shipped database. Depends on Atlas hydrology binding and street-construction role contracts, data only.
- CLI box: [src/cli/CONTRACT.md](../src/cli/CONTRACT.md). `pbrforge` verbs print one JSON envelope and exit. `patterns` lists procedural create kinds from [schema/pattern-kinds.json](../schema/pattern-kinds.json). Skill pack: [skills/pbrforge/SKILL.md](../skills/pbrforge/SKILL.md). Depends on the root package operations.
- preview box: [src/ui/CONTRACT.md](../src/ui/CONTRACT.md). Interactive materials browser and PBR stage, built from [schema/preview-view-layout.schema.json](../schema/preview-view-layout.schema.json) and [src/ui/views/preview-layout.json](../src/ui/views/preview-layout.json). Depends on the root material entry, theme index, browser APIs and Three.js.
