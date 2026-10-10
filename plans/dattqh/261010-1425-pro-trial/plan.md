---
title: "Pro as a 30-day trial instead of a paid plan"
status: completed
created: 2026-10-10
tier: L
---

# Pro as a 30-day trial instead of a paid plan

## Outcome
No billing yet: the owner does not want to charge before Vietnamese tax rules are clear. Pro is offered as a 30-day trial that any user can start once. While the trial runs, and whenever it is extended, the user is Pro. When it ends, the user is Free again.

## Context
- User request (2026-10-10): "phần charge gói Pro hãy xử lý lại việc người dùng có thể sử dụng trial gói Pro với thời gian 30 ngày. Trong thời gian đó nếu được gia hạn thì vẫn giữ gói pro, hết hạn trial thì chuyển gói free".
- Today:
  - Users have `plan` (free|pro) and `planExpiresAt`, and `effectivePlan` already treats an expired Pro as Free.
  - Pro is granted only by the `set-user-plan` CLI.
  - The pricing page offers a "Contact" interest form.
  - Limits are checked only when creating.

## Decisions (Jev, 2026-10-10)
| Question | Choice | p |
|---|---|---|
| How the trial starts | "Start 30-day Pro trial" button (pricing, plan dialog, account page), once per account, new and existing users | 0.88 |
| Extension | User asks from the account page (short reason); the owner gets it on an admin page and on Telegram, then extends by 30 days in one click or declines. The owner can also extend anyone directly | 0.57 (owner only 0.42) |
| After the trial | Keep every project, resource and record working; block only creating more until under the Free limits; show which limits are exceeded | 0.99 |
| Reminders | 7 days and 1 day before the end, and on the end day (in-app, Web Push/Telegram per settings); countdown on the account page | 0.81 |
| Pricing copy | Pro shows "Free 30-day trial" + button + "paid plans are not available yet"; no price; the interest form stays as a secondary link | 0.99 |

## API contract (backend and web work in parallel on it)
- **`GET /api/v1/me`** adds `trial`:
  - `status: "available" | "active" | "ended"`
  - `startedAt: string | null`
  - `endsAt: string | null` (the end of the Saigon day, 30 days after the start)
  - `extensionRequest: { status: "pending" | "approved" | "declined", requestedAt: string, decidedAt: string | null } | null`
- **`POST /api/v1/me/trial`** starts the trial:
  - Sets `plan: "pro"` and `planExpiresAt` = end of the Saigon day 30 days after the start.
  - Returns the `me` shape.
  - Errors:
    - 409 `TRIAL_ALREADY_USED` when a trial was ever started.
    - 409 `ALREADY_PRO` when the effective plan is already Pro without a trial (an admin grant).
- **`POST /api/v1/me/trial/extension`** `{ reason: string (1–500) }` asks for an extension:
  - Only while the trial is active or within 7 days after its end.
  - At most one pending request.
  - Errors:
    - 409 `EXTENSION_PENDING`
    - 409 `TRIAL_NOT_EXTENDABLE`
- **Admin (owner role, same guard as the existing admin pages)**:
  - `GET /api/v1/admin/trial-extensions?status=pending|all&cursor`: `{ items: [{ id, user: { sub, username, name }, reason, requestedAt, status, trialEndsAt }], nextCursor }`.
  - `POST /api/v1/admin/trial-extensions/:id/approve`: `planExpiresAt` = max(now, current end) + 30 days, at the end of the Saigon day.
  - `POST /api/v1/admin/trial-extensions/:id/decline`.
  - `POST /api/v1/admin/users/:sub/extend-trial` `{ days: 1..90 }`: direct extension.
- **Usage**: `GET` account usage adds `overLimits: [{ limit: "projects" | "resources", used, max }]` for the effective plan.
- **MCP**: all trial and extension operations are MCP-exempt ("plan decisions are made in the UI").
- **Notification events**:
  - `trial.ending` (7 days and 1 day before the end)
  - `trial.ended`
  - `trial.extension.requested` (to the owner)
  - `trial.extension.approved`
  - `trial.extension.declined`

## Non-goals
- Payments, invoices, taxes, price display.
- Deleting or pausing data after a trial.

## Acceptance
- [x] A Free user starts the trial once and becomes Pro until the end of the Saigon day 30 days later. Starting a second trial is refused.
- [x] Approving an extension or extending directly keeps the user Pro. When `planExpiresAt` passes, the user counts as Free everywhere.
- [x] Reminders are sent once each at 7 days and 1 day before the end and on the end day. The owner is told about each new extension request.
- [x] After the trial, nothing is deleted. Creating above the Free limits is refused with the existing `PLAN_LIMIT_REACHED`, and the UI lists the exceeded limits.
- [x] The pricing page, plan dialog and account page show the trial (no price). The admin page lists requests and approves or declines them.
- [x] `pnpm lint && pnpm typecheck && pnpm test && pnpm e2e && pnpm check:mcp-coverage` clean (3826 unit, e2e 31/31); deployed release `20261010-081815-46a686b6cd6b` (backup `localman-20261010-151815` first). The release also carries the phase 11 backend (UI hidden behind `workspaces`); the owner approved deploying the whole HEAD. Live: 6 trial routes in OpenAPI, /pricing shows the 30-day trial, starting a trial needs a session (401).

## Implementation notes
- Routes live under `/api/v1/users/me/trial` and `/api/v1/users/me/trial/extension` (the real "me" route), admin routes as planned.
- Extra error codes: `EXTENSION_DECIDED`, `PLAN_HAS_NO_EXPIRY` (an unlimited Pro is never shortened), 429 `RATE_LIMITED` (5 extension requests a day).
- The reminder job reserves each milestone in `trialNotices.<milestone> = endsAt` before sending, so each is sent once per end date and again after an extension.
- The partial index `planExpiresAt_1` (filter `trialStartedAt` exists) already reached production with release `20261010-072644-ff2bb02b0a53-dirty`; its auto name is kept.
