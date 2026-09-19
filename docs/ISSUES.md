# Materials issues

Open questions for the orchestrator. Current behavior stays until they decide.

| Decision | Reason | Affected boxes |
| --- | --- | --- |
| Catalog output version | ThemeIndex has no version field; shared conventions need versioned output. | Materials, Streets, Links, Exterior, Interior, Engine |
| Preview thumbnails: 16 or 32 px | Requested size and the 32 px inspector thumbs differ. | Materials preview |
| Template inheritance | Keys and theme folders exist; a formal inheritance API is unspecified. | Materials and authoring callers |
| Seam metadata per variant | Creation lanes have different seam guarantees. | Materials and geometry consumers |
| Catalog revision identity | Frozen catalog identity is unspecified. | Materials and all catalog consumers |
| Additional transport | Package and CLI exist; another transport is unspecified. | Materials and API callers |
| Creation timing | Author during GLB creation or choose existing entries from a frozen catalog. | Materials, Streets, Links, Exterior, Interior, Engine |
| UV ownership | Concrete UV placement versus scale/fitting metadata remains undecided. | Materials and geometry consumers |

## Cross-box proposals

These change public behavior; they need orchestrator agreement.

| What | Current gap | Affected boxes |
| --- | --- | --- |
| Preflight screen size for `create --native` before backend access. | CLI `assertNative` checks paths only; `SourceImage.load` uploads undersized art. Native create is supposed to stay backend-free. | Materials CLI and authoring callers |
| Validate all rebrand resources before writing. | Names are checked first; each business/screen then writes in sequence. A later missing screen or letter variant can leave earlier writes. | Materials, world-branding callers |
| Reject from-image duplicate keys before writing maps; publish multi-variant creates atomically. | FromImage writes map files before Database.write rejects an existing key. Generator writes each variant's files before later variants finish. An error does not guarantee an untouched database. | Materials and authoring callers |
| Normalize unexpected library filesystem/backend exceptions at the public boundary. | Root operations pass through writer/decoder/backend failures. The CLI wraps them as E_INTERNAL; the library does not always throw MaterialsError. | Materials package callers |

## Look pass 2026-09-18

Compared all six supplied game captures with the curated street, parking and building references. These are the five largest differences addressable through the existing material entries. Browser chrome and overlays are excluded. Reference numbers below follow Urbe’s reference indexes.

1. **Hex road and parking**, `cyberpunk/district-hex/rich`. Street references 01, 02 and 20, plus parking captures 161223 and 163032, show thin dark cells and shallow edges. The game at 20:59:56 loses the joints outside lamp highlights and shows broad bright facets. The hexagon recipe uses 2.6 mm joints with contrast 0.24, relief 0.008 and cell sheen 0.012. Slate blue albedo is slightly lighter, roughness centres on 0.38. The 0.15 m lattice remains fixed.
   Maps: `themes/cyberpunk/assets/district-hex/rich/subtle/{basecolor,normal,roughness,height,ao}.png` and [packed metallic roughness](../themes/cyberpunk/assets/metallic-roughness/c7a4d1ca37329a776ef03cc6c1e39809b6dea6adc9af64e58e19574c38ab88d6.png).

2. **Blue sidewalk panels**, `cyberpunk/district-panel-blue/rich`. Street references 11 and 12 and parking capture 163045 show restrained blue slate with irregular gloss. The game at 20:59:56 and 21:00:21 shows a continuous flat teal band. A wrapping noise recipe adds subtle slate mottling, shallow relief and gloss variation around 0.24. Albedo spans #30424a to #3a4d54. Geometry continues to supply panel joints.
   Maps: `themes/cyberpunk/assets/district-panel-blue/rich/clean/{basecolor,normal,roughness,height}.png` and [packed metallic roughness](../themes/cyberpunk/assets/metallic-roughness/13a2c5c1c1ec729089d20a457c9878e707476b8b02de22e22338262094417ecf.png).

3. **Dark sidewalk panels**, `cyberpunk/district-panel-dark/rich`. Street references 07 and 08 show dark coated panels with varied reflections and readable boundaries. The blue district panels in the game at 20:59:56 have uniform grey highlights and little surface variation. A wrapping noise recipe uses cooler dark slate and roughness centred on 0.21 with sheen variation 0.16. Relief stays shallow at 0.006. The finish carries broad gloss variation without extra panel divisions.
   Maps: `themes/cyberpunk/assets/district-panel-dark/rich/clean/{basecolor,normal,roughness,height}.png` and [packed metallic roughness](../themes/cyberpunk/assets/metallic-roughness/78676389efcfcf65866c0944b5c1222bddf1d80604f9406b699545b92c76e1ec.png).

4. **Blue curbs and gutters**, `cyberpunk/district-curb-blue/rich`. Street references 12 and 15 and parking captures 163032 and 163142 show blue painted curbs with tonal variation. The game at 20:59:56 shows a flat cyan strip. The coating spans #176b95 to #227fa3 with subtle mottling and gloss around 0.26. Existing gutter references share the maps. The recipe retains the one metre tile and the binding retains its curb sampling.
   Maps: `themes/cyberpunk/assets/district-curb-blue/rich/clean/{basecolor,normal,roughness,height}.png` and [packed metallic roughness](../themes/cyberpunk/assets/metallic-roughness/642acb604ab4af3ff926d7d0819f8c7f38a396ddf8e1707c73936ad542fc2abb.png).

5. **Ivory facade panels**, `cyberpunk/ivory-panel/mid`. Building references 05, 07 and 18 show smooth pale panels with fine mineral response under raking light. The pale facade in the game at 21:00:21 reads as an even, soft beige surface. Photo refinish retains both ivory and cool grey albedos. Relief increases from 0.08 to 0.28, grain is 0.10 and the roughness band is 0.45 to 0.51, with a 0.48 fallback. Both variants share the refreshed response maps.
   Maps: `themes/cyberpunk/assets/ivory-panel/mid/native/{normal,roughness,height,ao}.png` and [packed metallic roughness](../themes/cyberpunk/assets/metallic-roughness/31ac2096236909f2c8074e2849ba97efa7d852787775ff345bc410133074f711.png).

Four procedural creates and one photo refinish regenerate 34 map files, including five packed maps. Of these, 26 PNGs change bytes; constant channels retain identical pixels. `npm run compress -- --workers 2` refreshes 34 KTX2 siblings and skips 3572 current files. Keys, variants, paths, resolutions and metre scales remain fixed. Native street hashes match the refreshed masters. Validation: 26 cases pass across 10 test files; typecheck and build pass. All changed masters have newer valid KTX2 siblings.

Visual verification covers the PNG comparisons and reference captures. In game lighting, glass reflections, visible room depth, marquee placement and geometry need consumer verification; this pass does not launch a renderer.
