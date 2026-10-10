# Review phase 20: mock lai localhost, request log, webhook inbox, mock callback

Ngày: 2026-10-10 · Reviewer: code-reviewer (T11) · Chế độ: chỉ đọc

## Phạm vi
- Backend:
  - `apps/api/src/modules/mock-runtime/{upstream-*,request-log-*,log-stream-routes,replay-service,traffic-*,mock-route-call}.ts`
  - `webhook-inbox/**`, `mock-callbacks/**`, `api-client/runtime-ssrf-guard.ts`
  - Phần wiring trong `mock-server.ts`, `dashboard-server.ts`, `main.ts`
  - `resources/resource-{dependents,restructure}.ts`, `mcp/localman-mcp-access.ts`, `packages/operations/src/types.ts`
- Web: `features/{upstream,request-log,webhook-inbox,mock-callbacks}`, `api-client/open-in`, các trang project-detail.
- Hạ tầng đọc kèm để kiểm đường đi thật: `infra/localman/nginx/localman.hoandat.com.conf`, `apps/tunelo-server/src/request-relay.ts`.
- Đã chạy:
  - `npx biome check` trên các thư mục phase 20: 175 file, 0 lỗi.
  - `pnpm check:i18n`: pass.
  - `pnpm check:mcp-coverage`: pass.
- KHÔNG chạy `typecheck`, `test`, `e2e` vì agent khác đang chạy e2e.

## Tổng quan
Phần SSRF lúc gửi đã làm chắc. Mọi request ra ngoài đi qua `sendChecked`, ghim DNS, không theo redirect, và được kiểm lại mỗi lần gửi. Quyền owner/collaborator nhất quán. Header bí mật của callback được che đúng ở list, MCP và log.

Lỗ lớn nằm ở chỗ khác: phase này mở ra **hai đường phục vụ nội dung tuỳ ý (HTML, JS, Set-Cookie) trên origin của mock**. Mock còn có đường fallback `/m/` nằm **cùng origin với dashboard**. Kết quả là XSS chiếm tài khoản (Critical).

Ngoài ra còn mấy vấn đề khác:
- Tiêu chí "tunnel dừng thì 502 kèm hint" không đúng trong kịch bản thật.
- Buffer log có giới hạn theo số dòng, không theo byte.
- Hàng đợi outbound chung có thể bị vài tài khoản free làm nghẽn.

---

## Critical

### C1. XSS trên origin dashboard qua webhook inbox và upstream (`/m/{secret}/…`), chiếm được tài khoản
- **Đường inbox:**
  - `apps/api/src/modules/webhook-inbox/inbox-schema.ts:17,29-33`: `contentType` nhận mọi media type, kể cả `text/html` và `application/javascript`.
  - `inbox-route.ts:89-91` trả nguyên Content-Type và body đó.
  - Tạo được qua REST lẫn MCP (`inbox-operations.ts:70`, `:101` có `mcp: true`).
- **Đường upstream:** `mock-runtime/upstream-headers.ts:57-84` (`relayResponseHeaders`) chỉ bỏ hop-by-hop, `content-*`, CORS và `x-localman-*`. Mọi header khác của upstream được chuyển nguyên, kể cả `Content-Type: text/html`, `Set-Cookie` và `Content-Security-Policy` (header này ghi đè CSP của helmet).
- **Origin bị ảnh hưởng:** `infra/localman/nginx/localman.hoandat.com.conf:235-243`. Location `/m/` của server `localman.hoandat.com` proxy vào mock runtime và có `add_header` riêng, nên **không thừa hưởng CSP của dashboard**. Response chỉ mang CSP mặc định của helmet: `script-src 'self'` (đã in ra bằng helmet của repo). `'self'` lúc này chính là `https://localman.hoandat.com`.
- **Kịch bản:**
  1. Kẻ tấn công lập tài khoản free.
  2. Tạo inbox `page` với `text/html` và body `<script src="/m/<secret>/_inbox/js"></script>`, cùng inbox `js` với `application/javascript`. Gói free cho 2 inbox, vừa đủ.
  3. Gửi link `https://localman.hoandat.com/m/<secret>/_inbox/page` cho nạn nhân đã đăng nhập.
  4. Script là `'self'` nên chạy được. Từ script, `fetch('/api/v1/...')` là same-origin, nên cookie `__Host-lm_session` (SameSite=Strict) vẫn được gửi.
  5. CSRF guard (`http/csrf-guard.ts:32-35`) cho qua vì `Origin` nằm trong danh sách cho phép, hoặc vì `Sec-Fetch-Site: same-origin`.
  6. Kẻ tấn công đọc được mọi project và secret, xoay token MCP, và đặt upstream của project nạn nhân trỏ về máy mình.
