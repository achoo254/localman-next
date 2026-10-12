---
phase: 3
title: "Phía IdP: kiểm luồng tunelo-web, cập nhật /apps"
status: completed
priority: P2
effort: "S"
dependencies: [1]
---

# Phase 03: IdP (`~/inet-gitlab/hoandat-auth`)

## Goal
Luồng `tunelo-web` chạy đúng hợp đồng: không hỏi consent, cấp refresh token, back-channel logout tới Tunelo.

## Steps
1. Test tích hợp ở `src/__tests__/oidc-flows.test.ts`: `tunelo-web` với `scope=openid profile offline_access
   tunnels:read`, `prompt=consent` ⟹ không hiện trang consent (first-party), có refresh token, access token
   `aud=https://tunnel.hoandat.com`. Nếu đang hiện consent ⟹ sửa `consent-handler`/`interaction-policy` cho
   first-party, kèm test.
2. Test back-channel logout tới `${TUNELO_WEB_URL}/auth/backchannel-logout` có `sid`.
3. `/apps`: thẻ Tunelo trỏ trang mới, câu "Tunnel của bạn trên trình duyệt" giữ nguyên; README mục Client cập nhật
   nếu hợp đồng đổi.

## Validation
`pnpm lint && pnpm typecheck && pnpm test && pnpm test:e2e && pnpm check:tokens` sạch ở repo IdP.

## Kết quả đo (2026-10-12, `hoandat-auth/src/__tests__/tunelo-web-flow.test.ts`, 3/3 qua)
- Trang Tunelo xin `scope=openid profile offline_access`, `prompt=consent`, **không** `resource` (đổi 2026-10-12, Jev
  0.97: trang đọc tunnel ngay trong process theo `sub`, không cần token API; quyền tối thiểu). Đo: **không** hiện trang
  consent (first-party consent im lặng), có refresh token, access token opaque dùng được ở userinfo, userinfo trả
  `preferred_username` (và không có dữ liệu Telegram). Không cần sửa IdP. (Bản đầu với `tunnels:read` + `resource` cũng
  qua, nhưng access token JWT của Tunelo không dùng được ở userinfo nên không lấy được tên.)
- Refresh xoay vòng (token mới khác token cũ).
- Đăng xuất ở IdP: provider gửi back-channel logout cho `tunelo-web` với đúng `sid`. Test kiểm qua sự kiện
  `backchannel.success|error` vì `oidc-provider` 9 chặn gọi ra địa chỉ special-use (127.0.0.1) bằng guard SSRF;
  production (IP công khai) không bị ảnh hưởng.
- **Rủi ro còn lại:** có `offline_access` nên refresh token `tunelo-web` không chết theo phiên IdP; phiên Tunelo chỉ mất
  nhờ back-channel. Back-channel hỏng (Tunelo sập lúc đó) ⟹ phiên Tunelo sống tới khi hết hạn. Log
  `Back-channel logout not delivered` của IdP là tín hiệu để theo dõi.
- `/apps`: thẻ Tunelo đã trỏ `TUNELO_WEB_URL`, không cần sửa thêm.
