# UI spec phase 20: Upstream, Request log, Webhook inbox, Mock callback

Nguồn sự thật: `plans/dattqh/261008-1123-localman-core/prototype/index.html`, route `#/projects/demo`, các tab Upstream, Request log, Inbox của card endpoint và mục Callbacks trong modal "Sửa resource · users". Prototype viết tiếng Việt; chuỗi bên dưới là **English (nguồn)**, bản `vi` lấy theo chữ trong prototype, `zh-CN` dịch theo `docs/ux-writing.md` §9. Mọi chữ qua `t()`, namespace mới `traffic` (`apps/web/src/i18n/messages/en/traffic.ts`). Tất cả đều nằm sau cờ `hybridMock`.

Prototype controls mới (chỉ để review): "Xem demo như collaborator" (`proto-controls-view-as-collaborator`), "Request log mất kết nối SSE" (`proto-controls-sse-down`). Port 3000 có ánh xạ tunnel; port khác cho ra trạng thái "chưa gắn".

## 0. Chung

- **Tab card endpoint**: `EndpointTabs` (`pages/project-detail/endpoint-tabs.tsx`) thêm `upstream`, `log`, `inbox` vào `?endpoint=`; `data-id` `project-detail-endpoint-tab-{rest|mcp|upstream|log|inbox}`. `TabsList` đã cuộn ngang; trigger không xuống dòng (prototype đã sửa lỗi "Request log" gãy dòng ở 375px).
- **Quyền**: `canManageTraffic = role === "owner" || role === "editor"`. Hôm nay `Project.role` chỉ có `owner | collaborator`, nên thực tế là chỉ owner. Collaborator xem được hết, không sửa. Ghi chú chỉ đọc: icon khoá + `traffic.readonly.{upstream|inbox|callbacks}`: "You're viewing as a collaborator. Only the project owner or an Editor can {change the upstream | create and delete inboxes | edit callbacks}."
- **Trạng thái tunnel** (`TunnelStatus`, `features/upstream/tunnel-status.tsx`, dùng chung cho upstream, inbox, callback). Tra ánh xạ `localhost:<port>` của owner trong `tunnelMappings` (vòng 28), chỉ mapping đang bật.
  - Đã gắn: icon `plug` màu success, "Mapped: `localhost:{port}` → `{url}`".
  - Chưa gắn (`data-state="missing"`): icon cảnh báo màu warning, "No mapping for `localhost:{port}`. Run `tunelo http {port}`, then map it in Tunelo in the API client." kèm `Link` của router tới `/api-client` (panel Tunelo), không dùng `ExternalLink` vì cùng site. Nút "Copy command" là `CodeBlock wrap` hoặc `Button sm secondary`; `data-id` `{scope}-tunnel-status`, `{scope}-tunnel-status-copy`.
- **Không màu literal**: chỉ token/utility đã map. Badge nguồn: `mock` và `rule` dùng `primary`, upstream `neutral`, inbox `info`, callback `accent`, không khớp `danger`. Badge in hoa (mono uppercase), nên **không** đặt path hay URL vào badge; dùng `<code>`.

## 1. Upstream (`features/upstream/upstream-settings.tsx`)

| Phần | Primitive | `data-id` | en |
|---|---|---|---|
| Tiêu đề + mô tả | `h2` + `p.text-muted` | `project-detail-upstream` | "Upstream for routes the mock doesn't have" / "Routes that match a resource or an enabled endpoint are answered by the mock; every other route is forwarded to the upstream with its method, headers and body. Your frontend needs one base URL: `{baseUrl}`. Responses carry `X-Localman-Source: mock` or `upstream`." |
| Ba lựa chọn | `fieldset` + `legend` sr-only "Choose an upstream", radio native trong thẻ (component cục bộ `UpstreamOption`, chưa có primitive radio card) | `project-detail-upstream-{none|tunnel|url}` | none: "No forwarding: unmatched routes return 404." · tunnel: "A backend on your machine, through your own Tunelo tunnel." · URL: "A deployed backend, such as staging. Public https only." |
| Port (khi chọn tunnel) | `FormField` + `Input type=number` 1–65535 | `project-detail-upstream-port` | "Port" · lỗi "Port must be between 1 and 65535." · sau đó `TunnelStatus` + "If the tunnel stops, forwarded routes get `502 UPSTREAM_UNAVAILABLE` with a command hint." |
| URL (khi chọn url) | `FormField` + `Input` | `project-detail-upstream-url` | "Upstream URL", placeholder `https://staging.example.com` · lỗi client "Enter a public https URL, such as https://staging.example.com." · lỗi SSRF từ API (400) hiện cùng chỗ: "This address points to a private network, so Localman can't forward to it." |
| Lưu | `Button primary` | `project-detail-upstream-save` | "Save upstream" · đang lưu "Saving…" · toast "Upstream set to `{label}`. Routes the mock doesn't have now go there." |
| Đang dùng | `p.text-muted` | `project-detail-upstream-current` | "In use: `{none | tunnel:3000 | https://…}`" |
| Ghi chú hạn mức | `p.text-muted` | — | "Every request to the mock counts toward your mock request quota, forwarded ones included." |

