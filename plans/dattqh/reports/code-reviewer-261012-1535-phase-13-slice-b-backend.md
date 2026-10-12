# Review phase 13 đợt B (Environments) và sửa parity phase 12 (Collections): phần backend và shared

Ngày: 2026-10-12 · Người review: code-reviewer · Chỉ đọc (không sửa source, không commit)

## Phạm vi

- Diff chưa commit dưới `apps/api` và `packages/shared` (`git diff HEAD`), cùng file mới chưa track trong `apps/api/src` và `packages/shared/src`. Bỏ qua WIP auth/silent sign-in và tunelo.
- 51 file sửa (+704/−225) cùng khoảng 15 file mới: `script-sandbox/**`, `environments/{script-scope-values,postman-environment}.ts`, `{dynamic-variables,faker-dynamic-variables,variable-interpolation}.ts`, `faker-methods.ts`, `environment-transfer-*`, `environment-view.ts`, `collections/**` (links, changelog page, search, duplicate), `access/share-*`, `module-loggers.ts`, `main.ts`.
- Đối chiếu với: plan.md Vòng 38, phase-12/13, audit `code-reviewer-261012-1430-…`, docs/system-architecture.md (các mục "Collections của API client", "Environments và biến", "Link phần tử").
- Kiểm tra thêm (ngoài các gate đã chạy): một probe vitest trong scratchpad gọi sandbox QuickJS thật (`runPre`) và `script-scope-values.ts` (kết quả ở M1 và L1). File ≤200 dòng: đạt (không file nào vượt). Grep `any`, `!`, `export default`, `eslint-disable`, `@ts-ignore`: 0 kết quả.

## Đánh giá tổng quan

Không có lỗi Critical/High. Các ranh giới quyền đều đúng:
- import kiểm `addElements` trước khi đọc file;
- export đi qua `getEnvironment`, nên tuân quyền view, và secret luôn bị để trống;
- link environment/mock project trả cùng một lỗi 400 cho "không có" và "không đọc được", và view chỉ nêu tên khi người gọi đọc được;
- hidden diff phân quyền bằng `elementRoleAllows(..., "edit")`;
- secret bị giấu không bao giờ vào sandbox.

QuickJS vẫn cách ly: host chỉ đưa JSON vào và đọc một chuỗi JSON ra. Không có callback mới. Các cap (số biến, độ dài, log, test) vẫn được kiểm ở cả hai phía. Không có prototype pollution, vì giá trị luôn là string nên setter `__proto__` bỏ qua chúng.

Các vấn đề còn lại nằm ở chỗ giới hạn của sandbox lệch với giới hạn lưu giá trị local (một lỗi đã tái hiện), chi phí phân trang changelog, và vài chỗ hở test/tài liệu.

## Critical

Không có.

## High

Không có.

## Medium

### M1. Scope có hơn 500 key làm mọi script lỗi `SCRIPT_INTERNAL` (đã tái hiện)

- `packages/shared/src/api-client/script-sandbox/script-output.ts:47` (`entries.length > MAX_SCRIPT_VARIABLES` thì trả `null`, thành `MALFORMED`)
- `script-types.ts:17` (`MAX_SCRIPT_VARIABLES = 500`)
- `script-prelude.ts:78`

Một scope gồm hai phần cộng lại: tối đa 200 biến định nghĩa (`ENVIRONMENT_VARIABLES_MAX`, `COLLECTION_VARIABLES_MAX`) và tối đa 500 giá trị local (`LOCAL_VALUES_MAX`). Giá trị local có thể mang key không được định nghĩa: `scopeVariables` coi chúng là biến thường, và `patchLocalValues` chấp nhận key bất kỳ. Vì vậy một scope đưa vào sandbox có thể có tới 700 key. Đợt này đưa thêm `globals` và `collectionVariables` vào input, nên mỗi lượt gửi giờ phơi ba scope như vậy.

