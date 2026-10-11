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

# Slice B: examples, tags and status (2026-10-11)

Status: DONE (not committed). Shared tsc is clean. Web tsc fails in `import-messages.ts`, as agreed (see below).

## What changed
- **Examples ⇄ `response[]`:**
  - Name, `originalRequest` (read and written by the same request code as items; the item's own request is
    used when `originalRequest` is absent), `code`/`status`, header rows (disabled rows and descriptions kept;
    the string form is read too), body, and `_postman_previewlanguage` ⇄ `bodyLanguage`.
  - An unknown language is guessed from Content-Type, else `text`. A missing or out-of-range code becomes 200.
  - Bodies over `EXAMPLE_BODY_MAX` characters are cut with an `EXAMPLE_BODY_TRUNCATED` `{ max }` warning.
    Example header rows over `MAX_HEADERS` are cut with `TRUNCATED`.
  - Examples count toward `MAX_IMPORT_ITEMS`.
- **Tags and status** go in the collection-level `_localman: { tags?, status? }`, written only when set.
  - Import validates them with the shared `normalizeTags` and `collectionStatusSchema` (`collections/collection-tags.ts`).
    No local fallback is left.
  - Tags are lower-cased and de-duplicated. Invalid tags are dropped and only the first 10 are kept. Either case
    raises `INVALID_METADATA` `{ field: "tags" }`.
  - An invalid status becomes `null` and raises `INVALID_METADATA` `{ field: "status" }`.
- **New warning codes** `EXAMPLE_BODY_TRUNCATED` and `INVALID_METADATA` were approved by the coordinator.
  **Web task:** add both cases to the exhaustive switch in `apps/web/src/features/api-client/import-export/import-messages.ts`,
  plus en/vi/zh-CN strings under `apiClientTools.import.warnings`. Until then, web tsc reports TS2366 there.
  The other web tsc errors come from the slice B contract changes in `apps/web/src/features/collections/**` (outside this scope).
- **Refactor:**
  - `import/collection-v21-request.ts` reads a request object.
  - `export/collection-v21-request-export.ts` holds the auth and request writers and `examplesToV21`.
  - `export/tree-builders-test-utils.ts` holds the fixture builders.
  - The export test helpers (`exportChecked`, `roundTrip`, `treeOf`) moved into `v21-schema-test-utils.ts`.
  - `capRows` is now exported from `import-context.ts`.
- **Bundle note:** the importer now imports `collection-tags.ts`, which uses zod, so the web import path loads zod.

## Not kept for examples
Cookies, `responseTime`, `timings`, and the scripts/settings of an example's request (v2.1 has no place for them).
The example request's name is the example's name. Secret blanking is unchanged.

## Tests (slice B)
- shared export+import: 11 files, 92 tests pass. request-context: 9 tests pass.
- New test files: `export/collection-v21-examples.test.ts` (6) and `export/collection-v21-postman.test.ts` (5;
  the Postman part moved out of the round-trip test). The nested Postman fixture now has 2 examples: one with
  `originalRequest`, one without, with a disabled header, `"Text"` preview language and a cookie.
- `RICH_TREE` has 3 examples, tags and a custom status. Its round trip still deep-equals the original (secrets
  blank), and every export validates against the official v2.1.0 schema.
- web import-export: 12 tests pass. Biome reports 0 issues on the owned files. Every file is 200 lines or fewer.

# Review finding M1: imports always fit the server limits (2026-10-11)

Status: DONE (not committed). Shared and web tsc exit 0. The web side has added cases for all three new warning codes.

## What changed
- **`import/fit-tree.ts`** runs last on every collection import (v2.1, OpenAPI, cURL), in `importText`.
  - **Names:** a blank name falls back to the request URL, else "Untitled"; an example falls back to its request's
    name. Every name is cut to `COLLECTION_NAME_MAX`.
  - **Descriptions:** cut to `COLLECTION_DESCRIPTION_MAX`.
  - **Collection and folder scripts:** a script over the limit is dropped, as for requests.
  - **Variables:** blank keys are dropped, at most 200 are kept, key ≤200 and value ≤10,000.
  - **Examples:** statusText is cut to 200 and headers are fitted. The body is cut by UTF-8 bytes at a code point
    boundary to `EXAMPLE_BODY_MAX`, with `EXAMPLE_BODY_TRUNCATED` `{ max }`, where `max` is now in bytes.
- **`import/clamp-draft.ts`** (moved out of `import-context.ts`): `clampDraft` now also fits the URL, every row's
  key, value and description, and auth fields to `apiRequestDraftSchema`. Every text cut raises `TEXT_TRUNCATED` `{ max }`.
- **`import/fit-text.ts`:** `sliceUnits` never splits a surrogate pair; `sliceUtf8` cuts on a code point.
- The examples reader no longer cuts the body; `fit-tree.ts` does it, by bytes.

## Tests
- `import/fit-tree.test.ts` (9 tests):
  - A hostile but valid v2.1 file breaks every limit (300k × "é" example body, blank names, an over-long URL and
    row value, over-long description, script and statusText, blank and over-long variables). It imports, the
    tree passes the create schema, and each cut raises a warning.
  - All four import fixtures (v2.1 sample, v2.1 nested, OpenAPI, cURL) pass the create schema.
  - Without the fit step, the hostile file fails the create-schema test, and its 3 other checks fail too.
- The schema check uses the shared `collectionTreeSchema` (`collections/collection-tree-schema.ts`), the same schema
  the API validates with. The temporary stand-in schema is deleted.
- Targeted shared tests: 13 files, 110 tests pass. web import-export: 12 pass. Biome is clean on the owned files.
  Every file is 200 lines or fewer.
