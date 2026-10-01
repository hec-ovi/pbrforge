# Street surface variants

The optional [binding](../../bindings/street-variants.json) supplements `street-native.json`. It selects coordinated maps without changing street geometry or the chosen sidewalk kind. The paired native clay/hex scale correction is described below. [Schema](../../schema/street-variants.schema.json).

`surfaces[surfaceId]` names a set. A set carries its physical `worldSize`, a shared construction frame, a selection domain, and weighted variants. Each variant names a resolved Materials key/variant and a complete override for `basecolor`, `normal`, `roughness`, `ao`. `textures` uses the existing native texture descriptor: path, SHA256, dimensions, colour space, wrapping and optional KTX2/hash. Identical resources are shared by content hash and colour space, even when catalog paths differ.

The initial set covers eight concrete slab surface IDs with eight independently generated sources (two per condition): clean, stained, cracked and patched. Condition weights total 0.55, 0.28, 0.10 and 0.07, split equally among the two concrete takes. A separate red-coated set now has eight variants from seven generated sources and binds the two confirmed coated sidewalk IDs; oxblood remains a sidewalk accent, not a road-shoulder designation. The unused legacy `oxide` ID remains unchanged until its placement role is confirmed. This is an initial batch, not completion of every surface family. Metal service panels, other coatings, curbs and graphics retain their current bindings until their own appropriate variants are authored.

## Engine selection

- Keep the existing surface ID and its parameters/tint; override only the four map slots as one coherent bundle. No independently randomized colour, normal or roughness choices.
- `selection.unit: panel` means one identity for each physical slab, including both triangles and clipped remainder faces. Ordinary UVs reset to 0..1 on every slab, so hashing `floor(uv)` would repeat the same choice. Supply a stable panel identity from authored geometry or a stable reconstructed panel origin, combined with the placement identity. Do not use draw/instance array order.
- `placement` selects once per stable placement. `world-cell` selects from floor(worldMetres / worldSize), including negative coordinates. Those units are available for later families; the initial set is `panel`.
- Reproducible reference hash input is UTF-8 `JSON.stringify([salt, String(worldSeed), surfaceId, String(placementId), String(unitId)])`. FNV-1a 32-bit, offset 2166136261, prime 16777619; each byte XOR then unsigned `Math.imul`. Divide the unsigned result by 4294967296 and choose the first authored cumulative weight exceeding that value. Keep the same result across reloads, streaming and LOD.
- `uvTransform: identity`: retain authored UVs and orientation. Do not introduce rotations, mirrored tangent normals, offsets, scales or new gutter/line UV rules. The variants share the existing slab joint/anchor border.
- `fallback` is the declared clean variant, used when a selector is unavailable. This fallback alone does not satisfy repetition acceptance. The old binding remains valid without this companion; an absent surface/set retains its original material.
- Batch selected variants or use a texture array; do not allocate a material per tile or rebuild geometry every frame. Preserve existing wear/detail layers and local placement identity.

The binding fingerprints its base binding. A changed fingerprint requires a compatibility check and refreshed companion rather than silent mismatched material identity. Validate every texture hash and reuse matching resources. Compression paths are optional until their encoded files are available.

## Verification and remaining work

`node scripts/check-street-variants.mjs` validates schema, base identity, catalog references, dimensions, map hashes, shared resources and distinct albedo/roughness states. `scripts/author-street-variants.mjs` prepares and imports through the public CLI with an explicit worktree themes path. `scripts/bind-street-variants.mjs` builds the binding from the resolved catalog manifest.

The concrete import passes the native seam gate. PBR response is authored separately from pigment: broad stains are not converted to deep relief. Matching colour/map edges preserves the construction frame, while the interior wear differs.

Visual acceptance requires the actual engine selector: compare an extended slab run at walking and grazing views under the same light, including stable reload/LOD and clipping boundaries. Map validity is not that acceptance.

## Asphalt condition candidates

`sets.asphalt-conditions` contains six joint-free 2 m condition maps (one clean control, one crack, two stains and two repairs) with shared boundary samples. It is deliberately unbound in `surfaces`: the native asphalt and parking effects have extra clean/base slots and different channel mixing, so the photographed-surface override would be incorrect. [Integration proposal](asphalt/integration-proposal.json) specifies the full coherent condition routing and preserves world-XZ sampling, parking entrance blending and all lane/gutter UVs. It requires an engine consumer change before activation.

Weights are 0.80 clean, 0.15 stained, 0.03 cracked, 0.02 repaired, divided among the available takes in each condition. The world-cell domain is a proposed stable condition field, not authorization to cut geometry into 2 m panels. Preserve the native two-region sampling and its gradients; the consumer must decide how a coherent condition survives that crossfade. Do not infer that simple per-cell switching implements the existing sampling contract. Sparse repairs and cross-cell cracks may require placement content. Current clean/worn roughness and AO support is incomplete; never mix a clean colour with a stained response while claiming a full condition.

The red-coated set weights are 0.50 clean, 0.20 stained, 0.08 cracked, 0.06 patched and 0.16 weathered, split equally between available takes in each condition. The two weathered arrangements derive from one photographed source: only the wear arrangement turns, while the construction frame is reapplied unchanged. Alternate off-centre scuffs and an angular edge repair supplement the first source set. Pigment and sealed-paint roughness are preserved; exposed substrate is duller with shallow coating loss.

## Hex and clay tile families

`hex-grey` and `hex-orange` add eight histories each at their existing 1.2 × 1.385640646 m native world-XZ scale. The original four world-XZ hex routes keep their scale. Native `basalt` and `terracotta` now use the existing world-XZ sampler with catalog metre periods, after confirming that their producer emits horizontal paving polygons. `terracotta-court` supplies eight real clay running-bond histories at 1.2² m, replacing the incorrect orange-hex material route. No block palette assignment, geometry UV attribute, gutter or lane-line sampling is changed. See the [tile family inventory](../street-tile-families/INDEX.md). These sets use the same condition weights as concrete, divided across two takes. A world-cell is a repeat domain for a complete tile installation, not a new road geometry panel. Preserve native metric phase and coherent map selection.

Asphalt revision 2 replaces the first review set in the companion. It copies the unchanged clean background in every channel, applying only localized condition deltas; there is no cell-wide material transition followed by an edge blend. The first revision remains archived in `asphalt/catalog-v1.json`, because rendered review exposed rectangular response boundaries and repeated bright marks. The two new stain and angular repair arrangements are distinct, while the clean control is intentionally unchanged. Actual engine sampling still requires review.
