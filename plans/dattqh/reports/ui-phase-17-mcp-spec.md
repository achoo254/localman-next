# Spec UI phase 17: tab MCP, khối landing "Mock MCP tức thì", câu chữ scope và link ứng dụng đã cấp quyền

Đầu vào cho T7 (UI tab MCP), T11 (bật cờ landing) và repo IdP `hoandat-auth`. Ngày chốt: 09/10/2026.

Nguồn đã đối chiếu: `phase-17-mock-mcp.md`; `prototype/index.html` (CSS tab 728–741, `mockMcpSection` 1907, `viewProject` 2592–2612, `mcpPaneHTML` 2650–2718, action 3465–3473); `prototype/api-client.html` (`MCP_SCOPES` 1221, `settings-mcp-apps` 5259, consent 5308); `docs/design-system.md`; `docs/ux-writing.md`; `reports/ui-phase-08-landing-spec.md` (thứ tự khối); code `api-endpoint-card.tsx`, `project-detail-page.tsx`, `rotate-secret-modal.tsx`, `components/ui/*`, `pages/docs/code-block.tsx`, `pages/docs/code-examples-page.tsx` (`LanguagePicker`), `features/resources/endpoints-editor.tsx` (switch), `components/layout/account-menu.tsx` (`IDP_ENTRIES`), `pages/landing/landing-page.tsx`, `config/feature-flags.ts`; IdP `src/interactions/consent-page.ts`, `src/account-portal/account-sections.ts`, `src/oidc/resources.ts`. Cú pháp client đã kiểm trên tài liệu chính thức: Claude Code (`code.claude.com/docs/en/mcp`), Cursor (`cursor.com/docs/context/mcp`), MCP Inspector (`github.com/modelcontextprotocol/inspector`, `docs/cli-smoke-testing.md`, `docs/environment-variables.md`).

## 0. Quyết định chính và chỗ lệch prototype

| # | Prototype | Spec | Lý do |
|---|---|---|---|
| 1 | Token MCP lưu dạng đọc được, lúc nào cũng che rồi sao chép lại được (`maskToken`, `mcp-token-copy`) | Token **chỉ hiện một lần** khi bật hoặc xoay. Sau đó chỉ còn gợi ý `lmmcp_…a9e5` và nút xoay | Plan: secret chỉ trả về đúng một lần, server lưu hash. Không có API đọc lại thì UI không thể có nút sao chép lại |
| 2 | Snippet cấu hình chèn token (bản sao chép chứa token thật) | Snippet luôn tham chiếu **biến môi trường** (`$LOCALMAN_MCP_TOKEN_SHOP`, `${env:…}`, `${…}`) | Token không còn để chèn (mục 1). File `.cursor/mcp.json` hay `.mcp.json` thường được commit, nên không nên chứa token. Cả Claude Code lẫn Cursor đều nội suy biến trong `headers` |
| 3 | "Thử" giả lập một lần `tools/call` ngay trong trang | "Thử" mở **panel lệnh chạy MCP Inspector trên máy người dùng**, không gọi gì từ trình duyệt | Inspector là app cục bộ. Web UI của nó gắn token API ngẫu nhiên cho mỗi lần chạy (`MCP_INSPECTOR_API_TOKEN`), nên một link từ Localman tới `localhost:6274` không mở được bản đã điền sẵn |
| 4 | `role="tab"` không có `tabpanel`, không điều hướng bằng phím mũi tên | Primitive `Tabs` dựng trên `@radix-ui/react-tabs` | Đủ ARIA và roving focus. Phase 20 dùng lại cho tab Upstream và Request log |
| 5 | Tên server `localman-mock` cố định | `localman-{slug tên project}` | Thêm project thứ hai mà trùng tên thì `claude mcp add` báo lỗi |
| 6 | Badge `readOnly` / `destructive` | Badge "chỉ đọc" / "phá huỷ" | `ux-writing` chỉ giữ tiếng Anh cho các thuật ngữ đã liệt kê |
| 7 | Landing "6+ tool" | "5 tool mỗi resource" | Đó là con số đúng, không phải con số mơ hồ |
| 8 | `settings-mcp-apps`: bảng ứng dụng kèm nút thu hồi ngay trong Localman | Một mục "Ứng dụng đã cấp quyền ↗" dẫn sang IdP `…/account#account-apps` | Phase file: danh sách này thuộc IdP. IdP đã có `appsSection` kèm "Thu hồi" |

