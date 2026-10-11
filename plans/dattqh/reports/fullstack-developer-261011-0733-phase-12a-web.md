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

---

# Round 4: phase 12 slice B web (UI spec 12b, sections 1–8)

Status: DONE_WITH_CONCERNS. Nothing committed.

## Contract and import warnings
- **Parsers:**
  - Summaries, details and trash entries now read `tags` and `status` (the status through the shared `collectionStatusSchema`).
  - Details also read `createdByName`, `updatedBy` and `updatedByName`.
  - Example nodes are parsed.
  - The trash list reads `{ items, deleters }`.
- **Moved files:** the node calls moved to `nodes-api.ts`; trashing a collection and its dry run moved to `trash-api.ts`.
- **Import warnings (`importWarningText`):** three new cases in en, vi and zh-CN.
  - `EXAMPLE_BODY_TRUNCATED`: generic text, without a size.
  - `INVALID_METADATA` ({field}).
  - `TEXT_TRUNCATED` ({max}).
- **Example bodies:** cut client-side to `EXAMPLE_BODY_MAX` UTF-8 bytes on a code-point boundary (`example-body.ts`). The example editor checks that the status is between 100 and 599.
- **New tag and status problems:** `characters` and `name-characters` each have a message.

## 1. Right rail and panels
- `right-rail-info` and `right-rail-changelog` appear for an active collection, folder or example tab, or a request tab bound to a collection. Each opens `right-panel-<k>` (340px wide) with `right-panel-close`; clicking the open one closes it.
- Below 768px the panel is a right-side drawer over a backdrop. Escape closes it.
- **Info panel:** the ID with a copy button, then the shared `CollectionMeta`: creator, "Last updated <time> by <name>", workspace, request count.

## 2. Changelog
- **Sessions and pages:** each session (`changelog-session`) shows the author, the time and "N changes". "Load older" pages through `before`. There are skeleton, empty and error states.
- **Each change (`changelog-change`):**
  - A one-line description (pure `describe-change.ts`).
  - `changelog-view-diff` opens a line diff of the formatted JSON (pure LCS in `line-diff.ts`, `diff-view.tsx`).
  - For a restore change, the diff also lists the `affected` nodes.
  - `changelog-hide-diff` / `changelog-show-diff` are for Editors only. The hide button's tooltip says it hides the diff without removing data; a hidden diff reads "Diff hidden by an editor".
  - `changelog-restore` (Editors only) runs the restore dry run first. The confirm dialog warns when `irreversible` is true and reports 409 `REVISION_UNAVAILABLE` clearly.
- **After a restore:** the collection is refreshed from `body.collection`, along with the changelog, the activity and the lists. Open bound tabs take the stored request; a tab with unsaved edits keeps them.

## 3. Status and tags
- **Status:** `collection-header-status` opens `status-menu`: 4 presets with a check on the current one, "Custom status…" and "Remove status".
  - `modal-custom-status` has a name field and a curated emoji grid, plus a free-text emoji field. It validates with `validateStatus`.
  - A Viewer only sees the status.
- **Tags:** the `collection-tags` block shows "Tags n/10" with removable chips, an Enter-to-add input and an add button.
  - Rule problems from `normalizeTags` show under the input as an alert.
  - Collection rows in the sidebar show their tags in the tooltip.

## 4. Examples
- **In the tree:** examples are shown under their request with a bookmark icon and "200 · name". They are not draggable and nothing can be dropped among them. Their menu has Rename, Duplicate and Delete.
- **Creating one:** the request menu has "Add example" (blank response, the request as saved). `response-save-example` on the response panel of a bound tab saves "<status> <statusText>" from the received response. It is hidden for Viewers.
- **The editor (`example-editor`):** name, read-only method and URL, status (100–599), status text, body language, the headers table, and a CodeEditor body in that language.
  - It has `example-duplicate` and `example-save` and a note about examples.
  - It saves automatically and on Ctrl/Cmd+S, and is read-only for a Viewer.
  - A body over the limit is cut before saving, with a toast.

