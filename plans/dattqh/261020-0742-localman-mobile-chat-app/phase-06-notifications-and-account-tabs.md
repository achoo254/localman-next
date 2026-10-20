---
title: "Phase 6: Tab Thông báo và Tài khoản"
status: todo
tier: S
---

# Phase 6: Tab Thông báo và Tài khoản

## Context Links

- Prototype: màn "Thông báo" và "Tài khoản"
- `apps/api/src/modules/notifications/notification-operations.ts:30,60,86`
- `apps/api/src/modules/users/user-operations.ts:9,25`
- `apps/web/src/features/feedback/`, `apps/web/src/features/notifications/`, `apps/web/src/components/layout/account-menu.tsx`, `apps/web/src/i18n/language-switcher.tsx` (dùng lại API và hook, màn viết riêng cho mobile)
- Phase 3: phiên mobile (`signOut`), theme, `@capacitor/app` `appStateChange`

## Overview

- **Thông báo:** danh sách dạng chat. Thông báo chưa đọc có chấm; chạm vào thì đánh dấu đã đọc và mở đúng màn (dự án, request, lời mời). Có nút "Đọc hết". Làm mới khi kéo xuống và khi app quay lại foreground; không có push.
- **Tài khoản:** avatar, tên, gói, workspace hiện tại (chọn được nếu có nhiều workspace), ngôn ngữ, giao diện, gửi phản hồi, đăng xuất.

## Requirements

- Badge trên tab bằng số thông báo chưa đọc.
- Đổi ngôn ngữ thì gọi `PUT /users/me/locale`, giống web.
- Gửi phản hồi dùng operation feedback đang có.
- Đăng xuất dùng luồng của phase 3: `POST /auth/mobile/logout` rồi `SecureToken.clear`.
- Lời mời workspace mở màn chấp nhận lời mời, dùng operation đang có.

## Related Code Files

- Tạo: `apps/web/src/mobile/screens/notifications/` (`notification-list-screen.tsx`, `notification-target.ts`) và `apps/web/src/mobile/screens/account/` (`account-screen.tsx`, `feedback-screen.tsx`), test cạnh file

## Implementation Steps

1. Danh sách thông báo, đánh dấu đã đọc, deep link nội bộ.
2. Màn tài khoản và các mục cài đặt.
3. Gửi phản hồi.
4. Test (Vitest + Testing Library) cho đánh dấu đã đọc, deep link nội bộ, đổi ngôn ngữ, đăng xuất.

## Todo

- [ ] Thông báo
- [ ] Tài khoản
- [ ] Phản hồi
- [ ] Test

## Success Criteria

- Badge giảm khi đọc; đổi ngôn ngữ trên mobile thì web cũng thấy ngôn ngữ đó sau khi tải lại.
- `pnpm vitest run apps/web/src/mobile/screens/notifications apps/web/src/mobile/screens/account` xanh.

## Risk Assessment

Thấp. Mọi thứ dùng operation sẵn có.

## Security Considerations

Đăng xuất thu hồi session ở server, không chỉ xoá token trên máy.

## Next Steps

Phase 7.
