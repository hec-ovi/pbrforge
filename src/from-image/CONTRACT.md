# CONTRACT: from-image

Purpose: one opaque PNG in, a full dry PBR set out. No seam gate. No emission. No ComfyUI.

## In

`new FromImage(db).run(request)` with [request schema](request.schema.json).

- `path`: JPEG or PNG. Must cover `resolution`, same aspect, fully opaque. Downsample only. No upscale.
- `alignment`: `exact` (asymmetric faces: AC, door, poster) needs `aspect`. `tile` (bricks, concrete, walls) needs `tiling.worldSize`. Tile does not check wrap; the engine still repeats the sheet.
- `append`: add this photo as another variant of an existing key. Inherits alignment, aspect or tiling, physical, and finish. Needs `variantId`.
- `physical`: metallic 0 or 1, roughness at least 0.45, no transmission, no emissive, opaque.
- `finish`: how brightness becomes height and roughness.

## Out

A `MaterialEntry` written to the theme database. Variant `class: image`. Maps: basecolor, normal, roughness, metallic, height, ao, packed metallicRoughness. No emission, no opacity. Append returns the same entry with the new variant last.

## Errors

- `E_SCHEMA`: bad request, unreadable or transparent source, size/aspect mismatch, wet or emissive physical.
- `E_KEY_EXISTS`: key already in the database and `overwrite` is false, or that `variantId` already exists on an append.
- `E_KEY_NOT_FOUND`: append to a key that is not in the database.

## Invariants

- Does not call `create`, patterns, `sourceAlbedo`, `sourceImage`, or screens.
- Height comes from albedo luminance (dark sinks, bright rises). Normal and AO from that height. Roughness from the finish band. Metallic is the factor, flat. Baked photo shadows become relief.
- Screens, plates with emission, wrapping-only imports, and opacity decals stay on `create`.

## Depends on

- Database write, [maps derive](../gen/maps.ts), PackedMaps, MaterialEntry schema.
