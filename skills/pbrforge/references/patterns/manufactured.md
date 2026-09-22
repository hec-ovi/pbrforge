# Continuous manufactured finishes

`brushed-metal` and `composite` author separate color, metric normal, height,
roughness and metallic maps. They contain no panel edges, fixings or invented
construction seams: fit those to the mesh's architectural grid.

Brush direction follows `axis` (`y` by default). Brush marks are 4 mm across and
22 cm along; the polymer's mould texture is 8 mm. Fine detail fades below the
pixel footprint. `depth` controls submillimetre surface relief, independent of
the image resolution. `grain` and `variation` control fine and broad albedo
contrast; `sheen` controls independent 5–6 cm finish variation. `wear` exposes
localized scuffs and oxide/dirt. Colors are the intact surface and wear color.
Composite coating damage is sparse, leaving broad intact housing faces; bare
alloy retains a more extensive oxide field. No tile edge is treated as a panel
edge. Geometry supplies the real panel borders and service detailing.

For metal use `physical.metallicFactor: 1`; the authored metallic map retains
bare metal and reduces conductivity only in local oxidation. Composite is a
dielectric throughout (`physical.metallicFactor: 0`). Roughness maps contain the
actual finish values. Do not multiply them by the descriptive physical factor.

The interior recipes use 512 pixels/metre: 512² over 1×1 m alloy and 1024² over
2×2 m composite. Broad panels retain this density as geometry changes size.
