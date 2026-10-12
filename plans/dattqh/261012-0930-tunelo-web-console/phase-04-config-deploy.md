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
