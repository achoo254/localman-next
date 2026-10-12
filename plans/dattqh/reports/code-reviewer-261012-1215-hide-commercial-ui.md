# Code review: hide commercial UI, automatic 30-day Pro

Date: 2026-10-12. Scope: uncommitted working tree on `main` (Tunelo paths and pnpm-lock excluded).
Plan: `plans/dattqh/261012-1105-hide-commercial-ui/plan.md`, ADR `docs/decisions/0002-no-commercial-ui-automatic-pro-period.md`.

## Scope
- 199 files, +499 / -4736 (mostly deletions of pricing, plan modal, trial UI, Pro interest form)
- Focus: `autoStartTrial` correctness/race safety, how errors propagate into sign-in, commercial copy users can still reach, dead code, lost affordances, docs accuracy, e2e helper safety
- Not re-run: lint, typecheck, unit, E2E (the lead already ran them: all green)

## Overall assessment
The core write is correct and race-safe. The web layer is clean: no page, menu or dialog left mentions plans. The acceptance criterion still fails because users can reach commercial copy served by the API: the notification settings labels and the quota-used-up notification. The new limit text also states the wrong scope for two limits.

## autoStartTrial: verified OK
- `trialStartedAt: null` matches a missing field and an explicit null, so legacy users qualify.
- `planExpiresAt: { $lte: now }` never matches null or a missing field (BSON type bracketing). Admin Pro with no expiry (set-user-plan unsets it; the test sets null) is excluded. Pro still running is excluded by `$lte`.
- A single-document conditional `updateOne` is atomic. Two sign-ins, or a sign-in racing a refresh, start the trial at most once. Racing `extendPro`: its filter `{plan, planExpiresAt: current}` misses, it re-reads and extends from the trial end. Racing `set-user-plan --plan pro`: whichever write lands second wins, and both outcomes are coherent.
- Refresh path: `SessionRefresher` wraps `afterRefresh` in `.catch` and logs (`session-refresher.ts:105`), so a failure there never breaks a refresh.

## Critical
None.

## High

### H1. The notification settings page shows "Pro trial …" labels to every user (en/vi/zh-CN)
- `apps/api/src/i18n/messages/en.ts:76-80`, `vi.ts:12-16`, `zh-cn.ts:19-23` (`eventLabels["trial.*"]`)
- Path: `preference-operations.ts:77-87` only filters `trial.extension.requested` (owner-only), so non-owners still get `trial.ending`, `trial.ended`, `trial.extension.approved` and `trial.extension.declined`, each with `label: eventLabel(type, locale)`. The web `EVENT_TYPE_KEYS` (`apps/web/src/features/notifications/event-preferences-table.tsx:19-27`) has no `trial.*` entry, so `eventLabel()` falls back to the API label.
- Scenario: any user opens Account → Notification channels (the link this change restored) and sees "Pro trial ending soon", "Pro trial ended", "Pro trial extended", "Pro trial extension declined" ("Dùng thử Pro sắp kết thúc…", "Pro 试用即将结束…").
- Fix: rewrite the four non-owner labels in all three API locales in the same neutral wording as `trial-*.ts` (for example "Extended limits ending soon", "Extended limits ended", "Extended limits lengthened", "Answers to your requests"). Optionally add web keys to `EVENT_TYPE_KEYS`. Hiding `trial.extension.approved/declined` from users with no request is another option. Add a test asserting that no label of `getNotificationPreferences` for a non-owner matches `/\b(Pro|plan|trial)\b/i`.

### H2. The quota-used-up notification tells users to upgrade to Pro
- `apps/api/src/i18n/messages/en.ts:125` ("…until the start of next month or until you upgrade to Pro."), `vi.ts:60` ("…hoặc khi bạn nâng cấp Pro."), `zh-cn.ts:67` ("…或升级到 Pro 之前…")
- Scenario: the monthly mock quota of a Free owner (or of anyone after the 30 days end) runs out, and `usage.quota` lands in the bell, Web Push and Telegram with the upgrade wording. In-app notifications render at read time (`in-app-channel.ts:55`), so the old ones also show the text until it is fixed.
- Fix: drop the upgrade clause in all three locales ("The mock API returns 429 until the start of next month."). Add a `trial-texts.test.ts`-style assertion over `quota.usedUpBody`.

## Medium