Kịch bản: lượt 1, script chạy `lm.globals.set("k"+i, …)` tới cap 500 (300 key mới cộng 200 key định nghĩa), và các key này được lưu thành local. Sau đó một Editor thêm 1 biến shared. Từ đó, mọi pre/post script của người này trong workspace trả "The sandbox returned a malformed result", kể cả script không đụng tới `lm.globals`. Probe: `runPre("lm.request.url = lm.request.url;", { environment: <600 key> })` cho ra `{"code":"SCRIPT_INTERNAL","message":"The sandbox returned a malformed result"}`. Thêm một hệ quả: khi input đã có ≥500 key, mọi `set` tên mới đều ném RangeError.

Sửa: đặt cap theo từng scope là `ENVIRONMENT_VARIABLES_MAX + LOCAL_VALUES_MAX` (700, đọc từ `@localman/shared`), hoặc kiểm số key ở host trước khi chạy và trả lỗi rõ (`SCRIPT_SCOPE_TOO_LARGE`, nêu scope). Thêm test cho scope 501–700 key.

### M2. Giá trị script đặt được dài hơn giới hạn lưu, nên cả lô thay đổi của một scope bị server từ chối

- `script-types.ts:19` (`MAX_SCRIPT_VARIABLE_LENGTH = 64 KiB`)
- `environment-schemas.ts:71-73` (`localValuesPatchSchema`: value ≤ 10 000, key `trim` 1..200)
- `script-scope-values.ts:91-102` (`changesOf` không lọc gì)

Kịch bản: post script chạy `lm.environment.set("token", res)` với chuỗi 12 KB (JWT có claims lớn, hoặc một body JSON), cùng `lm.environment.set("userId", "7")`. Sandbox nhận cả hai. `PATCH /environments/:id/local-values` trả 400 cho cả mảng, nên `userId` cũng mất, người dùng chỉ thấy toast chung "scopesNotSaved". Hai ca tương tự:
- key dài hơn 200 ký tự: cả lô bị từ chối;
- key có khoảng trắng đầu hoặc cuối (`" a "`): zod `trim` lưu thành `"a"`, lượt sau là một key khác.

Sửa (chọn một):
- cho `store.set` của ba scope bền (`globals`, `collectionVariables`, `environment`) dùng cap `VARIABLE_VALUE_MAX`/`VARIABLE_KEY_MAX` và ném lỗi ngay trong script, như Postman báo lỗi tại chỗ;
- hoặc để `scriptScopeChanges` trả riêng danh sách `rejected` (key/giá trị vượt giới hạn) để lưu phần hợp lệ và nêu tên phần bị bỏ.

### M3. Phân trang changelog phải đi lại cả chuỗi revision ở mỗi trang

- `apps/api/src/modules/collections/changelog-page.ts:52-69` (`chainBelow`), `:98-111`

Phần đúng: `chainBelow` cho thấy revision cũ nhất của chuỗi chắc chắn mở một session. Lý do: revision ngay dưới nó do người khác viết, hoặc cách hơn 5 phút, nên không thể gia nhập session nào. Phân nhóm qua các trang nhờ vậy khớp với phân nhóm trên toàn changelog.

Phần tốn kém: nếu một tác giả sửa đều đặn, mỗi lần cách ≤5 phút (một job MCP, một agent, hay người dùng sửa liên tục cả buổi), chuỗi kéo dài tới toàn bộ 2000 revision. Mỗi lần mở trang khi đó tốn tới 21 query, tức đọc khoảng 2100 dòng meta, rồi bỏ gần hết. Mở 20 trang thì khoảng 400 query và 40 000 dòng. Ngoài ra, nếu tác giả tạo ~2000 revision trong 5 phút (thao tác hàng loạt qua MCP), một trang trả tới ~2100 change trong một response.

Mức này vẫn bị chặn trên (2000 revision giữ lại, index `{collectionId, seq}`) nên không phải lỗi đúng/sai. Tuy vậy, đây là đường đọc mà Viewer gọi được, và ai mở rail Changelog cũng gọi.

