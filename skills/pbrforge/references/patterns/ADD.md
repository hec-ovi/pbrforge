# Add a pattern kind

Only when the user needs a drawer that no existing kind can draw. Prefer a new recipe JSON that reuses an existing `kind`.

1. Class `src/gen/pattern/<Name>.ts` extends `Pattern`. Implement `texel(at)`. Return color, height, roughness (opacity if a decal).
2. `src/gen/pattern/build.ts`: `case '<kind>': return new Name(params);`
3. `src/db/types.ts` `PatternKind` union: add `'<kind>'`.
4. `schema/create-request.schema.json` `pattern.kind` enum: same slug.
5. `schema/pattern-kinds.json`: `{ kind, draws, reads, detail }`.
6. This folder: `<kind>.md` (what it draws, params, geometry in metres) and a row in [INDEX.md](INDEX.md).
7. Prove it: one `create` request with that kind, `pbrforge patterns` lists it, box tests pass.

`pbrforge patterns` kinds must match the create-request enum. Do not edit `theme.json` or map PNGs by hand.
