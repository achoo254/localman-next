# Operation registry

Mọi tính năng nghiệp vụ của Localman phải có REST API, MCP tool và tài liệu OpenAPI. Để ba thứ này không lệch nhau, mỗi API được khai báo **một lần** bằng `defineOperation` trong `@localman/operations`. Từ khai báo đó, hệ thống sinh ra:

| Đầu ra | Hàm | Dùng ở |
|---|---|---|
| Route Express có validate và check quyền | `createOperationRouter(operations, { resolveAuth })` | `apps/api/src/dashboard-server.ts`, mount dưới `/api/v1` |
| MCP tool descriptor (JSON Schema input/output lấy từ zod, scope token cần có) | `toMcpToolDescriptor(op)` | `createOperationMcpServer` trong `apps/api/src/modules/mcp/` |
| Bảng operation → tool theo toolset (markdown) | `renderMcpToolTable(operations)` | `pnpm check:mcp-coverage [--markdown <path>]` |
| Tài liệu OpenAPI 3.1 | `buildOpenApiDocument(operations, info, servers)` | `GET /api/v1/openapi.json` |

**Quy tắc:** từ phase 02 trở đi, không viết route Express tay cho nghiệp vụ. Hạ tầng như `/healthz` không thuộc diện này.

## Khai báo

```ts
import { defineOperation } from "@localman/operations";
import { z } from "zod";

export const getProject = defineOperation({
	id: "mock.getProject",            // <toolset>.<camelVerbNoun>, prefix phải bằng toolset
	method: "GET",
	path: "/projects/:projectId",     // mỗi :param phải có trong input
	summary: "Get one project",       // bắt buộc khi có MCP tool: agent cần mô tả để chọn tool
	input: z.object({ projectId: z.string() }),
	output: z.object({ id: z.string(), name: z.string() }),
	scopes: ["projects:read"],        // cần đủ mọi scope; mảng rỗng là route công khai
	policy: (ctx, input) => true,     // check quyền theo tài nguyên (tuỳ chọn)
	annotations: { readOnly: true, destructive: false, idempotent: true },
	toolset: "mock",
	mcp: true,                        // hoặc { exempt: "<lý do>" }
	handler: async (ctx, input) => ({ id: input.projectId, name: "Demo" }),
});
```

Sau đó thêm operation vào mảng `operations` trong `apps/api/src/operations/registry.ts`.

## Luật kiểm lúc khai báo

`defineOperation` ném lỗi ngay lúc import nếu khai báo sai:

- `id` có dạng `<toolset>.<camelVerbNoun>`, prefix bằng `toolset`, và `toolset` thuộc danh sách `TOOLSETS`.
- `input` là `z.object` vì params, query và body được gộp thành một object; input phải chuyển được sang JSON Schema (ví dụ `z.date()` bị chặn).
- Path chỉ có đoạn tĩnh và `:param`.
- `mcp: { exempt }` phải có lý do không rỗng; tool MCP phải có `summary` hoặc `description`.
- Operation `destructive` bắt buộc `dryRun: true` và không được công khai (`scopes` rỗng); không được vừa `readOnly` vừa `destructive`.
- `requiresConfirmation: true` (tool MCP phải qua dry run và `confirm_token`) chỉ hợp lệ khi có `dryRun: true`.
- Operation tạo credential (PAT, secret service account, access key; secret chỉ trả một lần) khai `createsCredential: true`; không được `readOnly` hay công khai. MCP tool của nó cần thêm scope token `credentials:write`.
- Operation `GET` phải `readOnly`, vì trình duyệt gửi cookie cả khi điều hướng GET từ site khác.

Khi dựng router, `createOperationRouter` ném lỗi nếu hai operation trùng `id`, trùng `METHOD path` hoặc trùng tên MCP tool. Server vì vậy không khởi động được với registry có xung đột.

## Xử lý một request

Thứ tự trong router: xác thực → check scope (401 `UNAUTHENTICATED`, 403 `FORBIDDEN`) → `guard` (403) → đọc `dryRun` và validate input (400 `VALIDATION_ERROR`) → `policy` (403) → `handler` → validate output (sai schema thì 500).

- `guard(ctx)` (tuỳ chọn) chỉ thấy `{ auth, clientIp }`, dùng cho điều kiện không cần input như "chỉ owner". Vì chạy trước khi parse input, người bị từ chối luôn nhận 403 và không dò được gì qua lỗi validate. `policy(ctx, input)` dùng cho quyền theo tài nguyên, cần input đã parse.

