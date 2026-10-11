# Phase 12 slice A: collections API (backend)

Status: DONE_WITH_CONCERNS. Nothing committed.

## What was built
- Shared: `collection-order.ts` (`orderKeyBetween`, `orderKeysBetween`, `compareOrder`) and `collection-tree.ts` (`nodesToCollectionTree`, `collectionTreeToNodes`, `childrenByParent`, `COLLECTION_DEPTH_MAX = 64`, `CollectionRootFields`). Both are exported from `@localman/shared/api-client`. The order wrapper checks the key alphabet and `before < after` itself: `fractional-indexing` v4 silently returns an out-of-range key for `(b, a)`.
- The `collection` element adapter is registered when `collection-operations.ts` is imported, which happens with the registry, so the dashboard and MCP both get it. Tests call `registerCollectionAdapter()` after `useAccessTestDb()` resets the adapters. A move without a session runs under the target workspace lock.
- 16 operations in toolset `client` (table below), a trash purge job (`CollectionTrashJob`, started and stopped in `main.ts`), the workspace-delete cascade, and `source` on drafts.

| id | method | path | MCP |
|---|---|---|---|
| client.listCollections | GET | /workspaces/:workspaceId/collections | yes |
| client.createCollection | POST | /workspaces/:workspaceId/collections | yes |
| client.getCollection | GET | /collections/:collectionId | yes |
| client.updateCollection | PATCH | /collections/:collectionId | yes |
| client.duplicateCollection | POST | /collections/:collectionId/duplicate | yes |
| client.deleteCollection | DELETE | /collections/:collectionId (dryRun) | yes |
| client.exportCollection | GET | /collections/:collectionId/export | yes |
| client.createCollectionNode | POST | /collections/:collectionId/nodes | yes |
| client.updateCollectionNode | PATCH | /collections/:collectionId/nodes/:nodeId | yes |
| client.moveCollectionNode | POST | /collections/:collectionId/nodes/:nodeId/move | yes |
| client.deleteCollectionNode | DELETE | /collections/:collectionId/nodes/:nodeId (dryRun + confirm) | yes |
| client.favoriteCollection | PUT | /collections/:collectionId/favorite | exempt (sidebar UI state) |
| client.unfavoriteCollection | DELETE | /collections/:collectionId/favorite | exempt |
| client.listTrashedCollections | GET | /trash/collections?workspaceId= | yes |
| client.restoreCollection | POST | /trash/collections/:collectionId/restore | yes |
| client.deleteTrashedCollection | DELETE | /trash/collections/:collectionId (dryRun + confirm) | yes |

Error codes: 404 `NOT_FOUND`, 404 `NODE_NOT_FOUND`, 403 `FORBIDDEN`; 400 `CONFIRMATION_REQUIRED`, `INVALID_PARENT`, `INVALID_POSITION`, `INVALID_ORDER`, `MOVE_CYCLE`, `INVALID_NODE_FIELDS`, `COLLECTION_TOO_DEEP`, `VALIDATION_ERROR`; 409 `COLLECTION_NODES_LIMIT`, `COLLECTION_LIMIT_REACHED`, `TEAM_TO_PERSONAL`, `WORKSPACE_MISSING`; 413 `DRAFT_TOO_LARGE`.

## Decisions taken
- Trash retention uses the largest `trashDays` across plans (30 days). `purgeAt` and the purge job both use this value.
- The permission to restore or permanently delete belongs to whoever deleted the collection, or to a current Admin or Editor of its original workspace. Restoring a team collection into a personal workspace returns 409 while the team workspace still exists. Once that workspace is gone, any workspace where the caller has `addElements` is accepted.
- A workspace holds at most 1000 live collections (`COLLECTIONS_PER_WORKSPACE_MAX`, checked under the workspace lock). This keeps the sidebar list a bounded query.
- A tree may nest folders at most 64 levels deep. An iterative bound check runs before the recursive zod schema, because zod overflowed the stack at about 2000 levels.
- Creating, moving and deleting nodes run under `inWorkspaceTransaction`. Without it, two crossing folder moves could both pass the cycle check (a test covers this). A move still rewrites only the node itself.
- `updatedAt` of a collection is the latest of its root and its nodes, so a drag needs no extra write to the root.
- `POST …/nodes` takes the node as a flat body, as `nodeCreateSchema` describes it. An operation input cannot be a union.
- Drafts: `source` is optional in input and output. `null` unbinds the request, and leaving the field out keeps the current binding.

