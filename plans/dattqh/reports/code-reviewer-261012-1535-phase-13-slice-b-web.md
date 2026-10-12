# Review phần web: phase 13 đợt B (Environments) và các sửa tương đương của phase 12

Ngày: 2026-10-12 (Asia/Saigon). Review chỉ đọc. Không sửa source, không commit, không deploy.

## Phạm vi

- Nguồn review: `git diff HEAD -- apps/web e2e` cộng các file chưa track dưới `apps/web/src`, tổng 173 file. Phần auth/silent-sign-in WIP và Tunelo bị bỏ qua theo yêu cầu.
- Đối chiếu với: ma trận phase 13, ma trận phase 12, Vòng 38 trong `plan.md`, báo cáo kiểm toán `code-reviewer-261012-1430-…`, các `data-id` của prototype `api-client.html`, và ba mục trong `docs/system-architecture.md`: "Environments và biến", "Collections của API client", "Link phần tử".
- Những gì đã có sẵn và không chạy lại: lint 0, typecheck 0, i18n/tokens 0, web 1358 test, E2E 39/39.
- Kiểm tra tự chạy thêm: một probe hook (`renderHook` dùng fake timers, nằm trong scratchpad, không đụng repo) trên `useVariableEditor`. Probe này tái hiện được finding H2 (xem dưới).
- Đã quét `any`, `!` và lint suppression: không có `any` hay `!`. Có 10 `biome-ignore`, tất cả kèm lý do. Mọi file đều ≤ 200 dòng.
- Đã quét chuỗi hard-code trong các file TSX mới: không thấy chuỗi nào ngoài dấu "—" (xem L10).

## Tóm tắt

| Mức | Số lượng |
|---|---|
| Critical | 0 |
| High | 2 |
| Medium | 6 |
| Low | 11 |

Khi cờ `environments` tắt, phần lớn tính năng mới đều trơ: provider assist trả `null`, `variablesOf` và `saveScopes` là `undefined`, `rightRail`, Globals ở status bar và selector đều được gate. Riêng **snippet script vẫn hiện trên prod** và ghi vào hư không (M1).

Hai finding High đều làm hỏng dữ liệu cá nhân mà người dùng không được báo. Cả hai sửa được trong phạm vi nhỏ.

---

## High

### H1. Thay đổi scope do script đặt bị lưu vào environment/workspace đang active *lúc lưu*, không phải lúc gửi

- Vị trí: `apps/web/src/features/environments/use-script-scope-saver.ts:75-87` và `apps/web/src/features/api-client/workbench/use-send-tab.ts:165-167`.
- Cơ chế:
  1. `saveScopes` được gọi sau `await sender(...)` và lấy qua `hooksOf.current`, tức closure của lần render mới nhất.
  2. Bên trong nó, `client.getQueryData(activeEnvironmentKey(workspaceId))` đọc environment active ngay lúc lưu.
  3. Selector cập nhật cache theo kiểu optimistic (`use-environments.ts:121-128`), nên đổi environment là có hiệu lực tức thì.
  4. Trong khi đó, `scriptScopeChanges(givenScopes, post.scopes)` được tính trên giá trị của environment A, là environment dùng cho lượt gửi.
- Kịch bản:
  1. Environment "Staging" đang active. Request login có post-script `lm.environment.set("token", …)` (đây là snippet `saveToken`).
  2. Trong lúc request đang bay (proxy cho tối đa 30 giây), người dùng chuyển sang "Production".
  3. Token của Staging bị ghi thành giá trị local `token` của Production.
  4. Nếu script có `unset`/`clear`, các key cùng tên ở Production bị reset về shared.
  5. Đổi workspace giữa chừng cũng sai theo cùng cách: globals ghi sang workspace mới.
  6. Kết quả: request tiếp theo tới Production dùng token Staging. Nếu biến bị đổi là `baseUrl`, request tới Production sẽ đi sang Staging hoặc ngược lại. Không có cảnh báo nào.
