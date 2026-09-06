---
name: pbrforge
description: >
  Generate and look up themed PBR materials (maps, tiling, physical properties) through the
  pbrforge CLI. Resolve a theme/kind/tier key, list the catalog, list pattern kinds, create
  or refinish a set, rebrand ad screens, pack metallic-roughness maps, or open the sphere
  preview. Use whenever the user wants a material, texture set, PBR maps, a wall/road/glass/door
  finish, a procedural pattern, or to inspect the cyberpunk material library. Never edit
  theme.json or map PNGs. Every catalog action is a verb.
---

# pbrforge

Drive the material database with ONE CLI. Every verb prints one JSON object `{ok, verb, data}` or `{ok, verb, error}` and exits. On `ok:false` follow `error.hint`.

Never write map PNGs by hand, never edit `theme.json`. The verbs write catalog entries. To add a **new pattern kind** (a new drawer), follow [references/patterns/ADD.md](references/patterns/ADD.md).

## Resolve the CLI (once)

From the pbrforge checkout (this repo):

```
npm run pbrforge -- <verb>
```

Reuse that prefix. `command -v pbrforge` wins if the bin is on PATH.

## Start here

```
npm run pbrforge -- doctor
```

Read `data.ready` and `data.nextActions`. Do not hand-probe Node, ComfyUI, or the preview. Photographed creates need ComfyUI; pattern, plate, from-image, recolor, rebrand, pack, resolve and list do not.

## When to use which

| The user wants | Verb |
| --- | --- |
| is this machine able to work | `doctor` |
| look up a key | `resolve <theme/kind/tier>` |
| what keys exist | `list [--theme t] [--kind k] [--tier t]` |
| what pattern kinds create can draw | `patterns` (then read `data.kinds[].detail` for one kind) |
| one photo to a dry PBR set (AC, brick, concrete, no wrap required) | `from-image <request.json> [--overwrite]` |
| make a new set | `create <request.json> [--overwrite]` |
| re-read gloss/relief from stored albedo | `refinish <requests.json>` |
| put business names on screens | `rebrand --theme <theme> --businesses <file.json>` |
| add packed metallic-roughness maps | `pack --theme <theme>` |
| is the sphere viewer up | `preview` (start it with `npm run preview` if `up` is false) |

`--themes <dir>` on any verb points at another database. Omit it to use the bundled `themes/`.

A create file is one request object or an array. Array mode skips keys that already exist, so a batch is resumable. `--overwrite` replaces.

## One native photo (`from-image`)

Read [references/from-image.md](references/from-image.md) before every call. Framing of the photo is in that file (fill the frame; exact vs tile; clean tiles first; box sides from the front; artifacts as opacity decals). Bricks, concrete, stone, AC faces, posters: one JPEG or PNG, dry maps derived, asymmetry allowed, no emission.

```
npm run pbrforge -- from-image request.json
```

## Native image (`create --native`)

Keep this for the three **create** lanes that already work: `sourceImage` (exact plate, flat maps, basecolor copied to emission), `sourceAlbedo` (wrapping tile only; seam-checked), `screens[].imagePath` (ad artwork). Do not point bricks, concrete, or AC faces here.

## What one material is

A key (`cyberpunk/door/mid`) is one catalog entry. It is not one image.

Each **variant** of that entry is a set of PNG maps:

- always: `basecolor`, `normal`, `roughness`, `metallic`, `height`, `ao`
- usually also: packed `metallicRoughness` (G=roughness, B=metallic)
- extra when needed: `emission` (screens, plates), `opacity` (decals), `artwork` (brandless screen picture)

One create call paints **one surface** (the albedo, or screen artwork), then this box **derives** the other maps. ComfyUI is not asked for a normal or a roughness. A key with four variants is four surfaces, each with that full map set.

## Create lanes (pick one per request)

The request JSON is the create-request schema. Do not invent a lane mix.

| Field | Surface comes from | Needs ComfyUI |
| --- | --- | --- |
| `pattern` | drawn in code | no |
| `sourceImage` | a local baked plate | no |
| `sourceAlbedo` | a local tiled photo | no |
| `flatColor` | a flat colour | no |
| `recolor` | tint of an existing variant (`append`) | no |
| `screens` / `emission: "image"` | ad artwork, then display structure | only if no `imagePath` |
| `--native` plus a PNG path | your image tool, then import | no |
| otherwise | photographed albedo | yes |

Prefer `pattern` when the surface can be drawn. Prefer `from-image` when the user gave or asked for a photograph (brick, concrete, wrecked AC). Run `patterns` for the drawer list. Screens take a source plate when one exists under `sources/`.

After create, `resolve` the key and report the variant ids and map paths. If the user wants to see it, `preview` then tell them the URL.

## Rules

0. **Doctor first** in a session, and whenever anything is strange.
1. **Read before you write.** `resolve` / `list` before `create`. Do not overwrite a shipped key unless asked.
2. **One request JSON per create.** Put it in the workspace, pass the path. Do not inline a novel on the command line.
3. **Relay `error.code` and `error.message`.** Fix the one thing it names. Do not loop create hoping a seam failure changes.
4. **The preview is read-only.** It never creates. Start it with `npm run preview`; the verb only reports whether it is up.

## Never

- Edit `themes/*/theme.json` or map PNGs by hand.
- Read `src/` except the files named in [references/patterns/ADD.md](references/patterns/ADD.md) when adding a pattern kind.
- Call ComfyUI, curl, or the Vite URL to create materials.
- Treat one PNG as the whole material.
- Invent roughness below 0.45 on a dry non-glass surface, or metallic other than 0 or 1.