Sửa: lưu mốc session khi ghi. `appendRevisions` đã chạy trong transaction có khoá workspace; nó đọc revision mới nhất và gán `sessionStartSeq`, kế thừa khi cùng tác giả và `at - sessionStartAt ≤ 5 phút`. Khi đó phân trang chỉ là "lấy 100 dòng rồi kéo tới `sessionStartSeq` của dòng cuối": 2 query, không cần duyệt chuỗi. Nếu chưa muốn đổi schema, ít nhất nên cap số dòng của một trang (chẳng hạn 500) và để `nextBefore` trỏ giữa session, chấp nhận cắt session trong trường hợp bệnh lý.

### M4. (Web, liên quan trực tiếp tới hợp đồng shared) Thay đổi của script có thể được lưu vào environment khác

- `apps/web/src/features/environments/use-script-scope-saver.ts:78-81`
- `apps/web/src/features/api-client/workbench/use-send-tab.ts:163-166`

`environmentId` được đọc từ cache **lúc lưu**, tức sau khi response về, không phải lúc gửi. Kịch bản: gửi với env "Staging", request chậm, người dùng chuyển active sang "Prod". Khi đó post script `lm.environment.set("token", …)` ghi token của Staging thành local value của Prod. `changesOf` cũng tính trên dữ liệu của Staging, nên một key bị script unset sẽ bị "reset" trong Prod.

Sửa: chụp `environmentId` cùng lúc dựng `layers` cho lượt gửi (trong `useVariableLayers` hay `SendHooks`), mang nó theo kết quả lượt gửi, rồi truyền vào `saveScopes`.

## Low

### L1. Key `__proto__` bị rơi im lặng (không phải lỗi bảo mật; đã kiểm bằng probe)

- `script-scope-values.ts:41-48`: `values` là `{}`, nên `target["__proto__"] = "x"` không tạo own key. Probe cho `hasOwn false []`.
- `script-prelude.ts:83`: `Object.assign({}, …)` đi qua setter, nên `lm.environment.toObject()` thiếu `__proto__`, trong khi `get('__proto__')` vẫn trả `"x"`. Code cũ dùng `Object.fromEntries`, nên đây là regression nhỏ.
- Hệ quả: biến tên `__proto__` không bao giờ tới script. Script `set` nó thì vẫn được lưu (probe cho `changes: [{"key":"__proto__","value":"x"}]`).

Sửa: dùng `Object.create(null)` (hoặc `Object.fromEntries`) cho `values` trong `scriptScopeValues`/`emptyScriptScopes`. Trong prelude, dựng `toObject` bằng `copy` (null-prototype) nạp lần lượt từng scope.

### L2. Script đặt giá trị cho biến đang tắt thì `{{k}}` của chính lượt gửi vẫn không resolve

- `script-scope-values.ts:73-75`: `withScriptScopes` giữ `enabled: false` của biến gốc.

Bên trong script, `lm.environment.get("k")` trả giá trị mới, nhưng resolver bỏ qua biến tắt, nên `{{k}}` báo chưa resolve. Giá trị local vẫn được lưu. Sửa: đặt `enabled: true` cho biến script đã ghi, hoặc ghi rõ hành vi này trong docs.

### L3. Round-trip export/import đổi biến "không share" thành shared rỗng

- `postman-environment.ts:47`
- `environment-transfer-service.ts:92-96`

Biến `default` có `sharedValue: null` được export thành `""`. Khi import lại, chỉ secret rỗng mới quay về `null`, nên biến này thành shared value `""`, và đè giá trị local của không ai nhưng hiện là "shared". Sửa: khi import, cũng coi `""` là `null` với mọi kiểu, hoặc chấp nhận và ghi vào docs.

### L4. Giới hạn body 3 MiB của import nhỏ hơn dữ liệu hợp lệ tối đa

- `environment-transfer-operations.ts:71`
- `environment-inputs.ts:4-5`

