---
title: "Phase 4: Tab Dự án: log và inbox theo dòng thời gian"
status: todo
tier: M
---

# Phase 4: Tab Dự án: log và inbox theo dòng thời gian

## Context Links

- Prototype: màn "Dự án" và "Log + Inbox"
- `apps/api/src/modules/projects/project-operations.ts:27,52`
- `apps/api/src/modules/mock-runtime/request-log-operations.ts:27-84`, `traffic-operations.ts:49`
- `apps/api/src/modules/mock-runtime/log-stream-routes.ts:92,150` (SSE)
- `apps/api/src/modules/webhook-inbox/inbox-operations.ts`, `apps/web/src/features/webhook-inbox/inbox-api.ts:30`
- `apps/web/src/features/request-log/use-log-stream.ts:49`, `request-log-api.ts`, `request-log-parse.ts`, `use-live-rows.ts` (dùng lại logic, không dùng lại bảng)
- Phase 3: plugin `EventStream` và lớp `apps/web/src/platform/native/event-stream.ts`
- `packages/shared/src/plan-limits.ts` (`requestLogDays`, `webhookInboxes`)

## Overview

Tab Dự án gồm hai màn:

- **Danh sách:** mỗi dự án là một dòng giống cuộc trò chuyện, gồm avatar chữ tắt, tên, request gần nhất (method, path, status, thời gian), giờ và badge số request mới.
- **Chi tiết:** segmented control "Log request" và "Webhook inbox". Log là dòng thời gian với request đến ở bên trái và response mock ở bên phải, nhận trực tiếp qua SSE và có thao tác Phát lại và Mở trong Client. Inbox là danh sách inbox; chạm vào một inbox để xem dòng thời gian các webhook đã nhận.

## Key Insights

- Trong vỏ Capacitor, `EventSource` của WebView không gửi được Bearer và `CapacitorHttp` không stream body, nên log trực tiếp đi qua plugin `EventStream` của phase 3. Lớp platform cho plugin cùng giao diện với nguồn mà `use-log-stream.ts` dùng, nên logic parse, lọc và kết nối lại của web được dùng lại. Khi mất kết nối thì kết nối lại với backoff; khi app quay lại foreground (`appStateChange` của `@capacitor/app`) thì tải bù theo cursor.
- Webhook gửi tới `{mock base}/_inbox/<name>` nên nằm trong log request. `traffic.listRequestLogs` đã có bộ lọc `source=inbox` và `path` (`request-log-operations.ts:24`), và web cũng dùng cách này, nên không cần sửa API.
- Model project đã có `lastRequestAt`. Thêm trường này vào output của `GET /projects` (thay đổi cộng thêm, đi qua `defineOperation`) để sắp xếp danh sách và hiện giờ mà không phải gọi N lần. Dòng xem trước chỉ tải log trang đầu cho các dòng đang hiện trên màn hình.
- "Request mới" được tính phía app: lưu thời điểm mở dự án lần cuối bằng `@capacitor/preferences` (không phải dữ liệu nhạy cảm) và so với `lastRequestAt`.
- Mỗi người dùng tối đa 5 SSE stream. App chỉ mở stream cho màn đang hiện, đóng khi rời màn hoặc khi app vào background, và gặp 429 thì quay về polling 15 giây.
- Dòng thời gian dùng `virtua` `VList` với `reverse` (neo đáy) và `shift` khi chèn trang cũ ở đầu, theo cấu hình đã đạt ở spike phase 2. Danh sách dự án cũng ảo hoá khi dài. Bong bóng mới tới khi người dùng đang cuộn lên đọc thì không kéo xuống, chỉ hiện nút "Có N request mới".
- Gói Free chỉ giữ log 7 ngày, nhưng chưa có operation nào trả về `requestLogDays`. Khi hết trang, app hiện dòng chung "Log cũ hơn đã được xoá theo gói của bạn" và không hard-code số ngày.

## Requirements

- Kéo để làm mới danh sách dự án; tìm kiếm theo tên.
- Bong bóng response có status theo màu ngữ nghĩa, kích thước và thời gian xử lý; body JSON thu gọn, chạm để mở toàn màn hình với khả năng sao chép.
- Phát lại gọi operation replay đang có. Mở trong Client chuyển sang tab Client với bản nháp lấy từ operation draft.
- Header nhạy cảm vẫn che như trên web, tức là hiển thị đúng dữ liệu server trả về và không tự hiện thêm.
- Có trạng thái rỗng, trạng thái lỗi và skeleton khi đang tải.
- Đạt tiêu chí "Cuộn ảo" và "Tải trang cũ" của `plan.md` trên dòng thời gian log.

## Related Code Files

- Tạo: `apps/web/src/mobile/screens/projects/` (`project-list-screen.tsx`, `project-detail-screen.tsx`, `inbox-timeline-screen.tsx`, `log-timeline.tsx`, `log-bubble.tsx`, `use-mobile-log-stream.ts`, `last-opened.ts`) và test cạnh file
- Có thể sửa: `apps/web/src/features/request-log/use-log-stream.ts` để nhận nguồn stream qua tham số (không đổi hành vi web, test web vẫn xanh)
- Sửa: `apps/api/src/modules/projects/project-operations.ts` và test (thêm `lastRequestAt` vào output)

## Implementation Steps

1. Thêm `lastRequestAt` vào output của project; danh sách dự án cùng dòng xem trước.
2. Dòng thời gian log có phân trang bằng cursor.
3. Hook SSE: kết nối, kết nối lại có backoff, đóng khi rời màn hoặc vào background, gặp 429 thì chuyển sang polling.
4. Danh sách inbox và dòng thời gian inbox (`source=inbox&path=/_inbox/<name>`).
5. Phát lại và Mở trong Client.
6. Test: hook SSE với nguồn giả (`fake-event-source.ts` của web), render bong bóng, logic giữ vị trí khi chèn trang cũ.
7. Đo tiêu chí cuộn ảo trên hai máy tham chiếu với dự án có 1.000 log.

## Todo

- [ ] Danh sách dự án
- [ ] Dòng thời gian log và SSE
- [ ] Inbox
- [ ] Phát lại và Mở trong Client
- [ ] Test

## Success Criteria

- Gửi `curl` tới mock trên staging thì bong bóng mới hiện trong vòng 2 giây mà không phải làm mới.
- Cuộn ngược tải được trang cũ, mục đang neo lệch ≤ 1 px; cuộn 1.000 log đạt tiêu chí khung hình.
- `pnpm vitest run apps/web/src/mobile/screens/projects apps/web/src/features/request-log` xanh; `pnpm check:mcp-coverage` xanh sau khi thêm `lastRequestAt`.

## Risk Assessment

- **Dòng xem trước gây nhiều request:** chỉ tải cho các dòng đang hiện; `lastRequestAt` đủ để sắp xếp và hiện giờ.
- **SSE trên Android bị proxy hoặc mạng di động cắt:** có backoff và tải bù theo cursor.

## Security Considerations

Chỉ hiển thị dữ liệu mà server đã che. Không lưu body log xuống đĩa.

## Next Steps

Phase 7 dùng các màn này cho kịch bản E2E.
