# Kiểm chứng các bản sửa sau review phase 13 đợt B (backend và web)

Ngày: 2026-10-12 (Asia/Saigon) · Người kiểm: code-reviewer · Chỉ đọc: không sửa source, không commit, không deploy.

## Phạm vi và cách kiểm

- Đối tượng: working tree chưa commit trên `main` (HEAD `ab6deb1`), lúc 16:30–16:40. Bỏ qua WIP auth/silent sign-in (`apps/api/src/modules/auth/**`, `apps/api/src/http/cookies.ts`, `apps/web/src/features/auth/**`, `apps/web/src/lib/api-url.ts`) và Tunelo.
- Đối chiếu với: `code-reviewer-261012-1535-phase-13-slice-b-backend.md` (M1–M4, L1–L9), `code-reviewer-261012-1535-phase-13-slice-b-web.md` (H1, H2, M1–M6, L1–L11), và bullet cuối của Vòng 38 trong `261008-1123-localman-core/plan.md`.
- Test đã chạy lại (từng file, `--maxWorkers=1`, bộ nhớ trống 41–57% trước mỗi lần chạy):
  - web, 11 file, 34/34 pass: `use-send-tab-scopes`, `use-script-scope-saver-targets`, `use-script-scope-saver`, `share-failure`, `script-snippets`, `write-shared-variable`, `variable-assist-keyboard`, `element-link-membership`, `environment-info`, `use-variable-layers`, `variable-card`;
  - shared, 3 file, 17/17 pass: `script-scopes`, `script-scope-values`, `postman-environment`;
  - api, 7 file, 23/23 pass: `collection-changelog-stored-sessions`, `collection-changelog-sessions`, `collection-link-copies`, `collection-links`, `environment-collections`, `environment-import-limits`, `collection-search`.
- Hai probe chạy trong scratchpad (`scratchpad/cr/`), không đụng repo:
  1. `cancel.probe.tsx`: dùng `useSendTab` với một sender báo `onScopeChanges`, treo cho tới khi bị abort, rồi gọi `cancel`. Kết quả: `start calls 1, commit calls 0`, tức thay đổi script **không được lưu** (xem N1).
  2. `scope-memory.probe.ts`: chạy QuickJS thật với 1, 2 rồi 3 scope, mỗi scope 700 key × 10 000 ký tự. Cả ba lần `error: null`, nên không có rủi ro vượt 32 MiB như đã nghi.

## Bảng kết quả: review backend

