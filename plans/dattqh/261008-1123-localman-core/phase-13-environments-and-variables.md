---
phase: 13
title: "Environments và biến tương đương 100% Postman"
status: pending
priority: P1
effort: "L"
dependencies: [11, 12]
---

# Phase 13: Environments và biến

## Goal
Làm environment, biến global và biến collection theo đúng mô hình của Postman: phạm vi và thứ tự ưu tiên, giá trị **local** và **shared**, biến secret, bật/tắt biến, mô tả, màu, environment đang active, pane Variables, các cách đặt biến ngay trong UI, biến động, API `pm.*` trong script, import/export và chia sẻ.

Nguồn tham chiếu: [Managing environments](https://learning.postman.com/docs/sending-requests/variables/managing-environments/), [Team environments](https://learning.postman.com/docs/use/send-requests/variables/team-environments/), [Share variables](https://learning.postman.com/docs/use/send-requests/variables/share-variables/), [Define variables](https://learning.postman.com/docs/use/send-requests/variables/define-variables/), [Variables](https://learning.postman.com/docs/sending-requests/variables/variables/).

## Ma trận tương đương (mọi dòng là tiêu chí nghiệm thu)

| Tính năng Postman | Localman |
|---|---|
| Tạo environment từ sidebar hoặc từ dấu `+` trong ô chọn environment; đặt tên, gán màu | Có |
| Đổi tên (sửa trực tiếp tên), Duplicate, Delete (xoá luôn các biến) | Có |
| Ô chọn environment active ở góc trên bên phải, nút "Set active" trong sidebar | Có |
| Pane Variables (xem nhanh): giá trị local của environment đang active cùng biến global | Có |
| Biến global (luôn dùng được, có nút Globals ở footer) | Có |
| Biến: tên, giá trị, mô tả (cột Description), bật/tắt (tắt thì tham chiếu sẽ rỗng; Viewer không bật lại được) | Có |
| Biến Secure: icon khoá, che giá trị, mã hoá khi lưu | Có. Mã hoá AES-256-GCM phía server. Vault **không** làm (Jev xác suất 0.37) |
| **Giá trị local và shared:** local là của riêng từng user, không đồng bộ; shared đồng bộ cho mọi người có quyền | Có, áp cho biến environment, collection và global |
| Share 1 giá trị, Share all, cột Shared Value (More > Shared Value), "Update shared value", "Update all shared values", "Reset value", "Reset all shared values", Unshare, "Unshare all", icon trạng thái Edited/Synced, Copy | Có, đúng tên các thao tác |
| Chỉ Editor tạo hoặc sửa được giá trị shared. Viewer chỉ đặt local, environment hiện "Read only", có nút "Request to Edit" | Có (dùng phase 11) |
| Phạm vi và thứ tự ưu tiên: global < collection < environment < local (giá trị bị ghi đè hiện gạch ngang) | Có. Scope `data` đi cùng Collection Runner (ngoài phạm vi, Jev 0.44) |
| Cú pháp `{{var}}` trong URL, params, headers, body, auth; hover xem giá trị và scope; tô đỏ biến chưa khai báo; gõ `{{` hiện gợi ý | Có |
| "Set as variable" khi bôi đen trong request hoặc response; "Add to" chọn scope khi hover biến chưa khai báo; biến tạm không scope | Có |
| Biến động `{{$guid}}`, `{{$timestamp}}`, `{{$isoTimestamp}}`, `{{$randomInt}}` và nhóm `$random*` | Có, dùng chung whitelist Faker của phase 04 |
| Script: `pm.environment`, `pm.collectionVariables`, `pm.globals`, `pm.variables` với `get`, `set`, `unset`, `has`, `toObject`, `clear` | Có, chạy trong sandbox QuickJS của phase 10. Script **ghi vào giá trị local** như Postman; Editor muốn đẩy lên shared thì dùng "Update shared value" |
| Export và import environment dạng JSON (định dạng Postman environment, chỉ có giá trị shared) | Có, round-trip với file của Postman |
| Share environment (người hoặc email, Viewer/Editor), Copy link, Move, Fork/Merge | Phase 11 và 14 |
| Thanh bên phải: Info (ID, người tạo, nơi đang dùng), Forks, Pull requests | Có |

## Files to Create / Modify
- Create `apps/api/src/modules/environments/`: `environment-model.ts` (`{workspaceId, name, color, variables:[{key, sharedValue|null, type:'default'|'secret', enabled, description}]}`), `global-variables-model.ts` (theo workspace), `local-variable-value-model.ts` (`{userId, scopeType, scopeId, key, value}`, chỉ chủ sở hữu đọc được), `active-environment-model.ts` (theo user và workspace), `secret-cipher.ts` (AES-256-GCM, key lấy từ env, có key id để xoay vòng), routes và service
- Create `packages/shared/src/variable-resolver.ts` (hàm thuần: đầu vào là các tầng scope, đầu ra là giá trị kèm scope thắng và danh sách bị ghi đè) và `dynamic-variables.ts`
- Modify `apps/api/src/modules/api-client/` (request preparer phía server) để dựng giá trị bằng `variable-resolver` trước khi proxy
- Create `apps/web/src/features/environments/`: `environment-selector.tsx`, `environment-editor.tsx` (bảng có cột Name, Value, Shared Value, Description, Type, Enabled, cùng menu More), `variables-pane.tsx`, `globals-editor.tsx`, `value-sync-indicator.tsx` (Edited/Synced), `color-picker.tsx`
- Create `apps/web/src/features/variables/`: `variable-highlighter.ts` (CodeMirror extension: tô màu, đánh dấu biến chưa khai báo, tooltip khi hover, gợi ý khi gõ `{{`), `set-as-variable-menu.tsx`

## Tasks & Steps
1. Viết `variable-resolver` trước, có test đủ mọi tổ hợp scope, biến tắt và giá trị local hoặc shared bị thiếu.
2. Giá trị dùng khi gửi request là: local nếu user đã có local, ngược lại là shared. Đúng như Postman: "Requests and scripts use the active environment's local values".
3. Secret: không bao giờ trả plaintext cho Viewer qua API list; chỉ giải mã ở bước proxy. UI che giá trị và có nút hiện cho chính chủ hoặc Editor.
4. Thao tác share, update, reset, unshare đều có bản "all" dạng batch, và ghi revision giống changelog của phase 12.
5. Import/export dùng định dạng environment JSON của Postman. Export chỉ xuất giá trị shared, không xuất local và secret.

## Verification
- Unit: `variable-resolver` (test dạng bảng), biến động, `secret-cipher` (mã hoá đi rồi về, key sai thì lỗi).
- Integration: hai user A (Editor) và B (Viewer) trên cùng environment. A share giá trị thì B thấy shared. B đặt local thì A không thấy. B gọi API sửa shared thì nhận 403. Reset làm local trở về bằng shared.
- E2E: tạo environment, đặt `baseUrl`, gửi `{{baseUrl}}/users` tới mock, đổi environment active thì URL đổi theo, hover thấy đúng scope.

## Giao việc
**Đợt:** 6 · **Phụ thuộc trước khi bắt đầu:** phase 11 và 12 đã xong (trong đợt 6 chạy sau 12, trước 14, 15, 16); phase 10 đã có request preparer và sandbox QuickJS; phase 04 đã có whitelist Faker · **Lệnh cook:** `/ak:cook plans/dattqh/261008-1123-localman-core/phase-13-environments-and-variables.md`

| # | Việc | Vai trò | Song song | File chính |
|---|---|---|---|---|
| T1 | Đối chiếu ma trận với prototype `prototype/api-client.html` (`#/workspace`: `environment-header*`, `environment-editor`, `var-table*`, `vars-quick*`, `globals-editor`, `var-tooltip*`, `var-suggest*`, `modal-set-variable-*`). Chốt danh sách component, trạng thái Viewer/Editor (`environment-header-readonly`, `environment-header-request-edit`) và icon Edited/Synced | ui-ux-designer | với T2, T3 | `prototype/api-client.html` (chỉ đọc) |
| T2 | Viết `variable-resolver` (thứ tự global < collection < environment < local, trả scope thắng và danh sách bị ghi đè) cùng `dynamic-variables` dùng whitelist Faker, kèm test dạng bảng cho mọi tổ hợp scope, biến tắt, thiếu local hoặc shared | fullstack-developer | với T1, T3 | `packages/shared/src/variable-resolver.ts`, `packages/shared/src/dynamic-variables.ts` |
| T3 | Viết `secret-cipher` AES-256-GCM, key lấy từ env, có key id để xoay vòng; unit test mã hoá đi rồi về và key sai thì lỗi | fullstack-developer | với T1, T2 | `apps/api/src/modules/environments/secret-cipher.ts` |
| T4 | Tạo model environment, global variables, local value, active environment; khai báo operation qua registry (toolset `client`) cho tạo, đổi tên, duplicate, delete, đặt màu, set active, globals; quyền qua `access-policy` của phase 11; API list không trả plaintext secret cho Viewer | fullstack-developer | — | `apps/api/src/modules/environments/` (model, routes, service) |
| T5 | Làm thao tác share/update/reset/unshare đơn lẻ và bản "all" dạng batch, ghi revision như changelog phase 12; Viewer chỉ ghi local (sửa shared nhận 403). Làm import/export environment JSON định dạng Postman, chỉ xuất giá trị shared, không xuất local hay secret | fullstack-developer | — | `apps/api/src/modules/environments/` (service, codec import/export) |
| T6 | Nối `variable-resolver` vào request preparer phía server và đường gửi thẳng từ trình duyệt (dùng local nếu có, không thì shared; secret chỉ giải mã ở bước proxy). Thêm API `pm.environment`, `pm.collectionVariables`, `pm.globals`, `pm.variables` (`get`, `set`, `unset`, `has`, `toObject`, `clear`) vào sandbox, script ghi vào giá trị local | fullstack-developer | — | `apps/api/src/modules/api-client/`, `apps/web/src/features/api-client/scripts/` |
| T7 | Làm UI environment: `environment-selector`, `environment-editor` (cột Name, Value, Shared Value, Description, Type, Enabled và menu More), `value-sync-indicator`, `color-picker`, `globals-editor`, `variables-pane`, thanh phải Info (tab Forks và Pull requests để trống cho phase 14) | fullstack-developer | với T8 | `apps/web/src/features/environments/` |
| T8 | Làm CodeMirror extension `variable-highlighter` (tô màu, tô đỏ biến chưa khai báo, tooltip giá trị và scope, gạch ngang giá trị bị ghi đè, gợi ý khi gõ `{{`) và `set-as-variable-menu` ("Set as variable", "Add to" chọn scope, biến tạm) | fullstack-developer | với T7 | `apps/web/src/features/variables/` |
| T9 | Viết integration test hai user A (Editor) và B (Viewer): share, local riêng tư, B sửa shared nhận 403, reset về shared; round-trip file environment của Postman; test bắt buộc API list không lộ plaintext secret | tester | với T10 | test trong `apps/api/src/modules/environments/` |
| T10 | Viết E2E: tạo environment, đặt `baseUrl`, gửi `{{baseUrl}}/users` tới mock, đổi environment active thì URL đổi theo, hover thấy đúng scope | tester | với T9 | `e2e/specs/environments-and-variables.spec.ts` |
| T11 | Deploy bản phase lên staging (cần user xác nhận) | fullstack-developer | — | `deploy/compose.staging.yml` |
| T12 | Review cuối phase | code-reviewer | — | toàn phase |

### Checklist
- [ ] T1 Spec component và trạng thái Viewer/Editor đã chốt theo prototype
- [ ] T2 `variable-resolver` và `dynamic-variables` có test bảng đủ tổ hợp
- [ ] T3 `secret-cipher` có test round-trip và key sai
- [ ] T4 Model và operation environment, globals, active environment qua registry
- [ ] T5 Share/update/reset/unshare (đơn và all), revision, import/export Postman
- [ ] T6 Resolver nối vào preparer và đường gửi thẳng; `pm.*` trong sandbox ghi local
- [ ] T7 UI environment đủ cột và menu More theo ma trận
- [ ] T8 Highlighter, tooltip, gợi ý `{{`, "Set as variable"
- [ ] T9 Integration A/B và test không lộ secret pass
- [ ] T10 E2E environment pass
- [ ] T11 Staging đã deploy sau khi user xác nhận
- [ ] T12 Review không còn finding mức high
- [ ] Verification: unit `variable-resolver` (bảng), biến động và `secret-cipher` pass
- [ ] Verification: integration A Editor/B Viewer (share, local riêng, 403, reset) pass
- [ ] Verification: E2E `{{baseUrl}}/users`, đổi environment active, hover đúng scope pass
- [ ] Mọi dòng ma trận tương đương có test hoặc kịch bản E2E tương ứng
- [ ] `pnpm lint && pnpm typecheck && pnpm test` sạch
- [ ] `pnpm check:mcp-coverage` pass
