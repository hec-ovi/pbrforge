# Box map

- Door coating recipe: [batch/cyberpunk/door.json](../batch/cyberpunk/door.json), deterministic graphite paint with tiered wear on the canonical door keys.

- root box: [CONTRACT.md](../CONTRACT.md). `src/index.ts` exports resolve, list, create, refinish and rebrand; `src/api-types.ts` specifies their package-only structures. `src/db` owns the theme index and files. `src/gen` owns ComfyUI generation, deterministic maps, patterns, screens, refinish and rebrand. `src/cli` exposes the write lanes and contact sheets. `bindings` carries consumer key mappings. `themes` is the shipped database. Depends on Atlas hydrology material-key binding data only.
- preview box: [src/ui/CONTRACT.md](../src/ui/CONTRACT.md). Depends on the root material entry and theme index, browser APIs and Three.js.
