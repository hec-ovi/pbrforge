# CONTRACT: from-image

Purpose: derives a dry PBR set from one opaque JPEG or PNG.

Version: 0.16.34.

## Input

Public CLI: `pbrforge from-image request.json [--themes <dir>] [--overwrite]`, using [FromImageRequest](request.schema.json). Internal entry: `new FromImage(db).run(request)`.

- Required `key`, `path`, `description`. Paths are absolute or relative to the package folder. Source must cover resolution, match aspect and be opaque; whole-image downsample only.
- New entries require `alignment`: `exact` with `aspect`, or `tile` with `tiling.worldSize` in metres. Tile has no wrap-continuity check.
- `append: true` requires `variantId` and inherits the existing alignment, scale, physical and finish. Resolution defaults to the existing first variant on append, otherwise `[1024,1024]`. A new variant ID defaults to `"1"`.
- `physical` defaults to metallic 0 and roughness 0.65. Dry response requires metallic 0 or 1, roughness and finish bands at least 0.45, no transmission/emission and opaque alpha.
- `finish` defaults to the roughness factor ±0.05 clamped to 0..1, grain 0.2 and relief 2. `overwrite` and `append` default to false.
- Resolution matches physical aspect within one pixel; tile at most 1048576 pixels, exact at most 4096 per side and 9437184 total.

## Output

[MaterialEntry](../../schema/material-entry.schema.json) written to the selected database. Appends return the entry with the new variant last. Variant class is `image`, with basecolor, normal, roughness, metallic, height, AO and packed metallic-roughness. CLI [envelope](../cli/CONTRACT.md) contains `{key,variant,maps,alignment}`.

Height follows brightness; normal and AO follow height; roughness follows the finish band; metallic is constant. No emission, opacity, seam gate or backend calls.

## Errors

Controlled errors use [MaterialsError](../db/errors.ts): E_SCHEMA (request/source/size/physical), E_KEY_EXISTS (key or append ID exists), E_KEY_NOT_FOUND (append key absent), E_THEME_NOT_FOUND (append theme absent). Duplicate append IDs fail even with overwrite. Unexpected filesystem errors propagate to the CLI error wrapper. Write preflight is tracked in [issues](../../docs/ISSUES.md).

## Dependencies

Materials database, shared map derivation and packed-map writer, [MaterialEntry schema](../../schema/material-entry.schema.json). No other Urbe box.
