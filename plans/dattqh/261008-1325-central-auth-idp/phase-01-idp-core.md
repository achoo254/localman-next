---
phase: 1
title: "IdP lõi: OIDC, client, key, deploy"
status: pending
priority: P1
effort: "M"
dependencies: []
---

# Phase 01: IdP lõi

## Goal
Dựng `auth.hoandat.com` chạy `oidc-provider` trên Express 5 với Mongo adapter: có discovery, JWKS, authorization code + PKCE, device flow, refresh xoay vòng, revocation, introspection và RP-initiated logout. Đăng ký sẵn 4 client, deploy bằng Docker Compose trên VPS, DNS và TLS qua Cloudflare.

Repo riêng: `achoo254/hoandat-auth` (private; tạo bằng `gh repo create` khi bắt đầu plan này; thư mục local `$WORKSPACE/hoandat-auth`; pnpm, TypeScript strict, ESM). Plan này nằm trong `localman-next` để quản lý chung với các plan khác.

## Files to Create
- `package.json`, `tsconfig.json`, `biome.json` (cùng chuẩn với Tunelo), `.env.example`, `Dockerfile`, `docker-compose.yml`
- `src/server.ts`, `src/config/env.ts` (validate bằng zod)
- `src/oidc/provider.ts`: khởi tạo `oidc-provider`. Bật `devFeatures`=false và các feature `deviceFlow`, `revocation`, `introspection`, `rpInitiatedLogout`, `backchannelLogout`, `resourceIndicators` (audience `https://localman.hoandat.com`, `https://localman.hoandat.com/mcp`, `https://tunnel.hoandat.com`), `registration` (chỉ cho client MCP, có policy giới hạn)
- `src/oidc/mongo-adapter.ts`, `src/oidc/clients.ts` (khai báo tĩnh 4 client, secret lấy từ env), `src/oidc/jwks.ts` (ES256, đọc nhiều key từ file secret, có `kid` để xoay vòng), `src/oidc/claims.ts` (`sub`, `preferred_username`, `email`, `email_verified`, `name`, `picture`, cùng claim riêng `telegram_linked`)
- `src/http/security.ts`: helmet, rate-limit cho `/token`, `/device` và `/authorize`, trust proxy theo Cloudflare
- `docs/decisions/0001-own-oidc-idp.md` (ADR: vì sao tự host bằng `oidc-provider`, vì sao không dùng email, vì sao ES256 và token ngắn hạn)
- `src/__tests__/oidc-flows.test.ts`

## Tasks & Steps
1. Cấu hình TTL: AccessToken 15 phút, RefreshToken 30 ngày có xoay vòng, Session 30 ngày, DeviceCode 10 phút, Grant theo client.
2. Đặt `issuer = https://auth.hoandat.com` và cookie phiên `__Host-`, Secure, SameSite=Lax.
3. Khai báo client:
   - `localman-web`: confidential, redirect `https://localman.hoandat.com/auth/callback`, post-logout redirect, URI back-channel logout.
   - `tunelo-cli`: public, grant `urn:ietf:params:oauth:grant-type:device_code` và `refresh_token`.
   - `tunelo-web`: confidential, cho trang web và trang approve của Tunelo.
   - `localman-mcp`: không phải client cố định; client MCP đăng ký qua DCR, chỉ được scope `mock:*` và `client:*`, audience bắt buộc là `/mcp`.
4. Deploy: container `hoandat-auth` dùng chung Mongo của Localman (database riêng `auth`). Cloudflare proxy bật cho `auth.hoandat.com`. Có healthcheck `/healthz`.

## Quyết định hạ tầng (Jev 0.68, 2026-10-08)
- **MongoDB dùng chung, dựng ngay ở đợt 0:** một replica set chạy bằng Docker Compose trên VPS, khai báo ở `infra/mongo/` của repo `localman-next` (gồm compose, keyfile, script backup hằng ngày).
- IdP dùng database `auth`. Localman và Tunelo nối vào sau, mỗi bên một database riêng, mỗi database một user Mongo chỉ có quyền trên database của mình.
- Việc "dựng replica set và cấu hình backup" là một task riêng ở đợt 0, (cần user xác nhận) vì phải thao tác trên VPS.

## Verification
- Test bằng client `openid-client`:
  - Code + PKCE ra id_token hợp lệ.
  - Device flow: poll trả `authorization_pending` rồi tới khi duyệt thì cấp token.
  - Refresh xoay vòng; dùng lại refresh token cũ thì toàn bộ grant bị thu hồi.
  - Token có `aud` sai bị app từ chối.
- Chạy bộ conformance suite của OpenID Foundation (Basic OP và Config OP) trên staging.
- `pnpm lint` và `pnpm test` sạch.

## Giao việc
**Đợt:** 0 · **Phụ thuộc trước khi bắt đầu:** không có phase nào chặn; cần repo `achoo254/hoandat-auth` (T1) và quyền sửa zone `hoandat.com` trên Cloudflare (T9). Code nằm ở repo `hoandat-auth`, mọi path dưới đây tính từ root repo đó · **Lệnh cook:** `/ak:cook plans/dattqh/261008-1325-central-auth-idp/phase-01-idp-core.md`

