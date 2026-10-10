# Phase 11 T3: workspaces module

Status: DONE_WITH_CONCERNS. The workspaces API is complete: 12 MCP tools plus 2 browser-only operations in toolset `sharing`, with 39 integration tests passing.

## Deviations from the brief
- Preview and accept are `POST /workspace-invites/preview` and `POST /workspace-invites/accept`, with `{token}` in the body. The brief asked for `GET /workspace-invites/:token` and `POST .../:token/accept`. I followed the existing project-invite pattern, which keeps tokens out of URLs so nginx access logs never record them.
- Preview and accept are `mcp: { exempt }`, with the same "browser only" reason as `mock.previewInvite` and `mock.acceptInvite`.
- Invite links point to `/workspace-invite/:token`. The web page for this route (T7) does not exist yet.

## Follow-ups (outside my files)
- `docs/operation-registry.md` should list the two new exempt operations.
- Phase 12: `sharing.deleteWorkspace` only removes the workspace and its member rows. When workspaces gain elements, it needs to cascade to them and should get `requiresConfirmation`.
- An owner who leaves their team workspace still counts it toward their own `teamWorkspaces` limit, and their plan still sets its seat count.

## Review fixes (H3, M1, L2)
- **H3:** When another account verifies an email (`email.reclaimed`), `forgetReclaimedEmail` in `audit/audit-event-handlers.ts` now also unbinds pending workspace invitations that were bound to the account through that email. It removes `userId` and nothing else, the same way it already treats project invitations. Invitations bound by username and accepted memberships keep `userId`. The new test is in `audit/audit-email-reclaimed.test.ts`.
- **M1:** `workspace-ownership.ts` now documents that the hand-over happens even when it puts the heir over their `teamWorkspaces` limit; the heir is then only blocked from creating new team workspaces. The new test is `workspace-ownership.test.ts`. A Free heir who already owns a team workspace receives a second one; their next create returns `PLAN_LIMIT_REACHED` (teamWorkspaces, max 1, used 2). Seats then follow the heir's plan: the 4 existing members stay (seats `{used: 4, max: 3}`) and a new invitation returns `PLAN_LIMIT_REACHED` (members).
- **L2:** The workspace invitation service now uses `displayNameOf` from `access/display-name.ts` instead of its own copy.
- **Verification:** the workspaces and audit tests pass (7 files, 61 tests), and `tsc` and `biome check apps/api/src` are clean.
