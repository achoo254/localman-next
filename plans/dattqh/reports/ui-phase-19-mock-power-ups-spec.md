# Spec UI phase 19: import resource, xuất type, chaos, rules theo endpoint, gợi ý Faker

Đầu vào cho T7 (UI) và phần hợp đồng API của T6. Spec này thay cho việc bổ sung màn vào `prototype/index.html` ở T1, vì user đang vắng: user duyệt spec này thay cho màn prototype. Ngày chốt: 09/10/2026.

Nguồn đã đối chiếu: `phase-19-mock-power-ups.md`; `prototype/index.html` (CSS modal và schema 600–650, `viewProject` 2600–2630, form resource 2915–2990); `docs/design-system.md`; `docs/ux-writing.md` (§1–9); `docs/i18n.md`; code `pages/project-detail/{api-endpoint-card,resources-card,project-detail-page,project-detail-dialogs}.tsx`, `features/resource-tree/{resource-node,node-actions}.tsx`, `features/resources/{resource-form-modal,endpoints-editor,schema-editor,schema-field-row,faker-method-select,object-template-editor,resource-form-state,schema-grid,resource-model}.ts(x)`, `components/ui/*`, `config/feature-flags.ts`, `platform/{download,clipboard}.ts`, `i18n/messages/en/{resources,project-detail}.ts`; shared `schema-import-fields.ts` (mã lỗi import), `schema-field-hints.ts`, `openapi-document.ts` (`MAX_OPENAPI_BYTES`), `resource-constants.ts`, `plan-limits.ts`; API `resource-import-operations.ts` (phase 17).

## 0. Quyết định chính

| # | Quyết định | Lý do |
|---|---|---|
| 1 | Cả 5 tiện ích nằm sau một cờ mới `mockPowerUps` trong `config/feature-flags.ts`. Cờ tắt thì không có nút Import, icon xuất type, nút Chaos/Rules hay badge gợi ý. | `ux-writing` §3: không hiện tính năng chưa chạy trên production. Phase lên staging trước (T9). |
| 2 | Import là **một modal `xl`, 3 tab, xem trước tự động** (gọi API dry run, debounce 600ms sau khi nguồn parse được, hoặc ngay khi chọn file). Footer luôn là Huỷ / "Create resource"; nút chính khoá cho tới khi có preview hợp lệ. Không làm wizard 2 bước. | Ít thao tác hơn, phù hợp màn 375px. Preview do server dựng (T6 "xem trước rồi tạo") nên dữ liệu mẫu OpenAPI sinh bằng đúng generator Faker của server, và trình duyệt không phải tải runner Faker. |
| 3 | Preview **chỉ đọc**. Muốn đổi schema thì tạo xong rồi mở "Edit". | Không phải dựng thêm một schema editor thứ hai trong dialog. Form resource đã có đủ chức năng, kể cả gợi ý Faker. |
| 4 | Tab OpenAPI: chọn **một** schema gốc (`components.schemas`), cùng switch "Also create related resources" (mặc định bật) cho các schema được `$ref` tới. | Đáp ứng "chọn schema khi có nhiều" và "petstore ra cây có quan hệ". Switch là lối thoát khi tên bị trùng hoặc vượt hạn mức gói. |
| 5 | Xuất type chạy **phía client** bằng `type-exporters` của `@localman/shared` (import động khi mở menu), dựa trên **bản đã lưu** của resource cùng cây resource có sẵn trong cache trang. | Chạy ngay, không có trạng thái lỗi mạng, cùng một hàm với operation/MCP của T6. Bản nháp chưa lưu có thể không hợp lệ. |
| 6 | Trên node, xuất type là **icon `{}` ở cuối hàng Edit / Data / Delete** (`ml-auto`), không phải nút chữ thứ tư. | Node rộng 208px, vùng chữ khoảng 182px. Thêm chữ "Types" thì hàng English cần khoảng 191px, bản vi khoảng 184px, nên tràn. Dùng icon 28px thì chỉ cần khoảng 171px (en) và 164px (vi). |
| 7 | Chaos và Rules nằm **trong từng thẻ endpoint** của `EndpointsEditor`, dạng hai nút disclosure dưới response template. Chúng lưu cùng nút "Update" / "Create resource" của form, không có nút lưu riêng. | Model đặt `chaos` và `rules[]` trên endpoint, và hiện form đã lưu endpoint theo cách này. |
| 8 | Đổi thứ tự rule bằng **nút lên/xuống**, không làm kéo thả ở bản đầu. | Yêu cầu là "kéo thả **hoặc** nút". Nút dùng được với bàn phím, trình đọc màn hình và màn cảm ứng mà không cần thư viện mới. Kéo thả chỉ là cách thứ hai cho cùng việc đó. |
| 9 | Rule **thu gọn** thành một dòng tóm tắt; chỉ rule đang mở mới dựng 2 `JsonEditor`. Rule mới thêm thì mở sẵn. | 5 endpoint × 20 rule × 2 editor là 200 instance CodeMirror. Dòng tóm tắt cũng giúp đọc thứ tự "khớp đầu tiên thì dừng". |
| 10 | Gợi ý Faker chỉ **tự điền khi user chưa tự chọn method** cho field đó trong phiên sửa. Field đã lưu không bị đổi. Badge `suggested` nằm ở dòng dưới field, không nhét vào ô method. | Ô method ở ≥640px chỉ rộng khoảng 200px, gắn badge vào trong sẽ cắt mất tên method. User đổi method thì badge biến mất và matcher không ghi đè nữa. |
| 11 | Chuỗi mới đặt trong các namespace mới `resourceImport`, `resourceExport`, `resourceChaos`, `resourceRules`; chỉ thêm 2 key vào `resources.schema`. | `en/resources.ts` đang 128 dòng, thêm khoảng 120 dòng sẽ vượt giới hạn 200 dòng mỗi file. |

## 1. Phần dùng chung

### 1.1 Quyền

- Project chỉ có `owner` và `collaborator`, và cả hai đều có `editResources`. Vì vậy collaborator thấy và dùng **y hệt** owner: import, xuất type, chaos, rules, gợi ý Faker.
- Chỗ khác nhau duy nhất là **hạn mức gói**, vì hạn mức theo gói của owner. Import vượt số resource còn lại thì owner thấy nút "Manage plan" (mở `subscription.openPlans("resources")`), còn collaborator thấy câu "ask the owner" (mục 2.6). Server trả `PLAN_LIMIT` lúc tạo thì giữ luồng `onPlanLimit` hiện có: owner mở bảng gói, collaborator nhận toast `projectDetail.planLimit`.
- Collaborator bị gỡ khỏi project giữa chừng thì server trả 403. Hiện lỗi `resources.errors.forbidden` ngay trong dialog hoặc form; dữ liệu đã nhập giữ nguyên.

