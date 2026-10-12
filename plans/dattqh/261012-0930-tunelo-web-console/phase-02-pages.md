---
phase: 2
title: "Trang chủ, danh sách tunnel, hướng dẫn (3 ngôn ngữ)"
status: completed
priority: P2
effort: "M"
dependencies: [1]
---

# Phase 02: Trang (`apps/tunelo-server/src/web/`)

## Goal
`/` trên host gốc: chưa đăng nhập là trang giới thiệu + hướng dẫn + nút đăng nhập; đã đăng nhập là danh sách tunnel
của tài khoản, nhóm theo máy.

## Files
- MỚI `src/web/html.ts`: template tự escape (theo mẫu `hoandat-auth/src/ui/html.ts`), không nối chuỗi HTML thô.
- MỚI `src/web/i18n/{en,zh-cn,vi}.ts` + chọn ngôn ngữ (cookie `tunelo_lang`, `Accept-Language`, mặc định en);
  thiếu key là lỗi typecheck.
- MỚI `src/web/layout.ts`, `src/web/home-page.ts`, `src/web/tunnels-page.ts`: topbar (logo Tunelo, user, đăng xuất),
  hero, hướng dẫn 3 bước (cài `npm i -g tunelo`, `tunelo login`, `tunelo http 3000`), bảng tunnel theo máy (URL mở
  được, giao thức, cổng local, Basic Auth, "kết nối 5 phút trước"), trạng thái trống, link "Quản lý thiết bị" tới
  `auth.hoandat.com/account`.
- MỚI `apps/tunelo-server/static/css/{tokens.css,web.css}`: `tokens.css` chép nguyên từ `packages/design-tokens`;
  `web.css` chỉ dùng biến. `scripts/tunelo/build-server.ts` chép `static/` vào `dist/tunelo-server/static/`;
  `infra/tunelo/deploy.sh` rsync thêm thư mục đó.
- Dữ liệu: gọi thẳng `listByOwner(session.sub)` (cùng process), không gọi HTTP sang `/api/tunnels`.
- Header: CSP `default-src 'self'; script-src 'none'; style-src 'self'; img-src 'self' data:; frame-ancestors 'none'`,
  `cache-control: no-store` cho trang đã đăng nhập.

## Validation
Test render 3 ngôn ngữ (không còn `{placeholder}`), cô lập `sub` (tunnel của người khác không hiện), không có tunnel ⟹
trạng thái trống; ảnh chụp 375/768/1440 px sáng và tối, không cuộn ngang.

## Trạng thái thực hiện (2026-10-12)
- [x] `html.ts`, `i18n/{en,zh-cn,vi}.ts` + `i18n/locale.ts`, `i18n/messages.ts` (thiếu/thừa key là lỗi typecheck).
- [x] `layout.ts`, `home-page.ts`, `tunnels-page.ts`, `getting-started.ts`, `page-routes.ts` (`/`, `/lang`).
- [x] `static/css/tokens.css` (chép nguyên), `static/css/web.css` (chỉ biến token); build chép `static/`, deploy rsync.
- [x] CSP, `nosniff`, `referrer-policy`; `cache-control: no-store` cho `/` (cả hai trạng thái, cùng URL).
- [x] Test 3 ngôn ngữ không còn `{placeholder}`, cô lập `sub`, trạng thái trống, CSP; ảnh 375/768/1440 sáng/tối không
  cuộn ngang (đường dẫn ảnh trong report).
