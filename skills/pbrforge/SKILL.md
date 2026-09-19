---
name: pbrforge
description: Author and inspect PBR material sets with the pbrforge CLI, including photo imports, patterns, screens, refinish and catalog lookup.
---

# pbrforge

Version: 0.17.5. Use the public CLI to author or inspect a themed material database.

Run `pbrforge` if installed on PATH. From the checkout use `npm run --silent pbrforge -- <verb>` or, after `npm run build`, `node dist/cli/pbrforge.js <verb>`. Start with `doctor` for readiness and `help` for verb syntax. `--themes <dir>` selects a separate database; omission uses bundled `themes/`.

## Choose the operation

| Need | Verb and request |
| --- | --- |
| Find an existing material | `list [--theme t] [--kind k] [--tier t]`, then `resolve <key>` |
| One opaque JPEG/PNG to dry maps | `from-image <request.json>`; read [photo input and framing](references/from-image.md) |
| Discover procedural patterns | `patterns`, then read the returned detail path for the chosen kind; [resolver](references/patterns/INDEX.md) |
| Generate a set | `create <request.json>` with a photographic description, pattern, flat color or recolor |
| Import prepared sources | `create <request.json> --native` with `sourceAlbedo.path` (seam-checked tile), `sourceImage.path` (emitting exact plate), or every `screens[].imagePath` |
| Adjust stored gloss and relief | `refinish <requests.json>` with `key` and `finish` or `physical` |
| Brand existing screens | `rebrand --theme t --businesses <file.json>` in a world-owned theme copy |
| Add packed response maps | `pack --theme t` |
| Inspect the PBR sphere | `preview`; start the viewer with `npm run preview` if needed |

Requests, defaults and the copyable example are in the checkout's root `SKILL.md`; operation schemas are in its `schema/` folder. A create file accepts one request or an array; arrays skip existing keys. `--overwrite` explicitly replaces an entry or supported variant.

Photographic generation needs ComfyUI. Local derivation, patterns, flat colors, recolor, rebrand and reads do not. For screen imports, supply artwork that covers the requested resolution: undersized artwork enters the ComfyUI upscale path even with `--native`.

## Authoring rules

- Resolve before creating so existing keys and variants can be reused. Write through verbs; they produce the catalog and map files.
- On tiled append, explicit `tiling.worldSize` sets the new variant scale. Consumers use `variant.tiling ?? entry.tiling`; existing variants keep their entry scale.
- A material is a coordinated map set, not one PNG. Resolve after writing and report the key, variant IDs and map paths.
- Match image proportions and physical size. Repeating sources start clean, with even lighting; place unique marks as separate fitted artifacts. Scene Studio surfaces use native photographic sources.
- `from-image` accepts asymmetry but does not check wrap continuity. `sourceAlbedo` requires an opaque wrapping tile, whole-image downsampling and a passing seam gate.
- Copy finished theme folders for world-specific branding. Geometry owns UV placement, panel divisions and artifact placement.
- CLI stdout is one JSON envelope, `{ok,verb,data}` or `{ok,verb,error}`. Report `error.code` and `error.message`; fix the named input before retrying. Exit 0 is success, 2 usage, 1 other failure.

The preview is read-only. Pattern extension guidance lives in [ADD.md](references/patterns/ADD.md).
