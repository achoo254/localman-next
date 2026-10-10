# Phase 11 T7: web UI for workspaces

Status: DONE. Sections 1–3 of `ui-phase-11-workspaces-sharing-spec.md` are built behind the `workspaces` flag: the header switcher, `/workspace/settings` (General and Members), and `/workspace-invite/:token`. Sections 4–7 (share dialog, request access, notification approve/deny) are not started.

## What was built
- `apps/web/src/features/workspaces/` contains the API clients with json-guards, the current-workspace store (localStorage behind try/catch, falls back to personal, rewrites a stale choice), the switcher, the create modal, the General and Members panes, the invite form, member and invitation rows, the permissions table (read from `WORKSPACE_PERMISSIONS`), leave and delete with `ConfirmModal`, and the invite accept page.
- Routes: `/workspace/settings` sits under `AppShell`. `/workspace-invite/:token` is public under `AppLayout`, like `/invite/:token`. Both are lazy and redirect to `/api-client` while the flag is off.
- The switcher sits after the product nav in `AppHeader` and shows only on `/api-client` and `/workspace/*`.
- The `workspaces` i18n namespace exists in en, vi and zh-CN. Generic invite strings are reused from `invite.*`.

## Deviations
- `lib/api-client.ts` now lists `PATCH` in `HttpMethod`, because the workspace API uses PATCH for edits and role changes. It is a one-word change outside `features/workspaces`.
- The API does not send the owner's plan. The seats line and the "Requires Pro" card infer it by matching `seats.max` against `limitsFor(plan).membersPerWorkspace`. When no plan matches, the plan label is left out.
- Plan-limit cards link to `/pricing` as the spec asks. They do not open `ManageSubscriptionModal`, whose `LimitReason` has no `teamWorkspaces` case.
- Workspace invites go out in one step. Unlike the collaborators flow, there is no lookup first, because the workspace API has no lookup endpoint.

## Verification
- `vitest` (targeted): 7 files and 52 tests pass. That covers the 5 new workspace test files plus `app-header.test.tsx` and `dictionaries.test.ts`.
- `tsc --noEmit` exits 0. `biome check apps/web/src` reports no diagnostics. `check:i18n`, `check:tokens` and `check:mcp-coverage` all exit 0.

## Follow-ups
- The checkbox "T7 UI workspace xong" in the plan is left for the orchestrator to tick.
- I did not add docs. `docs/system-architecture.md` may need a line about the client-side current workspace once phase 12 starts reading it.

# Phase 11 T8: web UI for sharing and access requests

Status: DONE. Sections 4–7 of the UI spec are built behind the `workspaces` flag.

## What was built
- **`apps/web/src/features/sharing/`**
  - API clients for elements, shares and access requests, all parsed with json-guards.
  - `ShareDialog`, exported only. Phase 12 mounts it; until then only tests cover it.
    - Collections get a People tab and a Link tab. Environments get People only.
    - People holds the share form, with an environment select that stays hidden while `environments` is empty, and the Manage access list (role select and remove).
    - An item in a personal workspace gets the `PERSONAL_WORKSPACE` alert and its controls are locked. The dialog is read-only without `manageRoles`, checked with `elementRoleAllows` against the role in the item summary.
  - `/elements/:type/:id`: shows the item's name and the caller's role. A 404 shows `RequestAccessForm`: Viewer or Editor radio cards, `?role=editor` preselects Editor, a message of up to 500 characters, a sent state, and an `ALREADY_HAS_ACCESS` notice.
  - `/access-requests/:requestId`: shows the requester, the item, the message and the status, with Approve (sends `{ role }`) and Deny. A 404 shows "not available".
  - `useResolveAccessRequest` is shared by that page and the bell. A 403, 404 or 409 (`REQUEST_CHANGED`, `ALREADY_RESOLVED`, …) shows a toast and reloads.
- **`apps/web/src/features/notifications/`**
  - Items now carry `accessRequest`.
  - A pending `access.requested` item gets Approve (primary, sm) and Deny (secondary, sm). They are Radix menu items, so arrow keys reach them and choosing one keeps the menu open. A handled request shows an "Approved" or "Declined" badge.
  - The four new event types have labels, and their preference rows are hidden while the flag is off.