## Changes outside the stated ownership (please confirm)
- `collection-model.ts`: the contract's partial index `{deletedAt: {$exists: false}}` cannot be built on MongoDB ("Expression not supported in partial index: $not"), so the model failed to start. I replaced it with the plain index `{workspaceId, deletedAt, name}` and added `{deletedBy, deletedAt}` (partial). Exports are unchanged.
- `workspace-crud-operations.ts`: the `sharing.deleteWorkspace` output gains `collections` (the dry-run count), and the call passes `sub`.
- `api-client/draft-service.ts`: persists `source`.

## Verification
- Typecheck is clean for both `apps/api` and `@localman/shared`. `biome check` on 47 owned files reports nothing. `pnpm check:mcp-coverage` reports OK (139 operations, 104 tools, 35 exempt).
- Tests: shared 6/6. Collections: 8 files, 23/23. Draft source 2/2. Regression across access, workspaces, operations, drafts and MCP (25 files): 131/132. The one failure was `share-operations.test.ts` "includes an environment…", which checks notification order. It passed on 4 reruns, so it is flaky and was not caused by this work.

## Concerns and follow-ups
- `docs/operation-registry.md` is not owned by me and still needs updating: the list of `requiresConfirmation` tools (it says "exactly 7"; `delete_collection_node` and `delete_trashed_collection` make 9) and the exempt favorite operations.
- There is no total byte cap per collection. Each request is capped at 1 MiB and nodes at 2000, so `GET /collections/:id` could in theory be very large.
- `main.ts` was already 207 lines and is now 213.
- The export test depends on the shared exporter, which the other agent is changing (secret values are now blanked).

## Review fixes (second pass)
H1, trash restore and permanent-delete rights, is unchanged and waits for the user's decision. Each fix below has a test.

- **H2, per-collection byte budget.** The root now stores `bytes` and `requestCount` (a missing value reads as 0). `bytes` is the UTF-8 size of the JSON of the root's fields and of every node's name, description and draft, or auth and scripts for a folder. `collection-bytes.ts` `chargeRoot` applies the change with `$inc` inside the workspace-lock transaction. It runs on node create, update (now also under the lock) and delete, and on the root PATCH, which counts the difference in its own fields. Tree import, template and duplicate compute the total up front in `insertCollection`. Going past 20 MiB returns 413 `COLLECTION_TOO_LARGE`; shrinking is always allowed. Tests: `collection-budget.test.ts`.
- **M1, move keys.** `node-move-service.ts` takes the upper bound from the stored siblings, not from the client's view: the real next sibling after `beforeOrder`, excluding the moved node, or `afterOrder` if that is lower. If a sibling already holds the computed key, a new key is generated. Database errors are kept outside the key-validation `try`, so a transient transaction error still triggers the retry. Test: three drops between A and B from the same stale view all succeed with distinct keys.
- **M2 and L4, collection move.** The adapter's `moveRoot` checks `assertWorkspaceRoom` and `matchedCount`. A full target workspace returns 409 `COLLECTION_LIMIT_REACHED`. A collection trashed in the meantime returns 404. If the target workspace is gone, `inWorkspaceTransaction` already returns 404.
- **M3.** No code change, as decided. A comment in `collection-view.ts` explains that secret variable values and auth credentials are returned to everyone who can view the collection; "secret" is only a masking flag, and only an exported file blanks the values. **The lead should document this.**
- **M4 and L2.** The sidebar reads `requestCount` and `updatedAt` from the root and the node aggregation is gone. Every node write now updates the root, so the detail `updatedAt` is simply the root's. `findNodes` now sorts by `{parentId, order}`, which matches the index.
- **L1.** Job construction, start and stop moved to `apps/api/src/background-jobs.ts`. `main.ts` is now 200 lines and behaves the same.
- **L3.** Node create, move, update and delete stamp the live root through `chargeRoot`, so a concurrent trash or purge conflicts with the transaction. A trashed root returns 404.
- **L5.** Share-only listing pages through all of the caller's collection shares, 500 at a time, joining each page against the workspace's live collections. Nothing is cut by a global limit. Test: 1,200 unrelated shares, then one real share, which is listed.
- **L7.** Note only: the web treats a 404 on save as an unbind.
- **L8.** Test: a 20,000-level tree sent as raw JSON is rejected with 400 `VALIDATION_ERROR` "…levels deep", with no stack overflow and nothing stored.

