# Review phase 10: API client trên web

Ngày: 2026-10-10. Reviewer: code-reviewer (chỉ đọc).

## Phạm vi

- Đã commit: `85c2530` (lõi shared), `8ef5e76` (proxy, SSRF, history, draft, settings, nginx/CSP).
- Chưa commit: `apps/web/src/features/api-client/**`, `pages/api-client/**`, `platform/script-*`, `platform/file-read.ts`, client-settings (`secretProxyHosts`, `enabled`), resource-tree và project-detail, i18n, `vite.config.ts`.
- Bỏ qua: notifications, Tunelo server/CLI.
- Đã chạy:
  - `biome check` trên các thư mục trong phạm vi: **1 lỗi** (thứ tự import ở `api-client-screen.tsx`).
  - `pnpm check:i18n`: sạch (không có tên đối thủ, không có tiếng Việt ngoài từ điển `vi`).
  - `pnpm check:tokens`: không có vi phạm.
  - Không có file nào trong phạm vi quá 200 dòng. Grep không thấy `any` hay non-null `!`.
- Không chạy `pnpm test`, `typecheck` hay e2e, vì agent khác đang chạy e2e `api-client-routing.spec.ts`.

## Đánh giá chung

Phần SSRF guard làm kỹ: ghim IP qua `lookup`, kiểm mọi địa chỉ, kiểm lại ở mỗi redirect, chặn IPv4-mapped, NAT64, 6to4, chặn địa chỉ của chính server, ngoại lệ host mock có ép `Host`. Mình không tìm được cách vượt bằng redirect hay DNS rebinding. Header gửi đi chỉ lấy từ envelope, nên `lm_session` không rò ra đích.

Các lỗi chặn nằm ở bốn chỗ:
1. Router tự gửi lại request đã tới đích (gửi trùng).
2. Mô hình tin cậy của ánh xạ tunnel và các thiết lập ghi được qua MCP.
3. Giới hạn của nginx production lệch với giới hạn trong code: test và e2e không đi qua nginx nên không bắt được.
4. Proxy không có trần đồng thời, nên có thể bị dùng để làm cạn bộ nhớ.

---

## Critical

Không có.

## High

### H1. Auto tự gửi lại request đã tới đích (gửi trùng POST/PUT/DELETE)

- `apps/web/src/features/api-client/routing/direct-fetch.ts:129-153`
- `apps/web/src/features/api-client/routing/direct-hop.ts:86-97`

**Kịch bản 1: lỗi khi đọc body.** `directFetch` gộp mọi lỗi trong `try` thành `{ kind: "blocked" }`, kể cả lỗi khi đọc body ở `readBody`, tức là sau khi `fetch` đã trả về response (chính comment ở dòng 152 ghi "or the body stream cut mid-way"). Ví dụ: `PUT /orders/1` gửi thẳng, đích đã xử lý và trả 200, rồi kết nối bị reset giữa body. Auto coi đó là "CORS chặn", gọi `viaProxy(ctx, "cors")` và gửi lại `PUT` qua proxy. Kết quả: thao tác chạy hai lần, và origin bị ghi vào cache CORS 24 giờ.

**Kịch bản 2: target local.** Nhánh local ở dòng 87-92 chuyển sang tunnel **trước** khi kiểm `mayHaveReachedTarget` (dòng 93). Ví dụ: một POST "simple" (`Content-Type: text/plain` hoặc form-urlencoded) tới `http://localhost:3000`. Server local nhận và chạy request nhưng không trả CORS, nên trình duyệt báo `TypeError`. Router gửi lại qua tunnel, POST chạy lần hai. Plan yêu cầu không tự gửi lại POST, và nhánh không-local đã làm đúng điều này.