### 1.2 Tải lazy

- `import-resource-dialog` là chunk lazy, nạp giống `ResourceFormModal` trong `project-detail-dialogs.tsx` vì có CodeMirror. `ProjectDialog` thêm `{ kind: "import" }`.
- `chaos-panel` và `rules-editor` nằm trong chunk của form resource.
- `export-types-menu` nằm trên trang (node), nên chỉ `import()` `type-exporters` khi menu mở. Module này phải không phụ thuộc zod lẫn catalog Faker, và cần một subpath nhẹ (ví dụ `@localman/shared/type-exporters`).

### 1.3 Hợp đồng API UI cần (đề xuất cho T6, T3, T5)

- **Preview:** `POST /projects/:projectId/resources/import/preview` nhận `{ kind: "json" | "openapi" | "file", text, fileName?, schemaName?, related: boolean, name? }`. Kết quả gồm:
  - `resources[]`, mỗi phần tử có `{ name, parentName | null, fields[{ name, type, fakerMethod?, suggested }], sample: JsonRecord[] (tối đa 5), recordCount, sampleKind: "source" | "generated" }`; phần tử đầu là resource chính.
  - `schemaNames[]` và `selectedSchema` (chỉ có với OpenAPI).
  - `warnings[{ code, path, params }]`.
  - `resourcesLeft: number | null` (theo gói của owner, `null` khi không giới hạn; map `Infinity` một cách tường minh).
- **Tạo:** cùng input đó, thêm `names` (tên đã sửa), gọi `POST …/resources/import`. Trả các resource đã tạo, cùng tạo trong một transaction.
- **Lỗi:** `400 RESOURCE_IMPORT_FAILED` với `details: { reason, params }`. `reason` lấy từ `SchemaImportErrorCode`, cộng các mã CSV/JSON mới ở mục 2.6. `params` chứa `cycle`, `ref`, `row`, `column`, `expected`, `found`, `name`, `max`. Input quá 2 MB thì trả `413`. UI dịch theo `reason`, **không** hiện `message` tiếng Anh của parser.
- **Warning:** API phase 17 đang trả `{ path, message }`, tức chữ tiếng Anh không dịch được. Cần thêm `code` và `params`. Code lạ thì UI hiện `message` như phương án cuối.
- **Endpoint:** `ResourceEndpoint` thêm `chaos: { latencyMs: [min, max], errorRate, errorStatus, timeoutRate }` (tỉ lệ 0–1) và `rules: Rule[]`. Lỗi validation đi theo `VALIDATION_ERROR` với path `endpoints.{i}.chaos.latencyMs.0` hoặc `endpoints.{i}.rules.{j}.match.value`.
- `faker-field-matcher` cần chạy được ở client (form resource) qua một subpath nhẹ. Nên **mở rộng** `schema-field-hints.ts` đã có, không viết bảng luật thứ hai (xem Concerns).

## 2. Dialog "Import resource"

### 2.1 Điểm vào

- Footer của card API endpoint: `[+ Add resource] [Import] [Generate all] [Reset all] [Change mock URL]`. "Import" là `Button` secondary, icon `IconFileImport` 20px, đặt ngay sau "Add resource", `data-id="project-detail-import-resource"`.
- Trạng thái rỗng của card Resources: thêm nút secondary "Import" cạnh "Add resource" (`project-detail-tree-empty-import`). Hai nút xếp ngang, xuống dòng khi hẹp.
- `useFirstResourcePrompt` vẫn tự mở form "New resource" như cũ, không mở dialog import.
- Resource import luôn tạo ở **root**, giống "Add resource". Muốn lồng vào resource khác thì kéo nối như hiện nay.

### 2.2 Cấu trúc

```
Modal xl  data-id="modal-import-resource"   title: Import resource
 description: Create a resource from sample JSON, an OpenAPI document or a CSV/JSON file.
 ┌ TabsList: [Sample JSON] [OpenAPI] [CSV or JSON file]
 │ Tab Sample JSON   JsonEditor (label "Sample JSON") + hint
 │ Tab OpenAPI       [Choose file] + JsonEditor (label "OpenAPI document") + hint
 │                   Select "Schema" (khi có ≥ 1 schema) + Switch "Also create related resources"
 │ Tab CSV/JSON      vùng chọn/thả file → chip file (tên · cỡ · Remove) + hint
 ├ Lỗi nguồn (Alert danger)   ← lỗi parse, kích thước, $ref, CSV
 ├ Preview  data-id="resource-import-preview"   <section aria-labelledby>
 │   h3 Preview    [badge 6 fields] [badge 3 records]
 │   FormField "Resource name" (điền sẵn, sửa được)
 │   Related: "Also creates: categories, tags"  (OpenAPI, related bật; mỗi tên có ô sửa)
 │   h4 Schema → bảng Field | Type | Faker method (badge suggested)
 │   h4 "First 5 of 120 records" | "Sample records generated from the schema"
 │      bảng dữ liệu cuộn ngang
 │   Alert warning: hạn mức / bị cắt bớt  ·  danh sách notes (warnings)
 └ Footer: [Cancel] [Create resource]
```

- Tab dùng primitive `Tabs` với `TabsList` cuộn ngang khi hẹp. Mỗi tab giữ nội dung riêng trong state của dialog, nên đổi tab không mất gì. Preview hiển thị theo tab đang chọn: đổi tab thì hiện preview của tab đó, hoặc trạng thái rỗng nếu tab đó chưa có nguồn.
- Focus khi mở: editor của tab "Sample JSON" (`initialFocusRef`).

### 2.3 Từng tab

**Sample JSON** (`resource-import-json`)
- `JsonEditor` có `lineWrapping`, `min-h-40` (ở ≥768px là `min-h-56`) và placeholder `[{ "name": "Ada", "email": "ada@example.com" }]`.
- Chỉ nhận object hoặc mảng object. Object đơn cho 1 bản ghi. Mảng rỗng là lỗi.
- Client chặn trước khi gọi API: quá 2 MB, JSON sai (thông báo dòng và cột có sẵn của `JsonEditor`), và gốc không phải object hay mảng object.

**OpenAPI** (`resource-import-openapi`)
- Nút "Choose file" (`resource-import-openapi-file`, `<input type="file" accept=".json,application/json">` ẩn, gọi từ nút) đặt trên editor. Chọn file thì nội dung đổ vào editor, nên user vẫn thấy và sửa được.
- Có ≥ 2 schema thì hiện `Select` "Schema" (`resource-import-openapi-schema`, `<select>` native), mặc định là schema object đầu tiên do server chọn. Đổi lựa chọn thì preview chạy lại ngay.
- Switch "Also create related resources" (`resource-import-related`) chỉ hiện khi schema có `$ref` tới schema khác. Tắt thì các field đó thành `Object`.
- Chỉ nhận JSON, vì parser phase 17 chưa đọc YAML (xem copy hint).

