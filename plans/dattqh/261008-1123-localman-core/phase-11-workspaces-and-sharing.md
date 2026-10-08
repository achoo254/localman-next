---
phase: 11
title: "Workspace, vai trò và chia sẻ phần tử (theo Postman)"
status: pending
priority: P1
effort: "L"
dependencies: [10]
---

# Phase 11: Workspace, vai trò và chia sẻ

## Goal
Làm mô hình chia sẻ giống Postman cho collection và environment: workspace có vai trò, chia sẻ từng phần tử với vai trò Viewer/Editor, copy link, xin quyền truy cập, chuyển phần tử giữa các workspace, cùng thông báo trong app, Web Push và Telegram (không dùng email, theo vòng 8). Đây là nền cho phase 12–15.

Nguồn tham chiếu: [Sharing](https://learning.postman.com/docs/collaborating-in-postman/sharing/), [Roles and permissions](https://learning.postman.com/docs/administration/roles-and-permissions/), [Requesting access](https://learning.postman.com/docs/collaborating-in-postman/requesting-access-to-elements/).

## Ma trận tương đương (mọi dòng là tiêu chí nghiệm thu)

| Tính năng Postman | Localman |
|---|---|
| Workspace cá nhân (mặc định, chỉ mình thấy) và workspace team | Có. Mỗi user có 1 workspace cá nhân. **Free có 1 workspace team tối đa 3 thành viên**, gồm share theo người, copy link, request access và comment (Jev 0.70). Đây là điểm hơn Postman Free, vốn chỉ còn 1 user. Pro có workspace team không giới hạn số lượng, mỗi workspace tối đa 10 thành viên. Fork/merge/PR và public sharing chỉ có ở Pro |
| Vai trò workspace: Admin, Editor, Viewer theo đúng bảng quyền Postman | Có: join/leave; gửi request; thêm, chuyển, xoá collection/environment; khôi phục và xoá vĩnh viễn; tạo/xoá workspace; sửa thông tin; thêm/bớt thành viên; quản lý vai trò |
| Mời thành viên workspace qua email, chia sẻ workspace bằng link | Có, **không qua email**: mời bằng username hoặc email, gửi thông báo qua kênh của phase 02, hoặc copy link mời dùng một lần. Điều kiện accept giống phase 07 |
| Vai trò theo phần tử: Viewer và Editor cho collection và environment, đúng bảng quyền Postman | Có. Request và example kế thừa vai trò của collection |
| Share phần tử cho người hoặc email kèm vai trò; "Manage access" | Có. Người nhận được báo qua kênh thông báo, không qua email |
| "Include environment" khi share collection | Có: chọn environment sẽ đi kèm link hoặc lời mời |
| Copy link phần tử (chỉ ai có quyền mới mở được) | Có |
| Request access và Request to edit: Editor được báo, người xin nhận email khi được duyệt | Có. Cả hai phía được báo qua kênh thông báo (trong app, Web Push, Telegram) thay cho email |
| Move phần tử giữa các workspace (cần Editor hoặc Workspace Admin; không chuyển từ workspace team về workspace cá nhân) | Có |
| Trung tâm thông báo (chuông) và email | Có, dùng module `notifications` của phase 02 (trong app, Web Push, Telegram) thay cho email |

## Files to Create / Modify
- Create `apps/api/src/modules/workspaces/`: `workspace-model.ts` (`{name, type:'personal'|'team', visibility:'personal'|'team'|'public', ownerId}`), `workspace-member-model.ts` (`{workspaceId, userId|email, role:'admin'|'editor'|'viewer', status}`), routes và service
- Create `apps/api/src/modules/access/`: `element-role-model.ts` (`{elementType:'collection'|'environment'|'mock-project', elementId, principal, role:'editor'|'viewer'}`), `access-policy.ts` (một hàm duy nhất `can(user, action, element)` gộp quyền theo workspace và theo phần tử), `access-request-model.ts`
- Modify `apps/api/src/modules/notifications/` (đã có từ phase 02): thêm các loại sự kiện share, access-request, approve và invite
- Modify `apps/api/src/modules/projects/project-access.ts` để chuyển sang gọi `access-policy.ts` (xem ghi chú bên dưới)
- Create `apps/web/src/features/workspaces/` (switcher, trang settings, members), `apps/web/src/features/sharing/` (share-dialog, manage-access, request-access-page), `apps/web/src/features/notifications/` (bell, panel)

## Tasks & Steps
1. **Policy chung.** Viết `access-policy.ts` kèm bảng quyền dạng dữ liệu, chép nguyên bảng của Postman cho collection, environment và workspace, để test được theo từng dòng.
   - Project mock (phase 03 và 07) cũng chạy qua policy này. Owner tương đương Editor có quyền quản lý; collaborator tương đương Editor không có quyền quản lý.
   - Giao diện mock vẫn giữ y hệt mockapi.io, không hiện khái niệm workspace (Jev chọn đặt nền phân quyền chung; quyết định "Postman làm sau mock" của user vẫn giữ).
2. Viewer có thể **sửa giá trị local** của biến environment nhưng không sửa được giá trị shared (Postman ghi rõ quyền "Edit environment variables" cho Viewer; xem phase 13).
3. Luồng share:
   - Dialog Share gồm ô nhập người/email, chọn vai trò, "Include environment", Manage access và Copy link.
   - Thông báo đi qua `notification-service` của phase 02. Không có email.
4. Luồng xin quyền:
   - Mở link mà không có quyền thì vào trang "Request access".
   - Editor nhận thông báo và duyệt/từ chối trong panel thông báo.
   - Người xin nhận kết quả qua kênh thông báo.
5. Move: kiểm quyền ở cả workspace nguồn lẫn đích, và cập nhật vai trò kế thừa.

## Verification
- Bộ test policy chạy theo bảng: mỗi ô (vai trò × hành động × loại phần tử) có một case. Kết quả phải khớp nguyên bảng Postman đã chép trong `access-policy.ts`.
- Integration cho các luồng share, accept, request access, approve và move. Viewer gọi API sửa thì nhận 403; người không có quyền nhận 404.
- Regression: toàn bộ test phase 03 và 07 vẫn pass sau khi chuyển sang policy chung.

## Giao việc
**Đợt:** 6 · **Phụ thuộc trước khi bắt đầu:** phase 10; module `notifications` (phase 02), `project-access.ts` và logic accept lời mời (phase 03, 07) · **Lệnh cook:** `/ak:cook plans/dattqh/261008-1123-localman-core/phase-11-workspaces-and-sharing.md`

| # | Việc | Vai trò | Song song | File chính |
|---|---|---|---|---|
| T1 | Đối chiếu prototype `prototype/api-client.html#/workspace` (workspace switcher, dialog Share, Manage access, chuông thông báo), `#/workspace/settings` (thành viên, vai trò) và `#/request-access`; chốt state và `data-id` | ui-ux-designer | với T2, T3 | `prototype/api-client.html` (chỉ đọc) |
| T2 | `access-policy.ts` với bảng quyền dạng dữ liệu chép nguyên bảng Postman cho workspace, collection, environment, cộng ánh xạ project mock (owner là Editor có quyền quản lý, collaborator là Editor không quản lý); `element-role-model.ts`; giao diện adapter theo loại phần tử để phase 12, 13 đăng ký collection và environment; test dạng bảng mỗi ô một case | fullstack-developer | với T1, T3 | `apps/api/src/modules/access/{access-policy,element-role-model,element-adapters}.ts` |
| T3 | Module workspaces: model workspace và thành viên, workspace cá nhân tự tạo cho mỗi user, workspace team (Free 1 workspace tối đa 3 người; Pro không giới hạn workspace, mỗi workspace 10 người), mời bằng username hoặc email hoặc link một lần với điều kiện accept dùng chung logic của phase 07 (tách thành helper chung nếu đang nằm trong module collaborators), join/leave, quản lý vai trò; operation qua registry | fullstack-developer | với T1, T2 | `apps/api/src/modules/workspaces/*`, `apps/api/src/modules/access/invite-acceptance.ts` |
| T4 | Chia sẻ phần tử: share cho người hoặc email kèm vai trò, Include environment, Manage access, copy link; `access-request-model.ts` với Request access và Request to edit, Editor duyệt hoặc từ chối; thêm loại sự kiện share, access-request, approve, invite vào `notifications` | fullstack-developer | — (sau T2, T3) | `apps/api/src/modules/access/{share-routes,share-service,access-request-model}.ts`, `apps/api/src/modules/notifications/*` |
| T5 | Move phần tử giữa workspace: kiểm quyền ở cả nguồn và đích (Editor hoặc Workspace Admin), cấm chuyển từ team về cá nhân, cập nhật vai trò kế thừa | fullstack-developer | với T6 (sau T4) | `apps/api/src/modules/access/move-service.ts` |
| T6 | Chuyển `project-access.ts` sang gọi `access-policy.ts`, giữ nguyên chữ ký `can(user, action, project)`; giao diện mock không đổi | fullstack-developer | với T5 (sau T2) | `apps/api/src/modules/projects/project-access.ts` |
| T7 | Web workspace: switcher, trang settings, quản lý thành viên và vai trò, mời và copy link mời | fullstack-developer | với T8 (sau T1, T3) | `apps/web/src/features/workspaces/*` |
| T8 | Web chia sẻ: `share-dialog`, `manage-access`, `request-access-page`; panel thông báo có duyệt hoặc từ chối yêu cầu truy cập | fullstack-developer | với T7 (sau T1, T4) | `apps/web/src/features/sharing/*`, `apps/web/src/features/notifications/*` |
| T9 | Test policy theo bảng (vai trò × hành động × loại phần tử khớp bảng Postman); integration share, accept, request access, approve, move; Viewer gọi API sửa nhận 403, người không có quyền nhận 404 (phần tử collection và environment kiểm qua adapter test cho tới khi phase 12, 13 đăng ký adapter thật; quyền sửa giá trị local của Viewer kiểm ở phase 13); chạy lại toàn bộ test phase 03 và 07 | tester | — (sau T5–T8) | `apps/api/src/modules/{access,workspaces}/*.test.ts` |
| T10 | Review cuối phase, ưu tiên mọi route chỉ đi qua `can()` và không lộ sự tồn tại của phần tử | code-reviewer | — | toàn phase |

### Checklist
- [ ] T1 State và `data-id` của workspace, share và request access đã chốt theo prototype
- [ ] T2 `access-policy` dạng bảng, `element-role-model` và adapter xong
- [ ] T3 Module workspaces, giới hạn gói và lời mời xong
- [ ] T4 Share, Include environment, copy link và request access xong
- [ ] T5 Move giữa workspace xong
- [ ] T6 `project-access.ts` đã chạy qua policy chung
- [ ] T7 UI workspace xong
- [ ] T8 UI chia sẻ và panel thông báo xong
- [ ] T9 Test bảng, integration và regression pass
- [ ] T10 Review không còn finding chặn
- [ ] Verification: mỗi ô (vai trò × hành động × loại phần tử) có một case và khớp bảng Postman trong `access-policy.ts`
- [ ] Verification: integration share, accept, request access, approve, move pass; Viewer sửa nhận 403; không có quyền nhận 404
- [ ] Verification: toàn bộ test phase 03 và 07 vẫn pass sau khi chuyển sang policy chung
- [ ] Verification: mọi dòng trong ma trận tương đương có test hoặc kịch bản E2E pass
- [ ] `pnpm lint && pnpm typecheck && pnpm test` sạch
- [ ] `pnpm check:mcp-coverage` pass
