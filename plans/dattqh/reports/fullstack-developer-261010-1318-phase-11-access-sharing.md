# Phase 11: access policy, sharing, access requests, move (T2, T4, T5, T6)

Status: done with one concern (status code of access requests, see below).

## Operations (toolset `sharing`, all `mcp: true`, `scopes: [user]`)
| Id | Route |
|---|---|
| `sharing.getElement` | `GET /elements/:elementType/:elementId` |
| `sharing.getElementAccess` | `GET /elements/:elementType/:elementId/access` |
| `sharing.moveElement` | `POST /elements/:elementType/:elementId/move` |
| `sharing.shareElement` | `POST /elements/:elementType/:elementId/shares` |
| `sharing.updateElementShare` | `PATCH /elements/:elementType/:elementId/shares/:shareId` |
| `sharing.removeElementShare` | `DELETE /elements/:elementType/:elementId/shares/:shareId` (dryRun) |
| `sharing.requestElementAccess` | `POST /elements/:elementType/:elementId/access-requests` |
| `sharing.getAccessRequest` | `GET /access-requests/:requestId` |
| `sharing.approveAccessRequest` | `POST /access-requests/:requestId/approve` |
| `sharing.denyAccessRequest` | `POST /access-requests/:requestId/deny` |

`notifications.listNotifications` and `markNotificationRead` items now carry `accessRequest: {id, status} | null`. This takes two batched queries per page.

## Decisions
- `POST …/shares` only raises an existing share and never lowers it. Lowering a role goes through `PATCH`, which sets the role exactly.
- Approving a request also refuses elements in a personal workspace (409 `PERSONAL_WORKSPACE`). Requests on personal-workspace elements answer `sent` and store nothing.
- Access requests are rate limited to 20 per account per hour (429 `RATE_LIMITED`), counted before any lookup, so the limit reveals nothing about which elements exist.
- Email shares are shown only to callers with `manageRoles`. They are claimed lazily inside `elementRoleOf`, and only by an IdP-verified email (`addresseeProblem`).
- Notification links: `/elements/:type/:id` (shared, resolved) and `/access-requests/:id` (requested). The web (T8) should route these.

## Follow-up (coordinator decisions)
- `requestElementAccess` keeps answering 200 `{status:"sent"}`; `packages/operations` is unchanged.
- If a pending Viewer request exists and the same person asks to edit, the request is upgraded to editor (and its message replaced when a new one is given), and the Editors are notified again. A repeat with the same or a weaker role changes nothing. The upgrade filters on `role: "viewer"`, so of two concurrent upgrades only one sends notifications. Tested in `access-request-operations.test.ts`; the approve and deny tests moved to `access-request-resolution.test.ts`.

## Review fixes
- H1: approve now takes `{ role }`, the role the approver saw. The update filters `{ _id, status: "pending", role }`. If the request was upgraded since, approve answers 409 `REQUEST_CHANGED`; if it was already resolved, 409 `ALREADY_RESOLVED`. Notification items carry `accessRequest: { id, status, role }`.
- H2: move checks the caller's role in the source workspace (`moveDeleteElements`, so Admin or Editor) as well as `addElements` in the target. A share alone, even Editor, gets 403. Callers with no role on the element still get 404.
- H3: when the share target was typed as an email, the share binds to the matching account only if the IdP verified that email. Otherwise it is stored as `{ email }` and only a verified owner of the address can claim it. A username binds directly.
- M2: `elementRoleOf` names the element inside each `$or` branch. Added the index `{ elementType, elementId, createdAt }`. Dropped the global `email_1` index; production keeps the old index until it is dropped by hand.
- M4: an element whose workspace no longer exists cannot be shared, approved or moved: 409 `WORKSPACE_MISSING`. Only people it is shared with reach that check; everyone else gets 404 first. Access requests for such elements store nothing.
- L1: an account share and a claimable verified-email share are merged into one, keeping the stronger role.
- New and split files: `share-management.ts` (update and remove), `move-operations.test.ts`, `share-restrictions.test.ts`.

## Concern (resolved: keep 200)
- `successStatus` in `@localman/operations` allows only 200/201, so `requestElementAccess` answers **200** `{status:"sent"}`, not 202. Supporting 202 means adding it to `SUCCESS_STATUSES` (packages/operations, which I do not own).

## Verification
- `packages/shared/src/access-permissions.test.ts`: 128 tests (a literal Postman matrix, checked against learning.postman.com).
- API: access 35 tests and notification-operations 5 tests, all passing. Regression on projects and collaborators: 19 files, 86 tests, all passing.
- `tsc --noEmit` exit 0; `biome check apps/api/src packages/shared/src` clean (743 files); `check:mcp-coverage` OK (117 ops, 90 tools).
