---
phase: 10
title: "API Client: lõi gửi request và proxy"
status: in-progress
priority: P2
effort: "L"
dependencies: [9]
blockedBy: ["plans/dattqh/261008-1156-tunelo-accounts-and-tunnel-list"]
---

# Phase 10: API Client, lõi gửi request và proxy

> Chỉ bắt đầu khi phase 01–09 xong, tức phần mock API đã lên staging. Khi tới lượt, chạy `/ak:xia` trên repo cũ `achoo254/localman` (clone chỉ đọc ở `../localman`) với chế độ `--port` để chốt chi tiết file trước khi `/ak:cook`.

## Goal
Thêm vào Localman một API client chạy trên web (không phải desktop app), chức năng như Postman, dùng design system riêng của Localman. Client gắn chặt với mock: gọi thử endpoint mock ngay trong app, và import một project mock thành collection.

## Chiến lược reuse
Repo `localman` cũ (`achoo254/localman`, giữ nguyên để đọc) đã là một API client kiểu Postman, cùng stack React + Tailwind + Vite và cùng tác giả. Port các module sau, không viết lại:

| Module localman | Dùng cho Localman web | Ghi chú port |
|---|---|---|
| `client/src/components/request/*`, `response/*` | Request builder, response viewer | Đổi sang token và primitive UI của phase 01 |
| `client/src/components/history/*` | History | Lưu ở Mongo qua API, thay cho Dexie local-only. Phần collections/environments của localman chỉ dùng làm tham khảo UI cho phase 12 và 13 |
| `services/request-preparer.ts`, `utils/variable-interpolation.ts` | Nội suy `{{var}}` và auth | Giữ nguyên logic, kèm test |
| `services/import-export-service.ts` | Import cURL, Postman v2.1, OpenAPI 3.0 | Giữ nguyên |
| `services/snippet-generators/*` | 16 code snippet | Giữ nguyên |
| `services/script-executor.ts` (QuickJS) | Pre/post script | Giữ sandbox QuickJS, không đổi sang `eval` |
| `backend/src/proxy.ts` + `services/http-client.ts` | `POST /api/proxy`, đường đi của request không gửi thẳng được từ trình duyệt (bước 3) | Bỏ nhánh "localhost thì fetch trực tiếp" của localman. Viết lại trên Express 5 với envelope, chuyển tiếp IP client và chặn SSRF (xem bước 3) |

## Phạm vi của phase này
Phase này chỉ làm **lõi gửi request và proxy**. Phần quản lý theo Postman nằm ở các phase sau:

| Phase | Nội dung |
|---|---|
| 11 | Workspace và chia sẻ |
| 12 | Collections |
| 13 | Environments và biến |
| 14 | Fork, merge, pull request, comment, watch |
| 15 | Chia sẻ công khai |

Phase này gồm:
- Request builder đủ method; tab params, headers, body (JSON, form-data, x-www-form-urlencoded, raw, binary), auth (No auth, Bearer, Basic, API key, Inherit from parent) cùng tab Scripts (pre-request và post-response).
- Response viewer: status, thời gian kèm timings, size, headers, cookies, body Pretty/Raw/Preview, tìm trong body.
- Mở nhiều tab request, có bản nháp chưa lưu. History lưu server-side theo user.
- Import/export cURL, Postman v2.1, OpenAPI 3.0. Code snippet cho 16 ngôn ngữ.
- Tích hợp mock: nút "Mở trong API Client" trên node của cây resource, và "Tạo collection từ project mock" (collection được tạo theo model của phase 12).

## Files to Create / Modify (đã chốt ở bước xia, 2026-10-09)
Chi tiết, lý do và rủi ro: `plans/dattqh/reports/xia-phase-10-api-client-port.md`. Mọi file kebab-case, ≤ 200 dòng, test co-located. Logic thuần ở `packages/shared/src/api-client/`, xuất qua subpath `@localman/shared/api-client`.

**T2a, nền** (`packages/shared/src/api-client/`):
- Create `index.ts`, `limits.ts`, `request-model.ts`, `request-schema.ts`, `response-model.ts`, `proxy-envelope.ts`, `variable-interpolation.ts`, `dynamic-variables.ts`, `extract-variables.ts`, `url-params.ts`, `auth-headers.ts`, `request-preparer.ts`, `multipart-encoder.ts`, `local-host.ts`, `tunnel-url.ts`, kèm test
- Modify `packages/shared/package.json` (export `./api-client`, `quickjs-emscripten-core`, devDependency `@jitl/quickjs-wasmfile-release-sync`)

**T2b, import/export/snippet** (`packages/shared/src/api-client/`):
- Create `import/{detect-format,curl-tokenizer,curl-parser,collection-v21-types,collection-v21-import,collection-v21-items,environment-v21-import,openapi-import,openapi-example,imported-collection}.ts`, `export/{collection-v21-export,openapi-export}.ts`, `snippets/{snippet-registry,snippet-escape}.ts` và 16 `snippets/generator-*.ts`, kèm test (golden + chuỗi đối kháng)

**T2c, sandbox:** Create `packages/shared/src/api-client/script-sandbox/{script-types,script-prelude,run-script}.ts` kèm test chạy QuickJS thật

**T3, proxy** (`apps/api/src/modules/api-client/`):
- Create `proxy-operation.ts` (`client.sendRequest`, `POST /api/v1/proxy`, tool MCP `send_request`), `proxy-forwarder.ts`, `proxy-headers.ts`, `ssrf-guard.ts`, `proxy-timings.ts`, `proxy-response-body.ts`, `proxy-quota.ts`, kèm test
- Modify `apps/api/package.json` (`undici@^7.30`), `apps/api/src/config/runtime-settings.ts`, `apps/api/src/config/feature-env.ts`, `.env.example`, `docs/system-architecture.md`
- Modify `infra/localman/nginx/localman.hoandat.com.conf`: `location = /api/v1/proxy` (body 15m, read timeout 130s); CSP `connect-src` mở cho mọi origin http(s) (gửi thẳng) và `script-src` thêm `'wasm-unsafe-eval'` (QuickJS)

**T4, history/draft/settings** (`apps/api/src/modules/api-client/`):
- Create `history-{model,service,operations}.ts`, `draft-{model,operations}.ts`, `client-settings-{model,operations}.ts`, kèm test
- Create `api-client-operations.ts` và Modify `apps/api/src/operations/registry.ts` ở bước cuối, sau khi T3 xong

