# Kiểm toán tương đương Postman: Collections (phase 12) và Environments đợt A (phase 13)

Ngày: 2026-10-12 (Asia/Saigon). Chỉ đọc, không sửa source, không commit.

## Phạm vi và cách kiểm

- Đối chiếu từng dòng "Ma trận tương đương" của `phase-12-collections.md` và các dòng đợt A (T4, T5a, T6a, T7a, T9, T10a) của `phase-13-environments-and-variables.md` với code đã commit tại `HEAD = ab6deb1`.
- **Cây làm việc đang có WIP chưa commit của một session khác** cho phase 13 đợt B (`script-chain.ts`, `script-prelude.ts`, `use-variable-editor.ts`, `variable-row-menu.tsx`, `environment-transfer-*.ts`, `dynamic-variables.ts`...). Báo cáo này chấm theo HEAD; chỗ nào WIP có vẻ sẽ đóng finding thì ghi "WIP đang làm, chưa kiểm".
- Cờ: prod build với `mockMcp, mockPowerUps, apiClient, hybridMock, workspaces` (`infra/localman/released-features`). Toàn bộ Collections nằm sau `workspaces` (đang bật ở prod); toàn bộ UI Environments nằm sau `environments` (tắt ở prod, `use-environments-enabled.ts:5-8`). E2E chạy với cả hai cờ bật (`e2e/support/stack.ts:102`).
- Test đã chạy (từng file, `--maxWorkers=1`), tất cả đều pass:
  - web `tree-drop.test.ts`: 7/7
  - web `changelog-panel.test.tsx`: 3/3
  - shared `collection-tags.test.ts` + `collection-v21-round-trip.test.ts`: 22/22
  - api `collection-changelog.test.ts`: 3/3
  - api `environment-values.test.ts`: 8/8
  - web `environment-page.test.tsx`: 4/4

  Không chạy E2E, không chạy full suite, không build.

## Tóm tắt

| Phase 12, 16 dòng | Số dòng |
|---|---|
| OK | 10 |
| PARTIAL | 5 (Overview, thiết lập cấp collection/folder, kéo thả, Changelog, thanh bên phải) |
| MISSING (cả dòng) | 0 |
| BROKEN | 0 |
| Giao cho phase 14 (Fork/PR/Comments/Watch) | Không có nút chết. Không có chuỗi hay `data-id` nào còn sót |

Checklist phase 12 ghi "mọi dòng trong ma trận tương đương có test hoặc kịch bản E2E pass" là **không đúng**. Có 3 tiểu mục chưa được làm: environment và mock project liên quan (ở Overview và Info), kéo thả example, script đọc biến collection. Ngoài ra luật gom session 5 phút chưa có test.

Phase 13 đợt A: T4, T5a, T6a, T7a, T9, T10a đều có code thật. T5a thiếu test UI cho menu từng biến. Ngoài phạm vi đợt A, có 2 lối vào chết đang hiện ở prod: import file environment và snippet `lm.environment.set`.

## Phase 12: từng dòng ma trận

