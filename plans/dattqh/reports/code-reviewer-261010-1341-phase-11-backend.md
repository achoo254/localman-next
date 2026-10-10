# Review backend phase 11 (workspace, vai trò, chia sẻ, request access, move)

Phạm vi: `packages/shared/src/access-permissions.ts`, `apps/api/src/modules/{access,workspaces}/**`, các file `project-access.ts`, `invite-eligibility.ts`, `notifications/*`, `plan-guard.ts`, `i18n/messages/*` và `registry.ts`. Kiểm bằng test có chọn lọc: access, workspaces và notifications 72 test; regression phase 03/07 86 test; bảng quyền 128 test. Ngoài ra chạy `tsc`, biome và 4 probe trên stack test.

Không có lỗi Critical.

## High (chặn T10)

- **H1:** approve cấp đúng vai trò hiện tại của yêu cầu, kể cả khi yêu cầu vừa được nâng từ Viewer lên Editor sau lúc người duyệt mở ra. Sửa: approve nhận `role` người duyệt đã thấy và lọc theo nó; lệch thì trả 409 `REQUEST_CHANGED`.
- **H2:** move chỉ kiểm quyền `edit` trên phần tử ở phía nguồn, nên người ngoài workspace có share Editor kéo được phần tử của team đi. Sửa: phía nguồn bắt buộc `moveDeleteElements` của workspace.
- **H3:** chia sẻ theo email gắn ngay vào account chưa xác minh email. Lời mời workspace đã gắn `userId` thì bỏ qua kiểm email, và `forgetReclaimedEmail` chưa xử lý workspace. Sửa: chỉ gắn account khi email đã xác minh; mở rộng `forgetReclaimedEmail` sang workspace.

## Medium

- **M1:** khi chủ rời đi, quyền chủ chuyển cho Admin mà không kiểm hạn mức workspace team của người nhận. Jev quyết giữ hành vi này (0.87): người nhận chỉ bị chặn tạo workspace mới. Ghi chú và test kèm theo.
- **M2:** truy vấn `element_roles` quét toàn bộ collection (COLLSCAN và quét `email_1`). Sửa index và truy vấn.
- **M3:** API không đọc cờ `workspaces`. Theo quy ước hiện có, cờ chỉ ở build web; các tính năng có cờ khác cũng để backend chạy. Giữ quy ước.
- **M4:** xoá workspace còn bỏ sót phần tử, share và request. Tạm coi phần tử mất workspace là không chia sẻ và không move được; cascade làm ở phase 12.

## Low

- L1: chọn vai trò mạnh hơn giữa share theo account và share theo email.
- L2: dùng lại `displayNameOf`.
- L3: kiểm tra id chưa đồng nhất (vô hại).
- L4: danh sách Manage access và Members chưa phân trang.
- L5: token lời mời workspace nằm trong `link` của thông báo và trong URL trang SPA, giống lời mời project của phase 07.
- L6: yêu cầu đang chờ không hết hạn, và chưa có thời gian chờ sau khi bị từ chối.

## Đã kiểm, không có vấn đề

- 404 so với 403 không làm lộ sự tồn tại của tài nguyên. Mọi route mới đều đi qua `requireWorkspace` hoặc `requireElement` với đúng action trong bảng.
- Bảng Postman khớp. Bảng của project mock giữ nguyên hành vi cũ.
- Token có 256 bit, chỉ lưu hash, đi trong body POST.
- Ghế, hạn mức và quy tắc Admin cuối đều chạy trong transaction có lock.
- Thông báo gửi tới Editor được giới hạn 50 người và không bị N+1.
- Không có `any`, không có `!`, mọi file ≤200 dòng.