## 1. Tab "MCP" trong card API endpoint

### 1.1 Khung card

- Chỉ khi `features.mockMcp` bật thì card mới có tablist `REST | MCP`. Cờ tắt thì card giữ nguyên như hiện nay, không có tablist. Phase 20 thêm `Upstream` và `Request log` vào cùng tablist này.
- `<section data-id="project-detail-endpoint" aria-label="API endpoint">`. Tablist nằm trên cùng card (`px-4 pt-2`, viền dưới `border-border-subtle`), `aria-label="Endpoint của mock"`. Trigger cao tối thiểu 44px, chữ mono 13px semibold, `text-muted`. Khi chọn thì chữ `text-primary` và gạch chân 2px `--c-primary`. Chỉ đổi màu, transition `--dur-fast`, không có scale.
- Panel REST là nội dung hiện tại (h2 "API endpoint" cùng các chip URL), không đổi gì.
- Footer của card (Thêm resource, Sinh tất cả, Reset tất cả, Đổi URL mock) **giữ ở cả hai tab**. "Thêm resource" chính là lối ra khi tab MCP chưa có tool.
- Tab đang chọn lưu ở query `?endpoint=mcp` (cập nhật bằng `replace`, mặc định `rest`), để docs và kết quả `get_mock_urls` của Localman MCP link thẳng được vào tab MCP.

### 1.2 Bố cục panel MCP (từ trên xuống, `grid gap-6 p-6`)

```
[h2 MCP endpoint] [Badge neutral: Streamable HTTP]
[CopyField: https://{secret}.localman.hoandat.com{prefix}/mcp        (copy)]
  hint: Tool thao tác trên chính dữ liệu có trạng thái của mock: tạo qua MCP thì GET REST thấy ngay. Mỗi lần gọi tool tính 1 request tới mock.

Cấu hình cho agent
[Claude Code] [Cursor] [JSON chung]            ← nhóm nút aria-pressed
[CodeBlock caption + nút copy]
  hint theo trạng thái token (mục 1.4)

Yêu cầu token cho MCP                    [switch]
  trạng thái token / panel token vừa tạo (mục 1.5)

[h3 Tool tự sinh] [Badge: 12]                  [Thử ▸]
[panel Inspector khi mở (mục 1.7)]
[danh sách mcp-tool-*: 1 cột <768, 2 cột ≥768]
  help: Endpoint đang tắt thì không sinh tool. MCP resources: mock://schema, mock://openapi.
```

- URL MCP = `project.mockBaseUrl` + `/mcp`. `mockBaseUrl` đã chứa secret và prefix. Panel MCP không tô chip như REST. Bấm "Đổi URL mock" thì URL MCP cũng đổi, xem mục 1.9.
- `CopyField` dùng `hideLabel`, label sr-only là "URL MCP", vì h2 đã gọi tên khối.

### 1.3 Snippet cấu hình

Hàm thuần đặt ở `features/mcp/mcp-snippets.ts`, có unit test; landing dùng lại `claudeAddCommand`.

- **Tên server:** `localman-` nối với slug ASCII của tên project (NFD, bỏ dấu, `đ` thành `d`, chữ thường, ký tự ngoài `[a-z0-9]` thành `-`, gộp và cắt `-` ở hai đầu, tối đa 40 ký tự). Slug rỗng thì dùng `localman-mock`. Ví dụ "Cửa hàng" thành `localman-cua-hang`.
- **Biến token:** `LOCALMAN_MCP_TOKEN_` cộng slug viết hoa, `-` đổi thành `_`, ví dụ `LOCALMAN_MCP_TOKEN_CUA_HANG`. Mỗi project một biến nên không đè nhau.

| Nút (`data-id`) | Caption CodeBlock | Token tắt | Token bật |
|---|---|---|---|
| Claude Code (`project-detail-mcp-config-claude`) | `Terminal` | `claude mcp add --transport http localman-shop https://…/api/v1/mcp` | thêm ` --header "Authorization: Bearer $LOCALMAN_MCP_TOKEN_SHOP"` ở cuối, vẫn một dòng |
| Cursor (`project-detail-mcp-config-cursor`) | `.cursor/mcp.json` | `{"mcpServers":{"localman-shop":{"url":"…"}}}` (in 2 space) | thêm `"headers":{"Authorization":"Bearer ${env:LOCALMAN_MCP_TOKEN_SHOP}"}` |
| JSON chung (`project-detail-mcp-config-json`) | `mcp.json` | `{"mcpServers":{"localman-shop":{"type":"http","url":"…"}}}` | thêm `"headers":{"Authorization":"Bearer ${LOCALMAN_MCP_TOKEN_SHOP}"}` |

