---
title: "Phase 5: Tab Client: request dạng hội thoại"
status: todo
tier: L
---

# Phase 5: Tab Client: request dạng hội thoại

## Context Links

- Prototype: màn "Client" và "Hội thoại request" (ô soạn, bottom sheet, pill environment)
- Red-team, phát hiện về proxy: `../reports/red-team-261020-0742-mobile-app-plan.md`
- `apps/api/src/modules/api-client/proxy-operations.ts:73-130` (`client.sendRequest`: chỉ chuyển tiếp, không thay biến, không che secret, không ghi history)
- `apps/api/src/modules/api-client/history-operations.ts:32-125` (`client.listHistory`, `client.recordHistory`; history không lưu body response)
- `apps/web/src/features/api-client/workbench/send-variables.ts`, `record-send.ts`, `proxy-sender.ts` (web tự thay biến và tự ghi history)
- `packages/shared` subpath `api-client` (thay biến `{{var}}`, `apiRequestDraftSchema`)
- `apps/web/src/features/api-client/` (`api/`, `history/`, `request/`, `response/`: dùng lại hàm gửi và hook dữ liệu, không dùng lại workbench), `apps/web/src/platform/clipboard.ts`
- `apps/api/src/modules/collections/collection-read-operations.ts:27-76`
- `apps/api/src/modules/environments/environment-operations.ts`, `environment-change-operations.ts:67` (local values), `globals-operations.ts`

## Overview

- **Danh sách:** các request đã lưu trong collection của workspace hiện tại, nhóm theo collection như nhóm cuộc trò chuyện. Mỗi dòng gồm method chip, tên, status của lần gửi gần nhất và giờ. Nút bút chì tạo request mới.
- **Hội thoại:** mỗi lần gửi tạo một bong bóng bên phải (method, URL còn giữ `{{var}}`, body thu gọn, tên environment) và một bong bóng bên trái (status, kích thước, thời gian, body thu gọn, các thao tác Xem đầy đủ, Sao chép, Gửi lại). Ô soạn ở đáy gồm nút `+` mở bottom sheet sửa method, header và body, nút method, ô URL và nút gửi. Phía trên ô soạn là hàng pill chọn environment.

## Key Insights

- Gửi request trên mobile làm giống web: (1) thay biến ngay trên máy bằng `@localman/shared/api-client`, dùng environment, globals và local value; (2) gửi qua `client.sendRequest` để có định tuyến Tunelo và không bị CORS; (3) gọi `client.recordHistory` với bản nháp gốc (còn `{{var}}`) và tóm tắt response. Entry mobile dùng lại thẳng `send-variables.ts`, `record-send.ts`, `proxy-sender.ts` của web nếu chúng không kéo theo workbench hay sandbox script; test bundle của phase 2 phải vẫn xanh (không QuickJS, không CodeMirror). Nếu có kéo theo thì tách phần cần dùng ra module nhẹ trong `features/api-client`, web import lại từ đó.
- History chỉ lưu status, kích thước, thời gian và URL cuối, không lưu body. Vì vậy khi mở lại hội thoại, bong bóng cũ chỉ có các thông tin này. Body chỉ có cho các lần gửi trong phiên hiện tại (giữ trong bộ nhớ) và có thể bấm Gửi lại để lấy body mới. Bong bóng cũ ghi rõ "Body không được lưu".
- Hội thoại theo từng request: thêm trường tuỳ chọn `sourceRequestId` vào input của `client.recordHistory` và vào summary, rồi cho `client.listHistory` lọc theo trường này. Thay đổi đi qua `defineOperation`, có MCP tool và test. Web có thể gửi kèm trường này sau, và hành vi cũ không đổi khi bỏ trống.
- Giá trị secret của environment (local value) chỉ giữ trong bộ nhớ khi thay biến, không ghi xuống đĩa và không đưa vào bản nháp lưu history.
- Request mới chưa lưu là một hội thoại "Nháp" (history không có `sourceRequestId`). Lưu lại thì dùng operation tạo node trong collection đang có.
- Script pre-request và test của Postman chạy trong sandbox QuickJS trên web. v1 trên mobile không chạy script: hội thoại hiện một dòng "Request có script, script chỉ chạy trên web", và request vẫn gửi được.
- Bàn phím: theo cấu hình `@capacitor/keyboard` đã chọn ở spike phase 2. Chiều cao bàn phím (`keyboardWillShow`/`keyboardWillHide`) đặt vào một biến CSS; ô soạn và vùng dòng thời gian cùng dịch bằng `transform` theo biến đó, nên dịch cùng nhịp animation của bàn phím. Đang ở đáy thì giữ bong bóng cuối hiện; đang cuộn lên đọc thì giữ nguyên vị trí.
- Dòng thời gian hội thoại dùng `virtua` như phase 4 (`reverse`, `shift` khi tải history cũ).