- **Biến thể không cần JS:** upstream trả `Set-Cookie: __Host-lm_session=<session của kẻ tấn công>; Secure; Path=/` trên `/m/`. Đây là login CSRF / session fixation.
- **Trên host `{secret}.localman.hoandat.com`:** cùng nội dung đó cho phép phishing trên domain thương hiệu, đặt cookie cho `.hoandat.com`, và làm Safe Browsing chặn cả wildcard.
- Repo đã cố ý cấm đúng điều này cho rule response (`packages/shared/src/rule-headers.ts:7-13,64`: "never HTML on the mock origin"). Phase 20 đi vòng qua lệnh cấm đó.
- **Không có cờ phía server.** `hybridMock` chỉ ẩn UI. `apps/api` không đọc cờ này, nên REST và MCP sống ngay khi deploy.
- **Cách sửa (cần làm cả ba):**
  1. Inbox: giới hạn `contentType` theo cùng chính sách với `ruleHeaderIssue`, chỉ JSON hoặc `text/plain`. Kiểm cả lúc lưu lẫn lúc trả, cho dữ liệu cũ.
  2. Upstream: đổi `relayResponseHeaders` sang allowlist kiểu `isRuleHeaderName` cộng `content-type`. Bỏ `set-cookie`, CSP, `x-accel-*`, `refresh`, `link`, `clear-site-data`. Thêm các header cứng cho mọi response của upstream và inbox: `Content-Security-Policy: sandbox; default-src 'none'` và `X-Content-Type-Options: nosniff`. Một Content-Type ngoài JSON/text thì ép về `text/plain` hoặc thêm `Content-Disposition: attachment`.
  3. Nginx `/m/`: thêm CSP `default-src 'none'; sandbox` cho location này. Đây là phòng thủ chiều sâu, vì `/m/` là same-origin với dashboard. Cân nhắc chặn hẳn upstream và inbox qua `/m/`.

---

## High

### H1. Tunnel đã dừng không trả `UPSTREAM_UNAVAILABLE` kèm hint (tiêu chí nghiệm thu sai trong thực tế)
- `mock-runtime/upstream-proxy.ts:138-157` relay mọi response nhận được.
- Khi mapping `tunnelMappings` vẫn còn (mapping là thủ công, nên sau khi tắt `tunelo` thì gần như luôn còn), DNS wildcard vẫn trỏ về Tunelo server. Tunelo trả `502 text/plain "Tunnel not found: x"` (`apps/tunelo-server/src/request-relay.ts:57-63`). Khi port local chết, `stream/response-sink.ts:46,69` cũng trả 502/504.
- Client vì thế nhận 502 text/plain, có `X-Localman-Source: upstream`, nhưng không có JSON lẫn `hint`.
- Test `upstream-forwarding.test.ts:97-117` chỉ giả lập "không có mapping" và "connect refused", nên không bắt được trường hợp này.
- **Sửa:** với upstream `tunnel`, nhận diện 502/504 do chính Tunelo sinh ra. Ví dụ: Tunelo thêm một header đánh dấu như `X-Tunelo-Error: TUNNEL_NOT_FOUND`, hoặc kiểm body `Tunnel not found:` khi content-type là text/plain. Khi đó map sang `sendUpstreamError(..., "connect")`. Thêm integration test chạy với Tunelo server giả trả 502.