| # | Dòng ma trận | Trạng thái | Bằng chứng | Còn thiếu |
|---|---|---|---|---|
| 1 | Tạo collection (trống / template REST CRUD / từ mock project), đổi tên, nhân bản, xoá (có request thì phải gõ "delete") | OK | API: `collection-write-operations.ts:33` (create, `template` chỉ có `rest-crud` ở `rest-crud-template.ts:9`; "từ mock" dựng `tree` phía web ở `use-collection-create.ts:76-88`), `:58` update, `:77` duplicate, `:101` delete kèm `confirm`, `trash-service.ts:84`. UI: `collection-new-menu.tsx` (`new-menu-blank/template/from-mock`), `editable-name.tsx`, `tree-row-menu.tsx` (rename/duplicate), `delete-collection-modal.tsx:53` (trim + không phân biệt hoa thường, gửi đúng hằng `DELETE_CONFIRMATION`). Test: `collection-crud.test.ts`, `collection-duplicate.test.ts`, `collection-trash.test.ts` (CONFIRMATION_REQUIRED), `collections-menus.test.tsx:19,41,58` | Web chưa có test cho việc tạo từ template hay từ mock qua menu (chỉ có unit `collection-trees.test.ts` cho `mockProjectTree`) |
| 2 | Folder/subfolder lồng không giới hạn, thêm folder từ "View more actions" | OK | `node-menu-add-folder` trên collection và folder (`tree-row-menu.tsx:41-46`); API `collection-node-operations.ts:34` | Giới hạn sâu 64 cấp và 2000 node là chủ ý (đã ghi trong đợt A) |
| 3 | Kéo thả sắp lại request, folder, **example**, và kéo vào folder | **PARTIAL** | API: `collection-node-operations.ts:74` (move ghi 1 node, có hỗ trợ example trong cùng request: `node-move-service.ts:94,121`). UI dnd-kit: `collection-tree.tsx`, `use-tree-dnd.ts`, `tree-drop.ts`. Test: `tree-drop.test.ts`, `use-tree-dnd.test.tsx`, `collection-move-races.test.ts` | **Không kéo được example.** `tree-drop.ts:116` trả `null` cho mọi example, và cũng chặn thả lên example. Người dùng không sắp lại được thứ tự example dù API cho phép. Sửa ở: `tree-drop.ts` (`planMove`/`dropPositionAt`: cho example đổi chỗ với example cùng request), `use-tree-dnd.ts`, `tree-drop.test.ts`. Ngoài ra không kéo được giữa hai collection (ma trận không đòi) |
| 4 | Sort theo tên, theo thời gian | OK | `tree-rows.ts:17` (`name-asc`, `name-desc`, `updated`), lưu ở localStorage (`use-collection-sort.ts`), nút `sidebar-collections-sort` (`collection-search-bar.tsx:61`). Test: `tree-rows.test.ts` | Sort chỉ áp cho collection, không áp cho nội dung bên trong (giống Postman) |
| 5 | Favorite đẩy lên đầu; search lọc collection và nội dung | OK | `collection-favorite-operations.ts:23`, `collection-list-service.ts:169`, `tree-rows.ts:35`, `sidebar-tree-star` (`tree-row-parts.tsx:94`). Search phía server: `collection-search-operations.ts:23`, `collection-search-bar.tsx:53`. Test: `collection-search.test.ts` (api), `collection-search.test.tsx`, `collections-sidebar.test.tsx` | Search không khớp example (`collection-search-service.ts:17` chỉ có folder và request). Mức Low |
| 6 | Chọn nhiều ⌘/Ctrl-click, xoá hàng loạt | OK | `open-row.ts:38-39` (Ctrl/Meta là toggle, Shift là range), `tree-keys.ts:23`, `bulk-bar.tsx:41`, `bulk-delete-modal.tsx:89` (gõ "delete" khi có request). API `collection-trash-operations.ts:98`, `collection-node-batch-operations.ts:82`. Test: `tree-selection.test.tsx:33,51`, `bulk-delete.test.tsx`, `collection-bulk.test.ts` | — |
| 7 | Overview: mô tả Markdown, người tạo, cập nhật cuối, **environment liên quan**, hoạt động gần đây; **mock project liên quan** | **PARTIAL** | `page-overview.tsx` (Markdown, Edit/Save), `collection-meta.tsx` (người tạo, cập nhật bởi ai lúc nào, workspace, số request), `collection-activity.tsx` (5 thay đổi gần nhất, op `client.getCollectionActivity` ở `changelog-operations.ts:126`). Test: `collection-page.test.tsx`, `changelog-panel.test.tsx` | **Thiếu environment liên quan và mock project liên quan.** Model không có trường liên kết nào (`packages/shared/src/api-client/collections/collection-model.ts`; tạo từ mock không lưu `projectId`), UI không có `collection-meta-env`/`collection-meta-mock` như prototype (`api-client.html:3637-3638`). Người dùng không biết collection sinh từ mock project nào và không mở được project đó. Sửa ở: shared `collection-model.ts` + `collection-schemas.ts` (thêm `mockProjectId` tuỳ chọn, và cách xác định environment liên quan), api `collection-model.ts`, `collection-service.ts` (create nhận `mockProjectId`), `collection-view.ts`, web `use-collection-create.ts` (gửi `projectId` khi tạo từ mock), `collection-meta.tsx`, i18n `collections-meta` (en/vi/zh-CN), test. Phần environment phải nằm sau cờ `environments` |
| 8 | Thiết lập cấp collection và folder: Authorization (kế thừa), Scripts (pre/post), Variables (scope collection); thứ tự script collection → folder → request | **PARTIAL** | Tab: `collection-page.tsx:31` (folder không có Variables, đúng như Postman). Kế thừa auth và thứ tự script: `packages/shared/.../request-context.ts`, test `request-context.test.ts:74,91,102`. Request builder hiện nguồn auth kế thừa: `inherit-source-note.tsx:51`. Chuỗi script: `script-chain.ts`, `send-steps.ts:96-103`. `{{var}}` từ biến collection: `send-steps.ts:120-123` | **Script không đọc được biến collection** (theo HEAD). `script-chain.ts:63,90` truyền `environment: {}`, nên `lm.variables.get("baseUrl")` hay `lm.environment.get(...)` luôn trả `undefined`, dù `{{baseUrl}}` trong URL vẫn được điền. Mục "script đọc biến collection" có trong danh sách "Còn cho đợt B" của đợt A nhưng không có trong "Xong" của đợt B. WIP chưa commit đang thêm `lm.collectionVariables`/`lm.globals` (chưa kiểm). Sửa ở: `script-chain.ts`, `send-steps.ts`, `packages/shared/.../script-sandbox/*`, kèm test chuỗi script đọc biến collection |
| 9 | Example: tạo từ response, sửa, nhân bản | OK | API `collection-node-operations.ts:34` (`kind: "example"`), `collection-node-batch-operations.ts:60`. UI: `response-with-example.tsx:78` (`response-save-example`), `example-page.tsx:80-113`, `node-menu-add-example`. Test: `collection-examples.test.ts`, `collection-examples.test.tsx:64,90,107,123`, `example-response-form.test.tsx`, shared `collection-v21-examples.test.ts`, E2E `collections-changelog.spec.ts:11` | Chỉ request đã lưu vào collection mới lưu được example (giống Postman) |
| 10 | Tag: tối đa 10, mỗi tag 64 ký tự, không phân biệt hoa thường, đầu và cuối là chữ hoặc số | OK | `packages/shared/.../collection-tags.ts` (`COLLECTION_TAGS_MAX = 10`, `TAG_MAX_LENGTH = 64` tính theo code point, lưu chữ thường, `TAG_EDGES` dùng `\p{L}\p{N}`), schema ở API. UI `collection-tags.tsx` (ẩn ô nhập khi đủ 10 tag, báo lỗi qua `t()`). Test: `collection-tags.test.ts:21-54`, `collection-tags-api.test.ts`, `collection-status-tags.test.tsx:112` | Có thêm luật NFC và cấm ký tự vô hình, chặt hơn Postman, chấp nhận được |
| 11 | Status tag: preset, hoặc tuỳ chỉnh có emoji (2–64 ký tự, bắt đầu bằng chữ) | OK | `collection-tags.ts` (`validateStatus`, `STATUS_NAME_MIN = 2`/`MAX = 64`, `STARTS_WITH_LETTER`, `isSingleEmoji`). UI `status-menu.tsx`, `custom-status-modal.tsx:50`. Test: `collection-tags.test.ts:84-101`, `collection-status-tags.test.tsx:49,75` | Low: `custom-status-modal.tsx:56` viết cứng `min: 2` thay vì dùng `STATUS_NAME_MIN`. `maxLength={STATUS_NAME_MAX}` của input đếm theo UTF-16 nên chặt hơn validator với ký tự astral (vô hại) |
| 12 | Changelog: theo thời gian, có tác giả, gom session, View diff, Hide/Show diff (Editor), "Restore to this change" | **PARTIAL** (lệch hành vi, không phải thiếu) | API `changelog-operations.ts:36,58,76,99`; gom session `changelog-view.ts:93-121` với `CHANGELOG_SESSION_GAP_MS = 5 * 60_000` (`changelog-model.ts:29`); restore ghi revision mới (`change-restore-service.ts`). UI `changelog-panel.tsx`, `changelog-change-item.tsx` (view, hide/show chỉ cho Editor, restore). Test: `collection-changelog.test.ts:61,89`, `collection-change-restore.test.ts`, `changelog-restore.test.tsx`, `diff-view.test.tsx`, E2E `collections-changelog.spec.ts` | (a) Diff bị ẩn thì **chính Editor cũng không xem được**: `changelog-change-item.tsx:35` không tải diff khi `hidden`, và API `changelog-service.ts:141` trả `available:false` cho mọi vai trò. Prototype (`api-client.html:3922`) cho Editor vẫn xem kèm ghi chú. Test API cố ý chốt "hides it for everyone", nên đây là quyết định lệch prototype cần được xác nhận. (b) Luật 5 phút là khoảng cách giữa hai thay đổi liên tiếp (chuỗi nối dài vô hạn nếu mỗi khoảng ≤ 5 phút), trong khi copy ghi "within 5 minutes". **Không có test** nào tách 2 session cùng tác giả khi cách nhau hơn 5 phút. (c) Trang 100 revision (`CHANGELOG_PAGE`) có thể cắt đôi một session ở ranh giới trang. (d) Viewer không thấy nút Restore (prototype hiện nút disabled kèm lý do). Mức Low |
| 13 | Trash: tìm, lọc theo workspace / người xoá, Restore vào workspace chọn, Delete permanently (Admin/Editor ở thời điểm xoá), giữ 30 ngày rồi job xoá | OK | API `collection-trash-operations.ts:25,44,67`, quyền theo vai trò hiện tại (`trash-access.ts:55-80`), `TRASH_RETENTION_DAYS = max(free, pro).trashDays = 30` (`trash-access.ts:21`, `plan-limits.ts:49,64`), job `trash-purge-job.ts` (đăng ký ở `background-jobs.ts:2`), purge xoá cả revision, favorite, share, access request và local values (`trash-purge.ts:36-41`). UI `trash-page.tsx`, `trash-filters.tsx` (`trash-search`, `trash-filter-workspace`, `trash-filter-deleted-by`), `restore-modal.tsx` (`modal-restore-workspace`), lối vào `sidebar-rail-trash` (`sidebar-rail.tsx:94`). Test: `collection-trash*.test.ts`, `trash-page.test.tsx:60-137`, `trash-filters.test.tsx`, `trash-restore-errors.test.tsx` | Không có câu so sánh với đối thủ (`trash-retention-compare`), đúng quy tắc i18n |
| 14 | Export v2.1, Import (v2.1, cURL, OpenAPI), round-trip không mất dữ liệu | OK | `collection-read-operations.ts:64` (export), UI `node-menu-export` và `collection-more-export` (Viewer cũng export được: `tree-row-menu.tsx:55`). Import lưu thành collection: `collections-import-modal.tsx`, `use-collection-create.ts:111`. Round-trip kiểm bằng JSON Schema chính thức: `collection-v21-round-trip.test.ts`, `collection-v21-postman.test.ts`, `collection-v21-examples.test.ts`; tag và status đi trong `_localman` (`collection-v21-extension.ts:84-115`). E2E `collections.spec.ts:77` | Giá trị biến secret bị để trống khi export (chủ ý, đã ghi ở đợt A), nên round-trip mất giá trị secret |
| 15 | Share, Copy link, Move (phase 11); Fork, PR, Comments, Watch (phase 14) | OK cho phần phase 11 | Menu collection: share, copyLink, move (`tree-row-menu.tsx:41-46`), header Share và "…" (Copy link, Export) ở `page-header.tsx:78-110`, `move-collection-modal.tsx:84`, `collection-share-dialog.tsx`. Test: `collections-menus.test.tsx:74,116`, `share-dialog.test.tsx`, api `move-operations.test.ts` | Phase 14: không có nút, chuỗi i18n hay `data-id` fork/pr/comment/watch nào (đã grep), nên không có UI chết. Copy link chỉ có ở collection, không có ở folder/request (prototype có `node-menu-copy-link` cho mọi node). Mức Low |
| 16 | Thanh bên phải: Info (ID, người tạo, **mock project liên quan**), Changelog, Comments, PRs, Forks | **PARTIAL** | `right-rail.tsx` (Info, Changelog; `right-rail-info`, `right-rail-changelog`, `right-panel-*`, drawer < 768px), `info-panel.tsx` (ID kèm copy, `CollectionMeta`). Test: `right-rail.test.tsx`, `changelog-panel.test.tsx` | Info thiếu mock project liên quan (cùng nguyên nhân với dòng 7), cũng thiếu "Ngày tạo" và "Vai trò của bạn" so với prototype (`api-client.html:3873-3880`). Không có rail cho request chưa lưu (prototype hiện Info kèm lời nhắc lưu). Comments, PRs, Forks không hiện: đúng phạm vi phase 14. Sửa ở: `info-panel.tsx`, `collection-meta.tsx`, i18n `collections-meta` |