- **Trạng thái**: `none` (mặc định); `tunnel` đã gắn; `tunnel` chưa gắn (vẫn cho lưu, vì người dùng có thể mở tunnel sau); `url` lỗi; collaborator: `fieldset disabled`, ẩn nút Lưu, hiện `project-detail-upstream-readonly`.
- **A11y**: radio là input thật trong label, focus ring trên thẻ (`:focus-visible`); đổi lựa chọn giữ focus ở radio; lỗi gắn `aria-describedby` qua `FormField` và `announceError` khi bấm Lưu.
- **Responsive**: 1 cột dưới 768px, 3 cột từ 768px (`grid-cols-[repeat(3,minmax(0,1fr))]`); code dài dùng `wrap-anywhere`.

## 2. Request log (`features/request-log/`)

**Bố cục**: dòng tiêu đề (nhãn + trạng thái live + Switch "Live" + "Clear log"), thanh lọc, bảng, vùng chi tiết, ghi chú lưu giữ.

| Phần | Primitive | `data-id` | en |
|---|---|---|---|
| Trạng thái live | chấm + chữ mono, `role="status"` | `request-log-status` (`data-state` live / paused / reconnecting) | "Live" · "Paused" · "Connection lost, retrying…" |
| Switch Live | `Switch` `aria-labelledby` | `request-log-live` | "Live" |
| Xoá log | `Button ghost sm` → `ConfirmModal` | `request-log-clear`, modal `modal-clear-log` | "Clear log" / "Clear the whole log of this project?" "Everyone on the project loses these rows. New requests keep being logged." / "Cancel" "Clear log" |
| Lọc | `Select` ×3, `Input type=search`, `Button ghost sm`; khối `role="search"` aria-label "Filter the request log" | `request-log-filter-{method|status|source|path}`, `request-log-filter-clear` | Method / Status / Source / "Path contains" (placeholder `/orders`) · option đầu "All" · status `2xx 3xx 4xx 5xx` · source `Mock Rule Upstream Inbox Callback` · "Clear filters" (disabled khi chưa lọc) |
| Bảng | `<table>` native trong `overflow-x-auto`, `caption` sr-only "Requests to the mock, newest first" | `request-log-table`, dòng `request-log-row` | cột "Time", "Method", "Path", "Source", "Status", "Duration", cột thao tác (sr-only "Actions") |
| Path | `<button>` mở chi tiết, `aria-pressed`, `aria-controls` vùng chi tiết, `title` = path đầy đủ, cắt ellipsis | `request-log-path` | — |
| Replay | `Button ghost sm` icon refresh | `request-log-replay` | "Replay", aria "Replay {method} {path}" · toast "Replayed `{method} {path}` through {the mock | upstream label}." |
| Open in API Client | `Button ghost sm` (tạo tab request phase 10) | `request-log-open-client` | "Open in API Client", aria "Open {method} {path} in the API Client" |
| Chi tiết | `Card` + `Table` header + `CodeBlock` | `request-log-detail`, `request-log-header-{slug}`, `request-log-detail-{body|response|response-body|attempts|inbox|callback}` | "Request headers", "Request body", "Response", dòng meta `{status} · {ms} ms · X-Localman-Source: {mock|upstream}`, badge che "masked", chân "Bodies larger than 64 KB are cut when stored." · chưa chọn: "Pick a request to see its headers, body and response. Sensitive headers are always masked." |
| Lưu giữ | `p.text-muted` | `request-log-retention` | "Logs are kept for {days} days on the {plan} plan. `authorization`, `cookie` and `x-api-key` are always masked. Replay sends the exact request to the mock again and counts toward your quota." (`days` = `limitsFor(plan).requestLogDays`) |