**T5, UI request** (`apps/web/src/`):
- Create `pages/api-client/api-client-page.tsx`; `features/api-client/workbench/{workbench-types,workbench-reducer,use-draft-sync}.ts`, `workbench/{workbench-context,sidebar-rail,status-bar,empty-editor}.tsx`; `features/api-client/api/draft-api.ts`; `features/api-client/tabs/{tab-bar,tab-item,close-tab-modal}.tsx`; `features/api-client/request/{request-editor,url-bar,method-select,variable-input,key-value-table,params-tab,headers-tab,auth-tab,body-tab,body-form-table,body-binary-picker,request-settings-tab}.tsx`, `request/auto-headers.ts`; `features/api-client/scripts/{scripts-tab.tsx,script-snippets.ts}`; `components/ui/code-editor.tsx`; `lib/method-tone.ts`; `platform/file-read.ts`; `i18n/messages/{en,vi,zh-CN}/api-client.ts`
- Modify `routes.tsx` (`/api-client`), `components/layout/app-shell.tsx` (biến thể workbench), `apps/web/package.json` (`@codemirror/lang-javascript`, `lang-xml`, `lang-html`), `i18n/messages/{en,vi,zh-CN}/dictionary.ts` (đăng ký trước 4 namespace `apiClient`, `apiClientTools`, `apiClientRouting`, `apiClientTunelo`), `docs/design-system.md`

**T6, UI response và tiện ích** (`apps/web/src/features/api-client/`):
- Create `response/{response-panel,response-meta,timings-popover,response-body,html-preview,json-table-preview,response-headers-table,response-cookies-table,script-results}.tsx`, `response/{body-search,set-cookie-parser}.ts`; `history/{history-sidebar,history-item}.tsx`, `history/history-groups.ts`, `api/history-api.ts`; `import-export/{import-modal,collection-open-picker,export-menu}.tsx`; `snippets/code-snippet-modal.tsx`; `apps/web/src/i18n/messages/{en,vi,zh-CN}/api-client-tools.ts`

**T7, định tuyến:**
- Create `apps/web/src/features/api-client/routing/{forbidden-headers,route-plan,send-pipeline,use-send-request,route-why}.ts`, `routing/{secret-consent-modal,route-select,route-badge,route-note}.tsx`; `api/{proxy-api,client-settings-api}.ts`; `scripts/script-worker.ts`; `apps/web/src/platform/{direct-fetch,script-host}.ts`; `apps/web/src/pages/settings/routing-settings.tsx`; `i18n/messages/{en,vi,zh-CN}/api-client-routing.ts`
- Modify `apps/web/vite.config.ts` (worker ES, wasm QuickJS)

**T8a, Tunelo thủ công (làm ngay):**
- Create `apps/web/src/features/api-client/tunelo/{tunelo-panel,tunelo-steps,cors-hint,tunnel-warning,tunnel-paste-form,tunnel-badge}.tsx`, `tunelo/cors-snippets.ts`; `apps/web/src/pages/settings/{settings-page,tunelo-settings}.tsx`; `i18n/messages/{en,vi,zh-CN}/api-client-tunelo.ts`
- Modify `apps/web/src/routes.tsx` (`/settings`)

**T8b, tự nhận tunnel theo tài khoản: HOÃN** tới khi xong plan Tunelo (đợt 4, `GET /api/tunnels`, link-code, `tunelo-v1.7.0`). Khi đó: Create `apps/api/src/modules/tunelo/*` (dùng `TunnelTokenExchange` sẵn có), `features/api-client/tunelo/{choose-tunnel-modal,tunelo-connect-modal}.tsx`; Modify `tunelo-settings.tsx` (bảng máy đã liên kết).

**T8b, thiết kế chốt 2026-10-17** (điều kiện trước đã đủ: Tunelo phase 01–02 xong, server có `GET /api/tunnels`, `/api/links/*`, CLI 1.9.0):
- Server `apps/api/src/modules/tunelo/`: client gọi Tunelo của tenant (`tunnelResource()`, ghi đè bằng env `TUNELO_API_URL` cho dev/E2E); lấy danh sách theo tài khoản bằng `TunnelTokenExchange.accessTokenFor(sessionId)` cộng mỗi máy ẩn danh đã liên kết; cache 10 giây theo user; lỗi của một nguồn không làm hỏng nguồn khác.
- Model `tunelo_links` (theo tenant, `tenantScopePlugin`): một dòng cho mỗi lượt liên kết của user (`pending` giữ `requestId`, `linked` giữ link token). Token mã hoá AES-256-GCM bằng `TokenCipher` với keyring của `SESSION_ENCRYPTION_KEY`, associated data gắn với user và id dòng. Poll chỉ nhận `requestId` của chính user. Gỡ liên kết gọi `DELETE /api/links/self` (lỗi mạng không chặn việc xoá dòng).
- Operation toolset `client` (đều `mcp: { exempt }` cùng lý do với ánh xạ tunnel: URL tunnel và token là đích nhận credential): `client.listLocalTunnels` (GET, lọc theo `port`), `client.startTunnelLink`, `client.pollTunnelLink`, `client.listTunnelLinks`, `client.deleteTunnelLink`.
- Cờ phát hành `tuneloAccounts`: server `TUNELO_ACCOUNTS_ENABLED` lọc operation qua `feature-gates.ts`, web qua `VITE_FEATURES`; chỉ thêm vào `released-features` khi chạy production.
- Web: ánh xạ thủ công đang bật luôn thắng. Không có ánh xạ thì hỏi `listLocalTunnels(port)`: đúng 1 tunnel HTTP thì tự viết lại origin và gửi qua proxy, badge "Qua Tunelo · <máy>"; nhiều tunnel thì `choose-tunnel-modal` và nhớ lựa chọn theo địa chỉ local (localStorage, có try/catch); tunnel có Basic Auth thì báo header `Authorization` sẽ dùng cho Basic Auth; chỉ có TCP thì báo và gợi ý `tunelo http <port>`; không có thì panel Tunelo như T8a, "Kiểm tra lại" hỏi lại danh sách. Tunnel trả 502/404 hoặc biến mất thì báo "Tunnel đã dừng" và mở lại panel. Settings > Tunelo: `tunelo-connect-modal` (mã, lệnh `tunelo link <mã>`, poll tới khi xong hoặc hết hạn) và bảng máy đã liên kết có nút thu hồi.

**T9, tích hợp mock:**
- Create `packages/shared/src/api-client/mock-to-collection.ts` (ID ổn định `mock:<resourceId>:<method>:<scope>` để phase 16 mở rộng) kèm test, `apps/web/src/features/api-client/import-export/from-mock-modal.tsx`
- Modify `apps/web/src/features/resource-tree/{node-actions,resource-node}.tsx` (action "Mở trong API Client"), `apps/web/src/pages/project-detail/project-detail-dialogs.tsx`, `apps/web/src/components/layout/app-header.tsx` (nav "Mock API" / "API Client" theo cờ `apiClient`), `i18n/messages/{en,vi,zh-CN}/{layout,resource-tree}.ts`

**T10, test liên tầng:**
- Create `apps/api/src/modules/api-client/{proxy-echo-server,ssrf-matrix}.test.ts`, `e2e/specs/api-client-{routing,tunelo,mock}.spec.ts`

Không thêm Zustand, Dexie, Firebase, `react-resizable-panels`, meta-package `quickjs-emscripten` hay `codemirror`. Các file đang sửa dở của phase 19 (`registry.ts`, `dictionary.ts`, `node-actions.tsx`, `resource-node.tsx`) chỉ được đụng sau khi phase 19 commit.