### Lệch `data-id` so với prototype (phase 12)

| Prototype | Web | Ghi chú |
|---|---|---|
| `collection-header-share` | `collection-share` (`page-header.tsx:82`) | Đổi tên |
| `collection-meta-env`, `collection-meta-mock` | không có | Tính năng thiếu (dòng 7) |
| `folder-overview` (`${n.type}-overview`) | `collection-overview` dùng cho cả folder (`page-overview.tsx:40`) | Trang folder dùng nhầm id của collection |
| `right-info` | không có (chỉ có `right-panel-info`, `right-panel-info-id`) | Nhỏ |
| `modal-restore-change` | `modal-changelog-restore` (`changelog-panel.tsx:152`) | Đổi tên |
| `status-menu-clear` | `status-menu-remove` (`status-menu.tsx:101`) | Đổi tên |
| `modal-save-request`, `modal-save-request-name/dest` | `modal-save-to-collection*` | Đổi tên |
| `statusbar-trash`, `user-menu-trash` | chỉ có `sidebar-rail-trash` | Prototype có 3 lối vào, web có 1 |
| `node-menu-open` | không có | Nhỏ |
| `trash-retention-compare` | cố ý bỏ | Quy tắc không nêu tên đối thủ |

Quy trình T1 ghi "chốt `data-id` theo prototype": các id ở trên lệch mà không có ghi chú ở đâu. Nếu E2E hoặc người dùng trỏ theo prototype thì sẽ không khớp.