- "JSON chung" là định dạng `.mcp.json` (`type: "http"` là bắt buộc; Claude Code coi entry thiếu `type` là server stdio), đọc được ở Claude Code và phần lớn client theo chuẩn `mcpServers`.
- Lệnh shell giữ **một dòng** để dán được cả trên PowerShell và cmd. Hiển thị thì xuống dòng mềm nhờ prop mới `wrap` của `CodeBlock` (mục 5), nên nội dung sao chép không có `\`.
- Hint dưới CodeBlock (`project-detail-mcp-config-hint`):
  - Token tắt: "Không cần token: ai biết URL MCP đều gọi được, giống REST."
  - Token bật: "Cấu hình đọc token từ biến môi trường `LOCALMAN_MCP_TOKEN_SHOP`. Đặt biến này trước khi chạy lệnh hoặc mở lại editor. Trên PowerShell, lệnh Claude Code dùng `$env:LOCALMAN_MCP_TOKEN_SHOP`."
- Chọn tab cấu hình là state cục bộ, mặc định Claude Code.

### 1.4 Dữ liệu token cho UI (đề xuất cho T5)

- Response project trả thêm `mcp: { requireToken: boolean, tokenHint: string | null, tokenCreatedAt: string | null }`. `tokenHint` có dạng `lmmcp_…a9e5` (tiền tố cộng 4 ký tự cuối, lưu riêng cạnh hash). Collaborator chỉ nhận `requireToken`. Làm vậy thì tab không cần lần tải riêng nào, nên không có trạng thái tải hay lỗi khi tải.
- Ba thao tác, chỉ owner gọi được: bật (tạo token, trả plaintext một lần), tắt (xoá hash), xoay (thay hash, trả plaintext một lần). Theo plan, operation tạo credential cần scope `credentials:write` nếu có MCP tool; nếu chỉ dùng trên UI thì ghi `exempt` kèm lý do.

### 1.5 Cài đặt "Yêu cầu token cho MCP" (`project-detail-mcp-token`)

Hàng đầu là label "Yêu cầu token cho MCP" (`id` được switch dùng làm `aria-labelledby`) cùng `Switch` (`project-detail-mcp-token-toggle`). Switch chỉ đổi trạng thái **sau khi** API trả thành công.

| Trạng thái | Nội dung |
|---|---|
| Tắt | help: "Mặc định giống REST: ai biết URL MCP đều gọi được. Bật để bắt buộc Bearer token riêng của project, dùng được ở mọi gói." |
| Bật, không ở phiên vừa tạo | Dòng mono `project-detail-mcp-token-hint`: "Token `lmmcp_…a9e5` · tạo 09/10/2026" (`formatDate`), kèm Button secondary sm "Xoay token" (`project-detail-mcp-token-rotate`, icon refresh). help: "Gọi thiếu header `Authorization: Bearer …` nhận 401. Token chỉ hiện một lần lúc tạo; mất token thì xoay token mới." |
| Vừa bật hoặc vừa xoay | `Alert` warning, title "Lưu token ngay" (`project-detail-mcp-token-reveal`), chứa `CopyField` label "Token MCP" (`project-detail-mcp-token-value`, copy `project-detail-mcp-token-copy`, `itemLabel="token"`, **không** `autoCopy`), hint: "Token chỉ hiện lần này, Localman không lưu bản đọc được. Đặt vào biến `LOCALMAN_MCP_TOKEN_SHOP` để các cấu hình bên trên dùng được." Thêm Button ghost "Đã lưu token" (`project-detail-mcp-token-dismiss`). Panel ẩn khi bấm nút này hoặc khi rời trang; token chỉ sống trong state của component, không vào cache React Query |
| Collaborator | Không có switch. help: "Chủ project quản lý token MCP." Nếu `requireToken`: "MCP đang yêu cầu token. Hỏi chủ project để lấy token." |

Ba hộp xác nhận đều dùng `ConfirmModal`: focus nút Huỷ, lỗi hiện ngay trong modal, modal chỉ đóng khi thành công.

| Hành động | `data-id` | question | Nội dung | confirmLabel | Sau khi thành công |
|---|---|---|---|---|---|
| Bật | `modal-mcp-token-enable` | "Bật yêu cầu token cho {project}?" | "Agent đang gọi MCP mà không kèm token sẽ nhận 401 ngay. Token mới chỉ hiện một lần sau bước này." | "Bật token" | Panel token vừa tạo hiện ra; focus chuyển vào nút copy (`CopyFieldHandle.focusCopyButton` qua `onCloseAutoFocus`) |
| Tắt | `modal-mcp-token-disable` | "Tắt yêu cầu token?" | "Ai biết URL MCP đều gọi được, giống REST. Token hiện tại bị xoá; bật lại sẽ tạo token mới." | "Tắt token" | Toast "Đã tắt yêu cầu token MCP."; focus trả về switch |
| Xoay | `modal-mcp-rotate` | "Tạo token MCP mới cho {project}?" | "Token cũ hết hiệu lực ngay. Agent đang dùng token cũ nhận 401 cho tới khi bạn cập nhật token mới." | "Xoay token" | Panel token vừa tạo hiện ra; focus vào nút copy |

Hộp xác nhận tắt token dùng `variant` thường; nếu `ConfirmModal` luôn render nút `danger` thì chấp nhận, vì token bị xoá thật.

### 1.6 Danh sách tool (`project-detail-mcp-tools`, mục `mcp-tool-{name}`)

- Thứ tự theo cây: cha trước con, anh em theo thứ tự tạo. Trong mỗi resource theo thứ tự `list_`, `get_`, `create_`, `update_`, `delete_`. **Chỉ có tool cho endpoint đang bật.** Map endpoint sang tool: GET `/:res` thành `list_`, GET `/:res/:id` thành `get_`, POST thành `create_`, PUT thành `update_`, DELETE thành `delete_`.
- Một `li` chứa: `<code>` tên tool (mono, semibold); tham số (`text-muted text-xs`) là `search, filter, page, limit, sortBy, order` / `id` / `body theo schema` / `id, body` / `id`, resource con có thêm `parentId, ` ở đầu; cuối hàng là `Badge` "chỉ đọc" (neutral) cho list/get hoặc "phá huỷ" (danger) cho delete. Viền `border-border-subtle`, `rounded-sm`, `px-2 py-1.5`, `flex flex-wrap`, badge `ml-auto`.
- Header: h3 "Tool tự sinh" cùng Badge số lượng. Số đọc là "12 tool" qua sr-only.
- Trạng thái:
  - Chưa có resource (`project-detail-mcp-tools-empty`): "Chưa có tool. Thêm resource để có `list_`, `get_`, `create_`, `update_` và `delete_` cho resource đó."
  - Có resource nhưng mọi endpoint đều tắt (cùng `data-id`): "Mọi endpoint đang tắt nên chưa có tool nào. Bật endpoint trong Sửa resource."
  - Footnote luôn hiện: "Endpoint đang tắt thì không sinh tool. MCP resources: `mock://schema`, `mock://openapi`."