| Finding | Trạng thái | Bằng chứng |
|---|---|---|
| M1 Scope >500 key thành `SCRIPT_INTERNAL` | **Đã sửa** | `script-types.ts:29-30` đặt `MAX_SCRIPT_SCOPE_VARIABLES = ENVIRONMENT_VARIABLES_MAX + LOCAL_VALUES_MAX` (700). `script-output.ts:166-176` đọc mỗi scope theo cap này. `script-prelude.ts:38` có `SCOPE_LIMITS` riêng. Test: `script-scopes.test.ts:91` ("takes a scope holding definitions and local values together", 700 key). |
| M2 Giá trị/key của script vượt giới hạn lưu local | **Đã sửa** | `store.set` ở `script-prelude.ts:68-77` ném lỗi khi tên rỗng, tên dài hơn 200, có khoảng trắng đầu/cuối, giá trị dài hơn 10 000, hoặc vượt số key. Test: `script-scopes.test.ts:80`. |
| M3 Phân trang changelog duyệt cả chuỗi revision | **Đã sửa** | Lúc ghi: `revision-log.ts` (diff dòng 57-60, 68-69) gán `sessionStartSeq`/`sessionStartAt` qua `sessionToJoin` (`revision-session.ts:26-45`), đọc trong transaction có khoá. Lúc đọc: `changelog-page.ts:118-145` (`storedSessionPage`) chỉ cần một range query cộng một `exists`. `chainBelow` chỉ còn cho revision cũ chưa có mốc. Test: `collection-changelog-stored-sessions.test.ts:94` ("pages a 300-change session whole, with a bounded number of reads"), `:116`, `:138`. Xem thêm phần hồi quy bên dưới. |
| M4 Lưu thay đổi script vào environment active lúc lưu | **Đã sửa, còn khe hẹp** | Trùng H1 của web (xem bảng web và N2). |
| L1 `__proto__` rơi im lặng | **Đã sửa** | `script-scope-values.ts:34-40` dùng `bare()` (`Object.create(null)`). Prelude dùng `copy` null-prototype và `toObject` với `Object.create(null)` (`script-prelude.ts:80`). Host đọc bằng `Object.fromEntries` (`script-output.ts:58`). Test: `script-scopes.test.ts:100`. Chỉ phía sandbox có test; `scriptScopeValues` với key `__proto__` chưa có test riêng. |
| L2 Script `set` một biến đang tắt thì `{{k}}` vẫn không resolve | **Chưa sửa** | `script-scope-values.ts:74-77` vẫn giữ `enabled` của biến gốc qua `...variable`. Docs ("Script": "`set`… có hiệu lực ngay với `{{name}}`") không nêu ngoại lệ này. |
| L3 Round-trip export/import đổi "không share" thành shared `""` | **Đã sửa** | `postman-environment.ts:107-109` (`importedSharedValue`: `""` thành `null`, với mọi kiểu). Test: `postman-environment.test.ts:121`, `:145`. Mô tả operation ghi rõ hành vi. |
| L4 Giới hạn body nhỏ hơn dữ liệu hợp lệ | **Sửa một phần** | Import đã sửa: `environment-transfer-operations.ts:29-33` cho `IMPORT_BODY_LIMIT` ≥ 10 MiB, có test `environment-import-limits.test.ts:32,44`. Còn lại: `environment-inputs.ts:5` (`VARIABLES_BODY_LIMIT = 3 MiB`, trong khi 200 × 10 000 × 3 byte ≈ 6 MB) và `:7` (`LOCAL_VALUES_BODY_LIMIT = 6 MiB`, trong khi 500 × 10 000 × 3 byte ≈ 15 MB). Giá trị CJK dài vẫn nhận 413 ở PUT variables và PATCH local-values, kể cả lô thay đổi script. |
| L5 `linksFor` chạy mọi lần tải và ngầm claim email share | **Đã sửa** | `elementRoleOf(..., { claim: false })` ở `access-policy.ts` (diff dòng 26-29, 49). `collection-links.ts:75,130` và `environment-collections-service.ts:67` đều dùng `claim: false`. Export bỏ links: `collection-read-operations.ts:83` truyền `sub = null`, và `collection-store.ts` (`NO_LINKS`). Các lượt ghi vẫn gọi `linksFor`, chấp nhận được. |
| L6 Nhánh regex cho example cũ | **Đã sửa** | `storedNodeOf` ghi `searchName` cho mọi kind (`collection-store.ts:140`). Backfill một lần lúc khởi động, idempotent: `example-search-backfill.ts:21-53`, gọi từ `background-jobs.ts:28`. Test: `collection-search.test.ts:86` ("…renamed and older ones too"). Mỗi lần khởi động có một query `{kind, searchName:$exists:false}` không có index (COLLSCAN `collection_nodes`). Chấp nhận được ở quy mô hiện tại. |
| L7 Đường rủi ro chưa có test | **Đã sửa** | `collection-link-copies.test.ts:68` (duplicate cùng workspace giữ cả hai link), `:79` (khác workspace bỏ environment, bỏ project không đọc được), `:96` (PATCH `mockProjectId`), `:115` (env cùng workspace không đọc được thì 400 giống env không tồn tại). Phần M1/M2: `script-scopes.test.ts:80,91`. |
| L8 `displayNames` nằm trong module collections | **Đã sửa** | `apps/api/src/modules/users/display-names.ts`. `collections/people.ts` đã xoá, grep `people.js` trong `apps/api/src` ra 0. |
| L9 Plan T5/T5b ghi "có revision" | **Sửa một phần** | Checklist `phase-13-environments-and-variables.md:84` đã ghi "không revision cho environment, Vòng 38". Phần yêu cầu (`:51`) và bảng task (`:68`) vẫn ghi "ghi revision giống/như changelog phase 12". |