- Cách sửa: chốt đích ghi ngay lúc gửi.
  - `VariablesOf` trả kèm `{ workspaceId, environmentId }` lấy từ chính `active` nó vừa đọc (`use-variable-layers.ts:67-73`). Hoặc `SendInput`/`SendResult` mang theo `scopeTargets`.
  - `SaveScopes` nhận các target đó thay vì tự đọc cache.
  - Thêm test cho `use-send-tab-scopes`: đổi active giữa `sender` và lúc lưu thì vẫn ghi vào environment cũ.

### H2. "Share value", "Share all", "Update all shared values": giá trị local bị xoá kể cả khi lưu shared thất bại

- Vị trí: `apps/web/src/features/environments/use-variable-editor.ts:158-165`.
  - `shareRows` gọi `commit(sharedDrafts…)`, tức autosave shared, rồi `resetRows(rows)`, tức autosave local (PATCH `value: null`).
  - Hai hàng đợi `usePageAutosave` chạy độc lập, cùng delay 800 ms, và không hàng nào chờ hàng nào.
- Bằng chứng (probe):

  ```
  saveShared ném lỗi →
  shared writes [[{"id":"v1","key":"token",…,"sharedValue":"my-local-token"}]]
  local writes  [[{"key":"token","value":null}]]
  status "error"
  ```

- Kịch bản:
  1. Editor bấm "Share all" trên 5 giá trị local, trong đó có token họ vừa dán.
  2. Lệnh PUT shared lỗi (mạng, 403 vì vừa bị hạ quyền, 400 vì vượt `VARIABLE_VALUE_MAX`, hoặc 503 `SECRET_STORAGE_UNAVAILABLE` với biến secret).
  3. Lệnh PATCH local vẫn thành công, nên giá trị local trên server đã mất. Bản shared mới chỉ còn trong hàng đợi trong bộ nhớ.
  4. Nếu người dùng đóng tab hoặc reload, hoặc lần thử lại vẫn lỗi, thì giá trị biến mất vĩnh viễn.
  5. Lỗi này đã có với Share đơn ở đợt A. Đợt B nhân nó lên thành "all".
- Hệ quả với tài liệu: `docs/system-architecture.md` (mục "Thao tác hàng loạt") ghi là "một lần ghi nguyên tử (PUT shared hoặc PATCH local)". Với Share all và Update all thì câu này sai: đó là hai lần ghi không có thứ tự.
- Cách sửa: chỉ reset local sau khi shared đã lưu thành công. Ví dụ đưa danh sách key cần reset vào `SharedPatch` rồi gọi `saveLocal` sau `saveShared`, giống cách đang làm với `moves` khi đổi tên ở `:61-75`. Kèm test: save shared lỗi thì không có lệnh ghi local nào.

---

## Medium

### M1. Prod (cờ tắt): các snippet ghi scope vẫn hiện nhưng không làm gì, và có thêm hai snippet chết mới

- Vị trí: `apps/web/src/features/api-client/scripts/scripts-tab.tsx:106` và `script-snippets.ts:8-22`.
  - Snippet hiện mà không xét cờ: `setEnvironment`, `unsetEnvironment`, mới thêm `setCollectionVariable` và `setGlobal`, cùng `saveToken`.
  - Khi cờ tắt, `saveScopes` là `undefined` (`use-script-scope-saver.ts:76`), nên thay đổi sau lượt gửi bị bỏ mà không báo.
  - `input.variables` cũng là `undefined`, nên `withScriptScopes` không chạy (`send-steps.ts:108-110`). Trong pre-request, `lm.collectionVariables.set("x")` rồi dùng `{{x}}` vẫn không được điền.
- Đây chính là lối vào chết số 2 trong báo cáo kiểm toán. Nó vẫn mở, và nay mở rộng thêm.
- Cách sửa: lọc snippet theo `useEnvironmentsEnabled()`, khi tắt chỉ giữ `lm.variables.*`, test và log. Có thể thêm test cho cờ tắt.

### M2. Câu chữ "withheld" ngược với quyết định Vòng 38