### M1. The new limit messages state the wrong scope for resources and inboxes
- `apps/web/src/i18n/messages/en/limits.ts:9-17` (and the vi/zh-CN equivalents)
- Resources are an account-wide total: `assertResourceQuota` (`plan-guard.ts:72-77` doc) counts `ResourceModel.find({ ownerSub })` in `resource-quota.ts:27`. Inboxes are per project: `InboxModel.countDocuments({ projectId })` in `inbox-store.ts:85`. The copy says the opposite: resources "This project has reached its limit of {count} resources", inboxes "This account has reached its limit of {count} inboxes".
- Scenario: a Free owner has 6 resources in project A and 4 in project B, adds one in B, and is told "This project has reached its limit of 10 resources. Delete one to add another." B holds only 4.
- Fix: resources → "This account has reached its limit of {count} resources across your projects. Delete one to add another."; webhookInboxes → "This project has reached its limit of {count} inboxes…". Mirror in vi/zh-CN. Also existing and carried over: `landing.hero.noteMock/noteLocalhost` and `docsQuickStart.createProject.body` say "{resources} resources per project/each". This predates the change, but the change rewrote those strings.

### M2. Other API limit messages still say "Your plan allows … upgrade"
- `apps/api/src/modules/webhook-inbox/inbox-store.ts:67` (403 `PLAN_LIMIT_REACHED`) and `apps/api/src/modules/api-client/proxy-quota.ts:20` (429 `MONTHLY_QUOTA_EXCEEDED`)
- ADR decision 4 says the API's `PLAN_LIMIT_REACHED` message becomes neutral. Only `PlanLimitError` changed. The web hides these two messages (it maps by code), but Localman MCP agents and REST callers get "upgrade to create more", and agents relay that to users.
- Fix: same neutral form as `PlanLimitError` ("Limit reached: at most {max} webhook inboxes in this project", "Limit reached: at most {max} proxied requests this month; wait for next month"). Also consider the operation descriptions `workspace-crud-operations.ts:44` ("Free 1, Pro unlimited") and `proxy-operations.ts:56` ("the plan's"). They are agent-facing and lower priority.

### M3. An admin decision can be silently reversed by the auto-start
- `apps/api/src/modules/trial/trial-plan.ts:73-90` combined with `apps/api/src/modules/billing/set-user-plan-command.ts:104-107`
- `set-user-plan --plan free` sets `plan: "free"` and unsets `planExpiresAt`, but leaves `trialStartedAt` null. On the account's next sign-in or refresh, `autoStartTrial` matches and the account is Pro for 30 days. The same happens when an admin's time-boxed grant (`set-user-plan --plan pro --expires`, or `admin.extendUserTrial`) on a never-trialed account ends: the account then gets another 30 days.
- Likelihood is low after deploy, because every web sign-in sets `trialStartedAt` immediately. It applies to accounts that have not signed in since the deploy and to MCP-only accounts (`ensureUserForSubject`). It still breaks the plan's rule that "upgrading again is the admin's call".
- Fix (pick one): (a) `setUserPlan` also does `$set: { trialStartedAt: now }` when the field is missing (one conditional `updateOne({sub, trialStartedAt: null}, …)`), so any admin plan decision consumes the automatic period; or (b) document in system-architecture that `--plan free` on a never-trialed account is overridden at next sign-in. Add a test either way.

### M4. If autoStartTrial throws, sign-in fails with `login_failed`
- `apps/api/src/modules/users/user-sync.ts:96`, caught by `apps/api/src/modules/auth/auth-routes.ts:144-152`
- At sign-in, any error from the extra write (primary step-down between the two writes, write-concern timeout) sends the user to `login_failed`, even though the profile upsert succeeded. The refresh path swallows the same error (see above). The period is a side benefit that the next refresh retries, so it should not gate sign-in.
- Fix: in `syncUserFromUserInfo`, `await autoStartTrial(info.sub).catch((error) => trialLog().warn({ err: error, sub: info.sub }, "Automatic Pro period not started"))`, or catch in the auth route only. Add a unit test that sign-in still succeeds when `autoStartTrial` rejects.

### M5. docs/ux-writing.md contradicts itself
- `docs/ux-writing.md:29` still says the Pro card's main CTA is "Dùng thử 30 ngày" and the interest form is a secondary link. That contradicts the new rule at line 26.
- More leftover plan examples: `:9` ("Gói Free · hết hạn …"), `:10` ("Bắt đầu miễn phí", "Quản lý gói"), `:50` ("Chỉ dùng để liên hệ về gói Pro."), `:74` ("Free 套餐"), `:76` ("套餐名 Free / Pro 不翻译"). Also `docs/design-system.md:52` uses "Quản lý gói" as the read-only modal example.
- Fix: delete line 29 and replace the examples with current strings ("Bắt đầu ngay", "Kênh thông báo"). Line 76 can stay if it is scoped to admin pages.