**CSV or JSON file** (`resource-import-file`)
- Vùng chọn là `<label>` bọc `<input type="file" accept=".csv,.json,text/csv,application/json">` ẩn, hiển thị như thẻ viền đứt `border-dashed border-border rounded-lg p-6`, có icon `IconFileUpload`. Kéo file vào thì vùng đổi viền sang `border-primary` (chỉ đổi màu).
- Sau khi chọn: chip `users.csv · 48 KB` cùng `IconButton` "Remove file" (`resource-import-file-remove`). Tên resource điền sẵn từ tên file: bỏ đuôi, đổi về chữ thường, ký tự không hợp lệ thành `-`.
- Client chặn trước khi đọc file: đuôi khác `.csv`/`.json`, hoặc quá 2 MB (dùng `file.size`, không cần đọc nội dung).

### 2.4 Preview

- **Bảng schema** (`resource-import-preview-schema`): `<table>` gồm Field / Type / Faker method. Dòng `id` (Object ID) khoá ở đầu, giống `FixedRow`. Method nào matcher gợi ý thì có `Badge tone="primary"` `suggested`. Ở <640px, mỗi field thành một khối `dl`: tên field đậm, dưới là `Type · method`.
- **Bảng dữ liệu** (`resource-import-preview-rows`): tối đa 5 dòng. Ô dùng chữ mono `text-xs` và cắt ở `max-w-48 truncate` (giá trị đầy đủ ở `title`); object hiện `{…}`, mảng hiện `[3]`. Bảng nằm trong `div` có `overflow-x-auto`, `tabIndex=0`, `role="region"` và `aria-label`.
  - JSON và CSV: tiêu đề là "First 5 of {count} records" (có ít hơn 5 thì "{count} records").
  - OpenAPI: tiêu đề là "Sample records generated from the schema", kèm ghi chú "The resource starts empty…". Import OpenAPI không seed dữ liệu.
- **Tên resource**: `FormField` dùng lại hint `resources.form.nameHint`, validate client giống form (`RESOURCE_NAME_PATTERN`, tên trùng với resource root). Với OpenAPI có related, mỗi tên resource liên quan có một `Input` nhỏ trong danh sách "Also creates", để sửa khi trùng tên.
- **Ghi chú (warnings)** (`resource-import-warnings`): hiện tối đa 3, còn lại gom vào nút "Show all {count}" (disclosure).
- Nguồn có hơn `MAX_RECORDS_PER_RESOURCE` (1.000) bản ghi thì `Alert warning` báo chỉ nhập 1.000 bản ghi đầu. Nút tạo vẫn bấm được.

### 2.5 Trạng thái

| Trạng thái | Hiển thị | Nút "Create resource" |
|---|---|---|
| Rỗng (chưa có nguồn) | Khung preview `text-muted` "Paste or choose a source…" | khoá |
| Đang đọc file | `<output>` "Reading file…" trong vùng file | khoá |
| Đang dựng preview | Preview cũ (nếu có) mờ `opacity-60` cùng `aria-busy="true"`, dòng "Building preview…". Request cũ bị huỷ bằng `AbortController`. | khoá |
| Preview sẵn sàng | Như mục 2.4. Vùng sr-only `aria-live="polite"` đọc "Preview ready: 6 fields, 3 records." | mở |
| Lỗi nguồn | `Alert danger` (`resource-import-error`) ngay dưới tab. Preview bị gỡ, nguồn giữ nguyên. | khoá |
| Vượt hạn mức | `Alert warning`: owner có nút "Manage plan", collaborator có câu nhờ owner (mục 2.6) | khoá |
| Tên sai hoặc trùng | Lỗi ngay dưới ô tên (`FormField error`) | khoá |
| Đang tạo | Nút đổi thành "Creating…", toàn dialog khoá, không đóng được (như `busy` của form) | khoá |
| Tạo lỗi | `Alert danger` ở cuối body, nội dung giữ nguyên | mở |
| Thành công | Đóng dialog, toast (mục 2.7), `cache.invalidate()`. Focus trả về nút "Import". | |

### 2.6 Lỗi: mã, key, copy English

| Nguồn | Key `resourceImport.errors.*` | English |
|---|---|---|
| Client: file hoặc paste > 2 MB, `INPUT_TOO_LARGE`, 413 | `tooLarge` | The file is {size}, over the 2 MB limit. Use a smaller file or split it. |
| | `pastedTooLarge` | The pasted text is over 2 MB. Paste a smaller sample. |
| Client: đuôi file sai | `fileType` | Choose a .csv or .json file. |
| Client: không đọc được file | `readFailed` | Couldn't read the file. Choose it again. |
| JSON sai | (dùng thông báo của `JsonEditor`) | Invalid JSON at line X, column Y |
| Gốc JSON sai dạng | `jsonShape` | Paste a JSON object or an array of objects. Other values can't become records. |
| Mảng rỗng | `jsonEmpty` | The array is empty, so there are no fields to read. Paste at least one object. |
| `INVALID_INPUT`, `UNSUPPORTED` (OpenAPI) | `notOpenApi` | This isn't an OpenAPI 3.x document. Check that it's JSON with an <code>openapi</code> field of 3.0 or 3.1. |
| Không có `components.schemas` | `noSchemas` | The document has no schemas under <code>components.schemas</code>. |
| `SCHEMA_NOT_FOUND` | `schemaNotFound` | There's no schema named “{name}”. Pick one from the list. |
| `REF_CYCLE` | `refCycle` | These schemas refer to each other in a loop: <code>{cycle}</code>. Pick another schema, or remove the loop from the document and try again. |
| `EXTERNAL_REF` | `externalRef` | <code>{ref}</code> points outside this document. Localman doesn't fetch other files or URLs. Copy that schema into the document and try again. |
| `TOO_DEEP` | `tooDeep` | The schema nests more than {max} levels. Pick a smaller schema. |
| `TOO_COMPLEX` | `tooComplex` | The schema has too many fields or references to import (up to {max} fields). Pick a smaller schema. |
| `NO_FIELDS` | `noFields` | No fields found. The source needs at least one property besides <code>id</code>. |
| `CSV_EMPTY` (mới) | `csvEmpty` | The file has no data rows. |
| `CSV_HEADER` (mới) | `csvHeader` | Column {column} has no name. The first row must name every column. |
| `CSV_ROW` (mới) | `csvRow` | Row {row} has {found} columns, but the header has {expected}. Check for a missing quote or an extra comma. |
| `CSV_QUOTE` (mới) | `csvQuote` | Row {row} has a quote that never closes. |
| `ENCODING` (mới) | `encoding` | The file isn't UTF-8 text. Save it as UTF-8 and try again. |
| Bản ghi > 32 KB | (dùng lại) `resources.errors.recordTooLarge` | |
| Tên trùng, `forbidden`, khác | (dùng lại) `resources.errors.nameTaken`, `.forbidden`, `errorMessage()` | |
| Hạn mức (preview) | `planRoom` (plural theo `count`) | This creates {count} resources, but the project has room for {left} more on its owner's plan. |
| | `planRoomCollaborator` | Turn off related resources, or ask the project owner to upgrade. |