- Danh sách đọc từ `project.resources`, nên đổi resource xong là cập nhật ngay, không gọi thêm API. Quy tắc đặt tên phải là **một nguồn** dùng chung với `mock-tool-factory` (xem Concerns).

### 1.7 Nút "Thử" và panel MCP Inspector (`project-detail-mcp-try`)

- Button secondary sm "Thử" (icon `player-play`, `data-id="project-detail-mcp-try"`), là disclosure: `aria-expanded`, `aria-controls="mcp-try-panel"`. Không dùng modal: nội dung chỉ để đọc và sao chép, giữ cạnh danh sách tool thì người dùng thấy cả hai cùng lúc. Nút luôn bấm được; khi chưa có tool, Inspector vẫn đọc được `mock://schema`.
- Panel (`mcp-try-panel`, `data-id="project-detail-mcp-try-panel"`), nằm dưới header, trên danh sách:
  - Đoạn mở đầu: "MCP Inspector là công cụ mã nguồn mở của dự án MCP, chạy trên máy bạn qua Node.js. Chạy lệnh dưới đây trong terminal: Inspector mở giao diện trong trình duyệt để bạn kết nối và gọi thử từng tool."
  - CodeBlock `wrap`, caption "Inspector" (`project-detail-mcp-try-command`): `npx -y @modelcontextprotocol/inspector@2 --transport http --server-url {url}`, token bật thì thêm `--header "Authorization: Bearer $LOCALMAN_MCP_TOKEN_SHOP"`.
  - CodeBlock `wrap`, caption "Kiểm nhanh trong terminal" (`project-detail-mcp-try-cli`): cùng lệnh, thêm `--cli --method tools/list`.
  - help: "Mỗi lần gọi tool tính 1 request vào hạn mức mock của bạn." cùng `ExternalLink` "Tài liệu MCP Inspector" (icon ↗, sr-only "mở ở tab mới", `data-id="project-detail-mcp-try-docs"`).