## Bảng kết quả: review web

| Finding | Trạng thái | Bằng chứng |
|---|---|---|
| **H1** Lưu scope vào environment/workspace active lúc lưu | **Đã sửa, còn khe hẹp (Low)** | `SaveScopes` thành hai pha (`send-hooks.ts:39-41`). Pha 1 ở `use-script-scope-saver.ts:87-96` đọc `activeEnvironmentKey` và chốt `{ workspaceId, environmentId, collectionId }`; `use-send-tab.ts:94-96` gọi pha 1 trước `sender`. Test: `use-script-scope-saver-targets.test.tsx:32` (đổi env giữa hai pha vẫn PATCH `env-staging`), `use-send-tab-scopes.test.tsx:87` (thứ tự gọi). Khe còn lại xem N2. |
| **H2** Share all/Update all xoá local khi lưu shared lỗi | **Đã sửa** | `use-variable-editor.ts:51-71`: key cần reset nằm trong `resetsRef` và chỉ được reset sau khi `saveShared` thành công và local đang chờ đã flush. Gõ lại local thì bỏ reset (`:111`). Test: `share-failure.test.tsx:28` (environment), `:57` (globals). Docs "Thao tác hàng loạt" đã sửa câu "nguyên tử". |
| M1 Snippet ghi scope hiện khi cờ tắt | **Đã sửa** | `script-snippets.ts:7-45` (`scopes: true` và `availableSnippets`). `scripts-tab.tsx` lọc theo `useEnvironmentsEnabled()`. Test: `script-snippets.test.ts:5` (mức hàm; chưa có test render tab khi cờ tắt). |
| M2 Câu chữ "withheld" sai quyết định | **Đã sửa** | `i18n/messages/en/variables.ts:13` ("Hidden from you: set your own local value to use it"), có bản `vi` và `zh-CN`. Comment ở `variable-resolver.ts:123` đã đúng. Test: `variable-card.test.tsx`. Còn sót: tên test `variable-kinds.test.ts:47` vẫn là "the server fills it in" (N6). |
| M3 "Set as variable"/"Add to" ghi đè shared không báo | **Đã sửa** | Cảnh báo ở `existing-variable-note.tsx:16-38` (thay shared cho mọi người, biến tắt vẫn tắt, local của bạn sẽ reset). `write-shared-variable.ts:134-149` chỉ reset local sau khi lưu shared xong; reset lỗi thì trả `kept` kèm toast. Test: `write-shared-variable.test.ts:38,71,89,120`, `variable-assist-keyboard.test.tsx:72`. |
| M4 Request chỉ có script phụ thuộc dashboard API | **Đã sửa** | `use-variable-layers.ts:52-74`: request không có script và không có `{{}}` thì bỏ qua. Có script mà đọc layer lỗi, request vẫn đi khi không dùng `{{}}`. Test: `use-variable-layers.test.tsx:52`, `:58`. |
| M5 Info thiếu "nơi đang dùng" | **Đã sửa** | Operation `client.listEnvironmentCollections` (`environment-collections-operations.ts`, `environment-collections-service.ts:29-76`), UI ở `environment-usage.tsx`. Test: `environment-info.test.tsx:92,112`, `environment-collections.test.ts:40`. |
| M6 Bàn phím và ARIA của assist | **Đã sửa** | `suggest-aria.ts` (combobox, `aria-expanded`/`controls`/`activedescendant`). `use-input-assist.ts:140-141` chuyển `modified` khi có Shift/Alt/Ctrl/Meta, nên Shift+Tab không chọn mục. CodeMirror có keymap `Shift-F10`/`ContextMenu` (`variable-editor-assist.ts:172-181`). Test: `variable-assist-keyboard.test.tsx:26,45`. |
| L1 Provider assist không có `key` | **Đã sửa** | `workbench-layout.tsx:144` (`key={activeTab.id}`). |
| L2 Ô local của collection | **Đã sửa** | `use-collection-local.ts` dùng mutation `scope` theo collection, nên các lượt ghi chạy tuần tự. `local-value-cell.tsx` giữ `draft` thay vì remount bằng `key`. Có `move` khi đổi tên. Test: `collection-local-values.test.tsx`. |
| L3 Ghi script không có đích mà vẫn báo đã lưu | **Đã sửa** | `saveScriptScopes` trả `dropped` (`use-script-scope-saver.ts:47-52`), toast ở `use-send-tab.ts:135-144`. Test: `use-send-tab-scopes.test.tsx:114`, `use-script-scope-saver.test.ts:75`. |
| L4 Import environment trong modal không xét vai trò | **Đã sửa** | `use-import-environment-selection.ts` (`workspaceRoleAllows(current.role, "addElements")`, `availability: "viewer"`). |
| L5 Trang link phần tử (spinner khi lỗi session, workspace của người ngoài) | **Đã sửa** | `element-link-page.tsx:69-76` hiện `LoadFailed` kèm retry. `use-open-element-link.ts:42-52` chỉ đổi workspace khi người dùng là thành viên (Jev 0,53). Test: `element-link-membership.test.tsx:25,41`. Docs chưa cập nhật (N3). |
| L6 Gợi ý O(N²) | **Đã sửa** | `variable-kinds.ts:22-49` (`resolutionsOf` cache theo `WeakMap` mỗi mảng layers). |
| L7 Lệch ma trận và data-id | **Đã sửa, trừ Move** | Đã có `tabbar-env-create`, `sidebar-envs-set-active`, `env-menu-copy-link/share/rename`, `env-select-manage`. Example có `copyLink` (`tree-row-menu.tsx:51`). `env-menu-move` không có, đúng quyết định "Move environment không thuộc đợt này" (Vòng 38). |
| L8 Extension CodeMirror dựng lại khi layers đổi | **Đã sửa** | `use-variable-extension.ts`: dựng một lần theo `actions`, classifier đổi qua `source.set` (effect). `code-editor.tsx` dùng `Compartment` `extra`. |
| L9 Ba file chạm đúng 200 dòng | **Chưa sửa, nặng hơn** | `workbench-types.ts` nay **201 dòng**, vượt quy tắc "≤ 200 dòng" của `CLAUDE.md`. `workbench-reducer.ts`, `api-client-screen.tsx`, `environments-api.ts`, `import-modal.tsx` đều đúng 200 dòng (N4). |
| L10 Dấu "—" cứng; `upsertSharedVariable` không trim | **Đã sửa** | Không còn "—" trong `environment-info-panel.tsx`. `variable-writes.ts:18,27,30` trim key. |
| L11 Lý do disable chỉ nằm trong `title` | **Đã sửa** | `import-environment-button.tsx:30` và `environment-selector.tsx:101` dùng `aria-describedby` trỏ tới nhãn hiển thị (`env-select-readonly`, ghi chú read-only ở sidebar). Restore ở changelog dùng `restoreNoteId`. "Add to" kiểm tên bằng `nameError` (`variable-add-form.tsx:49`). |

