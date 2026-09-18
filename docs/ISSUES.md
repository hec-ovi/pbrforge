# Materials issues

## Open decisions

The stage document leaves these choices to the orchestrator. Current behavior is preserved.

| Decision | Reason | Affected boxes |
| --- | --- | --- |
| Catalog output version | ThemeIndex has no version field; shared conventions require versioned output. | Materials, Streets, Links, Exterior, Interior, Engine |
| Preview thumbnails: 16 or 32 px | Raw request and implemented presentation differ. | Materials preview |
| Template inheritance | Keys and theme folders exist; a formal inheritance API is unspecified. | Materials and authoring callers |
| Seam metadata per variant | Creation lanes have different seam guarantees. | Materials and geometry consumers |
| Catalog revision identity | Frozen catalog identity is unspecified. | Materials and all catalog consumers |
| Additional transport | Package and CLI exist; another transport is unspecified. | Materials and API callers |
| Creation timing | Author during GLB creation or choose existing entries from a frozen catalog. | Materials, Streets, Links, Exterior, Interior, Engine |
| UV ownership | Concrete UV placement versus scale/fitting metadata remains undecided. | Materials and geometry consumers |

## Proposals for coordination

These require behavior changes outside this light-touch pass.

| What | Why and evidence | Affected boxes |
| --- | --- | --- |
| Preflight screen size for `create --native` before backend access. | CLI `assertNative` verifies paths only; `SourceImage.load` uploads undersized art. The stage requires a backend-free native lane. | Materials CLI and authoring callers |
| Validate all rebrand resources before writing. | `Rebrander.rebrand` validates names, then writes each business/screen sequentially. A later missing screen or letter variant can leave earlier writes. The stage requires resource errors before writes. | Materials, world-branding callers |
| Reject from-image duplicate keys before writing maps; publish multi-variant creates atomically. | FromImage writes map files before Database.write rejects an existing key. Generator writes each variant before later variants are checked. Error responses do not guarantee an untouched database. | Materials and authoring callers |
| Normalize unexpected library filesystem/backend exceptions at the public boundary. | Root operations pass through writer/decoder/backend failures. The CLI catches them as E_INTERNAL; the library does not always produce MaterialsError. | Materials package callers |
