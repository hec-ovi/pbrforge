# materials: PBR material set generator and database

You own this box. You build only what lives in this repo.

## Context (general, do not expand it)
This repo is one isolated layer of a larger build: a seeded, deterministic city world that ends as a playable 3D game (map, buildings, transit, NPCs, quests). Nine layers are built in parallel by separate sessions, each locked to its own repo, coupled only through CONTRACT.md files. Never read another layer's code or tests, only its CONTRACT.md. Your raw requirements are in docs/REQUIREMENTS.md, in the user's own words: they win over any summary here.

## Scope
- Generates full PBR material sets via ComfyUI templates: the map set research says a material needs (base color, normal, roughness, metallic, height, emission where it applies), plus tiling configuration, reflectivity, transparency, breakable flag.
- Theme sets as folders: themes/[name]/assets plus a JSON schema so the deterministic layers pick materials programmatically. First and only theme for now: sci-fi cyberpunk. Structure stays expansible (medieval, ancient, modern later).
- Kinds needed first: concrete variants by quality tier, glass kinds (office, residential, corpo), metal and steel, brick, painted wall, road, big road, highway, sidewalk, street light, colors, water, plastic, plus exact-alignment materials (computer screens, video ads, image ads) which are restricted to perfect placement.
- Agentic creation flow: "create me a glass material" runs the ComfyUI template, generates the whole set, saves it to the database. Mostly manual creation at first; once base templates exist, the library grows.
- Preview: the classic material sphere viewer with lighting, to inspect a material in detail.
- Everything tiles at exact resolution: no stretch, ever.

## Out of scope
No geometry, no buildings, no city logic. This box is textures, maps and the material database only.

## Local references
The user has ComfyUI based projects on this machine: ~/workspace/comfyui-strix-docker and ~/workspace/glb-buildings-skill (it has a research/skill structure worth mirroring). Confirm with the user before assuming their state.

## Depends on
None (root of the dependency graph).

## Consumers
../exterior, ../interior, ../engine

## Working order
1. Deep research first: 2026 state of the art on PBR texture generation with ComfyUI (which workflows, which models, seamless tiling techniques, map extraction). Compact conclusions to docs/RESEARCH.md.
2. Draft CONTRACT.md with the material set schema before generating anything: exterior and interior consume it.
3. Build the templates and the database, then the preview.
4. Keep CONTRACT.md and docs/INDEX.md current.

## Hard requirements
- Seamless tiling verified on every set.
- Standalone: works with no other layer present.
- Prompts and ComfyUI instructions live in their own files, never inline in code.
- Preview UI follows src/ui/ with views/, widgets/, components/.

## Coordination
- Read docs/FEEDBACK.md at the start of every session.
- Write blockers and cross-layer questions to docs/ISSUES.md.

## Master requirements (background only)
docs/FULL-REQUIREMENTS.md holds the user's complete raw requirements for the whole project, so you see your surroundings. Read it once for awareness. It never widens your scope: what you build is defined by this file and docs/REQUIREMENTS.md only.
