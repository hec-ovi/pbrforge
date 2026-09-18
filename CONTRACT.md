# CONTRACT: materials

Purpose: generates and stores themed PBR material sets that callers resolve by key.

Version: 0.17.2, matching `urbe-materials`. Package exports, schemas, catalog keys and consumer bindings are public boundaries. Breaking changes require orchestrator coordination.

## API

Import the six operations from `urbe-materials`. Shared [MaterialsOptions](src/api-types.ts) accepts `themesDir` (bundled `themes/` by default) and optional [ComfyRuntime](src/api-types.ts), with `ready()`, `upload(image,name)` and `render(graph)`. Without an injected runtime, `ComfyClient` uses `COMFY_URL` or `http://127.0.0.1:8188`; its constructor also accepts a URL and timeout in milliseconds (default 600000).

| Call | Input schema | Output schema and effect |
| --- | --- | --- |
| `resolve(key, options?)` | Lowercase `theme/kind/tier` key or alias, [MaterialEntry identity](schema/material-entry.schema.json) | [MaterialEntry](schema/material-entry.schema.json), read only. |
| `list(filter?, options?)` | [MaterialFilter](src/api-types.ts): optional theme, kind, tier | Sorted canonical `string[]`, [API](src/index.ts); omitted filters match all. |
| `create(request, options?)` | [CreateRequest](schema/create-request.schema.json) | Promise of written [MaterialEntry](schema/material-entry.schema.json). |
| `refinish(request, options?)` | [RefinishRequest](src/api-types.ts): key, optional finish and physical | Promise of [RefinishResult](src/api-types.ts), `{entry, variants}` after deriving response maps from stored basecolor. |
| `rebrand(request, options?)` | [RebrandRequest](schema/rebrand-request.schema.json): theme and businesses | Promise of [Branded[]](src/api-types.ts), `{key,variantId,from,lines}` for each written screen. |
| `pack(request, options?)` | [PackRequest](schema/pack-request.schema.json): key | Promise of [PackResult](src/api-types.ts), `{entry,variants}` with changed IDs, empty on an unchanged repeat. Separate maps and physical values remain intact. |

The root also exports request/result types, `MaterialsError`, its code union, `ComfyClient` and `ComfyRuntime`. `resolve` and `list` are synchronous; writing operations return promises. Identical database contents give identical reads. Local generation is deterministic for the same request and inputs; backend generation depends on the supplied runtime.

[CLI contract](src/cli/CONTRACT.md): `pbrforge <verb>` returns one JSON envelope and exits. [From-image contract](src/from-image/CONTRACT.md): `pbrforge from-image request.json` imports one opaque JPEG or PNG through its separate [request schema](src/from-image/request.schema.json). [Preview contract](src/ui/CONTRACT.md): read-only catalog and PBR viewer.

## Creation

Defaults and a worked request are in [SKILL.md](SKILL.md). `key`, `alignment` and `description` are required. Tile needs `tiling.worldSize`; exact needs `aspect`. Resolution must match that ratio within one pixel: tile at most 1048576 pixels; exact at most 4096 per side and 9437184 pixels total. The plate lane caps each side at 1024. Seed defaults to a hash of description.

| Source | Behavior |
| --- | --- |
| Photographic description | ComfyUI generates albedo; local code derives response maps. |
| `pattern` | Code generates maps from a [published pattern kind](schema/pattern-kinds.json). Optional [localized damp response](schema/surface-response.schema.json) applies to opaque dielectric tiled mineral finishes. |
| `flatColor`, `flatNoise` | Local near-uniform finish. |
| `recolor` | Append a tint of `recolor.from`, sharing its relief maps. |
| `sourceAlbedo.path` | Opaque continuous tile, matching aspect, whole-image downsample only, dry response, seam gate, no emission. |
| `sourceImage.path` | Exact baked plate, center-cover fit, transparent pixels flattened over black, flat response maps and identical basecolor/emission. |
| `emission: "image"`, `flatColor`, `screens[]` | Artwork in emission over dark display glass. Source artwork covers the output locally or uses ComfyUI 4x upscale when undersized. Brand names are composited separately. |

Source paths are absolute or relative to the package folder; they are not catalog map references. For sourceAlbedo and from-image, metallic is 0 or 1, roughness and finish bands are at least 0.45, transmission/emission are zero and alpha is opaque. General create physical settings follow its schema. Finish defaults to roughness factor ±0.05 clamped to 0..1, grain 0.2 and relief 2. Derivation estimates relief from brightness; it does not measure the source's physical surface.