### H2. Buffer request log giới hạn theo số dòng, không theo byte; không có trần dung lượng log theo project
- `request-log-service.ts:17,52`: `MAX_BUFFERED_LINES = 5000`.
- Mỗi dòng giữ tới 2 × 64 KB body (`request-log-entry.ts:15`). Body nhị phân còn bị base64 thêm khoảng 33%.
- Khi Mongo chậm, buffer có thể giữ khoảng 640–850 MB heap trên server .65 dùng chung với IdP và các app khác.
- Gói Pro có `mockRequestsPerMonth: null` và rate limit 60 rps/secret (`mock-server.ts:30-35`). Một project Pro có thể ghi khoảng 7,7 MB/s vào `request_logs` trong 30 ngày. Không có trần số dòng hay số byte theo project.
- **Sửa:**
  - Giới hạn buffer theo tổng byte (vd 64 MB) song song với số dòng.
  - Đặt trần mỗi project, vd N dòng/phút hoặc tổng byte mỗi ngày; vượt thì chỉ lưu summary, không lưu body.
  - Cân nhắc cắt body log còn 16 KB cho response của mock (đã có sẵn trong DB).

### H3. Hàng đợi outbound chung: vài tài khoản free làm nghẽn inbox forward và callback của mọi người
- `mock-callbacks/retry-queue.ts:50-51`: `concurrency 8` cho cả process, `perProject 2`.
- `outbound-send.ts:20-22,40`: 3 lần thử, mỗi lần tới 30 s.
- `dispatcher.ts:17`: 200 job chờ cho mỗi project.
- **Kịch bản:**
  1. 2 tài khoản free tạo 6 project, tức 12 slot, lớn hơn 8.
  2. Mỗi project đặt callback tới một IP public bỏ SYN (blackhole).
  3. Mỗi write sinh tới 10 job. Toàn bộ 8 slot bị giữ 30 s mỗi lần thử, kéo dài hàng giờ.
  4. Job của người khác quá TTL 1 giờ (`outbound-job-model.ts:13,93`) bị Mongo xoá âm thầm, không có dòng log, `last` không đổi.
- **Sửa:**
  - Giới hạn slot theo **owner**, không theo project.
  - Hạ timeout của callback (vd 10 s như "Send test").
  - Circuit breaker theo host đích: sau N lần timeout liên tiếp thì hoãn.
  - Fair scheduling: claim xoay vòng giữa các project, không sort chung theo `nextAt`.
  - Ghi một dòng log `expired` trước khi TTL xoá job.

### H4. Shutdown bị force-exit khi upstream chậm, làm mất số đếm quota và dòng log
- `main.ts:40` đặt `SHUTDOWN_TIMEOUT_MS = 10_000`, trong khi forward upstream, replay và inbox có thể giữ response tới 30 s (`upstream-forwarder.ts:11`), còn "Send test" tới khoảng 35 s.
- `await Promise.all(servers.map(closeServer))` ở `main.ts:108` chờ các response đó. Quá 10 s thì `process.exit(1)` và bỏ qua `usageMeter.stop()`, `requestLog.stop()`, `outboundQueue.stop()`.
- Hệ quả: request đã tính quota nhưng chưa flush bị mất (đếm thiếu), và mất tới 2 s cộng phần buffer của dòng log.
- Hybrid localhost khiến chuyện này dễ xảy ra: chỉ cần dev đang dừng ở breakpoint đúng lúc deploy.
- Thêm một race: SSE đang ở bước `await resolveAuth/requireProject` lúc `closeLogStreams()` chạy (`log-stream-routes.ts:36-38,53-77`) sẽ đăng ký sau khi đã đóng và giữ server tới lúc force-exit.
- **Sửa:**
  - Có một `AbortController` cho cả process, dùng cho mọi outbound của mock runtime và dashboard, abort lúc shutdown.
  - Flush `usageMeter` và `requestLog` trước `closeServer`, hoặc trong nhánh force-exit.
  - `open()` của SSE phải từ chối khi đang shutdown.

---

## Medium

### M1. SSE rò listener, timer và slot khi client ngắt trong lúc xác thực; không có backpressure
- `log-stream-routes.ts:53-111` gắn `res.once("close")` sau hai lần `await` (`resolveAuth`, `requireProject`), cộng thêm `readUserLocale`.
- Nếu client huỷ trong khoảng đó, sự kiện `close` đã phát rồi, nên các thứ sau không bao giờ được dọn:
  - `subscribe`
  - `setInterval` heartbeat (gọi `requireProject` mỗi 25 s)
  - `openStreams`
  - `perUser`
