---
phase: 4
title: "Tunelo cho vận hành: tunnel có SSO, IP allowlist, token CI, tunnel TCP có TTL"
status: pending
priority: P1
effort: "L"
dependencies: [1]
---

# Phase 04: Tunelo cho vận hành

## Goal
Tunelo dùng an toàn được cho việc vận hành:
- **Tunnel có đăng nhập SSO** (Jev 0.70): URL tunnel chỉ mở được sau khi đăng nhập `auth.hoandat.com` và có tên trong danh sách cho phép.
- **IP allowlist.**
- **Token máy cho CI** (phase 01).
- **Tunnel TCP cho vận hành** (Jev 0.52, sát ngưỡng): cấp quyền DB hoặc SSH tạm thời, có TTL và audit.

Đối thủ của phần này là ngrok và Cloudflare Tunnel, cả hai đều có OAuth/OIDC gate. Điểm khác của Tunelo là gắn sẵn với tài khoản và workspace của Localman, cùng một nơi đăng nhập.

## Thiết kế (path tính từ monorepo)
- **SSO gate** ở `apps/tunelo-server` (relay):
  - Tunnel đăng ký với `access: {mode: 'public'|'sso', allow: ['user:<username>', 'workspace:<id>', 'email-domain:<x>']}`.
  - Request chưa có cookie gate thì redirect sang IdP (client `tunelo-gate`), callback đặt cookie `__Host-tunelo_gate` theo **từng subdomain**, rồi kiểm `allow` lại mỗi khi phiên được làm mới.
  - Request API không chạy trình duyệt được thì cho qua bằng header `Authorization: Bearer <PAT có scope tunnels:access>`.
- **IP allowlist:** `access.ipAllow: ['1.2.3.4/32', …]`, kiểm sau khi xác định IP thật từ proxy tin cậy (nginx hoặc Cloudflare).
- **CLI:**
  - `tunelo http 3000 --sso [--allow user:dat,workspace:team-a] [--ip 1.2.3.0/24]`
  - `tunelo tcp 5432 --ttl 2h --sso --allow user:ops1`: TCP **bắt buộc** chọn `--sso` hoặc `--ip`. Phía client, TCP kết nối qua `tunelo connect <tunnel> --local 15432` (đã có cơ chế WebSocket cho TCP), sau khi xác thực bằng phiên IdP của người kết nối.
- **Token CI:** `TUNELO_TOKEN` là token của service account (scope `tunnels:open`). TTL tunnel mặc định 1 giờ khi chạy trong CI. Mọi lần mở hay đóng tunnel đều ghi audit (phase 01).
- **UI quản lý:** trang Tunnels trong Localman, tab Tunelo của workspace: liệt kê tunnel đang mở (theo tài khoản và workspace), sửa allowlist, đóng tunnel từ xa, xem audit.

## MCP và workspace (Jev 2026-10-08)
- **MCP** (0.98): agent thao tác tunnel qua các operation trong registry của **Localman** (toolset `tunnels`). Các operation này gọi API quản trị của `tunelo-server`. Route của `tunelo-server` (`/api/links/*`, `/api/tunnels`, admin) là nội bộ, không tính vào `check:mcp-coverage`; ghi rõ trong `docs/tunelo/system-architecture.md`.
- **SSO gate** kiểm `allow: workspace:<id>` bằng API nội bộ của Localman `GET /internal/users/:sub/workspaces` (0.78), cache 60 giây.

