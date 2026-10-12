---
phase: 13
title: "Environments và biến tương đương 100% Postman"
status: in-progress
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
4. Thao tác share, update, reset, unshare đều có bản "all" dạng batch (không ghi revision cho environment, Vòng 38).
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
| T5 | Làm thao tác share/update/reset/unshare đơn lẻ và bản "all" dạng batch (không revision, Vòng 38); Viewer chỉ ghi local (sửa shared nhận 403). Làm import/export environment JSON định dạng Postman, chỉ xuất giá trị shared, không xuất local hay secret | fullstack-developer | — | `apps/api/src/modules/environments/` (service, codec import/export) |
| T6 | Nối `variable-resolver` vào request preparer phía server và đường gửi thẳng từ trình duyệt (dùng local nếu có, không thì shared; secret chỉ giải mã ở bước proxy). Thêm API `pm.environment`, `pm.collectionVariables`, `pm.globals`, `pm.variables` (`get`, `set`, `unset`, `has`, `toObject`, `clear`) vào sandbox, script ghi vào giá trị local | fullstack-developer | — | `apps/api/src/modules/api-client/`, `apps/web/src/features/api-client/scripts/` |
| T7 | Làm UI environment: `environment-selector`, `environment-editor` (cột Name, Value, Shared Value, Description, Type, Enabled và menu More), `value-sync-indicator`, `color-picker`, `globals-editor`, `variables-pane`, thanh phải Info (tab Forks và Pull requests để trống cho phase 14) | fullstack-developer | với T8 | `apps/web/src/features/environments/` |
| T8 | Làm CodeMirror extension `variable-highlighter` (tô màu, tô đỏ biến chưa khai báo, tooltip giá trị và scope, gạch ngang giá trị bị ghi đè, gợi ý khi gõ `{{`) và `set-as-variable-menu` ("Set as variable", "Add to" chọn scope, biến tạm) | fullstack-developer | với T7 | `apps/web/src/features/variables/` |
| T9 | Viết integration test hai user A (Editor) và B (Viewer): share, local riêng tư, B sửa shared nhận 403, reset về shared; round-trip file environment của Postman; test bắt buộc API list không lộ plaintext secret | tester | với T10 | test trong `apps/api/src/modules/environments/` |
| T10 | Viết E2E: tạo environment, đặt `baseUrl`, gửi `{{baseUrl}}/users` tới mock, đổi environment active thì URL đổi theo, hover thấy đúng scope | tester | với T9 | `e2e/specs/environments-and-variables.spec.ts` |
| T11 | Deploy bản phase lên staging (cần user xác nhận) | fullstack-developer | — | `deploy/compose.staging.yml` |
| T12 | Review cuối phase | code-reviewer | — | toàn phase |

### Checklist
- [x] T1 Spec component và trạng thái Viewer/Editor đã chốt theo prototype (2026-10-12): dùng đúng `data-id` của prototype (`environment-header*`, `environment-editor`, `environment-filter`, `var-table*`, `globals-editor`, `environment-viewer-note`); `vars-quick*`, `var-tooltip*`, `var-suggest*`, `modal-set-variable-*` làm ở đợt B
- [x] T2 `variable-resolver` và `dynamic-variables` có test bảng đủ tổ hợp
  - [x] T2a `packages/shared/src/api-client/environments/variable-resolver.ts` (2026-10-12): global < collection < environment < temporary, local thắng shared, trả scope thắng và danh sách bị ghi đè, secret bị giấu vẫn thắng và không bị tầng dưới điền thay; 13 test bảng
  - [x] T2b (2026-10-12): 109 tên `$random*` map sang whitelist Faker, web tải chunk Faker riêng khi request cần (Jev 1,0); `DYNAMIC_VARIABLES` cho gợi ý
- [x] T3 `secret-cipher` có test round-trip và key sai (2026-10-12): dùng lại `TokenCipher`, keyring `VARIABLE_ENCRYPTION_KEY` không bắt buộc (thiếu thì 503), slot làm associated data; 5 test gồm round-trip, sai slot, sai khoá, khoá đã xoay, thiếu keyring
- [x] T4 Model và operation environment, globals, active environment qua registry (2026-10-12, commit `9198c6a`): 15 operation toolset `client` có MCP; xoá vĩnh viễn có dry run; xoá workspace dọn environment và globals; danh sách đếm biến bằng `$size`
- [x] T5 Share/update/reset/unshare (đơn và all), import/export Postman (không revision cho environment, Vòng 38)
  - [x] T5a Thao tác đơn từng biến trên UI (2026-10-12): Share value, Update shared value, Reset value, Unshare, Copy value; Viewer sửa shared nhận 403
  - [x] T5b (2026-10-12): Share all, Update all shared values, Reset all, Unshare all (shared lưu trước, local chỉ reset sau khi shared thành công); `client.exportEnvironment`/`client.importEnvironment` định dạng Postman, round-trip giữ trạng thái không share
