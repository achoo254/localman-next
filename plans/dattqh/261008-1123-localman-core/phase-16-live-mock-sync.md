---
phase: 16
title: "Live Mock Sync: mock có trạng thái luôn đồng bộ với collection và environment"
status: completed
priority: P1
effort: "M"
dependencies: [12, 13, 14]
---

# Phase 16: Live Mock Sync

## Goal
Làm keyword phụ của Localman (Jev 0.90, xem `../reports/competitive-261008-1308-localman-vs-mockapi-postman.md`). Một project mock **liên kết** được với một collection và một environment. Khi resource, schema, prefix hay endpoint của mock đổi, collection tự cập nhật request tương ứng, nhưng không đè lên phần user đã tự sửa. mockapi.io không có API client. Postman có mock trả example và code mock giữ trạng thái (`pm.state`, beta, soạn trên desktop, chạy cloud từ gói Solo), nhưng không tự đồng bộ collection theo schema mock. Điểm khác của Localman: **không cần code, chạy trên web, có ở gói Free, có quan hệ dữ liệu**.

## Hành vi (mọi dòng là tiêu chí nghiệm thu)

| Tình huống | Hành vi |
|---|---|
| Bấm "Tạo collection từ project mock" (phase 10) | Tạo collection có folder theo cây resource (cả route phẳng và lồng), request đủ CRUD theo endpoint đang bật, example lấy từ dữ liệu đang có. Tạo kèm environment với `baseUrl = https://{secret}.localman.hoandat.com{prefix}` và một biến id cho mỗi resource. Collection gắn nhãn "Đồng bộ với mock …" |
| Thêm resource hoặc bật endpoint trong mock | Thêm folder và request tương ứng, ghi revision vào changelog (phase 12) với tác giả "Live Mock Sync" |
| Đổi tên resource, đổi prefix hoặc lồng lại resource | Cập nhật path của request và `baseUrl`; ID ổn định nên comment và lịch sử không mất |
| Tắt endpoint hoặc xoá resource | Request liên quan được đánh dấu "Đã gỡ khỏi mock" và chuyển vào folder `_removed`, không xoá thẳng; user tự xoá nếu muốn |
| User đã tự sửa request (header, body, script) | Phần do user sửa được giữ. Mock đổi trúng field user đã sửa thì hiện **diff để chọn** "Giữ bản của tôi" hoặc "Lấy từ mock", dùng chung UI giải xung đột của phase 14 |
| Đổi schema field | Body mẫu của POST/PUT và example sinh lại từ schema mới; field user đã sửa body thì giữ |
| Tắt đồng bộ | Ngắt liên kết; collection thành collection thường, giữ nguyên nội dung |
| Collection được share hoặc fork | Chỉ bản gốc nhận đồng bộ. Fork nhận thay đổi qua "Pull changes" như thường lệ (phase 14) |
| Quyền | Chỉ Editor của project mock **và** Editor của collection mới bật hoặc tắt liên kết; đồng bộ chạy dưới danh nghĩa hệ thống |

## Files to Create / Modify
- Create `apps/api/src/modules/live-mock-sync/`:
  - `sync-link-model.ts`: `{mockProjectId, collectionId, environmentId, enabled, lastSyncedRevision}`
  - `mock-to-collection-mapper.ts`: hàm thuần, đầu vào là cây resource của mock, đầu ra là cây item collection với ID ổn định dạng `mock:<resourceId>:<method>:<scope>`
  - `sync-service.ts`: nghe sự kiện thay đổi resource của phase 04, gọi mapper, rồi merge 3 chiều với cây hiện tại bằng `three-way-merge` của phase 14 (base là bản mock sinh lần trước)
  - `sync-routes.ts`
- Modify `apps/api/src/modules/resources/resource-service.ts` để phát sự kiện `resource.changed` sau mỗi lần ghi.
- Create `apps/web/src/features/live-mock-sync/`: `sync-badge.tsx` (ở cả sidebar collection lẫn header project mock), `sync-settings-dialog.tsx`, `sync-conflict-banner.tsx`
- Modify `apps/web/src/features/resource-tree/node-actions.tsx` và `apps/web/src/pages/project-detail/api-endpoint-card.tsx` để thêm nút "Mở collection đồng bộ"

