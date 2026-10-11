# Phase 12 slice A: collections web, round 1

Status: DONE_WITH_CONCERNS. Nothing committed.

## Scope delivered (UI spec sections 1, 4, 5)
Everything is behind `useWorkspacesEnabled()`. When the flag is off, the rail, the sidebar, the import dialog and `/trash` behave as before. A test checks that no `/api/v1/workspaces*` request is made in that state.

- **Rail**: `sidebar-rail-collections` comes first and is the default section. `sidebar-rail-trash` sits at the bottom and links to `/trash`.
- **Collections panel** (`features/collections/`):
  - Head: `sidebar-collections-new` opens a menu with Blank, REST CRUD template and From mock project. From mock project uses the existing `FromMockModal` with collection wording, then `mockRequestsOf` builds one folder per resource, with nested resources nested. `sidebar-collections-import` opens the existing Import dialog with "Save as collection" preselected.
  - Search is case and accent insensitive and marks the match with `<mark>`. Sort offers Name A–Z, Name Z–A and Recently updated, stored in `localStorage` inside try/catch. Favorites always come first.
  - States: skeleton, error with retry, empty state with New and Import buttons, and a no-match message.
- **Tree**:
  - `role="tree"` with a single tab stop. Arrow keys, Home/End, Enter to open and F2 to rename. The star and ⋯ buttons are tabbable only on the focused row.
  - Inline rename: Enter saves, Escape cancels, leaving the box saves.
  - Drag and drop uses @dnd-kit with pointer (6px threshold) and keyboard (Space, arrows, Space or Enter, Escape) sensors, plus screen-reader announcements. Drop marks show before, after or inside. Drops stay within one collection, and a folder is never dropped into its own subtree. The move is applied to the cache at once and rolled back with a toast if the server refuses.
  - Menus per kind follow the spec. A Viewer sees only Share, Copy link and Export, and the New and Import buttons are disabled for them.
- **Dialogs**:
  - Share mounts the phase 11 `ShareDialog`.
  - Move: a workspace picker that disables the current workspace, team-to-personal, and workspaces without `addElements`.
  - `modal-delete-collection` asks for `delete` only when the collection holds requests. Its note shows the `limitsFor(plan).trashDays` retention.
  - Deleting a folder or request asks for confirmation because it is permanent.
  - Focus goes back to a surviving row or the search box after a delete or move.
- **Other actions**:
  - Export downloads Collection v2.1 through the shared exporter and shows the `secretsBlank` note when a variable is secret.
  - Copy link copies `/elements/collection/:id`.
  - Duplicate a collection uses the API. Duplicating a folder or request rebuilds the copy node by node, because the API has no node copy.
  - Favorite updates optimistically.
- **Opening items**: `onOpenNode(target)` is the contract for round 2 (`open-node.ts`). In round 1 a request opens as an unbound tab: named after the node, `inherit` auth resolved, collection variables filled in. Clicking a collection or folder selects and expands it.
- **`/trash`**: a lazy, authed, flag-gated route.
  - Search by name.
  - The table becomes cards below 768px. Days left turn the warning colour at 7 or fewer.
  - `trash-restore` opens `modal-restore` with the `modal-restore-workspace` select. `trash-delete-permanently` opens a ConfirmModal.
  - Empty state when nothing is in the trash.
- **i18n**: new `collections` namespace in en, vi and zh-CN; the trash strings are split into `collections-trash.ts`. The only change to existing dictionaries is a new import and one entry each.

## API layer for round 2
- `collections-api.ts` has a typed client for every operation, including `updateCollection` and `NodePatch` (description, auth, scripts, draft).
- Query keys live in `use-collections.ts`: `collectionKey(id)` holds the detail that round 2 tabs should read, and `collectionListKey(ws)` the list.
- Parsers run scalars through json-guards and drafts, auth, scripts and variables through the shared zod schemas. No casts.