Append inherits alignment, scale, aliases, physical and stored finish. `variantId` names one variant; `canonical: true` puts an appended variant first. Existing keys or variant IDs require explicit overwrite where supported. Pattern/recolor requests make one variant; screens set their count. Tiled create checks albedo seams before writing that variant. Exact creation and from-image have no seam gate. Writes are sequential; see [pending guarantees](docs/ISSUES.md) for failure atomicity.

Refinish merges physical changes, resolves the requested finish, and updates variants with their own relief files, excluding patterns, plates, screens and shared-relief recolors. Rebrand accepts hotel, commerce, mall, restaurant, coffee_shop, corpo and clinic businesses; an empty list writes nothing. It creates `brand:<slug>` variants on landscape and portrait screens, sharing the base surface maps. Same business input and source art produce the same branding. Use a world-owned theme copy for world names.

## Output and binding rules

[ThemeIndex](schema/theme-index.schema.json) is `{theme,entries}` in `<themesDir>/<theme>/theme.json`. [MaterialEntry](schema/material-entry.schema.json) contains key/aliases, alignment, physical values, scale or aspect, optional finish/decal, and named variants with resolution and relative map paths. Variant 0 is canonical; a consumer may select another declared ID. `kind` is open vocabulary; bundled Urbe tiers are poor, mid, rich and high_rich. Catalog dimensions, keys and named variants are published in [themes/cyberpunk/theme.json](themes/cyberpunk/theme.json).

Each variant keeps `maps` as map names to PNG path strings and publishes compressed paths in the sibling `ktx2` object, only for files present on disk. Paths are relative to the theme. PNG is the master. Consumers prefer `ktx2` when present and fall back to PNG when the compressed output is absent or unsupported. Run compression after authoring to refresh build outputs.

- Every variant requires basecolor, normal, roughness and metallic. Height, AO, emission, opacity and packed metallic-roughness are optional in the schema. Map dimensions and alignment agree within a variant. Shared map references are valid.
- Basecolor and emission are sRGB; data maps are linear. Normals use OpenGL +Y. Roughness and metallic are absolute values, bound with scalar factors 1; physical factors supply fallbacks when maps are omitted.
- Packed metallic-roughness is linear RGB: R=255, G=roughness, B=metallic. It uses the same UVs and resolution as the separate maps, with factors 1.
- `tiling.worldSize` is metres per repeat, one UV unit per tile. `aspect` is an exact-face ratio. Preserve scale and proportion. Geometry owns UVs, whole modules, borders, cuts and placement. `layout` publishes module size, joint width, origin and orientation in metres.
- Decals clamp UV 0..1 to one fitted receiving face using declared world size, edge inset and normal offset. Clip to that face, keep depth testing and apply opacity once. Glass, reflection environments, animated water, collision and breakability behavior belong to the renderer/runtime.
- `class` records provenance; `screen.artwork` is retained brandless source art for rebrand, not a rendered texture channel.

## Compression

`npm run compress -- [--workers N] [--max-temp C] [--force]` uses the [compression contract](src/compress/CONTRACT.md). `.ktx2` files and `tools/` are ignored by git as build outputs. Workers default to `floor(availableParallelism() / 4)`, at least one, with a 90 C thermal ceiling.

1. Basecolor and emission use sRGB; every other channel is linear.
2. Normals retain RGB and OpenGL +Y, using UASTC quality 2 with RDO lambda 0.25.
3. Other channels use ETC1S compression level 2: basecolor and emission at quality 255 with endpoint and selector RDO disabled; data maps at quality 128.
4. Every texture has a full mipmap chain with box filtering, wrapping tiles and clamping exact faces.
5. UASTC uses Zstandard level 18; each encoder uses one CPU thread.

## Consumer bindings

| Data | Schema | Meaning |
| --- | --- | --- |
| [Exterior styles](bindings/exterior-styles.json) | [Schema](schema/exterior-styles.schema.json) | Version 1, nine palettes in three groups, complete role/variant bindings and facade divisions. |
| [Street styles](bindings/street-styles.json) | [Schema](schema/street-styles.schema.json) | Maintained, salvaged and industrial families, paving metadata and construction finishes. Optional construction road overrides independent road selection. |
| [Native street surfaces](bindings/street-native.json) | [Schema](schema/street-native.schema.json) | Version 1 source scan catalog and effect parameters, [sampling contract](sources/streets/scene-native/CONTRACT.md). Paths are relative to this package root; raw shader inputs are separate from MaterialEntry. |
| [Street markings](bindings/street-markings.json) | [Schema](schema/street-markings.schema.json) | White and dark-orange coatings; geometry owns marking silhouettes. |
| [Scenic rooms](bindings/window-room-surfaces.json) | [Schema](schema/window-room-surfaces.schema.json) | Five receiving faces and back-image pools for office, apartment and lobby. Preserve aspect when cropping scenic plates. |
| [Hydrology](bindings/atlas-hydrology.json) | [Schema](schema/atlas-hydrology-bindings.schema.json) | Explicit water.lagoon, water.river and water.sea-coast key/variant pairs. |