- Ghim major `@2`, vì cờ `--server-url`/`--transport http` là cú pháp của v2 (README hiện tại, ví dụ chính thức dùng `@2.5.0`). Hằng phiên bản đặt ở một chỗ trong `mcp-snippets.ts`.
- **Không** hứa "tự kết nối" hay một cổng cụ thể. Tài liệu Inspector không xác nhận web UI tự kết nối khi chạy với `--server-url`; T7 thử thật rồi mới chỉnh câu (xem Concerns).

### 1.8 Lỗi

| Tình huống | Hiển thị |
|---|---|
| Bật, tắt hoặc xoay token lỗi (mạng, 5xx, 403) | `Alert` danger ngay trong `ConfirmModal` qua `errorMessage()`, modal giữ mở, switch không đổi |
| 403 vì đã mất quyền owner giữa chừng | Câu mặc định của `errorMessage`; refetch project để ẩn switch |
| Trình duyệt chặn clipboard | `CopyField`/`CodeBlock` tự chọn sẵn chữ và báo qua `aria-live`, không coi là lỗi |
| Không tải được project | Trạng thái lỗi sẵn có của trang; tab không xử lý riêng |

### 1.9 Chỗ khác cần đổi khi `mockMcp` bật

- `rotate-secret-modal.tsx` thêm một câu sau đoạn "URL cũ ngừng hoạt động…": "URL MCP cũng đổi theo; agent đã thêm URL cũ phải thêm lại." Toast giữ nguyên.
- Meter tài khoản đã có nhánh "REST và MCP đều tính" (`account-page.tsx`), không phải đổi.

## 2. Khối landing "Mock MCP tức thì"

- **Vị trí:** khối số 5 theo `ui-phase-08-landing-spec.md` §1: sau Live Mock Sync, trước So sánh. Trong code hiện tại là ngay sau `<LiveMockSyncSection />`, trước `<ComparisonSection />`. Khi phase 20 và 21 thêm Direct và Hybrid, hai khối đó chen vào trước Live Mock Sync.
- **Chỉ render khi `flags.mockMcp`**, `lazy()` như `LiveMockSyncSection`, file `pages/landing/mock-mcp-section.tsx`. Dùng `LandingSection` với `id="mock-mcp"`, `data-id="landing-mock-mcp"`.
- **Copy cuối:**
  - Eyebrow: "Mock MCP tức thì"
  - h2: "Mock của bạn thành tool cho AI agent"
  - Lead: "Mỗi project mock có sẵn một MCP endpoint. Agent gọi `list_users` hay `create_posts` trên chính dữ liệu có trạng thái của mock, bạn không phải tự viết MCP server."
- **Cột trái** (`data-id="landing-mock-mcp-snippet"`): `CodeBlock wrap`, caption "Claude Code", code `claude mcp add --transport http localman-mock https://a1b2c3d4.localman.hoandat.com/api/v1/mcp`. Secret `a1b2c3d4` trùng với thẻ hero, sinh bằng `claudeAddCommand`. Nút copy là `landing-mock-mcp-snippet-copy`, do `CodeBlock` tự đặt; id này **thay** `landing-mock-mcp-copy` trong spec phase 08. Bên dưới là help: "Streamable HTTP · dùng chung dữ liệu với REST. Thay `a1b2c3d4` bằng secret của project; lệnh đầy đủ nằm ở tab MCP của project."
- **Cột phải** (`data-id="landing-mock-mcp-tools"`, `cardClassName p-6`): h3 "Tool tự sinh từ resource" cùng Badge primary "5 tool mỗi resource". Danh sách dùng lại component danh sách tool của mục 1.6 với dữ liệu mẫu `users`: `list_users`, `get_users`, `create_users`, `update_users`, `delete_users`; `data-id` trên landing là `landing-mock-mcp-tool-{name}`, truyền qua prop tiền tố. help: "Resource lồng như `posts` nhận thêm `parentId`. Tạo bản ghi qua MCP thì `GET /users` thấy ngay."
- Không thêm CTA riêng; dải CTA cuối trang làm việc đó. Không thêm hàng MCP vào bảng so sánh cho tới khi kiểm xong thông tin của Postman (plan ghi độ tin cậy trung bình).
- Bố cục: xếp chồng dưới `lg`, `lg:grid-cols-2 gap-6` từ 1024px.