## Files touched outside `features/collections`
- `workbench/sidebar-rail.tsx`, `workbench-sidebar.tsx`, `workbench-layout.tsx`: optional `collections` prop.
- `import-export/import-modal.tsx`: optional `saveCollection` and `initialMode` props. New file `import-save-mode.tsx`.
- `open-in/from-mock-modal.tsx`: optional `copy`; `onPick` also passes the project name.
- `pages/api-client/api-client-screen.tsx`, `routes.tsx`, and the three `dictionary.ts` files.

## Verification
- `tsc --noEmit` on the web app: clean.
- `biome check` on all changed files: clean.
- `check:i18n`: OK.
- `check:tokens`: OK (only the existing APCA advisory).
- Tests: 8 new files with 42 tests. Run together with the affected suites (collections, workbench, import-export, open-in, the api-client page, i18n, routes, prerender, sharing): 36 files, 190 tests, all passing.

## Concerns
- Trash rows cannot show "name with item count" from the spec, because `trashedView` has no node count. Adding one needs an API change.
- Permissions in the tree come from the caller's workspace role. A Viewer who has an Editor share on one collection still sees that collection as read-only in the sidebar. The server stays the authority.
- Search loads the detail of every collection in the workspace (at most 1000). This is fine for normal workspaces, but a very large one would issue many requests.
- `routes.tsx` was already 201 lines and is now 209.
- Responsive layout at 375, 768 and 1440px was built with Tailwind breakpoints but not checked in a real browser this round.

---

# Round 2: collection and folder tabs, bound requests, inheritance at send time (spec sections 2–3), housekeeping

Status: DONE_WITH_CONCERNS. Nothing committed.

## A. Collection and folder tabs
- **Where they live:** the workbench now holds pages next to request tabs (`PageTab` in `workbench-tab-types.ts`, plus `openPage` and `renamePage`). The tab bar shows them after the requests, with a stack or folder icon (`page-tab-item.tsx`). Arrow keys and Delete work across both kinds of tab. Pages are not drafts, so they are not restored after a reload.
- **Header:** icon, a name editable in place (read-only for a Viewer), the save state ("Saving…", "All changes saved", or the error with a retry, in an `aria-live` output), Share (mounts `ShareDialog`), and a "…" menu with Copy link and Export.
- **Sub-tabs:** `collection-tab-overview`, `-authorization`, `-scripts`, `-variables`. A folder has no Variables tab.
- **Overview:**
  - Markdown description. No Markdown library is a dependency, so `markdown-view.tsx` is a small safe renderer. It covers headings, paragraphs, lists, fenced code, inline code, bold, italic and links. It builds React elements, never HTML, and links go through `ExternalLink`, which drops unsafe URLs.
  - Edit opens the box (`collection-description-input`); Save (`collection-description-save`) writes it.
  - Meta column: creator, last updated, workspace, request count.
- **Authorization** uses the new shared `AuthForm` (split out of the request `AuthTab`). A collection has no Inherit option; a folder does.
- **Scripts** uses the new shared `ScriptsEditor` (split out of `ScriptsTab`) and notes the run order.
- **Variables** is a key / value / enabled / secret table; secret values are shown as a password field.
- **Saving:** edits save themselves 800 ms after typing stops, and Ctrl/Cmd+S saves at once. Saves are `PATCH /collections/:id` or `PATCH …/nodes/:id`. A failed save keeps the edits for the next try.

## B. Request tabs bound to nodes
- `WorkbenchTab` gains `source` and `saved`.
  - A bound tab is dirty only when its draft differs from `saved` (content comparison); a loose tab behaves as before.
  - New reducer actions: `bind` (with `null` to unbind) and `setSaved`.
- **Draft sync:** the binding is persisted with the draft (`use-binding-writes.ts`). `source` is sent when it changes and `null` when unbinding a tab the server holds a binding for; it is left out otherwise, so request bodies with the flag off are unchanged.
- **`onOpenNode`:** a request opens as a bound tab, or an already open tab for the same node is shown again. A collection or folder opens its page.
- **Breadcrumb:** `request-breadcrumb` above the request head; each parent segment opens its tab.
- **Saving a request** (Ctrl/Cmd+S or the new Save button in the request head):
  - A bound tab PATCHes the node's draft and name, then turns clean.
  - A 404 unbinds the tab, keeps the edits and shows a toast.
  - A loose tab opens "Save to collection": pick a collection you can edit, a folder and a name, then POST the node and bind the tab.
  - The Save button is hidden for a Viewer of the bound collection.