- Vị trí: `i18n/messages/{en,vi,zh-CN}/variables.ts:13-14`. Thẻ hover và pane hiển thị "Withheld: only the server can fill it in" / "chỉ server điền được giá trị này".
- Theo Vòng 38, server **không** điền secret bị giữ lại. Lượt gửi dừng với `SECRET_WITHHELD`.
- Người dùng (Viewer) thấy biến hiện "resolved" chứ không đỏ, đọc thấy "server sẽ điền", bấm Send thì bị chặn. Đây là ngõ cụt UX.
- Comment ở `packages/shared/.../variable-resolver.ts:123` ("the server fills it in") cũng đã cũ.
- Cách sửa: đổi câu chữ, ví dụ "Hidden from you: set your own local value to use it". Có thể đưa nút mở environment vào thẻ hover.

### M3. "Set as variable" và "Add to" ghi đè shared value của mọi người mà không báo, trong khi giá trị local của chính người bấm vẫn che nó

- Vị trí: `apps/web/src/features/variables/variable-writes.ts:47-51`. Key đã tồn tại thì `sharedValue = value` và `enabled = true`.
- Kịch bản:
  1. Editor bôi đen một token trong response, đặt tên `token`. Scope mặc định là environment (`defaultScope`).
  2. Shared `token` của cả team bị thay. Nếu biến đó đang tắt thì nó còn bị bật lại.
  3. Nếu Editor có giá trị local cho `token`, giá trị local vẫn thắng. Thẻ hover vẫn hiện giá trị cũ, nên họ tưởng thao tác chưa có tác dụng.
- Modal không cho biết tên đã tồn tại. Prototype (`api-client.html:4776-4780`) mặc định ghi **local**, ghi shared chỉ khi tick "Share".
  - Vòng 38 đã chốt ghi shared, nên đây không phải lệch quyết định. Nhưng thiếu tầng chống ghi nhầm.
- Cách sửa:
  - Khi tên đã có ở scope chọn, hiện cảnh báo "Replaces the shared value for everyone", hoặc bắt xác nhận.
  - Khi người dùng có local cho key đó, báo rằng local vẫn thắng, hoặc reset luôn local của họ.
  - Thêm test cho nhánh "key đã tồn tại".

### M4. Khi cờ bật, mọi request có script giờ phụ thuộc dashboard API, kể cả script chỉ có test

- Vị trí: `apps/web/src/features/environments/use-variable-layers.ts:60-66`.
  - Trước đây, request không có `{{…}}` thì không đợi API. Giờ cứ có script (kể cả `lm.test(...)`) là đọc globals, active env, environment và local của collection.
  - `read()` chỉ dùng cache làm phương án dự phòng khi đã có cache. Lần đầu mà API lỗi thì lượt gửi dừng với `VARIABLES_UNAVAILABLE`.
- Kịch bản: dashboard API chập chờn, người dùng gửi request tới `localhost` chỉ có test script, và request không ra khỏi trình duyệt.
- Cách sửa (chọn một):
  - Khi request không dùng `{{…}}` và đọc layer lỗi, vẫn gửi với scope rỗng (`givenScopesOf` theo `context`) và bỏ qua bước lưu.
  - Chỉ nạp layer khi script có chứa `lm.(environment|globals|collectionVariables|variables)`.

### M5. Rail Info của environment chưa có "nơi đang dùng" (một dòng ma trận)

- Vị trí: `apps/web/src/features/environments/environment-info-panel.tsx:47-69`.
- Ma trận ghi "Info (ID, người tạo, nơi đang dùng)". Code hiện có ID, người tạo, ngày tạo, cập nhật, và "Active for you".
- Không có danh sách collection liên kết với environment, dù server đã có `linkedEnvironmentId` và `sharedEnvironmentId`.
- Cách sửa:
  - Thêm operation hoặc trường "collections liên quan" kèm UI.
  - Hoặc ghi rõ trong phase 13 rằng "nơi đang dùng" được hiểu là "active cho bạn" và để Jev xác nhận. Hiện checklist dễ bị đánh dấu xong mà không đúng.

### M6. Đường bàn phím của assist chưa có test, và combobox chưa được nối ARIA