## Low

### L1. The limit toast shows a number from the session plan, not the one the server enforced
- `apps/web/src/features/subscription/use-limit-notice.ts:24-37`. `PlanLimitError` sends `details.max`, but `isPlanLimitError` callers (`projects-page.tsx:109`, `inbox-tab.tsx:169`, `project-detail-page.tsx:132`) drop it.
- Scenario: the 30 days end while a tab is open. The cached `/users/me` still says `pro`, the server refuses at 3 projects, and the toast says "limit of 20 projects". The client pre-check at `projects-page.tsx:75` has the same staleness (pre-existing).
- Fix: let `limitNotice(limit, max?)` prefer the server's `details.max` when the call comes from a 403.

### L2. Dead code left behind
- `ReachedLimit` `"teamWorkspaces"` and `"members"` branches in `use-limit-notice.ts:11-12,38-39` have no caller. `limits.reached.members` (en/vi/zh-CN) is reachable only through that branch. `create-workspace-modal.tsx:149` uses `limits.reached.teamWorkspaces` directly.
- `CurrentUser.trial`, `parseTrial` and the rest of `features/subscription/trial-state.ts` are parsed in `current-user.ts:56` but nothing reads them (only test fixtures).
- `TurnstileField` defaults `action = TURNSTILE_ACTIONS.proInterest`, `dataId = "pro-interest-turnstile"` (`features/feedback/turnstile-field.tsx:30-31`). The only caller passes both, so the defaults are stale. Make them required. `FormSkeleton` doc (`form-skeleton.tsx:8`) still says "Pro interest".
- `docsCustomResponses.edit.bodyWithFree` is now identical to `body` (all three locales), so the branch in `pages/docs/custom-responses-page.tsx:62-64` is dead. Drop the key and the branch.

### L3. A 301 for /pricing is permanent in browsers
- `infra/localman/nginx/localman.hoandat.com.conf:294-296`. The ADR expects re-commercialisation later (new ADR replacing decisions 1, 3 and 4). Browsers cache a 301 with no expiry, so returning visitors would keep landing on `/` after `/pricing` comes back. Use 302 (or 307) unless the SEO consolidation is wanted. The SPA `Navigate replace` is fine.

### L4. Docs drift
- The plan's Scope says auto-start runs "on `GET /users/me`" and acceptance says "app load". The implementation and the ADR only use sign-in and session refresh. Update the plan so the record matches the code.
- ADR "Đánh đổi" says landing and docs give the Free numbers as a minimum ("ít nhất N project"). Only `docsQuickStart.createProject.body` says "at least". `landing.hero.noteMock/noteLocalhost` state the bare Free numbers ("Sign in and start right away: 3 projects…"), while a new account actually gets the Pro limits for 30 days. Either reword the landing or adjust the ADR line.

### L5. The feedback form's Turnstile key comes from the hidden Pro interest endpoint
- `apps/web/src/features/feedback/turnstile-config-api.ts:15` calls `/api/v1/feedback/pro-interest/config`. The comment acknowledges it, but deleting the Pro interest endpoints later would silently break the contact form's verification. Note it in `docs/system-architecture.md` (Form góp ý section), or add a neutral `/feedback/config` alias when convenient.

### L6. Copy: approved/declined notifications have no subject
- `trial-en.ts` `declinedTitle`/`declinedBody` ("Your request was not approved.") read as context-free in the bell. Example: "Your request for more time with the extended limits was not approved." Mirror in vi/zh-CN.

## Regressions / lost affordances checked
- The account page notification-channels link was restored (`account-page.tsx:62-70`). The old plan card's other affordances (trial countdown, start trial, manage plan) were commercial. Removing the limit summary line is intended (decision 6).
- Account menu: only "Manage plan" and "Pricing" items were removed. Header: plan badge removed. Footer: pricing link removed. The import dialog still offers non-commercial guidance (`resourceImport.planRoomHint`). Member invite at the limit still refreshes seats and now also shows `collaborators.errors.full` (`use-invite-flow.ts:59-60`). Nothing else non-commercial was lost.
- `/pricing` references: none left outside the redirect, admin source labels and tests. The release dir is built fresh (only `assets/` carried over by `activate-release.sh:50`), so a stale `pricing.html` cannot survive a deploy.

