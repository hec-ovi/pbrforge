# Street variation sources

Eight separate slab sources generated with the built-in image generation tool: [clean](clean.png), [stained](stained.png), [cracked](cracked.png), [patched](patched.png), and [clean B](clean-b.png), [stained B](stained-b.png), [cracked B](cracked-b.png), [patched B](patched-b.png). [Exact prompts](prompts.json) and [resolved outputs](catalog.json).

Each source describes a 2 m square precast pedestrian slab under diffuse, even illumination. Sources are synthetic photographic imagery, not scans. They contain distinct wear/maintenance features; they are not recolours of one image. Whole-image reduction preserves the composition at 1024². A common joint/anchor apron is retained from the published slab, and independent roughness and shallow physical-height response are authored for each condition. Basecolour is sRGB; response maps are linear, normals +Y.

Resolved family: `cyberpunk/street-sidewalk/mid`, variants `slab-clean-1`, `slab-stained-1`, `slab-cracked-1`, `slab-patched-1`, and their `-2` counterparts. Red-coated slab sources and output inventory are under [red](red/catalog.json). Their complete PBR masters are published in the material catalog. The [companion binding contract](CONTRACT.md) provides per-panel selection without changing block sidewalk ownership or UVs.

The first batch is a candidate pending engine selection and in-game visual acceptance. Additional material families need their own appropriate variants.

The [asphalt condition family](asphalt/INDEX.md) provides four joint-free sources and an explicit native asphalt/parking integration proposal. It remains unbound until the consumer supports complete condition routing.
