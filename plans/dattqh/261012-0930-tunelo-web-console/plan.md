---
title: "Tunelo web: trang đăng nhập và danh sách tunnel tại tunnel.hoandat.com"
description: "tunnel.hoandat.com có trang thật: đăng nhập qua auth.hoandat.com bằng client tunelo-web, xem tunnel đang chạy theo máy, hướng dẫn bắt đầu."
status: in-progress
priority: P2
effort: "L (4 phase: 2×M, 2×S)"
branch: ""
tags: [feature, tunelo, auth, ui]
blockedBy: []
blocks: []
created: 2026-10-12
---

# Tunelo web: đăng nhập và danh sách tunnel

## Kết quả mong muốn
Mở `https://tunnel.hoandat.com` thấy trang Tunelo thật (hôm nay trả 400). Chưa đăng nhập: giới thiệu, hướng
dẫn bắt đầu, nút đăng nhập. Đã đăng nhập: các tunnel đang chạy của tài khoản, nhóm theo máy. Nút "Mở" của Tunelo trên
`auth.hoandat.com/apps` dẫn tới trang này.

## Quyết định đã chốt (user, 2026-10-12)
| Điểm | Chọn | Jev |
|---|---|---|
| Kiến trúc | Trang render phía server **trong `tunelo-server`**, trên host gốc, không JS, token màu Localman | 0.51 |
| Phiên | Phiên lưu MongoDB của Tunelo **kèm refresh token mã hoá**, trần 90 ngày theo trần grant của IdP | 0.53 |
| Phạm vi bản đầu | **Danh sách tunnel + hướng dẫn**, chỉ đọc | 0.92 |

## Không làm (non-goals)
- Mở hay đóng tunnel từ web (tunnel chỉ mở từ CLI; đóng để bản sau).
- Quản lý link token, lịch sử máy (thiết bị đã có ở `auth.hoandat.com/account`).
- Phát hành CLI 1.7.0 (`tunelo login`): thuộc plan `261008-1156-tunelo-accounts-and-tunnel-list` phase 02–03.

## Phases
| # | Phase | Tier | Phụ thuộc |
|---|---|---|---|
| 01 | [Đăng nhập OIDC và phiên trong tunelo-server](phase-01-oidc-sign-in-and-sessions.md) | M | — |
| 02 | [Trang chủ, danh sách tunnel, hướng dẫn (3 ngôn ngữ)](phase-02-pages.md) | M | 01 |
| 03 | [Phía IdP: kiểm luồng tunelo-web, cập nhật /apps](phase-03-idp-side.md) | S | 01 |
| 04 | [Cấu hình, deploy, nghiệm thu](phase-04-config-deploy.md) | S | 01–03 |

## Acceptance criteria
1. Chưa đăng nhập, `GET https://tunnel.hoandat.com/` trả 200 với trang giới thiệu, hướng dẫn và nút đăng nhập; mọi
   subdomain tunnel vẫn relay như cũ; `/api/*` và `/login` (CLI 1.6.x) không đổi.
2. Đăng nhập đi qua `auth.hoandat.com` (Code + PKCE + state + nonce, client `tunelo-web`), không hỏi consent, quay về
   trang danh sách.
3. Danh sách chỉ có tunnel của đúng `sub` đang đăng nhập (HTTP và TCP), nhóm theo máy, có URL mở được, giao thức,
   cổng local, Basic Auth, kết nối từ lúc nào; không có tunnel thì hiện trạng thái trống kèm hướng dẫn.
4. Access token được refresh khi hết hạn; refresh hỏng (grant bị thu hồi ở `/account`) thì phiên chết và người dùng
   được đưa đi đăng nhập lại. Không có hai refresh song song cho cùng một phiên.
5. Đăng xuất ở Tunelo xoá phiên và gọi RP-initiated logout của IdP; đăng xuất ở IdP xoá phiên Tunelo qua back-channel
   logout (`/auth/backchannel-logout`, logout token được kiểm `iss`, `aud`, `events`, `sid`).
6. Cookie phiên là `__Host-` (host-only, Secure, HttpOnly, SameSite=Lax); mọi POST có CSRF. Lý do: các subdomain
   `*.tunnel.hoandat.com` phục vụ nội dung bất kỳ của người dùng, cùng site với trang này.
7. Không log token, refresh token, code, cookie; refresh token mã hoá AES-256-GCM bằng khoá trong `.env`.
8. Ba ngôn ngữ en, zh-CN, vi; không JS; màu chỉ từ `packages/design-tokens/tokens.css`; 375 px không cuộn ngang.
9. Test: unit + integration cho phiên, callback, back-channel logout, cô lập theo `sub`; e2e đăng nhập với IdP giả.

## Rủi ro
- **`offline_access` cần `prompt=consent`** (OIDC Core) và IdP chỉ cấp refresh token cho `tunelo-web` khi có scope này.
  Phase 03 đo trên IdP xem first-party có bị hiện trang consent không; nếu có thì sửa chính sách consent ở IdP, không
  bỏ refresh.
- **Refresh token xoay vòng, dùng một lần:** hai request cùng phiên refresh song song làm một bên nhận `invalid_grant`.
  Server một instance (pm2 fork) ⟹ khoá theo phiên trong bộ nhớ là đủ.
- **Nội dung tunnel cùng site:** xem acceptance 6.
- **Tunnel cũ không hiện:** tunnel mở bằng CLI 1.6.x dùng key ẩn danh, không gắn `sub` (cả 4 tunnel lab hiện nay),
  nên danh sách theo tài khoản trống cho tới khi máy đó `tunelo login` bằng CLI 1.7.0. Trang trống phải nói rõ điều
  này và chỉ cách, thay vì chỉ ghi "không có tunnel".
