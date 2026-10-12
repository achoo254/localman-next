---
phase: 2
title: "CLI: đăng nhập bằng device flow, refresh, link, nhắc token ẩn danh"
status: completed
priority: P1
effort: "M"
dependencies: [1]
---

# Phase 02: CLI Tunelo (`packages/tunelo-cli`, npm `tunelo`)

## Goal
`tunelo login` đăng nhập qua `auth.hoandat.com` bằng OAuth Device Authorization Grant (RFC 8628). Access token tự refresh. CLI nhắc người đang dùng token ẩn danh chuyển sang tài khoản, và giữ `tunelo link` cho máy chưa đăng nhập.

## Files và thay đổi
- `packages/tunelo-cli/src/cli-login-command.ts`:
  - `tunelo login` gọi `POST /device/auth` của IdP (client `tunelo-cli`, scope `openid tunnels:open tunnels:read offline_access`, `resource=https://tunnel.hoandat.com`).
  - In `user_code` và mở `verification_uri_complete`, rồi poll `/token`.
  - Lưu refresh token vào `~/.tunelo/config.json` (quyền 600), không in token ra màn hình.
  - Có tuỳ chọn `--legacy-key <key>` cho CI.
- MỚI `packages/tunelo-cli/src/idp-session.ts`: refresh access token trước khi mở WebSocket và trước mỗi lần reconnect; refresh lỗi thì báo `tunelo login` lại.
- `packages/tunelo-cli/src/cli-login-command.ts` (logout): `tunelo logout` thu hồi refresh token ở IdP (`/token/revocation`) rồi xoá config.
- MỚI `packages/tunelo-cli/src/cli-whoami-command.ts`: `tunelo whoami` in username và tài khoản, hoặc "ẩn danh, hết hạn ngày …".
- MỚI `packages/tunelo-cli/src/cli-link-command.ts`:
  - `tunelo link <code>` (chỉ cho máy ẩn danh; máy đã đăng nhập thì báo "không cần, Localman tự thấy tunnel theo tài khoản").
  - `tunelo links` và `tunelo links revoke <id>`.
- `packages/tunelo-cli/src/display.ts`: máy đang dùng token ẩn danh thì mỗi lần chạy in một dòng nhắc kèm ngày cutoff.
- Server mặc định của CLI đổi sang `https://tunnel.hoandat.com`. Config cũ trỏ domain cũ thì tự chuyển sang domain mới, kèm một dòng thông báo.
- MỚI `packages/tunelo-cli/src/mcp/` cho lệnh **`tunelo mcp`**: MCP server **chạy local** qua stdio (Jev 0.89), dùng phiên đăng nhập của CLI.
  - Tool: `open_http_tunnel(port, subdomain?, sso?, allow?, ip?, ttl?)`, `open_tcp_tunnel(port, ttl, sso|ip bắt buộc)`, `list_local_tunnels`, `close_tunnel(id)` (`destructiveHint`), `tunnel_status`, `whoami`.
  - Tunnel do MCP mở chạy trong tiến trình của `tunelo mcp` và tự đóng khi tiến trình thoát.
  - Cách thêm vào agent, ví dụ: `claude mcp add tunelo -- tunelo mcp`.
- `packages/tunelo-cli/package.json`: version **1.7.0**, field `repository` trỏ về monorepo `achoo254/localman-next` (`directory: packages/tunelo-cli`).

## Verification
- `tunelo mcp`: chạy client MCP của TypeScript SDK qua stdio để mở tunnel tới server HTTP mẫu, gọi được URL công khai, rồi `close_tunnel`. Thoát tiến trình thì mọi tunnel do MCP mở đều đóng.
- Unit: poll device flow (`authorization_pending`, `slow_down`, `expired_token`), refresh và xoay vòng token, file config có quyền 600, và dòng nhắc cho máy ẩn danh.
- E2E (`tests/tunelo/e2e/` trong monorepo, chạy với IdP và server local):
  - `tunelo login` (duyệt trên trình duyệt headless), `tunelo http 3000`, rồi `GET /api/tunnels` bằng token đổi từ Localman thấy đúng tunnel.
  - `tunelo logout` thu hồi được token.

## Giao việc
**Đợt:** 4 · **Phụ thuộc trước khi bắt đầu:** phase 01 đã merge; staging IdP có client `tunelo-cli` (device flow, revocation) và server Tunelo staging chạy bản phase 01 cho E2E · **Lệnh cook:** `/ak:cook plans/dattqh/261008-1156-tunelo-accounts-and-tunnel-list/phase-02-cli-device-login.md`

