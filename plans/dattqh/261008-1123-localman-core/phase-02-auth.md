---
phase: 2
title: "Đăng nhập qua auth.hoandat.com và kênh thông báo không dùng email"
status: pending
priority: P1
effort: "M"
dependencies: [1]
blockedBy: ["plans/dattqh/261008-1325-central-auth-idp"]
---

# Phase 02: Đăng nhập qua IdP và kênh thông báo

## Goal
Localman **không tự quản lý mật khẩu nữa**. User đăng nhập một lần tại `auth.hoandat.com`, IdP dùng chung cho Localman và Tunelo (user yêu cầu "chỉ login 1 nơi", Jev chọn kiến trúc với xác suất 1.00). Localman là OIDC client và tự giữ phiên bằng cookie httpOnly.

User không có mail server, nên mọi thông báo trước đây gửi qua email chuyển sang kênh miễn phí (Jev 0.97): thông báo **trong app** luôn có, cộng thêm **Web Push** (FCM/VAPID) và **Telegram**, cả hai do user tự bật.

Đăng ký, mật khẩu, mã khôi phục, Google/GitHub và liên kết Telegram nằm ở plan IdP `plans/dattqh/261008-1325-central-auth-idp/`, phase 02.

## Files to Create / Modify
- Create `apps/api/src/modules/auth/`:
  - `oidc-client.ts`: `openid-client` với client `localman-web`, Code + PKCE, discovery từ `https://auth.hoandat.com`.
  - `auth-routes.ts`:
    - `GET /auth/login` (nhận `returnTo`)
    - `GET /auth/callback`
    - `POST /auth/logout` (RP-initiated)
    - `POST /auth/backchannel-logout` (xác minh logout token, huỷ phiên theo `sid`)
  - `session-store.ts`: cookie `__Host-lm_session` httpOnly, Secure, SameSite=Strict, Path=/ (Jev 0.90, Validation Log vòng 20: mock runtime cùng site nên Lax không chặn được request từ trang mock). Mọi request thay đổi dữ liệu phải có `Origin` là `localman.hoandat.com` hoặc `Sec-Fetch-Site: same-origin`, sai thì trả 403. Phiên lưu trong Mongo kèm `sub`, `sid` và refresh token đã mã hoá; access token hết hạn thì tự refresh, user không thấy. Không xin scope `offline_access` (IdP trả `invalid_scope`): refresh token gắn với phiên IdP nên đăng xuất ở IdP tự huỷ nó (Jev 0.94, plan IdP). Back-channel logout vẫn bắt buộc để xoá cookie. Hợp đồng chi tiết: `docs/integration-guide.md` trong repo `hoandat-auth`.
  - `token-exchange.ts`: đổi phiên của user lấy token `aud=https://tunnel.hoandat.com`, `scope=tunnels:read`. Phase 10 dùng token này để liệt kê tunnel theo tài khoản.
- Create `apps/api/src/modules/users/user-model.ts`: `{sub (unique), username, email, emailVerified, name, picture, plan:'free'|'pro', planExpiresAt?, createdAt}`. Đồng bộ từ claim mỗi lần đăng nhập. **Không có `passwordHash`.**
- Create `apps/api/src/http/require-auth.ts`.
- Create `apps/api/src/modules/notifications/`. Đây là **module nền**, phase 07, 11 và 14 dùng lại:
  - `notification-model.ts`, `notification-preferences-model.ts`
  - `notification-service.ts`: gửi tới mọi kênh user đã bật, theo từng loại sự kiện.
  - `channels/in-app-channel.ts`
  - `channels/web-push-channel.ts`: thư viện `web-push` với VAPID; lưu subscription theo từng thiết bị; subscription trả 410 thì xoá.
  - `channels/telegram-channel.ts`: bot riêng của Localman. `chatId` lấy từ IdP qua `userinfo` với scope `telegram` (claim `telegram_chat_id`, `telegram_username`; chỉ `localman-web` được xin). Chưa liên kết thì hiện nút "Liên kết Telegram", dẫn tới trang `/account` của IdP. Giữ bot riêng của Localman, không dùng chung bot của IdP (Jev 0.99): sau khi liên kết, hiện lời nhắc một lần "Mở @<bot Localman> và bấm Start"; Telegram trả 403 thì đánh dấu kênh chưa kích hoạt. Đọc lại `userinfo` khi đăng nhập, khi refresh và khi nhận audit event `method.linked`/`method.unlinked` có `method: "telegram"`.