**Cách sửa:**
- Tách hai loại lỗi: `fetch` reject trước khi có response (mới là `blocked`) và lỗi sau khi đã có `Response`. Lỗi sau phải trả về lỗi của tab, không fallback.
- Đưa kiểm `mayHaveReachedTarget` lên trước nhánh `local`.
- Thêm test: body stream lỗi sau khi có header thì không gọi `proxy`; POST simple tới localhost thì không gọi tunnel.

### H2. Ánh xạ tunnel và thiết lập do MCP ghi có thể đưa credential tới host lạ mà không hỏi

- `apps/api/src/modules/api-client/client-settings-input.ts:60-73`
- `apps/api/src/modules/api-client/client-settings-operations.ts:66-82` và `:152-168` (`mcp: true`)
- `apps/web/src/features/api-client/routing/use-router.tsx:40-50`
- `apps/web/src/features/api-client/routing/route-hops.ts:43,103-118`
- `apps/web/src/features/api-client/routing/secret-consent-modal.tsx:83-86`

Chuỗi đã xác minh:
1. Server `normalizeTunnelUrl` nhận **mọi** URL http(s) công khai. Chỉ form trên web giới hạn ở `*.tunnel.hoandat.com` hoặc `tunnel.inetdev.io.vn` (`tunelo-commands.ts:27`), và server cho cả `http:`.
2. `client.setTunnelMapping` mở cho MCP. Một agent bị prompt-injection có thể đặt `localhost:3000 → https://evil.example`.
3. `toSnapshot` dùng URL từ server, không kiểm lại domain.
4. Đồng ý gửi secret được nhớ theo **key local** (`secretHosts.has(key)`), không theo origin của tunnel. User từng tick "Không hỏi lại" cho `localhost:3000` thì sau khi ánh xạ bị đổi, `Authorization`/`Cookie` đi thẳng tới host lạ mà không hỏi.
5. Kể cả khi có hỏi, modal chỉ hiện `ask.host = localhost:3000`, không hiện origin tunnel thật.
6. Tương tự, `client.updateClientSettings` (MCP) đặt được `defaultRoute: "proxy"`. Tab mới khi đó có `route: proxy`, `planRoute` trả `why: "manual"`, và `consent()` bỏ qua câu hỏi ở `route-hops.ts:43`.

**Cách sửa:**
- Server kiểm URL tunnel theo danh sách domain Tunelo (cùng hằng `TUNELO_DOMAINS`, đặt trong `packages/shared`) và chỉ cho `https:`.
- Key của `secretProxyHosts` cho tunnel là origin tunnel (hoặc cặp `key→url`). Đổi URL thì mất đồng ý.
- Modal hiện origin đích thật.
- Cân nhắc bỏ MCP khỏi `setTunnelMapping` và `updateClientSettings`, hoặc ít nhất coi `defaultRoute=proxy` là chưa có đồng ý: chỉ bỏ qua câu hỏi khi user đổi route ngay trên tab, hoặc bấm nút "Gửi qua proxy".

### H3. nginx production chặn draft và history lớn hơn 128 KB

- `infra/localman/nginx/localman.hoandat.com.conf:108` (`client_max_body_size 128k` ở cấp server; `location /api/` ở dòng 152-155 kế thừa)
- `apps/api/src/modules/api-client/draft-size.ts:11` (1 MB)
- `apps/api/src/modules/api-client/history-service.ts:18` (256 KB)
- `draft-operations.ts:63` và `history-operations.ts:120` (`bodyLimit: DRAFT_BODY_LIMIT`)

**Kịch bản:** tab có body raw JSON 200 KB. `PUT /api/v1/client/drafts/:id` bị nginx trả 413 dạng HTML. Thanh trạng thái báo lỗi chung, và bản nháp mất khi tải lại. `POST /client/history` cũng 413, nên mọi request có body lớn hơn khoảng 128 KB không vào history. Nhánh `bodyOmitted` (256 KB) không bao giờ được chạy. CI và e2e không thấy lỗi này vì không đi qua nginx.

