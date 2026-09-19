---
name: materials
description: Resolve, list or author reusable PBR material sets through the urbe-materials package API or pbrforge CLI.
---

# Materials

Version: 0.17.3. Materials generates and stores themed PBR maps with physical scale, resolved by `theme/kind/tier`.

## Call

Library: `import { resolve, list, create, refinish, rebrand, pack } from 'urbe-materials'` after `npm run build`. Calls and response types are in [CONTRACT.md](CONTRACT.md).

CLI: `node dist/cli/pbrforge.js <verb>` after building, or `npm run --silent pbrforge -- <verb>` from this checkout. `help` lists verbs; `patterns` lists pattern kinds and their detail paths. The [authoring skill](skills/pbrforge/SKILL.md) explains lane selection.

`options.themesDir` or CLI `--themes <dir>` selects a database, defaulting to bundled `themes/`. `options.comfy` supplies a generation backend; otherwise `COMFY_URL` defaults to `http://127.0.0.1:8188`. Reads and local derivation need no backend.

## Requests and defaults

| Operation | Fields |
| --- | --- |
| `resolve(key, options?)` | Required key or alias. |
| `list(filter?, options?)` | Optional `theme`, `kind`, `tier`; omitted fields match all canonical keys. |
| `create(request, options?)` | Required `key`, `alignment`, `description`; tile needs `tiling.worldSize` in metres, exact needs `aspect`. Append inherits the existing scale. |
| Create settings | `resolution: [1024,1024]`, `variants: 1`, `emission: "none"`, `append: false`, `canonical: false`, `overwrite: false`. Seed defaults to a hash of description; `variantId` defaults to its position starting at `"1"`. |
| Create appearance | Optional `aliases`, `physical` (default `{}`; map factors default to roughness 1, metallic 0), `finish` (roughness factor ±0.05 clamped to 0..1, grain 0.2, relief 2), `layout`, `decal`. |
| Create source | Choose photographic description, `pattern`, `flatColor` (`flatNoise: 0.04`), `recolor`, `sourceImage`, `sourceAlbedo`, or screen artwork. Screen emission uses `emission: "image"`, `flatColor`, `screens[]`; optional `brandName` and `businessKind`. [Schema](schema/create-request.schema.json) defines combinations. |
| `refinish(request, options?)` | Required `key`; optional `finish` uses the same defaults, `physical` merges into stored factors. |
| `rebrand(request, options?)` | Required `theme`, `businesses: [{brandName,businessKind,tier}]`; an empty list is valid. [Schema](schema/rebrand-request.schema.json). |
| `pack(request, options?)` | Required `key`. [Schema](schema/pack-request.schema.json). |
| `from-image request.json` (CLI) | Required `key`, `path`, `description`, plus alignment and scale for a new entry. Resolution defaults to 1024² or the first existing variant on append; physical defaults to metallic 0, roughness 0.65. [Request and defaults](src/from-image/CONTRACT.md). |

## Response and errors

`resolve` and `create` return [MaterialEntry](schema/material-entry.schema.json); `list` returns sorted canonical keys. `refinish` and `pack` return `{entry, variants}`; `rebrand` returns `{key, variantId, from, lines}[]`.

`variant.maps` contains PNG path strings; optional `variant.ktx2` contains compressed paths by map name. All paths are relative to the theme folder. Prefer `ktx2` when available, falling back to the PNG master. Run `npm run compress` after authoring. Use the declared scale and variant ID. Basecolor/emission are sRGB, data maps linear, normals +Y. Roughness and metallic maps use scalar factors 1. Fit exact maps once; repeat tiles at `tiling.worldSize`.

CLI stdout is `{ok:true, verb, data}` or `{ok:false, verb, error:{code,message,details?,hint?}}`. Exit codes: 0 success, 2 usage, 1 other failure. Library `MaterialsError` codes: `E_SCHEMA`, `E_KEY_NOT_FOUND`, `E_KEY_EXISTS`, `E_THEME_NOT_FOUND`, `E_COMFY_UNAVAILABLE`, `E_GENERATION_FAILED`, `E_SEAM_CHECK_FAILED`. CLI adds `E_USAGE`, `E_INTERNAL`; preview uses `E_DATABASE_UNAVAILABLE`. Report the code and message; correct the named input. Unexpected library filesystem/backend exceptions can propagate; see [issues](docs/ISSUES.md).

## Worked example

Run from this checkout; this creates one local procedural set in an isolated database:

```sh
npm run build
mkdir -p out
cat > out/material-request.json <<'JSON'
{"key":"sample/concrete/mid","alignment":"tile","description":"neutral mineral concrete","tiling":{"worldSize":[1,1]},"resolution":[64,64],"physical":{"roughnessFactor":0.8,"metallicFactor":0},"seed":7,"pattern":{"kind":"mineral","colors":["#707475"]}}
JSON
node dist/cli/pbrforge.js create out/material-request.json --themes out/skill-example
node dist/cli/pbrforge.js resolve sample/concrete/mid --themes out/skill-example
```

Create returns `data.created: [{key:"sample/concrete/mid",variants:1}]`; resolve returns `data.entry` with one complete PBR variant. An existing key needs explicit overwrite or a new key.