## 3. Câu chữ scope `mock:read` / `mock:write` (consent IdP)

| Scope | IdP hiện tại (`consent-page.ts`) | Prototype (`MCP_SCOPES`) | **Đề xuất** |
|---|---|---|---|
| `mock:read` | Xem các mock API của bạn trên Localman | Xem project mock, resource, schema và dữ liệu mock | **Xem project mock trên Localman mà bạn có quyền truy cập, gồm resource, schema và dữ liệu** |
| `mock:write` | Tạo, sửa và xoá mock API trên Localman | Tạo, sửa, xoá project và resource mock, sinh hoặc reset dữ liệu | **Tạo, sửa, xoá project và resource mock trên Localman, sinh hoặc reset dữ liệu** |

Nên sửa câu hiện tại, vì ba lý do:

1. Câu hiện tại không nói agent đọc được **dữ liệu** mock và đụng được cả project người khác chia sẻ. Thực tế tool chạy qua `project-access.can`, nên với một cộng tác viên, các project được mời cũng nằm trong phạm vi.
2. Câu hiện tại không nói `mock:write` sinh hoặc reset được dữ liệu. Đó là thao tác mất dữ liệu, người dùng cần biết trước khi cho phép.
3. Câu đề xuất giữ "trên Localman", vì consent của IdP dùng chung cho nhiều ứng dụng.

Sửa câu là đủ: `appsSection` ở trang tài khoản đọc cùng `SCOPE_TEXT` qua `describeScopes`, nên danh sách ứng dụng đã cấp quyền tự đổi theo. `MCP_SCOPES` của prototype chỉ còn để tham khảo; nguồn sự thật là `SCOPE_TEXT` của IdP. Localman không hiện câu scope ở đâu nữa.

## 4. Link "Ứng dụng đã cấp quyền"

- Thêm một mục vào `IDP_ENTRIES` của `account-menu.tsx` (nhóm "Tài khoản hoandat · mở tab mới"): `{ id: "apps", label: "Ứng dụng đã cấp quyền", hash: "account-apps", Icon: IconPlug }`, `data-id="account-menu-apps"`. Mục này **chỉ hiện khi `features.mockMcp`**, vì trước đó chưa có ứng dụng nào xin quyền Localman. Hành vi giống các mục IdP khác: `openExternal(`${idpAccountUrl}#account-apps`)`, icon ↗, sr-only ", mở trang tài khoản hoandat ở tab mới".
- Không dựng lại bảng `settings-mcp-apps` trong Localman. Khi trang Settings của API client có mục "Localman MCP" (phase 10), khối đó chỉ cần một dòng help kèm `ExternalLink` tới cùng địa chỉ.
- **Phải sửa phía IdP:** `appsSection` hiện chỉ có `data-id="account-apps"`, không có `id`, nên neo `#account-apps` không cuộn tới đâu. Ba neo đang dùng (`account-email`, `account-recovery`, `account-password`) cũng thiếu `id` như vậy. Cần thêm `id` cho các `section` đó; đây là thay đổi ở repo `hoandat-auth`.

## 5. Primitive: dùng lại, mở rộng, thêm mới

