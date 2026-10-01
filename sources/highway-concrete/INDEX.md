# Highway concrete sources

Three 2 m × 2 m concrete finishes provide distinct casting, underside and pier response: `cyberpunk/highway-concrete/mid#formed`, `#soffit`, and `#pier`. Formed concrete is intended for the deck web and barriers; soffit concrete for downward underside faces; pier concrete for shafts and caps. Colour maps are sRGB; response maps are linear and tangent normals use +Y. Complete 1024² PBR masters are resolved in [catalog.json](catalog.json).

[Provenance](source-provenance.json) records two independent generated photographic sources and one reused cast-concrete source, preserved at their native 1254² size. [Exact prompts](prompts.json) and the [original pier prompt](pier-original-prompt.txt) remain with the sources. These are synthetic photographic assets, not scans. `node scripts/author-highway-concrete.mjs` reconstructs the isolated candidate database under `out/highway-authoring/themes` through the public native import. Publish the prepared requests through `pbrforge create --native --themes <target>/themes`; append variants without overwriting unrelated entries.

The maps contain shallow pore/casting relief. Dirt and broad pigment variation do not become deep displacement. Structural dirt needs [placement masks](placement-mask-spec.json) tied to real support bottoms, joint stations and face orientation; it must not become a repeating black band in the image. The mask document is an engine integration specification, not an implemented shader.

These additive candidates require actual highway rendering and reference review. Valid PBR maps do not establish visual acceptance. The road, bearing steel and joint materials remain separately assigned in the highway binding.
