# Operation registry

Mọi tính năng nghiệp vụ của Localman phải có REST API, MCP tool và tài liệu OpenAPI. Để ba thứ này không lệch nhau, mỗi API được khai báo **một lần** bằng `defineOperation` trong `@localman/operations`. Từ khai báo đó, hệ thống sinh ra:

| Đầu ra | Hàm | Dùng ở |
|---|---|---|
| Route Express có validate và check quyền | `createOperationRouter(operations, { resolveAuth })` | `apps/api/src/dashboard-server.ts`, mount dưới `/api/v1` |
| MCP tool descriptor (JSON Schema lấy từ zod) | `toMcpToolDescriptor(op)` | MCP server (phase 17) |
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
- Operation `GET` phải `readOnly`, vì trình duyệt gửi cookie cả khi điều hướng GET từ site khác.

Khi dựng router, `createOperationRouter` ném lỗi nếu hai operation trùng `id`, trùng `METHOD path` hoặc trùng tên MCP tool. Server vì vậy không khởi động được với registry có xung đột.

## Xử lý một request

Thứ tự trong router: xác thực → check scope (401 `UNAUTHENTICATED`, 403 `FORBIDDEN`) → `guard` (403) → đọc `dryRun` và validate input (400 `VALIDATION_ERROR`) → `policy` (403) → `handler` → validate output (sai schema thì 500).

- `guard(ctx)` (tuỳ chọn) chỉ thấy `{ auth, clientIp }`, dùng cho điều kiện không cần input như "chỉ owner". Vì chạy trước khi parse input, người bị từ chối luôn nhận 403 và không dò được gì qua lỗi validate. `policy(ctx, input)` dùng cho quyền theo tài nguyên, cần input đã parse.

- **Nguồn input:** `GET` lấy input từ query string và path params. Các method khác chỉ lấy từ JSON body và path params, không đọc query. Request có body mà `Content-Type` không phải `application/json` bị trả 415 `UNSUPPORTED_MEDIA_TYPE`. Nhờ vậy form submit từ site khác (không qua preflight CORS) không gọi được mutation.
- Path params được ưu tiên cao nhất để body không ghi đè được tham số trên route.
- Giá trị query và path param của field kiểu number/integer/boolean được chuyển kiểu theo JSON Schema trước khi validate, để `?limit=5` khớp với tài liệu OpenAPI.
- `handler` và `policy` nhận `ctx = { auth, dryRun, clientIp }`, không phụ thuộc transport, nên MCP server dùng lại được nguyên handler. `clientIp` là địa chỉ của bên gọi do transport xác định (qua HTTP là `req.ip` của Express, tôn trọng `TRUST_PROXY`), `null` khi không biết; chỉ dùng cho hạn mức theo client (rate limit, Turnstile `remoteip`), không dùng để phân quyền.
- Operation có `dryRun` nhận `?dryRun=true` qua HTTP; handler phải chỉ xem trước, không ghi dữ liệu. Gửi `?dryRun` tới operation không hỗ trợ thì bị trả 400, thay vì âm thầm ghi thật.
- ZodError do handler tự ném (khi parse dữ liệu phía server) trả 500, không phải 400.
- `OperationError` có thể kèm `details`: mảng `{ path, message }` cho lỗi validate, hoặc một object phẳng cho lỗi nghiệp vụ, ví dụ 403 `PLAN_LIMIT_REACHED` kèm `{ limit: "projects", max, used }`.
- Operation chỉ dành cho owner của deployment (toolset `admin`) khai `guard: ownerOnly` (`apps/api/src/modules/users/owner-access.ts`, đọc `OWNER_SUBS`); user khác nhận 403 `FORBIDDEN`.
- `resolveAuth` đọc cookie phiên (`__Host-lm_session`, hoặc `lm_session` khi `PUBLIC_URL` là http) và trả `{ subjectId: sub, scopes: ["user"], sessionId }`; không có phiên thì `null`. `user` (`USER_SCOPE` trong `apps/api/src/http/require-auth.ts`) là scope nội bộ của user đăng nhập bằng trình duyệt; operation của user khai `scopes: [USER_SCOPE]` và lấy `sub` bằng `requireSubject(ctx)`. Access token sắp hết hạn được refresh ngay trong bước này, user không thấy.
- Mọi response dưới `/api/v1` có `Cache-Control: no-store`, vì dữ liệu là của từng user.
- **CSRF:** mọi request không phải GET/HEAD/OPTIONS tới dashboard phải có `Origin` bằng `PUBLIC_URL`/`WEB_ORIGIN` hoặc `Sec-Fetch-Site: same-origin`, sai thì 403 `CSRF_REJECTED`. Kiểm trước khi parse body. Mock runtime nằm ở subdomain cùng site nên SameSite=Strict của cookie chưa đủ.

## Kiểm tra coverage trong CI

`pnpm check:mcp-coverage` nạp registry của api và gọi `findMcpCoverageViolations`. Script exit 1 khi có operation thiếu MCP mà không có `exempt` kèm lý do, hoặc khi trùng `id`, route hay tên tool. Tên tool là bản snake_case của phần sau dấu chấm, ví dụ `mock.listUsers` thành `list_users` (theo cách đặt tên tool ở phase 17). Vì tên tool không có tiền tố toolset, động từ và danh từ phải duy nhất trên toàn registry.

Để chạy với registry khác (dùng trong test): `pnpm check:mcp-coverage <đường-dẫn-registry>` hoặc đặt biến `MCP_COVERAGE_REGISTRY`.

## Ngoại lệ: route giao thức ngoài registry

Một số route nói giao thức (OpenID Connect) với trình duyệt hoặc với IdP, không phải API nghiệp vụ, nên viết tay và không có MCP tool. Chúng được liệt kê trong `apps/api/src/operations/protocol-routes.ts` kèm lý do; `pnpm check:mcp-coverage` in danh sách này sau dòng `MCP coverage OK`, và `protocol-routes.test.ts` kiểm danh sách khớp với route thật.

| Route | Lý do miễn MCP |
|---|---|
| `GET /auth/login?returnTo=&prompt=create` | luồng redirect OIDC trên trình duyệt |
| `GET /auth/callback` | luồng redirect OIDC trên trình duyệt |
| `POST /auth/logout` | luồng redirect OIDC trên trình duyệt |
| `POST /auth/backchannel-logout` | IdP gọi server-to-server (OIDC Back-Channel Logout), không phải thao tác của user; miễn kiểm CSRF vì logout token đã ký là bằng chứng xác thực |
| `POST /internal/audit-events` | IdP đẩy sự kiện audit server-to-server (SET ký ES256 + HTTP Basic), không phải thao tác của user; miễn kiểm CSRF vì xác thực bằng Basic và chữ ký |

Operation có `mcp: { exempt }` vì chỉ trình duyệt dùng được:

- `notifications.getVapidPublicKey`, `notifications.createPushSubscription`, `notifications.deletePushSubscription`: subscription Web Push do service worker tạo, agent không có push endpoint.
- `feedback.submitProInterest`, `feedback.getProInterestFormConfig`: form quan tâm gói Pro là form công khai cho người. Khách phải qua Cloudflare Turnstile (agent không giải được), và việc để lại email liên hệ phải do chính người đó đồng ý.
