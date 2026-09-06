# CONTRACT: pbrforge CLI

Purpose: one process per verb that reads or writes the material database and prints one JSON envelope.

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
| `doctor` | `ready`, checks (node, themes, skill, optional comfy, optional preview), `nextActions` |
| `version` | `version` |
| `help` | `verbs` |
| `resolve <key>` | `entry` |
| `list [--theme --kind --tier]` | `keys`, `count` |
| `patterns` | `kinds` (`kind`, `draws`, `reads`, `detail`), `count` |
| `from-image <request.json>` | `key`, `variant`, `maps`, `alignment` |
| `create <request.json> [--overwrite] [--native]` | `created`, `skipped` (batch skips `E_KEY_EXISTS`) |
| `refinish <requests.json>` | `results` |
| `rebrand --theme --businesses` | `branded` |
| `pack --theme` | `packed` |
| `preview` | `url`, `up`, `start` (does not launch the viewer) |

`patterns` reads [pattern-kinds.json](../../schema/pattern-kinds.json). `from-image` is the [from-image box](../from-image/CONTRACT.md): one opaque PNG, dry PBR maps, no seam gate, no emission. `append` on the request adds another face to an existing key. Create request JSON is [CreateRequest](../../schema/create-request.schema.json) or an array of them. `--native` on create is unchanged (`sourceImage`, `sourceAlbedo`, or `screens[].imagePath`). Preview is started with `npm run preview`. Photographed create needs ComfyUI; pattern, plate, from-image, recolor, rebrand and pack do not.

## Depends on

- [Materials contract](../../CONTRACT.md)
- [from-image contract](../from-image/CONTRACT.md)