## Tasks & Steps
1. Chạy xia port từ localman: lập dependency matrix chi tiết (Zustand và Dexie của localman sang TanStack Query và API Mongo của Localman web), rồi chốt danh sách file.
2. Đổi UI sang design system của Localman (phase 01):
   - Màu cho method lấy từ bước 11 của các thang Radix (GET green, POST amber, PUT blue, PATCH violet, DELETE red, HEAD/OPTIONS slate), giống prototype.
   - Mọi URL và body dùng font mono.
3. **Định tuyến request: gửi thẳng từ trình duyệt hay qua proxy.** User chốt 2026-10-08: "nếu đi thẳng không qua server trung gian được thì càng tốt". Jev chọn:
   - **Mặc định là Auto** (0.99). Mỗi request đi **thẳng từ trình duyệt** (`fetch`, `credentials:'omit'`) nếu thoả cả hai điều kiện: (a) không dùng header trình duyệt cấm (`Cookie`, `Host`, `Origin`, `Connection`, `Content-Length`, `Proxy-*`, `Sec-*`…), (b) host chưa bị ghi nhớ là "cần proxy". Không thoả thì đi **qua proxy** (mục dưới).
   - **Bị chặn thì tự chuyển** (0.98). Gửi thẳng mà gặp `TypeError` (thường do CORS; trình duyệt không cho phân biệt với lỗi mạng) thì **tự gửi lại qua proxy**, hiện badge "Qua proxy · CORS chặn", và nhớ theo host (sửa được trong Settings).
   - **Có secret thì hỏi trước** (0.85). Request chứa giá trị của biến `type=secret` mà phải chuyển sang proxy thì **không tự chuyển**: hỏi "Gửi qua proxy? Secret sẽ đi qua server Localman lúc truyền (không lưu, không log)". Có lựa chọn nhớ theo host.
   - **Tunelo cũng tính là đi qua proxy:** request tới localhost đi Tunelo mà có secret thì cũng hỏi trước như trên.
   - **Ghi đè theo request:** ô chọn đường đi gồm "Auto / Trực tiếp / Proxy" cạnh nút Send; badge kết quả là "Trực tiếp", "Qua proxy" hoặc "Qua Tunelo".
   - **Khác biệt theo đường đi**, hiện trong UI:
     - Gửi thẳng: đích thấy IP thật của user; không đọc được `Set-Cookie` và header không được expose; timing lấy từ Performance API (chi tiết chỉ có khi đích trả `Timing-Allow-Origin`).
     - Qua proxy: có đủ timing và header như mô tả dưới.
   - **Ngoại lệ không gửi thẳng:** tool MCP `send_request` và giám sát (monitor) chạy phía server nên luôn dùng proxy. CLI runner chạy trên máy CI nên luôn gửi thẳng.

3b. **Proxy trung gian** (đường dự phòng và khi user chọn Proxy). Request không gửi thẳng được từ trình duyệt (bước 3) thì đi qua server. Yêu cầu proxy gốc do user chốt ngày 2026-10-08; vòng 13 đổi mặc định sang gửi thẳng, proxy thành đường dự phòng.
   - **Envelope:** trình duyệt gửi `POST /api/proxy` với body `{method, url, headers[], body, bodyType, options:{followRedirects, timeoutMs}}`. Server dựng request thật bằng `undici` rồi trả về `{status, statusText, headers[], body (base64 nếu là binary), size, timings:{dns, connect, tls, ttfb, total}, finalUrl}`.
     - Lý do dùng envelope thay vì passthrough thô: user đặt được các header mà trình duyệt cấm tự set qua `fetch` (`Cookie`, `User-Agent`, `Origin`, `Referer`, `Host`…), và xem được header phản hồi mà CORS che đi.
   - **Chuyển tiếp nguyên vẹn:**
     - Method, URL kèm query, body ở mọi dạng (JSON, form-data, urlencoded, raw, binary), và toàn bộ header user khai báo, giữ nguyên thứ tự và cả header trùng tên.
     - `Host` đặt theo URL đích, trừ khi user ghi đè.
     - Phản hồi trả nguyên status, header (gồm cả `Set-Cookie`, chỉ để hiển thị, không áp vào trình duyệt) và body.
   - **IP của client:**
     - Đích sẽ thấy IP kết nối TCP là IP của server proxy. Đây là giới hạn của TCP/IP: không thể giả IP nguồn qua internet vì gói trả về sẽ không quay lại được.
     - IP thật của client được chuyển tiếp bằng header: thêm vào cuối `X-Forwarded-For`, đặt `X-Real-IP`, và thêm `Forwarded: for=<ip>;proto=<scheme>`.
     - IP client lấy từ socket, hoặc từ `X-Forwarded-For` **chỉ khi** request đi qua reverse proxy tin cậy (`app.set('trust proxy', <danh sách CIDR>)`), để client không giả được IP.
     - Mặc định **bật** theo yêu cầu của user. Có toggle theo request "Gửi IP client" để tắt khi đích từ chối request mang header forwarded.
   - **Không chuyển tiếp:**
     - Header hop-by-hop theo RFC 9110 §7.6.1: `Connection`, `Keep-Alive`, `Proxy-Connection`, `TE`, `Trailer`, `Transfer-Encoding`, `Upgrade`, `Proxy-Authorization`, cùng mọi header được liệt kê trong `Connection`.
     - Cookie phiên `lm_session` và header xác thực của chính Localman. Envelope tách bạch phần này: header gửi tới đích chỉ lấy từ request builder, không lấy từ request trình duyệt gửi lên `/api/proxy`.
   - **Chống SSRF:** proxy chạy trên server của sản phẩm, không được chạm tới mạng nội bộ của server.
     - Chặn IP private (RFC 1918), loopback, link-local, CGNAT, ULA IPv6 và metadata (169.254.169.254).
     - Kiểm IP **sau khi resolve DNS** và ghim IP đã kiểm khi kết nối, để chống DNS rebinding. Kiểm lại ở mỗi lần redirect.
     - Đích là `localhost` hoặc IP LAN của chính user thì proxy không gọi được. Khi đó hiện **panel Tunelo** (xem bước 4).
   - **Giới hạn:** tối đa 10 redirect, timeout mặc định 30 giây (tối đa 120 giây), request body tối đa 10 MB, response tối đa 10 MB (quá thì cắt kèm cảnh báo). Rate-limit theo user. Bắt buộc đăng nhập. Hạn mức tháng `proxyRequestsPerMonth` (Free 5.000; Pro không giới hạn tháng). Vượt thì proxy trả lỗi `MONTHLY_QUOTA_EXCEEDED` và request builder hiện thông báo kèm nút "Xem gói".
   - **Log:** chỉ ghi metadata (user, host đích, status, thời gian). Không log header hay body vì có thể chứa token của user.