- **Nguồn input:** `GET` lấy input từ query string và path params. Các method khác chỉ lấy từ JSON body và path params, không đọc query. Request có body mà `Content-Type` không phải `application/json` bị trả 415 `UNSUPPORTED_MEDIA_TYPE`. Nhờ vậy form submit từ site khác (không qua preflight CORS) không gọi được mutation.
- Path params được ưu tiên cao nhất để body không ghi đè được tham số trên route.
- Giá trị query và path param của field kiểu number/integer/boolean được chuyển kiểu theo JSON Schema trước khi validate, để `?limit=5` khớp với tài liệu OpenAPI.
- REST và MCP chạy cùng một hàm `executeOperation` (scope → `guard` → đọc và validate input → `policy` → `handler` → validate output), nên hai transport không lệch nhau.
- `handler` và `policy` nhận `ctx = { auth, dryRun, clientIp, signal? }`, không phụ thuộc transport, nên MCP server dùng lại được nguyên handler. `clientIp` là địa chỉ của bên gọi do transport xác định (qua HTTP là `req.ip` của Express, tôn trọng `TRUST_PROXY`), `null` khi không biết; chỉ dùng cho hạn mức theo client (rate limit, Turnstile `remoteip`), không dùng để phân quyền. `signal` (tuỳ chọn) abort khi bên gọi bỏ đi: qua HTTP là khi response đóng trước khi gửi xong (client ngắt kết nối; không dựa vào `req` "close" vì Node phát sự kiện đó ngay khi đọc xong body), qua MCP là signal của request MCP. Handler chạy lâu hoặc gọi ra ngoài (proxy của API client) truyền nó xuống để huỷ việc đang làm.
- Operation có `dryRun` nhận `?dryRun=true` qua HTTP; handler phải chỉ xem trước, không ghi dữ liệu. Gửi `?dryRun` tới operation không hỗ trợ thì bị trả 400, thay vì âm thầm ghi thật.
- Body JSON tối đa 100 KB. Operation cần nhiều hơn khai `bodyLimit` (byte, chỉ cho method có body); dashboard gắn parser có giới hạn đó cho đúng `METHOD path` của nó, sau CSRF guard và trước parser mặc định, nên route khác không được nới. Operation có scope được kiểm phiên trước parser lớn (ẩn danh nhận 401 mà body không bị đọc); router kiểm phiên thêm lần nữa như mọi route. Ví dụ: `PUT …/resources/:resourceId/data` (2,5 MB, đủ cho trần 2 MB dữ liệu của một resource).
- ZodError do handler tự ném (khi parse dữ liệu phía server) trả 500, không phải 400.
- `OperationError` có thể kèm `details`: mảng `{ path, message }` cho lỗi validate, hoặc một object phẳng cho lỗi nghiệp vụ, ví dụ 403 `PLAN_LIMIT_REACHED` kèm `{ limit: "projects", max, used }`.
- Operation chỉ dành cho owner của deployment (toolset `admin`) khai `guard: ownerOnly` (`apps/api/src/modules/users/owner-access.ts`, đọc `OWNER_SUBS`); user khác nhận 403 `FORBIDDEN`.
- `resolveAuth` đọc cookie phiên (`__Host-lm_session`, hoặc `lm_session` khi `PUBLIC_URL` là http) và trả `{ subjectId: sub, scopes: ["user"], sessionId }`; không có phiên thì `null`. `user` (`USER_SCOPE` trong `apps/api/src/http/require-auth.ts`) là scope nội bộ của user đăng nhập bằng trình duyệt; operation của user khai `scopes: [USER_SCOPE]` và lấy `sub` bằng `requireSubject(ctx)`. Access token sắp hết hạn được refresh ngay trong bước này, user không thấy.
- Mọi response dưới `/api/v1` có `Cache-Control: no-store`, vì dữ liệu là của từng user.
- **CSRF:** mọi request không phải GET/HEAD/OPTIONS tới dashboard phải có `Origin` bằng `PUBLIC_URL`/`WEB_ORIGIN` hoặc `Sec-Fetch-Site: same-origin`, sai thì 403 `CSRF_REJECTED`. Kiểm trước khi parse body. Mock runtime nằm ở subdomain cùng site nên SameSite=Strict của cookie chưa đủ.

## Kiểm tra coverage trong CI

`pnpm check:mcp-coverage` nạp registry của api và gọi `findMcpCoverageViolations`. Script exit 1 khi có operation thiếu MCP mà không có `exempt` kèm lý do, hoặc khi trùng `id`, route hay tên tool. Tên tool là bản snake_case của phần sau dấu chấm, ví dụ `mock.listUsers` thành `list_users` (theo cách đặt tên tool ở phase 17). Vì tên tool không có tiền tố toolset, động từ và danh từ phải duy nhất trên toàn registry.

