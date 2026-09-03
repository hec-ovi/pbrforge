# Box map

- root box: [CONTRACT.md](../CONTRACT.md). `src/index.ts` exports resolve, list, create, refinish and rebrand. `src/db` owns the theme index and files. `src/gen` owns ComfyUI generation, deterministic maps, patterns, screens, refinish and rebrand. `src/cli` exposes the write lanes and contact sheets. `bindings` carries consumer key mappings. `themes` is the shipped database.
- preview box: [src/ui/CONTRACT.md](../src/ui/CONTRACT.md). Depends on the root material entry and theme index, browser APIs and Three.js.