### i18n (phase 12 và 13)

- Không tìm thấy chuỗi hard-code trong `features/collections` và `features/environments` (đã quét thuộc tính `title`, `aria-label`, `placeholder`, `label` và text JSX).
- Bộ `vi` và `zh-CN` được TypeScript ép đủ khoá (`Messages["collections"]`, `Pick<...>`, `Messages["environments"]`), nên không thể thiếu khoá mà vẫn typecheck sạch.
- `check:i18n` chặn tên đối thủ.

## Phase 13: các dòng đợt A

| Việc | Trạng thái | Bằng chứng | Ghi chú |
|---|---|---|---|
| T4 Model và operation (tạo, đổi tên, duplicate, delete có dry run, màu, set active, globals); list không lộ secret cho Viewer | OK | 15 operation đếm được: `environment-operations.ts:40,58,84,100`, `environment-change-operations.ts:25,49,74,98` (delete có `dryRun: true` ở `:115`), `globals-operations.ts:35,51,71`, `variable-scope-operations.ts:29,46,70,91`. Test: `environment-crud.test.ts`, `environment-secrets.test.ts`, `environment-lifecycle.test.ts` | — |
| T5a Thao tác đơn từng biến: Share value, Update shared value, Reset value, Unshare, Copy value; Viewer sửa shared nhận 403 | OK, **thiếu test UI** | `variable-row-menu.tsx` (HEAD), `use-variable-editor.ts` (HEAD `share` và `unshare` ở `:147-164`). API 403: `environment-values.test.ts` (8/8 pass) | (a) Không có test web nào bấm Share, Update, Reset, Unshare hay Copy (`environment-page.test.tsx` chỉ sửa ô local và shared; `variable-rows.test.ts` chỉ kiểm trạng thái Edited/Synced). (b) Unshare ở HEAD chỉ đặt `sharedValue: null`. Editor nào chưa có giá trị local sẽ mất giá trị đang dùng; tài liệu Postman không nói rõ local có được giữ hay không (xem câu hỏi mở). Hai file này đang bị WIP sửa |
| T6a Web dựng globals, collection (kèm local) và environment active cho `prepareSend`; secret bị giấu thì dừng với `SECRET_WITHHELD` | OK | `use-variable-layers.ts` (bật theo cờ `environments`), `send-steps.ts:113-123`, test `send-variables.test.ts` | Khi cờ tắt (prod), biến collection vẫn được điền nhờ `context.variables` |
| T7a UI environment | OK | `environments-sidebar.tsx:83,99` (thêm, Globals), `environment-list-row.tsx` (set active, duplicate, delete), `environment-selector.tsx` (cuối thanh tab), `environment-header.tsx` (màu, đổi tên, Read only, Request to edit, Set active, Share, More), `globals-page.tsx`, `variable-table.tsx:76-94` (Name, Value local, Shared value, Description, Type, Enabled, Status, More), lọc `environment-filter`. Share collection kèm environment: `share-people-include-env` (`use-shareable-environments.ts`). Test: `environment-page.test.tsx:29,78,109,142` | Các id được claim (`environment-header*`, `environment-editor`, `environment-filter`, `var-table*`, `globals-editor`, `environment-viewer-note`) đều khớp. Các id **không** được claim nhưng lệch prototype: `sidebar-envs-*` thành `environments-add`/`environments-globals`/`environment-row*`; `env-select-*` thành `environment-selector-*`; `env-menu-*` thành `environment-row-*`; `var-menu-*` thành `var-table-*` |
| T9 Integration A/B, không lộ secret | OK | `environment-values.test.ts`, `environment-crud.test.ts`, `environment-lifecycle.test.ts`, `variable-scopes.test.ts`, `environment-secrets.test.ts` | — |
| T10a E2E `{{baseUrl}}/users`, đổi environment active, local thắng shared | OK (không chạy lại) | `e2e/specs/environments-and-variables.spec.ts:32,70` | — |