Tổng: backend 10 đã sửa (M4 còn khe hẹp), 2 sửa một phần (L4, L9), 1 chưa sửa (L2). Web 18 đã sửa (H1 còn khe hẹp, L7 trừ Move theo quyết định), 1 chưa sửa (L9). **Không còn High nào ở trạng thái mở.**

## Finding MỚI (theo mức độ)

### Medium

**N1. Bấm Cancel thì thay đổi scope của pre-request script bị bỏ, trái với Vòng 38, comment trong code, docs và checklist T6b (đã tái hiện bằng probe)**

- `apps/web/src/features/api-client/workbench/use-send-tab.ts:124`: `if (controllers.current.get(tabId) !== controller) return;` chạy **trước** khối lưu ở `:133-151`. `cancel()` (`:163-173`) gọi `abort`, mà `abort` xoá controller khỏi map (`:69-72`). Vì vậy mọi lượt gửi bị huỷ đều return sớm, `saveChanges` không bao giờ được gọi.
- Probe `scratchpad/cr/cancel.probe.tsx`: pre-script báo `{ environment: [token=abc] }`, request treo, người dùng bấm Cancel. Kết quả `start calls 1, commit calls 0`.
- Những chỗ nói ngược lại:
  - `send-steps.ts:104` ("Saved even when the request then fails or is cancelled, as in Postman");
  - `use-send-tab.ts:132` ("Done, failed or cancelled: what the scripts set is kept.");
  - `docs/system-architecture.md` mục "Environments và biến", bullet "Script" ("kể cả khi request lỗi hoặc bị huỷ");
  - checklist `phase-13-environments-and-variables.md` T6b ("lưu cả khi request lỗi/huỷ");
  - quyết định Vòng 38 ("thay đổi của pre-request script vẫn lưu khi request lỗi hoặc bị huỷ như Postman", Jev 0,61).