**Files.** New:
- `apps/api/src/background-jobs.ts`
- `apps/api/src/modules/collections/collection-bytes.ts`
- `apps/api/src/modules/collections/node-move-service.ts`
- `apps/api/src/modules/collections/collection-budget.test.ts`
- `apps/api/src/modules/collections/collection-races.test.ts`

Changed:
- `collection-model.ts` (the `bytes` and `requestCount` fields; I chose the M4 option of keeping `requestCount` on the root)
- `collection-store.ts`, `collection-service.ts`, `collection-list-service.ts`, `collection-view.ts`, `collection-adapter.ts`
- `node-service.ts`, `node-edit-service.ts`, `collection-node-operations.ts`
- `main.ts`

**Checks.** Typecheck is clean for both `apps/api` and `@localman/shared`. `biome check` reports nothing on 52 files. `pnpm check:mcp-coverage` is OK (139 operations, 104 tools, 35 exempt). Targeted run of collections, workspaces, access, operations and drafts: 25 files, 125/125 tests pass.

## H1 (user decision): trash rights follow the current role
This supersedes the "Decisions taken" bullet above about who may restore or permanently delete.

**While the original workspace exists:**
- Listing the trash, restoring and permanently deleting all require the caller's current `restoreElements` role (Admin or Editor) in the original workspace. Having deleted the collection no longer counts.
- A deleter who has since been demoted or removed gets 404 on restore and permanent delete (nothing reveals the item exists), and the item drops out of `GET /trash/collections`.
- Restoring into a different workspace also follows the phase 11 move rule: `moveDeleteElements` in the original, `addElements` in the target, and 409 `TEAM_TO_PERSONAL` for team to personal. A personal collection can go back to its personal workspace or into a team.

**Once the original workspace is deleted:**
- The workspace-deletion cascade records `trashEditors`: the Admin and Editor user ids of the workspace at that moment. It stores them on the collections it trashes and on the ones already in the trash.
- The rights then belong to the person who deleted the collection or to anyone in `trashEditors`.
- The target must be a team workspace where the caller has `addElements`; a personal target gets 409 `TEAM_TO_PERSONAL`.
- `trashEditors` is set only by this cascade, so the trash listing can select these collections with an exact query. Restoring removes the field.

**Additions for the web:**
- `CollectionSummary.role` and `CollectionDetail.role` (`"editor" | "viewer"`).
- `requestCount` on trash entries.