200 giá trị × 10 000 ký tự CJK hoặc tiếng Việt có dấu là khoảng 6 MB UTF-8 (thêm escape `\uXXXX` còn lớn hơn). Server trả 413 thay vì `INVALID_ENVIRONMENT_FILE`/`value_too_long`. Lỗi giống hệt đã có sẵn ở PUT variables. Sửa: `VARIABLES_BODY_LIMIT` khoảng 8 MiB (200 × 10 000 × 4 byte), hoặc tính theo công thức thay vì hằng số.

### L5. `linksFor` chạy ở mọi lần tải collection detail, có cả tác dụng phụ ghi

- `collection-store.ts:94`, `collection-read-operations.ts:82` (export), `collection-links.ts:75,129`

Mỗi lần tải detail, kể cả export v2.1 và mọi lượt ghi (update, restore, trash restore), tốn thêm 5–7 query: `findEnvironment`, `findWorkspaceById`, `workspaceRoleOf`, `ElementRoleModel.find`, `claimEmailShare`, `findProject`, `CollaboratorModel.exists`. Thêm nữa, `elementRoleOf` gọi `claimEmailShare` (`access-policy.ts:47`), là một thao tác ghi. Vì vậy GET một collection có thể nhận luôn email share của environment liên quan. Việc đó hợp với quy tắc "nhận khi dùng lần đầu", nhưng xảy ra ngầm trong lúc đọc phần tử khác.

Sửa:
- export không cần links: thêm tuỳ chọn `withLinks: false`, hoặc tách `loadCollectionNodes`;
- dùng một biến thể chỉ đọc của `elementRoleOf` (không claim) cho việc hiển thị link.

### L6. Nhánh tìm example cũ bằng regex không index và phân biệt dấu

- `collection-search-service.ts:96-110`

Example lưu trước bản này không có `searchName`, nên được so `name` bằng regex `i`. Nhánh này không dùng index và không bỏ dấu (tìm "cafe" không ra "Café"), trái với mô tả operation ("case and accents ignored"). Sửa: một lần backfill `searchName` cho `kind: "example"` (migration hoặc script khởi động idempotent), rồi bỏ nhánh `$or` thứ hai.

### L7. Các đường rủi ro chưa có test

- duplicate mang theo `mockProject` khi đọc được, và bỏ khi không đọc được (`collection-duplicate-service.ts:63-66`): chưa có test;
- `PATCH mockProjectId` (đặt hoặc bỏ, 400 `INVALID_MOCK_PROJECT`): mới test đường create;
- link environment **cùng workspace** nhưng người gọi không đọc được (Editor chỉ qua share, không phải thành viên) phải ra 400 `INVALID_ENVIRONMENT_LINK` và không lộ sự tồn tại: chưa test;
- scope sandbox 501–700 key (M1), và giá trị/key vượt giới hạn lưu (M2).

### L8. Phụ thuộc chéo module

- `environment-view.ts:9` import `displayNames` từ `../collections/people.js`. Helper này dùng chung cho collections, environments, trash và overview, nên chuyển sang `modules/users/` thì đúng ranh giới module hơn.

### L9. Plan lệch với quyết định Vòng 38

- `phase-13-environments-and-variables.md:68` (T5: "ghi revision như changelog phase 12") và `:86` (T5b: "batch có revision") còn ghi có revision.
- Vòng 38 và docs (`system-architecture.md`, mục "Thao tác hàng loạt") ghi không có revision environment, và code cũng không có.
- Lead nên sửa text của T5 và T5b. Reviewer không sửa plan.

## Edge case tìm được khi scout