Resolve named bindings without guessing paths or substituting unrelated entries. Materials owns the published catalog and bindings; consumers own geometry and rendering. The catalog schema has no output-version or revision field; these remain [open decisions](docs/ISSUES.md).

District street recipes publish subtle hexagonal road/parking texture, clean glossy blue/red panels, coordinated curb/gutter colors and blue/yellow junction finishes. Native street bindings include their authored manifest, emissive parking edges and letter-atlas marquee faces. Hexagons use a 0.15 m lattice; geometry owns full-size panel boundaries.

Exterior frame coatings are published as `cyberpunk/exterior-accent-blue/mid` and `cyberpunk/exterior-accent-gold/mid`, each with a `rich` alias and canonical `coat` variant. These opaque coatings use 1 m tiles, roughness 0.55 and subtle grain; [recipes](batch/cyberpunk/exterior-accents.json) retain the authored colors.

Fourteen accepted Exterior finishes retain their source `cyberpunk/exterior-<finish>/mid` keys, `native` variant, physical values and map bytes. Each also has an `exterior-<finish>-exact` counterpart with aspect `[1,1]`, sharing those maps. The [source manifest](sources/exterior-native/accepted.json) lists all 28 keys and 98 map hashes. Original entries retain their tile scale or exact alignment; the AC coil is exact in both entries.

## Paired facade

Paired facade materials use the `cyberpunk/paired-*` keys in [recipes](batch/cyberpunk/paired-facade.json). The lounge backplate is exact 2:1, with separate lit, dim and dark keys. Frame, cladding, ribs, room surfaces and light faces declare their metre scale in the recipes. Paired metal finishes use photographed graphite coating; formed blinds use periodic aluminum brushing. Lit, dim and dark room surfaces have separate emission levels. Paired upper glazing transmits 96 percent. Geometry owns all window frames, ceiling fixture positions and coverings.

Garden tower [recipes](batch/cyberpunk/garden-tower.json) publish pale concrete, two leaf finishes, stems, soil and opaque reflective black glazing. Panel joints, plant forms and balcony bodies belong to geometry.

[Facade family surfaces](sources/facade-families/INDEX.md) publish 1 m charcoal and ivory panel tiles, a cool-grey ivory variant, obsidian metal, exact 1:2 portrait artwork, and exact 1:1 portal limestone and polished steel. Fit exact finishes once per receiving face; geometry owns panel divisions.

## Letter atlas

`cyberpunk/letter-atlas/<tier>` has exact 4:3 sheets, 1024 x 768, `neon` and `panel` variants. The 8-column, 6-row grid is row-major. Charset: `ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-.,'!?:/&+` plus trailing space. For a supported uppercase character at index `i`, the UV rectangle is `[(i % 8)/8, floor(i/8)/6, 1/8, 1/6]`. Unknown characters use a blank cell in a sign consumer; rebrand rejects unsupported glyphs.

## Errors

Controlled library failures use `MaterialsError {code,message,details?}` with this closed code set:

| Code | Meaning |
| --- | --- |
| `E_SCHEMA` | Invalid request, source, map, key syntax or theme JSON. |
| `E_KEY_NOT_FOUND` | Missing key, alias or required screen/letter variant. |
| `E_KEY_EXISTS` | Duplicate key or variant requiring explicit overwrite. |
| `E_THEME_NOT_FOUND` | Missing theme.json. |
| `E_COMFY_UNAVAILABLE` | Backend unreachable or not ready. |
| `E_GENERATION_FAILED` | Rejected/timed-out render or incompatible screen dimensions. |
| `E_SEAM_CHECK_FAILED` | Tiled create albedo fails its seam check. |

Unexpected filesystem, image-decoder or caller-backend exceptions can propagate from the library; CLI wraps these as `E_INTERNAL` and adds `E_USAGE`. Preview loading has `E_DATABASE_UNAVAILABLE`. Boundary normalization and write preflight are recorded in [issues](docs/ISSUES.md).

## Dependencies

Node.js, Ajv and Sharp; optional ComfyUI for generation. Preview uses Three.js and browser APIs. No runtime dependency on another Urbe box. Binding data coordinates with [Atlas hydrology](../atlas/src/hydro/CONTRACT.md) and [Atlas street construction](../atlas/src/streets/construction/CONTRACT.md).