Để chạy với registry khác (dùng trong test): `pnpm check:mcp-coverage <đường-dẫn-registry>` hoặc đặt biến `MCP_COVERAGE_REGISTRY`.

Khi sạch, script in bảng operation → tool theo toolset (markdown: tên tool, route, hint, scope token, cách xác nhận, mô tả ngắn; operation `exempt` kèm lý do). `--markdown <path>` ghi thêm bảng đó ra file (trang docs "MCP tools").

## MCP tool sinh từ operation

`createOperationMcpServer` (`apps/api/src/modules/mcp/operation-mcp-server.ts`) biến mỗi operation `mcp: true` thành một tool:

- Scope token MCP: `<toolset>:read` cho operation `readOnly`, ngược lại `<toolset>:write`, cộng `credentials:write` khi `createsCredential`. Riêng `mock-advanced` và `traffic` dùng scope của `mock` (`mock:read`/`mock:write`, `scopeAreaOf`), nên token OAuth của IdP (chỉ cấp `mock:*`, `client:*`) mở được chúng; Localman MCP cho OAuth với tới `mock`, `mock-advanced`, `traffic`, `client` (`OAUTH_TOOLSETS`). `scopes` của operation vẫn được kiểm với `auth` như REST.
- Toolset: mặc định `mock` và `client` (`DEFAULT_TOOLSETS`), chọn khác qua `?toolsets=a,b` (`parseToolsetsParam`) hoặc meta-tool `list_toolsets`, `enable_toolset` (gửi `notifications/tools/list_changed`).
- Operation có `dryRun` nhận tham số `dry_run` (tuỳ chọn). Tool `destructive` vẫn chạy thẳng, chỉ gắn `destructiveHint`.
- Operation ảnh hưởng nhiều thứ khai thêm `requiresConfirmation: true` (cần `dryRun: true`, `defineOperation` và CI kiểm với mã `CONFIRMATION_WITHOUT_DRY_RUN`). Tool của nó bắt buộc gọi `dry_run=true` trước; kết quả kèm `confirm_token` (HMAC trên user, tool và input đã chuẩn hoá, sống 5 phút, dùng một lần). Lần gọi thật thiếu hoặc sai token nhận `CONFIRMATION_REQUIRED`, `CONFIRM_TOKEN_INVALID`, `CONFIRM_TOKEN_EXPIRED` hoặc `CONFIRM_TOKEN_USED`. Đang bật cho đúng 7 tool: `mock.deleteProject`, `mock.deleteResource` (xoá cả cây con), `mock.generateAllResourceData`, `mock.resetAllResourceData`, `mock.rotateProjectSecret`, `mock.rotateMcpToken` và `traffic.deleteRequestLogs` (xoá log của mọi member).
- Lỗi trả về là tool error (`isError: true`) với cùng body `{ error: { code, message, details } }` như REST; lỗi không lường trước thành `INTERNAL_ERROR` và chỉ ghi log.

## Ngoại lệ: route giao thức ngoài registry

Một số route nói giao thức (OpenID Connect, OAuth metadata, MCP) với trình duyệt, agent hoặc IdP, không phải API nghiệp vụ, nên viết tay và không có MCP tool riêng. Chúng được liệt kê trong `apps/api/src/operations/protocol-routes.ts` kèm server (`dashboard`/`mock`) và lý do; `pnpm check:mcp-coverage` in danh sách này sau dòng `MCP coverage OK` (dạng `[server] METHOD path: lý do`, `ALL` là mọi method tới handler), và `protocol-routes.test.ts` kiểm danh sách khớp với route mà router auth và router Localman MCP thật sự mount.