## Files to Create / Modify
- `apps/tunelo-server/src/access/` (`sso-gate.ts`, `ip-allowlist.ts`, `gate-session-store.ts` dùng Valkey sẵn có), sửa `request-relay.ts`, `tcp-ws-handler.ts`, `ws-handler.ts` để nhận `access` lúc đăng ký
- `packages/tunelo-shared/src/protocol.ts`: thêm field `access` vào `RegisterTunnelMessage` (tuỳ chọn, tương thích ngược)
- `packages/tunelo-cli/src/` thêm cờ `--sso`, `--allow`, `--ip`, `--ttl`; thêm lệnh `connect`
- Localman: `apps/api/src/modules/tunnels-admin/` (operation registry: liệt kê, sửa quyền truy cập, đóng tunnel, gọi API quản trị của `tunelo-server` bằng token đổi `aud=https://tunnel.hoandat.com`), `apps/web/src/features/tunnels-admin/`
- `apps/tunelo-server/src/api/admin-tunnel-routes.ts`: `PATCH /api/tunnels/:id/access`, `DELETE /api/tunnels/:id` (owner hoặc admin workspace)
- IdP: client `tunelo-gate` (Code + PKCE, redirect wildcard theo subdomain được kiểm chặt)

## Verification
- Mọi operation của phase này có MCP tool trong toolset tương ứng (`pnpm check:mcp-coverage`); tool phá huỷ có dry-run kèm `confirm_token`.
- E2E: tunnel `--sso --allow user:a`. User A vào được; user B nhận 403; chưa đăng nhập thì bị redirect. Có PAT `tunnels:access` thì gọi API được.
- IP ngoài allowlist nhận 403.
- `tunelo tcp` thiếu cả `--sso` lẫn `--ip` bị từ chối. Hết TTL thì kết nối bị đóng. Audit ghi đủ.
- Tunnel không có `access` vẫn chạy như cũ (regression).

## Giao việc
**Đợt:** 9 · **Phụ thuộc trước khi bắt đầu:** DevOps phase 01 (PAT `tunnels:access`, service account, audit) đã merge; plan Tunelo đã xong; Valkey có sẵn cho server Tunelo. T2 làm ở repo `hoandat-auth`, còn lại ở monorepo · **Lệnh cook:** `/ak:cook plans/dattqh/261008-1337-devops-toolkit/phase-04-tunelo-ops.md`

