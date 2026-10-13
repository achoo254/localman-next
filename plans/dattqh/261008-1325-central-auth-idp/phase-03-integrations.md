---
phase: 3
title: "Tích hợp Localman, Tunelo, MCP"
status: in-progress
priority: P1
effort: "M"
dependencies: [2]
---

# Phase 03: Tích hợp

## Goal
Nối 4 client vào IdP và mô tả rõ phần việc mỗi repo phải làm.

## Trạng thái (2026-10-12)
Xong T1–T6 và T8. Còn mở T7 (E2E 3 dịch vụ). Không có staging nên T7 chạy trên production. Localman và Tunelo đều đã nối IdP ở production (log IdP ngày 12/10 có đăng nhập `tunelo-web`, duyệt thiết bị `tunelo-cli` và grant mới của `localman-web`). Điều kiện "đăng nhập IdP một lần rồi vào thẳng Localman" cần thêm đăng nhập im lặng (`prompt=none`) ở Localman: code đã xong ở `localman-next` ngày 12/10, chưa commit và chưa deploy. IdP không cần đổi gì vì đã hỗ trợ `prompt=none`. Code của Localman và Tunelo nằm trong plan của chính repo đó; phase này lo phía IdP và hợp đồng giữa các bên.

## Hợp đồng tích hợp

| Client | Luồng | Việc phía IdP | Việc ở repo client (plan tương ứng) |
|---|---|---|---|
| Localman web | Authorization Code + PKCE; phiên app là cookie `lm_session` riêng, liên kết với `sid` của IdP | Client `localman-web`, back-channel logout tới `https://localman.hoandat.com/auth/backchannel-logout` | Localman phase 02: `openid-client`, `/auth/login`, `/auth/callback`, `/auth/logout`, map `sub` sang user nội bộ |
| Localman MCP | Client MCP tự đăng ký (DCR), Code + PKCE, `resource=https://localman.hoandat.com/mcp` | Policy DCR: scope `mock:*` và `client:*`, chặn redirect URI không phải localhost hay https | Localman phase 17: endpoint Protected Resource Metadata trỏ tới `auth.hoandat.com`; xác minh JWT bằng JWKS |
| Tunelo CLI | Device Authorization Grant (`tunelo login` hiện mã kèm URL `auth.hoandat.com/device`) | Client `tunelo-cli`, audience Tunelo, scope `tunnels:open tunnels:read offline_access` | Plan Tunelo: server tin JWT do IdP ký (`sub` thành chủ tài khoản); CLI lưu refresh token; token ẩn danh cũ vẫn chạy 60 ngày rồi chặn |
| Tunelo web/approve | Code + PKCE | Client `tunelo-web` | Plan Tunelo: trang approve và trang quản lý thiết bị bắt buộc đăng nhập |
| Localman gọi API Tunelo để liệt kê tunnel | Token exchange (RFC 8693) hoặc client credentials kèm `sub`: Localman đổi phiên của user lấy token `aud=https://tunnel.hoandat.com`, `scope=tunnels:read` | Bật token exchange, chỉ cho client `localman-web` | Plan Tunelo: `GET /api/tunnels` chấp nhận token `aud=https://tunnel.hoandat.com` và liệt kê theo `sub` (mọi máy của user). `tunelo link <code>` giữ cho máy chưa gắn tài khoản (Jev 0.56) |

## Hợp đồng với Localman (Jev 2026-10-08)
- **Audit** (0.94):
  - IdP ký (JWS) và đẩy sự kiện credential (tạo, xoay, thu hồi PAT và secret service account; đăng nhập; đổi mật khẩu) tới `POST https://localman.hoandat.com/internal/audit-events`, xác thực bằng client credentials của IdP.
  - IdP có **outbox** trong Mongo, thử lại với backoff. Trong lúc Localman chưa deploy (đợt 0–1), sự kiện nằm chờ trong outbox.
- **Workspace của user** (0.78):
  - IdP (trang service account) và Tunelo (SSO gate) gọi `GET https://localman.hoandat.com/internal/users/:sub/workspaces` bằng client credentials, cache 60 giây.
  - Localman là nguồn duy nhất; IdP không lưu danh sách workspace.

## Tasks & Steps
1. Bật token exchange trong `oidc-provider` (custom grant `urn:ietf:params:oauth:grant-type:token-exchange`) với policy chặt: subject token phải do `localman-web` cầm; audience đích chỉ được là Tunelo; scope chỉ `tunnels:read`.
2. Viết `docs/integration-guide.md` của IdP: endpoint, client, scope, audience, cách xác minh JWT (dùng thư viện `jose`, cache JWKS), cách xử lý back-channel logout.
3. Seed client trên staging và production bằng script `scripts/seed-clients.ts` (chạy idempotent).

## Verification
- E2E giữa 3 dịch vụ trên staging:
  - Đăng nhập Localman rồi `tunelo login` thì duyệt thiết bị không phải nhập mật khẩu lại.
  - Mở tunnel, rồi trên Localman gửi tới `localhost:<port>` thì tự nhận tunnel theo tài khoản.
  - Đăng xuất ở IdP thì Localman mất phiên.