- Thứ tự session phụ thuộc `at` tăng cùng `seq`. Điều này đúng vì `seq` được cấp dưới khoá workspace trên cùng một host; nếu lệch đồng hồ giữa nhiều host thì chỉ làm sai lệch nhỏ cách gom session.
- Khi revision cũ bị trim, mốc gom session của các session cũ nhất có thể dịch, nên một `nextBefore` client đang giữ có thể rơi vào giữa session. Chỉ ảnh hưởng hiển thị.
- `sharedEnvironmentId` là "lần share gần nhất" cho cả collection. Share collection kèm env F cho Carol sẽ thay env E đã share cho Bob, và Bob thấy `relatedEnvironment: null` nếu không đọc được F. Hành vi này đúng như docs mô tả, chỉ nêu ra để Jev biết.
- Chỉ lưu `scopeChanges` khi `settled.kind === "done"` (`use-send-tab.ts:163`). Pre-script đã `set` token mà request lỗi mạng thì thay đổi bị mất. Postman vẫn giữ trường hợp này.
- Đã kiểm, không có lỗi:
  - `fakerForSend` quét `toSend` **sau** pre-script;
  - interpolation chỉ chạy một lượt (không lồng), nên `{{$random…}}` nằm trong giá trị biến không bị lọt ra;
  - nếu thiếu runner, tên Faker giữ nguyên như gõ, và chỉ preview hay snippet mới thiếu runner;
  - update chỉ đổi link không tạo revision ("update" thuộc `QUIET_WHEN_EMPTY`, test có kiểm).

## Đối chiếu tài liệu

- Mục "Liên kết", "Changelog" (cửa sổ 5 phút, trang có thể dài hơn 100, Editor/Admin thấy hidden diff), "Script", "Biến động", "Import/export", "Thao tác hàng loạt" trong `docs/system-architecture.md`: khớp code.
- Mô tả MCP của `client.importEnvironment`/`exportEnvironment`: các mã lỗi `INVALID_ENVIRONMENT_FILE`, `ENVIRONMENT_LIMIT_REACHED` (`environment-access.ts:69`) và `SECRET_STORAGE_UNAVAILABLE` (`secret-cipher.ts:16`) đều có thật trong code.
- Mô tả của `client.searchCollections` ghi "accents ignored" nhưng không đúng với example cũ (L6).

## Việc nên làm (theo thứ tự)

1. M1: thống nhất cap số key theo scope (700), hoặc kiểm ở host và trả lỗi rõ; thêm test.
2. M2: chặn key/giá trị vượt giới hạn lưu ngay trong `set` của scope bền, hoặc lưu từng phần và nêu tên phần bị bỏ.
3. M4: chụp `environmentId` lúc gửi rồi truyền vào `saveScopes`.
4. M3: lưu `sessionStartSeq` lúc append, hoặc cap số dòng mỗi trang.
5. L1–L3: dùng object null-prototype, xử lý biến tắt bị script ghi, round-trip import `""`.
6. L7: bổ sung test (duplicate, PATCH mockProjectId, env cùng workspace không đọc được).
7. L5, L6, L8, L9 khi tiện.

## Số liệu

- Type coverage: strict, 0 `any`/`!` trong phạm vi (grep).
- Test: theo lead, api 219/1248, shared 69/1634, web 282/1358, E2E 39/39 đều pass. Probe riêng: 3/3 chạy được, xác nhận M1 và L1.
- Lint: 0 (theo lead).

## Câu hỏi còn mở

1. Duplicate collection trong **cùng workspace** có nên mang theo `linkedEnvironmentId` không? Hiện chỉ mang `mockProjectId`. Plan và docs đều chưa nói.
2. Pre-script đã `set` mà request lỗi mạng: có lưu thay đổi như Postman không?
3. M3: có chấp nhận đổi schema revision (thêm `sessionStartSeq`) trong đợt này, hay chỉ cap số dòng mỗi trang?

Status: DONE_WITH_CONCERNS
Summary: Không có lỗi Critical/High; quyền, cách xử lý secret và cách ly QuickJS đều ổn. Có 4 vấn đề Medium: cap 500 key của sandbox lệch với giới hạn scope 700 (đã tái hiện `SCRIPT_INTERNAL`), giới hạn giá trị/key của script lệch với giới hạn lưu local, phân trang changelog duyệt lại chuỗi tới 2000 dòng mỗi trang, và web lưu thay đổi script vào environment đang active lúc lưu thay vì lúc gửi.
Concerns/Blockers: M4 nằm ở web, ngoài phạm vi backend được giao, nhưng ảnh hưởng tính đúng của dữ liệu. Plan T5/T5b còn ghi "có revision", trái với Vòng 38.
