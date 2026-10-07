# Changelog

0.25.0: a street prints plate (`cyberpunk/street-prints/poor`, `bindings/street-prints.json`): the Grok kiosk fascias, posters, notices, ads, a newspaper, a pizza box lid, two art prints and a sticker sheet packed into one 2048² plate, each cell published in pixels, UV (v = 0 at the top) and metres, for piers, carts, shrines and litter. Poor walls' plain concrete (`cyberpunk/concrete-monolith/poor#native-cast`) is cast as 2.4 × 1.2 m formwork panels from the photographed cast concrete, with board imprint, recessed joints, tie holes (some plugged), rust and water stains, efflorescence and patch repairs, repeating every 2.4 m.

0.24.0: the poor apartment scene's sets, drawn in code from periodic noise so every tile wraps by construction: chipped teal paint, a stained ceiling, cracked cream floor tiles laid on the diagonal, grey grimy wall tiles over a gloss wainscot, mauve kitchen paint, oxblood vinyl, a striped flat-woven rug and a blue runner, black shelving steel, desk and pass-through laminates, terry, a sheer shower plastic and the enamels of the small things; emissive pod, monitor and fluorescent faces, newsprint, a pizza lid, can wraps and a payslip in exact lettering; and decals, Grok's graffiti keyed from black and its notices and posters worn on our side. The authoring script redraws a variant in place with `--replace`.

0.23.0: whole-bundle street variants (`bindings/street-variants.json`): eight concrete slab and eight red-coated slab conditions, each variant a coordinated basecolor, normal, roughness and AO bundle; the metric grey and orange hex and terracotta running-bond families and the asphalt conditions are published but left unbound (their joints, or their single clean take, do not yet hold up in the game), so basalt and terracotta keep their panel sampling. Distinct highway concrete finishes (formed, soffit, pier) with part bindings (`bindings/highway-materials.json`) and the placement-mask specification the engine wears them by. A graffiti atlas of four tag sheets keyed off black, for highway piers and poor walls. Lots, plazas and retained sidewalks lay each street family's photographed precast concrete instead of the drawn paving pattern. The unaccepted clay-tone revision stays out.

0.22.1: refine sealed street finishes with quieter mineral albedo, restrained oily wipe contrast, sparse wear and darker seams; filter fine wear at its physical scale on each axis, including narrow curbs. Preserve street identities and coordinated PBR maps, refresh PNG/KTX2 bindings, and add a preparation-only recipe mode for isolated visual review.

0.22.0: used urban surface remaster: 15 street variants, 11 poor and mid exterior variants and 18 interior hard-surface variants, with independent oily roughness, shallow coordinated relief, physical scales and native street bindings. Six seamless 2048² world-space masks and transparent 4×4 engine / 3×2 source decal atlases live under `surface-detail`. Prepared native imports validate every map; compression includes street and shared-detail bindings and publishes KTX2 hashes. Reproducible generated sources, catalog checks and a checksummed release manifest accompany the maps.

0.21.0: R1 office finishes (graphite and blue-grey veneer, walnut floor and ceiling, teal-navy leather, walnut burl) and poor-building finishes (C7 cream plates, C2 olive corridor paint and strapped pipe lagging, C4 terracotta tile and teal paint, C6 plum quilted padding, red and magenta neon lenses on `light-fixture/poor`). Grok sources, code-drawn grids and recipes reproduce the published maps, which publish their compressed siblings.

0.20.0: interior kind finishes for the E1 apartment (cream satin wall panels, gloss black ceiling, polished teal-grey stone floor, cool grey brushed housings, tan splash laminate, blue-cast stainless worktop, an exact diamond mesh grille, lit caustic island glass, a vending screen and the `e1-cyan` lens on `light-fixture/high_rich`), B3 brushed gold trim, R1 graphite portal stone, worn ivory capsule enamel on a new `interior-capsule-enamel/poor` entry and C4 stall laminate. Grok sources and recipes reproduce the published maps, which publish their compressed siblings.

0.19.0: capsule and service interior coatings, a hexagonal resilient floor, worn gunmetal, linen and fine satin alloy; Corpo Plaza, Meridian, Sandra Dorsett, Gutierrez and Loft 1702 apartment finishes with veneer, stone, leather, textiles, tatami, artwork, glass, mirrors and lens colors; Meridian shell variants on the wall and roof kinds; and Hiromi terrace fern leaflets and stems. Recipes and accepted sources reproduce the published maps; the new variants list no compressed siblings until compression runs.

0.18.1: every decal pattern writes its coverage into the basecolor alpha as well as the opacity map, so blood pools and tyre marks draw as their shapes; the two incident decals are regenerated and list no compressed siblings until compression runs again.

0.18.0: capped marquee runs bind a grimy painted channel, amber frame, pale concrete lip, dark slate cap and a dot-matrix LED face whose dots light the placement text.

0.17.5: luxury sidewalk panels, hex road, curbs and ordinary slabs carry visible joints, gloss and grit at the published scales.

0.17.4: facade variants carry metre scaled blades, head combs, corner fixings and panel joints with matching PBR maps.

0.17.3: district paving carries fine dark hex joints, panels and blue curbs carry varied gloss, and ivory facades carry shallow mineral relief.

0.17.2: the test suite keeps one case per contract promise through the public entry points.

0.17.1: variants publish sibling KTX2 paths beside PNG maps through CPU compression with a 90 C thermal ceiling.

0.16.37: authored district street finishes, subtle hexagons, clean glossy panels and emissive marquee/parking bindings.

0.16.37: modular facade panel finishes, obsidian metal, optical screen art, portal limestone and polished steel.

0.16.37: garden tower concrete, vegetation finishes and reflective black glazing.

0.16.37: paired graphite metal and brushed aluminum, clear upper glazing and cyan room surface states.

0.16.37: paired tower facade finishes, lounge backplate states and ceiling fixture surfaces.

0.16.37: fourteen accepted Exterior native finishes and exact counterparts share byte-identical source maps and canonical native variants.

0.16.35: blue and gold exterior frame coatings with rich aliases, subtle grain and packed response maps.

0.16.34: native street schema supports strict AJV consumers and conditional clearcoat map validation.

0.16.33: source street scans with verified provenance and a versioned renderer-neutral material binding.

0.16.32: isolated PBR catalog API and JSON CLI, native photographic finishes, consumer bindings, read-only preview, agent usage instructions and contract-surface tests.
