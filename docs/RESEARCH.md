# Research conclusions: PBR generation (2026-09)

Full sourced findings live in the local research store. This file records the decisions used by the box.

## Pipeline

1. ComfyUI and RealVisXL V5 paint photographic basecolor. Tile workflows use circular padding; exact workflows paint one fitted face.
2. Flat fields, structural patterns, recolors, map derivation, screen treatment and text composition run locally and deterministically.
3. Photographic relief uses two wrapped luminance scales. The fine scale preserves joints and aggregate; the broad scale removes photographed lighting. The authored finish controls grain, relief and the roughness band.
4. Height produces OpenGL normals and AO. Metallic is a constant physical factor. Emission comes from luminance, a color mask or screen artwork.
5. Tile sets pass the wrap seam gate before writing. Exact sets match their physical aspect within one pixel and use clamp wrapping.
6. Tile maps stay within 1,048,576 pixels. Exact sheets stay within 4096 px per side and 9,437,184 pixels total.

## Generation findings

- Prompts describe a material field at physical scale. Object geometry belongs to exact faces or procedural patterns.
- Near-uniform surfaces use seeded flat synthesis. Regular divisions use metre-based pattern parameters with whole repeat counts.
- The seam score compares wrap-edge difference with the strongest interior row or column. This admits an intentional edge-aligned joint while rejecting a discontinuity.
- Screen artwork is flat, frontal, brandless and free of display structure. The screen lane adds its lattice or scan bands, color fringing, hotspots and wordmark.
- Landscape and portrait screens use separately fitted source artwork. Provided sources large enough for the target are fitted locally; smaller sources use the deterministic 4x upscaler.

## Photograph maps

- The feature blur radius is about width / 384 and the broad shading radius is about width / 64.
- Roughness varies only inside the authored finish band and follows blurred relief. Pixel noise does not become gloss.
- Noise detail stays above roughly eight pixels of the map. Road aggregate therefore remains stable under moving light.
- Recolor takes the requested hue and controls pigment with `strength`; relief maps stay shared with the source variant.

## Procedural surfaces

- Structural patterns calculate distance to the nearest joint and a stable value per cell in world metres.
- Whole cell counts make tiled patterns periodic. Joint and bevel widths are measured against `tiling.worldSize`.
- Exact incident patterns publish a fitted receiver size, transparent inset, clamp mode and surface offset.
- Water combines whole-cycle waves on both axes, which keeps every generated map periodic.

## Runtime

- ComfyUI receives API-format workflows through `/prompt`, exposes progress through `/history`, and returns images through `/view`.
- `comfy/setup.sh` installs the seamless-tiling nodes and 4x upscaler used by the templates. The RealVisXL checkpoint named in the templates belongs in the configured ComfyUI model store.
- Basecolor and emission are sRGB. Normal, roughness, metallic, height, AO and opacity are linear.