Mọi lỗi đều giữ nguyên nguồn đã nhập, nên không cần thêm câu "Nội dung vẫn còn đây".

### 2.7 Copy khác (`resourceImport.*`, English là nguồn)

| Key | English |
|---|---|
| `entry` | Import |
| `title` | Import resource |
| `description` | Create a resource from sample JSON, an OpenAPI document or a CSV/JSON file. |
| `tabs.json` / `tabs.openapi` / `tabs.file` | Sample JSON / OpenAPI / CSV or JSON file |
| `json.label` | Sample JSON |
| `json.hint` | Paste one object or an array of objects. Each object becomes a record (up to {max}). |
| `openapi.label` | OpenAPI document |
| `openapi.chooseFile` | Choose file |
| `openapi.hint` | OpenAPI 3.0 or 3.1 as JSON, up to 2 MB. Convert YAML to JSON first. Only references inside the document (<code>#/components/…</code>) are read. |
| `openapi.schema` | Schema |
| `openapi.schemaHint` | `{ one: "{count} schema in <code>components.schemas</code>.", other: "{count} schemas in <code>components.schemas</code>. Pick the one that becomes the resource." }` |
| `openapi.related` | Also create related resources |
| `openapi.relatedOn` | Schemas referenced with <code>$ref</code> become nested resources. |
| `openapi.relatedOff` | Referenced schemas become Object fields. |
| `file.choose` | Choose a CSV or JSON file |
| `file.drop` | or drop it here · up to 2 MB |
| `file.hint` | CSV: the first row is the header, values separated by commas, UTF-8. Types are guessed from the first 100 rows. |
| `file.chosen` | {name} · {size} |
| `file.remove` | Remove file |
| `file.reading` | Reading file… |
| `preview.title` | Preview |
| `preview.empty` | Paste or choose a source to see the schema and the first 5 records here. |
| `preview.loading` | Building preview… |
| `preview.ready` | Preview ready: {fields}, {records}. (ghép từ 2 key plural bên dưới) |
| `preview.fields` | `{ one: "{count} field", other: "{count} fields" }` |
| `preview.schema` | Schema |
| `preview.firstRecords` | First {shown} of {count} records |
| `preview.allRecords` | dùng lại `resources.records` |
| `preview.sample` | Sample records generated from the schema |
| `preview.sampleNote` | The resource starts empty. Click its gray bar to generate data. |
| `preview.alsoCreates` | Also creates: |
| `preview.relatedName` | Name of related resource {name} (aria-label) |
| `preview.truncated` | The source has {count} records. Only the first {max} will be imported. |
| `preview.notes` | `{ one: "{count} note", other: "{count} notes" }` |
| `preview.showAll` | Show all {count} |
| `preview.rowsRegion` | Records preview (aria-label vùng cuộn) |
| `warnings.renamed` | Renamed “{from}” to <code>{to}</code>. |
| `warnings.mixedTypes` | <code>{field}</code> has mixed types, so it was imported as String. |
| `warnings.unsupported` | <code>{path}</code> uses something Localman can't map, so it was imported as Object. |
| `warnings.skipped` | Skipped <code>{path}</code>. |
| `submit` / `creating` | Create resource / Creating… |
| `managePlan` | Manage plan (dùng lại key hiện có của subscription nếu đã có) |
| `projectDetail.toast.imported` | `{ one: "Imported <code>{name}</code> with <b>{count}</b> record.", other: "Imported <code>{name}</code> with <b>{count}</b> records." }` |
| `projectDetail.toast.importedEmpty` | Imported <code>{name}</code>. (mô tả: dùng lại `createdHint`) |
| `projectDetail.toast.importedRelated` | `{ one: "Imported <code>{name}</code> and {count} related resource.", other: "Imported <code>{name}</code> and {count} related resources." }` |

### 2.8 `data-id`

`project-detail-import-resource`, `project-detail-tree-empty-import`, `modal-import-resource`, `resource-import-tab-json|openapi|file`, `resource-import-json`, `resource-import-openapi`, `resource-import-openapi-file`, `resource-import-openapi-schema`, `resource-import-related`, `resource-import-file`, `resource-import-file-remove`, `resource-import-error`, `resource-import-preview`, `resource-import-name`, `resource-import-related-{name}`, `resource-import-preview-schema`, `resource-import-preview-rows`, `resource-import-warnings`, `resource-import-submit`.

### 2.9 Primitive

`Modal` (xl), `ModalFooter`, `ModalClose`, `Tabs`/`TabsList`/`TabsTrigger`/`TabsContent`, `JsonEditor`, `Button`, `IconButton`, `FormField`/`Input`, `Select`, `Switch`, `Badge`, `Alert`. Vùng thả file và bảng preview chỉ dùng ở dialog này, nên viết ngay trong `features/resources/` (`import-file-drop.tsx`, `import-preview.tsx`) và không thêm primitive mới. Mỗi file ≤ 200 dòng: tách `import-resource-dialog.tsx` (khung, tab, footer), `import-preview.tsx`, `import-file-drop.tsx` và `use-import-preview.ts` (debounce, abort, gọi API).

### 2.10 Responsive

- **375px:** Modal gần full chiều ngang. `TabsList` cuộn ngang vì 3 trigger cần khoảng 340px. Editor `min-h-40`. Schema preview hiện dạng `dl`. Bảng dữ liệu cuộn ngang trong vùng riêng, trang không cuộn ngang. Danh sách "Also creates" xếp dọc. Footer 2 cột, dính đáy.
- **768px:** Modal 768px. Ba tab nằm vừa một hàng. Editor `min-h-56`. Schema preview là bảng 3 cột.
- **1440px:** Như 768 vì modal giới hạn 768px. Footer card endpoint vẫn một hàng: Add resource, Import, Generate all, Reset all, Change mock URL.

### 2.11 A11y

- Tab có đủ `tablist`/`tab`/`tabpanel` (Radix). Editor có tên qua `label`. Ô file ẩn được kích hoạt bằng nút hoặc `label` có thể focus; vùng thả file vẫn bấm được và dùng được bằng Enter/Space.
- Lỗi nguồn là `Alert danger`, nên tự có `role="alert"`. Editor liên kết với lỗi qua `describedBy`.
- Bảng preview có `<caption>` (sr-only khi đã có h4 hiển thị) và `<th scope="col">`. Vùng cuộn có thể focus và có `aria-label`.
- Preview sẵn sàng thì báo qua `aria-live="polite"`. Khung preview đang tải có `aria-busy`.
- Badge `suggested` là chữ, không chỉ dựa vào màu.
- Focus khi đóng trả về nút "Import". Nếu nút đó đã biến mất (trạng thái rỗng chuyển sang canvas) thì `onCloseAutoFocus` chuyển focus vào nút "Import" ở footer card.

## 3. Menu "Export types"

### 3.1 Vị trí

- **Node** (`resource-node-{id}-types`): icon `IconBraces` 16px, nằm cuối hàng thao tác (`ml-auto`). Dùng chung kiểu `ACTION_CLASS`: hiện khi hover hoặc focus, luôn hiện trên màn cảm ứng, có pseudo-element nới vùng chạm. Đây là `DropdownMenuTrigger` bọc trong `Tooltip` "Export types", với `aria-label` "Export types of {name}".
- **Form resource, chỉ ở chế độ Edit** (`resource-form-export-types`): `Button` ghost sm "Export types", icon `IconBraces` cùng `IconChevronDown`, đặt bên phải đầu mục Schema (cùng hàng với "Shape of each record"; hint xuống dòng khi hẹp). Ở chế độ New resource thì không có, vì chưa có gì đã lưu để xuất.

### 3.2 Nội dung menu (`DropdownMenuContent align="end"`)

```
[Exports the saved schema. Update the resource to include your changes.]  ← DropdownMenuLabel, chỉ khi form có thay đổi chưa lưu
Copy TypeScript            export-types-ts-copy
Download users.ts          export-types-ts-download
──────────
Copy Zod schema            export-types-zod-copy
Download users.schema.ts   export-types-zod-download
```

- Icon item: `IconCopy`, `IconDownload`. Tải về qua `downloadText(filename, text, "text/typescript;charset=utf-8")`.
- Nội dung xuất gồm type của resource cùng type của các resource có quan hệ cha–con mà nó tham chiếu (theo `type-exporters`). Đầu file có comment `// Generated by Localman from resource "users".`, không ghi ngày giờ để diff không đổi khi xuất lại.
- Không có trạng thái rỗng: resource nào cũng có ít nhất `id`.

### 3.3 Trạng thái và copy (`resourceExport.*`)

| Key | English | Khi nào |
|---|---|---|
| `trigger` | Export types | nút trong form, tooltip trên node |
| `triggerLabel` | Export types of {name} | `aria-label` icon trên node |
| `copyTs` / `copyZod` | Copy TypeScript / Copy Zod schema | item |
| `download` | Download {file} | item, `{file}` đặt trong font mono |
| `savedOnly` | Exports the saved schema. Update the resource to include your changes. | form có thay đổi chưa lưu |
| `preparing` | Preparing… | chunk `type-exporters` đang tải: các item khoá, hiện label này |
| `copiedTs` | Copied the TypeScript types of {name}. | sao chép xong |
| `copiedZod` | Copied the Zod schema of {name}. | sao chép xong |
| `copyBlocked` | Your browser blocked copying. Use Download instead. | `copyText` trả `false`, giọng trung tính |
| `failed` | Couldn't build the types. Reload the page and try again. | chunk không tải được |

- Trên trang (node), kết quả báo bằng toast (`tone: "info"` khi bị chặn).
- Trong form (modal), kết quả báo qua vùng `aria-live="polite"` sr-only cạnh nút, và nút đổi sang `IconCheck` trong `COPIED_RESET_MS`, giống `CodeBlock`, vì toast nằm ngoài dialog Radix (`design-system` mục CopyField).
- Collaborator: giống owner.

### 3.4 Responsive và a11y

- Menu của Radix tự lật hướng (`collisionPadding` 8), nên ở 375px không tràn màn. Item cao 40px, trên màn cảm ứng nâng lên 44px bằng `pointer-coarse:min-h-11`.
- Menu có `role="menu"`, các item là `menuitem`, điều hướng bằng ↑/↓, Escape đóng và trả focus về trigger. Label "saved only" dùng `DropdownMenuLabel`, không dùng `<p>`.

## 4. Panel Chaos theo endpoint

### 4.1 Vị trí trong `EndpointsEditor`

Mỗi thẻ endpoint (`resource-form-endpoint-{slug}`, `slug` thuộc `get-list|get-one|post-list|put-one|delete-one`) có thêm một hàng dưới `JsonEditor` và dòng lỗi:

```
[⇄ Rules · 3] [⚡ Chaos  (badge "chaos" khi đang bật)]            ← 2 nút ghost sm, aria-expanded
┌ panel Chaos (khi mở), nền bg-surface-subtle, rounded-md, p-3
│ intro + dòng thứ tự xử lý
│ Delay      [Min ___ ms] – [Max ___ ms]
│ Error rate [___ %]        Error status [500 Internal Server Error ▾]
│ Timeout rate [___ %]
│ [Turn off chaos]
└
```

- Thứ tự hai nút là Rules trước, Chaos sau, theo đúng thứ tự server xử lý. Mỗi lần chỉ mở một panel trong một endpoint: mở panel này thì panel kia đóng, để thẻ không quá dài.
- Endpoint đang tắt (`enabled = false`) thì hai nút khoá, `title` và `aria-describedby` trỏ tới câu `resourceChaos.endpointOff`. Giá trị đã nhập vẫn giữ.
- Khi đóng panel, nút Chaos hiện badge `chaos` (`Badge tone="warning"`) nếu có giá trị khác 0, kèm dòng tóm tắt `text-xs text-muted`: "200–1,500 ms · 10% errors (503) · 5% timeouts".

### 4.2 Trường

| Trường | Control | Ràng buộc | `data-id` |
|---|---|---|---|
| Delay min, max | 2 `Input type="number" inputMode="numeric"` có hậu tố `ms`, trong `fieldset` có legend "Delay" | số nguyên 0–30.000, min ≤ max | `resource-form-chaos-{slug}-delay-min`, `…-delay-max` |
| Error rate | `Input` number hậu tố `%`, step 1 | 0–100 | `…-error-rate` |
| Error status | `Select` native | 400, 401, 403, 404, 409, 422, 429, 500, 502, 503, 504 | `…-error-status` |
| Timeout rate | `Input` number hậu tố `%` | 0–100; error rate + timeout rate ≤ 100 | `…-timeout-rate` |
| Turn off chaos | `Button` ghost sm, đặt mọi giá trị về 0 | | `…-off` |

- UI hiển thị phần trăm (0–100), còn model lưu tỉ lệ 0–1 (đổi ở `resource-form-state`). Draft giữ chuỗi để không nhảy số khi đang gõ.
- Chọn 429 thì hiện hint `status429`.
- Mặc định: tất cả là 0, mã lỗi 500.

### 4.3 Copy (`resourceChaos.*`)

| Key | English |
|---|---|
| `toggle` | Chaos |
| `toggleLabel` | Chaos for {endpoint} (aria-label, ví dụ "Chaos for GET /users") |
| `badge` | chaos |
| `summary` | {min}–{max} ms · {errorRate}% errors ({status}) · {timeoutRate}% timeouts (bỏ phần nào bằng 0) |
| `intro` | Make this endpoint slow or unreliable to test loading states, retries and error handling. |
| `order` | For each request: rules first, then chaos, then the normal response. |
| `delay` / `min` / `max` | Delay / Min / Max |
| `delayHint` | Each response waits a random time in this range, up to 30,000 ms. |
| `errorRate` | Error rate |
| `errorRateHint` | Share of requests that fail with the error status. |
| `errorStatus` | Error status |
| `status429` | 429 responses include a <code>Retry-After</code> header. |
| `timeoutRate` | Timeout rate |
| `timeoutHint` | Share of requests that get no response until the connection closes after 30 seconds. |
| `off` | Turn off chaos |
| `endpointOff` | Turn this endpoint on to use rules and chaos. |
| `errors.delayRange` | Enter whole milliseconds from 0 to 30,000. |
| `errors.delayOrder` | Min can't be more than max. |
| `errors.rate` | Enter a percentage from 0 to 100. |
| `errors.rateSum` | Error rate and timeout rate together can't be over 100%. |

Tên mã trạng thái (`503 Service Unavailable`…) giữ nguyên tiếng Anh ở mọi ngôn ngữ, vì đó là reason phrase của HTTP.

### 4.4 Trạng thái

- Rỗng: tất cả là 0, panel đóng và không có badge.
- Lỗi: hiện ngay dưới ô (`FormField error`). Khi submit có lỗi trong panel đang đóng, form tự mở panel đó, focus ô lỗi đầu tiên, và vẫn hiện `resources.form.checkMarked`. Lỗi từ server (`invalidAt`) map theo path vào đúng ô.
- Loading: không có riêng, đi theo `busy` của form (các ô khoá khi đang lưu).
- Collaborator: giống owner.

### 4.5 Responsive và a11y

- 375px: Delay min/max chia 2 cột trong một hàng, các trường khác 1 cột. Từ 640px: lưới 2 cột (Delay | Error status, Error rate | Timeout rate).
- Nút disclosure có `aria-expanded` và `aria-controls`, cao tối thiểu 44px trên màn cảm ứng. Panel là `<div role="group" aria-labelledby>` trỏ về nút.
- Hậu tố `ms` và `%` là `<span aria-hidden>`, đơn vị nằm trong nhãn truy cập ("Min delay in milliseconds", "Error rate in percent"; key `minLabel`, `maxLabel`, `errorRateLabel`, `timeoutRateLabel`).
- Hint gắn qua `aria-describedby` (FormField lo việc này).

## 5. Rules editor theo endpoint

### 5.1 Cấu trúc

```
panel Rules (resource-form-rules-{slug})
 intro: Return a different response when a request matches. Rules run from top to bottom; the first match wins.
 ┌ Rule 1 ─ header x-role equals admin → 403      [↑][↓][✕]   ← hàng tóm tắt (button aria-expanded)
 ├ Rule 2 (đang mở)                                [↑][↓][✕]
 │  When:     [Match on ▾ Header] [Header name: x-role] [Condition ▾ equals] [Value: admin]
 │  Respond with: [Status 403]
 │            Headers (optional)  JsonEditor  {"x-reason":"forbidden"}
 │            Body template (optional) JsonEditor
 └ …
 [+ Add rule]   Up to 20 rules per endpoint.
```

- Mỗi rule là một `li` trong `ol` (thứ tự có ý nghĩa), viền `border-border-subtle rounded-md`. Hàng tóm tắt gồm số thứ tự, câu tóm tắt chữ mono (`text-[0.8125rem]`) và 3 `IconButton` sm: lên, xuống, xoá.
- Nút lên khoá ở rule đầu, nút xuống khoá ở rule cuối. Sau khi chuyển, focus giữ trên nút vừa bấm ở vị trí mới (nếu nút đó vừa bị khoá thì chuyển sang nút còn lại), và vùng `aria-live` đọc "Rule moved to position 2 of 5."
- Xoá rule không cần xác nhận, vì thay đổi chưa lưu và "Cancel" của form bỏ được. Sau khi xoá, focus chuyển sang rule kế tiếp (hoặc rule trước, hoặc nút "Add rule").
- "Add rule" thêm rule ở cuối, đang mở, focus ô "Match on". Mặc định: Header, op equals, status 200, headers và body rỗng.

### 5.2 Trường

| Trường | Control | Quy tắc |
|---|---|---|
| Match on | `Select`: Header, Query parameter, Body (JSONPath), Request number | GET và DELETE không có lựa chọn Body |
| Key | `Input`, nhãn và placeholder đổi theo nguồn: Header name `x-role`, Parameter `role`, JSONPath `$.user.role`; ẩn với Request number | bắt buộc, ≤ 200 ký tự; JSONPath bắt đầu bằng `$` |
| Condition | `Select`: equals, doesn't equal, contains, matches regex, exists, is greater than, is less than. Với Request number chỉ có equals, doesn't equal, is greater than, is less than | |
| Value | `Input`; ẩn khi chọn exists; `inputMode="numeric"` khi chọn gt, lt hoặc Request number | bắt buộc (trừ exists), ≤ 500 ký tự; regex phải compile được ở client; gt/lt phải là số; Request number là số nguyên ≥ 1 |
| Status | `Input` number, `w-28` | số nguyên 100–599 |
| Headers | `JsonEditor` `allowEmpty`, `min-h-14` | object với giá trị chuỗi; không cho ghi đè header do mock tự đặt (`content-length`, `transfer-encoding`, `connection`…) |
| Body template | `JsonEditor` `allowEmpty`, `min-h-14` | JSON hợp lệ, cùng biến với response template |

`data-id`: `resource-form-rule-{slug}-{n}` cho khối rule; bên trong có `-toggle`, `-source`, `-key`, `-op`, `-value`, `-status`, `-headers`, `-body`, `-up`, `-down`, `-remove`. Ngoài ra `resource-form-rules-{slug}` cho panel, `resource-form-rules-{slug}-add` cho nút thêm, và nút disclosure là `resource-form-endpoint-{slug}-rules` / `…-chaos`.

### 5.3 Copy (`resourceRules.*`)

| Key | English |
|---|---|
| `toggle` | Rules |
| `toggleCount` | `{ one: "Rules · {count}", other: "Rules · {count}" }` (vi và zh-CN chỉ cần `other`) |
| `toggleLabel` | Rules for {endpoint} |
| `intro` | Return a different response when a request matches. Rules run from top to bottom; the first match wins. |
| `empty` | No rules yet. Without rules, this endpoint returns its response template. |
| `add` | Add rule |
| `limit` | Up to {max} rules per endpoint. |
| `limitReached` | This endpoint has {max} rules, the most it can have. |
| `title` | Rule {position} |
| `toggleRule` | Rule {position}: {summary} (aria-label nút tóm tắt) |
| `incomplete` | Incomplete rule (tóm tắt khi rule còn thiếu trường) |
| `when` / `respond` | When / Respond with |
| `source` | Match on |
| `sources.header` / `.query` / `.body` / `.nth` | Header / Query parameter / Body (JSONPath) / Request number |
| `key.header` / `.query` / `.body` | Header name / Parameter / JSONPath |
| `op` | Condition |
| `ops.eq` / `.neq` / `.contains` / `.regex` / `.exists` / `.gt` / `.lt` | equals / doesn't equal / contains / matches regex / exists / is greater than / is less than |
| `value` | Value |
| `headerHint` | Header names aren't case-sensitive. |
| `nthHint` | Counts requests to this endpoint, starting at 1. The count restarts when you save the resource. |
| `status` | Status |
| `headers` | Headers (optional) |
| `headersHint` | A JSON object of header names and text values, for example <code>{example}</code>. |
| `body` | Body template (optional) |
| `bodyHint` | Same variables as the response template. Leave it empty for no body. |
| `moveUp` / `moveDown` / `remove` | Move rule {position} up / Move rule {position} down / Remove rule {position} |
| `moved` | Rule moved to position {position} of {count}. |
| `removed` | Removed rule {position}. |
| `errors.keyRequired` | Enter a header name. / Enter a parameter name. (`keyRequiredHeader`, `keyRequiredQuery`) |
| `errors.jsonPath` | Enter a JSONPath that starts with <code>$</code>, for example <code>$.user.role</code>. |
| `errors.valueRequired` | Enter a value. |
| `errors.number` | Enter a number to compare with. |
| `errors.nth` | Enter a whole number from 1. |
| `errors.regex` | This regex isn't valid. Check brackets and escapes. |
| `errors.tooLong` | Can be at most {max} characters. |
| `errors.status` | Enter a status code from 100 to 599. |
| `errors.headers` | Headers must be a JSON object with text values. |
| `errors.headerReserved` | <code>{name}</code> is set by the mock and can't be changed. |
| `errors.body` | dùng lại `resources.validation.responseInvalid` |

Câu tóm tắt ghép từ các phần đã dịch: nguồn viết thường, key trong mono, op, value trong ngoặc kép, `→` rồi status. Ví dụ: `header x-role equals "admin" → 403`, `request number is greater than 3 → 429`.

### 5.4 Trạng thái

- Rỗng: câu `empty` cùng nút "Add rule".
- Đủ 20 rule: nút "Add rule" khoá, hint đổi sang `limitReached`.
- Lỗi: hiện dưới ô. Rule có lỗi mà đang thu gọn thì hàng tóm tắt có viền `border-error` và chữ "Check this rule" (`resourceRules.checkRule`). Submit có lỗi thì tự mở panel và rule lỗi đầu tiên, rồi focus ô lỗi.
- Loading: theo `busy` của form.
- Collaborator: giống owner.

### 5.5 Responsive và a11y

- 375px: hàng When xếp dọc: Match on (full), Key (full), rồi Condition và Value 2 cột. Status một mình một hàng, hai editor xếp dọc. 3 icon button ở hàng tóm tắt luôn hiện (không chờ hover), mỗi nút 44px trên màn cảm ứng. Câu tóm tắt cắt bằng `truncate`, câu đầy đủ nằm trong `aria-label`.
- ≥640px: When là lưới 4 cột (Match on, Key, Condition, Value). Status `w-28` đặt cạnh nhãn "Respond with".
- 1440px: như 768 (modal giới hạn 768px).
- Danh sách là `ol`. Nút tóm tắt có `aria-expanded` và `aria-controls`. Các select và input có tên truy cập đầy đủ kèm số thứ tự rule, ví dụ "Condition of rule 2" (`resourceRules.fieldOf`: "{field} of rule {position}").
- Kết quả đổi thứ tự và xoá được báo qua một `aria-live="polite"` chung của panel. Không di chuyển phần tử khi đang focus mà không báo.

## 6. Gợi ý Faker trong schema editor

### 6.1 Hành vi

- `FieldDraft` thêm `methodSource: "user" | "suggested" | "saved"`. Field đã lưu là `"saved"`; field mới là `"suggested"` khi đã được gợi ý, ngược lại là `"user"` sau khi user tự chọn.
- Khi user rời ô tên field (blur) **hoặc** sau 400ms ngừng gõ, mà type là `Faker.js` và `methodSource` không phải `"user"`, thì gọi `faker-field-matcher(name, type)`. Có kết quả đạt ngưỡng tin cậy (T2 quyết định, đề xuất ≥ 0.7) thì đặt `fakerMethod` và `methodSource = "suggested"`. Không có kết quả thì giữ method hiện tại.
  - Field `"saved"` chỉ được gợi ý lại khi user **đổi tên** field đó trong phiên này và chưa tự chọn method.
- User chọn method trong `FakerMethodSelect` thì `methodSource = "user"`, badge biến mất, và đổi tên sau đó không đổi method nữa.
- Field kiểu khác `Faker.js` thì không gợi ý.
- `methodSource` chỉ sống ở client, không gửi lên server.

### 6.2 Hiển thị

- Dòng phụ ngay dưới hàng field (cùng chỗ với dòng lỗi; nếu có lỗi thì lỗi nằm trên), căn với cột method ở ≥640px (`sm:col-start-7 sm:col-span-3`, theo `schema-grid`), ở <640px thì nằm dưới khối field:
  `Badge tone="primary"` `suggested` cùng chữ `text-xs text-muted` "from the field name".
- Combobox method có `aria-describedby` trỏ tới dòng này, nên trình đọc màn hình đọc được "suggested from the field name".
- Bảng schema trong preview import dùng chung badge này (mục 2.4, với `suggested: true` từ server).

### 6.3 Copy (`resources.schema.*`)

| Key | English |
|---|---|
| `suggested` | suggested (badge; viết thường trong source, CSS tự in hoa) |
| `suggestedHint` | from the field name. Pick another method anytime. (phần sau là sr-only để dòng hiển thị gọn) |

### 6.4 `data-id`, trạng thái, a11y

- `resource-form-field-{n}-suggested` cho dòng badge.
- Rỗng: field chưa có tên thì không gợi ý. Lỗi: không có, vì matcher là hàm thuần chạy cục bộ. Loading: không có, vì matcher nằm trong chunk của form.
- Collaborator: giống owner.
- Không có animation; badge xuất hiện ngay, nên không phụ thuộc `prefers-reduced-motion`.
- Không di chuyển focus khi method được tự điền. Vùng `aria-live` không đọc gì thêm, vì thông tin đã nằm ở `aria-describedby`; nếu đọc thêm thì mỗi lần blur sẽ bị nói lặp.

## 7. i18n

- Namespace mới (khai trong `en|vi|zh-CN/dictionary.ts`): `resourceImport`, `resourceExport`, `resourceChaos`, `resourceRules`. Thêm vào `resources.schema` (`suggested`, `suggestedHint`) và `projectDetail.toast` (`imported`, `importedEmpty`, `importedRelated`).
- Số (`1,000`, `30,000`, phần trăm) truyền dạng số để `t()` tự định dạng theo ngôn ngữ. Cỡ file (`48 KB`) định dạng qua `formatNumber`.
- Tên file, tên field, method Faker, JSONPath, header và mã HTTP đặt trong `<code>` qua `renderRich`, không dịch. Ví dụ JSON có `{` được truyền qua tham số (`{example}`).
- Thuật ngữ cho bản vi và zh-CN (giữ tiếng Anh theo `ux-writing` §2 và §9, phần còn lại dịch):

| English | vi | zh-CN |
|---|---|---|
| Import / Import resource | Nhập / Nhập resource | 导入 / 导入 resource |
| Export types | Xuất type | 导出类型 |
| Chaos | Chaos (giữ nguyên, kèm intro giải thích) | Chaos（同上） |
| Rule / Rules | Quy tắc | 规则 |
| suggested | gợi ý | 推荐 |
| Sample JSON | JSON mẫu | 示例 JSON |
| Request number | Request thứ N | 第 N 个 request |

## 8. Gợi ý test cho T7

- `import-resource-dialog.test.tsx`: dán JSON ra preview (mock API) rồi tạo; file 3 MB bị chặn ở client; `REF_CYCLE` và `EXTERNAL_REF` hiện đúng copy; OpenAPI nhiều schema thì đổi Select gọi lại preview; hết chỗ trong gói thì nút khoá, owner thấy "Manage plan" còn collaborator không thấy.
- `rules-editor.test.tsx`: thêm đến 20 rule thì nút khoá; lên/xuống đổi thứ tự và vùng live đọc vị trí; GET không có Body; exists ẩn Value.
- `chaos-panel.test.tsx`: min > max, tổng tỉ lệ > 100; % đổi đúng sang tỉ lệ 0–1 khi submit.
- `schema-field-row`: gõ `email` thì ra `internet.email` cùng badge; chọn method khác thì badge mất và đổi tên không ghi đè; field đã lưu không bị đổi.
- `node-actions`: icon xuất type có tên truy cập; hàng thao tác không tràn 208px ở cả 3 ngôn ngữ (kiểm bằng Playwright ở `e2e/`).
- `project-detail-a11y.test.tsx`: thêm dialog import vào lượt axe.

## Unresolved questions

1. Khi một rule khớp, chaos còn chạy không? Plan ghi "chạy rule rồi tới chaos" và "rule đầu tiên khớp thì dừng". Spec giả định delay vẫn áp cho response của rule, còn error và timeout chỉ áp khi không rule nào khớp. Copy `resourceChaos.order` đang trung tính. T5 cần chốt rồi sửa copy cho khớp.
2. Bộ đếm "Request number" bắt đầu lại khi nào: sau khi lưu resource, khi Reset data, hay không bao giờ? Đếm theo endpoint hay theo cả resource? Copy `nthHint` đang giả định đếm theo endpoint và bắt đầu lại khi lưu.
3. Timeout giữ kết nối 30 giây rồi đóng (khớp timeout relay của hệ thống), và 429 có `Retry-After` không, giá trị bao nhiêu? Copy `timeoutHint` và `status429` phụ thuộc T5.
4. Import JSON/CSV quá 1.000 bản ghi: spec chọn cảnh báo rồi chỉ nhập 1.000 bản ghi đầu, thay vì báo lỗi. Nếu muốn từ chối hẳn thì đổi `preview.truncated` thành lỗi.

Status: DONE_WITH_CONCERNS
Summary: Đã viết spec UI cho 5 tiện ích phase 19 (dialog import 3 tab có preview tự động, menu xuất TypeScript/Zod ở node và form, panel Chaos cùng Rules editor trong từng thẻ endpoint, gợi ý Faker có badge `suggested`), gồm cấu trúc, copy English kèm key i18n, `data-id`, primitive, trạng thái (kể cả collaborator và hạn mức gói), responsive 375/768/1440, a11y và hợp đồng API UI cần.
Concerns:
- `packages/shared/src/schema-field-hints.ts` (phase 17) đã có bảng luật tên field sang Faker. T2 nên mở rộng file đó (thêm tiếng Việt không dấu và độ tin cậy) thay vì viết `faker-field-matcher.ts` song song; nếu không, import OpenAPI và form sẽ gợi ý khác nhau.
- API import phase 17 trả warning dạng `{ path, message }` tiếng Anh và lỗi `SCHEMA_IMPORT_FAILED` kèm `message` của parser, nên UI không dịch được. T6 cần thêm `code` và `params` (mục 1.3). Các mã lỗi CSV và JSON mẫu (`CSV_ROW`, `CSV_HEADER`, `ENCODING`…) chưa có trong `SchemaImportErrorCode`.
- Collaborator không biết hạn mức gói của owner, nên preview phải trả `resourcesLeft`; nếu không, import OpenAPI tạo nhiều resource chỉ thất bại ở bước cuối.
- Regex của rule do người dùng nhập và chạy trên server với mọi request mock: T5 và T10 cần chặn ReDoS (giới hạn độ dài, dùng engine tuyến tính hoặc timeout). UI chỉ kiểm cú pháp.
- Cần cờ mới `mockPowerUps` trong `feature-flags.ts` và trong cấu hình production (commit `09f21e3` giữ cờ trong repo). Sau khi T7 xong, cập nhật `docs/design-system.md` (icon xuất type trên node, mẫu disclosure Chaos/Rules) và trang docs custom responses nếu muốn hướng dẫn rules.
