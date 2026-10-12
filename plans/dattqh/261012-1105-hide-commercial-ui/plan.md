---
title: "Hide every commercial surface; Pro becomes an automatic 30-day period"
status: done
created: 2026-10-12
tier: L
---

# Hide every commercial surface; Pro becomes an automatic 30-day period

## Outcome
Localman is not commercial yet. The web app shows no pricing, plans, payment, trial self-service, "interest in Pro" form or upgrade prompt. Backend features stay. Plan changes need no user action: every account that never had a trial gets Pro for 30 days automatically, then drops to Free; extending or upgrading again is an admin decision.

## Context
- User request (2026-10-12): "Hiện tại phần bảng giá, thanh toán, vv...đang có hiển thị trên web yêu cầu gỡ bỏ sạch. Mục đích để chưa thương mại sản phẩm localman (vẫn giữ tính năng dưới BE). Thay đổi gói hiện tại cho người dùng hiện tại xử lý hoàn toàn tự động hết (vẫn để giới hạn 30 ngày - sau 30 ngày tự chuyển gói free. Nếu muốn gia hạn, nâng lại gói thì do quản trị quyết định)".
- Supersedes the self-service parts of `261010-1425-pro-trial` (start button, extension request form, pricing copy). Expiry was already automatic (`effectivePlan`, no job).

## Decisions
| Question | Choice | Who |
|---|---|---|
| Who gets the 30-day Pro automatically | Every account that never had a trial (new and existing), at its next sign-in or session refresh; running trials keep their end date | User (Jev 0.69) |
| Extension | No request form on the web; admins extend or upgrade on the admin page; pending requests stay reviewable there; backend endpoints stay | Jev 0.98 |
| Trial reminders | Still sent, neutral copy: the limits go back to the basic ones on date X; no plan, price or extension wording | Jev 0.90 |
| Limit reached | One sentence naming the limit (e.g. at most 3 projects) and suggesting to delete some or send feedback; no plan link | Jev 0.74 |
| Account page | Usage meters plus the date the extended limits end; no plan name, no "Manage plan" | User (Jev 0.55) |
| Admin downgrade of an account that never had a trial | Auto-start may grant the 30 days again; documented only (ADR-0002) | Jev 0.89 |
| `/pricing` redirect | 302, reversible | Jev 1.0 |
| Resource limit wording | Match the server: resources counted across all projects of the account; inboxes per project | Jev 0.88 |

## Scope
- API: auto-start the trial in `syncUserFromUserInfo` (sign-in and every session refresh; not on `GET /users/me`, so the hottest read route stays read-only); idempotent, ignores accounts already Pro or with a trial; neutral texts for `PLAN_LIMIT_REACHED` and trial notifications.
- Web: delete `/pricing`, landing pricing, header/footer/menu links, plan modal, trial start and extension UI, Pro interest form; replace every "See plans"/plan link with plain limit text; account page shows usage and the end date; SEO copy without plan wording.
- Infra: `/pricing` redirects to `/` (302); drop `pricing.html` from prerender and CSP.
- Keep: admin pages (trial extensions, direct extension, Pro interest history), usage meters, plan limits, all backend endpoints.

## Non-goals
- Removing plan limits or the Pro limits themselves.
- Deleting Pro interest data or backend endpoints.

## Acceptance
- No page, menu, dialog or message on the web mentions pricing, plans, Pro, trial, upgrade or payment (admin pages excepted).
- A Free account that never had a trial becomes Pro for 30 days at its next sign-in or session refresh (within one access-token lifetime of using the app), once; running trials and admin grants are untouched; after 30 days it counts as Free.
- Hitting a limit shows the limit in plain words; nothing links to plans.
- Lint, typecheck, tests, MCP coverage, E2E clean; SAST then (after a user-requested deploy) DAST.

## Progress
- Implementation done (uncommitted): API auto-start + neutral copy; web commercial surfaces removed; `/pricing` → `/` (nginx 301, SPA redirect, no `pricing.html`); docs (`system-architecture.md`, `i18n.md`, `deployment-guide.md`, `ux-writing.md`) and ADR-0002; E2E helper `e2e/support/user-plan.ts` ends the automatic Pro so the Free-limit spec still tests Free.
- Verification (2026-10-12): `pnpm lint` exit 0 (biome + check:i18n); `pnpm typecheck` exit 0; web vitest 255 files / 1232 tests pass; api vitest 213 files / 1218 tests pass; `check:mcp-coverage` and `check:tokens` exit 0; Playwright E2E 36/36 pass.
- SAST: PASS, `plans/dattqh/reports/security-261012-1205-hide-commercial-ui-sast.md`.
- Review: 2 High, 5 Medium fixed (`plans/dattqh/reports/code-reviewer-261012-1215-hide-commercial-ui.md`); commits `bc09367`, `cc2465e`, CI flake fix `61c4601` (CI green).
- Deployed 2026-10-12 at the user's request ("chờ CI xanh rồi deploy"): release `20261012-065240-61c4601aa3c8`, backup `localman-20261012-135233`.
- DAST: PASS for external and server-side checks, `plans/dattqh/reports/security-261012-1355-hide-commercial-ui-dast.md`; signed-in pages not checked on prod (no sign-in on the user's behalf).