## Tasks & Steps
1. Viết `mock-to-collection-mapper` kèm test dạng snapshot trên các cây mẫu của phase 06.
2. Base của merge 3 chiều là output của mapper lần trước (lưu theo `lastSyncedRevision`). "Ours" là cây hiện tại có cả phần user sửa. "Theirs" là output mới của mapper.
3. Không xung đột thì tự áp. Có xung đột thì lưu `conflict` và hiện banner trên collection; chưa xử lý thì không chặn mọi thứ khác.
4. Gom nhiều thay đổi liên tiếp trong 2 giây (debounce) thành một revision.

## Verification
- Unit: mapper (route phẳng, route lồng 3 cấp, prefix, endpoint tắt) và merge (user sửa header trong khi mock đổi path, ra kết quả có cả hai thay đổi).
- Integration: tạo liên kết, thêm resource, đổi tên, tắt endpoint, xoá resource; kiểm cây collection và changelog sau mỗi bước. Xung đột hiện banner, chọn "Giữ bản của tôi" thì đúng kết quả.
- E2E: tạo mock `users`, tạo collection đồng bộ, đổi tên `users` thành `members`, gửi request trong collection tới mock thì nhận 200 ở path mới.

## Giao việc
**Đợt:** 6 · **Phụ thuộc trước khi bắt đầu:** phase 12 và 13 đã xong, và phase 14 đã xong vì `sync-service` dùng `three-way-merge` còn banner xung đột dùng conflict-resolver của phase 14; phase 10 đã có nút "Tạo collection từ project mock" · **Lệnh cook:** `/ak:cook plans/dattqh/261008-1123-localman-core/phase-16-live-mock-sync.md`

| # | Việc | Vai trò | Song song | File chính |
|---|---|---|---|---|
| T1 | Đối chiếu bảng hành vi với prototype: `prototype/index.html` `#/projects/demo` (`project-detail-sync-badge`, `project-detail-create-sync`, `project-detail-open-sync`) và `prototype/api-client.html` (`collection-meta-sync`, `modal-sync-settings-*`, `banner-sync-conflict*`, `modal-conflicts*`). Chốt spec badge, dialog cài đặt và banner | ui-ux-designer | với T2, T3 | `prototype/index.html`, `prototype/api-client.html` (chỉ đọc) |
| T2 | Viết `mock-to-collection-mapper` dạng hàm thuần, ID ổn định `mock:<resourceId>:<method>:<scope>`, kèm test snapshot trên cây mẫu của phase 06 (route phẳng, lồng 3 cấp, prefix, endpoint tắt) | fullstack-developer | với T1, T3 | `apps/api/src/modules/live-mock-sync/mock-to-collection-mapper.ts` |
| T3 | Phát sự kiện `resource.changed` sau mỗi lần ghi trong `resource-service`, kèm test sự kiện được phát đúng một lần mỗi lần ghi | fullstack-developer | với T1, T2 | `apps/api/src/modules/resources/resource-service.ts` |
| T4 | Làm `sync-link-model`, `sync-service` và `sync-routes` qua registry (toolset `sync`): base là output mapper lần trước theo `lastSyncedRevision`, debounce 2 giây thành một revision tác giả "Live Mock Sync", request bị gỡ chuyển vào folder `_removed`, lưu conflict mà không chặn việc khác, tắt đồng bộ thì giữ nội dung, fork chỉ nhận qua Pull changes, chỉ Editor của cả hai phía bật/tắt liên kết; tạo collection kèm environment `baseUrl` và biến id | fullstack-developer | — | `apps/api/src/modules/live-mock-sync/` |
| T5 | Làm UI: `sync-badge` (sidebar collection và header project mock), `sync-settings-dialog`, `sync-conflict-banner` (mở conflict-resolver của phase 14 với lựa chọn "Giữ bản của tôi"/"Lấy từ mock"); thêm nút "Mở collection đồng bộ" vào cây resource và card API endpoint | fullstack-developer | — | `apps/web/src/features/live-mock-sync/`, `apps/web/src/features/resource-tree/node-actions.tsx`, `apps/web/src/pages/project-detail/api-endpoint-card.tsx` |
| T6 | Viết integration test: tạo liên kết, thêm resource, đổi tên, tắt endpoint, xoá resource, kiểm cây collection và changelog sau mỗi bước; user sửa header trong khi mock đổi path ra kết quả có cả hai; xung đột hiện banner và "Giữ bản của tôi" ra đúng kết quả | tester | với T7 | test trong `apps/api/src/modules/live-mock-sync/` |
| T7 | Viết E2E: tạo mock `users`, tạo collection đồng bộ, đổi `users` thành `members`, gửi request trong collection tới mock nhận 200 ở path mới | tester | với T6 | `e2e/specs/live-mock-sync.spec.ts` |
| T8 | Deploy staging và bật cờ `features.liveMockSync` để landing quảng bá keyword phụ (cần user xác nhận) | fullstack-developer | — | `deploy/compose.staging.yml`, cấu hình cờ tính năng |
| T9 | Review cuối phase | code-reviewer | — | toàn phase |

