---
title: Plan app mobile Localman kiểu app chat
date: 2026-10-20
summary: Lập plan và prototype cho app Expo; red-team buộc thiết kế lại đăng nhập mobile và luồng gửi request
---

# Plan app mobile Localman kiểu app chat

## Chuyện gì đã xảy ra
Người dùng muốn có bản app mobile "giống app chat". Sau khi hỏi lại, phạm vi chốt là app native Expo/React Native gồm điều hướng kiểu danh sách chat, API client dạng hội thoại, log và inbox theo dòng thời gian. Lần này chỉ lập plan và prototype, chưa viết code.
Plan nằm ở `plans/dattqh/261020-0742-localman-mobile-chat-app/`, prototype ở `prototype/mobile-app.html`.

## Phát hiện
- Dashboard API chỉ nhận cookie `__Host-lm_session`; app native chưa có đường đăng nhập nào.
- Red-team chỉ ra bản phase 1 đầu tiên sai ở bốn chỗ:
  - SessionStore chỉ lưu SHA-256 nên không trả lại được token.
  - CSRF guard chặn endpoint đổi mã vì request không có Origin.
  - Callback xoá session web vì cookie Strict vẫn được gửi.
  - Callback qua custom scheme cho phép app lạ tự mở luồng đăng nhập; IdP có SSO nên luồng chạy hết không cần người dùng, và app lạ lấy được session.
- `client.sendRequest` chỉ chuyển tiếp request. Web tự thay biến (`send-variables.ts`) và tự ghi history (`record-send.ts`); history không lưu body response.

## Quyết định
- Đăng nhập: session handoff, giữ bộ token IdP đã mã hoá trong mã dùng một lần; luồng mobile luôn tương tác và có trang xác nhận; callback bằng link https đã xác minh (iOS 17.4+); đổi mã bằng `findOneAndDelete` kèm PKCE. Ghi vào ADR 0005 khi triển khai.
- History: thêm trường tuỳ chọn `sourceRequestId`.
- i18n: chuyển dictionary sang `@localman/i18n-messages`, làm sau đợt nghiệm thu.
- Store: dùng tài khoản cá nhân, nên Google Play cần 12 người thử trong 14 ngày.

## Bước tiếp theo
Người dùng duyệt prototype, rồi chạy `/ak:cook` cho plan sau khi đợt marketing/nghiệm thu đóng.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.