- **Restored bound tabs:** `BoundSavedSync` loads the node's saved draft so the "unsaved" state is correct after a reload.

## C. Inheritance at send time
- `WorkbenchProvider` takes `sendContext` (`useCollectionSendContext`, mounted on `ApiClientPage`). It calls `requestContext(detail, nodeId, tab.draft.scripts)` from the cached or fetched collection.
- `prepareSend` / `finishSend`:
  - Bound tabs run pre-request scripts in order (collection, then folders outer to inner, then the request), and post-response scripts in the same order (`script-chain.ts`). The first error stops the chain; tests and logs are merged in run order.
  - `inherit` auth is replaced by the inherited auth before the send, so the credential checks for the proxy route also see it.
  - Unbound tabs keep exactly today's behaviour. `finishSend` no longer takes the draft; its three callers were updated.
- **Variable precedence for `{{var}}`, lowest to highest:** collection variables, then `lm.variables` set by scripts. Environments (phase 13) belong between the two. Collection secrets keep their secret flag, so the consent before the proxy still applies to them. Scripts do not see collection variables yet: seeding `lm.variables` with them would drop the secret flag.
- **Inherited auth note:** the request Authorization pane shows `auth-inherit-source` ("Inherited from folder X" or "from collection Y") with a link that opens that source. It is wired through `AuthInheritContext`.

## D. Housekeeping and backend updates
- **Routes:** `routes.tsx` is now 15 lines, assembling `routes/public-routes.tsx`, `routes/app-routes.tsx`, `routes/workspace-routes.tsx` and `routes/lazy-page.tsx`. Route matching is ranked, so moving the workspace routes to the end of the list changes nothing; the routes and prerender tests pass.
- **Adopted from the backend:**
  - `role` on CollectionSummary and CollectionDetail drives per-collection permissions: sidebar menus, page read-only mode and the request Save button.
  - Moving or deleting a collection also requires Admin or Editor in the workspace; duplicating it requires `addElements`.
  - Trash rows show `requestCount`.
  - The restore modal maps `TEAM_TO_PERSONAL` and `FORBIDDEN` (tested).
- **Files that crossed 200 lines were split:** `workbench-types` into `workbench-tab-types`, the reducer into `workbench-action`, the context into `workbench-api`, `draft-compare`, auth into `auth-form` and `auth-form-parts`, and draft sync into `use-binding-writes`.

## Verification
- `tsc --noEmit` on the web app: clean.
- `biome check` on all 126 changed or new web files: clean.
- `check:i18n`: OK.
- `check:tokens`: OK.
- No touched file is over 200 lines.
- New tests, all passing:

  | File | Tests |
  |---|---|
  | `send-context.test.ts` | 3 |
  | `workbench-pages.test.ts` | 4 |
  | `collection-page.test.tsx` | 5 |
  | `bound-request.test.tsx` | 5 |
  | `collection-helpers.test.ts` | 4 |
  | `trash-restore-errors.test.tsx` | 2 |
  | `collections-menus.test.tsx` (new share-upgrade case) | +1 |

- Targeted run of collections, api-client, the api-client pages, i18n, routes, prerender, sharing and workspaces: 77 files, 417 tests, all passing.

## Concerns
- Pages are not restored after a reload, because the drafts API stores requests only.
- The page "…" menu has Copy link and Export only. Rename, delete and the other actions stay in the sidebar.
- "Created by" shows "You" or "A workspace member", because the collection only carries the creator's `sub`. Showing a name needs an API field.
- Scripts cannot read collection variables through `lm.variables` (see the precedence note above).
- Save-to-collection lists the current workspace's collections only.

---

# Round 3: code review fixes, server duplicate and server search

Status: DONE_WITH_CONCERNS. Nothing committed.