| # | Việc | Vai trò | Song song | File chính |
|---|---|---|---|---|
| T1 | Phiên IdP của CLI: đọc endpoint từ discovery, refresh access token trước khi mở WebSocket và trước mỗi lần reconnect, thử lại có backoff, refresh lỗi thì báo `tunelo login` lại; lưu `~/.tunelo/config.json` quyền 600 | fullstack-developer | — | `packages/tunelo-cli/src/idp-session.ts` |
| T2 | `tunelo login` bằng device flow (client `tunelo-cli`, scope `openid tunnels:open tunnels:read offline_access`, `resource=https://tunnel.hoandat.com`): in `user_code`, mở `verification_uri_complete`, poll xử lý `authorization_pending`, `slow_down`, `expired_token`, không in token; tuỳ chọn `--legacy-key`; `tunelo logout` thu hồi refresh token qua `revocation_endpoint` của discovery rồi xoá config; server mặc định đổi sang `https://tunnel.hoandat.com`, config trỏ domain cũ thì tự chuyển kèm một dòng thông báo | fullstack-developer | — (sau T1) | `packages/tunelo-cli/src/cli-login-command.ts` |
| T3 | `tunelo whoami` in username hoặc "ẩn danh, hết hạn ngày …"; máy dùng token ẩn danh thì mỗi lần chạy in một dòng nhắc kèm ngày cutoff | fullstack-developer | Song song với T2, T4, T5 (sau T1) | `packages/tunelo-cli/src/cli-whoami-command.ts`, `packages/tunelo-cli/src/display.ts` |
| T4 | `tunelo link <code>` (chỉ cho máy ẩn danh; máy đã đăng nhập thì báo không cần), `tunelo links`, `tunelo links revoke <id>` | fullstack-developer | Song song với T2, T3, T5 | `packages/tunelo-cli/src/cli-link-command.ts` |
| T5 | `tunelo mcp`: MCP server stdio dùng phiên của CLI, 6 tool `open_http_tunnel`, `open_tcp_tunnel`, `list_local_tunnels`, `close_tunnel` (`destructiveHint`), `tunnel_status`, `whoami`; tunnel do MCP mở tự đóng khi tiến trình thoát | fullstack-developer | Song song với T2, T3, T4 (sau T1) | `packages/tunelo-cli/src/mcp/` |
| T6 | Đăng ký lệnh mới vào entry của CLI; `package.json` lên version 1.7.0, field `repository` trỏ `achoo254/localman-next` với `directory: packages/tunelo-cli` | fullstack-developer | — (sau T2–T5) | entry lệnh trong `packages/tunelo-cli/src/`, `packages/tunelo-cli/package.json` |
| T7 | Unit test: poll device flow (3 mã lỗi), refresh và xoay vòng token, file config quyền 600, dòng nhắc cho máy ẩn danh | tester | Song song với T8 | `packages/tunelo-cli/src/**/__tests__/` |
| T8 | Test `tunelo mcp` bằng client MCP của TypeScript SDK qua stdio (mở tunnel tới server HTTP mẫu, gọi URL công khai, `close_tunnel`, thoát thì mọi tunnel đóng); E2E với IdP và server local: `tunelo login` duyệt bằng trình duyệt headless, `tunelo http 3000`, `GET /api/tunnels` bằng token đổi từ Localman thấy đúng tunnel, `tunelo logout` thu hồi được token | tester | Song song với T7 | `tests/tunelo/e2e/`, test MCP trong `packages/tunelo-cli/src/mcp/` |
| T9 | Review cuối phase | code-reviewer | — | toàn phase |

### Checklist
- [x] T1 `idp-session` refresh đúng lúc, config quyền 600
- [x] T2 `login`, `logout`, `--legacy-key` và chuyển domain mặc định chạy đúng
- [x] T3 `whoami` và dòng nhắc ẩn danh kèm ngày cutoff
- [x] T4 `link`, `links`, `links revoke` chạy đúng
- [x] T5 `tunelo mcp` có đủ 6 tool, tunnel đóng khi tiến trình thoát
- [x] T6 Lệnh đã đăng ký, `tunelo` version 1.7.0, `repository` đúng
- [x] T7 Unit test pass
- [x] T8 Test MCP stdio và E2E pass
- [x] T9 Review không còn finding mức high
- [ ] Verification: MCP stdio mở và đóng tunnel; unit cho device flow, refresh, quyền file, dòng nhắc; E2E login, http, liệt kê qua token đổi từ Localman và logout pass
- [x] lint/typecheck/test sạch: `biome check`, `tsc --noEmit`, `pnpm --filter tunelo test`
- [x] `pnpm check:mcp-coverage` pass