**Cách sửa:** thêm `location ~ ^/api/v1/client/(drafts|history)` với `client_max_body_size 2m` (hoặc khớp `DRAFT_BODY_LIMIT`), và ghi vào `docs/deployment-guide.md`.

### H4. Proxy không có trần đồng thời và không huỷ upstream khi client huỷ: một tài khoản Free làm cạn được RAM của process API (PLAUSIBLE về quy mô)

- `apps/api/src/modules/api-client/proxy-forwarder.ts:126` (chỉ có `AbortSignal.timeout`, không gắn với việc request của client bị đóng)
- `proxy-response-body.ts:95-98` (giữ đồng thời bản thô **và** bản đã giải nén, mỗi bản tối đa 10 MB)
- `config/runtime-settings.ts:112` (120 request/phút/user)
- `limits.ts:21` (timeout 120 giây)
- `packages/operations` không truyền signal vào handler.

**Kịch bản:** đích do kẻ tấn công dựng, trả gzip nhỏ giọt rồi đẩy đủ 10 MB ngay trước 120 giây. Với 120 request/phút, sau 1 phút có khoảng 120 request treo cùng lúc. Mỗi request giữ 20 MB buffer, cộng chuỗi utf8/base64 và JSON khoảng 13 MB, tổng cỡ 4 GB. Process này phục vụ cả dashboard (:4000) lẫn mock runtime (:4100, `main.ts`), nên OOM làm sập cả hai. Nhiều tài khoản thì nhân lên. Huỷ request trên web cũng không giải phóng gì phía server. Phần cơ chế đã xác minh; con số bộ nhớ là ước tính.

**Cách sửa:**
- Đặt semaphore đồng thời theo user (ví dụ 4) và toàn process (ví dụ 32), trả 429.
- Huỷ upstream khi `req` hoặc `res` của client đóng, bằng `AbortSignal.any([timeout, clientClosed])`.
- Bỏ collector thô khi đã có decoder: nếu giải nén lỗi thì trả lỗi, hoặc chỉ giữ 64 KB đầu.
- Cân nhắc thêm `limit_conn` cho `location = /api/v1/proxy`.

## Medium

### M1. CSP chặn preview ảnh trong production

- `infra/localman/nginx/localman.hoandat.com.conf:145` (`img-src 'self' data: https:`, không có `blob:`)
- `apps/web/src/features/api-client/response/body-preview.tsx:9-19,35`

`<img src="blob:…">` bị CSP chặn, vì `'self'` không khớp scheme `blob:`. Kết quả: tab Preview của response ảnh trống trong production, còn jsdom và Vite dev không có CSP này nên test vẫn pass.

**Cách sửa:** thêm `blob:` vào `img-src`. An toàn vì `<img>` không chạy script, và tài liệu blob vẫn kế thừa CSP. Hoặc dùng `data:` URL cho ảnh nhỏ.

### M2. Credential gõ tay nằm plaintext trong history 90 ngày và đọc được qua MCP

- `apps/web/src/features/api-client/workbench/record-send.ts:24`
- `apps/api/src/modules/api-client/history-operations.ts:61-95` (`listHistory`, `getHistoryEntry` đều `mcp: true`)

Phase 10 chưa có environment hay biến secret, nên token Bearer, mật khẩu Basic, giá trị API key và header `Authorization`/`Cookie` mà user gõ đều nằm nguyên văn trong `draft`. Draft đó được ghi vào `client_history` (TTL 90 ngày) và trả cho mọi MCP token. URL mock chứa secret project cũng vào history và vẫn còn sau khi rotate. Commit ghi "the server never holds substituted secret values": câu này đúng với giá trị được thay vào biến, nhưng không đúng với giá trị gõ thẳng.

**Cách sửa:** trước khi ghi history, che các trường auth (`token`, `password`, giá trị `apikey`) và giá trị của header nhạy cảm nếu chúng không phải `{{var}}`, ví dụ thay bằng `••••` kèm cờ `redacted`. Draft thì có thể giữ nguyên, vì cần cho việc khôi phục.

