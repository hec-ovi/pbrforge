# Asphalt condition sources

Four independently generated photographic sources are preserved at 1254² and reduced as whole images to 1024², covering 2 m × 2 m each. They are synthetic imagery, not scans. [Prompts](prompts.json), [provenance](source-provenance.json), and [resolved full PBR map inventory](catalog.json).

`cyberpunk/street-asphalt/mid#asphalt-clean-1`, `#asphalt-stained-1`, `#asphalt-cracked-1`, and `#asphalt-patched-1` use distinct albedo and roughness histories. Fine aggregate and shallow pores remain small. The localized fissure is at most 1.1 mm deep in the authored height field. The repair is flush; its colour/roughness boundary does not become a raised slab. Boundary samples share continuous asphalt texture without a panel rim.

`node scripts/author-asphalt-variants.mjs` reconstructs the isolated candidate database in `out/asphalt-authoring/themes` through public native import. The [integration proposal](integration-proposal.json) describes the extra clean/main slots of native asphalt and the different parking-channel behavior. The optional street companion exposes the set without activating it on those effects. Selection and sparse repair routing require engine work and actual render verification.

[Remaining coverage](remaining-coverage.json) lists other surface families still requiring content and reference acceptance. This batch does not complete the street overhaul.
