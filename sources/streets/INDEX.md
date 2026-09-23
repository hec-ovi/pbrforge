# Street albedo sources

Opaque sRGB color sources. Family tiles are 1 x 1 m at 1254 px and import at 1024 px through the public seam gate. PBR response and family tone are authored in [street image recipes](../../batch/cyberpunk/street-image-finishes.json).

- [Asphalt](asphalt-v2.png): fine charcoal aggregate.
- [Precast](precast-v1.png): smooth neutral cement.
- [Graphite](graphite-v1.png): continuous dense dark mineral finish.
- [Orange](orange-v3.png): fine dark copper-orange coating.
- [Ordinary slab](ordinary-slab.png): one grey concrete sidewalk panel with dark grout, 1254 px.
- [Curb paint](curb-paint.png): worn red curb coating over exposed aggregate, 1774 x 887.

These sources support candidate finishes. Fitted-city visual acceptance is separate from import validation.

[Native district surfaces](scene-native/CONTRACT.md): source scans, authored district maps and their separate effect binding.

## Marquee run

Grok image generation supplies two 1 x 1 m albedo fields. Each retained PNG is the generated field made wrap-continuous by two half-offset, variance-preserving cross-fades over a 14% edge band; it passes the public seam gate. [District street recipes](../../batch/cyberpunk/district-streets.json) import them through `sourceAlbedo` and derive dry nonmetallic maps; the frame's canonical `amber` variant is a recolor sharing the source relief.

| Cyberpunk key | Variant | Source | Prompt | Binding surface |
| --- | --- | --- | --- | --- |
| marquee-channel/rich | grimy | [PNG](marquee/channel.png) | [Prompt](marquee/channel.md) | `marquee-channel` |
| marquee-frame/rich | amber (from source) | [PNG](marquee/frame.png) | [Prompt](marquee/frame.md) | `marquee-frame` |

`marquee-lip` reuses the barrier concrete scan and `marquee-cap` the accepted `exterior-graphite-concrete/mid#native` maps, each tinted in the [binding](../../bindings/street-native.json). `marquee-led` draws its dot lattice from parameters and letters from the `letter-atlas/rich#panel` emission sheet.