### M3. Câu hỏi "gửi secret qua proxy" bỏ sót credential nằm ngoài tab Auth

- `apps/web/src/features/api-client/routing/sensitive-parts.ts:12-35`

Code chỉ nhận ra `Authorization`, `Cookie`, `Proxy-Authorization`, API key trong tab Auth, và `secretsUsed`. Ở phase 10, `secretsUsed` luôn rỗng vì scope chỉ có `lm.variables`. Các trường hợp như header `X-API-Key: sk_live…` gõ ở tab Headers, hay `?access_token=…` trong URL, đều chuyển sang proxy sau CORS mà không hỏi. Docstring còn lấy `X-API-Key` làm ví dụ, dễ khiến người đọc tưởng header này đã được bắt.

**Cách sửa:** thêm heuristic theo tên header hoặc query (`*api[-_]?key*`, `*token*`, `*secret*`, `x-auth*`, `access_token`, `sig*`) và test cho từng dạng.

### M4. Bản nháp sửa trong 800 ms cuối mất khi đóng tab trình duyệt

- `apps/web/src/features/api-client/workbench/use-draft-sync.ts:122-134`
- `api/draft-api.ts:53-62`
- `lib/api-client.ts:79` (`fetch` không có `keepalive`)

`pagehide` và `visibilitychange` gọi `flush()`, nhưng `fetch` thường bị huỷ khi document unload. Ngoài ra, lưu lỗi (409, 413, mạng) không được thử lại: `seen` đã ghi nhận draft, nên chỉ lần sửa sau mới lưu lại.

**Cách sửa:**
- Dùng `keepalive: true` cho PUT draft lúc ẩn trang, kèm fallback khi body lớn hơn 64 KB, vì giới hạn keepalive là 64 KB.
- Khi lưu lỗi, xoá `seen` của tab để lần render sau lên lịch lưu lại.

### M5. Cả workbench re-render mỗi phím gõ (PLAUSIBLE về độ giật)

- `apps/web/src/features/api-client/workbench/workbench-context.tsx:117-135`
- Không có `React.memo` nào trong `features/api-client`.

`value` của context đổi mỗi lần `editDraft`, nên `HistorySidebar`, `TabBar` (tới 50 tab), `ExportMenu` (prop `tabs.map(...)` mới mỗi render) và `RoutedResponsePanel` đều render lại. Nếu response là JSON đã tô màu gần 200k ký tự, React phải duyệt hàng chục nghìn `<span>` mỗi phím.

**Cách sửa:** tách context thành state, actions và activeTab, đặt `memo` cho panel response, sidebar và tab bar, và tính export list theo kiểu lazy khi mở menu.

### M6. Lint đỏ, chặn gate của phase

- `apps/web/src/pages/api-client/api-client-screen.tsx:11-13`

Biome báo sai thứ tự import: `snippets/code-snippet-modal` phải đứng sau `routing/routed-response-panel`. `pnpm lint` sẽ fail. Sửa bằng `biome check --write` cho file này.

## Low