## Medium findings
- **M1, a Viewer pressing Ctrl/Cmd+S on a bound request:** the workbench save handler reads the collection's `role` from the query cache (`collectionKey`). When the role is not `editor` (or the collection is not cached yet), it returns `false` and the layout falls back to `saveDrafts()`: no PATCH and no 403 toast. The Save button stays hidden for Viewers.
- **M2, saving a clean tab undid a sidebar rename:**
  - `name` goes in the PATCH only when `draft.name !== saved.name`.
  - A request renamed in the tree updates the open tabs bound to it, both draft and saved, when the tab had not renamed the request itself (`use-rename-sync.ts`).
  - L12 is fixed the same way: renaming a collection or folder in the tree relabels its open page tab.
- **M3, bound requests whose collection cannot be read:**
  - `SendContextOf` now returns `{ context } | { unavailable }`. A collection that is trashed, forbidden or offline, or a request no longer in it, stops the send with `COLLECTION_UNAVAILABLE` and a translated message. It is never sent silently as a loose request.
  - `InheritSourceNote` shows an error state ("We couldn't read its collection: …") or a "no longer in its collection" state instead of loading forever.
  - The collections test harness now wires `sendContext` like `ApiClientPage` does.
- **M4, page autosave races:** saves run one after another on a single promise chain, each taking what is queued when its turn comes. Answers therefore arrive and are cached in order. A failed save re-queues its edits under any newer ones.

## Server endpoints (backend landed)
- **M5:** duplicating a folder or request is one call, `POST …/nodes/:nodeId/duplicate`, and the returned nodes are appended to the cached collection. The client-side copy (`node-copy.ts`) is deleted. `COLLECTION_TOO_LARGE` is mapped to an error message.
- **M6:** the sidebar search uses `GET /workspaces/:id/collections/search`.
  - The search text is debounced (250 ms) in the sidebar, and React Query aborts the request of a superseded query.
  - Results show as a flat list: icon or method, the name with the match highlighted, and the path "Collection / Folder".
  - Arrow keys, Home and End move between results; there is a truncation note and a no-match message.
  - Opening a result opens its node; a request result reads its collection first.
  - The per-collection detail fan-out and the client-side tree filtering are removed.

## Low findings
- **L7:** the keepalive flush sends the pending unbind (`binding.peek` and `binding.write`).
- **L8:** draft JSON is cached in a `WeakMap`, so the saved draft is serialized once instead of on every keystroke.
- **L9:** a request tab allows one save at a time; a second Ctrl+S during a save is ignored, so an older draft is never marked saved.
- **L11:** the delete dialog asks the server for the counts (`DELETE ?dryRun=true`) before deciding whether the word `delete` is needed. The button stays disabled until the answer arrives.
- **L13:** a one-line comment says history records the tab's draft as typed, so inherited credentials never go into history.
- **L14:** the inherit note sentence uses a `<link>{name}</link>` placeholder through `renderRich`.
- **L10:** unchanged, as decided.

## Verification
- `tsc --noEmit` on the web app: clean.
- `biome check` on the 134 changed or new web files: clean.
- `check:i18n`: OK.
- `check:tokens`: OK.
- No touched file is over 200 lines.
- New or changed tests:
  - `bound-request-guards.test.tsx` (5): Viewer Ctrl+S, single save while a save is in flight, sidebar rename followed, folder tab relabelled, unavailable collection.
  - `use-page-autosave.test.tsx` (2).
  - `use-binding-writes.test.ts` (3).
  - `collection-search.test.tsx` (3).
  - `collections-menus.test.tsx`: a dry-run case and a server duplicate case.
  - `bound-request.test.tsx`: the PATCH carries no name when the tab did not rename the request.
  - Tree tests: client search cases removed.
- Targeted run of collections, api-client, api-client pages, i18n, routes, prerender, sharing and workspaces: 81 files, 430 tests, all passing.

## Concerns
- With M1 as specified, Ctrl/Cmd+S on a bound request does nothing more than save the draft until the collection is in the cache. The cache normally fills as soon as the tab opens, because the breadcrumb reads it.
- A search result opens its node but does not reveal it in the tree; the tree is hidden while a search is active.