| Route | Lý do miễn MCP |
|---|---|
| `GET /auth/login?returnTo=&prompt=create` | luồng redirect OIDC trên trình duyệt |
| `GET /auth/callback` | luồng redirect OIDC trên trình duyệt |
| `POST /auth/logout` | luồng redirect OIDC trên trình duyệt |
| `POST /auth/backchannel-logout` | IdP gọi server-to-server (OIDC Back-Channel Logout), không phải thao tác của user; miễn kiểm CSRF vì logout token đã ký là bằng chứng xác thực |
| `POST /internal/audit-events` | IdP đẩy sự kiện audit server-to-server (SET ký ES256 + HTTP Basic), không phải thao tác của user; miễn kiểm CSRF vì xác thực bằng Basic và chữ ký |
| `ALL /mcp` | chính là endpoint MCP: tool của nó là các operation trong registry |
| `GET`/`OPTIONS /.well-known/oauth-protected-resource` (và `…/mcp`) | Protected Resource Metadata (RFC 9728) công khai để agent tìm IdP trước khi có token |
| `ALL /m/{secret}/{prefix}/mcp` (mock runtime, cả `{secret}.{MOCK_BASE_DOMAIN}/{prefix}/mcp`) | endpoint Hosted Mock MCP: tool sinh từ resource của project |
| `GET /api/v1/projects/:projectId/request-logs/stream` | log request trực tiếp (SSE) của project: luồng không có một câu trả lời JSON cho REST hay MCP tool; agent đọc log qua `list_request_logs` và `get_request_log`. Mount trong `dashboard-server.ts` trước router operation, `protocol-routes.test.ts` kiểm cùng router auth và MCP |

Operation có `mcp: { exempt }` vì chỉ trình duyệt dùng được:

- `notifications.getVapidPublicKey`, `notifications.createPushSubscription`, `notifications.deletePushSubscription`: subscription Web Push do service worker tạo, agent không có push endpoint.
- `mock.previewInvite`, `mock.acceptInvite`: người được mời mở link `/invite/:token` trên trình duyệt; nhận lời mời là quyết định của chính người đó, không phải của agent.
- `feedback.submitProInterest`, `feedback.getProInterestFormConfig`: form quan tâm gói Pro là form công khai cho người. Khách phải qua Cloudflare Turnstile (agent không giải được), và việc để lại email liên hệ phải do chính người đó đồng ý.
- `feedback.submitContactMessage`: form "Góp ý / Liên hệ" là form công khai cho người. Khách phải qua Cloudflare Turnstile (widget khai action `contact`, agent không giải được), và góp ý gửi owner phải do chính người dùng viết. Hộp thư của owner (`admin.listContactMessages`, `admin.updateContactMessageStatus`) có MCP tool.
- `client.recordHistory`: trình duyệt ghi history sau mỗi lần gửi; tool `send_request` tự ghi history của nó.
- `client.listDrafts`, `client.saveDraft`, `client.reorderDrafts`, `client.deleteDraft`: trạng thái tab của giao diện API client.
- `client.rememberRoutingHost`, `client.forgetRoutingHost`: chỉ đường gửi thẳng của trình duyệt dùng; tool `send_request` luôn đi qua proxy.
- `traffic.setProjectUpstream`: đổi nơi mock chuyển tiếp request của người gọi (kèm `Authorization`, cookie) sang URL hay tunnel khác; cùng lý do với tunnel mapping bên dưới, chỉ owner đổi từ giao diện. Đọc thiết lập (`traffic.getTrafficSettings`) có tool MCP.
- `traffic.setRedactHeaders`: danh sách header bị che trong log request. Agent bị prompt injection có thể gỡ tên header bí mật khỏi danh sách rồi đọc giá trị thật của các request sau qua `get_request_log`, nên chỉ owner đổi từ giao diện. Danh sách đọc được qua `get_traffic_settings`.
- `traffic.setWebhookInboxForward`, `traffic.setResourceCallbacks`, `traffic.testResourceCallback`: đổi nơi webhook nhận được (header, body của bên gửi) hoặc bản ghi của project được gửi ra ngoài (URL https, tunnel của owner, header tuỳ chỉnh); "Gửi thử" gửi tới đích lấy từ input. Cùng lý do với upstream, chỉ owner làm từ giao diện. Tạo, sửa response, xoá inbox (`create_webhook_inbox`, `update_webhook_inbox`, `delete_webhook_inbox`) và đọc inbox, callback (`list_webhook_inboxes`, `get_resource_callbacks`) có tool MCP.
- `client.updateClientSettings`, `client.setTunnelMapping`, `client.deleteTunnelMapping`, `client.allowSecretProxyHost`, `client.forgetSecretProxyHost`: đổi nơi trình duyệt gửi credential của request (route mặc định `proxy`, URL tunnel, host không cần hỏi trước khi gửi secret qua proxy). Một agent bị prompt injection không được phép chuyển credential đi chỗ khác, nên chỉ user đổi được, từ giao diện. Cả `updateClientSettings` được miễn (kể cả `sendClientIp`) cho gọn, vì `defaultRoute` nằm chung operation. Đọc thiết lập (`client.getClientSettings`) vẫn có tool MCP.