- Test hiện có chỉ phủ trường hợp lỗi mạng (`use-send-tab-scopes.test.tsx:98`), không có ca huỷ.
- Hệ quả: một script login đặt `token` ở pre-request, request chậm, người dùng bấm Cancel. Token bị mất và người dùng không được báo.
- Sửa: tách bước lưu khỏi guard. Ví dụ, ngay sau `try/catch` gọi `if (changes && saveChanges) void persist(changes, saveChanges)` (hàm lưu kèm toast) trước dòng `:124`, rồi giữ guard cho phần dispatch response và history. Cần quyết định có lưu cả khi `abort` do đóng tab hay không (Postman có lưu). Thêm test "keeps what the scripts set when the send is cancelled".

### Low

**N2. Đích lưu vẫn được chốt sau `await variablesFor`, nên còn một khe bằng một round-trip**

- `use-send-tab.ts:93-96`: `saveScopes` (pha 1) được gọi sau `await variablesFor(...)`, và `hooksOf.current` được đọc sau cả `await resolve(tab)`.
- `useVariableLayers` đọc active env (`use-variable-layers.ts:79-84`), rồi mới fetch environment và local values (`:86-97`). Khi cache đã cũ hơn 15 s (`FRESH_MS`), bước này đi mạng.
- Nếu người dùng đổi environment hoặc workspace trong khe đó, layers được dựng từ A nhưng đích lưu là B. Khe này hẹp hơn nhiều so với H1 cũ (trước đây bằng cả thời gian request, tới 30 s) nhưng vẫn cùng loại lỗi.
- Sửa: để `VariablesOf` trả kèm `{ workspaceId, environmentId }` lấy từ chính `active` mà nó đã đọc, rồi truyền cho pha 1. Hoặc chụp `hooksOf.current` một lần ở đầu `send`.

**N3. `docs/system-architecture.md` lệch code ở ba chỗ**

- Mục "Workspace…", bullet "Link phần tử": docs ghi "Đọc được phần tử thì web chọn workspace của nó". Code (`use-open-element-link.ts:42-48`) chỉ đổi workspace khi người dùng là thành viên. Người được share riêng thì giữ workspace hiện tại (quyết định Jev 0,53).
- Mục "Environments và biến", bullet "Script":
  - câu "kể cả khi … bị huỷ" sai (N1);
  - câu "script khi đó thấy các scope rỗng" không chính xác: với tab đã bind, `givenScopesOf` (`script-scopes.ts:15-24`) vẫn nạp biến collection từ `context` (shared value, không có local).
- Bullet "Trong editor" chưa nêu hành vi khi trùng tên mà Vòng 38 đã chốt: cảnh báo thay shared cho mọi người, reset local của người bấm, biến tắt vẫn tắt.
- Các mục còn lại đều khớp code: "Collections của API client" (Changelog, Liên kết, Biến collection), và trong "Environments và biến" các bullet Thao tác hàng loạt, Nơi đang dùng (tối đa 100, `ENVIRONMENT_COLLECTIONS_MAX`), Import/export, giới hạn sandbox 700/200/10 000.