| # | Việc | Vai trò | Song song | File chính |
|---|---|---|---|---|
| T1 | Thêm field `access` tuỳ chọn (`mode`, `allow`, `ipAllow`) vào `RegisterTunnelMessage`, tương thích ngược | fullstack-developer | Song song với T2 | `packages/tunelo-shared/src/protocol.ts` |
| T2 | [hoandat-auth] Client `tunelo-gate`: Code + PKCE, redirect wildcard theo subdomain `*.tunnel.hoandat.com` được kiểm chặt | fullstack-developer | Song song với T1 | `src/oidc/clients.ts` |
| T3 | SSO gate: request chưa có cookie thì redirect sang IdP, callback đặt cookie `__Host-tunelo_gate` theo từng subdomain, kiểm `allow` lại mỗi khi phiên được làm mới; request API qua được bằng `Authorization: Bearer` PAT có scope `tunnels:access`; phiên gate lưu trong Valkey; các màn chờ, chọn tài khoản và 403 theo prototype `devops.html` màn `#/gate/tn-ops` | fullstack-developer | Song song với T4, T6 (sau T1, T2) | `apps/tunelo-server/src/access/sso-gate.ts`, `apps/tunelo-server/src/access/gate-session-store.ts` |
| T4 | IP allowlist kiểm sau khi lấy IP thật từ proxy tin cậy (nginx hoặc Cloudflare) | fullstack-developer | Song song với T3, T6 | `apps/tunelo-server/src/access/ip-allowlist.ts` |
| T5 | Nối `access` vào relay: nhận `access` lúc đăng ký, HTTP đi qua gate và allowlist, TCP bắt buộc có `--sso` hoặc `--ip`; TTL tunnel (tối đa 8 giờ, mặc định 1 giờ khi chạy trong CI), hết TTL thì đóng kết nối; mở và đóng tunnel đều ghi audit | fullstack-developer | — (sau T3, T4) | `apps/tunelo-server/src/ws-handler.ts`, `apps/tunelo-server/src/request-relay.ts`, `apps/tunelo-server/src/tcp-ws-handler.ts` |
| T6 | CLI: cờ `--sso`, `--allow`, `--ip`, `--ttl` cho `tunelo http` và `tunelo tcp`; lệnh `tunelo connect <tunnel> --local <port>` xác thực bằng phiên IdP của người kết nối | fullstack-developer | Song song với T3, T4 (sau T1) | `packages/tunelo-cli/src/` |
| T7 | API quản trị tunnel cho toolset `tunnels`: liệt kê tunnel theo workspace, sửa allowlist, đóng tunnel từ xa (`close_tunnel` có dry-run kèm `confirm_token`). Phần Files của phase chưa liệt kê module này nhưng nó cần để có MCP tool theo mục MCP của plan | fullstack-developer | — (sau T5) | `apps/api/src/modules/` (module quản trị tunnel), endpoint quản trị trong `apps/tunelo-server/src/api/` |
| T8 | Trang Tunnels của workspace (tab Tunelo): danh sách tunnel đang mở theo tài khoản và workspace, sửa allowlist, đóng từ xa, xem audit, modal tunnel TCP cho vận hành. Theo prototype `devops.html` màn `#/tunnels` | fullstack-developer | — (sau T7) | `apps/web/src/features/tunnels-admin/` |
| T9 | Test E2E: tunnel `--sso --allow user:a` thì user A vào được, user B nhận 403, chưa đăng nhập thì bị redirect, PAT `tunnels:access` gọi được API; IP ngoài allowlist nhận 403; `tunelo tcp` thiếu cả `--sso` lẫn `--ip` bị từ chối; hết TTL thì đóng kết nối; audit ghi đủ; tunnel không có `access` vẫn chạy như cũ | tester | — (sau T5–T8) | test của `apps/tunelo-server/src/access/`, `tests/tunelo/e2e/` |
| T10 | Deploy client `tunelo-gate` lên IdP production, deploy server Tunelo và phát hành bản minor mới của `tunelo` qua tag `tunelo-v*` (cần user xác nhận) | fullstack-developer (hạ tầng) | — (sau T9) | VPS IdP, VPS Tunelo, tag `tunelo-v*` |
| T11 | Review cuối phase | code-reviewer | — | toàn phase |

### Checklist
- [ ] T1 Protocol có `access` tuỳ chọn, CLI cũ vẫn đăng ký được
- [ ] T2 Client `tunelo-gate` có ở IdP, redirect wildcard kiểm chặt
- [ ] T3 SSO gate, cookie theo subdomain và Bearer PAT chạy đúng
- [ ] T4 IP allowlist dùng IP thật từ proxy tin cậy
- [ ] T5 Relay áp `access`, TCP bắt buộc SSO hoặc IP, TTL và audit
- [ ] T6 Cờ CLI mới và `tunelo connect`
- [ ] T7 API quản trị tunnel và MCP tool trong toolset `tunnels`
- [ ] T8 Trang Tunnels khớp prototype
- [ ] T9 E2E và regression pass
- [ ] T10 IdP, server Tunelo và CLI mới đã phát hành sau khi user xác nhận
- [ ] T11 Review không còn finding mức high
- [ ] Verification: SSO cho user A, 403 cho user B, redirect khi chưa đăng nhập, PAT `tunnels:access` gọi được API; IP ngoài allowlist 403; TCP thiếu SSO và IP bị từ chối; hết TTL đóng kết nối; tunnel không có `access` không đổi hành vi; tool phá huỷ có dry-run kèm `confirm_token`
- [ ] lint/typecheck/test sạch: `biome check`, `tsc --noEmit`, `pnpm --filter @tunelo/server test`, `pnpm --filter tunelo test`, test của `apps/api` và `apps/web`
- [ ] `pnpm check:mcp-coverage` pass