## e2e/support/user-plan.ts
Safe. `execFile` takes a fixed argv (no shell), `username` comes from `uniqueUsername`, env is minimal (`PATH`, `HOME`, `MONGO_URI` pointing at the e2e Mongo port). Note that it uses the exact `--plan free` path from M3. It works only because sign-in already set `trialStartedAt`.

## Edge cases from scouting
- MCP-only accounts (`ensureUserForSubject`, `localman-mcp-limits.ts:98`) stay Free until their first web sign-in. This matches the ADR wording, but the ADR could say so explicitly.
- A mid-session auto-start on refresh: the server is Pro immediately, but the web's cached `/users/me` keeps showing Free numbers until reload. This is cosmetic, since no plan names show.
- Old in-app trial notifications re-render with the new neutral text (they render at read time). Good.

## Recommended actions (priority order)
1. H1, H2: neutral API copy for the notification-settings labels and `quota.usedUpBody` in en/vi/zh-CN, plus a guard test.
2. M1: correct the resources/inboxes scope in `limits` (3 locales).
3. M2: neutral messages in `inbox-store.ts:67` and `proxy-quota.ts:20`.
4. M4: catch and log `autoStartTrial` errors so sign-in never fails because of them.
5. M3: decide whether admin plan changes consume the automatic period. Implement or document.
6. M5, L4: fix docs (ux-writing, design-system, plan Scope, ADR "ít nhất").
7. L1-L3, L5-L6 as cleanup.

## Metrics
- Type coverage: strict TS, no `any` or `!` added in the reviewed hunks
- Lint/typecheck/tests: reported green by the lead (not re-run)
- File size: all changed source files ≤ 200 lines (`auth-flow.test.ts` is 201; other tests already exceed this)

## Unresolved questions
- M3: should an admin's `--plan free` (or an ended admin grant) count as "had the period"? This is a product call. The recommendation is yes (option a).
- L3: is a permanent 301 wanted for SEO, or should `/pricing` stay reversible (302)?
- M1: is "resources" meant to be per project (as the landing has always said) and the server count is the bug, or the reverse? The copy should follow whichever is intended.

Note: deletions are staged while modifications are unstaged, in a tree shared with the Tunelo session. Stage this change's paths explicitly at commit time.

## Xử lý (2026-10-12, 13:15)

- High 1, 2: nhãn `trial.*` cho người không phải owner và câu hết quota mock đã trung tính ở en, vi, zh-CN; test mới `event-labels-copy.test.ts` chặn chữ gói, giá, dùng thử trong nhãn người dùng thấy.
- Medium 3: chữ hạn mức sửa theo server (Jev 0,88): resource tính tổng trên mọi project (thông báo, landing, hướng dẫn nhanh), inbox theo project.
- Medium 4: message `PLAN_LIMIT_REACHED` của inbox và `MONTHLY_QUOTA_EXCEEDED` của proxy không còn "upgrade".
- Medium 5: chỉ ghi tài liệu (Jev 0,89) ở ADR-0002 và `system-architecture.md`.
- Medium 6: `autoStartTrial` tự bắt lỗi, log cảnh báo, trả `null`; có test.
- Medium 7: `ux-writing.md` bỏ dòng CTA dùng thử và ví dụ chữ gói; `design-system.md` đổi ví dụ.
- Low: nginx `/pricing` dùng 302 (Jev 1,0); gỡ nhánh `members`/`teamWorkspaces` và key `limits.reached.members`, `CurrentUser.trial` cùng `trial-state.ts`, mặc định pro-interest của `TurnstileField`, key `bodyWithFree`; plan sửa câu về `GET /users/me`, ADR sửa câu "ít nhất".
- Chưa làm (Low, ghi nhận): số trong toast chạm giới hạn lấy từ gói của phiên chứ không từ `details.max` của server; form góp ý lấy site key Turnstile từ `/feedback/pro-interest/config`; thông báo duyệt/từ chối không nêu yêu cầu nào.
- Kiểm lại: lint, typecheck, check:mcp-coverage, check:tokens exit 0; web 254 tệp / 1229 test, API 214 tệp / 1222 test pass; E2E 36/36; SAST chạy lại đạt.