- `Shift+F10` trên `{{name}}` sẽ `focusCard`, rồi `Escape` trả focus về input hoặc `contentDOM` (`use-input-assist.ts:157-172`, `variable-editor-assist.ts:56-75`, `assist-popups.tsx:54-82`). Không test nào phủ đường này. `variable-highlighter.test.ts` và `variable-assist.test.tsx` chỉ có hover, gợi ý và chọn text.
- Gợi ý `{{`: input và `contentDOM` thiếu `role="combobox"`, `aria-expanded`, `aria-controls` và `aria-activedescendant`. Danh sách chỉ đọc qua `aria-live` (`variable-suggest.tsx:78-87`). Screen reader không biết đang có listbox mở.
- `suggestKey` không xét phím bổ trợ: `Shift+Tab` khi đang có gợi ý sẽ chọn mục thay vì lùi focus (`use-assist-popups.ts:117`).
- Cách sửa: thêm test cho `Shift+F10`, `Escape` (focus quay lại đúng phần tử) và Tab với Shift+Tab. Gắn các thuộc tính ARIA nói trên cho input và cho CodeMirror (qua `EditorView.contentAttributes`).

---

## Low

- **L1. Provider assist không có `key` theo tab.**
  - Vị trí: `workbench-layout.tsx:144` (`<VariableAssistProvider tab={activeTab}>`).
  - Khi đổi tab, state của popup (thẻ mở bằng bàn phím có `returnTo` là phần tử của tab cũ, modal "Set as variable") vẫn giữ nguyên.
  - Hệ quả: `Escape` focus vào phần tử đã bị gỡ khỏi DOM, focus rơi về `body`. Biến tạm gửi từ modal mở ở tab cũ lại vào tab mới, vì `useApplyVariable(tab.id)` đổi theo.
  - Sửa: `key={activeTab.id}`.
- **L2. Ô giá trị local của collection.**
  - Vị trí: `local-value-cell.tsx:31` và `use-collection-local.ts:34-46`.
  - Hai ô blur liên tiếp tạo hai mutation song song. Response về sai thứ tự thì cache bị danh sách cũ ghi đè, và `key={value}` làm ô hiện lại giá trị cũ.
  - Một lần refetch trong lúc đang gõ sẽ remount input, mất chữ đang gõ.
  - Đổi tên biến thì local value cũ thành mồ côi. Bảng environment có chuyển local khi đổi tên, bảng collection thì không.
  - Sửa: dùng `mutationKey` có thứ tự hoặc cập nhật cache theo key, và không remount khi input đang focus.
- **L3. Ghi script không có đích mà vẫn báo là đã lưu.**
  - Vị trí: `use-script-scope-saver.ts:50,58`.
  - `lm.environment.set` khi không có environment active, hoặc `lm.collectionVariables.set` trên tab chưa bind, bị bỏ đi nhưng hàm vẫn trả `true`.
  - Nên toast nhẹ, kiểu "Không có environment active, giá trị không được lưu".
- **L4. Import environment từ modal Import không xét vai trò.**
  - Vị trí: `api-client-screen.tsx:188`. `canImportEnvironment={importEnvironment !== null}` không tính vai trò, nên Viewer bấm được rồi nhận toast 403.
  - Nút ở sidebar thì đã disable cho Viewer (`import-environment-button.tsx:32`).
- **L5. Trang link phần tử.**
  - Vị trí: `element-link-page.tsx:55-58,74`.
  - Nếu `useCurrentUser()` ở trạng thái `error` trong khi phần tử đã tải xong, trang quay spinner mãi.
  - Phần tử được share trực tiếp, thuộc workspace người dùng không phải thành viên: `selectWorkspace` lưu id, nhưng `resolveCurrent` lùi về workspace cá nhân. Collection vẫn mở ra, còn sidebar thì ở workspace khác. Xem câu hỏi 2.
- **L6. Hiệu năng gợi ý.**
  - Vị trí: `variable-kinds.ts:22-43,60-86`.
  - `suggestionsFor` và `variableClassifier` gọi `resolveVariable` (O(N)) cho từng key, tức O(N²). Tối đa khoảng 600 biến, khoảng 360 nghìn phép so sánh mỗi lần gõ khi đang gợi ý.
  - Sửa: dựng `Map<key, resolution>` một lần cho mỗi bộ layers. Ngoài ra `use-response-selection.ts` gọi `selection.toString()` ở mỗi `selectionchange` trên body lớn.