- Lặp mở rồi huỷ sẽ làm rò bộ nhớ và truy vấn DB, và tự khoá chính user ở mức 5 stream cho tới khi restart.
- Thêm nữa, `res.write` ở dòng 89 bỏ qua giá trị trả về. Client ngừng đọc (TCP zero window) trên project đông thì Node buffer vô hạn.
- **Sửa:**
  - Sau các `await`, kiểm `req.socket.destroyed || res.writableEnded` rồi mới đăng ký.
  - Nếu `res.writableLength` vượt khoảng 1 MB thì `res.end()`.

### M2. Escape tiền tố path của upstream `url` bằng dot-segment
- `resolve-project.ts:36-44` nhận cả segment `..` (kể cả dạng `%2e%2e`).
- `upstream-target.ts:36-39` nối thẳng `rawPath` vào `baseUrl`. `parseHttpUrl` / `new URL` sau đó chuẩn hoá: `https://api.example.com/v1/public` + `/%2e%2e/%2e%2e/admin` thành `https://api.example.com/admin` (đã kiểm bằng Node).
- Nginx chuyển nguyên URI vì `proxy_pass` không có phần URI.
- Bất kỳ ai có URL mock (thường nằm trong bundle frontend) đều gọi được mọi path trên host upstream từ IP của Localman, vượt ra ngoài prefix mà owner đã đặt.
- **Sửa:** từ chối, hoặc trả 404 cho, request có segment `.`/`..` sau khi decode trước khi forward. Sau khi dựng URL, kiểm `url.pathname.startsWith(basePath)`.

### M3. Upstream concurrency tính theo project, không theo owner
- `upstream-proxy.ts:42,125`: `perUser: 8` nhưng key là `project.id`. Mức tổng cho cả process là 64.
- Một tài khoản Pro (20 project, quota không giới hạn) hoặc 3 tài khoản free với upstream chậm cố ý (30 s) có thể giữ hết 64 slot. Mọi hybrid mock khác nhận `503 UPSTREAM_BUSY`.
- **Sửa:** key theo `project.owner`, giữ thêm một giới hạn theo project nếu cần.

### M4. URL callback chứa token lộ ra collaborator, MCP và log
- `callback-config.ts:76-79` thừa nhận "webhook URLs often carry a token" và giữ nguyên query string.
- Tuy vậy URL vẫn lộ nguyên vẹn ở mấy chỗ:
  - `callback-view.ts:36-37`: trả `target` và `targetLabel` cho mọi member và qua MCP.
  - `callback-message.ts:81,99`: ghi URL vào `path` và `target` của dòng log (7–30 ngày).
- Với Slack/Discord, chính URL là bí mật. Trong khi đó header thì đã được che (`[hidden]`), nên hai chỗ không nhất quán.
- **Sửa:** với người không phải owner hoặc khi gọi qua MCP, che query, và với host webhook đã biết thì che cả path. Trong log chỉ ghi `origin + pathname`.

### M5. `traffic.setRedactHeaders` mở qua MCP: agent có thể gỡ che rồi tự đọc giá trị
- `traffic-settings-operations.ts:169` có `mcp: true`.
- Agent có `mock:write` bị prompt injection có thể xoá danh sách che tuỳ chỉnh (vd `x-session-token`), rồi đọc header thật của các request sau qua `getRequestLog` (`mock:read`).
- Lý do đã dùng để miễn MCP cho upstream (`UPSTREAM_EXEMPT`) cũng áp dụng cho trường hợp này.
- **Sửa:** cho MCP chỉ **thêm** tên header, hoặc đặt `mcp: { exempt }`.

### M6. Live view bỏ qua dòng log được amend (attempts của inbox forward)
- `request-log-service.ts:77-95` phát lại cùng `id` "so live views replace the row".
- Nhưng `apps/web/src/features/request-log/use-live-rows.ts:60` gặp id trùng thì trả `previous`, nên hàng cũ không có attempts vẫn ở lại cho tới khi tải lại list.
- Không có test cho trường hợp này.
- **Sửa:** khi id đã có thì thay hàng tại chỗ và không flash/announce lại. Thêm test.