- **Trạng thái**: rỗng hoàn toàn (`request-log-empty`): "No requests yet. Call `GET {baseUrl}/users` and it shows up here right away." · lọc không ra (`request-log-empty-filtered`): "No requests match the filters." + "Clear filters" · live · tạm dừng (Switch tắt, đóng SSE) · mất kết nối (EventSource `onerror`, tự nối lại theo `retry`, giữ dòng cũ) · lỗi tải trang đầu: `Alert danger` "Couldn't load the request log. Try again." + "Try again".
- **Dòng 502 upstream**: status đỏ (`text-error`), body response `{"error":"UPSTREAM_UNAVAILABLE","hint":"tunelo http <port>"}` hiện trong chi tiết.
- **Dòng inbox**: badge "Inbox · {name}", chi tiết thêm "Inbox `{name}`, forwarded to `{target}`" (hoặc ", not forwarded") và danh sách lần thử. **Dòng callback**: badge "Callback · {event}", path là đích, **không có Replay** (request đi ra, không vào mock), chi tiết "Callback `{event}` sent to `{target}`." + lần thử.
- **Live/SSE**: một `EventSource` cho tab đang mở, query lọc method/status/path phía server (T3); lọc nguồn có thể làm phía client nếu SSE chưa hỗ trợ. Dòng mới chèn trên cùng, giữ tối đa 200 dòng trong bộ nhớ, highlight `flash` 1200ms (tắt khi `prefers-reduced-motion`). Không đặt `aria-live` trên `tbody`; dùng vùng sr-only riêng báo theo lô "{count} new requests" (tối đa một lần mỗi 5 dòng hoặc 10 giây). Đóng SSE khi rời tab hoặc ẩn trang (`visibilitychange`).
- **Responsive**: lọc 2 cột dưới 768px, 5 cột từ 768px; bảng cuộn ngang trong card, trang không cuộn ngang ở 375px.

## 3. Webhook inbox (`features/webhook-inbox/`)

**Tab Inbox** (`project-detail-inbox`):

| Phần | Primitive | `data-id` | en |
|---|---|---|---|
| Tiêu đề | `h2` + mô tả | — | "Webhook inbox" / "Public URLs that catch webhooks from outside services. They accept any method, answer with the response you set, and can forward to your machine through a tunnel." |
| Đếm hạn mức | chữ mono | `inbox-count` | "{used} / {max} inboxes" (`max` = `limitsFor(plan).webhookInboxes`, Free 2, Pro 20) |
| Tạo | `Button primary sm` | `inbox-new` | "Create inbox"; đã đủ hạn mức thì mở modal gói (`openSubscription`, nguồn `inbox-limit`), lý do "{max} webhook inboxes per project" |
| Mỗi inbox | `li` thẻ viền `border-subtle` `rounded-md` `p-4` | `inbox-item-{name}` | tên mono đậm; `inbox-item-response` "Answers {status} · {contentType}"; `inbox-item-target` "Forwards to `tunnel:{port}{path}`" hoặc "No forwarding" |
| Số request | `Button ghost sm` → chuyển tab log, lọc nguồn `inbox` + path `/_inbox/{name}` | `inbox-item-view-log` | "{count} requests", aria "See the {count} requests of inbox {name} in the request log" |
| URL | `CopyField itemLabel="URL"` | `inbox-item-url`, `inbox-item-url-copy` | `https://{secret}.localman.hoandat.com/_inbox/{name}`, aria nút "Copy the URL of inbox {name}" |
| Lần forward gần nhất | `ol` (`aria-label` "Forward attempts, up to 3") | `inbox-item-attempts-{n}` | "Attempt {n}/3" + `Badge` status (success < 400, danger ≥ 400) + "{ms} ms" + ghi chú ("Local server returned 503", "No mapping for localhost:{port}") · chưa có: "No request to forward yet." · tunnel chưa gắn: thêm `TunnelStatus` |
| Xoá | `IconButton` trash → `ConfirmModal` | `inbox-item-delete`, `modal-delete-inbox` | aria "Delete inbox {name}" / "Delete inbox {name}?" "The URL stops accepting requests right away and senders get 404. Requests already logged stay in the request log until they expire." / "Cancel" "Delete inbox" · toast "Deleted inbox {name}." |
| Rỗng | `EmptyState` icon webhook | `inbox-empty`, `inbox-empty-new` | "No inboxes yet" / "Create an inbox, paste its URL into the webhook settings of the sending service, then watch requests arrive in the request log." / "Create inbox" |
| Chân | `p.text-muted` | — | "Requests to an inbox show up in the request log with source `inbox`, have sensitive headers masked and count toward your mock request quota." |

