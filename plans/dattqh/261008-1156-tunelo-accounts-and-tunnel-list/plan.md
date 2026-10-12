---
title: "Tunelo: tài khoản qua auth.hoandat.com và API liệt kê tunnel (trong monorepo localman-next)"
description: "Tunelo CLI và server dùng IdP chung để đăng nhập một lần; token gắn với tài khoản; Localman liệt kê tunnel theo tài khoản, giữ `tunelo link` cho máy chưa gắn tài khoản."
status: in-progress
priority: P1
effort: "L (3 phase: 1×L, 1×M, 1×S)"
branch: ""
tags: [feature, auth, api, cli]
blockedBy: ["plans/dattqh/261008-1325-central-auth-idp", "plans/dattqh/261008-1123-localman-core#phase-01"]
blocks: ["plans/dattqh/261008-1123-localman-core#phase-10"]
created: 2026-10-08
---

# Tunelo: tài khoản qua IdP chung và API liệt kê tunnel

**Vị trí code:** từ 2026-10-08, Tunelo được **gộp vào monorepo `achoo254/localman-next`** (user chốt; phase 01 của plan Localman thực hiện việc gộp, giữ nguyên lịch sử). Mọi path trong plan này tính từ root monorepo:
- `apps/tunelo-server/` (trước là `packages/server/`)
- `packages/tunelo-cli/` (npm `tunelo`, trước là `packages/client/`)
- `packages/tunelo-shared/` (`@tunelo/shared`)
- `infra/tunelo/`, `docs/tunelo/`

Plan này được chuyển từ repo Tunelo cũ sang thư mục plans chung, vì repo cũ sẽ được archive.

## Mục tiêu
1. **Đăng nhập một lần:** `tunelo login` chạy OAuth Device Flow với `auth.hoandat.com`. Nếu trình duyệt đã có phiên (ví dụ vừa dùng Localman) thì chỉ cần bấm "Cho phép". Trang approve **bắt buộc đăng nhập**, vá lỗ hiện tại là ai có link cũng duyệt được.
2. **Token gắn với tài khoản** (`sub`). Token ẩn danh cũ vẫn chạy **60 ngày**, CLI nhắc đăng nhập; quá hạn thì không mở tunnel được nữa (Jev 0.99).
3. **Localman tự nhận tunnel:**
   - `GET /api/tunnels` liệt kê theo tài khoản, bằng token `aud=https://tunnel.hoandat.com`, `scope=tunnels:read` mà Localman đổi được qua token exchange.
   - Giữ `tunelo link <code>` cho máy chưa gắn tài khoản (Jev 0.56).
   - Liệt kê cả tunnel TCP (Jev 0.53). Localman gọi khi cần, không đẩy realtime (Jev 0.95).

## Hiện trạng (đã đọc code ở repo Tunelo cũ)
- **Chưa có tài khoản.** `tunelo login` mở trang `/login?req=<id>` (`api/render-login-page.ts`), nút Approve **không kiểm danh tính**. Token gắn theo máy; `issueAccessToken` thu hồi mọi token cùng `deviceId`.
- **Tunnel nằm trong bộ nhớ** của `TunnelManager`, server chạy 1 instance (PM2 fork). CLI đã gửi `localPort` khi đăng ký, nhưng server chưa lưu.
- **Phát hành:** `.github/workflows/publish-cli.yml` publish npm khi có tag `vX.Y.Z`. Trong monorepo đổi sang tag **`tunelo-vX.Y.Z`** (Jev 0.70) để không trùng tag `v0.x` của Localman.
- **Deploy server:** PM2 qua `infra/deploy.sh`, giữ nguyên trong plan này (Jev 0.98).

## Phases
| # | Phase | Tier | Phụ thuộc |
|---|---|---|---|
| 01 | [Server: xác minh token của IdP, tài khoản, scope, API liệt kê tunnel, link-code](phase-01-server-accounts-and-tunnel-list.md) | L | IdP phase 03, Localman phase 01 |
| 02 | [CLI: đăng nhập bằng device flow, refresh, link, nhắc token ẩn danh](phase-02-cli-device-login.md) | M | 01 |
| 03 | [Docs, ADR, phát hành `tunelo-v1.7.0`, deploy, ngày chặn token ẩn danh](phase-03-docs-release-cutoff.md) | S | 01, 02 |

## Acceptance
- `tunelo login` dùng device flow với IdP. Trình duyệt đã có phiên thì không hỏi mật khẩu. Không còn trang approve ẩn danh.
- Tunnel mở bằng token tài khoản có `ownerSub`. `GET /api/tunnels` với token đổi từ Localman trả mọi tunnel (HTTP và TCP) trên mọi máy của user đó, kèm `localPort`, `protocol`, `deviceName`, `connectedAt`, `basicAuth`.
- Token `tunnels:read` không mở được tunnel (`TUNELO_AUTH_003`), và không thấy tunnel của tài khoản khác.
- Token ẩn danh vẫn mở tunnel tới `LEGACY_TOKEN_CUTOFF`. CLI in nhắc mỗi lần chạy; sau ngày đó thì bị từ chối kèm hướng dẫn `tunelo login`.
- `tunelo link <code>` vẫn chạy cho máy ẩn danh. Token chỉ đọc cấp từ link **không** bị thu hồi khi `tunelo login` lại.
- Test pass (`pnpm --filter @tunelo/server test`, `--filter tunelo test`, E2E) và Biome sạch.

## Rủi ro
| Rủi ro | Giảm thiểu |
|---|---|
| IdP sập thì không login được CLI | Token đang có vẫn chạy tới khi hết hạn; refresh thử lại có backoff; tunnel đang mở không bị ngắt |
| Access token ngắn hạn hết hạn giữa phiên WebSocket | Chỉ xác thực lúc bắt tay; reconnect thì CLI refresh trước; server không cắt kết nối đang chạy khi token hết hạn |
| Người dùng CLI cũ (1.6.x) bị chặn đột ngột | Grace 60 ngày, CLI 1.7.0 in nhắc, README và changelog thông báo rõ ngày |
| Danh sách tunnel trong bộ nhớ khi scale nhiều instance | Ghi chú ADR; khi scale thì chuyển registry sang Valkey |

## Rollback
Server có cờ `AUTH_MODE=legacy|hybrid` (mặc định `hybrid`): `legacy` tắt nhánh OIDC, quay về hành vi cũ. Token có scope do link cấp: trước khi về server cũ phải chạy `ApiKey.updateMany({scopes: 'tunnels:read'}, {status: 'revoked'})`, vì server cũ không đọc scope và sẽ coi đó là token đầy đủ quyền.