- Token exchange bị từ chối khi client khác `localman-web` gọi, hoặc khi xin scope khác `tunnels:read`.

## Giao việc
**Đợt:** 0 · **Phụ thuộc trước khi bắt đầu:** phase 02 đã lên staging. Riêng E2E giữa 3 dịch vụ (T7) cần thêm Localman phase 02 và Tunelo phase 01–02 trên staging, mà hai phần đó lại chờ phase này; vì vậy T7 chạy sau, phase đóng phần IdP bằng T5 và để T7 mở cho tới khi đủ điều kiện. Code ở repo `hoandat-auth` · **Lệnh cook:** `/ak:cook plans/dattqh/261008-1325-central-auth-idp/phase-03-integrations.md`

| # | Việc | Vai trò | Song song | File chính |
|---|---|---|---|---|
| T1 | Bật token exchange (grant `urn:ietf:params:oauth:grant-type:token-exchange`) với policy chặt: subject token phải do `localman-web` cầm, audience đích chỉ là `https://tunnel.hoandat.com`, scope chỉ `tunnels:read` | fullstack-developer | Song song với T2, T4 | `src/oidc/token-exchange.ts` (mới), `src/oidc/provider.ts` |
| T2 | Rà client theo bảng hợp đồng: URI back-channel logout của `localman-web` là `https://localman.hoandat.com/auth/backchannel-logout`; `tunelo-cli` có scope `tunnels:open tunnels:read offline_access` và audience `https://tunnel.hoandat.com`; policy DCR chỉ cho scope `mock:*` và `client:*`, redirect chỉ localhost hoặc https, `resource` bắt buộc là `https://localman.hoandat.com/mcp` | fullstack-developer | Song song với T1, T4 | `src/oidc/clients.ts` |
| T3 | Script seed client chạy idempotent cho staging và production | fullstack-developer | — (sau T2) | `scripts/seed-clients.ts` |
| T4 | Viết hướng dẫn tích hợp: endpoint (lấy từ discovery, không hardcode path), client, scope, giá trị `aud` chính xác cho từng resource, cách xác minh JWT bằng `jose` có cache JWKS, cách xử lý back-channel logout | docs-manager | Song song với T1, T2 | `docs/integration-guide.md` |
| T5 | Test token exchange: client khác `localman-web` bị từ chối, xin scope khác `tunnels:read` bị từ chối, token cấp ra có đúng `aud`; chạy lại bộ test của phase 01–02 để chắc không vỡ | tester | — (sau T1, T2) | `src/__tests__/token-exchange.test.ts` (mới) |
| T6 | Deploy bản phase 03 rồi chạy `scripts/seed-clients.ts` trên staging và production (cần user xác nhận) | fullstack-developer (hạ tầng) | — (sau T3, T5) | VPS staging và production |
| T7 | E2E 3 dịch vụ trên staging: đăng nhập Localman rồi `tunelo login` thì duyệt thiết bị không hỏi mật khẩu; mở tunnel rồi gửi tới `localhost:<port>` trên Localman thì tự nhận tunnel; đăng xuất ở IdP thì Localman mất phiên. Chạy khi Localman phase 02 và Tunelo phase 02 đã lên staging | tester | — | staging của IdP, Localman, Tunelo |
| T8 | Review cuối phase | code-reviewer | — | toàn phase |

### Checklist
- [x] T1 Token exchange bật, policy chỉ cho `localman-web`, audience Tunelo, scope `tunnels:read`
- [x] T2 Cấu hình 3 client và policy DCR khớp bảng hợp đồng
- [x] T3 `scripts/seed-clients.ts` chạy hai lần liên tiếp không sinh thay đổi
- [x] T4 `docs/integration-guide.md` đủ mục cho Localman, Tunelo và client MCP
- [x] T5 Test token exchange và bộ test cũ pass
- [x] T6 Production đã chạy `dist/seed-clients.mjs` (chỉ đọc, client tĩnh nằm trong code): 4 client hợp lệ, 0 client DCR, discovery khớp
- [ ] T7 E2E 3 dịch vụ pass trên production (chờ Localman deploy đăng nhập im lặng)
  - 2026-10-13 trên production: đăng nhập một lần Localman/Tunelo web/Tunelo CLI qua IdP chạy với người dùng thật (refresh, token exchange 200, audit giao hết); MCP client đăng ký động (2 client DCR) và consent đã sửa. Chưa đạt: "tự nhận tunnel" (Localman chưa có danh sách tunnel theo tài khoản; `tunnelTokens` dựng mà không dùng) và chưa có lượt back-channel logout thật trên production (chỉ test tự động).
- [x] T8 Review không còn finding mức high
- [x] Verification: token exchange bị từ chối đúng 2 trường hợp (T5)
- [ ] Verification: E2E đăng nhập một lần, tự nhận tunnel và back-channel logout pass trên production (theo T7)
- [x] lint/typecheck/test sạch: `pnpm lint` (Biome), `tsc --noEmit`, `pnpm test`
- [x] `pnpm check:mcp-coverage`: N/A (repo `hoandat-auth` không dùng operation registry của Localman)