| Primitive | Cách dùng | Thay đổi |
|---|---|---|
| `CopyField` | URL MCP, token vừa tạo | Thêm prop `itemLabel` (mặc định `"link"`). Chữ "Sao chép link" / "Đã sao chép link" đang viết cứng, sẽ thành "Sao chép {itemLabel}" / "Đã sao chép {itemLabel}" |
| `CodeBlock` | Snippet cấu hình, lệnh Inspector, landing | **Chuyển** từ `pages/docs/code-block.tsx` sang `components/ui/code-block.tsx` (từ nay có 3 nơi gọi: docs, tab MCP, landing). Thêm prop `wrap` (`whitespace-pre-wrap wrap-anywhere`) cho lệnh shell; JSON vẫn cuộn ngang |
| `Tabs` (mới) | Tab REST/MCP, sau này thêm Upstream/Log | `components/ui/tabs.tsx` dựng trên `@radix-ui/react-tabs`, đồng bộ với các primitive Radix khác. Thêm dependency |
| `Switch` (mới, tách ra) | Token MCP | Tách từ switch inline của `endpoints-editor.tsx` (`role="switch"`, `aria-checked`). Vùng chạm ≥44px trên `pointer-coarse` bằng pseudo-element, hình dáng giữ nguyên. Đổi `endpoints-editor` sang dùng primitive |
| `SegmentedControl` (tách ra) | Claude Code / Cursor / JSON chung | Từ `LanguagePicker` trong docs: `fieldset` + `legend` sr-only + các nút `aria-pressed`. `theme-toggle` cũng có dạng này, nên đủ 3 nơi gọi |
| `ConfirmModal`, `Alert`, `Badge`, `Button`, `ExternalLink`, `toast` | Như đã mô tả ở trên | Không đổi |

File tính năng (`apps/web/src/features/mcp/`): `mcp-tab.tsx` (panel), `mcp-config-snippets.tsx`, `mcp-token-settings.tsx`, `mcp-tool-list.tsx` (dùng chung với landing), `mcp-try-panel.tsx`, `mcp-snippets.ts` (hàm thuần cùng test). Mỗi file ≤200 dòng. Khi xong, T7 cập nhật `docs/design-system.md` cho `Tabs`, `Switch`, `SegmentedControl` và vị trí mới của `CodeBlock`.

## 6. Bảng `data-id`

| Khối | `data-id` |
|---|---|
| Card và tab | `project-detail-endpoint`, `project-detail-endpoint-tab-rest`, `project-detail-endpoint-tab-mcp`, panel `project-detail-mcp` |
| URL | `project-detail-mcp-url`, `project-detail-mcp-url-copy` |
| Cấu hình | `project-detail-mcp-config` (fieldset), `project-detail-mcp-config-claude` / `-cursor` / `-json`, `project-detail-mcp-config-output` (CodeBlock), `project-detail-mcp-config-output-copy`, `project-detail-mcp-config-hint` |
| Token | `project-detail-mcp-token`, `project-detail-mcp-token-toggle`, `project-detail-mcp-token-hint`, `project-detail-mcp-token-rotate`, `project-detail-mcp-token-reveal`, `project-detail-mcp-token-value`, `project-detail-mcp-token-copy`, `project-detail-mcp-token-dismiss` |
| Modal | `modal-mcp-token-enable`, `modal-mcp-token-disable`, `modal-mcp-rotate` |
| Tool | `project-detail-mcp-tools`, `mcp-tool-{name}`, `project-detail-mcp-tools-empty` |
| Thử | `project-detail-mcp-try`, `project-detail-mcp-try-panel`, `project-detail-mcp-try-command`, `project-detail-mcp-try-cli`, `project-detail-mcp-try-docs` |
| Landing | `landing-mock-mcp`, `landing-mock-mcp-snippet`, `landing-mock-mcp-snippet-copy`, `landing-mock-mcp-tools`, `landing-mock-mcp-tool-{name}` |
| Menu | `account-menu-apps` |

Phân cấp không quá 3 bậc. Mục `mcp-tool-{name}` giữ đúng id của prototype và của task.

## 7. Responsive

| | 375 | 768 | 1440 |
|---|---|---|---|
| Tablist | Rộng hết card. Từ 3 tab trở lên (phase 20) thì `overflow-x-auto`, trang không cuộn ngang | Trái, kích thước tự nhiên | Như 768 (card nằm trong `max-w-page` 1120) |
| URL, token | `CopyField` rộng hết, URL dài cuộn trong input | Như 375 | Như 375 |
| Snippet | Lệnh shell xuống dòng mềm; JSON cuộn ngang trong block (`tabIndex=0`) | JSON hiện đủ | JSON hiện đủ |
| Nhóm cấu hình | 3 nút xuống dòng nếu thiếu chỗ (`flex-wrap`) | Một hàng | Một hàng |
| Hàng token | Label và switch một hàng; gợi ý token và "Xoay token" xuống hàng riêng | Một hàng | Một hàng |
| Danh sách tool | 1 cột; header "Tool tự sinh" cùng "Thử" `flex-wrap` | 2 cột | 2 cột |
| Footer card | Các nút xuống dòng như hiện nay | | |
| Landing | Xếp chồng | Xếp chồng | 2 cột từ `lg` |

