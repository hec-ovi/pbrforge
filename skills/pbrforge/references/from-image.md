# from-image

One opaque color picture in. Dry PBR maps out. No ComfyUI. No seam gate. No emission.

```
npm run pbrforge -- from-image request.json [--overwrite]
```

Schema: [src/from-image/request.schema.json](../../../src/from-image/request.schema.json).

## Use this

Bricks, concrete, stone, damaged AC faces, posters, any **one** photo that should become a material. Asymmetry is allowed. Unique objects use `exact`. Repeating fields use `tile` (the engine will still repeat; this verb does not check wrap).

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