**Modal "Create webhook inbox"** (`Modal size="lg"`, `modal-new-inbox`, focus ô Tên):

| Trường | Primitive | `data-id` | en, validation |
|---|---|---|---|
| Name | `FormField` + `Input` maxLength 32 | `inbox-form-name`, `inbox-form-url-preview` | "Name", hint "Lowercase letters, digits and `-`, up to 32 characters. URL: `{url}`" (xem trước live). Regex `^[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])?$`. Lỗi: "Enter an inbox name." · "Use lowercase letters, digits and -, not at the start or end." · "This project already has an inbox with this name." |
| Status | `Input type=number` | `inbox-form-status` | "Status", mặc định 200; "Status must be a whole number from 100 to 599." |
| Content-Type | `Select` | `inbox-form-content-type` | `application/json` (mặc định), `text/plain`, `application/xml` |
| Body | `CodeEditor` (json/text/xml theo Content-Type, chunk lazy) | `inbox-form-body` | "Body", mặc định `{"received": true}`; JSON sai khi Content-Type json: "The body isn't valid JSON. Switch Content-Type to send plain text." |
| Forward | `Switch` + mô tả | `inbox-form-forward-toggle` | "Forward to your machine (optional)" / "Sends a copy of each request to your tunnel. Retries up to 3 times on a network error, a 30-second timeout or a 5xx. The sender still gets the response above." |
| Port, Path | `Input` ×2 (lưới 140px + phần còn lại từ 480px) | `inbox-form-forward-{port|path}`, `inbox-form-forward-target` | "Port", "Path"; "Target: `tunnel:{port}{path}`"; lỗi "Port must be between 1 and 65535." · "The path starts with / and has no spaces." + `TunnelStatus` (`inbox-form-tunnel-status`) |
| Footer | `ModalFooter` | `modal-cancel`, `modal-submit` | "Cancel" / "Create inbox" (đang gửi "Creating…") · toast "Created inbox {name}. Paste its URL into the sender's webhook settings." |

Lỗi chỉ hiện sau khi bấm Tạo, xoá ngay khi người dùng gõ lại ô đó (tránh layout nhảy dưới con trỏ). Lỗi 402/403 hạn mức từ API mở modal gói; lỗi khác hiện trong modal, giữ dữ liệu.

## 4. Mock callback (`features/mock-callbacks/callbacks-editor.tsx`)

Mục cuối của `ResourceFormModal` (sau Endpoints), `section` `resource-form-callbacks`, chỉ render khi `hybridMock` bật.

