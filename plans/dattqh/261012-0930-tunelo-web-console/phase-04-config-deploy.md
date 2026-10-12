---
phase: 4
title: "Cấu hình, deploy, nghiệm thu"
status: in-progress
priority: P2
effort: "S"
dependencies: [1, 2, 3]
---

# Phase 04: Cấu hình và deploy (chỉ khi user yêu cầu tường minh)

## Steps
1. `.env` Tunelo trên .65 (sao lưu `.env.bak-<giờ>` mode 600): `TUNELO_WEB_CLIENT_SECRET` lấy đúng giá trị
   `TUNELO_WEB_CLIENT_SECRET` của IdP (không in ra), `WEB_SESSION_KEY` mới, `TUNELO_WEB_PUBLIC_URL`. Lưu bản sao vào
   iCloud `ENV production/` như các secret khác.
2. nginx `tunelo.conf`: host gốc đã proxy `location /` tới 3001, chỉ cần kiểm `/auth/*`, `/assets/*` đi đúng chỗ.
3. Deploy Tunelo (`infra/tunelo/deploy.sh`), rồi IdP nếu phase 03 đổi code.
4. Nghiệm thu thật: mở một tunnel bằng CLI build từ repo (1.7.0, `tunelo login` với tài khoản), đăng nhập ở
   `tunnel.hoandat.com` và thấy đúng tunnel đó; đăng xuất ở `auth.hoandat.com` ⟹ phiên Tunelo mất; 4 tunnel lab vẫn
   relay; `/api/tunnels`, `/login` không đổi.

## Rollback
Gỡ `TUNELO_WEB_*` khỏi `.env` rồi restart `tunelo` ⟹ web tắt; hoặc deploy lại commit trước.

## Kết quả (2026-10-12)
- IdP deploy `b366c36` (tunelo-web gắn phiên IdP, không còn `offline_access`), 10:08; `/healthz`, discovery, `/jwks`,
  `/apps` 200; `tunelo-web` xin `offline_access` ⟹ `invalid_scope`.
- `.env` Tunelo (sao lưu `.env.bak-261012-101207`): 4 biến web; secret chép thẳng từ `.env` IdP trên server, khoá phiên
  sinh trên server; bản sao ở iCloud `ENV production/tunelo/.env` (bản cũ sao lưu cạnh nó).
- Deploy Tunelo `85570b2` qua `infra/tunelo/deploy.sh` (bản cũ: `server.mjs.bak-pre-web-console`): log
  `Web console enabled`, 4 tunnel nối lại, `/` 200 với CSP `script-src 'none'`, `/assets/css/*` 200, `/health` 200,
  `/api/tunnels` 401, `/login` 302, `/auth/login` ⟹ IdP `client_id=tunelo-web`, `scope=openid profile`, PKCE S256 ⟹
  "Sign in to continue to Tunelo"; relay subdomain hai tên miền, `cloudpanel-dev`, `s3.inetdev`, `miu-staging` 200.
- Còn: đăng nhập thật bằng tài khoản Google/GitHub và đăng xuất ở IdP (cần người dùng); kiểm logout token thật đi qua
  `verifyLogoutToken` (review L9).
