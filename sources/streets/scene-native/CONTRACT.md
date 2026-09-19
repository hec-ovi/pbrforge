# Native street surfaces

Version: 0.17.4.

Supplies the original district scans and renderer-neutral shading parameters from threejsscene. Input: surface identity and authored geometry attributes. Output: texture references and effect parameters in [binding](../../../bindings/street-native.json), validated by [schema](../../../schema/street-native.schema.json). Depends on no renderer. [Manifest](manifest.json) records source file SHA-256 hashes and revision.

The binding's optional `authored` manifest records district surfaces from [recipes](../../../batch/cyberpunk/district-streets.json). Their canonical PBR maps and the published letter atlas retain separate provenance in [district manifest](../district/manifest.json). Texture paths stay inside the theme asset tree.

Paths are relative to the Materials package root, including `themes/`. A caller hosting or copying assets supplies that root URL. A host exposing the existing themes tree validates and removes the `themes/` prefix before joining its public Materials URL; it does not serve the package root or provenance directory. Texture IDs resolve only through this binding. Files retain original bytes, dimensions and alpha. These raw shader inputs have their own catalog; standard MaterialEntry roughness/metalness rules do not apply. Missing IDs, unknown versions/effects and malformed parameters must fail before rendering. All coordinates are metres, Y up. Consumers own geometry, wear selection, collision, texture lifetime and effect implementation.

## Sampling and attributes

Use sRGB decoding for textures marked `srgb` and hex colors before arithmetic. Linear textures bypass color conversion. Read explicit `.r` or `.g` channels below after this conversion; alpha stays linear. Normal scans are tangent-space OpenGL +Y. Default mesh metalness is zero. Default opacity is one. Texture wraps are per-axis; use trilinear mipmaps, linear magnification and anisotropy capped at 16 and the device limit. PNG row orientation follows the original Three.js TextureLoader (`flipY = true`); other upload paths must reproduce it.

Geometry publishes world position `P`, road-relative local height `H`, UV and interpolated `wear` in [0,1]. Road, parking and paint use the same continuous world-space wear field. A consumer must carry it across piece splits. Do not independently seed per mesh or triangle.

- `world-xz`: `P.xz / scale`, independent of mesh origin. Asphalt scale is 2 m.
- `panel`: one full scan in 0..1 for every fitted slab or decal. U follows the slab row; V runs across it. Retain rectangular scans and the producer's orientation; no world tiling or scale inferred from panel pitch. Parking V=0 is the road entrance, V=1 the back of the 3 by 2.5 m panel.
- `curb-band`: producer maps distance along each face over 2 m and across/height over 0.2 m; edge-ring tops normalize their band depth to one scan. Wider bands stretch across their width. UVs are already normalized; do not divide twice. Source wraps clamp both axes.
- `metres`: producer publishes physical UVs, consumer divides by `scale`. Hardware is 1 m; perforated steel is 0.25 m. Barrier height `H` remains relative to the road even after instancing.
- `paint`: producer publishes mask UVs. Strips use along-distance / 2.7 + seeded phase (0..17); cross-width V is 0.155 + fraction * 0.69. Bars exchange along/across, with phase `station * 0.17`. Other marking silhouettes supply fitted equivalent UVs. Mask U repeats, V clamps.

## Shared asphalt sample

`N` is MaterialX 3D Perlin noise, the source `mx_noise_float`, with its default amplitude 1 and pivot 0. Do not replace it with random texture offsets per tile. Using `sampling.asphalt` parameters:

```
q = P.xz / scale
r = N(P * regionScale) * regionGain + regionBias
i = floor(r)
a = sin(offsetFrequency * i) * offsetGain
b = sin(offsetFrequency * (i + 1)) * offsetGain
t = smoothstep(blendRange[0], blendRange[1], fract(r))
S(map) = mix(sample(map, q+a), sample(map, q+b), t)
```

Both samples use gradients of unshifted `q`. All road channels share offsets and blending. `mix(a,b,t)` is linear interpolation; normalScale applies to tangent-space normal-map X/Y after decoding.

## Effect equations

Parameter names below come directly from each surface's `parameters`. `T(slot)` samples its map at the surface UV. `W` is interpolated wear, `C` means resulting linear base color, `R` roughness, `M` metalness, `A` AO, `CC` clearcoat roughness. A range parameter supplies the lower and upper clamp or smoothstep bounds. Unmentioned factors are one; normals use the named normal map and `normalScale`.