## 5. Multi-select and bulk delete
- **Selecting:** Ctrl/Cmd-click toggles a row, Shift-click adds a range in tree order. Picked rows get the viz-blue tint and a left bar. Escape clears the selection. A Viewer's modified click opens the row instead of selecting.
- **`sidebar-bulk-bar`:** "N selected" with clear and delete buttons.
- **The dialog:**
  - It first runs dry runs: `bulk-trash` for picked collections (the request count decides whether `delete` must be typed) and `bulk-delete` per collection (for the irreversible warning).
  - Picked collections are trashed in one call; picked nodes are deleted with one call per collection.
  - A node whose collection is also picked goes with its collection.
  - If a call fails, the dialog shows "Deleted X of Y items" with the reason.

## 6. Trash filters
- `trash-filters` holds `trash-filter-workspace` and `trash-filter-deleted-by` (the `deleters` from the API), plus the server-side `q` search, debounced 300 ms.
- The filters live in the URL query (`?workspace=&by=&q=`), so a filtered view can be reloaded or shared.
- A filtered list that matches nothing shows its own message, not the empty-trash state.

## 7. Recent activity and creator names
- Overview shows "Created by <name>" and "Last updated <time> by <name>".
- `collection-activity` lists the last 5 changes, with a link that opens the changelog panel (through `RightPanelContext`).

## Also built
- **Node delete:** the dialog runs the dry run and shows the irreversible warning. The examples wording is included.
- **Tabs after a reload:** collection, folder and example tabs are restored without any API change. They are stored in localStorage per account (`localman-pages:<sub>`, read and written in try/catch) and come back through a new `restorePages` workbench action. A page whose item is gone shows its "no longer exists" state.

## Verification
- `tsc --noEmit` on the web app: 0 errors. (While the backend agent was mid-edit, `packages/shared` briefly had its own errors; they cleared by the end.)
- `biome check` on all 160 changed or new web files: clean.
- `check:i18n`: OK.
- `check:tokens`: OK.
- No touched file is over 200 lines.
- New tests (about 32):

  | File | Tests |
  |---|---|
  | `changelog-helpers.test.ts` (diff, change wording) | 3 |
  | `example-helpers.test.ts` (byte cut, response mapping, status range, bulk plan) | 5 |
  | `collection-status-tags.test.tsx` | 4 |
  | `changelog-panel.test.tsx` (list, older, diff, hide, Info and activity) | 3 |
  | `changelog-restore.test.tsx` (irreversible and 409, restore, affected) | 3 |
  | `collection-examples.test.tsx` | 4 |
  | `bulk-delete.test.tsx` | 4 |
  | `trash-filters.test.tsx` | 3 |
  | `page-persistence.test.tsx` (including flag off) | 3 |

- Existing tests were updated for the new menus and trash search.
- Targeted run of collections, api-client, api-client pages, i18n, routes, prerender, sharing and workspaces: 89 files, 459 tests, all passing.

## Concerns
- Examples always show under their request; requests do not fold their examples away.
- The changelog panel refetches when opened, but does not live-update while open after edits made elsewhere.
- Restored page tabs are per browser, not per account across devices.
- I ran `biome --write` once on `apps/web/src/features/api-client/workbench` (a directory). `git status` shows it changed only files this round already touched.

---

# Round 5: slice B review fixes

Status: DONE. Every item, M1 to M5 and L1 to L8, is implemented and tested. `apps/api` and `packages/*` are untouched, and nothing is committed.

