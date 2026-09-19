# CONTRACT: pbrforge CLI

Purpose: one process per verb that reads or writes the material database and prints one JSON envelope.

Version: 0.17.4.

## In

`run(argv)` takes the words after `pbrforge`. `--themes <dir>` on any verb selects the database; omit it to use the bundled `themes/`.

## Out

Stdout is one JSON object, then exit.

- ok: `{ ok: true, verb, data }`
- error: `{ ok: false, verb, error: { code, message, details?, hint? } }`

Exit 0 on ok, 2 on `E_USAGE`, 1 on any other error. Closed error codes are the package `MaterialsError` set plus `E_USAGE` and `E_INTERNAL`.

## Verbs

| Verb | data |
| --- | --- |
| `doctor` | `ready`, `version`, `themesDir`, `preview` (`url`, `up`), `comfy` (`url`, `ready`), `checks`, `nextActions`. Checks: node, themes, themes-writable when a theme exists, skill, comfy, preview. `ready` is true when node, themes and skill pass. |
| `version` | `version` |
| `help` | `verbs` |
| `resolve <key>` | `entry` |
| `list [--theme --kind --tier]` | `keys`, `count` |
| `patterns` | `kinds` (`kind`, `draws`, `reads`, `detail`), `count` |
| `from-image <request.json>` | `key`, `variant`, `maps`, `alignment` |
| `create <request.json> [--overwrite] [--native]` | `created`, `skipped` (batch skips `E_KEY_EXISTS`) |
| `refinish <requests.json>` | `results` |
| `rebrand --theme --businesses` | `branded`, `count` |
| `pack --theme` | `packed` (`key`, `variants` per canonical key) |
| `preview` | `url`, `up`, `start` (does not launch the viewer) |

`patterns` reads [pattern-kinds.json](../../schema/pattern-kinds.json). `from-image` is the [from-image box](../from-image/CONTRACT.md): one opaque JPEG or PNG, dry PBR maps, no seam gate, no emission. `append` adds another face to an existing key. Create JSON is [CreateRequest](../../schema/create-request.schema.json) or an array; arrays skip existing keys. `--native` requires `sourceImage`, `sourceAlbedo`, or every `screens[].imagePath`. Undersized screen sources still enter the upscale backend path; see [issues](../../docs/ISSUES.md).

Refinish JSON accepts one [RefinishRequest](../api-types.ts) or an array, retaining requests with `finish` or `physical`; an empty retained list is E_USAGE. Rebrand takes the businesses array from [RebrandRequest](../../schema/rebrand-request.schema.json). Pack applies [PackRequest](../../schema/pack-request.schema.json) to all canonical keys in the selected theme. Preview is started with `npm run preview`. Photographic create needs ComfyUI; pattern, plate, sourceAlbedo, from-image, flat, recolor, rebrand and pack do not.

## Depends on

- [Materials contract](../../CONTRACT.md)
- [from-image contract](../from-image/CONTRACT.md)
