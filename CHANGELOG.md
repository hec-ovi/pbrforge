# Changelog

0.5: procedural pattern class. Variants drawn from parameters (hexagon grid, inset panel grid, large slabs, stripe, two-tone blocking, noise in up to four octaves, glyph atlas), rendered in code, anti-aliased and periodic over one tile by construction, resolving under the same keys and the same entry shape as the photographed ones. Cyberpunk library per tier: plaster hexagon, panel and wainscot walls, large floor slabs on tile, concrete panel joints one panel to a tile, new kinds ceiling, sidewalk, road and letter-atlas (a lit sheet of glyph cells for the modular sign system, grid and charset published in the contract), and light-fixture as a luminaire with a dark housing and a lit diffuser. wall and concrete carry tint variants of their photographed surfaces so adjacent buildings read apart. Create requests gain `append`, `variantId` and `recolor`. 112 entries, 264 variants.

0.4.1: ad-screen reads as a display. Screen lane (`emission: "image"`): dark glass basecolor with the faint lattice of its own pixels, flat relief, the ad in the emission map at high emissive strength. Three kinds per tier (led-dot, scanline-billboard, glyph-panel), artwork generated brandless and the business name stroked in from a built-in alphabet, driven by `brandName` and `businessKind`. Exact-alignment entries render on a non-tiling template.

0.4: full cyberpunk coverage, all 29 kinds at four tiers (96 entries plus 20 alias keys); emissive kinds via color-mask (ad-screen) and flat glow path (signage, light-fixture); five kinds alias to shared surfaces.

0.3: cyberpunk coverage at 68 keys: 7 exterior priority kinds and all 10 interior kinds at four tiers, 2 variants each. RealVisXL checkpoint, flat synthesis path for glass, seam gate on worst-interior-column ratio, batch create with per-kind request files.
0.2: generator (SDXL circular-padding via ComfyUI, procedural map derivation, seam gate), database with resolve/list/create CLI, sphere preview; first cyberpunk set generated and verified.
0.1: research done (docs/RESEARCH.md), contract v0.1 with material entry, theme index and create request schemas.
0.0: scaffold, contract pending.