- **L7. Lệch ma trận và prototype.**
  - Environment chưa có Move (dòng ma trận "Share…, Copy link, Move", phase 11). Copy link chỉ có trong dialog Share.
  - Thiếu các `data-id` của prototype: `tabbar-env-create`, `sidebar-envs-set-active`, `env-menu-copy-link/share/rename/move`, `env-select-manage`.
  - Example không có Copy link (`tree-row-menu.tsx:51`), dù `openCollectionNode` mở được example.
- **L8. Extension CodeMirror bị dựng lại ở mỗi lần layers đổi.**
  - Vị trí: `use-variable-extension.ts:14-17` và `code-editor.tsx:142-146`.
  - Mỗi lần reconfigure sẽ hủy `ViewPlugin`, `destroy()` gọi `closeSuggest`. Danh sách gợi ý đang mở bị đóng khi một query refetch, ví dụ lúc cửa sổ lấy lại focus.
  - Sửa: giữ `classify` trong `Facet` hoặc `StateField`, chỉ dispatch effect.
- **L9. Ba file chạm đúng 200 dòng nhờ ép comment.**
  - `workbench-types.ts`, `workbench-reducer.ts` và `use-send-tab.ts` đều có 200 dòng.
  - `workbench-types.ts:163-164,172` gộp comment JSDoc vào một dòng hoặc comment cuối dòng. Lần sửa tới sẽ vượt giới hạn. Nên tách trước, ví dụ chuyển `SendHooks` và `SaveScopes` sang file riêng.
- **L10.** Dấu "—" viết cứng ở `environment-info-panel.tsx:67`, nên dùng một khoá i18n `environments.info.unknown`. Câu `upsertCollectionVariable` thì trim key còn `upsertSharedVariable` thì không (`variable-writes.ts:47` so với `:69`), chưa gây lỗi nhưng không nhất quán.
- **L11. Lý do disable không tới được người dùng bàn phím và cảm ứng.**
  - Nút disable kèm `title` không tới được bàn phím hay thiết bị cảm ứng: `import-environment-button.tsx:27-32`, `env-select-create` (`environment-selector.tsx:96-99`), Restore của Viewer (`changelog-change-item.tsx:143-147`).
  - "Add to" không kiểm tên. `{{ my var }}` sinh key `my var`, trong khi modal "Set as variable" từ chối tên có khoảng trắng (`variable-add-form.tsx:44-61` so với `use-apply-variable.ts:28-38`).

---

## Đã kiểm, không có vấn đề

Các mục dưới đây đã đối chiếu trên code thật:

- **Secret trên UI:**
  - Thẻ hover và danh sách gợi ý luôn che secret, và hiện nhãn "withheld" thay cho giá trị (`scope-badge.tsx:31-46`).
  - Pane xem nhanh chỉ cho nút hiện giá trị khi người dùng thực sự có giá trị đó (`variables-pane-section.tsx:52`).
  - Script không bao giờ nhận secret bị giấu (`scriptScopeValues` bỏ qua `withheld`). `clear()` không reset secret bị giấu.
  - History chỉ ghi draft đã redact. `scopeChanges` không đi ra ngoài tab.
  - Navigation state của link phần tử chỉ chứa `type/id/nodeId`. State được đọc một lần (`handledKey`), rồi xoá bằng `replace`.
- **Viewer không ghi shared:**
  - Lựa chọn scope bị chặn theo `role === "editor"` (`variable-targets.ts:100-125`). Mặc định là biến tạm. Server trả 403 nếu bị gọi lách.
  - Các thao tác "all" disable cho Viewer kèm lý do. Riêng Reset all vẫn được dùng.
- **Cờ tắt:**
  - `useEnvironmentsWorkbench` return sớm. `VariableAssistProvider` truyền context `null`.
  - `VariableInput` không đổi class hay handler khi cờ tắt.
  - Globals ở status bar được gate. Modal Import chặn file environment và giải thích lý do (sửa xong lối vào chết số 1).
  - Trang link environment hiện ghi chú, không điều hướng.