### M7. Truy vấn log không chặn trên với project lớn
- `inbox-store.ts:39-48`: `requestCounts` aggregate trên toàn bộ dòng log của project. Nó chạy ở mỗi lần list, update hoặc forward inbox.
- `request-log-filter.ts:123-125`: `$regex` không neo, `i`, trên `path`. Với filter hiếm, truy vấn quét toàn bộ dòng của project qua index `{projectId,_id}`.
- Với Pro, số dòng có thể lên hàng triệu.
- **Sửa:**
  - Đếm request của inbox bằng counter trên document inbox (tăng khi ghi), hoặc thêm index `{projectId, source, inbox}`.
  - Đặt `maxTimeMS` cho list và aggregate.

---

## Low

- **L1. Né kiểm "mock host" bằng dấu chấm cuối.**
  - `upstream-config.ts:64-69` (`isMockHost`) và `callback-config.ts:81-92` so sánh `url.hostname`. `https://abc.localman.hoandat.com./` có hostname kết thúc bằng `.` nên lọt qua bước kiểm lúc lưu.
  - Guard thì bỏ dấu chấm (`ssrf-guard.ts:85`) và cho đi vì là mock host. Nginx dùng `$host` (đã bỏ dấu chấm) nên request vào được mock runtime.
  - Vòng lặp vẫn bị `X-Localman-Hop` chặn, nên tác động thấp. Sửa: bỏ dấu chấm cuối trước khi kiểm.
- **L2. Callback và inbox forward không tính `mockRequestsPerMonth`.**
  - Một write được tính 1 nhưng có thể sinh tới 10 callback × 3 lần thử. Inbox forward cũng chỉ tính 1 cho tối đa 3 lần thử. "Send test" không tính.
  - Spec chỉ bắt buộc tính request *vào* runtime, và trần 200 job/project cùng concurrency 8 đã chặn khuếch đại. Cần quyết định có muốn quota outbound riêng không. Ghi lại để chốt.
- **L3. `X-Localman-Hop` giả mạo được.**
  - `mock-router.ts:106`, `inbox-route.ts:73`: bất kỳ client nào cũng tắt được callback của owner hoặc inbox forward cho write của chính nó.
  - Quota vẫn được tính trước, nên không né được hạn mức. Nếu cần, ký marker bằng HMAC secret của server.
- **L4. Header `x-accel-*` từ upstream được relay**, và nginx tôn trọng `X-Accel-Redirect`/`X-Accel-Expires`. Sửa chung với allowlist ở C1.
- **L5. Timeout forward 30 s bằng đúng `proxy_read_timeout 30s` của nginx** (`localman.hoandat.com.conf:92`), nên đua nhau và client nhận 504 HTML của nginx. Đề xuất forward 25 s.
- **L6. Lỗi khi hàng đợi đầy bị log ở mức error cho mỗi write** (`dispatcher.ts:43-45`, `forward-service.ts:41-45`), đủ để flood log. Owner không thấy event bị bỏ trong request log. Thêm vào đó, đếm rồi `insertMany` không atomic, nên có thể vượt 200 một ít.
- **L7. `getRequestLogDraft` không chặn dòng `callback`** (`traffic-operations.ts:94-98`), trong khi replay thì có. Draft sinh URL `https://{secret}.…https://hooks…` và mang theo `X-Localman-Hop: 1`.
- **L8. Job callback đã xếp hàng vẫn gửi khi callback đã bị tắt hoặc sửa** (chỉ `callbacksGone` khi xoá resource, `outbound-job-run.ts:61`). Header bí mật cũ cũng đi theo job.
- **L9. Body không phải JSON của request upstream được đọc không giới hạn thời gian** (`upstream-proxy.ts:70-91`). Vượt 100 KB thì vẫn drain tới hết. Hiện được nginx `client_max_body_size 128k` chặn; nếu bỏ nginx thì giữ slot.
- **L10. Query string không bị che trong log** (`?api_key=`, `?token=`). Spec không yêu cầu, ghi để cân nhắc.
- **L11. Quy ước:** `webhook-inbox/webhook-inbox.test.ts` dài 216 dòng, quá 200. Không thấy `any` hay `!` trong file mới. Biome sạch.

