---
phase: 12
title: "Collections tương đương 100% Postman"
status: completed
priority: P1
effort: "L"
dependencies: [11]
---

# Phase 12: Collections

## Goal
Làm quản lý collection tương đương Postman: cây collection, folder và request, example; thiết lập ở cấp collection và folder; tag và status tag; favorite, sort, search, chọn nhiều; changelog có diff và khôi phục; thùng rác; import/export Collection v2.1; share (dùng phase 11).

Nguồn tham chiếu: [Manage collections](https://learning.postman.com/docs/use/use-collections/manage-collections/), [Collaborate with collections](https://learning.postman.com/docs/use/use-collections/collaborate-with-collections/), [Collection schema](https://schema.postman.com/).

## Ma trận tương đương (mọi dòng là tiêu chí nghiệm thu)

| Tính năng Postman | Localman |
|---|---|
| Tạo collection (trống hoặc từ template), đổi tên, nhân bản, xoá (collection có request thì phải gõ "delete" để xác nhận) | Có. Template có sẵn: "REST CRUD" và "Từ project mock" |
| Folder và subfolder lồng không giới hạn; thêm folder từ menu "View more actions" | Có |
| Kéo thả để sắp lại thứ tự request, folder, example, và kéo vào folder | Có |
| Sort (theo tên, theo thời gian) | Có |
| Favorite (đẩy collection lên đầu), ô search lọc collection và nội dung bên trong | Có |
| Chọn nhiều bằng ⌘/Ctrl-click, xoá hàng loạt | Có |
| Tab Overview: mô tả Markdown, người tạo, lần cập nhật cuối, environment liên quan, hoạt động gần đây | Có (mock project liên quan hiện thay cho "mocks") |
| Thiết lập cấp collection và folder: Authorization (request kế thừa), Scripts (pre-request, post-response), Variables (collection scope) | Có. Thứ tự chạy script: collection, folder, request |
| Example (response đã lưu) cho request: tạo từ response, sửa, nhân bản | Có |
| Tag: tối đa 10 tag mỗi collection, mỗi tag 64 ký tự, không phân biệt hoa thường, bắt đầu và kết thúc bằng chữ hoặc số | Có, validate đúng các luật này |
| Status tag: chọn 1 status định sẵn, hoặc tạo status tuỳ chỉnh có emoji (2–64 ký tự, bắt đầu bằng chữ) | Có |
| Changelog: theo thời gian, có tác giả, gom các thay đổi gần nhau thành session, View diff, Hide/Show diff (Editor), "Restore to this change" | Có |
| Trash: tìm và lọc theo workspace hoặc người xoá, Restore vào workspace được chọn, Delete permanently (cần Admin hoặc Editor tại thời điểm xoá) | Có. Giữ 30 ngày cho cả Free lẫn Pro (`trashDays`) rồi job tự xoá vĩnh viễn. Postman Free chỉ giữ 1 ngày |
| Export Collection v2.1 JSON, Import (v2.1, cURL, OpenAPI) | Có (import đã làm ở phase 10, phase này thêm round-trip không mất dữ liệu) |
| Share, Copy link, Move (phase 11), cùng Fork, Pull requests, Comments, Watch (phase 14) | Gắn vào menu và thanh bên phải |
| Thanh bên phải: Info (ID, người tạo, mock project liên quan), Changelog, Comments, Pull requests, Forks | Có |

## Files to Create / Modify
- Create `apps/api/src/modules/collections/`: `collection-model.ts` (tài liệu gốc theo schema v2.1: `info`, `item[]` lồng, `auth`, `event[]`, `variable[]`, kèm `tags[]`, `status`, `workspaceId`, `deletedAt`), `collection-item-model.ts` (lưu từng request, folder và example theo dạng cây kèm `parentId` và `order`, để kéo thả không phải ghi lại cả cây), `collection-revision-model.ts` (lưu bản diff JSON Patch của mỗi thay đổi kèm tác giả và thời điểm), `collection-service.ts`, `collection-routes.ts`, `changelog-service.ts`, `trash-service.ts`, `postman-v21-codec.ts` (chuyển qua lại giữa dữ liệu lưu trữ và schema v2.1)
- Create `apps/web/src/features/collections/`: `collection-sidebar.tsx` (dạng cây, dùng dnd-kit), `collection-overview.tsx`, `collection-settings-tabs.tsx` (Authorization, Scripts, Variables), `example-editor.tsx`, `tags-editor.tsx`, `status-tag-picker.tsx`, `changelog-panel.tsx` (diff viewer), `trash-page.tsx`, `delete-collection-dialog.tsx`, `right-sidebar.tsx`

## Tasks & Steps
1. Model lưu trữ:
   - Request/folder là các document riêng, sắp theo `order` (fractional index) nên kéo thả chỉ ghi 1 document.
   - Mỗi lần ghi sinh một revision dạng JSON Patch (RFC 6902) để làm changelog và restore.
   - Revision của cùng tác giả trong vòng 5 phút được gom thành 1 session.
2. Restore-to-change: dựng lại snapshot tại revision đó, ghi đè bằng một revision mới (không xoá lịch sử).
3. Trash: xoá mềm bằng `deletedAt` kèm toàn bộ cây con. Restore hỏi chọn workspace đích. Xoá vĩnh viễn thì xoá luôn revision.
4. Kế thừa auth: chọn "Inherit auth from parent" thì auth lấy từ folder rồi tới collection gần nhất. Request builder của phase 10 hiện nguồn auth đang kế thừa.
5. Export/Import v2.1: test round-trip trên bộ collection mẫu (folder lồng, auth kế thừa, script, biến, example) để đảm bảo không mất field.

## Verification
- Unit: `postman-v21-codec` round-trip, xác thực bằng JSON Schema chính thức v2.1. Validator tag và status tag đúng từng luật.
- Integration: CRUD, kéo thả, restore-to-change, trash/restore/xoá vĩnh viễn, và quyền theo phase 11 (Viewer không sửa được nhưng export và fork được).
- E2E: import một collection Postman thật có folder lồng 3 cấp, chạy 1 request, export rồi so sánh JSON tương đương.

## Giao việc
**Đợt:** 6 · **Phụ thuộc trước khi bắt đầu:** phase 11 (`access-policy`, adapter phần tử, share, move); phase 10 (request builder, import, hàm `mock-to-collection`) · **Lệnh cook:** `/ak:cook plans/dattqh/261008-1123-localman-core/phase-12-collections.md`

| # | Việc | Vai trò | Song song | File chính |
|---|---|---|---|---|
| T1 | Đối chiếu prototype `prototype/api-client.html#/workspace` (sidebar cây collection, Overview, tab Authorization/Scripts/Variables, example, tag, status tag, thanh bên phải, changelog có diff) và `#/trash`; chốt state và `data-id` | ui-ux-designer | với T2 | `prototype/api-client.html` (chỉ đọc) |
| T2 | Model: `collection-model` (gốc theo schema v2.1 kèm `tags`, `status`, `workspaceId`, `deletedAt`), `collection-item-model` (request, folder, example có `parentId` và `order` fractional index), `collection-revision-model` (JSON Patch RFC 6902, tác giả, thời điểm); đăng ký adapter `collection` vào `access-policy` | fullstack-developer | với T1 | `apps/api/src/modules/collections/{collection-model,collection-item-model,collection-revision-model}.ts` |
| T3 | `postman-v21-codec.ts` chuyển qua lại giữa dữ liệu lưu trữ và v2.1; unit round-trip xác thực bằng JSON Schema chính thức v2.1 trên bộ mẫu (folder lồng, auth kế thừa, script, biến, example) | fullstack-developer | với T4 (sau T2) | `apps/api/src/modules/collections/postman-v21-codec.ts` |
| T4 | Service và operation cây: CRUD collection, folder, request, example; nhân bản; xoá collection có request phải gõ "delete"; kéo thả chỉ ghi 1 document; template "REST CRUD" và "Từ project mock" (dùng `mock-to-collection` của phase 10); mọi lần ghi sinh revision | fullstack-developer | với T3 (sau T2) | `apps/api/src/modules/collections/{collection-service,collection-routes}.ts` |
| T5 | Metadata và thiết lập: validator tag (tối đa 10, 64 ký tự, không phân biệt hoa thường, đầu và cuối là chữ hoặc số) và status tag (định sẵn hoặc tuỳ chỉnh có emoji, 2–64 ký tự) ở `packages/shared`; favorite, sort, search, xoá hàng loạt; auth, scripts, variables cấp collection và folder; resolver kế thừa auth và thứ tự script collection, folder, request | fullstack-developer | — (sau T4) | `packages/shared/src/collection-tags.ts`, `apps/api/src/modules/collections/{collection-settings,auth-inheritance}.ts` |
| T6 | `changelog-service.ts` (gom revision cùng tác giả trong 5 phút thành session, View diff, Hide/Show diff cho Editor, Restore to this change ghi revision mới) và `trash-service.ts` (xoá mềm cả cây con, Restore chọn workspace đích, xoá vĩnh viễn kèm revision, job tự xoá sau `trashDays`) | fullstack-developer | với T5 (sau T4) | `apps/api/src/modules/collections/{changelog-service,trash-service}.ts` |
| T7 | Web sidebar: `collection-sidebar` (cây dnd-kit, favorite, sort, search, chọn nhiều ⌘/Ctrl-click), `delete-collection-dialog`, `collection-overview` (mô tả Markdown, người tạo, cập nhật cuối, environment và mock project liên quan, hoạt động gần đây) | fullstack-developer | với T8 (sau T1, T4) | `apps/web/src/features/collections/{collection-sidebar,delete-collection-dialog,collection-overview}.tsx` |
| T8 | Web thiết lập: `collection-settings-tabs`, `example-editor`, `tags-editor`, `status-tag-picker`, `right-sidebar` (Info, Changelog; tab Comments, Pull requests, Forks do phase 14 thêm); request builder phase 10 hiện nguồn auth đang kế thừa | fullstack-developer | với T7 (sau T5) | `apps/web/src/features/collections/{collection-settings-tabs,example-editor,tags-editor,status-tag-picker,right-sidebar}.tsx`, `apps/web/src/features/api-client/request/*` |
| T9 | Web changelog và trash: `changelog-panel` (diff viewer, restore) và `trash-page` (tìm, lọc theo workspace hoặc người xoá, restore chọn workspace, xoá vĩnh viễn) | fullstack-developer | với T7, T8 (sau T6) | `apps/web/src/features/collections/{changelog-panel,trash-page}.tsx` |
| T10 | Test: unit codec round-trip và validator tag; integration CRUD, kéo thả, restore-to-change, trash/restore/xoá vĩnh viễn, quyền theo phase 11 (Viewer không sửa được nhưng export và fork được); E2E import collection Postman thật có folder lồng 3 cấp, chạy 1 request, export rồi so JSON tương đương | tester | — (sau T7–T9) | `apps/api/src/modules/collections/*.test.ts`, `e2e/specs/collections-*.spec.ts` |
| T11 | Review cuối phase, ưu tiên merge revision, xoá vĩnh viễn và round-trip không mất field | code-reviewer | — | toàn phase |

### Checklist
- [x] T1 State và `data-id` của collection, settings, changelog và trash đã chốt theo prototype
- [x] T2 Ba model và adapter `collection` xong
- [x] T3 Codec v2.1 và round-trip xong
- [x] T4 Service, operation cây và template xong
- [x] T5 Tag, status, favorite, sort, search, xoá hàng loạt và thiết lập kế thừa xong
- [x] T6 Changelog và trash xong
- [x] T7 Sidebar, dialog xoá và Overview xong
- [x] T8 Tab thiết lập, example, tag, status và thanh bên phải xong
- [x] T9 Changelog panel và trang trash xong
- [x] T10 Unit, integration và E2E pass
- [x] T11 Review không còn finding chặn
- [x] Verification: `postman-v21-codec` round-trip pass với JSON Schema chính thức v2.1; validator tag và status tag đúng từng luật
- [x] Verification: integration CRUD, kéo thả, restore-to-change, trash/restore/xoá vĩnh viễn và quyền theo phase 11 pass
- [x] Verification: import collection Postman thật lồng 3 cấp, chạy 1 request, export thì JSON tương đương bản gốc
- [x] Verification: mọi dòng trong ma trận tương đương có test hoặc kịch bản E2E pass
- [x] `pnpm lint && pnpm typecheck && pnpm test` sạch
- [x] `pnpm check:mcp-coverage` pass

### Đợt A (11/10/2026, Vòng 32)
Xong: cây collection CRUD, kéo thả ghi 1 node, favorite, sort, tìm kiếm phía server, nhân bản cả cây con; template REST CRUD và "From mock project"; import lưu thành collection; export v2.1 round-trip kiểm bằng JSON Schema chính thức (giá trị secret để trống); tab collection/folder (Overview Markdown, Authorization, Scripts, Variables); tab gắn với request, lưu bằng Ctrl/Cmd+S và "Save to collection"; khi gửi: auth kế thừa, script theo thứ tự collection → folder → request, biến collection; Share/Move/Copy link; xoá collection phải gõ `delete`; thùng rác (restore chọn workspace, xoá vĩnh viễn, job dọn sau `trashDays`, quyền theo vai trò hiện tại); xoá workspace team thì collection vào thùng rác; giới hạn 2000 node, 20 MiB, sâu 64 cấp.
Kiểm: lint, typecheck, 539 file / 3979 test, `check:mcp-coverage`, `check:tokens`, E2E 32/32 (gồm `collections.spec.ts`: import collection Postman lồng 3 cấp, gửi request với auth kế thừa, export so JSON). Review backend (2 High, 4 Medium) và web (6 Medium) đã sửa hết.
Còn cho đợt B: model revision và changelog có diff, restore-to-change; tag và status tag; example; trang trash có lọc; chọn nhiều; "Hoạt động gần đây"; tab Changelog ở thanh bên phải; tên người tạo; script đọc biến collection; khôi phục tab collection/folder sau khi tải lại.

### Đợt B (11/10/2026, Vòng 33)
Xong: changelog có diff (revision JSON Patch xuôi và ngược, gom session 5 phút, ẩn/hiện diff cho Editor, "Restore to this change" ghi thành revision mới), cờ `irreversible` trên dry run của các thay đổi quá lớn; tag và status tag; example (lưu từ response, sửa, nhân bản, round-trip v2.1 `response[]`); trang trash có lọc theo workspace, người xoá và tên; chọn nhiều và xoá hàng loạt; hoạt động gần đây cùng tên người tạo và người cập nhật; rail phải Info/Changelog; khôi phục tab collection/folder/example sau khi tải lại.
Kiểm: lint, typecheck, 567 file / 4087 test, `check:mcp-coverage`, `check:tokens`, E2E 33/33 (thêm `collections-changelog.spec.ts`). Review backend (1 High, 4 Medium) và web (5 Medium) đã sửa hết.