### Các dòng ma trận phase 13 chưa có, ngoài danh sách đợt B

- "Tạo environment từ dấu `+` trong ô chọn environment": selector không có mục tạo mới (prototype có `env-select-create`).
- "Nút Globals ở footer": không có `statusbar-globals`. Globals chỉ mở được từ sidebar.
- "Local/shared áp cho biến collection": API có (`client.get/setCollectionLocalValues`), web có hàm `setCollectionLocalValues` (`variable-scopes-api.ts:54`) và hook `useCollectionLocalValues` (`use-environments.ts:82`) nhưng **không nơi nào gọi**. Tab Variables của collection (`page-variables.tsx`) không có cột local. Người dùng không đặt được giá trị local cho biến collection qua UI, chỉ qua API hoặc MCP. Sửa ở: `page-variables.tsx` (thêm cột Value local và Shared, dùng lại `useVariableEditor` hoặc `variable-table.tsx` khi cờ `environments` bật), `collection-page.tsx`, test.

### Lối vào chết đang hiện ở prod (cờ `apiClient` bật)

1. **Import file environment**: `import-modal.tsx:110-131` nhận ra file environment v2.1 và hiện nút "Import environment". Bấm xong modal đóng nhưng không có gì xảy ra, vì `api-client-screen.tsx:69` bỏ qua mọi lựa chọn khác `requests`, không có toast. Thuộc T5b, nhưng người dùng prod gặp ngay hôm nay. Sửa ở: `import-modal.tsx` (khi cờ `environments` tắt thì từ chối file environment kèm lời giải thích, hoặc tắt nút), `api-client-screen.tsx`. WIP `environment-transfer-*` có thể là nơi nối vào.
2. **Snippet `lm.environment.set`/`unset`** (`script-snippets.ts:8-9,16`): ở HEAD, chuỗi script bỏ `result.environment` (`script-chain.ts:63,90` truyền `{}` vào và chỉ giữ lại `variables`), nên giá trị ghi vào bị mất mà không báo gì. WIP đang sửa, chưa kiểm.

