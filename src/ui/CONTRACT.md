# CONTRACT: materials preview

Purpose: presents the material database as a searchable list, a PBR sphere and a read-only property inspector.

## In

- `new PreviewView(viewer?: SphereViewer)` builds the workspace from [preview-view-layout schema](../../schema/preview-view-layout.schema.json). `viewer` supplies the WebGL canvas and render controls.
- `MaterialList.load(fetcher = fetch)` reads `GET /api/themes` as `string[]`, then `GET /themes/<theme>/theme.json` as [ThemeIndex](../../schema/theme-index.schema.json).
- `SphereViewer.load(theme, entry, variantIndex = 0, repeat = 2)` renders a [MaterialEntry](../../schema/material-entry.schema.json). `variantIndex` selects one variant; `repeat` controls tiled maps.
- Search text filters the visible material rows. The list is a theme/kind/tier tree; headers start collapsed and expand with a height animation. Opening a header also opens every nested header under it. Each nest level has its own color; material rows zebra-stripe. Rows are flush left. Toolbar inputs select variant, repeat, lighting, background, spin and wireframe.

## Out and events

- `PreviewView.root`, `MaterialList.root` and `MaterialInspector.root` are DOM roots for their components. `SphereViewer.canvas` is the rendered canvas.
- `MaterialList(onSelect)` calls `onSelect({ theme, entry })` when a material row is chosen.
- A selection loads the sphere and inspector, exposes the material key and texture paths, and updates stage telemetry.
- Copy actions write the selected key to the browser clipboard.

## Errors

- `E_DATABASE_UNAVAILABLE`: `MaterialList.load` could not fetch, decode or recognize the theme list or a theme index. It rejects with `PreviewError { code, message, details? }`. The list shows the error in place.

Empty databases and filters with no matches are rendered states.

## Invariants

- The preview is read-only. It never creates, refinishes, rebrands or writes a material.
- Tile entries use repeat wrapping. Exact entries use clamp wrapping and one fitted UV face.
- Basecolor and emission use sRGB. Normal, roughness, metallic, AO, opacity and height use linear sampling.
- A selected variant drives the sphere, inspector, key display and telemetry together.
- Channel rows show a 32px thumbnail of each authored map. Clicking a channel opens that map full size with pan and zoom (wheel, drag, +/-/FIT, and +/-/0 keys). Escape or close dismisses it. Export downloads the entry JSON and that variant's PNG maps. It does not write the database.
- Sidebar and inspector widths are user-resizable via the split handles. Square corners, zero border-radius.
- View structure and inspector sections load from declarative schema definitions.

## Components

- `PreviewView`: workspace layout, split handles, and control wiring loaded from schema.
- `MaterialList`: database loading, filters and selection events.
- `SphereViewer`: Three.js sphere, texture channels, camera and lighting.
- `MaterialInspector`: key, alignment, physical values, finish, channel thumbnails, and a map export download.
- `MapViewer`: full-size map dialog with pan and zoom.
- `ui/elements`: primitive square units (inputs, buttons, badges, selectors).

## Depends on

- [Materials contract](../../CONTRACT.md), [ThemeIndex schema](../../schema/theme-index.schema.json), [MaterialEntry schema](../../schema/material-entry.schema.json), and [PreviewViewLayout schema](../../schema/preview-view-layout.schema.json).
- Browser DOM, Fetch, Clipboard and WebGL APIs; Three.js for rendering.