## Main fixes
- **M1 Bulk delete in chunks.** `bulk-run.ts` holds `BULK_NODES_MAX = 200` and `BULK_TRASH_MAX = 100`. Both the dry runs (`previewBulk`) and the real calls (`runBulk`) go out in chunks, one after another. A failing chunk throws `BulkStopped(done)`, and the modal reports the partial result. The dry runs stop asking once one chunk is irreversible. New test `bulk-run.test.ts` covers 201 collections plus 201 nodes (chunk sizes 100/100/1 and 200/1), a stop at the second chunk, and `chunk()` itself.
- **M2 Range picks follow permissions.** `useTreeSelection(rows, canPick)` filters both toggles and ranges. `useTreePermissions().canPick` allows a node when the caller can edit its collection, and a collection row only when they can edit it and also manage the workspace.
- **M3 Trash URL filters are checked.** `useDropUnknownFilters` in `use-trash-filters.ts` drops a `workspace=` value that is not in the workspace list. It drops a `by=` value that is not among `deleters`, but only once the workspace is known to be valid and the data is not placeholder data. The drop is silent and replaces the history entry. The search box follows `q` on back and forward, because a `written` ref tells the hook's own URL writes apart from navigation.
- **M4 Line diff.** `diffLines` sets aside the shared prefix and suffix before the LCS, and the fallback only applies to the middle part. `collapseDiff(lines, 3)` runs in linear time and folds unchanged runs into "Show N unchanged lines" buttons. `DiffView` draws at most 2000 lines, with "Show N more lines" for the rest. Focus moves to the diff region when a fold button disappears. Line rendering moved to a new file, `diff-line-row.tsx`. Tests are in `line-diff.test.ts` (trimming, the fallback at 2100×2100, folding) and `diff-view.test.tsx` (unfolding, the 2000-line cap with Show more, no change).
- **M5 Accessibility.**
  - Right drawer, in `use-drawer-focus.ts`. Below `md` (`(max-width: 47.99rem)`) the close button takes focus on open, Escape closes the drawer from anywhere on the document, and focus returns to the opener. Escapes that Radix already handled are skipped (`defaultPrevented`). On wide screens focus stays where it is and only comes back if it was inside the panel. Tested in `right-rail.test.tsx`.
  - Multi-select. Ctrl/Cmd+Space toggles a row and Shift+↑/↓ extends the selection (both in `tree-keys.ts`). The tree gets `aria-multiselectable` when picking is allowed, picked rows get `aria-selected`, and the row of the open tab gets `aria-current="page"`. Tested in `tree-selection.test.tsx`.
  - **Deviation:** plain Space still starts the keyboard drag of the dnd tree, so toggling needs Ctrl/Cmd+Space.

## Lows
- **L1:** `RightRail` is wrapped in `memo`, and the right-panel context value is created with `useMemo`.
- **L2:** the example status box picks up a status stored elsewhere unless the user is typing in it. Tested in `example-response-form.test.tsx`.
- **L3:** a `done` `TabResponse` now carries `draft?`, which is the draft as it was sent (set in `use-send-tab.ts`). "Save as example" saves that draft, so the request matches the response. The example test edits the URL after sending and checks that the sent URL is saved.
- **L4:** page persistence only writes after the restore has run, using a `restored` state rather than a ref. Pages are restored once the drafts restore has finished (`syncStatus` is no longer `loading`). Storage helpers moved to `page-storage.ts`. `useLogout` calls `forgetSavedPages()` before posting the logout form, which removes every `localman-pages:*` key. A small edit to `features/auth/use-logout.tsx` was needed for this.
- **L5:** the page save registry now holds `{collectionId, flush, discard}` for each page, and `usePageAutosave` gained `discard()`. After a changelog restore, any unsaved edits on open pages of that collection are dropped, and the toast says so (`collections.changelog.editsDiscarded`). The test holds a PATCH in flight, restores, and checks that no PATCH is sent after the restore and the restored name shows.
- **L6:** a page tab is active after a reload only when no request tab is. This works because pages are restored after the drafts, and `restorePages` only sets the active tab when there is none. Covered by a reducer test and a page-persistence UI test.
- **L7:** `INVALID_METADATA` is now worded per field and per locale (`.tags` / `.status`): "The collection's tags weren't valid and were skipped." and "The collection's status wasn't valid and was skipped." Tested in `import-messages.test.ts` for en, vi and zh-CN.
- **L8:**
  - The status presets are `menuitemradio` items in a `DropdownMenuRadioGroup` with `aria-checked`, and the unused `status.current` key was removed.
  - Avatar initials now come from `lib/initial.ts` (`Intl.Segmenter`).
  - The dry-run queries (`useIrreversible` and the delete-collection preview) set `refetchOnWindowFocus: false`, which is tested through `focusManager`.
  - `renderWorkbenchPage` takes a `storage` option, so localStorage is seeded before render.

## Verification
- Full web suite (`vitest --maxWorkers=2`): 258 files, 1270 tests, all passing.
- `tsc --noEmit` on the web app: 0 errors.
- `biome check` on the 134 changed or new web files: clean.
- `check:i18n` and `check:tokens`: OK (exit 0).
- No touched file is over 200 lines.

## Concerns
- Plain Space starts a keyboard drag, not a toggle, as described under M5.
- L5 drops all unsaved edits of the open pages of the restored collection, not only the fields the restore changed. A save already in flight when the restore runs still lands; it was sent before the restore, so the restore wins.
- If the drafts list fails to load, saved pages still come back, because the status moves to `error`.
