# Phase 12 slice A: v2.1 codec round trip and request context

Status: DONE (not committed)

## What changed
- Export validates against the official Collection v2.1.0 JSON Schema (vendored at
  `packages/shared/src/api-client/export/__fixtures__/collection-v2.1.0.schema.json`,
  README with source URL and Apache-2.0 attribution; checked with `ajv` + `ajv-draft-04` in tests only).
- The old export failed that schema: secret variables were written as `type: "secret"`, which the
  v2.1.0 enum does not list. They are now `type: "string"` plus `_localman: { secret: true }`.
  The importer still reads `type: "secret"` from other tools' files.
- Secret variable values are blanked on export (Jev 0.98): the key and `_localman.secret: true` are kept and the
  value is written as `""`, like environment exports. Secret variables are the only data the model marks secret.
  `type: "string"` + `_localman` stays, because schema validity takes priority.
- Request settings v2.1 has no field for (`timeoutMs`, `sendClientIp`, `route`) are written under
  item-level `_localman` when not default. The schema has no `additionalProperties: false`, so this validates.
  The importer checks every value (timeout must be an integer within the bounds, route must be a known
  mode) and falls back to the default otherwise.
- Bodies keep inactive kinds: `mode` is the kind that is sent, and other non-empty kinds are written next
  to it (the schema allows this). A `none` body that still has content is written `disabled: true` with no `mode`.
- Request description falls back to the item-level `description`. Saved responses (`response[]`) are ignored
  without crashing (fixture has one).
- New `collections/request-context.ts`: `requestContext(detail, requestId, own?)` returns
  `{ inheritedAuth, authSource, preScripts, postScripts, variables, folderPath }` or `null`.
  It is guarded against missing parents, parents that are requests, and cycles.

## Round trips losslessly
Collection name, description, auth (none/bearer/basic/apikey), variables (disabled; secret keeps key and flag), scripts.
Folders nested 3+ levels with description, auth (inherit = absent, none = noauth) and scripts.
Requests: method, URL including query and hash, params and headers with disabled rows and descriptions,
auth including inherit, raw (with language), urlencoded, formdata text rows, binary type, inactive body
kinds, scripts, and all four settings.

## Documented as dropped
- Secret variable values: these are blanked on purpose, so the file can be shared.
- File bytes and picked-file references (`FileRef`): form-data file rows and binary bodies come back with
  no file, and a `FILE_NOT_INCLUDED` warning is raised.
- CRLF in scripts comes back as LF. Blank scripts are dropped.
- `description: ""` on a row comes back as absent.
- Examples (`response[]`) are slice B.

## Tests
- shared: 10 files, 94 tests pass. New tests: `export/collection-v21-round-trip.test.ts` (16, including one
  that checks no secret value appears anywhere in the exported JSON) and `collections/request-context.test.ts` (9).
- web import-export: 2 files, 12 tests pass.
- Both `tsc --noEmit` runs (shared, web) exit 0. `biome check` on the owned files reports 0 issues.

## For the web task
`export-menu.tsx` shows `apiClientTools.import.export.secretsBlank` ("secret values are left empty") only for
environments. The open-tabs collection export has no variables, so it needs no notice today. The stored-collection
export added in phase 12 should show the same notice when the collection has secret variables.
That file is outside this slice's ownership, so I did not change it.