- [x] T6 Resolver nối vào preparer và đường gửi thẳng; `lm.*` trong sandbox ghi local
  - [x] T6a Phía web (2026-10-12): `useVariableLayers` dựng globals, collection (kèm giá trị local) và environment đang active cho `prepareSend`; request dùng secret bị giấu dừng với `SECRET_WITHHELD` (Jev 0.92 dời phần server điền sang đợt B)
  - [x] T6b (2026-10-12): `lm.globals`/`lm.collectionVariables`/`lm.environment` đọc giá trị scope và ghi giá trị local (đích chốt lúc gửi, lưu cả khi request lỗi/huỷ); server **không** điền secret bị giấu (Jev 0,99, Vòng 38)
- [x] T7 UI environment đủ cột và menu More theo ma trận
  - [x] T7a (2026-10-12): sidebar Environments (tạo, Globals, set active, duplicate, xoá), ô chọn environment ở cuối thanh tab, trang environment (màu, đổi tên, Read only, Request to edit, Set active, Share, More) và Globals, bảng đủ cột Name, Value (local), Shared value, Description, Type, Enabled, trạng thái Edited/Synced, More từng dòng, lọc theo tên; Share của collection có "include environment" thật
  - [x] T7b (2026-10-12): pane Variables (kèm biến tạm của tab), Info (ID, người tạo, ngày, collection đang dùng, active cho bạn, badge Shared with you), menu "all", tạo nhanh ở ô chọn, Copy link/Share/Rename trong menu
- [x] T8 (2026-10-12): highlighter, tooltip (scope thắng, giá trị bị ghi đè), gợi ý `{{` (ARIA combobox), "Set as variable"/"Add to" (Editor ghi shared kèm cảnh báo trùng tên và reset local; Viewer chỉ biến tạm), biến tạm theo tab
- [x] T9 Integration A/B và test không lộ secret pass (2026-10-12): `environment-values.test.ts`, `environment-crud.test.ts`, `environment-lifecycle.test.ts`, `variable-scopes.test.ts` (26 test)
- [x] T10 E2E environment pass
  - [x] T10a (2026-10-12): `e2e/specs/environments-and-variables.spec.ts` gửi `{{baseUrl}}/users` tới mock, đổi environment active thì request đổi theo, giá trị local thắng shared
  - [x] T10b (2026-10-12): hover thấy đúng giá trị và scope
- [x] T11 Staging đã deploy sau khi user xác nhận
  - [x] T11a Đợt A lên prod với cờ `environments` tắt (2026-10-12, user chốt), DAST API và nginx đạt
  - [x] T11b Bật cờ `environments` sau đợt B và review (release `20261012-105625-1ab618562676`, DAST đạt: `reports/security-261012-1805-phase-13-slice-b-dast.md`)
- [x] T12 Review không còn finding mức high (kiểm lại `reports/code-reviewer-261012-1630-phase-13-slice-b-fix-verification.md`: 0 High; Medium mới N1 đã sửa)
  - [x] T12a Review đợt A (2026-10-12): `plans/dattqh/reports/code-reviewer-261012-0935-phase-13-slice-a.md` 3 High, 4 Medium, 8 Low; đã sửa hết, mỗi High/Medium có test tái hiện (mục "Xử lý" của report)
  - [x] T12b Review đợt B: `reports/code-reviewer-261012-1535-phase-13-slice-b-{backend,web}.md` (0 Critical; 2 High, 10 Medium đã sửa có test); kiểm lại bản sửa ở `reports/code-reviewer-261012-1630-phase-13-slice-b-fix-verification.md`
- [x] Verification: unit `variable-resolver` (bảng), biến động và `secret-cipher` pass
- [x] Verification: integration A Editor/B Viewer (share, local riêng, 403, reset) pass (2026-10-12)
- [x] Verification: E2E `{{baseUrl}}/users`, đổi environment active, hover đúng scope pass
- [x] Mọi dòng ma trận tương đương có test hoặc kịch bản E2E tương ứng (trừ dòng thuộc phase 11/14: Move environment (Jev 0,09), Fork/Merge; Vault và scope `data` đã loại từ trước)
- [x] `pnpm lint && pnpm typecheck && pnpm test` sạch (2026-10-12: web 1404, api 1259, shared 1638, operations 61, scripts 34; E2E 39/39)
- [x] `pnpm check:mcp-coverage` pass (167 operation, 132 tool)

### Đợt B (12/10/2026, Vòng 38)
Xong theo checklist trên, kèm vá ma trận phase 12 theo `reports/code-reviewer-261012-1430-collections-environments-parity-audit.md` (liên kết mock project/environment, kéo example, changelog: diff ẩn cho Editor, session cửa sổ 5 phút lưu `sessionStartSeq`, local value biến collection, import environment từ modal, statusbar Trash/Globals, Copy link cho node, link phần tử mở đúng chỗ kể cả người ngoài workspace). SAST: `reports/security-261012-1610-phase-13-slice-b-sast.md` (đạt). Cờ `environments` thêm vào `infra/localman/released-features`. Deploy lên prod (release `20261012-105625-1ab618562676`, backup `localman-20261012-175619`) và DAST đạt (`reports/security-261012-1805-phase-13-slice-b-dast.md`): 0 Critical/High/Medium, 1 Low (nhãn SHARED cho biến chưa chia sẻ trong pane Variables), 2 Info.