---

## Đối chiếu trọng tâm T11

| Trọng tâm | Kết luận |
|---|---|
| SSRF lúc lưu và lúc gửi | Đạt cho upstream, callback, replay và inbox (inbox chỉ cho tunnel). Không bỏ qua được bằng redirect (không theo redirect) hay DNS rebinding (ghim mọi địa chỉ, chặn khi có bất kỳ địa chỉ private nào). Lỗi: L1 (dấu chấm cuối), M2 (escape path). |
| Miễn chặn mock host / TUNNEL_DOMAINS | `url` trỏ vào mock bị chặn lúc lưu (trừ L1). Vòng lặp bị hop chặn. Không thấy khuếch đại vượt quota phía vào. Phía ra xem H3 và L2. |
| Hop giả mạo | Chỉ tắt được callback/forward của chính request đó; không né được quota (L3). |
| Che header | Mặc định che `authorization`, `cookie`, `set-cookie`, `x-api-key` cộng danh sách tuỳ chỉnh, ở cả request và response. Header callback bị che toàn bộ trong log, `[hidden]` ở list và MCP. Draft và replay bỏ giá trị bị che. Lỗi: M4 (URL token), M5 (gỡ che qua MCP). |
| Non-member xem log/SSE | Không: mọi đường đi qua `requireProject(sub,"read")`; SSE kiểm lại mỗi 25 s; SSE chỉ nhận session cookie. |
| Hạn mức | Upstream, inbox và replay đều qua `admitMonthly` (replay đi bằng URL công khai). `webhookInboxes` theo project, có xử lý race. TTL theo `requestLogDays` lúc ghi. Outbound không tính: L2. |
| Tài nguyên | H2, H3, H4, M1, M3, M7. |
| Quyền và quy ước | Owner/collaborator đúng. Lỗi theo `{error:{code,message}}`. i18n pass. Biome pass. Test axe có cho log. |

## Đề xuất thứ tự xử lý
1. C1: chặn HTML/JS và Set-Cookie trên inbox và upstream, cộng CSP sandbox cho `/m/`. **Không deploy và không bật `hybridMock` trước khi xong**, vì backend không có cờ gác.
2. H1: nhận diện lỗi Tunelo. H4: abort outbound và flush trước khi đóng server.
3. H2, H3: giới hạn byte cho buffer, quota log theo project, scheduling công bằng theo owner.
4. M1–M7, rồi các mục Low.

## Theo dõi plan
- T2–T8: code có, nhưng T2 chưa đạt tiêu chí "tunnel dừng thì 502 kèm hint" (H1).
- T9: test có, nhưng thiếu ca Tunelo trả 502 và ca amend trên live view.
- T10: chặn bởi C1.
- T11: **chưa đạt**, vì còn 1 Critical và 4 High.

## Câu hỏi mở
- Callback và inbox forward có cần quota outbound riêng không (L2), hay chỉ cần trần hàng đợi?
- Các app khác dưới `hoandat.com` (IdP `auth.hoandat.com`) có dùng cookie không có tiền tố `__Host-` hoặc chỉ dựa vào SameSite không? Nếu có, nội dung tuỳ ý trên `*.localman.hoandat.com` cũng ảnh hưởng tới chúng (PLAUSIBLE, chưa kiểm repo IdP).

Status: DONE_WITH_CONCERNS
Summary: Phase 20 có 1 Critical: inbox và upstream phục vụ được HTML/JS và Set-Cookie trên `/m/` cùng origin dashboard, dẫn tới XSS chiếm tài khoản. Có 4 High: Tunelo 502 không thành `UPSTREAM_UNAVAILABLE`, buffer log không giới hạn byte, hàng đợi outbound dễ bị làm nghẽn, shutdown force-exit làm mất quota và log.
Concerns: Chưa chạy typecheck/test/e2e vì có agent khác đang chạy e2e. Backend không có cờ `hybridMock`, nên C1 sống ngay khi deploy.
