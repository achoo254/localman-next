---
phase: 3
title: "Docs, ADR, phát hành tunelo-v1.7.0, deploy, ngày chặn token ẩn danh"
status: in-progress
priority: P2
effort: "S"
dependencies: [1, 2]
---

# Phase 03: Docs, phát hành, cutoff

## Docs
- MỚI `docs/decisions/tunelo/0004-accounts-via-central-idp.md`: vì sao dùng IdP chung, device flow, scope, link-code cho máy ẩn danh, và grace 60 ngày.
- `docs/tunelo/README.md` (bản VI và EN): đăng nhập kiểu mới, `whoami`, `link`, và ngày cutoff.
- `docs/tunelo/system-architecture.md`: luồng xác thực mới và `GET /api/tunnels`.
- `CLAUDE.md` của monorepo, mục Tunelo: thêm mã lỗi `TUNELO_AUTH_003` (token không đủ scope), `TUNELO_AUTH_004` (token ẩn danh hết hạn), `TUNELO_LINK_001` (mã sai hoặc hết hạn), `TUNELO_LINK_002` (bị khoá vì sai nhiều lần).

## Domain `tunnel.hoandat.com` (user chốt 2026-10-08: tập trung vào `hoandat.com`, bỏ domain tunnel cũ sau khi domain mới chạy ổn)
1. **Cloudflare DNS** (zone `hoandat.com`): record A `tunnel` và `*.tunnel` trỏ về VPS Tunelo, để **DNS only** (đám mây xám). Lý do: Universal SSL miễn phí của Cloudflare chỉ phủ wildcard một cấp, không phủ `*.tunnel.hoandat.com`; ngoài ra Tunelo cần WebSocket dài và cổng TCP riêng.
2. **TLS:** cấp chứng chỉ wildcard Let's Encrypt bằng `certbot --dns-cloudflare` cho `tunnel.hoandat.com` và `*.tunnel.hoandat.com`. Token Cloudflare chỉ có quyền `Zone:DNS:Edit` trên zone `hoandat.com`, lưu ở `/etc/letsencrypt/cloudflare.ini` (quyền 600). Bật timer tự gia hạn. Đây là cách cũ đang dùng, nay tự động hoá bằng plugin Cloudflare.
3. **nginx** (`infra/tunelo/nginx.conf`): `server_name tunnel.hoandat.com *.tunnel.hoandat.com;` cùng cert mới. Sửa `infra/tunelo/certbot-setup.sh` để dùng domain mới, và đặt Option B (Cloudflare plugin) làm mặc định.
4. **Chuyển đổi:** đặt `TUNNEL_DOMAINS=tunnel.hoandat.com,<domain cũ>` để chạy song song, publish CLI 1.7.0 (mặc định domain mới), rồi theo dõi lưu lượng vào domain cũ.
5. **Gỡ domain cũ:** khi CLI 1.7.0 đã phát hành và lưu lượng vào domain cũ không đáng kể, bỏ domain cũ khỏi `TUNNEL_DOMAINS`, nginx và DNS, rồi thu hồi cert cũ. CLI 1.6.x (mặc định domain cũ) lúc đó sẽ không kết nối được và phải `npm i -g tunelo@latest`. Ghi rõ điều này trong changelog và README.

## Phát hành và deploy
1. **Deploy server trước**, giữ PM2 và `infra/tunelo/deploy.sh` (Jev 0.98). Đặt `AUTH_MODE=hybrid`, cùng `LEGACY_TOKEN_CUTOFF` = ngày deploy + 60 ngày.
2. Workflow `.github/workflows/tunelo-publish-cli.yml` (đổi từ `publish-cli.yml`) chạy khi có tag `tunelo-v*`, với `working-directory: packages/tunelo-cli`. Publish `tunelo@1.7.0`.
3. Ghi changelog và đăng thông báo trong README: ngày chặn token ẩn danh, và lệnh `npm i -g tunelo@latest && tunelo login`.
4. Tới ngày cutoff: phát hành `tunelo-v2.0.0`, bỏ hẳn luồng ẩn danh và trang approve cũ, rồi xoá code legacy.

## Verification
- Sau deploy: CLI 1.6.x vẫn `tunelo http` được (trước cutoff). CLI 1.7.0 thì `login`, `http`, `whoami` chạy đúng.
- Localman staging tự nhận tunnel theo tài khoản.

## Giao việc
**Đợt:** 4 · **Phụ thuộc trước khi bắt đầu:** phase 01 và 02 đã merge; IdP production đã seed client `tunelo-cli` và `tunelo-web`; token Cloudflare `Zone:DNS:Edit` cho zone `hoandat.com` có sẵn (T5) · **Lệnh cook:** `/ak:cook plans/dattqh/261008-1156-tunelo-accounts-and-tunnel-list/phase-03-docs-release-cutoff.md`

