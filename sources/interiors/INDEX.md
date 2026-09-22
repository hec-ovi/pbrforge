# Interior material sources

Retained Imagegen albedo photographs feed pbrforge `from-image`. Primary panel fields cover 2 x 2 m. Interior geometry owns panel boundaries, nine-piece corners and ornamental hardware.

The reference-led manufactured set is authored through local `create` recipes in [interior-manufactured.json](../../batch/cyberpunk/interior-manufactured.json). Broad corporate fields use charcoal satin composite and brushed alloy with separate dielectric/conducting responses. Rich/mid/poor tiers carry distinct finish and wear, with a subdued service-alloy alias for exterior hardware. Original bounded holograms use the restrained translucent `lattice` finish.

The poor-room GPU review prompted sparse composite abrasion instead of dense
plaster-like mottling: broad wall housings keep their original color and most of
their coating, while exposed service alloy retains stronger local oxidation.
Texture dimensions, metre scale and geometry-owned panel edges are unchanged.

| Style | Wall | Floor | Ceiling |
| --- | --- | --- | --- |
| Luxury | [limestone](prompts/luxury-wall.md) | [honed charcoal marble](prompts/luxury-floor.md) | [pearl coating](prompts/luxury-ceiling.md) |
| Damaged station | [worn composite](../../batch/cyberpunk/interiors/damaged-wall.json) | [aged aggregate](prompts/damaged-floor.md) | [graphite technical coating](../../batch/cyberpunk/interiors/damaged-ceiling.json) |
| Capsule | [worn composite](prompts/capsule-wall.md) | [graphite rubber](prompts/capsule-floor.md) | [brushed alloy](prompts/capsule-ceiling.md) |

The adjacent PNGs are retained original generated sources. [Interior recipes](../../batch/cyberpunk/interiors/) mix photographic imports and explicit procedural `create` recipes (timber, damaged wall/ceiling/steel). Stone veins do not become deep ridges. Unique damage uses fitted exact faces.

Additional faces: [walnut](../../batch/cyberpunk/interiors/luxury-timber.json) is a continuous 2 x 2 m procedural veneer field. Its former albedo-derived response collapsed to one roughness value (130/255); the replacement separates varnish roughness from shallow directional pores and has exactly periodic grain. Resolution remains 1024² (512 texels/metre). Wood is reserved for localized inserts and furniture, with grain aligned to construction. [Capsule hatch](prompts/capsule-hatch.md) and [repair patch](prompts/damaged-patch.md) are exact square faces placed individually.

[Loft brick](prompts/loft-brick.md) and [worn alloy](../../batch/cyberpunk/interiors/damaged-steel.json) cover 1 x 1 m. Worn alloy keeps a conducting surface except at localized oxide, with independent roughness and shallow scuff normals. [Ornament recipes](../../batch/cyberpunk/interior-ornaments.json) provide matte leaves, paper, bronze, fish and warm/cyan emissive lenses.

[Display glazing](../../batch/cyberpunk/interior-display-glass.json) uses clear transmission and a flat optical surface for aquariums and hologram cases.