- Create `apps/web/public/sw.js` (service worker nhận push), `apps/web/src/features/auth/use-current-user.ts`, `apps/web/src/lib/api-client.ts` (gặp 401 thì chuyển tới `/auth/login?returnTo=…`), `apps/web/src/features/notifications/` (chuông thông báo, trang cài đặt kênh).

## Tasks & Steps
1. Route guard:
   - Chưa đăng nhập mà vào `/projects*` thì chuyển sang IdP.
   - Đã đăng nhập mà vào `/` thì đẩy về `/projects`, giống mockapi.io.
2. Landing có nút "Đăng nhập" và "Bắt đầu miễn phí". Cả hai sang `auth.hoandat.com`; nút "Bắt đầu miễn phí" gửi thêm `prompt=create`.
3. Menu tài khoản có mục "Quản lý tài khoản", mở trang `/account` của IdP: mật khẩu, mã khôi phục, liên kết Google/GitHub/Telegram, các phiên đang mở.
4. Gói Free/Pro thuộc user của Localman (field `plan`), không nằm ở IdP.

## Verification
- Integration với IdP chạy local (`docker compose` của repo `hoandat-auth`):
  - Đăng nhập, callback, có cookie; `GET /api/users/me` trả đúng user.
  - Back-channel logout huỷ phiên.
  - Access token hết hạn thì refresh mà user không thấy.
  - Token có `aud` sai bị từ chối.
- Unit cho `notification-service`:
  - Gửi đúng kênh theo tuỳ chọn của user.
  - Subscription trả 410 bị xoá.
  - Telegram trả rate-limit thì gửi lại với backoff.
- `grep -ri "nodemailer\|smtp\|passwordHash" apps/` không ra kết quả nào.

## Giao việc
**Đợt:** 1 · **Phụ thuộc trước khi bắt đầu:** phase 01; Đợt 0 xong (plan IdP 01–03: client `localman-web`, back-channel logout, token exchange sang `aud=https://tunnel.hoandat.com`, `userinfo` trả `chatId` Telegram cho client first-party) · **Lệnh cook:** `/ak:cook plans/dattqh/261008-1123-localman-core/phase-02-auth.md`