## Requirements

- Gửi được GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS; body JSON hoặc text; sửa header dạng key-value.
- Bong bóng response cắt body ở khoảng 4 KB; "Xem đầy đủ" mở màn có định dạng JSON và tìm kiếm. Response nhị phân chỉ hiện loại và kích thước.
- Gửi lại dùng đúng bản nháp của lần gửi đó (lấy qua `client.getHistoryEntry`). Sao chép đưa body vào clipboard qua `copyText` của `apps/web/src/platform/clipboard.ts`; trả `false` thì hiện toast hướng dẫn chép tay.
- Khi đang chờ response, hiện dòng "Đang chờ response…" như prototype và có nút huỷ. Thời gian chờ theo giới hạn của proxy (mặc định 30 giây).
- Lỗi hạn mức proxy hiện thông điệp đã dịch, tôn trọng việc UI thương mại đang được ẩn hay không.
- Đạt tiêu chí "Bàn phím", "Cuộn ảo" và "Tải trang cũ" của `plan.md` trên màn hội thoại.

## Related Code Files

- Tạo: `apps/web/src/mobile/screens/client/` (`request-list-screen.tsx`, `conversation-screen.tsx`, `response-screen.tsx`, `composer.tsx`, `request-sheet.tsx`, `environment-pills.tsx`, `request-bubble.tsx`, `response-bubble.tsx`, `use-send-request.ts`, `use-keyboard-inset.ts`) và test cạnh file
- Có thể sửa: module gửi trong `apps/web/src/features/api-client/` nếu phải tách phần nhẹ (bước ở Key Insights), test web vẫn xanh
- Sửa: `apps/api/src/modules/api-client/history-operations.ts`, model và service history cùng test (`sourceRequestId`)

## Implementation Steps

1. Thêm `sourceRequestId` vào history (input, model, summary, bộ lọc của list) cùng test; chạy `pnpm check:mcp-coverage`.
2. Danh sách collection và request (cây phẳng theo nhóm, có tìm kiếm).
3. Màn hội thoại đọc history theo `sourceRequestId`.
4. Ô soạn, bottom sheet, pill environment.
5. Chuỗi gửi: thay biến, gửi qua proxy, ghi history, thêm bong bóng.
6. Huỷ, Gửi lại, Sao chép, Xem đầy đủ; lưu bản nháp thành request.
7. Test: thay biến, gửi thành công, lỗi mạng, lỗi hạn mức, secret không có trong bản nháp ghi history, hook `use-keyboard-inset` với sự kiện bàn phím giả.
8. Đo tiêu chí bàn phím (quay màn 60 fps) và cuộn trên hai máy tham chiếu.

## Todo

- [ ] `sourceRequestId` trong history
- [ ] Danh sách request
- [ ] Hội thoại và history
- [ ] Ô soạn và bottom sheet
- [ ] Chuỗi gửi và ghi history
- [ ] Thao tác trên bong bóng, lưu nháp
- [ ] Test

## Success Criteria

- Trên máy thật: gửi một request có `{{baseUrl}}` tới mock staging; bong bóng response hiện đúng status; mở lại hội thoại thấy lịch sử; web cũng thấy entry đó trong History.
- Ô soạn bám mép trên bàn phím, lệch ≤ 1 px, không trễ quá 1 khung trên cả hai máy tham chiếu.
- `pnpm vitest run apps/web/src/mobile/screens/client` xanh; `pnpm check:mcp-coverage` xanh; test history và api-client của web vẫn xanh.

## Risk Assessment

- **Module gửi của web kéo theo QuickJS hoặc CodeMirror:** test bundle mobile báo ngay; tách module nhẹ như ở Key Insights.
- **Response lớn làm giật UI:** cắt bớt trong bong bóng; màn xem đầy đủ hiển thị ảo hoá theo dòng (`virtua`), định dạng JSON ngoài luồng chính nếu body lớn.
- **Bàn phím Android khác nhau giữa máy:** cấu hình đã kiểm ở spike phase 2; thêm máy thử nếu người thử báo lệch.
- **Thay đổi history ảnh hưởng tới web và MCP:** trường mới là tuỳ chọn, output cũ giữ nguyên.

## Security Considerations

Không lưu response xuống đĩa. Bản nháp ghi vào history giữ nguyên `{{var}}`, không chứa giá trị secret đã thay. Biến secret hiển thị ở dạng đã che, giống web.

## Next Steps

Phase 7 dùng luồng gửi request làm kịch bản E2E chính.