**Code changes:**
- Rights: `trash-access.ts` (`requireTrashed` now also returns the original workspace and the caller's role there).
- `trash-restore-service.ts` (new): the trash list and restore. `trash-service.ts` keeps only moving a collection to the trash.
- `workspace-collections.ts`: the cascade now records `trashEditors`.
- `collection-model.ts`: the `trashEditors` field and a partial index on it.
- `collection-favorite-service.ts` (new): favorites split out of `collection-list-service.ts` to stay under 200 lines.
- Shared `collection-model.ts`: the `role` field.
- `request-context.test.ts`: one fixture line (`role: "editor"`), as authorized.

**How the list computes `role`:** one batched query returns the stronger of the workspace role and the caller's own share. It does not count a share still addressed to the caller's email until they first open the collection, which is when `elementRoleOf` claims it.

**Tests:**
- `collection-trash-rights.test.ts`: the review's probe (deleter demoted to Viewer, then removed: 404 and not listed; Viewer promoted to Editor: listed and can restore), the move rule when restoring elsewhere, personal collections, and roles in the list and detail.
- `collection-trash-purge.test.ts`: the cascade test now covers `trashEditors`, a collection already trashed before the cascade, a Viewer (404), a personal target (409) and a team target (200).

**Checks:**
- Typecheck is clean for both `apps/api` and `@localman/shared`.
- `biome check` reports nothing on 57 files.
- `pnpm check:mcp-coverage` is OK (139 operations, 104 tools, 35 exempt).
- Targeted run of collections, workspaces, access, operations and drafts: 26 files, 129/129.
- Shared collections tests: 15/15.

**One process slip:** I ran `biome check --write` once on the whole `apps/api/src/modules/collections/` directory. Every file in it is mine.

### API shape changes in this pass
- `CollectionSummary` (`GET /workspaces/:workspaceId/collections`, `items[]`) gains `role: "editor" | "viewer"`.
- `CollectionDetail` (`GET /collections/:collectionId`, create, `PATCH`, duplicate, restore) gains `role: "editor" | "viewer"`. Create, duplicate and restore always return `"editor"`, because the caller needed `addElements` in the target.
- Trash entries (`GET /trash/collections` `items[]`, and `collection` in the `DELETE /trash/collections/:id` response) gain `requestCount: number`.
- Restore and permanent delete still return 404 when the caller has no right, but who has the right changed as described above.
- `POST /trash/collections/:id/restore` can now return 403 `FORBIDDEN` (no `moveDeleteElements` in the original when restoring elsewhere; unreachable with today's role tables) and 409 `TEAM_TO_PERSONAL` when the original workspace is gone and the target is personal.
- Stored only, not in the API: `collections.trashEditors?: string[]`.

## Node duplicate and collection search (web review)

**`client.duplicateCollectionNode`, `POST /collections/:collectionId/nodes/:nodeId/duplicate`, MCP tool `duplicate_collection_node`**
- Needs Editor on the collection. Copies the node and its whole subtree as its next sibling: the copied node is renamed "<name> Copy" and gets an order key between the source and the next sibling. Every copy gets a new id, and parents are remapped.
- Runs in one transaction under the workspace lock and charges the root (`bytes`, `requestCount`).
- On failure nothing is written: 409 `COLLECTION_NODES_LIMIT` or 413 `COLLECTION_TOO_LARGE`. Other errors: 404 `NODE_NOT_FOUND`, 403 for a Viewer.
- Returns 201 `{ nodes: CollectionNode[] }`: only the new nodes, the copy of the node first, parents before children.
- Why only the new nodes: the web already holds the detail and can append them without reloading it, and the payload stays small (a full detail can approach 20 MiB). The collection's `updatedAt` changed too; the web can refetch the detail when it needs that.

**`client.searchCollections`, `GET /workspaces/:workspaceId/collections/search?q=`, MCP tool `search_collections`**
- `q` is trimmed and must be 1 to 100 characters (400 otherwise).
- The search covers live collections the caller may open: all of them for a member; for anyone else, only those shared with them (404 when there are none, the same as the list).
- Matching is a case- and accent-insensitive substring. Text is NFD-decomposed, combining marks removed and lower-cased, and "đ" becomes "d" (it has no decomposition).
- At most 100 matches: collections first, by name, then folders and requests in index order. `truncated` is true when more matched.

How the search stays bounded:
- Collection names come from the bounded list query (at most 1000 per workspace) and are filtered in memory.
- Folder and request names: nodes now store `searchName`, the folded copy of `name`. It is written by `storedNodeOf` (create, import, duplicate) and by node rename. The new index `{collectionId: 1, searchName: 1}` lets an escaped-regex substring match scan index keys only, and the query is limited to `room + 1` rows. The feature is unreleased, so there is no backfill.
- The method comes from the projection `"draft.method"` on the matched rows only, so no full draft leaves MongoDB. I chose not to also store a `method` copy: it would be a second field to keep in sync for no gain, since the method is needed only for the ≤100 results.
- `path` loads the folders above the matches one level per round (at most 64 rounds, each a `$in` by id).

**Shared types** (`collection-model.ts`): `COLLECTION_SEARCH_QUERY_MAX = 100`, `COLLECTION_SEARCH_RESULTS_MAX = 100`.
```ts
interface CollectionSearchMatch {
  collectionId: string; collectionName: string; nodeId: string | null;
  kind: "collection" | "folder" | "request"; name: string;
  method?: HttpMethod; path: string[]; // folder names, outermost first
}
interface CollectionSearchResult { matches: CollectionSearchMatch[]; truncated: boolean }
```

**Files.** New:
- `node-duplicate-service.ts`
- `collection-search-service.ts`
- `collection-search-operations.ts`
- `search-text.ts`
- `collection-node-duplicate.test.ts`
- `collection-search.test.ts`

Changed:
- `collection-node-model.ts` (`searchName` field and index)
- `collection-store.ts`, `node-edit-service.ts` (write `searchName`)
- `collection-list-service.ts` (exports `visibleRoots`)
- `collection-node-operations.ts`, `collection-operations.ts`
- Shared `collection-model.ts`

**Checks:**
- Typecheck is clean for both `apps/api` and `@localman/shared`.
- `biome check` reports nothing on the 63 owned files.
- `pnpm check:mcp-coverage` is OK (141 operations, 106 tools, 35 exempt).
- Targeted run of collections, workspaces, access, operations and drafts: 28 files, 135/135.
- Shared collections tests: 15/15.

The scratchpad file list is shared with another session and had picked up `apps/web` paths. Every `biome --write` run used my own list or explicit paths, so no web file was written.
