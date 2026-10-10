# Hợp đồng mock runtime

Tài liệu cho người duy trì: client bên ngoài thấy gì khi gọi mock API công khai (mock app, cổng 4100). Trang docs người dùng (`/docs/*`, source ở `apps/web/src/pages/docs/`) diễn giải cùng hợp đồng cho người dùng cuối. Cách runtime giữ hợp đồng bên trong (cache project, bộ đếm, transaction, field quan hệ) nằm ở [Kiến trúc hệ thống, mục Mock runtime](system-architecture.md#mock-runtime).

Test là chủ sở hữu thực thi của hợp đồng này: `contract.test.ts` và `contract-custom-responses.test.ts` (chạy lại các ví dụ trong wiki mockapi.io), `security.test.ts` và các `mock-*.test.ts` trong `apps/api/src/modules/mock-runtime/`. Đổi hành vi thì sửa test, tài liệu này và trang docs người dùng trong cùng một thay đổi.

Mock runtime không đi qua operation registry: không có trong OpenAPI của dashboard. Mỗi project có một MCP endpoint riêng ở `{prefix}/mcp` (Hosted Mock MCP, xem [mục MCP](#mcp)) thao tác trên cùng dữ liệu; MCP để quản lý project và resource là các operation `mock.*` của dashboard API.

Đường dẫn file bên dưới tính từ `apps/api/src/` nếu không ghi package.

## Địa chỉ

| Dạng | URL |
|---|---|
| Subdomain | `https://{secret}.localman.hoandat.com{prefix}/…` |
| Fallback theo path | `https://localman.hoandat.com/m/{secret}{prefix}/…` |

- Domain là `MOCK_BASE_DOMAIN` (`config/feature-env.ts`), runtime đọc qua `runtimeSettings().mockBaseDomain` (`config/runtime-settings.ts`). Host so khớp không phân biệt hoa thường, bỏ cổng; secret phải là một nhãn DNS (`DNS_LABEL` trong `modules/mock-runtime/resolve-project.ts`). Dashboard sinh secret 24 ký tự `a-z0-9` (`modules/projects/project-service.ts`).
- Fallback `/m/{secret}` (`PATH_FALLBACK`) cho host chưa có wildcard TLS và cho môi trường local; hợp đồng giống hệt dạng subdomain.
- Prefix của project so khớp phân biệt hoa thường (`stripPrefix`). Một dấu `/` cuối được bỏ qua; path có đoạn rỗng (`//`), escape hỏng hoặc quá `MAX_SEGMENTS` đoạn thì không trỏ tới project nào.
- Subdomain dành riêng cho nền tảng trả 404 ở nginx, trước khi tới app: danh sách nằm ở server block "Names reserved for the platform" trong [`infra/localman/nginx/localman.hoandat.com.conf`](../infra/localman/nginx/localman.hoandat.com.conf). Secret dài 24 ký tự nên không trùng các tên này.
- Request không trỏ tới project nào (secret sai định dạng, path hỏng, host không có secret) đi tiếp xuống `/healthz` và 404 chung. Trên host của project, `/healthz` là một route mock bình thường.

## Route

Path được tách theo cây resource thành `/{res}[/{id}]/{childRes}[/{id}]…`, độ sâu tuỳ ý (`matchRoute` trong `modules/mock-runtime/route-matcher.ts`). Tên resource so khớp phân biệt hoa thường.

- **`{prefix}/mcp`** là MCP endpoint của project, xét trước các route REST. Tên resource `mcp` bị từ chối khi lưu (400 `VALIDATION_ERROR`, `RESERVED_RESOURCE_NAMES` trong `packages/shared/src/resource-constants.ts`). Dữ liệu cũ có resource gốc tên `mcp` vẫn chạy REST ở `/mcp/{id}`, còn `/mcp` thuộc về MCP; lần đầu gặp project như vậy, process ghi một dòng log cảnh báo (chỉ `projectId`).
- **Đoạn đầu:** khớp resource gốc cùng tên; không có gốc thì khớp resource lồng **duy nhất** mang tên đó (route phẳng `/{child}` của mockapi.io). Tên trùng ở nhiều nhánh mà không có gốc thì 404.
- **Route lồng** (`/users/1/posts`): mọi bản ghi tổ tiên phải tồn tại và đúng cha, kết quả lọc theo bản ghi cha trên path.
- **Route phẳng** (`/posts`): trả mọi bản ghi của resource, không lọc theo cha.
- **Tên field cha (`{parent}Id`)** là `parentKey` của resource con, đọc qua một hàm duy nhất `resourceParentKey` (`packages/shared/src/parent-key.ts`) ở mọi nơi: route, bộ lọc `?{parent}Id=`, bản ghi sinh ra, export types, `list_resources`, Hosted Mock MCP và OpenAPI của mock. Bản ghi chỉ lưu `parentRecordId`; tên field được dựng lúc trả về, nên đổi `parentKey` không phải ghi lại bản ghi.
  - Resource tạo mới, import, hoặc vừa được chuyển sang cha khác (`move_resource`) lưu khoá theo `parentKeyOf`: camelCase tên cha (`-`, `_` mở từ mới), từ cuối về số ít (bảng bất quy tắc như `people` → `person`, `series`, `data` giữ nguyên; luật đuôi `-zzes`, `-uses`, `-yses`/`-eses` → `-sis`, `-ies` → `-y`, `-sses`/`-xes`/`-ches`/`-shes` bỏ `-es`, `-s`), rồi nối `Id`; tên bắt đầu bằng số thêm `_` ở đầu. Ví dụ `quizzes` → `quizId`, `order-items` → `orderItemId`.
  - Resource lưu trước khi có field này không có `parentKey` và giữ khoá theo luật cũ (`legacyParentKeyOf`: chỉ `-ies`, `-es`, `-s`, giữ nguyên `-`), nên client hiện có không bị đổi tên field. Không migrate dữ liệu.
  - Đổi tên cha: khoá dựng từ tên cũ (luật mới hoặc luật cũ) đi theo tên mới như trước; khoá người dùng tự đặt giữ nguyên.
  - Người dùng đặt khoá qua `parentKey` của `create_resource`/`update_resource` (`POST`/`PUT /api/v1/projects/:projectId/resources…`, kiểm ở `modules/resources/resource-parent-key.ts`): định danh JS `^[A-Za-z_$][A-Za-z0-9_$]*$`, tối đa 64 ký tự, không phải `id` hay `FORBIDDEN_KEYS`, không trùng field schema hoặc key template của chính resource; sai thì 400 `VALIDATION_ERROR` với `details[0].path = "parentKey"`. Resource gốc gửi `parentKey` cũng là 400 đó. Gửi lại đúng khoá hiện tại luôn được nhận (kể cả khoá luật cũ không phải định danh JS). Khoá mới trùng field dữ liệu đã có trong bản ghi thì 409 `FIELD_CONFLICT`.

## Method

| Method | Path | Thành công | Body trả về |
|---|---|---|---|
| `GET` | `/{res}` | 200 | Mảng bản ghi sau query |
| `GET` | `/{res}/{id}` | 200 | Bản ghi |
| `HEAD` | như `GET` | như `GET` | Không có body |
| `POST` | `/{res}` | 201 | Bản ghi mới |
| `PUT`, `PATCH` | `/{res}/{id}` | 200 | Bản ghi sau khi merge |
| `DELETE` | `/{res}/{id}` | 200 | Bản ghi đã xoá |
| `OPTIONS` | bất kỳ | 204 | Preflight CORS, không có body |

- Method khác, kết hợp sai (`POST /{res}/{id}`, `PUT /{res}`) hoặc endpoint đang tắt ở dashboard trả 404 `"Not found"` (`endpointKind`, `enabledEndpoint` trong `modules/mock-runtime/render-response.ts`). `PATCH` dùng chung endpoint `PUT` và có cùng ngữ nghĩa merge.
- **POST:** `id` do runtime cấp (tăng dần theo resource); field schema mà body thiếu được sinh như generator (`FILL_MISSING_FIELDS_ON_CREATE` trong `modules/mock-runtime/crud-handlers.ts`).
- **PUT/PATCH:** merge body vào bản ghi, key cũ giữ thứ tự, không đổi `id` hay `{parent}Id`.
- **DELETE:** xoá dây chuyền bản ghi con ở mọi tầng (`modules/mock-runtime/record-cascade.ts`).
- **Body ghi:** object JSON; thiếu body là `{}`. `id`, `{parent}Id` và tên field quan hệ bị bỏ khỏi dữ liệu lưu (`readRecordBody` trong `modules/mock-runtime/record-body.ts`). Route lồng lấy `{parent}Id` từ path; route phẳng của resource con cần `{parent}Id` trong body trỏ tới bản ghi cha có thật (`modules/mock-runtime/new-record.ts`).
- Status thành công do endpoint quyết định; custom response chỉ đổi body. Rule khớp và chaos có thể đổi status, xem [Rules và chaos](#rules-và-chaos).

## Header

- Mọi response, kể cả lỗi: `X-Localman-Request-Id` (UUID, `REQUEST_ID_HEADER` trong `http/request-log.ts`), trùng id trong dòng log của request.
- CORS (`mockCors` trong `modules/mock-runtime/mock-http.ts`): `Access-Control-Allow-Origin: *`, không bao giờ kèm credentials; `Access-Control-Expose-Headers` gồm `X-Localman-Request-Id`, `Retry-After` và `WWW-Authenticate` (thử MCP endpoint từ trình duyệt). Preflight trả 204 với `ALLOWED_METHODS`, lặp lại đúng danh sách `Access-Control-Request-Headers` nếu hợp lệ (nên `Authorization` dùng được), có `Access-Control-Max-Age`. Preflight không bị rate limit và không tính vào hạn mức tháng.
- `Cross-Origin-Resource-Policy: cross-origin` (cấu hình helmet trong `mock-server.ts`).
- Body luôn là JSON.

## Query

Chỉ `GET /{res}` đọc query; các route khác bỏ qua query. Tên tham số dành riêng nằm ở `MOCK_QUERY_PARAMS` và trần một trang ở `MAX_PAGE_LIMIT`, cả hai trong [`packages/shared/src/mock-query.ts`](../packages/shared/src/mock-query.ts); runtime và trang docs người dùng đọc cùng hằng này. Ngữ nghĩa nằm ở `modules/mock-runtime/query-engine.ts` và `query-match.ts`:

- **search:** chuỗi con không phân biệt hoa thường trên mọi giá trị chuỗi cấp một của bản ghi.
- **`<field>=<value>`:** chỉ áp cho field của schema (hoặc key cấp một của object template), `id` và `{parent}Id`; nhiều điều kiện kết hợp AND; key khác bị bỏ qua. `id` và `{parent}Id` khớp nguyên chuỗi; field khác ép giá trị theo kiểu của giá trị trong bản ghi. Field trùng tên tham số dành riêng không lọc được.
- **page/limit:** số nguyên dương. Không có limit thì trả hết; limit lớn hơn trần thì hạ về trần; giá trị hỏng bị bỏ qua như không gửi.
- **sort/order:** sắp theo field có thật, ổn định; `order=desc` (không phân biệt hoa thường) đảo chiều, mặc định tăng dần; field lạ bị bỏ qua.
- Tên hoặc giá trị không an toàn trả 400 `INVALID_QUERY`, xem [Bảo mật](#bảo-mật).

## Custom response

Mỗi endpoint có một `response`. Giá trị mặc định `DEFAULT_RESPONSE` (`"$mockData"`, `packages/shared/src/resource-constants.ts`) trả thẳng dữ liệu. Template khác được render mỗi request bằng `renderJsonTemplate` (`packages/shared/src/json-template-render.ts`, gọi từ `renderResponse` trong `modules/mock-runtime/render-response.ts`):

- Chỉ thay khi **cả chuỗi** là một tham chiếu: biến trong `RESPONSE_VARIABLES` (`$mockData`, `$count`; `packages/shared/src/json-template.ts`) hoặc `$category.method` của whitelist Faker. Tham chiếu lạ giữ nguyên chữ; template không bao giờ chạy code.
- `$mockData`: dữ liệu của endpoint (mảng sau query với list, một bản ghi với các endpoint còn lại).
- `$count`: với list là số bản ghi sau lọc, trước phân trang; với endpoint khác là số bản ghi của collection theo route. Runtime chỉ đếm khi template có `"$count"` (`usesCount`).
- Giới hạn template lúc lưu là `TEMPLATE_LIMITS` (`packages/shared/src/resource-templates.ts`); lúc render, đầu ra bị chặn ở trần response.

## Rules và chaos

Mỗi endpoint có thể có `rules` (response theo điều kiện) và `chaos` (độ trễ, lỗi giả lập), đặt qua `endpoints[]` của `update_resource` (`PUT /api/v1/projects/:projectId/resources/:resourceId`; sai thì 400 `VALIDATION_ERROR` với path như `endpoints.0.chaos.latencyMs`). Schema và giới hạn ở [`packages/shared/src/endpoint-behavior.ts`](../packages/shared/src/endpoint-behavior.ts) (import qua `@localman/shared/endpoint-behavior`), lưu cùng endpoint của resource; endpoint cũ không có hai field này chạy như trước. Runtime: `modules/mock-runtime/mock-behavior.ts` (dùng chung REST và MCP), `conditional-rules.ts`, `chaos.ts`, `chaos-delay.ts`.

**Thứ tự mỗi request:** đếm `nth` → rule → chaos → CRUD bình thường. Không có rule nào khớp và chaos không sinh lỗi thì endpoint chạy như không có hai tính năng này.

- **Rule** `{ match: { source, key | path }, op, value, response: { status, body?, headers } }`, tối đa `MAX_RULES_PER_ENDPOINT` (20) rule và `MAX_RULES_BYTES` mỗi endpoint. Rule thử theo thứ tự, **rule đầu tiên khớp thì dừng**, response của nó thay cho CRUD (không ghi gì vào store).
  - `source`: `header` (tên không phân biệt hoa thường), `query`, `body` (JSONPath con: `$`, `.key`, `['key']`, `[0]`; không wildcard/filter, không bao giờ eval; `parseJsonPath` trong `packages/shared/src/json-path.ts`), `nth` (thứ tự request của endpoint, từ 1).
  - `op`: `eq`, `neq`, `contains` (chuỗi con, hoặc phần tử của mảng), `regex`, `exists`, `gt`, `lt`. So sánh theo số khi một bên là số (`"10"` eq `10`), còn lại theo chuỗi. Giá trị thiếu chỉ khớp `neq`. `nth` chỉ nhận `eq`, `neq`, `gt`, `lt` với số nguyên ≥ 1.
  - `nth` đếm trong bộ nhớ process, theo endpoint; khoá đếm gồm `revision` của resource (tăng mỗi lần `PUT /api/v1/projects/:projectId/resources/:resourceId`), nên **mỗi lần lưu resource** là đếm lại từ 1, và process khởi động lại cũng vậy. Bộ đếm (`RequestCounter`) giữ tối đa 500 khoá mỗi project và 10 000 khoá tổng, bỏ khoá ít dùng nhất trước, nên một project không đẩy được bộ đếm của project khác ra.
  - `response.body` là template như custom response (thiếu thì `$mockData`): với `GET` thì `$mockData`/`$count` là dữ liệu endpoint sẽ trả (chỉ đọc khi template dùng tới), với endpoint ghi là `null`. Kích thước và ngân sách byte như response thường.
  - `response.headers` `[{ name, value }]`, tối đa 20, tên là token RFC 9110, giá trị ASCII in được (không CR/LF). **Allowlist** (`isRuleHeaderName`, `ruleHeaderIssue` trong `packages/shared/src/rule-headers.ts`, web dùng chung qua `@localman/shared/endpoint-behavior`): mọi `x-*` trừ `x-localman-*`, `x-forwarded-*`, `x-request-id`, `x-frame-options`, `x-content-type-options`; cùng `retry-after`, `cache-control`, `etag`, `last-modified`, `expires`, `content-language`, `content-type` (chỉ kiểu JSON `application/json`, `application/…+json` hoặc `text/plain`, vì body luôn là JSON) và `location` (chỉ khi status 3xx). Header ngoài danh sách (hop-by-hop, `set-cookie`, CORS, CSP/HSTS, `nel`, `report-to`, `clear-site-data`, `www-authenticate`, `alt-svc`, `link`, `content-disposition`…) bị từ chối khi lưu. Rule lưu từ trước khi có allowlist vẫn chạy: runtime chỉ bỏ qua header không còn hợp lệ, không báo lỗi.
- **Regex chống ReDoS** (`unsafeRegexReason` trong `packages/shared/src/safe-regex.ts`, kiểm khi lưu và kiểm lại khi chạy): pattern ≤ 200 ký tự, hợp lệ với cờ `u`; cấm backreference, lookahead/lookbehind và quantifier trên group (`(a+)+`, `(a|aa)*`); mọi `{` ngoài class/escape phải mở một quantifier `{n}`, `{n,}`, `{n,m}` (đọc mọi số chữ số, không thì từ chối); tích số lựa chọn của các quantifier (`max − min + 1`, chặn ở `MAX_REGEX_INPUT` như quantifier không chặn trên; mỗi `|` tính 2) nhân số vị trí bắt đầu không vượt `MAX_REGEX_COST` (2^20), thực tế là một `+`/`*`, hoặc hai khi pattern bắt đầu bằng `^`. Chuỗi dài hơn `MAX_REGEX_INPUT` (1 024) không bao giờ khớp regex. Nhờ vậy số bước backtrack của mọi pattern được lưu có chặn trên, không cần timeout.
- **Chaos** `{ latencyMs: [min, max], errorRate, errorStatus, timeoutRate, rateLimitRate }`: delay 0–`MAX_CHAOS_DELAY_MS` (30 000 ms), tỉ lệ 0–1 với tổng ba tỉ lệ ≤ 1, `errorStatus` 400–599 (mặc định 500).
  - Mỗi request rút một độ trễ đều trong `[min, max]`, rồi **một** lần rút chia thành các dải timeout → 429 → lỗi, nên mỗi loại xảy ra đúng theo tỉ lệ cấu hình.
  - Lỗi: sau độ trễ trả `errorStatus` với `MOCK_CHAOS_ERROR`. 429: sau độ trễ trả `RATE_LIMITED` kèm `Retry-After: 1`. Timeout: giữ kết nối tới `latencyMs` max (không có max thì 10 s, luôn ≤ 30 s) rồi trả 504 `MOCK_TIMEOUT`.
  - **Rule khớp thì chỉ áp độ trễ**; lỗi, 429 và timeout của chaos không áp cho response của rule.
  - Chờ bằng timer (không chặn event loop); client ngắt kết nối thì timer bị huỷ và không gửi gì. Mỗi project có tối đa `MAX_DELAYED_PER_PROJECT` (50) request đang chờ; vượt thì trả ngay 429 `RATE_LIMITED` kèm `Retry-After: 1` thay vì giữ thêm kết nối.
- **Hosted Mock MCP** chạy cùng code: rule `query` đọc tham số query của `list_`, rule `body` đọc `data` của `create_`/`update_`, `nth` dùng chung bộ đếm với REST; rule `header` **không bao giờ khớp** qua MCP (tool call không có header riêng). Response của rule là kết quả tool nguyên dạng (status ≥ 400 thành tool error mang body của rule; header của rule không gửi). Chaos áp như REST: độ trễ, rồi lỗi/429/timeout thành tool error với cùng mã (`details.retryAfterSeconds` thay cho `Retry-After`).

## Giới hạn

| Lớp | Giới hạn và nguồn | Vượt thì |
|---|---|---|
| nginx (production) | `limit_req`/`limit_conn` theo IP và `client_max_body_size` trên `*.localman` và `/m/`, `limit_req` theo IP trên `/mcp` (Localman MCP), zone ở [`infra/localman/nginx/localman-http.conf`](../infra/localman/nginx/localman-http.conf) | 429 hoặc 413 do nginx trả, body là trang mặc định của nginx, không theo dạng lỗi của API |
| Rate limit của app | Cửa sổ cố định 1 giây trong bộ nhớ process, kiểm theo thứ tự IP (IPv6 gộp /64) → secret → lượt ghi của secret → byte response của secret, trước khi đọc body (`MockLimiters` trong `modules/mock-runtime/rate-limit.ts`). Mặc định ở `DEFAULT_MOCK_RATE_LIMITS` (`mock-server.ts`), ghi đè bằng `MOCK_RATE_LIMIT_PER_IP`, `MOCK_RATE_LIMIT_PER_SECRET`, `MOCK_WRITE_RATE_LIMIT_PER_SECRET`, `MOCK_RESPONSE_BYTES_PER_SECOND` (`config/feature-env.ts`) | 429 `RATE_LIMITED` kèm `Retry-After` |
| Ngân sách byte | Request bị từ chối khi giây hiện tại đã tiêu hết ngân sách; response bắt đầu trong ngân sách được gửi trọn. List tính số lớn hơn giữa byte gửi đi và byte collection đã quét, nên lượt lọc không ra kết quả vẫn tốn ngân sách | 429 `RATE_LIMITED` |
| Hạn mức tháng | Theo **chủ project**: `limitsFor(plan hiệu lực).mockRequestsPerMonth` ([`packages/shared/src/plan-limits.ts`](../packages/shared/src/plan-limits.ts)); `null` là không giới hạn, Pro hết hạn tính như Free, tháng theo giờ Asia/Saigon. Mọi request đã qua rate limit và trỏ tới project có thật đều được tính, kể cả 404 trong project | 429 `MONTHLY_QUOTA_EXCEEDED`, không có `Retry-After` |
| Body request | `MAX_JSON_BODY_KB` (`packages/shared/src/mock-query.ts`); độ sâu và số giá trị theo `DEFAULT_JSON_LIMITS` (`packages/shared/src/json-value.ts`) | 413 `PAYLOAD_TOO_LARGE`; 400 `VALIDATION_ERROR` |
| Số bản ghi | `MAX_RECORDS_PER_RESOURCE` (`packages/shared/src/resource-constants.ts`) | 409 `RECORD_LIMIT_REACHED` |
| Kích thước dữ liệu | `MAX_RECORD_BYTES` mỗi bản ghi, `MAX_RESOURCE_BYTES` mỗi resource (`plan-limits.ts`, mọi gói) | 413 `DATA_TOO_LARGE` |
| Kích thước response | `MAX_RESPONSE_BYTES`, bằng `MAX_RESOURCE_BYTES` (`render-response.ts`); field quan hệ bị chặn trong lúc nạp (`relation-budget.ts`) | 422 `RESPONSE_TOO_LARGE` |

Rate limit, bộ đếm tháng và cache chỉ chính xác khi mock runtime chạy một process; vì vậy production chạy một instance pm2 (xem [deployment-guide.md](deployment-guide.md)). Giới hạn thao tác nặng trong `config/runtime-settings.ts` (`heavyOperationRateLimit`) thuộc dashboard API, không áp cho mock runtime.

## MCP

Hosted Mock MCP (`modules/mcp/mock-mcp-server.ts`, mount trước router REST trong `mock-server.ts`): transport Streamable HTTP, protocol 2026-07-28 (request kiểu 2025 được phục vụ stateless).

| Dạng | URL |
|---|---|
| Subdomain | `https://{secret}.localman.hoandat.com{prefix}/mcp` |
| Fallback | `https://localman.hoandat.com/m/{secret}{prefix}/mcp` |

- **Tool:** `list_`, `get_`, `create_`, `update_`, `delete_<res>` cho mọi resource (kể cả lồng), chỉ khi endpoint REST tương ứng đang bật (`buildMockTools` trong `modules/mcp/mock-tool-factory.ts`, tên từ `packages/shared/src/mock-tool-names.ts`). Danh sách tool cache theo secret và revision của cây resource (`mock-mcp-tools-cache.ts`), đổi cây là có hiệu lực ở request kế tiếp.
- **Ngữ nghĩa:** tool chạy đúng code CRUD/query của REST trên cùng store, nên ghi qua MCP thì REST thấy ngay. Resource lồng nhận `parentId` (id bản ghi cha trực tiếp); runtime đi ngược `parentRecordId` để dựng route lồng, có `parentId` thì như route lồng (cha sai hoặc thiếu là `NOT_FOUND`), không có thì như route phẳng; `create_` của resource lồng bắt buộc `parentId`. `list_` nhận tham số query như REST (tên chính trong `MOCK_QUERY_PARAMS`) và filter theo field.
- **Kết quả:** JSON thuần trong `structuredContent` (kèm bản text): `list_` trả `{ items, total }` (`total` là số bản ghi sau lọc, trước phân trang), tool khác trả bản ghi. Custom response **không** áp cho MCP; rules và chaos thì có, xem [Rules và chaos](#rules-và-chaos). Lỗi là tool error (`isError`) mang đúng body `{ error: { code, message, details? } }` của REST; 404 là `NOT_FOUND` thay cho chuỗi `"Not found"`.
- **Resources:** `mock://schema` (cây resource, route lồng, schema hoặc template, endpoint, tool của từng resource) và `mock://openapi` (OpenAPI 3.1 sinh từ resource và endpoint đang bật, `modules/mcp/mock-openapi.ts`).
- **Giới hạn:** request tới `…/mcp` qua cùng rate limit như REST nhưng tính như lượt đọc; ngoài ra **mỗi tool call** được xét lại theo IP, theo secret và ngân sách byte của secret (tool ghi `create_`, `update_`, `delete_` lấy thêm một lượt ghi), nên một tool call tính hai lượt vào hạn mức mỗi giây. Mỗi tool call tính **1 request** vào `mockRequestsPerMonth` của chủ project và cập nhật `lastRequestAt` như REST (`initialize`, `tools/list`, đọc resource không tính). Body JSON-RPC theo `MAX_JSON_BODY_KB`; byte kết quả trừ vào ngân sách byte của secret, trần response như REST. Vượt thì tool error `RATE_LIMITED` (`details.retryAfterSeconds`) hoặc `MONTHLY_QUOTA_EXCEEDED`.
- **Một message mỗi request:** body là mảng (JSON-RPC batch, MCP bỏ từ 2025-06-18) bị từ chối 400 với lỗi JSON-RPC `-32600` trước khi tới SDK. `subscriptions/listen` bị từ chối (HTTP 200, lỗi JSON-RPC `-32601`): danh sách tool chỉ đổi khi cây resource đổi, server khai `listChanged: false`; client gọi lại `tools/list`.
- **Token tuỳ chọn** ("Yêu cầu token cho MCP", mọi gói): bật thì `/mcp` cần `Authorization: Bearer lmmcp_…`; thiếu hoặc sai trả 401 `UNAUTHENTICATED` kèm `WWW-Authenticate: Bearer realm="localman-mock-mcp"` (thêm `error="invalid_token"` khi có gửi token). REST không bị ảnh hưởng. Token là `lmmcp_` + 32 byte base64url, chỉ lưu SHA-256, 4 ký tự cuối và thời điểm tạo (`modules/mcp/mcp-token-model.ts`), chỉ trả một lần lúc tạo. Quản lý bằng operation owner-only (`modules/mcp/mcp-token-operations.ts`): `GET`/`PUT /api/v1/projects/:projectId/mcp-token` (`mock.getMcpTokenSettings`, `mock.setMcpTokenRequired`) và `POST …/mcp-token/rotate` (`mock.rotateMcpToken`, có `dryRun`, tool MCP cần `confirm_token`). Xoá project thì token bị xoá; clone không mang theo token.

## Mã lỗi

Lỗi theo dạng `{ "error": { "code", "message", "details"? } }`, trừ 404 `"Not found"`: body là đúng chuỗi JSON đó, giống mockapi.io (bản gốc mà mock runtime sao chép).

| HTTP | Body / mã | Khi nào | Nguồn |
|---|---|---|---|
| 400 | `INVALID_QUERY` | Tên query không an toàn, tham số lặp, `sortBy` không an toàn | `modules/mock-runtime/query-engine.ts` |
| 400 | `INVALID_JSON` | Body khai báo JSON nhưng parse lỗi | `BODY_ERRORS` trong `http/error-handler.ts` |
| 400 | `VALIDATION_ERROR` | Body không phải object, có key cấm, vượt `DEFAULT_JSON_LIMITS`; `{parent}Id` không trỏ tới bản ghi cha có thật trên route phẳng | `record-body.ts`, `new-record.ts` |
| 400 | `BAD_REQUEST` | Request bị ngắt khi đang gửi body, hoặc lỗi client khác của Express | `http/error-handler.ts` |
| 401 | `UNAUTHENTICATED` | MCP endpoint bật token mà thiếu hoặc sai Bearer token; kèm `WWW-Authenticate` | `modules/mcp/mock-mcp-auth.ts` |
| 404 | `"Not found"` (chuỗi) | Secret đúng định dạng nhưng không có project còn sống; path ngoài prefix; không khớp resource, bản ghi hoặc tổ tiên; endpoint tắt; method không phục vụ route | `NOT_FOUND_BODY` trong `modules/mock-runtime/mock-router.ts` |
| 404 | `NOT_FOUND` | Request không trỏ tới project nào (secret sai định dạng, path hỏng) | `notFoundHandler` trong `http/error-handler.ts` |
| 409 | `RECORD_LIMIT_REACHED` | POST khi resource đã đủ bản ghi; `details.max` | `crud-handlers.ts` |
| 413 | `PAYLOAD_TOO_LARGE` | Body vượt `MAX_JSON_BODY_KB` | `http/error-handler.ts` |
| 413 | `DATA_TOO_LARGE` | Bản ghi hoặc resource vượt trần byte; `details` có `limit`, `maxBytes`, `actualBytes`, `resourceId`, `name` | `modules/resources/data-size.ts`, `modules/mock-runtime/data-bytes.ts` |
| 415 | `UNSUPPORTED_MEDIA_TYPE` | `Content-Encoding` hoặc charset không đọc được; POST tới MCP endpoint không phải JSON | `http/error-handler.ts`, `modules/mcp/mcp-express-bridge.ts` |
| 422 | `RESPONSE_TOO_LARGE` | Response sẽ vượt trần; `details` có `maxBytes`, `actualBytes` | `render-response.ts`, `relation-budget.ts` |
| 422 | `TEMPLATE_TOO_DEEP` | Template đã lưu vượt `TEMPLATE_LIMITS` hiện hành (chỉ xảy ra nếu giới hạn bị hạ sau khi lưu, vì lúc lưu đã kiểm cùng giới hạn) | `render-response.ts` |
| 429 | `RATE_LIMITED` | Vượt một mức rate limit; chaos `rateLimitRate`; vượt `MAX_DELAYED_PER_PROJECT` request đang chờ chaos; kèm `Retry-After` | `modules/mock-runtime/rate-limit.ts`, `mock-behavior.ts` |
| 429 | `MONTHLY_QUOTA_EXCEEDED` | Chủ project hết hạn mức tháng | `mock-router.ts` |
| 400–599 | `MOCK_CHAOS_ERROR` | Chaos `errorRate` của endpoint, status theo `errorStatus` | `modules/mock-runtime/mock-behavior.ts` |
| 504 | `MOCK_TIMEOUT` | Chaos `timeoutRate`: giữ kết nối tới `latencyMs` max (hoặc 10 s) rồi trả | `modules/mock-runtime/mock-behavior.ts` |
| 499 | `REQUEST_CANCELLED` | Chỉ qua Mock MCP: client đóng tool call khi đang chờ độ trễ chaos; tool error, không có gì thay đổi | `modules/mcp/mock-tool-behavior.ts` |
| tuỳ rule | body của rule | Rule khớp: status, header và body theo cấu hình endpoint | `modules/mock-runtime/mock-behavior.ts` |
| 500 | `INTERNAL_ERROR` | Lỗi không lường trước; không có chi tiết hay stack | `mock-router.ts`, `http/error-handler.ts` |

Bảng mã lỗi cho người dùng cuối: `apps/web/src/pages/docs/status-codes.tsx` (đọc hằng từ `@localman/shared/constants`). Thêm hoặc bỏ mã thì sửa cả hai.

## Bảo mật

- **Tên query:** bắt đầu bằng `$`, chứa `.`, `[` hoặc `]` (parser "simple" của Express giữ nguyên `title[$ne]` làm tên key), hoặc là một key trong `FORBIDDEN_KEYS` (`__proto__`, `constructor`, `prototype`; `packages/shared/src/json-value.ts`) đều trả 400 `INVALID_QUERY` trước khi chạm DB. Cùng quy tắc áp cho giá trị của tham số sort (`isUnsafeName` trong `query-engine.ts`). Giá trị lặp (`a=1&a=2`) cũng bị từ chối. Mọi lượt đọc field dùng `Object.hasOwn`.
- **Key trong body:** key thuộc `FORBIDDEN_KEYS` ở mọi tầng trả 400 `VALIDATION_ERROR`; object được dựng lại từ thuộc tính riêng nên không chạm prototype. Key bắt đầu bằng `$` hoặc chứa `.` **được nhận** như dữ liệu: runtime ghi cả object `data` bằng driver gốc, không bao giờ dựng filter hay đường dẫn update Mongo từ key của người dùng, nên các key đó không thành toán tử. Hệ quả: field có tên chứa `.` lưu và trả về được nhưng không lọc được qua query.
- **Template:** chỉ thay tham chiếu nguyên chuỗi; Faker gọi qua whitelist id tra bằng `Map`, không có đường chạy code tuỳ ý.
- **CORS:** `*` không credentials, nên trình duyệt không gửi cookie của Localman tới mock.
- **Log:** không ghi header, cookie, body hay query; secret trong path chỉ còn 4 ký tự đầu, secret trong Host không bao giờ được ghi (`maskSecret`, `mockRouteOf` trong `mock-http.ts`). Access log của nginx dùng format che secret (xem [deployment-guide.md](deployment-guide.md)).
