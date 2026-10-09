---
phase: 10
title: "API Client: lõi gửi request và proxy"
status: pending
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
- [ ] T2 Logic thuần đã port kèm test gốc pass
- [ ] T3 Proxy và `ssrf-guard` xong
- [ ] T4 History và draft phía server xong
- [ ] T5 UI request builder, tab và scripts xong
- [ ] T6 UI response, history, import/export và snippet xong
- [ ] T7 Bộ định tuyến và badge xong
- [ ] T8 Tự nhận tunnel, liên kết máy ẩn danh và panel Tunelo xong
- [ ] T9 Mở trong API Client và tạo collection từ mock xong
- [ ] T10 Test chuyển tiếp, SSRF, Tunelo và E2E pass
- [ ] T11 Repo `localman` cũ đã archive sau khi user xác nhận
- [ ] T12 Review không còn finding chặn
- [ ] Verification: test port từ localman (request-preparer, import-export, snippet) pass
- [ ] Verification: unit định tuyến (header cấm, host đã nhớ, TypeError chuyển proxy, secret thì hỏi, ghi đè) pass
- [ ] Verification: E2E định tuyến: đích có CORS đi thẳng và proxy không nhận request; không CORS thì tự chuyển kèm badge; có secret thì hiện hộp thoại; localhost có CORS gửi thẳng thành công
- [ ] Verification: echo server nhận đủ header đúng thứ tự, body binary nguyên byte, đúng IP client; không có hop-by-hop hay `lm_session`; `X-Forwarded-For` giả từ client không tin cậy không đổi IP ghi nhận
- [ ] Verification: mọi URL SSRF trong danh sách bị chặn; hàm phát hiện host local đúng mọi dạng (kể cả `127.1`, `2130706433`)
- [ ] Verification: Tunelo local: link, poll, list, revoke; một tunnel thì tự đổi URL, hai tunnel thì hỏi chọn, thu hồi xong thì về panel
- [ ] Verification: `http://localhost:3000/users` chưa có tunnel thì hiện `tunelo http 3000`; chạy tunnel rồi "Kiểm tra lại" thì gửi qua tunnel có badge; dán URL vẫn chạy; user khác không thấy ánh xạ
- [ ] Verification: tạo project mock, "Tạo collection", gửi GET/POST tới mock, response đúng
- [ ] Verification: `pnpm check:tokens` sạch
- [ ] `pnpm lint && pnpm typecheck && pnpm test` sạch
- [ ] `pnpm check:mcp-coverage` pass
