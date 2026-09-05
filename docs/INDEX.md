# Box map

- Packed material response: [pack request](../schema/pack-request.schema.json), additive RGB metallic-roughness maps for glTF, generated from the separate absolute maps through one shared writer.

- Street construction finishes: [recipes](../batch/cyberpunk/street-construction.json) and `constructionSurfaces` in [street bindings](../bindings/street-styles.json), continuous paving bodies and joint mortar for geometry-owned slabs and joints.

- Street families: [bindings/street-styles.json](../bindings/street-styles.json), maintained, salvaged and industrial road, paving, border and curb finishes; [schema](../schema/street-styles.schema.json) and [recipes](../batch/cyberpunk/street-surfaces.json). Surface grain and wear use physical scale; geometry owns borders and curb joints.

- Door finishes and coverings: [door finish recipes](../batch/cyberpunk/door-finishes.json) add satin and scuffed coatings; [curtain recipes](../batch/cyberpunk/curtain.json) publish complete dark charcoal covering families.

- Scenic room surfaces: [bindings/window-room-surfaces.json](../bindings/window-room-surfaces.json), five explicit receiving faces and seeded back-image pools; [schema](../schema/window-room-surfaces.schema.json).
- Exterior surface recipes: [batch/cyberpunk/exterior-surfaces.json](../batch/cyberpunk/exterior-surfaces.json), continuous concrete, 7 m panels, metallic louvres and fitted translucent grime.

- Exterior styles: [bindings/exterior-styles.json](../bindings/exterior-styles.json), nine complete palettes in three groups; [schema](../schema/exterior-styles.schema.json) and [recipes](../batch/cyberpunk/exterior-finishes.json) define their bindings and generated finishes.

- Window room plates: [batch/cyberpunk/window-room.json](../batch/cyberpunk/window-room.json), exact office, apartment and lobby imagery imported by [src/gen/ImagePlate.ts](../src/gen/ImagePlate.ts); source prompts in [sources/window-rooms/INDEX.md](../sources/window-rooms/INDEX.md).

- Door coating recipe: [batch/cyberpunk/door.json](../batch/cyberpunk/door.json), deterministic graphite paint with tiered wear on the canonical door keys.

- root box: [CONTRACT.md](../CONTRACT.md). `src/index.ts` exports resolve, list, create, refinish, rebrand and pack; `src/api-types.ts` specifies their package-only structures. `src/db` owns the theme index and files. `src/gen` owns ComfyUI generation, deterministic maps, patterns, screens, refinish, rebrand and packed material response. `src/cli` exposes the write lanes and contact sheets. `bindings` carries consumer key mappings. `themes` is the shipped database. Depends on Atlas hydrology material-key binding data only.
- preview box: [src/ui/CONTRACT.md](../src/ui/CONTRACT.md). Depends on the root material entry and theme index, browser APIs and Three.js.