**N4. Vượt giới hạn 200 dòng**

- `apps/web/src/features/api-client/workbench/workbench-types.ts` có 201 dòng (`awk END{print NR}`), vi phạm quy tắc `CLAUDE.md`. Lint không bắt lỗi này.
- Bốn file khác đúng 200 dòng: `workbench-reducer.ts`, `api-client-screen.tsx`, `environments-api.ts`, `import-modal.tsx`.
- Nên tách `SendInput`, `RequestSender` và `SendOptions` sang file riêng (ví dụ cạnh `send-hooks.ts`).

**N5. Plan lệch code**

- Checklist T6b ghi "lưu cả khi request lỗi/huỷ", nhưng phần huỷ chưa đúng (N1).
- `phase-13-environments-and-variables.md:51,68` vẫn ghi "ghi revision" (phần còn lại của L9).
- Lead sửa plan; reviewer không sửa.

**N6. Tên test cũ, và highlighter coi secret bị giấu là "resolved"**

- Tên test `variable-kinds.test.ts:47` vẫn là "keeps a withheld secret resolved: the server fills it in", đúng câu chữ mà M2 đã bỏ.
- Hành vi: `{{token}}` (secret bị giấu) vẫn được tô màu "resolved", nhưng bấm Send thì dừng với `SECRET_WITHHELD`. Thẻ hover nay đã nói rõ, nên chỉ là chuyện nhất quán.
- Nên đổi tên test, hoặc thêm một kind riêng (ví dụ `withheld`) để tô khác màu.

## Kiểm hồi quy ở các vùng được yêu cầu

- **Send pipeline (`send-steps`, `use-send-tab`, `send-hooks`, `script-scopes`, `use-script-scope-saver`):**
  - `reportScopes` chạy sau pre-script (`send-steps.ts:105`) và sau post-script (`:184`). `changes` giữ bản mới nhất, vì `scriptScopeChanges` luôn so với `givenScopes`.
  - Pre-script lỗi thì không báo thay đổi, nhất quán với `runScript` trả scope nguyên vẹn khi lỗi (`run-script.ts`, `unchanged`).
  - Lỗi duy nhất tìm được là N1 (huỷ). Khe N2 nhỏ.
- **Changelog `sessionStartSeq`:**
  - Session luôn là một dải `seq` liên tục: `sessionToJoin` chỉ nối khi revision mới nhất ngay trước đó cùng tác giả và cùng session, dưới khoá workspace.
  - `joinsSession` (`changelog-view.ts:131-142`) tách đúng giữa revision cũ (không có mốc) và mới (có mốc).
  - Revision mở session bị trim thì các revision còn lại vẫn cùng mốc, nên vẫn gom đúng.
  - Một session lưu sẵn không có cap số dòng. Thao tác hàng loạt (khoảng 2000 revision trong 5 phút) vẫn cho một trang lớn, nhưng chỉ tốn 3 query. Docs ghi "trang có thể dài hơn 100", nên chấp nhận.
- **`listEnvironmentCollections`:**
  - Chỉ trả collection cùng workspace, đúng vì link chỉ cho phép environment cùng workspace (`requireLinkableEnvironment`, `rememberSharedEnvironment`).
  - Điều kiện `linkedEnvironmentId: { $exists: false }` khớp với `environmentFor`: `null` nghĩa là Editor đã chọn "không có".
  - Người ngoài workspace thì mỗi ứng viên tốn một `elementRoleOf(claim:false)`. Số ứng viên chỉ gồm collection có quan hệ với environment, và bị chặn bởi 1000 collection mỗi workspace. Chấp nhận được.
- **Link phần tử và membership:** danh sách workspace lỗi thì coi như không phải thành viên, nên vẫn điều hướng mà không đổi workspace. Session lỗi thì hiện retry. Không có hồi quy.
- **Thứ tự share trong variable editor:**
  - Trong `use-variable-editor.ts:56-71`, shared lưu trước, rồi local đang chờ được flush, rồi mới reset.
  - Shared lưu lỗi thì key vẫn nằm trong `resetsRef` cho lần thử sau. Người dùng gõ local mới thì key bị bỏ khỏi reset.
  - Flush local lỗi sau khi shared đã lưu thì autosave shared báo lỗi rồi PUT lại. Lệnh PUT này idempotent, nên không mất dữ liệu.