| # | Việc | Vai trò | Song song | File chính |
|---|---|---|---|---|
| T1 | Tạo repo private `achoo254/hoandat-auth` bằng `gh repo create`, clone về `$WORKSPACE/hoandat-auth` (cần user xác nhận) | fullstack-developer (hạ tầng) | — | repo mới |
| T2 | Scaffold repo: pnpm, TypeScript strict, ESM, Biome cùng chuẩn Tunelo, server Express 5 có `/healthz`, validate env bằng zod | fullstack-developer | — | `package.json`, `tsconfig.json`, `biome.json`, `.env.example`, `src/server.ts`, `src/config/env.ts` |
| T3 | Mongo adapter cho `oidc-provider`; JWKS ES256 đọc nhiều key từ file secret, mỗi key có `kid`; map claim `sub`, `preferred_username`, `email`, `email_verified`, `name`, `picture`, `telegram_linked` | fullstack-developer | Song song với T5, T6 | `src/oidc/mongo-adapter.ts`, `src/oidc/jwks.ts`, `src/oidc/claims.ts` |
| T4 | Cấu hình provider: issuer, TTL (AccessToken 15 phút, RefreshToken 30 ngày xoay vòng, Session 30 ngày, DeviceCode 10 phút), cookie `__Host-` Secure SameSite=Lax, các feature (device flow, revocation, introspection, RP-initiated và back-channel logout, resource indicators cho 3 audience, registration có policy). Khai báo client `localman-web`, `tunelo-cli`, `tunelo-web` và policy DCR cho client MCP | fullstack-developer | — (sau T3) | `src/oidc/provider.ts`, `src/oidc/clients.ts` |
| T5 | Lớp bảo mật HTTP: helmet, rate-limit cho `/token`, `/device`, `/authorize`, trust proxy theo Cloudflare | fullstack-developer | Song song với T3, T6 | `src/http/security.ts` |
| T6 | Viết ADR: vì sao tự host bằng `oidc-provider`, vì sao không dùng email, vì sao ES256 và token ngắn hạn | docs-manager | Song song với T3, T5 | `docs/decisions/0001-own-oidc-idp.md` |
| T7 | Test luồng bằng `openid-client`: Code + PKCE ra id_token hợp lệ; device flow trả `authorization_pending` rồi cấp token sau khi duyệt; refresh xoay vòng, dùng lại refresh cũ thì cả grant bị thu hồi; token sai `aud` bị từ chối | tester | Song song với T8 | `src/__tests__/oidc-flows.test.ts` |
| T8 | Đóng gói container `hoandat-auth`: Mongo qua `MONGO_URL` (database `auth`), key ký mount từ file secret (không commit), healthcheck `/healthz` | fullstack-developer (hạ tầng) | Song song với T7 | `Dockerfile`, `docker-compose.yml` |
| T9 | Tạo record `auth.hoandat.com` trên Cloudflare (proxy bật) và cấu hình TLS (cần user xác nhận) | fullstack-developer (hạ tầng) | — | Cloudflare zone `hoandat.com` |
| T10 | Deploy staging rồi production lên VPS, tạo file key ký trên VPS. Trước khi deploy phải kiểm Mongo dùng chung với Localman đã có trên VPS; chưa có thì dừng và báo user (cần user xác nhận) | fullstack-developer (hạ tầng) | — | VPS, `docker-compose.yml` |
| T11 | Chạy OpenID conformance suite (Basic OP và Config OP) trên staging, lưu kết quả | tester | — | staging `auth.hoandat.com` |
| T12 | Review cuối phase | code-reviewer | — | toàn phase |

### Checklist
- [x] T1 Repo `achoo254/hoandat-auth` đã tạo sau khi user xác nhận, đã clone về máy
- [x] T2 Server khởi động được, `/healthz` trả 200, env thiếu hoặc sai thì zod báo lỗi ngay lúc khởi động
- [x] T3 Adapter Mongo, JWKS nhiều key có `kid` và map claim hoạt động
- [x] T4 Discovery liệt kê đủ endpoint và feature; 3 client tĩnh cùng policy DCR đã khai báo, secret lấy từ env
- [x] T5 Rate-limit và trust proxy theo Cloudflare đã bật
- [x] T6 ADR `0001-own-oidc-idp.md` đã viết
- [x] T7 Test 4 luồng pass
- [ ] T8 Image build được, healthcheck xanh khi chạy compose local (Dockerfile và compose đã viết; máy dev không có Docker nên chưa build)
- [ ] T9 `auth.hoandat.com` phân giải qua Cloudflare và có TLS hợp lệ
- [ ] T10 Staging và production chạy, key ký nằm ngoài repo
- [ ] T11 Conformance Basic OP và Config OP pass trên staging
- [x] T12 Review không còn finding mức high
- [ ] Verification: Code + PKCE, device flow, refresh xoay vòng và từ chối `aud` sai đều pass bằng `openid-client`; conformance suite pass trên staging
- [x] lint/typecheck/test sạch: `pnpm lint` (Biome), `tsc --noEmit`, `pnpm test`
- [x] `pnpm check:mcp-coverage`: N/A (repo `hoandat-auth` không dùng operation registry của Localman)