| # | Việc | Vai trò | Song song | File chính |
|---|---|---|---|---|
| T1 | Đối chiếu prototype `prototype/index.html#/login`, `#/signup`, `#/account/notifications` và `#/idp/account` cùng chuông thông báo; chốt các state (chưa đăng nhập, đang chuyển IdP, chưa liên kết Telegram, chưa bật Web Push) và `data-id` cho T5, T6 | ui-ux-designer | với T2, T4 | `prototype/index.html` (chỉ đọc) |
| T2 | OIDC client và phiên: `oidc-client.ts` (Code + PKCE, discovery từ `auth.hoandat.com`), `auth-routes.ts` (`/auth/login`, `/auth/callback`, `/auth/logout`, `/auth/backchannel-logout`), `session-store.ts` (cookie `__Host-lm_session` SameSite=Strict, kiểm `Origin`/`Sec-Fetch-Site` cho mutation, refresh token mã hoá, tự refresh), `require-auth.ts`. Route `/auth/*` khai báo qua registry với `mcp.exempt` ghi lý do "luồng redirect OIDC trên trình duyệt" | fullstack-developer | với T1, T4 | `apps/api/src/modules/auth/{oidc-client,auth-routes,session-store}.ts`, `apps/api/src/http/require-auth.ts` |
| T3 | `user-model.ts` đồng bộ claim mỗi lần đăng nhập (không có `passwordHash`), operation `GET /api/users/me`, và `token-exchange.ts` đổi phiên lấy token `aud=https://tunnel.hoandat.com`, `scope=tunnels:read` | fullstack-developer | — (sau T2) | `apps/api/src/modules/users/user-model.ts`, `apps/api/src/modules/auth/token-exchange.ts` |
| T4 | Module nền `notifications`: model thông báo và tuỳ chọn, `notification-service` gửi theo loại sự kiện và kênh user bật, kênh in-app, Web Push (VAPID, subscription theo thiết bị, 410 thì xoá) và Telegram (bot riêng, `chatId` lấy từ IdP, backoff khi bị rate-limit). Operation đọc thông báo và sửa tuỳ chọn khai báo qua registry | fullstack-developer | với T1, T2 | `apps/api/src/modules/notifications/**` |
| T5 | Web auth: `lib/api-client.ts` (401 thì chuyển `/auth/login?returnTo=…`), `use-current-user.ts`, route guard (`/projects*` sang IdP; đã đăng nhập vào `/` thì về `/projects`), nút "Đăng nhập" và "Bắt đầu miễn phí" (`prompt=create`), và `app-header.tsx` tối thiểu có menu "Quản lý tài khoản" mở `/account` của IdP (phase 08 mở rộng header này) | fullstack-developer | — (sau T1, T3) | `apps/web/src/lib/api-client.ts`, `apps/web/src/features/auth/*`, `apps/web/src/router.tsx`, `apps/web/src/components/layout/app-header.tsx` |
| T6 | Web thông báo: `public/sw.js` nhận push, chuông thông báo, trang cài đặt kênh (bật Web Push, nút "Liên kết Telegram" dẫn tới `/account` của IdP). Đăng ký route trong `router.tsx` sau khi T5 xong | fullstack-developer | với T5 (sau T4) | `apps/web/public/sw.js`, `apps/web/src/features/notifications/*` |
| T7 | Integration với IdP chạy local (`docker compose` của repo `hoandat-auth`): login, callback, cookie, `GET /api/users/me`, back-channel logout, refresh không lộ ra user, token `aud` sai bị từ chối | tester | với T8 | `apps/api/src/modules/auth/*.test.ts` |
| T8 | Unit cho `notification-service`: đúng kênh theo tuỳ chọn, subscription 410 bị xoá, Telegram rate-limit thì gửi lại có backoff | tester | với T7 | `apps/api/src/modules/notifications/*.test.ts` |
| T9 | Review cuối phase, chú ý cookie flags, PKCE, xác minh logout token và nơi lưu refresh token | code-reviewer | — | toàn phase |

### Checklist
- [x] T1 State và `data-id` của các màn auth và thông báo đã chốt theo prototype
- [x] T2 OIDC client, auth routes, session store và `require-auth` xong
- [x] T3 User model, `GET /api/users/me` và token exchange xong
- [x] T4 Module `notifications` với 3 kênh xong
- [x] T5 Web auth, route guard và header tối thiểu xong
- [x] T6 Service worker, chuông và trang cài đặt kênh xong
- [x] T7 Integration với IdP local pass (chạy với IdP thật `hoandat-auth` build và chạy trên máy dev, không cần Docker: 14/14 bước gồm đăng ký, đăng nhập, refresh, token exchange, back-channel và RP-initiated logout, audit event)
- [x] T8 Unit `notification-service` pass
- [x] T9 Review không còn finding chặn
- [x] Verification: đăng nhập, callback có cookie; `GET /api/users/me` trả đúng user
- [x] Verification: back-channel logout huỷ phiên; access token hết hạn thì tự refresh; token `aud` sai bị từ chối
- [x] Verification: thông báo đi đúng kênh, subscription 410 bị xoá, Telegram rate-limit gửi lại có backoff
- [x] Verification: `grep -ri "nodemailer\|smtp\|passwordHash" apps/` không ra kết quả
- [x] `pnpm lint && pnpm typecheck && pnpm test` sạch
- [x] `pnpm check:mcp-coverage` pass
