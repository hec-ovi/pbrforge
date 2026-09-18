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