- **L1.** `workbench-reducer.ts:96-106`: `restore` không giữ trần 50 tab. Nếu user mở hoặc import tab trước khi `listDrafts` trả về, tổng tab có thể quá 50. Server trả 409 cho các tab thừa và thanh trạng thái báo lỗi. Sửa bằng cách cắt theo `DRAFT_MAX_TABS` khi restore, hoặc khoá thao tác mở tab khi `syncStatus=loading`.
- **L2.** `draft-service.ts:84-88`: khi đang có 49 bản ghi mà hai request tạo mới chạy cùng lúc, cả hai thấy count là 51, cả hai tự xoá, và cả hai đều thất bại dù một trong hai lẽ ra phải thành công. Chấp nhận được, hoặc chuyển sang chỉ xoá bản có `_id` lớn hơn.
- **L3.** `api-client-screen.tsx:58-60`: mở history khi đã đủ 50 tab thì không có phản hồi gì, vì `openTab` trả `null`. Nên hiện toast giống `use-open-mock-requests`.
- **L4.** `use-router.tsx:78` và `secret-consent-modal.tsx:41-47`: một yêu cầu đồng ý bị huỷ (đóng tab, Cancel) trong lúc modal đang mở thì không đi qua `answer()`, nên ô "Không hỏi lại" giữ trạng thái đã tick cho câu hỏi kế tiếp, với một host khác. Sửa bằng cách reset `remember` khi `ask` đổi, ví dụ đặt `key={ask.host}` hoặc dùng effect.
- **L5.** Code trùng: `response/body-file.ts:5-23` gần như chép lại `platform/download.ts:5-20`. Nên gộp thành `downloadBlob(filename, blob)` trong `platform/`. Tương tự, `script-messages.ts:21` tự viết `isObject` trong khi đã có `lib/json-guards.isRecord`.
- **L6.** `workbench-context.tsx:85,91`: `WorkbenchProvider` vẫn mặc định dùng `createProxySender` (đi proxy, không hỏi đồng ý). Trang thật truyền router nên chưa ai chạm tới, nhưng đây là đường gửi secret qua proxy mà không hỏi, chỉ chờ người dùng sau cắm vào. Nên bắt buộc prop `sender`, hoặc mặc định dùng router.
- **L7.** `direct-hop.ts:93-95`: `remember(origin)` được ghi cả khi `DIRECT_NOT_RETRIED`, trái mô tả "chỉ ghi khi proxy tới được đích" ở plan T7. Thêm nữa, `cors-cache.ts:14` không tách theo tài khoản: trên máy dùng chung, user sau thấy danh sách origin của user trước trong Settings > Định tuyến.
- **L8.** `packages/shared/src/api-client/url-params.ts:48-61`: khi đã có params (luôn có nếu URL có query), query được dựng lại bằng `URLSearchParams`. Kết quả: `?wsdl` thành `?wsdl=`, `%zz` thành `%25zz`, `~` thành `%7E`, `,` thành `%2C` (đã chạy thử bằng node). URL gửi đi khác URL user thấy, nên có thể hỏng URL ký sẵn hoặc API phân biệt `?flag` với `?flag=`. Nên giữ nguyên văn cặp chưa bị sửa trong bảng.
- **L9.** `platform/script-host.ts:59` và `response/script-results.tsx:29-36`: lỗi của post-script hiện `error.message` thô tiếng Anh (ví dụ "Script worker stopped (SCRIPT_TIMEOUT)"), trong khi pre-script đã map theo `code` qua `t()`. Nên dùng `scriptErrorMessage` cho cả hai.
- **L10.** D2 trong báo cáo xia ghi "MCP `send_request` tự ghi envelope". `proxy-operations.ts:62-83` không ghi. Việc không ghi là an toàn hơn, vì envelope chứa giá trị đã thay biến, nhưng cần cập nhật D2 hoặc plan cho khớp.

---

## Các mục đã kiểm và không có vấn đề

- **SSRF:**
  - Redirect: mỗi hop đều `pin` lại (`proxy-forwarder.ts:102`).
  - DNS rebinding: `pinnedLookup` trả đúng địa chỉ đã kiểm cho cả `all: true` lẫn `all: false`; `agent: false`.
  - IP literal: các dạng `0x7f.1`, `2130706433`, `[::ffff:127.0.0.1]` bị chặn.
  - Header: hop-by-hop và `Content-Length` của user bị bỏ, marker `X-Localman-Proxy` luôn có, `lm_session` không đi ra.