| Phần | Primitive | `data-id` | en |
|---|---|---|---|
| Tiêu đề | `h3` + chú thích | — | "Callbacks" · "Send a request when records change" |
| Thêm | `Button ghost sm` | `resource-form-callback-add` | "Add callback" (focus ô Đích của callback mới) |
| Mỗi callback | khối viền `rounded-md` `p-3`, đánh số từ 1 | `resource-form-callback-{n}` | — |
| Bật/tắt | `Switch` | `resource-form-callback-toggle` | aria "Enable callback {n}"; tắt thì phần trường mờ 55% nhưng vẫn sửa được |
| Sự kiện | badge method `POST` cố định + "on" + `Select` | `resource-form-callback-event` | `create`, `update`, `delete` (giữ nguyên tiếng Anh), aria "Event of callback {n}" |
| Xoá | `IconButton` x | `resource-form-callback-remove` | aria "Remove callback {n}" |
| Đích | `FormField` + `Input` mono | `resource-form-callback-target` | "Target", placeholder `https://hooks.example.com/users or tunnel:3000/hooks/users`. Hợp lệ: `^(https://host…|tunnel:<1-65535>/path)$`. Lỗi: "Enter an https URL or tunnel:<port><path>." · "Only https is accepted. To reach your machine, use tunnel:<port><path>." · "The target is an https URL or tunnel:<port><path>, such as tunnel:3000/hooks/users." SSRF trả từ API: như upstream |
| Body template | `CodeEditor` lang json (không dùng `JsonEditor` vì `{{record}}` không phải JSON) | `resource-form-callback-body` | "Body template", mặc định `{"event":"{{event}}","resource":"{{resource}}","record":{{record}}}`. Kiểm khi blur: thay biến bằng mẫu rồi `JSON.parse`; lỗi "After variables are filled in, the body isn't valid JSON. Note that {{record}} goes without quotes." |
| Header | lưới tên / giá trị / xoá (`Input` ×2 + `IconButton`), `role="group"` | `resource-form-callback-add-header` | "Headers", placeholder `X-Hook-Secret` / "value", "Add header", aria "Header name {i}", "Header value {i}", "Remove header {name}" |
| Gửi thử | `Button secondary sm` icon send | `resource-form-callback-test` | "Send test" → "Sending…" (disabled). Dùng bản nháp hiện tại và bản ghi đầu tiên của resource (`{"id":"1"}` nếu rỗng). Toast "Sent a test callback to `{target}`." / lỗi "Test failed after 3 attempts: no tunnel mapping for `{target}`." |
| Kết quả gần nhất | vùng `aria-live="polite"` | `resource-form-callback-last` (`data-state` ok / failed) | "Last sent {time}: [status] {ms} ms after {attempts}/3 attempts" + ghi chú lỗi · chưa gửi: "Not sent yet." |
| Rỗng | `p.text-muted` | `resource-form-callbacks-empty` | "No callbacks yet. Add one and the mock sends a request to your server on create, update or delete." |
| Chú thích biến | `p.text-muted` (`renderRich`) | — | "Variables: `{{record}}` the record as JSON, `{{event}}` create, update or delete, `{{resource}}` the resource name. Sent in the background, retried up to 3 times with backoff; results go to the request log with source `callback`." |

- Lưu modal kiểm mọi callback; có lỗi thì `form-error` "A callback isn't valid." và focus ô lỗi đầu tiên. Collaborator: mọi trường `disabled`, ẩn Thêm/Xoá/Gửi thử, hiện `resource-form-callbacks-readonly`, vẫn xem kết quả gần nhất.
- Request gửi đi kèm `Content-Type: application/json`, header tuỳ chỉnh và `X-Localman-Proxy: 1` (vòng 28); chi tiết log hiện các header này.
- Responsive: dưới 640px hàng đầu callback xuống dòng (switch, POST, select chiếm một hàng, nút xoá đẩy phải); lưới header giữ 3 cột `minmax(0,1fr) minmax(0,1.4fr) 36px`.

## 5. Kiểm tra cho T7 và T8

- Mỗi `data-id` ở trên có trong DOM; test component theo vai owner và collaborator, Free (inbox thứ 3 mở modal gói) và Pro.
- `pnpm check:tokens`, `pnpm check:i18n` sạch; không tên đối thủ; mọi chuỗi có đủ en, vi, zh-CN.
- Axe trên ba tab và modal; bàn phím: Tab tới path để mở chi tiết, Escape đóng modal về đúng nút mở.

## Câu hỏi mở

1. Hạn mức `webhookInboxes` tính theo project hay theo tài khoản? Prototype và spec giả định **theo project** (đếm hiện ngay trong tab). Nếu theo tài khoản, `inbox-count` phải đọc tổng của owner.
2. Collaborator có được sửa callbacks không? Spec chọn **không** (giống upstream, vì callback có thể gửi vào tunnel của owner); hiện collaborator vẫn sửa được phần còn lại của resource.
3. "Clear log" chưa có trong danh sách operation của phase 20. Nếu T3/T4 không làm operation xoá, bỏ nút này.
4. Body 502 của mock runtime là `{error:"UPSTREAM_UNAVAILABLE", hint}` theo phase, khác quy ước `{ error: { code, message } }` của dashboard API. Cần chốt dạng nào.
5. Callback có giới hạn số lượng mỗi resource không? Phase không nêu; spec không đặt giới hạn.