| # | Việc | Vai trò | Song song | File chính |
|---|---|---|---|---|
| T1 | ADR về tài khoản qua IdP chung (device flow, scope, link-code cho máy ẩn danh, grace 60 ngày, registry trong bộ nhớ khi scale) và cập nhật kiến trúc với luồng xác thực mới cùng `GET /api/tunnels` | docs-manager | Song song với T2, T3, T4 | `docs/decisions/tunelo/0004-accounts-via-central-idp.md`, `docs/tunelo/system-architecture.md` |
| T2 | README VI và EN (đăng nhập kiểu mới, `whoami`, `link`, ngày cutoff, lệnh `npm i -g tunelo@latest && tunelo login`, CLI 1.6.x mất kết nối khi gỡ domain cũ), changelog, và bảng mã lỗi `TUNELO_AUTH_003`, `TUNELO_AUTH_004`, `TUNELO_LINK_001`, `TUNELO_LINK_002` trong mục Tunelo của `CLAUDE.md` | docs-manager | Song song với T1, T3, T4 | `docs/tunelo/README.md` (VI và EN), changelog của `packages/tunelo-cli`, `CLAUDE.md` |
| T3 | nginx nhận `tunnel.hoandat.com *.tunnel.hoandat.com` cùng cert mới; `certbot-setup.sh` dùng domain mới và đặt Option B (plugin Cloudflare) làm mặc định | fullstack-developer (hạ tầng) | Song song với T1, T2, T4 | `infra/tunelo/nginx.conf`, `infra/tunelo/certbot-setup.sh` |
| T4 | Kiểm workflow publish (đã đổi tên ở Localman phase 01): chạy theo tag `tunelo-v*`, `working-directory: packages/tunelo-cli` | fullstack-developer (hạ tầng) | Song song với T1, T2, T3 | `.github/workflows/tunelo-publish-cli.yml` |
| T5 | Cloudflare: record A `tunnel` và `*.tunnel` trỏ VPS Tunelo ở chế độ DNS only; cấp cert wildcard Let's Encrypt bằng `certbot --dns-cloudflare` với token chỉ có `Zone:DNS:Edit`, lưu `/etc/letsencrypt/cloudflare.ini` quyền 600, bật timer gia hạn (cần user xác nhận) | fullstack-developer (hạ tầng) | — (sau T3) | Cloudflare zone `hoandat.com`, VPS Tunelo |
| T6 | Deploy server trước bằng PM2 qua `infra/tunelo/deploy.sh` với `AUTH_MODE=hybrid`, `LEGACY_TOKEN_CUTOFF` = ngày deploy + 60 ngày, `TUNNEL_DOMAINS=tunnel.hoandat.com,<domain cũ>` (cần user xác nhận) | fullstack-developer (hạ tầng) | — (sau T5) | VPS Tunelo, `infra/tunelo/deploy.sh` |
| T7 | Đẩy tag `tunelo-v1.7.0` để publish `tunelo@1.7.0` lên npm (cần user xác nhận) | fullstack-developer (hạ tầng) | — (sau T6) | tag `tunelo-v1.7.0` |
| T8 | Kiểm sau deploy: CLI 1.6.x vẫn `tunelo http` được trước cutoff; CLI 1.7.0 `login`, `http`, `whoami` chạy đúng; `GET /api/tunnels` bằng token đổi từ Localman staging trả đúng tunnel theo tài khoản | tester | — (sau T7) | staging và production Tunelo |
| T9 | Gỡ domain cũ khi lưu lượng vào domain cũ không đáng kể: bỏ khỏi `TUNNEL_DOMAINS`, nginx và DNS, thu hồi cert cũ (cần user xác nhận) | fullstack-developer (hạ tầng) | — | `infra/tunelo/nginx.conf`, Cloudflare, VPS |
| T10 | Tới ngày cutoff: bỏ hẳn luồng ẩn danh và trang approve cũ, xoá code legacy, phát hành `tunelo-v2.0.0` (cần user xác nhận) | fullstack-developer | — | `apps/tunelo-server/src/`, `packages/tunelo-cli/src/` |
| T11 | Review cuối phase | code-reviewer | — | toàn phase |

### Checklist
- [ ] T1 ADR 0004 và `system-architecture.md` đã cập nhật
- [ ] T2 README VI/EN, changelog và bảng mã lỗi trong `CLAUDE.md` đã cập nhật
- [x] T3 nginx và `certbot-setup.sh` dùng domain mới, Option B mặc định
- [ ] T4 Workflow publish đúng tag và thư mục
- [x] T5 DNS và cert wildcard `*.tunnel.hoandat.com` đã có sau khi user xác nhận, timer gia hạn bật
- [ ] T6 Server chạy `AUTH_MODE=hybrid` với cutoff và 2 domain sau khi user xác nhận
- [ ] T7 `tunelo@1.7.0` có trên npm sau khi user xác nhận
- [ ] T8 Kiểm sau deploy pass
- [ ] T9 Domain cũ đã gỡ sau khi user xác nhận (theo dõi tới khi lưu lượng cũ không đáng kể)
- [ ] T10 `tunelo-v2.0.0` phát hành sau khi user xác nhận (theo dõi tới ngày cutoff)
- [ ] T11 Review không còn finding mức high
- [ ] Verification: sau deploy CLI 1.6.x vẫn chạy trước cutoff, CLI 1.7.0 `login`/`http`/`whoami` đúng, Localman staging nhận tunnel theo tài khoản
- [ ] lint/typecheck/test sạch: `biome check`, `tsc --noEmit`, `pnpm --filter @tunelo/server test`, `pnpm --filter tunelo test`
- [ ] `pnpm check:mcp-coverage` pass