- **Bom giải nén:** cap 10 MB tính trên bytes đã giải nén. Phần bộ nhớ xem H4.
- **Preview HTML:** iframe `sandbox=""` cùng `srcDoc` (CSP kế thừa). Blob URL được revoke khi đổi response hoặc unmount (`body-preview.tsx:17`); `downloadBytes` revoke ở tick sau. Ảnh SVG chỉ nằm trong `<img>`.
- **Script:**
  - QuickJS trong Worker; `lm.*` là prelude, host không đưa callback, `fetch` hay DOM vào VM.
  - Host có hạn cứng (`SCRIPT_TIMEOUT_MS` + 2 s, + 20 s cho lần nạp WASM đầu) rồi `terminate()` và tạo worker mới.
  - Script không đổi được `settings.route`, vì `applyScriptRequest` chỉ đụng method, URL, headers, body.
  - QuickJS chỉ tải khi chạy script đầu tiên (mọi import ngoài worker là `import type`).
- **History:** ghi `tab.draft` (bản trước pre-script, còn `{{var}}`). `finalUrl` chỉ giữ origin và path (`history-service.ts:81`).
- **Navigation state:** chỉ chứa `projectId` và `resourceId` (regex giới hạn), được xoá bằng `replace`, và chỉ mở sau khi restore xong.
- **Import:** file lớn hơn 10 MB bị từ chối trước khi đọc. JSON có trần độ sâu 128, 2 triệu node, 2.000 mục. YAML không parse, nên không có YAML bomb. Parse có debounce 250 ms.
- **JSON lớn:** tô màu chỉ tới 200k ký tự, tìm kiếm tối đa 1.000 kết quả, bảng preview 200 dòng và 30 cột.
- **Huỷ request:** đường direct nối `signal` vào `AbortController` riêng và phân biệt timeout với huỷ; đường proxy huỷ `fetch` phía trình duyệt. Phía server xem H4.
- **i18n, token màu, độ dài file, `any`/`!`:** sạch theo các lệnh ở trên. Cỡ chữ `text-[0.8125rem]` là pattern đã có sẵn trong repo.

## Thứ tự sửa đề xuất

1. H1 (gửi trùng): sửa nhỏ, rủi ro dữ liệu cao.
2. H3 (nginx body size) và M1 (CSP `blob:`): sửa infra một lần, kèm cập nhật `deployment-guide.md`.
3. H2: kiểm domain tunnel ở server, đổi khoá đồng ý, hiện origin thật trong modal, xem lại các thiết lập ghi được qua MCP.
4. H4: semaphore đồng thời, huỷ upstream khi client đóng, bỏ collector thô.
5. M6 (lint), sau đó M2–M5.
6. Nhóm Low.

## Câu hỏi còn mở

- Server Localman (origin sau Cloudflare) có chung VPS hoặc IP với `tunnel.hoandat.com` không? Nếu có, guard "địa chỉ của chính server" sẽ chặn mọi URL tunnel, và đường Tunelo luôn trả `PROXY_TARGET_BLOCKED` trong production. Hiện mới biết `tunnel.inetdev.io.vn` trỏ `103.72.98.65` và `localman.hoandat.com` nằm sau Cloudflare.
- Có giữ `mcp: true` cho `setTunnelMapping` và `updateClientSettings` không, khi hai thao tác này nới lỏng việc hỏi đồng ý ở trình duyệt? (H2)
- Có che credential trong history (M2) không, hay chấp nhận rủi ro tới phase 13 (environment)?

Status: DONE_WITH_CONCERNS
Summary: Review phase 10 xong. Có 4 lỗi High: router gửi trùng request đã tới đích; ánh xạ tunnel và thiết lập ghi qua MCP làm credential tới host lạ mà không hỏi; nginx 128 KB chặn draft và history lớn; proxy không có trần đồng thời. Ngoài ra có 6 Medium và 10 Low.
Concerns: Không chạy test, typecheck hay e2e vì agent khác đang chạy e2e. H4 đã xác minh cơ chế nhưng quy mô bộ nhớ là ước tính. Chưa biết server Localman có chung IP với Tunelo không, điều này ảnh hưởng tới đường Tunelo trong production.
