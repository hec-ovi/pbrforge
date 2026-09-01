# CONTRACT: materials

Purpose: generates and stores themed PBR material sets (maps, tiling config, physical properties) that the geometry layers select programmatically by schema.

Status: draft, schema pending research.

## In (must cover)
- material request: kind, theme, quality tier, physical hints (transparency, reflectivity, breakable)

## Out (must cover)
- material set on disk: themes/[name]/assets plus JSON entry: map files, tiling configuration, physical properties, alignment mode (tile or exact placement)
- database index queryable by kind, theme and tier

## Errors
Closed set, to be defined.

## Depends on
None.
