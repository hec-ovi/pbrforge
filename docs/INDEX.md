# Box map

- Scenic room surfaces: [bindings/window-room-surfaces.json](../bindings/window-room-surfaces.json), five explicit receiving faces and seeded back-image pools; [schema](../schema/window-room-surfaces.schema.json).
- Exterior surface recipes: [batch/cyberpunk/exterior-surfaces.json](../batch/cyberpunk/exterior-surfaces.json), continuous concrete, 7 m panels, metallic louvres and fitted translucent grime.

- Exterior styles: [bindings/exterior-styles.json](../bindings/exterior-styles.json), nine complete palettes in three groups; [schema](../schema/exterior-styles.schema.json) and [recipes](../batch/cyberpunk/exterior-finishes.json) define their bindings and generated finishes.

- Window room plates: [batch/cyberpunk/window-room.json](../batch/cyberpunk/window-room.json), exact office, apartment and lobby imagery imported by [src/gen/ImagePlate.ts](../src/gen/ImagePlate.ts); source prompts in [sources/window-rooms/INDEX.md](../sources/window-rooms/INDEX.md).

- Door coating recipe: [batch/cyberpunk/door.json](../batch/cyberpunk/door.json), deterministic graphite paint with tiered wear on the canonical door keys.

- root box: [CONTRACT.md](../CONTRACT.md). `src/index.ts` exports resolve, list, create, refinish and rebrand; `src/api-types.ts` specifies their package-only structures. `src/db` owns the theme index and files. `src/gen` owns ComfyUI generation, deterministic maps, patterns, screens, refinish and rebrand. `src/cli` exposes the write lanes and contact sheets. `bindings` carries consumer key mappings. `themes` is the shipped database. Depends on Atlas hydrology material-key binding data only.
- preview box: [src/ui/CONTRACT.md](../src/ui/CONTRACT.md). Depends on the root material entry and theme index, browser APIs and Three.js.