- **"Set as variable" khi tên đã có:** writer đọc bản mới (`staleTime: 0`) trước khi PUT cả danh sách. Local chỉ reset khi bản mới có key đó. Đây vẫn là kiểu "đọc rồi thay cả danh sách" như trước, có thể đè một chỉnh sửa song song ở bảng (đã có từ trước, không phải hồi quy).
- **Cap của sandbox:** host và VM dùng cùng hằng số. Không có đường nào đưa vào giá trị dài hơn 10 000 ký tự: biến collection (`collection-schemas.ts:36`), giá trị local và shared, import (`fit-tree.ts`) đều cap 10 000. Probe 3 × 700 × 10 000 ký tự không chạm giới hạn 32 MiB của VM.

## Việc nên làm (theo thứ tự)

1. N1: lưu thay đổi scope trước guard huỷ trong `use-send-tab.ts` và thêm test cho ca huỷ. Nếu Jev muốn giữ hành vi bỏ khi huỷ, thì phải sửa comment, docs và checklist T6b.
2. N3 và N5: sửa docs (Link phần tử, Script, Trong editor) và plan (T6b, dòng 51 và 68).
3. N4: tách `workbench-types.ts` cho về ≤ 200 dòng.
4. N2: lấy `environmentId` và `workspaceId` của đích lưu từ chính `VariablesOf`.
5. L2 (biến tắt bị script ghi), L4 phần còn lại (`VARIABLES_BODY_LIMIT`, `LOCAL_VALUES_BODY_LIMIT`), N6: khi tiện.

## Câu hỏi còn mở

1. Khi đóng tab trong lúc request đang bay (`abort`, không phải `cancel`), có lưu thay đổi của pre-request script không? Postman có lưu. Vòng 38 chỉ nói "lỗi hoặc huỷ".

Status: DONE_WITH_CONCERNS
Summary: Không còn finding High nào mở: H1 và H2 đã sửa và có test; 28/32 finding cũ đã sửa, L4 và L9 của backend sửa một phần, L2 backend và L9 web chưa sửa. Có 1 finding Medium mới: bấm Cancel thì thay đổi scope của pre-request script bị bỏ (`use-send-tab.ts:124`, đã tái hiện bằng probe), trái với Vòng 38, docs và checklist T6b.
Concerns/Blockers: N1 nên sửa trước khi bật cờ `environments`, hoặc Jev chốt lại hành vi khi huỷ. `workbench-types.ts` 201 dòng vi phạm quy tắc repo.

## Xử lý (2026-10-12, 16:55)

- N1: `use-send-tab.ts` lưu thay đổi scope cả khi lượt gửi bị huỷ (lưu trước khi return), test "keeps what the pre-request scripts set when the send is cancelled".
- N2: đích lưu chốt ngay lúc bấm gửi, trước mọi `await`.
- N3, N5, L9: docs (Link phần tử: chỉ chọn workspace khi là thành viên; Script: scope khi không đọc được biến, biến đang tắt; Trong editor: trùng tên, secret bị giấu) và plan (dòng 51, 68) sửa theo code.
- N4/L9 web: `SendOptions`, `SendInput`, `RequestSender` tách sang `workbench/send-types.ts`; `workbench-types.ts` còn 169 dòng.
- N6: kiểu `withheld` mới, highlighter tô màu cảnh báo (dotted) cho secret bị giấu; test đổi tên.
- L4: `VARIABLES_BODY_LIMIT` 10 MiB, `LOCAL_VALUES_BODY_LIMIT` 15 MiB (dưới trần 16m của nginx).
- L2: giữ hành vi (biến tắt vẫn tắt dù script đặt giá trị local), ghi vào docs.