### Checklist
- [x] T1 Spec badge, dialog, banner đã chốt theo prototype (24/10: badge "Đồng bộ với mock" cạnh mock project, dialog Live Mock Sync có công tắc tắt đồng bộ, banner "Mock đã đổi field bạn đã sửa" mở bộ chọn "Lấy từ mock"/"Giữ bản của tôi"; nút "Tạo/Mở collection đồng bộ" đặt ở header project như prototype, không ở node-actions/card endpoint; project và environment chỉ xem, không đổi trong dialog)
- [x] T2 Mapper có snapshot cho route phẳng, lồng 3 cấp, endpoint tắt; prefix nằm trong `baseUrl` của environment (test `sync-changes.test.ts`)
- [x] T3 `resource.changed` phát sau mỗi lần ghi (resource, import, xoá, lồng lại, prefix)
- [x] T4 Sync service: merge 3 chiều, debounce, `_removed`, conflict, quyền, tắt đồng bộ, fork (ADR-0008)
- [x] T5 UI badge, dialog, banner, nút "Mở collection đồng bộ"
- [x] T6 Integration pass (`sync-link.test.ts`, `sync-changes.test.ts`, 13 test)
- [x] T7 E2E đổi tên resource pass (CI run 40001911892, `live-mock-sync.spec.ts` 7,9 s)
- [x] T8 Staging deploy và cờ `features.liveMockSync` bật sau khi user xác nhận (user 24/10: "tự kiểm rồi bật luôn"; release `20261023-235151-f89fcf087939`, `LIVE_MOCK_SYNC_ENABLED=true` trong `/opt/localman/.env` (bản cũ `.env.bak-20261024-live-mock-sync`), `liveMockSync` trong `released-features`; backup `localman-20261024-065144.archive.gz`. Kiểm trên production bằng trình duyệt: tạo collection đồng bộ từ project thử, đổi `users` thành `members`, sau khoảng 20 giây 6 request theo path mới với tên tiếng Việt, changelog "Live Mock Sync", gửi "Liệt kê members" nhận 200 với 3 bản ghi; console không lỗi, log server 0 lỗi; dữ liệu thử đã xoá. Ghi nhận nhỏ: badge "Đồng bộ với mock" xuống hai dòng ở cột Thông tin hẹp)
- [x] T9 Review không còn finding mức high (24/10: 3 vòng review độc lập; đã sửa 2 high, 4 medium, các low; còn một low ghi nhận: sau khi đổi secret, path tự đặt của Editor có thể bị đè một lần)
- [x] Verification: unit mapper và merge (user sửa header, mock đổi path ra cả hai thay đổi) pass
- [x] Verification: integration chuỗi thêm, đổi tên, tắt endpoint, xoá resource; banner xung đột và "Giữ bản của tôi" đúng
- [x] Verification: E2E `users` thành `members` nhận 200 ở path mới
- [x] Mọi dòng trong bảng hành vi có test tương ứng (example lấy từ schema thay vì dữ liệu, lý do ở ADR-0008 mục 6)
- [x] `pnpm lint && pnpm typecheck && pnpm test` sạch (CI `91de637`: 761 file, 5.258 test; E2E 54 test)
- [x] `pnpm check:mcp-coverage` pass (237 operation, 192 tool)
