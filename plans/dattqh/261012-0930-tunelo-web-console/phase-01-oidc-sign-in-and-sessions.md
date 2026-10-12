---
phase: 1
title: "Đăng nhập OIDC và phiên trong tunelo-server"
status: completed
priority: P2
effort: "M"
dependencies: []
---

# Phase 01: Đăng nhập OIDC và phiên (`apps/tunelo-server`)

## Goal
Host gốc (`tunnel.hoandat.com`) đăng nhập người dùng qua `auth.hoandat.com` bằng client confidential `tunelo-web` và
giữ phiên trong MongoDB của Tunelo, có refresh token mã hoá.

## Files
- `apps/tunelo-server/package.json`: thêm `openid-client` (cùng major với IdP và CLI đang dùng).
- MỚI `src/web/web-config.ts`: đọc và kiểm (zod) `TUNELO_WEB_CLIENT_ID` (mặc định `tunelo-web`),
  `TUNELO_WEB_CLIENT_SECRET`, `TUNELO_WEB_PUBLIC_URL` (mặc định `https://<domain chính>`), `WEB_SESSION_KEY`
  (32 byte base64url). Thiếu biến ⟹ web tắt, log tên biến, API và relay vẫn chạy.
- MỚI `src/web/web-session-store.ts`: collection `web_sessions` `{ _id: sha256(sessionId), sub, sid, profile: {
  username, name }, refreshEnc, accessToken, accessExp, loginAt, expiresAt }`, TTL index trên `expiresAt`,
  index `sid`, `sub`. `expiresAt` = min(loginAt + 90 ngày, hạn refresh IdP trả về).
- MỚI `src/web/token-cipher.ts`: AES-256-GCM cho refresh token (IV ngẫu nhiên, khoá từ `WEB_SESSION_KEY`).
- MỚI `src/web/auth-routes.ts`:
  - `GET /auth/login`: state, nonce, PKCE S256 lưu trong cookie tạm `__Host-tunelo_auth` (5 phút, ký HMAC); scope
    `openid profile`, **không** `resource` (bỏ `tunnels:read`: console đọc tunnel trong process theo `sub`, quyền tối
    thiểu; access token opaque chỉ dùng cho userinfo), **không** `offline_access` và **không** `prompt=consent`:
    refresh token của `tunelo-web` gắn với phiên IdP (như Localman web), nên đăng xuất ở IdP làm phiên console chết ở
    lần refresh kế tiếp (trong 15 phút, `invalid_grant`) kể cả khi POST back-channel bị mất. Hạn phiên giữ nguyên:
    30 ngày kể từ lần refresh cuối, trần 90 ngày từ lúc đăng nhập.
  - `GET /auth/callback`: đổi code, kiểm ID token, gọi userinfo (`/me`) lấy `preferred_username`, `name` vào
    `profile` (userinfo lỗi ⟹ vẫn đăng nhập, không có tên), tạo phiên, đặt cookie `__Host-tunelo_session`, về `/`.
    Refresh không gửi `resource` và không gọi lại userinfo.
  - `POST /auth/logout` (CSRF): xoá phiên, thu hồi refresh token, chuyển sang `end_session_endpoint` của IdP.
  - `POST /auth/backchannel-logout`: kiểm logout token (JWKS IdP, `iss`, `aud=tunelo-web`, `events`, có `sid`),
    xoá mọi phiên có `sid` đó; trả 200 / 400.
- MỚI `src/web/session-middleware.ts`: đọc cookie, nạp phiên, access token hết hạn ⟹ refresh dưới khoá theo phiên
  (Map promise trong bộ nhớ); `invalid_grant` ⟹ xoá phiên, coi như chưa đăng nhập.
  Refresh hỏng vì lý do tạm thời (5xx, 429, timeout, mạng) chỉ giữ phiên khi access token hết hạn chưa quá 1 giờ;
  quá thì xoá phiên.
- `src/server.ts`: gắn `/auth`, `/assets`, trang web cho host gốc **sau** nhánh relay subdomain, **trước** relay
  cuối; giữ `/api` và `/login`.

## Steps
1. Cấu hình + cipher + store (unit test: mã hoá vòng, TTL, cô lập `sub`).
2. Routes login/callback/logout với IdP giả (`openid-client` trỏ tới issuer test).
3. Middleware refresh có khoá; test hai request song song chỉ refresh một lần.
4. Back-channel logout: test token sai `aud`, thiếu `events`, `sid` lạ.

## Validation
`pnpm --filter @tunelo/server test`, lint, typecheck của repo. Không log token (test log-safety như IdP nếu có sẵn mẫu).

## Rollback
Bỏ biến `TUNELO_WEB_*` khỏi `.env` ⟹ web tắt, server như cũ.

## Trạng thái thực hiện (2026-10-12)
- [x] `web-config.ts` (zod; thiếu/sai biến ⟹ web tắt, chỉ log tên biến), `token-cipher.ts` (AES-256-GCM, khoá con HKDF
  theo mục đích), `web-session-store.ts` + `web-session-model.ts` (`web_sessions`, TTL `expiresAt`, index `sid`, `sub`).
- [x] `auth-routes.ts`: `/auth/login`, `/auth/callback`, `POST /auth/logout` (CSRF, thu hồi refresh, `end_session`),
  `backchannel-logout-route.ts` + `logout-token.ts`.
- [x] `session-middleware.ts`: refresh dưới khoá theo phiên (Map promise), `invalid_grant` ⟹ xoá phiên.
- [x] `server.ts` gắn console sau `/api`, `/login`, trước relay cuối; chỉ host `TUNELO_WEB_PUBLIC_URL`, chỉ `/`, `/lang`,
  `/auth/*`, `/assets/*`.
- [x] Test: cipher, store (TTL, cô lập `sub`), luồng callback với IdP giả, khoá refresh, back-channel logout, log không
  chứa token.
- Lệch so với file: phiên không lưu access token (console đọc tunnel trong process, refresh chỉ để biết grant còn sống);
  lưu thêm ID token mã hoá cho `id_token_hint`. Cookie `__Host-tunelo_auth` được niêm phong AES-GCM (vừa ký vừa giấu).
- [x] Theo quyết định Jev 0.97: scope `openid profile offline_access`, không `resource`; tên hiển thị lấy từ userinfo lúc
  callback (tên, không có thì username), không log; test IdP giả có `/me`, tên ở topbar 3 ngôn ngữ.
- [x] Theo quyết định user (review M2): scope `openid profile`, bỏ `offline_access` và `prompt=consent`; refresh gắn
  phiên IdP (IdP đổi phía họ).
- [x] Sửa theo review bảo mật: H1 (`new URL` thay `URL.parse`; `mountWebConsole` không bao giờ làm sập server), M1
  (giao dịch đăng nhập dùng một lần trong bộ nhớ, có trần kích thước; giới hạn 20/phút/IP cho `/auth/login`,
  `/auth/callback`), L2 (refresh hỏng tạm thời: ân hạn 1 giờ), L4 (cảnh báo khi ID token thiếu `sid`).