### Đợt B (đã biết là còn thiếu, không đào sâu)

T2b `$random*` theo whitelist Faker; T5b bản "all" kèm revision, import/export environment JSON; T6b server điền secret bị giấu, `lm.environment`/`lm.collectionVariables`/`lm.globals` ghi vào local; T7b pane Variables, rail Info cho environment, menu "all"; T8 highlighter, tooltip, gợi ý `{{`, "Set as variable"; T10b hover thấy scope; T11b bật cờ; T12b review. Fork/Merge thuộc phase 14.

## Ưu tiên khuyến nghị

1. **High**: Bổ sung liên kết mock project (và environment, sau cờ) cho Overview và Info, hoặc sửa checklist phase 12 cho trung thực rằng dòng 7 và 16 mới làm một phần.
2. **High**: Script đọc được biến collection (WIP đang làm). Cần thêm test chuỗi `collection → folder → request` đọc `{{baseUrl}}` qua script.
3. **Medium**: Chặn hoặc giải thích việc import file environment ở prod. Ẩn snippet `lm.environment.*` cho tới khi ghi được.
4. **Medium**: Cho kéo example trong cùng request (`tree-drop.ts:116`).
5. **Medium**: UI giá trị local cho biến collection, hoặc gỡ `setCollectionLocalValues`/`useCollectionLocalValues` đang chết.
6. **Medium**: Test web cho menu từng biến (Share, Update, Reset, Unshare, Copy). Test tách session khi cách nhau hơn 5 phút.
7. **Low**: Thống nhất `data-id` với prototype (bảng ở trên). `folder-overview`. `STATUS_NAME_MIN`. Search khớp example. Copy link cho node. Session bị cắt ở ranh giới trang.

## Câu hỏi mở

1. Ẩn diff "với mọi người, kể cả Editor" (test API đang chốt như vậy) có phải quyết định có chủ ý thay cho prototype không?
2. Unshare có nên chuyển giá trị shared hiện tại thành giá trị local của người bấm không? Tài liệu Postman không nói rõ.
3. "Environment liên quan" nên lấy từ đâu: liên kết lưu tay, environment được share kèm, hay environment đang active khi tạo?

Status: DONE_WITH_CONCERNS