- Both new routes are lazy, sit under `AppShell`, and redirect to `/api-client` while the flag is off.
- The `sharing` i18n namespace exists in en, vi and zh-CN, plus 4 event labels in `notifications`.

## Deviations
- `test/fixtures.ts`: `makeNotification` now sets `accessRequest: null`, because the field is required on `AppNotification`.
- The API answers `POST …/shares` with Manage access rather than a lookup result. So `share-people-match` is a live region that confirms the result ("Shared with … as …"), not a lookup preview.

## Verification
- Targeted `vitest --maxWorkers=2`:
  - `features/{workspaces,sharing,notifications}`, `components/layout`, `dictionaries` and `account-loading`: 23 files, 135 tests passing.
  - `routes` and `api-client/routing`: 12 files, 90 tests passing.
- `tsc` exits 0. `biome check apps/web/src` has no diagnostics. `check:i18n` and `check:tokens` exit 0.

# Review fixes (H1, H2, M1, M2, L1–L7)

Status: DONE_WITH_CONCERNS. One API test owned by the other session (`notification-operations.test.ts`) needs a matching update. See Concern below.

- **H1:** notification items now carry `accessRequest.notifiedRole`, read from the notification's `params.role`. The change is in `apps/api/src/modules/access/notification-access-requests.ts` (zod and data) and the description in `notification-operations.ts`.
  - The bell approves with `notifiedRole` and labels the button "Approve as Viewer/Editor".
  - On `REQUEST_CHANGED` the bell shows "The request changed. Open the newer notification." and reloads. That uses a full stop instead of the dash in the review text, because `docs/ux-writing.md` bans dashes.
  - `/access-requests/:id` still sends the role it displays.
- **H2:** the fallback workspace is never saved, because `resolveCurrent` falls back on read. Before navigating, the invite page awaits `fetchQuery({ queryKey: WORKSPACES_KEY, staleTime: 0 })`.
  - A regression test mounts the real switcher on `/api-client` with a stale cached list. With the `fetchQuery` removed, the test fails.
- **M1:** after Approve or Deny, focus moves to the notification item before the buttons give way to the badge.
- **M2:** the four sharing types are filtered out of the bell while the flag is off. The set is shared with the preferences table in `workspace-event-types.ts`.
- **L1:** the saved choice is keyed per account, `localman-workspace:<sub>`, through `useSelectWorkspace()`.
- **L2:**
  - The heading of the sent state receives focus.
  - `ALREADY_HAS_ACCESS` invalidates the item query, so the page shows the item.
- **L3:** `components/ui/dropdown-menu.tsx` now exports `DropdownMenuGroup` and `DropdownMenuControlItem`. The bell uses them instead of importing Radix directly.
- **L4:** `useId` replaces the hard-coded heading ids in Manage access and the workspace member list.
- **L5:** an email share without an account is labelled "Someone invited by email" when the address is hidden.
- **L6:** `useWorkspacesEnabled()` (`workspaces && apiClient`) gates every workspace, sharing and notification surface.
- **L7:** when the item's workspace is gone, the share form is locked and shows the `WORKSPACE_MISSING` message.

## Verification
- Web `vitest --maxWorkers=2` (`features/workspaces`, `features/sharing`, `features/notifications`, `components/layout`, `dictionaries`): 25 files, 137 tests passing.
- API `vitest` on `modules/access`: 7 files passing. `notification-operations.test.ts` fails 1 test, as expected; see the concern.
- Web and API `tsc` both exit 0.
- `biome check` on my 67 changed files reports no diagnostics. `check:i18n` and `check:tokens` exit 0.

## Concern
`apps/api/src/modules/notifications/notification-operations.test.ts`, owned by the other session, compares `accessRequest` with strict `toEqual({ id, status, role })` at about lines 120 and 131. Each of those objects needs `notifiedRole: "editor"`. I left the file alone as instructed.