Vùng chạm ≥44px trên màn cảm ứng cho switch, nút copy (`size-11` sẵn có), trigger tab và nút của nhóm cấu hình.

## 8. A11y

- Tabs của Radix: `role="tablist"`/`tab`/`tabpanel`, `aria-controls`, ←/→ chuyển tab, Home/End, panel ẩn thì không focus được. Tab đang chọn khớp `?endpoint=`.
- Nhóm cấu hình: `fieldset` với `legend` sr-only "Định dạng cấu hình"; nút dùng `aria-pressed`, không dùng role tab (không có panel riêng).
- Switch: `role="switch"`, `aria-checked`, `aria-labelledby` trỏ label "Yêu cầu token cho MCP", `aria-describedby` trỏ help. Trong lúc modal mở, switch không đổi trạng thái.
- Copy: `CopyField` và `CodeBlock` báo kết quả qua `aria-live` của chính chúng (dùng được cả trong modal). `aria-label` các nút là "Sao chép URL", "Sao chép token", "Sao chép mã Terminal".
- Token vừa tạo: Alert warning tự `role="alert"`. Sau khi modal đóng, focus chuyển vào nút copy token; "Đã lưu token" trả focus về "Xoay token" (hoặc switch).
- Disclosure "Thử" dùng `aria-expanded` và `aria-controls`; khi mở, focus giữ ở nút.
- Badge "chỉ đọc"/"phá huỷ" là chữ nên không dựa vào màu. Số tool có phần sr-only "tool".
- `ExternalLink` có icon ↗ và chữ sr-only "mở ở tab mới". Mọi `code` dùng JetBrains Mono, đã có subset tiếng Việt.
- Màu chỉ dùng token (`text-primary`, `text-muted`, `border-border-subtle`, tone của badge). `pnpm check:tokens` phải sạch.
- `prefers-reduced-motion`: chỉ có transition màu của tab, và token tự đưa về 1ms.

## Unresolved questions

1. Sau khi `npx @modelcontextprotocol/inspector@2 --transport http --server-url …` mở web UI, nó tự kết nối hay người dùng phải bấm Connect? Có cần `--header` kèm chế độ web không? Tài liệu không nói rõ. T7 cần chạy thử rồi mới chốt câu mở đầu của panel "Thử".
2. Bỏ hẳn bản sao chép lại token (mục 0.1) là lệch prototype có chủ đích, dựa theo quy tắc "secret chỉ trả một lần" của plan. Nếu bạn muốn giữ hành vi sao chép lại như prototype, server phải lưu token dạng đọc được; spec không khuyến nghị cách đó.

Status: DONE_WITH_CONCERNS
Summary: Đã chốt spec tab MCP (URL, snippet Claude Code/Cursor/JSON đọc token từ biến môi trường, token chỉ hiện một lần với xác nhận khi bật/tắt/xoay, danh sách `mcp-tool-*`, panel lệnh MCP Inspector), khối landing số 5, câu chữ scope đề xuất cho IdP và link `#account-apps`, kèm `data-id`, primitive, responsive, a11y.
Concerns:
- Quy tắc đặt tên và lọc tool (`list_/get_/create_/update_/delete_`, chỉ endpoint đang bật, `parentId`) phải có một nguồn duy nhất. Nên đặt hàm đặt tên thuần ở `packages/shared` để `mock-tool-factory` (T3) và UI cùng dùng; nếu không, danh sách tool trên UI sẽ lệch dần.
- Khi project có prefix rỗng mà có resource tên `mcp`, route `/mcp` (mount trước catch-all) sẽ che mất resource đó. T5 cần cấm tên `mcp` hoặc xử lý va chạm.
- IdP chưa có `id` trên các section nên `#account-apps` (và 3 neo sẵn có) không cuộn tới đâu; cần sửa ở `hoandat-auth`. IdP cũng chưa có câu chữ và cảnh báo đỏ cho `credentials:write` mà plan yêu cầu.
- Thêm dependency `@radix-ui/react-tabs`, và chuyển `CodeBlock` ra `components/ui` (đổi import trong docs).
