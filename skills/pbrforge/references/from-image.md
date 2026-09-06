# from-image

One opaque color picture in. Dry PBR maps out. No ComfyUI. No seam gate. No emission.

```
npm run pbrforge -- from-image request.json [--overwrite]
```

Schema: [src/from-image/request.schema.json](../../../src/from-image/request.schema.json).

## Use this

Bricks, concrete, stone, damaged AC faces, posters, any **one** photo that should become a material. Asymmetry is allowed. Unique objects use `exact`. Repeating fields use `tile` (the engine will still repeat; this verb does not check wrap).

## Generate the photo

The writer copies pixels. Framing is decided in the photograph.

**Exact** (AC, door, hatch, poster): front-on, orthographic. The object fills the frame edge to edge. No sky, ground, surrounding wall, empty margin, or perspective. Square `1:1` unless the face is not square, then match `aspect`. Dents, rust, torn slats are wanted on the front. Do not crop a 3/4 view to fake a face.

**Tile** (brick, concrete, subway, marble, wall panel): first photo is always a clean tilable panel. Even lighting, no directional shadow, no vignette. No graffiti, paper, unique crack, replacement tile, or stain you could point at twice. The pattern continues off every edge. Square `1:1`. Critical: if it tiles, a hero mark repeats as wallpaper.

After generate, look at the photo. Sky, floor, or empty margin: generate again. Do not import that frame.

## Box faces

Front first, `alignment: exact`. Missing faces (side, top, bottom) are the same paint and dirt, no extra hardware. Edit the front PNG with `image_edit`, then `from-image` with `append: true` and `variantId` `side` / `top` / `bottom`.

Prompt:

```
Given this front photograph as the only reference, produce an orthographic <side|top|bottom> of the same object. Plain painted case only, matching this color, rust, and dirt. No grille, fan, handle, lock, vents, labels, or new damage. The panel fills the entire frame edge to edge. No ground, sky, or empty margin. Flat even lighting.
```

Look at the result. If it is the front with the handle deleted (same door recess, same stencil), edit again until it is a flat case sheet.

## Artifacts

Do not bake paper, graffiti, or trash into a tiling photo. Stick a separate exact opacity material on that instance (`create` with opacity / the existing decal lane). Rebuild the whole panel only when that panel is unique and placed once, using the clean photo as the `image_edit` reference.

## Do not use this

| Need | Verb |
| --- | --- |
| glowing ad / LED screen | `create` + `screens` / `emission: "image"` |
| room plate that also emits | `create --native` + `sourceImage` |
| tile that already wraps on all four edges | `create --native` + `sourceAlbedo` |
| JS drawer (grille, mineral, lamp) | `create` + `pattern` |
| transparent graffiti / decal | not this verb (needs opacity) |

## Request

Exact face (AC, door):

```
{
  "key": "cyberpunk/ac-grok/mid",
  "path": "sources/ac-grok/damaged.png",
  "alignment": "exact",
  "aspect": [1, 1],
  "description": "damaged condenser face",
  "resolution": [1024, 1024],
  "variantId": "damaged",
  "physical": { "metallicFactor": 0, "roughnessFactor": 0.65 },
  "finish": { "roughness": [0.55, 0.75], "grain": 0.22, "relief": 1.8 }
}
```

Repeating field (brick, concrete):

```
{
  "key": "cyberpunk/brick/mid",
  "path": "sources/brick.png",
  "alignment": "tile",
  "tiling": { "worldSize": [2, 2] },
  "description": "photographed brick",
  "resolution": [1024, 1024],
  "physical": { "metallicFactor": 0, "roughnessFactor": 0.7 },
  "finish": { "roughness": [0.6, 0.8], "grain": 0.2, "relief": 1.6 }
}
```

JPEG or PNG. Must cover `resolution`, same aspect, fully opaque. Metallic 0 or 1. Roughness at least 0.45.

## What the maps are

Height is guessed from brightness (dark sinks, bright rises). Normal and AO follow height. Roughness stays inside `finish.roughness`. Metallic is the factor, flat. Baked photo shadows become fake pits. That is the method, not a bug in the writer.

Out: basecolor, normal, roughness, metallic, height, ao, packed. Never emission.
