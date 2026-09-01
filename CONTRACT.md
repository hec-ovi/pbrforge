# CONTRACT: materials

Purpose: generates and stores themed PBR material sets (maps, tiling config, physical properties) that the geometry layers select programmatically by schema.

Status: draft, schema pending research.

## In (must cover)
- material request: kind, theme, quality tier, physical hints (transparency, reflectivity, breakable)

## Out (must cover)
- material set on disk: themes/[name]/assets plus JSON entry: map files, tiling configuration, physical properties, alignment mode (tile or exact placement)
- database index queryable by kind, theme and tier
- index primary key: the string `theme/kind/tier`, all lowercase slugs (e.g. `cyberpunk/window-glass/rich`). Consumers (exterior, interior) name GLB materials with exactly this key; the index resolves it to maps, tiling config and alignment mode.
- tier slugs are atlas's, passed verbatim by consumers: `poor`, `mid`, `rich`, `high_rich`.
- kind is an open vocabulary; aliasing is allowed (several keys may resolve to one asset set). Guaranteed minimum coverage for theme `cyberpunk`, every kind resolvable at all four tiers: wall, wall-trim, column, window-glass, window-frame, curtain, door, door-glass, balcony-slab, balcony-rail, roof, floor-slab, parapet, signage, ad-screen, light-fixture, fire-escape, aperture-frame, roof-artifact.

## Errors
Closed set, to be defined.

## Depends on
None.
