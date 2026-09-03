# CONTRACT: materials preview

Purpose: presents the material database as a searchable list, a PBR sphere and a read-only property inspector.

## In

- `new PreviewView(viewer?: SphereViewer)` builds the workspace. `viewer` supplies the WebGL canvas and render controls.
- `MaterialList.load(fetcher = fetch)` reads `GET /api/themes` as `string[]`, then `GET /themes/<theme>/theme.json` as [ThemeIndex](../../schema/theme-index.schema.json).
- `SphereViewer.load(theme, entry, variantIndex = 0, repeat = 2)` renders a [MaterialEntry](../../schema/material-entry.schema.json). `variantIndex` selects one variant; `repeat` controls tiled maps.
- Search text and theme, kind and tier filters select the visible material rows. Toolbar inputs select variant, repeat, lighting, background, spin and wireframe.

## Out and events

- `PreviewView.root`, `MaterialList.root` and `MaterialInspector.root` are DOM roots for their components. `SphereViewer.canvas` is the rendered canvas.
- `MaterialList(onSelect)` calls `onSelect({ theme, entry })` when a material row is chosen.
- A selection loads the sphere and inspector, exposes the material key and texture paths, and updates stage telemetry.
- Copy actions write the selected key to the browser clipboard. Toasts announce selections and control actions.

## Errors

- `E_DATABASE_UNAVAILABLE`: `MaterialList.load` could not fetch, decode or recognize the theme list or a theme index. It rejects with `PreviewError { code, message, details? }`. The application renders a persistent error toast.

Empty databases and filters with no matches are rendered states.

## Invariants

- The preview is read-only. It never creates, refinishes, rebrands or writes a material.
- Tile entries use repeat wrapping. Exact entries use clamp wrapping and one fitted UV face.
- Basecolor and emission use sRGB. Normal, roughness, metallic, AO, opacity and height use linear sampling.
- A selected variant drives the sphere, inspector, key display and telemetry together.
- Controls use square corners.

## Components

- `PreviewView`: workspace layout and control wiring.
- `MaterialList`: database loading, filters and selection events.
- `SphereViewer`: Three.js sphere, texture channels, camera and lighting.
- `MaterialInspector`: key, alignment, physical values, finish and channel paths.
- `ToastManager`: status and error notifications.

## Depends on

- [Materials contract](../../CONTRACT.md), [ThemeIndex schema](../../schema/theme-index.schema.json) and [MaterialEntry schema](../../schema/material-entry.schema.json).
- Browser DOM, Fetch, Clipboard and WebGL APIs; Three.js for rendering.