- **Faker:** chỉ `faker-loader.ts` import `@localman/shared/faker-methods`, theo kiểu động. Chunk lỗi thì không bị cache. Hủy trong lúc đang tải thì trả `CANCELLED`.
- **Dọn dẹp:**
  - Listener `selectionchange`, `keydown` và `pointerdown` đều được gỡ trong cleanup.
  - Timer ẩn thẻ được clear khi unmount.
  - `ViewPlugin.destroy` gọi `closeSuggest`/`unselect`. `FloatingCard` gỡ listener scroll và resize.
- **data-id:** đã đổi theo prototype (`tabbar-env-select`, `env-select-*`, `sidebar-envs-*`, `env-menu-*`, `var-menu-*`, `vars-more-*`, `modal-restore-change`, `modal-save-request*`, `status-menu-clear`, `collection-header-share`, `folder-overview`, `right-info`). Không còn tham chiếu nào tới id cũ trong `e2e` hay `apps/web/src`.
- **Tài liệu:**
  - "Link phần tử" khớp code (`element-link-page.tsx`, `open-element-from-navigation.tsx`).
  - "Collections" khớp ở các mục liên kết, giá trị local, diff ẩn với Editor, và cửa sổ 5 phút.
  - "Environments": khớp, trừ câu "một lần ghi nguyên tử" (H2).

## Thiếu test cho đường rủi ro

1. Đổi environment hoặc workspace active giữa lúc gửi và lúc lưu scope (H1).
2. Share all hoặc Update all khi lưu shared lỗi (H2).
3. Cờ tắt: snippet và script ghi scope (M1).
4. "Set as variable" khi key đã có shared value hoặc người dùng có local (M3).
5. Request có script nhưng không có `{{…}}` khi dashboard API lỗi (M4).
6. Bàn phím trong assist: `Shift+F10`, `Escape` trả focus (M6).
7. E2E chưa có kịch bản nào cho: script ghi local, "Set as variable" ghi environment, Share all, import/export environment. Hiện các phần này chỉ có unit test.

## Khuyến nghị theo thứ tự

1. H1: chốt `{workspaceId, environmentId}` ngay lúc gửi.
2. H2: chỉ reset local sau khi shared đã lưu thành công, và sửa câu "nguyên tử" trong tài liệu.
3. M1: ẩn snippet ghi scope khi cờ tắt. Nên làm trước khi deploy, vì prod đang tắt cờ.
4. M2: sửa câu chữ "withheld" ở cả 3 ngôn ngữ.
5. M3, M4, M6: bổ sung cảnh báo, gửi được khi không đọc được layer, và test bàn phím kèm ARIA.
6. M5: hỏi Jev về nghĩa của "nơi đang dùng", hoặc làm danh sách collection liên quan.
7. Các mục Low: L1 (một dòng `key`) và L8 làm luôn, phần còn lại gom vào lượt dọn.

## Câu hỏi mở

1. "Nơi đang dùng" trong Info của environment là danh sách collection liên kết hay "active cho bạn"? (M5)
2. Phần tử được share riêng cho người không thuộc workspace của nó: khi mở link, workbench có nên hiện chính workspace đó (chế độ chỉ xem) thay vì lùi về workspace cá nhân không? (L5)
3. Move environment (phase 11) có nằm trong phạm vi "100%" của Vòng 38 không? (L7)

Status: DONE_WITH_CONCERNS
Summary: Phần web của phase 13 đợt B nhìn chung đã gate đúng sau cờ `environments` và không lộ secret. Còn 2 lỗi High làm hỏng giá trị local mà không báo: H1 lưu thay đổi do script đặt nhầm vào environment hoặc workspace đang active lúc lưu, H2 reset local trước khi shared lưu xong (đã tái hiện bằng probe). Ngoài ra có 6 Medium, gồm snippet chết vẫn hiện trên prod và câu chữ "withheld" sai quyết định.
Concerns/Blockers: Theo checklist T12b ("không còn finding mức high"), chưa nên bật cờ `environments` khi H1 và H2 chưa sửa. M1 ảnh hưởng prod ngay cả khi cờ tắt.