| Effect | Response |
| --- | --- |
| `asphalt` | `C=mix(S(cleanBasecolor),S(basecolor),W).rgb*colorGain`; normal map is the same clean/worn mix. `R=clamp(S(roughness).r + requestedRoadRoughness - roughnessDefault, roughnessRange)`; requested value defaults to roughnessDefault. `A=mix(1,S(ao).r,W*aoWear)`. |
| `photographed` | `C=T(basecolor).rgb*tint`; `R=clamp(T(roughness).r*roughnessGain+roughnessBias,roughnessRange)`; `A=mix(1,T(ao).r,aoIntensity)`; `M=metalness`. |
| `polished` | `C=T(basecolor).rgb*tint`; `s=T(smear).g`; `v=sample(variation,P.xz/variationScale).r`; `R=clamp(s*smearGain+v*variationGain,roughnessRange)`; `CC=clamp((s+coatBias)*coatGain,coatRange)`. No AO map contribution. `M=metalness`. |
| `mineral` | `C=T(basecolor).rgb`; if painted, mix C with `tint*(T(basecolor).r+paintBias)` using `smoothstep(paintRange,T(basecolor).r)`. `R=clamp(T(roughness).r*roughnessGain+roughnessBias,roughnessRange)`; `A=mix(1,T(ao).r,aoIntensity)`; when clearcoat=1, `CC=clamp(T(smear).g*coatGain,coatRange)`. |
| `metal-panel` | `C=T(basecolor).rgb`; `R=clamp(T(roughness).r*roughnessGain,roughnessRange)`; `M=metalness`, or if painted `mix(metalness,paintMetalness,smoothstep(paintRange,T(basecolor).r))`; `A=mix(1,T(ao).r,aoIntensity)`; when clearcoat=1, `CC=clamp(T(smear).g*coatGain,coatRange)`. |
| `hardware` | `b=T(basecolor)`; `C=b.rgb*colorGain`, `M=1`; if painted, `p=smoothstep(paintRange,b.g)`, `C=mix(C,tint*(b.r*paintGain+paintBias),p)`, `M=mix(1,0,p)`; `R=T(roughness).r`; `A=T(ao).r`. |
| `cast-concrete` | `b=T(basecolor)`; `c=mix(b.rgb,vec3(b.g),greyMix)*colorGain`; `k=sample(roughness,UV*breakupScale).r`; `g=1-smoothstep(grimeRange,H+(k+grimeBias)*grimeHeight)`; `C=mix(c,c*grimeTint,g*grimeStrength)`; `R=T(roughness).r*roughnessGain+roughnessBias`; `A=mix(1,T(ao).r,aoIntensity)`. |
| `parking` | `b=T(parkingBasecolor)`; `e=smoothstep(entranceRange,UV.y+(b.r+entranceBias)*entranceNoise)`; `road=mix(S(cleanBasecolor),S(basecolor),W).rgb*asphaltColorGain`; `C=mix(road,b.rgb*panelColorGain,e)`; normals mix `S(normal)` and `T(parkingNormal)` by e; `R=mix(S(roughness).r,T(parkingRoughness).r,e)`; `A=T(parkingAo).r`. |
| `road-paint` | `o=N(P*noiseScale)*noiseGain`; `p=sample(mask,vec2(UV.x*maskUScale+o,UV.y)).r`; `g=S(grain).r`; `C=tint*(g*grainGain+grainBias)`; alpha=`p*mix(opacity,smoothstep(erosionRange,g),W*wearStrength)`; `R=roughness`; normals use `S(normal)`. Blend with depth testing and `depthWrite=false`. |
| `decal` | `C=T(basecolor).rgb`; alpha=`T(basecolor).a*opacity`; `R=roughness`. Blend once, depth test, no depth write. Enable polygon offset with the declared factor and default units 0. Geometry owns fitted placement and surface offset. |
| `solid` | `C=tint`; `R=roughness`; `M=metalness`. |
| `display` | `C=T(basecolor).rgb*tint`; emission=`C*brightness`; `R=roughness`; `M=0`. |

Solid surfaces optionally emit `tint*emissionIntensity`, default zero. Authored photographed surfaces may use `world-xz` or metre UVs at their published repeat scale. District hexagons have 0.15 m lattice spacing, restrained joints and shallow relief; clean panel maps contain no authored scratches. Geometry defines slab seams and fitted marquee glyph UVs.

`clearcoat`, where declared, is the physical coat weight. Uncoated clearcoat is zero. Coated defaults follow a dielectric IOR of 1.5. Photographed curb and gutter share maps but retain separate normal strength and gutter tint. The binding contains no LED screens or graffiti. Material selection and row composition belong to the street builder.