4. **Gọi app trên máy local qua Tunelo.** User yêu cầu ngày 2026-10-08.
   - Cơ chế chính: **tự nhận tunnel** qua API của Tunelo, user yêu cầu thêm API này vào Tunelo. Plan ở `plans/dattqh/261008-1156-tunelo-accounts-and-tunnel-list/plan.md` và **chặn phase này**.
   - Cơ chế dự phòng: dán URL (Jev 0.85).
   - **Đối chiếu Postman:** Postman web gọi localhost bằng Desktop Agent cài trên máy (Cloud Agent không gọi được), không dùng tunnel. Localman dùng [Tunelo CLI](https://www.npmjs.com/package/tunelo) của chính tác giả. Proxy gọi tới URL tunnel công khai, nên vẫn giữ nguyên việc chặn SSRF.
   - **Phát hiện:** host sau khi nội suy biến là `localhost`, `*.localhost`, `127.0.0.0/8`, `::1`, `0.0.0.0` hoặc IP private (RFC 1918, link-local, ULA). Trình duyệt kiểm trước khi gửi; server vẫn kiểm lại như bước 3b.
   - **Thử gửi thẳng trước, không được thì dùng Tunelo** (Jev 0.73):
     - Ở chế độ Auto, request tới localhost được gửi thẳng trước. Chrome 142 trở lên hỏi quyền Local Network Access; server local cũng phải trả CORS.
     - Thành công thì badge là "Trực tiếp (localhost)", và secret không rời máy.
     - Thất bại thì chuyển sang tìm tunnel Tunelo như dưới (đi qua proxy).
     - Panel Tunelo có thêm gợi ý thứ ba: "Hoặc bật CORS cho `https://localman.hoandat.com` ở dev server để gửi thẳng", kèm snippet cho Express, Vite, Next.js, Spring và Laravel.
   - **Tunelo theo tài khoản** (IdP chung; plan `plans/dattqh/261008-1156-tunelo-accounts-and-tunnel-list/`): user đã `tunelo login` bằng cùng tài khoản thì Localman **tự thấy tunnel**, không cần cấu hình gì. Server Localman đổi phiên lấy token `aud=https://tunnel.hoandat.com`, `scope=tunnels:read` (`token-exchange.ts` của phase 02), rồi gọi `GET https://tunnel.hoandat.com/api/tunnels`.
   - **Máy chưa gắn tài khoản** (token ẩn danh còn trong 60 ngày grace): dùng Settings > Tunelo > "Liên kết máy ẩn danh". Server Localman gọi `POST /api/links/init`, rồi hiện mã cùng lệnh `tunelo link ABCD-1234`, rồi poll `POST /api/links/poll` để nhận token chỉ đọc, lưu mã hoá AES-256-GCM riêng từng user.
   - **Khi gửi request tới local:** server Localman gọi `GET /api/tunnels`, một lần theo tài khoản cộng thêm mỗi máy ẩn danh đã liên kết. Gọi khi cần (Jev 0.95), cache 10 giây, rồi tìm tunnel có `localPort` trùng port trong URL.
     - **Có đúng 1 tunnel HTTP:** tự đổi `scheme://host:port` sang URL tunnel, giữ nguyên path, query, header và body. Ô URL hiện badge "qua Tunelo · <máy>".
     - **Có nhiều tunnel** (nhiều máy hoặc nhiều subdomain): hỏi chọn 1 lần, rồi nhớ lựa chọn.
     - **Tunnel có Basic Auth:** báo trước rằng header `Authorization` của request sẽ bị dùng cho Basic Auth của tunnel.
     - **Chỉ có tunnel TCP cho port đó:** báo API client chỉ gửi được HTTP, và gợi ý `tunelo http <port>`.
   - **Không tìm thấy tunnel, hoặc chưa kết nối Tunelo:** hiện **panel Tunelo** thay cho vùng response:
     1. Cài: `npm install -g tunelo` (Node 20+).
     2. Đăng nhập thiết bị: `tunelo login`.
     3. Mở tunnel: `tunelo http <port>`, port lấy từ URL (không có thì 80 cho http, 443 cho https).
     4. Gợi ý "Đăng nhập Tunelo bằng cùng tài khoản: `tunelo login`" và nút "Kiểm tra lại".
     5. Dự phòng: ô "Hoặc dán URL tunnel" cùng nút "Thay host và gửi lại". Cặp ánh xạ được nhớ **riêng từng user** (Jev 0.96) và có thể xem hoặc sửa trong Settings.
   - **Cảnh báo luôn hiện** (Jev 0.86): khi tunnel chạy, dịch vụ local có thể bị truy cập từ internet. Nên dùng `-a user:pass` nếu dữ liệu nhạy cảm, và Ctrl+C để dừng khi test xong.
   - **Tunnel vừa có mà nay mất** (danh sách không còn, hoặc trả 502/404): báo "Tunnel đã dừng, chạy lại `tunelo http <port>`" và mở lại panel.
   - **Không làm:** Desktop Agent kiểu Postman (Jev 0.00), hay đẩy sự kiện realtime từ Tunelo (Jev 0.05).

## Verification
- Port kèm test của localman cho request-preparer, import-export và snippet generators; tất cả pass trong Localman web.
- Unit cho bộ định tuyến:
  - Có header cấm thì đi proxy.
  - Host đã nhớ là cần proxy thì đi proxy.
  - Gặp TypeError thì chuyển sang proxy (riêng request có secret thì hỏi trước).
  - Ghi đè theo request được tôn trọng.
- E2E định tuyến:
  - Đích có CORS: badge "Trực tiếp" và proxy không nhận request nào (kiểm qua log proxy).
  - Đích không có CORS: tự chuyển proxy, kèm badge.
  - Request có secret: hiện hộp thoại hỏi.
  - Localhost có CORS (dùng `--allow-insecure-localhost` và cấp sẵn quyền LNA cho Playwright): gửi thẳng thành công.
- Test chuyển tiếp: dựng một echo server làm đích. Header tuỳ chỉnh (kể cả `Cookie`, `User-Agent`, header trùng tên) tới đủ và đúng thứ tự. Body binary giữ nguyên byte. `X-Forwarded-For`, `X-Real-IP` và `Forwarded` mang đúng IP client. Không có header hop-by-hop nào và không có `lm_session` tới đích. Request giả `X-Forwarded-For` từ client không tin cậy không thay được IP ghi nhận.
- Test SSRF: các URL `http://127.0.0.1`, `http://169.254.169.254`, `http://[::1]`, `http://10.0.0.1`, domain resolve về IP private và redirect sang IP private đều bị chặn.
- Unit: hàm phát hiện host local (localhost, `127.1`, `[::1]`, `0.0.0.0`, `10.x`, `192.168.x`, `172.16–31.x`, `fe80::`, `fd00::`, IP dạng số thập phân hoặc hex như `2130706433`) và hàm đổi URL giữ nguyên path, query và fragment.
- Integration với Tunelo chạy local (`pnpm dev:server` của repo Tunelo): link, poll, list, revoke. Có tunnel đúng port thì tự đổi URL. Có hai tunnel thì hỏi chọn. Thu hồi xong thì quay về panel.
- E2E: gửi tới `http://localhost:3000/users` khi chưa có tunnel thì hiện panel với lệnh `tunelo http 3000`. Chạy tunnel rồi bấm "Kiểm tra lại" thì tự gửi qua tunnel và có badge. Đường dán URL dự phòng vẫn chạy. Một user khác mở collection được share thì không thấy liên kết hay ánh xạ của user đầu.
- E2E: tạo project mock, chọn "Tạo collection", gửi GET/POST tới mock, response hiện đúng.
- `pnpm check:tokens` sạch.

## Giao việc
**Đợt:** 5 · **Phụ thuộc trước khi bắt đầu:** phase 09 đã lên staging; Đợt 3 (phase 17, 19) xong; Đợt 4 (plan Tunelo 01–03: `GET /api/tunnels` theo tài khoản, link-code, `tunelo-v1.7.0`); `token-exchange.ts` của phase 02 · **Lệnh cook:** `/ak:cook plans/dattqh/261008-1123-localman-core/phase-10-api-client.md`

| # | Việc | Vai trò | Song song | File chính |
|---|---|---|---|---|
| T1 | Chạy `/ak:xia --port` trên `../localman` (bước 1): lập dependency matrix Zustand/Dexie sang TanStack Query và API Mongo, đối chiếu từng màn với prototype `prototype/api-client.html#/workspace` (layout 3 cột, request builder, response viewer, badge đường đi, panel Tunelo) và `#/settings` (Tunelo, host cần proxy, ánh xạ URL); chốt danh sách file vào mục "Files" của phase này. Quyết định nơi đặt logic thuần; khuyến nghị `packages/shared` vì tool MCP `send_request` chạy phía server | fullstack-developer | — | phase file, `prototype/api-client.html` (chỉ đọc), `../localman` (chỉ đọc) |
| T2 | Port logic thuần kèm test gốc: `request-preparer`, `variable-interpolation` (trả kèm cờ "có giá trị secret"), `import-export-service` (cURL, Postman v2.1, OpenAPI 3.0), 16 `snippet-generators`, `script-executor` giữ sandbox QuickJS; cùng hàm phát hiện host local và hàm đổi URL giữ path, query, fragment | fullstack-developer | với T3, T4 | nơi T1 chốt (`packages/shared/src/api-client/*` hoặc `apps/web/src/features/api-client/*`) |
| T3 | Proxy phía server (bước 3b): operation `POST /api/proxy` với envelope, `undici`, giữ thứ tự và header trùng tên, bỏ hop-by-hop và `lm_session`, chuyển tiếp IP qua `X-Forwarded-For`, `X-Real-IP`, `Forwarded` với `trust proxy` theo CIDR, giới hạn redirect, timeout và 10 MB, quota `proxyRequestsPerMonth` ghi vào bộ đếm tháng, log chỉ metadata; `ssrf-guard.ts` kiểm IP sau resolve, ghim IP, kiểm lại mỗi redirect | fullstack-developer | với T2, T4 | `apps/api/src/modules/api-client/{proxy-routes,ssrf-guard}.ts` |
| T4 | History và draft lưu Mongo theo user: `history-model`, `draft-model`, service và operation qua registry | fullstack-developer | với T2, T3 | `apps/api/src/modules/api-client/{history-model,draft-model,history-routes,draft-routes}.ts` |
| T5 | UI request: trang `api-client` 3 cột, request builder (params, headers, body 5 dạng, auth 5 kiểu, tab Scripts), nhiều tab và bản nháp chưa lưu; màu method theo token Radix của phase 01; URL và body dùng font mono | fullstack-developer | với T6 (sau T2, T4) | `apps/web/src/pages/api-client/*`, `apps/web/src/features/api-client/{request,tabs,scripts}/*` |
| T6 | UI response và tiện ích: response viewer (status, timings, size, headers, cookies, body Pretty/Raw/Preview, tìm trong body), history, import/export, code snippet | fullstack-developer | với T5 (sau T2, T4) | `apps/web/src/features/api-client/{response,history,import-export,snippets}/*` |
| T7 | Bộ định tuyến (bước 3): Auto/Trực tiếp/Proxy, header trình duyệt cấm thì đi proxy, nhớ host cần proxy (sửa được trong Settings), `TypeError` thì tự chuyển proxy kèm badge, request có secret thì hỏi trước khi chuyển, ghi đè theo request, badge "Trực tiếp"/"Qua proxy"/"Qua Tunelo"; unit theo các ca ở Verification | fullstack-developer | — (sau T3, T5) | `apps/web/src/features/api-client/routing/*` |
| T8 | Tunelo (bước 4): module server gọi `GET https://tunnel.hoandat.com/api/tunnels` bằng token đổi từ phiên cộng các máy ẩn danh đã liên kết (`/api/links/init`, `/api/links/poll`, token mã hoá AES-256-GCM theo user), cache 10 giây, khớp `localPort`; UI thử gửi thẳng localhost trước, panel Tunelo (lệnh điền sẵn port, "Kiểm tra lại", gợi ý bật CORS, dán URL dự phòng, ánh xạ riêng từng user), chọn khi có nhiều tunnel, báo Basic Auth và TCP, cảnh báo lộ dịch vụ local, xử lý tunnel đã dừng | fullstack-developer | với T9 (sau T7) | `apps/api/src/modules/tunelo/*`, `apps/web/src/features/api-client/tunelo/*`, `apps/web/src/pages/settings/tunelo-*.tsx` |
| T9 | Tích hợp mock: action "Mở trong API Client" trên `node-actions.tsx`, nav "API Client" trong `app-header.tsx`, và "Tạo collection từ project mock" bằng hàm chuyển project mock sang Collection v2.1 rồi mở các request thành tab (phase 12 lưu thành collection qua template "Từ project mock") | fullstack-developer | với T8 | `apps/web/src/features/resource-tree/node-actions.tsx`, `apps/web/src/components/layout/app-header.tsx`, `packages/shared/src/mock-to-collection.ts` |
| T10 | Test: echo server cho chuyển tiếp header, body binary và IP; SSRF (127.0.0.1, 169.254.169.254, `[::1]`, 10.0.0.1, domain resolve về IP private, redirect sang IP private); phát hiện host local; integration với Tunelo chạy local (link, poll, list, revoke); E2E định tuyến (CORS, không CORS, secret, localhost có LNA), panel Tunelo, dán URL, user khác không thấy ánh xạ, mock sang collection | tester | — (sau T8, T9) | `apps/api/src/modules/{api-client,tunelo}/*.test.ts`, `e2e/specs/api-client-*.spec.ts` |
| T11 | Archive repo `achoo254/localman` cũ trên GitHub kèm commit README cuối "Đã chuyển sang achoo254/localman-next" (phase 01, bước 0.2) **(cần user xác nhận)** | fullstack-developer | — (sau T10) | repo `achoo254/localman` |
| T12 | Review cuối phase, ưu tiên SSRF, rò rỉ `lm_session`, giả `X-Forwarded-For`, lưu token Tunelo và hỏi trước khi secret đi qua proxy | code-reviewer | — | toàn phase |

### Checklist
- [x] T1 Xia xong, danh sách file đã chốt và khớp prototype (`plans/dattqh/reports/xia-phase-10-api-client-port.md`)
- [x] T2 Logic thuần đã port kèm test gốc pass
  - [x] T2a Nền `packages/shared/src/api-client/` (2026-10-09): model request/response, zod draft và envelope proxy, nội suy có cờ secret, preparer (auth 5 kiểu, body 5 dạng), host local, URL tunnel, header cấm/hop-by-hop, hằng giới hạn; subpath `@localman/shared/api-client`; 216 test pass. Chưa thêm `quickjs-emscripten-core` và `@jitl/quickjs-wasmfile-release-sync` vào `packages/shared/package.json` (đụng `pnpm-lock.yaml`, để T2c làm khi được duyệt)
  - [x] T2b Import, export, 16 snippet (2026-10-10): `importText` tự nhận cURL (bash, cmd `^`, PowerShell backtick; `-H -d --data-* --data-urlencode --json -F -u -X --url -G -I -A -e -b -m`, gộp cờ ngắn, `Authorization` thành Auth), Collection v2.0/v2.1 (folder lồng, auth `inherit`, raw/urlencoded/form-data/GraphQL/file, event, biến, `followRedirects`), môi trường v2.1, OpenAPI 3.0/3.1 JSON (`{{baseUrl}}` từ server đầu, path/query/header/cookie param, body ví dụ hoặc sinh từ schema, security, folder theo tag); YAML, Swagger 2, Collection v1 báo mã lỗi riêng; giới hạn 10 MB, độ sâu 128, 2.000 mục, `$ref` chỉ nội bộ, không ghi khoá đầu vào vào object (chống `__proto__`). Export Collection v2.1 (khứ hồi bằng nhau trên fixture) và OpenAPI 3.0.3; cURL export là generator cURL. 16 generator đăng ký bằng map tĩnh, escape từng ngôn ngữ (cURL `--data-raw`, PowerShell nháy đơn cả nháy cong, Kotlin/Dart `\$`, Ruby nháy kép `\#`, HTTPie `printf '%s'`, U+2028/2029/0085), header lặp giữ nguyên ở API dạng list; lỗi/cảnh báo/nhãn chỉ là mã. Thêm `apply-collection-variables.ts` (D10). Danh sách generator theo báo cáo (D7), không có Node http/wget. 209 test pass
  - [x] T2c Sandbox QuickJS (2026-10-10): `packages/shared/src/api-client/script-sandbox/` (entry `index.ts`, chưa có subpath export), `createScriptRunner(loadVariant)` tải WASM lazy khi script khác rỗng; toàn bộ `lm.*` và `console` là prelude JS trong VM (host không đưa callback nào vào), `lm.expect` chai-like ném `AssertionError` thật, `lm.test` chạy callback ngay (cả async), test bị ngắt/không xong tính là fail; giới hạn thời gian (interrupt theo deadline), bộ nhớ, stack, độ dài script, 200 dòng log × 4 KB, 200 test, 500 biến; host đọc lại JSON bằng type guard; lỗi `{ code, message, line? }`, script lỗi không đổi request/biến. Stack 512 KB của `limits.ts` không kịp chặn trước stack gốc của V8 (đệ quy, `JSON.stringify` lồng sâu) nên runner bắt `RangeError` của host, bỏ module hỏng và nạp lại. `quickjs-emscripten-core@0.32.0`, devDependency `@jitl/quickjs-wasmfile-release-sync@0.32.0` (wasm 503 KB, gzip 234 KB); 38 test pass
- [x] T3 Proxy và `ssrf-guard` xong (2026-10-10): `client.sendRequest` (`POST /api/v1/proxy`, MCP `send_request`) export ở `apps/api/src/modules/api-client/proxy-operations.ts` (`proxyOperations`), chưa vào registry; dùng `node:http`/`node:https` thay `undici` (không thêm dependency, lockfile đang bị giữ): ghim IP qua `lookup`, SNI qua `servername`, timing qua sự kiện socket, redirect tự làm; SSRF kiểm mọi địa chỉ sau DNS, tự chặn địa chỉ interface của server + `PROXY_BLOCKED_CIDRS` (host mock ở cổng mặc định được miễn, `Host` bị ép theo URL), luôn gửi `X-Localman-Proxy: 1` (nginx `/internal/` trả 403), chặn cổng SMTP 25/465/587; quota `proxyRequestsPerMonth` + rate limit `proxyRateLimit`; nginx `location = /api/v1/proxy`, CSP `connect-src 'self' https: http:`, `'wasm-unsafe-eval'`, bỏ `upgrade-insecure-requests`; 132 test pass
- [x] T4 History và draft phía server xong (2026-10-10): `apps/api/src/modules/api-client/{history,draft,client-settings}-*`, mảng `clientStoreOperations` (15 operation toolset `client`) trong `client-store-operations.ts`, chưa nối vào `registry.ts` (bước T4-wire); history lưu bản nháp còn `{{var}}` cùng tóm tắt response (status, ms, size, route, origin+path của `finalUrl`), TTL 90 ngày, tối đa 500/user, mục > 256 KB bỏ raw body (`bodyOmitted`); draft ≤ 1 MB, ≤ 50 tab, upsert theo `tabId`, `PUT /client/draft-order`; settings: host cần proxy (≤ 200), ánh xạ tunnel (≤ 100, key chuẩn hoá `localhost:port`), `defaultRoute`, `sendClientIp`; 27 test integration pass
- [x] T5 UI request builder, tab và scripts xong (2026-10-10): trang `/api-client` theo cờ `apiClient` (nav "API Client" ở top bar, `AppShell` biến thể workbench qua `handle: WORKBENCH_HANDLE`: cao full, không footer), lưới rail + sidebar (History của T6, Import/Export) | request | response (`ResponsePanel` của T6), màn hẹp xếp dọc; nhiều tab (tablist ←/→/Home/End, Delete đóng, dấu chấm khi có sửa, hỏi trước khi đóng tab đã sửa), bản nháp lưu server debounce 800 ms kèm `order`, Ctrl/Cmd+S lưu ngay, khôi phục khi tải lại, DELETE khi đóng; request builder: method màu theo `lib/method-tone.ts`, URL mono tô `{{var}}` đồng bộ hai chiều với Params, dán cURL thì hỏi import, Headers (bảng + header tự sinh), Auth 5 kiểu, Body 5 dạng (raw qua `CodeEditor` mới với grammar tải lazy, form-data có file, binary ≤ 10 MB), Scripts pre/post với snippet `lm.*`, Settings (IP client, redirect, timeout), ô đường đi Auto/Direct/Proxy lưu vào `settings.route`; gửi tạm luôn qua proxy (`createProxySender`, QuickJS chỉ tải khi có script, chạy trên main thread) rồi ghi history; hợp đồng `workbench-types.ts` + `useWorkbench()` cho T6/T7; dependency `@jitl/quickjs-wasmfile-release-sync@0.32.0`, `@codemirror/lang-{javascript,xml,html}`; 56 test của T5 pass, full suite web 631/631
- [x] T6 UI response, history, import/export và snippet xong (2026-10-10): `features/api-client/response/` (`ResponsePanel` nhận `TabResponse` của workbench: status theo tone, timings, size, badge đường đi hoặc slot `routeBadge`, Body Pretty/Raw/Preview có tìm kiếm, HTML trong iframe `sandbox=""`, ảnh qua blob URL, JSON dạng bảng, nhị phân/bị cắt thì báo và cho lưu file, Headers, Cookies parse `Set-Cookie`, Tests từ post-response script, lỗi proxy kèm gợi ý và mã); `history/` (`HistorySidebar`, nhóm ngày theo Asia/Saigon, tìm, lọc method, phân trang cursor, xoá từng mục, xoá hết có dry run và xác nhận; `history-api.ts` có `recordHistoryEntry` cho T7); `import-export/` (`ImportModal` dán hoặc chọn file, tự nhận định dạng, lỗi/cảnh báo theo mã, chọn request mở tab với biến collection và auth `inherit` đã điền; `ExportMenu` Collection v2.1, OpenAPI 3.0, environment không ghi giá trị secret); `snippets/CodeSnippetModal` (16 ngôn ngữ, copy, cảnh báo secret); namespace i18n `apiClientTools` (en, vi, zh-CN); 61 test pass
- [x] T7 Bộ định tuyến và badge xong (2026-10-10): `features/api-client/routing/` thay sender proxy-only của T5 (`createRoutedSender`, gắn ở `api-client-page.tsx` qua `useRouter`). `route-plan.ts` (thuần): Auto gửi thẳng `fetch` (`credentials:"omit"`, timeout của tab, `targetAddressSpace` cho LNA), đi proxy khi có header trình duyệt cấm, "Theo redirect" tắt, host ghim "Luôn qua proxy" (server `routingHosts`) hoặc origin trong cache CORS; Direct/Proxy ghi đè theo request và theo nút thử lại (`SendOptions.route`). `TypeError` thì tự gửi lại qua proxy và nhớ origin vào cache CORS của trình duyệt (localStorage, 24 giờ, chỉ ghi khi proxy tới được đích); POST "simple" có thể đã tới đích thì không tự gửi lại (`DIRECT_NOT_RETRIED`). Địa chỉ local không bao giờ đi proxy: thử thẳng, rồi tunnel nếu có ánh xạ, không thì panel Tunelo (`TUNNEL_REQUIRED`). Request mang thông tin xác thực (header `Authorization`/`Cookie`, API key, biến secret) mà router tự chuyển sang proxy/tunnel thì hỏi trước (`SecretConsentModal`, "Không hỏi lại" theo host lưu ở `secretProxyHosts`), từ chối thì `ROUTE_CONSENT_DECLINED`. `RoutedResponsePanel`: badge "Trực tiếp/Qua proxy · CORS chặn/Qua Tunelo" kèm lý do, ghi chú khi tự chuyển hoặc header bị bỏ, nút "Gửi qua proxy"/"Thử qua Tunelo"/"Dùng Auto", "Xem gói" khi hết quota; `RouteMark` cho history. Script chạy trong Web Worker (`platform/script-host.ts`, `script-worker.ts`: hàng đợi, hạn cứng sau deadline QuickJS rồi `terminate()`, main thread chỉ khi không có `Worker`); `vite.config.ts` `worker.format="es"`, `optimizeDeps.exclude` QuickJS. Sidebar rail thêm mục Định tuyến (route mặc định cho tab mới, host luôn qua proxy, host đồng ý secret, xoá cache CORS). Backend: `client-settings` thêm `secretProxyHosts` (2 operation miễn MCP) và `tunnelMappings[].enabled`; namespace `apiClientRouting`
- [x] T8 Tự nhận tunnel, liên kết máy ẩn danh và panel Tunelo xong
  - [x] T8a Tunelo thủ công (2026-10-10): `features/api-client/tunelo/`: mục Tunelo trong sidebar rail (lệnh `npm install -g tunelo`, `tunelo login`, `tunelo http <port>` theo `packages/tunelo-cli/README.md`, cảnh báo lộ dịch vụ local, form gắn địa chỉ local với URL tunnel `https://<tên>.tunnel.hoandat.com|tunnel.inetdev.io.vn`, danh sách ánh xạ bật/tắt/xoá lưu ở client settings), panel Tunelo thay vùng response cho địa chỉ local không tới được (lý do, lệnh điền port, "Gửi lại", dán URL rồi lưu ánh xạ và gửi lại, gợi ý CORS cho Express/Vite/Next.js/Spring/Laravel), badge "Qua Tunelo" trên ô URL (URL thật trong tooltip, bỏ ánh xạ); request tới URL local có ánh xạ được viết lại sang tunnel giữ path/query/fragment, route `tunelo`; namespace `apiClientTunelo`
  - [x] T8b Tự nhận tunnel theo tài khoản (hoãn). Khi làm phải kiểm luôn phần Verification chuyển sang đây: Tunelo local link, poll, list, revoke; một tunnel thì tự đổi URL, hai tunnel thì hỏi chọn, thu hồi xong thì về panel; chạy tunnel rồi "Kiểm tra lại" thì tự gửi qua tunnel có badge
    - 2026-10-17 code xong sau cờ `tuneloAccounts` (server `TUNELO_ACCOUNTS_ENABLED`, web `VITE_FEATURES`), chưa phát hành: `apps/api/src/modules/tunelo/`, `features/api-client/tunelo/{choose-tunnel-modal,tunelo-connect-modal,tunnel-links-section,auto-tunnel*}`, `routing/auto-tunnel-hop.ts`. Kiểm: lint (2919 file), typecheck, 708 file / 5018 test, `check:mcp-coverage` (227 operation, 183 tool, 44 exempt), E2E `api-client-tunelo-accounts` + `api-client-tunelo` + `api-client-routing` 12/12 với Tunelo giả theo đúng contract `GET /api/tunnels`, `/api/links/*`. SAST `reports/code-reviewer-261017-2130-tunelo-auto-claim-sast.md`: không có Critical/High, đã sửa 2 Medium (tunnel tự tìm luôn hỏi trước khi gửi secret; giới hạn 5 lượt liên kết mỗi 10 phút mỗi user) và L1–L4, L6; "Kiểm tra lại" trong 2 giây chờ đủ 2 giây rồi đọc mới.
    - 2026-10-17/19 lên production theo yêu cầu của user: release `20261017-162354-0322effc5e7a`, `TUNELO_ACCOUNTS_ENABLED=true`, cờ web `tuneloAccounts`. DAST đạt với Tunelo thật (`reports/security-261019-0830-tunelo-accounts-dast.md`): một tunnel tự gửi có badge, tunnel dừng thì báo và mở panel, một lần bấm gửi lại, secret qua tunnel tự tìm luôn hỏi trước, CSRF, giới hạn 5 lượt liên kết, không lộ token. Chưa đo trên prod: hai tunnel thì hỏi chọn (hạn mức tunnel của tài khoản) và `tunelo link` thành công (máy thử chỉ có token ẩn danh không gắn máy); hai trường hợp này có E2E. Phát hiện Low: `tunelo link` của CLI 1.9.0 chặn máy có phiên của server khác; chữ "kiểm tra lại" khác nút "Gửi lại". Giới hạn 20 lượt liên kết mỗi 10 phút theo IP của Tunelo vẫn dùng chung cho mọi user Localman; sửa tận gốc cần đổi phía Tunelo.
- [x] T9 Mở trong API Client và tạo collection từ mock xong (2026-10-10): `apps/web/src/features/api-client/open-in/`. Hàm thuần `mockRequestsOf`/`listRequestOf` dựng request từ `GET /projects/:projectId/mock-urls` (nguồn duy nhất của path, prefix, nested và endpoint đang bật), ID ổn định `mock:<resourceId>:<method>:<scope>`, path param thành `{{id}}`/`{{userId}}`. Mock nhận project qua secret trong base URL nên không thêm header. Hàm đặt ở web, chưa ở `packages/shared` như plan ghi. Có action "API Client" trên node resource (`resource-node-{id}-client`) và nút "Open in API Client" ở card API endpoint (`project-detail-open-client`), cả hai theo cờ `apiClient`; trang project chỉ truyền id qua `navigate` state, `/api-client` tự tải mock URL, mở tab khi bản nháp đã khôi phục xong, rồi xoá state bằng `replace`. Nút "From mock project" (`editor-empty-from-mock`, modal `modal-from-mock`) mở mọi request CRUD; vượt 50 tab thì cắt bớt và báo toast. Namespace i18n `apiClientOpen`; 22 test
- [x] T10 Test chuyển tiếp, SSRF, Tunelo và E2E pass (2026-10-10): 4 spec mới `e2e/specs/api-client-{routing,mock,tunelo,workbench}.spec.ts` (14 test) trên echo server `e2e/support/echo-server.ts` (:4640): gửi thẳng có CORS, theo redirect, POST không CORS không tự sang proxy, hỏi trước khi gửi Cookie, cổng 25 bị chặn `PROXY_TARGET_BLOCKED`, mở mock từ trang project, ánh xạ Tunelo viết lại URL và tách theo tài khoản, nháp còn sau tải lại, history mở lại tab, dán cURL, script pre/post chạy QuickJS thật trong worker, axe không có lỗi serious. Toàn bộ E2E 19/19. Lỗi thật tìm ra: proxy dev của Vite `"/api"` nuốt route `/api-client` (đổi thành `/api/`), `*.localhost` khai `targetAddressSpace` sai (`isLoopbackTarget`), chữ cái avatar làm lệch tên truy cập của nút tài khoản (vẽ bằng CSS, nhãn đổi thành `{name} · Account`). Ma trận SSRF đã có ở test unit proxy/ssrf-guard
- [ ] T11 Repo `localman` cũ đã archive sau khi user xác nhận
- [x] T12 Review không còn finding chặn (2026-10-10): `plans/dattqh/reports/review-phase-10-api-client.md` 4 High, 6 Medium, 10 Low, đã sửa hết High và Medium. Tunnel `*.tunnel.inetdev.io.vn` trỏ về chính server nên proxy được phép tới host `<label>.<TUNNEL_DOMAINS>` (https:443, ép Host); server kiểm URL tunnel theo `TUNNEL_DOMAINS` và trả `tunnelDomains`; 5 operation đổi nơi gửi credential thành miễn MCP; nginx `/api/v1/client/` 2m, CSP `img-src blob:`; proxy giới hạn 4 request/user, 32/process (`PROXY_BUSY`), huỷ khi client đóng (`OperationContext.signal`), giải nén không giữ hai buffer; Auto không tự gửi lại POST/PATCH (nút "Gửi qua proxy" nhớ origin vào cache CORS), đồng ý secret theo host thật, history che secret literal, nháp flush `keepalive` và thử lại, tách context giảm re-render. Còn lại: L7 cache CORS theo trình duyệt (chấp nhận), L8 query có `{{var}}` vẫn mã hoá lại
- [x] Verification: test port từ localman (request-preparer, import-export, snippet) pass (2026-10-12: `request-preparer*.test.ts`, `export/*.test.ts`, `snippets/*.test.ts` trong full suite 4087/4087)
- [x] Verification: unit định tuyến (header cấm, host đã nhớ, TypeError chuyển proxy, secret thì hỏi, ghi đè) pass (2026-10-12: `routing/route-plan.test.ts`, `routed-sender*.test.ts`)
- [x] Verification: E2E định tuyến: đích có CORS đi thẳng và proxy không nhận request; không CORS thì tự chuyển kèm badge; có secret thì hiện hộp thoại; localhost có CORS gửi thẳng thành công (2026-10-12: `api-client-routing.spec.ts` 5/5. "Không CORS thì tự chuyển" chỉ kiểm được ở unit `routed-sender.test.ts`, vì echo server E2E là localhost mà localhost theo thiết kế không bao giờ đi proxy; review T12 cũng đổi thiết kế: Auto không tự gửi lại POST/PATCH, E2E kiểm đúng hành vi đó)
- [x] Verification: echo server nhận đủ header đúng thứ tự, body binary nguyên byte, đúng IP client; không có hop-by-hop hay `lm_session`; `X-Forwarded-For` giả từ client không tin cậy không đổi IP ghi nhận (2026-10-12: `proxy-forwarding.test.ts`, `proxy-headers.test.ts`, `proxy-operation.test.ts`)
- [x] Verification: mọi URL SSRF trong danh sách bị chặn; hàm phát hiện host local đúng mọi dạng (kể cả `127.1`, `2130706433`) (2026-10-12: `ssrf-guard*.test.ts`, `local-host.test.ts`)
- [x] Verification: Tunelo local: link, poll, list, revoke; một tunnel thì tự đổi URL, hai tunnel thì hỏi chọn, thu hồi xong thì về panel (2026-10-19: list và một tunnel trên prod với Tunelo thật; link, poll, revoke và hai tunnel bằng E2E với Tunelo giả theo đúng contract)
- [x] Verification: `http://localhost:3000/users` chưa có tunnel thì hiện `tunelo http 3000`; chạy tunnel rồi "Kiểm tra lại" thì gửi qua tunnel có badge; dán URL vẫn chạy; user khác không thấy ánh xạ (2026-10-12: `api-client-tunelo.spec.ts` 3/3 cho panel, dán URL và tách theo tài khoản; vế "Kiểm tra lại" tự nhận tunnel chuyển sang T8b)
- [x] Verification: tạo project mock, "Tạo collection", gửi GET/POST tới mock, response đúng (2026-10-12: `api-client-mock.spec.ts` 2/2, thêm test "From mock project" gửi POST trả 201 và mock có thêm 1 bản ghi)
- [x] Verification: `pnpm check:tokens` sạch (2026-10-12)
- [x] `pnpm lint && pnpm typecheck && pnpm test` sạch (2026-10-12: lint 2319 file, test 567 file / 4087 test)
- [x] `pnpm check:mcp-coverage` pass (2026-10-12)
