# Cụm B: mocking, tunneling, request inspection. Tính năng mà cả mockapi.io lẫn Postman đều chưa có

**Ngày:** 2026-10-08 · **Phạm vi:** Mockoon, Beeceptor, WireMock Cloud, Hoverfly, Smocker, Webhook.site, RequestBin, ngrok, Requestly, JSON Server/My JSON Server, Mockaroo · **Plan liên quan:** `../../261008-1123-localman-core/plan.md` · Mọi nguồn đọc ngày 2026-10-08.

## Kết luận

1. **Nên làm trước ba add-on ghép thành một câu chuyện "localhost" trọn vẹn.** Keyword chính hiện chỉ phủ chiều *trình duyệt gọi vào localhost*. Ba add-on dưới đây phủ nốt chiều *Internet gọi vào localhost* và chiều *quan sát traffic*. Postman và mockapi.io đều không có cả ba:
   - **#1 Hybrid mock:** route đã khai báo thì trả dữ liệu mock, mọi route còn lại đi tiếp vào tunnel Tunelo của user.
   - **#2 Webhook inbox:** hứng webhook rồi forward về localhost qua Tunelo.
   - **#3 Live request log:** log của mock runtime, có replay và "Mở trong API client".
2. **Mức nỗ lực:** #1, #2 và #3 đều ở tier M. Hạ tầng dùng chung gồm Express 5 runtime, Mongo và Tunelo relay.
3. **Keyword mới đề xuất:** **"Mock lai localhost"** (hybrid mock). Đây là phần mở rộng tự nhiên của "Localhost ngay trên trình duyệt", và chỉ Beeceptor đang có tính năng tương tự.
4. **Cần sửa claim đang dùng trong plan.** Câu "mock của Postman chỉ trả các example tĩnh đã lưu" (ở `competitive-261008-1308…` và phase 16) **không còn đúng**:
   - Postman mock hỗ trợ dynamic variable Faker và template helper `$body`, `$queryParams`, `$pathSegments`, `$headers`.
   - Postman mock chọn example theo header, body và query.
   - Postman có code mock dùng `pm.state` (stateful), session `x-mock-session` và `pm.datasets` (CSV/JSON). Có các giới hạn: tính năng đang beta, chỉ viết được trong Local View của desktop app, và deploy lên cloud chỉ có từ gói Solo trở lên.
   - Ngoài ra, mock server của Postman **không còn giới hạn số call trên mọi gói** kể từ tháng 3/2026.

   "Live Mock Sync" vẫn đứng được. Nhưng phải diễn đạt lại thành "mock có trạng thái, không cần code, chạy trên web, gói Free", **không** nói Postman chỉ có example tĩnh.

## Bối cảnh đối thủ đã kiểm chứng

| Hạng mục | mockapi.io | Postman (docs v12, 2026) |
|---|---|---|
| Delay | Không có trong docs hay landing | **Có**, nhưng chỉ là "fixed network delay" cho mỗi mock server |
| Chọn response | Custom response template | Matching theo path, query và header/body (khi bật); chọn example bằng `x-mock-response-code/-name/-id` |
| Dữ liệu động | Faker generator lưu sẵn | Dynamic variable Faker và template helper. Code mock dùng `pm.state`/`pm.datasets` (beta, desktop) |
| Call log | Không có | **Có**: search, filter, refresh thủ công. **Không có replay** |
| Fallback sang server thật | Không có | Classic mock không có tài liệu nào nói tới. Code mock chưa kiểm chứng |
| Webhook catcher hoặc URL công khai để hứng request | Landing ghi "Webhooks: Coming soon" | Không có. "Collection webhooks" chỉ dùng để *kích hoạt chạy collection* |
| Capture traffic | Không có | Proxy capture **chỉ chạy trên desktop**, lưu vào History hoặc collection. Docs không nói tới việc sinh mock từ capture |
| Chaos/rate-limit | Không có | Không có trong docs. Muốn mô phỏng thì phải tự viết code mock |
| GraphQL mock | Không có | **Có** (qua example kèm body matching) |
| OpenAPI → mock | Không có | **Có** (import spec → collection có example → mock) |

## Bảng xếp hạng top 12

Điểm xếp hạng dựa trên bốn yếu tố, theo thứ tự ưu tiên: (a) cả hai đối thủ đều thiếu; (b) hợp với stack và keyword hiện có; (c) effort thấp; (d) giá trị với user.

| # | Add-on | Công cụ đã có | mockapi.io | Postman | Tier | Keyword | Tin cậy |
|---|---|---|---|---|---|---|---|
| 1 | **Hybrid mock → localhost** (route lạ thì đi vào tunnel hoặc base URL thật) | Beeceptor (Local Tunnel, "mocking rules take precedence"), Mockoon proxy mode | Thiếu | Thiếu (classic) | M | **Cao** | Trung bình–cao |
| 2 | **Webhook inbox + forward về localhost qua Tunelo** | Webhook.site (CLI `forward`), Beeceptor, RequestBin | Thiếu ("Coming soon") | Thiếu | M | **Cao** | Cao |
| 3 | **Live request log của mock runtime + replay / mở trong API client** | Mockoon logs, Beeceptor inspection, WireMock live logs, ngrok replay | Thiếu | Có log, không có replay hay live | M | Trung bình | Cao |
| 4 | **Inspector traffic của tunnel ngay trên web** (replay, sửa rồi replay) | ngrok cloud Traffic Inspector | Thiếu | Thiếu | L | **Cao** | Cao |
| 5 | **Chaos: khoảng delay, tỉ lệ lỗi %, timeout, rate-limit 429** | WireMock Chaos (5 mode), Beeceptor Delays & Timeouts + Rate limits, Mockoon latency | Thiếu | Chỉ có fixed delay | S | Trung bình | Cao |
| 6 | **Mock tự bắn webhook (callback) khi có CRUD**, gửi được vào tunnel | Mockoon callbacks, WireMock webhooks/async callbacks | Thiếu ("Coming soon") | Thiếu (classic) | M | Trung bình | Trung bình |
| 7 | **Record API thật thành resource có trạng thái** (suy ra schema và seed) | Beeceptor Proxy & Record, Mockoon auto-mocking, WireMock recording, Hoverfly capture | Thiếu | Chỉ có capture trên desktop, không sinh mock | L | Trung bình–cao | Trung bình |
| 8 | **Import CSV/JSON thành resource** (seed dữ liệu thật) | JSON Server/My JSON Server (db.json), Mockaroo datasets, Mockoon data buckets | Thiếu | `pm.datasets`: desktop, Solo+, beta | S | Trung bình | Cao |
| 9 | **OpenAPI import thành resource có trạng thái** | Mockoon, Beeceptor, WireMock | Thiếu | **Có** OpenAPI → example mock (không có trạng thái) | M | Trung bình | Cao |
| 10 | **Drift: diff giữa mock và API thật** | Hoverfly Diff mode, WireMock (drift qua OpenAPI) | Thiếu | Không có diff mock–real | L | Thấp–trung bình | Trung bình |
| 11 | **Response theo rule** (header, query, body, số thứ tự request) không cần code | Mockoon rules (11 target, 6 operator), Beeceptor rules | Thiếu | Có scoring/matching, không có rule theo điều kiện giá trị | M | Thấp | Cao |
| 12 | **GraphQL tự sinh từ cây resource** | Beeceptor GraphQL, WireMock GraphQL | Thiếu | Có GraphQL qua example, không tự sinh | L | Thấp | Trung bình |

**Đã loại khỏi top 12:**

| Ứng viên | Lý do loại |
|---|---|
| CORS playground | Runtime nên trả CORS mặc định như Mockoon; không đủ thành tính năng riêng |
| Shareable snapshot | Phase 15 đã có |
| Mock environments/versioning | Postman đã có; phase 13 đã có |
| Stateful scenarios/session | Postman code mock có `x-mock-session` |
| Override response trong trình duyệt kiểu Requestly | Cần extension, tier XL |
| Team webhook inbox | Gộp vào #2 qua workspace |

## Chi tiết từng add-on

### 1. Hybrid mock → localhost ("Mock lai localhost")
- **Cách làm ở đối thủ:**
  - Beeceptor: request khớp rule thì nhận response mock, phần còn lại đi qua tunnel CLI vào port local. Gói Free giới hạn 50 request/ngày và 8 request tunnel chạy đồng thời.
  - Mockoon: proxy mode forward các route chưa định nghĩa sang một host.
- **Bằng chứng đối thủ thiếu:**
  - mockapi.io: docs chỉ có CRUD, filter, sort, page và custom response.
  - Postman: thuật toán matching không có nhánh fallback. Khi không khớp, Postman trả lỗi. Code mock có làm được hay không thì chưa kiểm chứng.
- **Giá trị cho user:** frontend dev mock trước các endpoint backend chưa viết, còn endpoint đã xong thì chạy thật trên máy. Chỉ cần dùng một base URL duy nhất.
- **Fit với stack:**
  - Mock-server (Express 5) thêm middleware cuối chuỗi: route không khớp resource thì proxy sang `upstreamUrl` của project.
  - `upstreamUrl` là tunnel Tunelo chọn từ API liệt kê tunnel (plan tunnel-list-api), hoặc một URL thật bất kỳ.
  - Đặt timeout và giới hạn body; header `X-Localman-Source: mock|upstream` để debug.
- **Rủi ro:** runtime công khai thành open proxy. Cách chặn: chỉ cho phép upstream là tunnel của chính owner hoặc domain đã verify, và rate-limit dùng chung với hạn mức mock.

### 2. Webhook inbox + forward qua Tunelo
- **Cách làm ở đối thủ:**
  - Webhook.site: mỗi URL kèm một địa chỉ email và có live view. CLI `forward` chuyển request tới `--target` (mặc định `https://localhost`). URL Free hết hạn sau 7 ngày và nhận tối đa 100 request.
  - Beeceptor: có "Webhook Testing".
- **Bằng chứng đối thủ thiếu:**
  - Postman không cấp URL công khai để hứng webhook. Collection webhook chỉ kích hoạt việc chạy collection.
  - mockapi.io ghi "Webhooks: Coming soon".
- **Giá trị cho user:** test webhook của Stripe, VNPay, Zalo hay GitHub ngay trên web. Có thể bấm "forward tới localhost:3000" mà không cần cài thêm CLI, vì Tunelo đã có.
- **Fit với stack:**
  - Inbox nằm ở `{secret}.localman.hoandat.com/_hooks/{id}`, lưu vào Mongo kèm TTL index.
  - Đẩy live lên dashboard bằng SSE.
  - Forward phía server sang URL tunnel của owner, kèm nút replay từng request.
- **Lưu ý:** plan v1 ghi "Không làm Custom endpoints và Webhooks". Quyết định đó nói về việc ngang tính năng với mockapi.io, còn inbox là add-on khác. User cần xác nhận lại trước khi đưa vào.

### 3. Live request log + replay
- **Cách làm ở đối thủ:** Postman có call log (search, filter theo path/method/status/header, refresh thủ công) nhưng **không có replay**. ngrok cho replay và "replay with modifications".
- **Fit với stack:** Tunelo CLI đã có `request-store` với ring buffer 500 entry và body tối đa 1 MB, cùng API replay và replay tuỳ chỉnh (`packages/client/src/inspector-server.ts`). Localman có thể port nguyên mô hình đó sang mock runtime: ghi vào Mongo capped collection, đẩy lên dashboard bằng SSE, thêm nút "Mở trong API client" nối với phase 10.
- **Gói:** đây là điểm tốt để phân tầng gói, ví dụ Free giữ log 24 giờ (ngang ngrok Free) và Pro giữ 7–30 ngày.

### 4. Inspector traffic của tunnel trên web
- **Cách làm ở đối thủ:** ngrok có cloud Traffic Inspector. Full Capture là tuỳ chọn opt-in, giới hạn body 10 KB. Gói Free giữ dữ liệu 24 giờ, Hobbyist giữ 72 giờ.
- **Fit với stack:**
  - Nên bắt traffic ở **relay**, không nên để trình duyệt đọc inspector local của CLI. Từ Chrome 142, trang công khai gọi localhost sẽ hiện prompt Local Network Access, và user có thể chặn.
  - Relay đẩy metadata (cộng body nếu owner opt-in) lên Localman. Phần UI dùng chung với #3.
- **Rủi ro:** lộ dữ liệu nhạy cảm. Cần opt-in, cắt bớt body và che header `Authorization`/`Cookie`. Effort cao hơn #3 vì đụng relay của Tunelo.

### 5. Chaos, latency và rate-limit
- **Cách làm ở đối thủ:**
  - WireMock Chaos phân bổ đều tỉ lệ % lỗi vào 5 mode: socket close, socket reset, invalid HTTP, long delay, HTTP error.
  - Beeceptor rate limit theo giây/phút/giờ cho toàn endpoint, trả 429 kèm header `X-RateLimit-*`, chỉ ở gói trả phí.
  - Postman chỉ có fixed delay.
- **Fit với stack:** một middleware Express đọc config của project/resource: `delay: [min,max]`, `errorRate`, `errorStatus`, `rateLimit`. Có thể override cho từng request qua query `?__delay=`.
- **Ước lượng:** tier S, rẻ nhất trong bảng; nên làm sớm cùng #1.

### 6. Mock tự bắn callback khi có CRUD
- **Cách làm ở đối thủ:** Mockoon có callbacks; WireMock có "Webhooks & async callbacks", gửi kèm delay hoặc ngay khi nhận request.
- **Giá trị cho user:** giả lập payment provider. Ví dụ POST `/orders`, sau 3 giây Localman tự POST `order.paid` vào tunnel của dev.
- **Fit với stack:** dùng lại event `resource.changed` của phase 16 và hàng đợi gửi có retry. Cũng thuộc nhóm "Webhooks" mà v1 đã loại, nên cần user xác nhận.

### 7. Record API thật thành resource có trạng thái
- **Cách làm ở đối thủ:** Beeceptor (Proxy & Record), Mockoon (auto-mocking) và WireMock (snapshots) đều ghi lại response *tĩnh*.
- **Hướng của Localman:** từ JSON array thu được, suy ra schema field và kiểu Faker, rồi seed dữ liệu thật. Kết quả là resource CRUD có trạng thái chứ không chỉ là một stub.
- **Bằng chứng đối thủ thiếu:** Postman proxy capture chỉ chạy trên desktop và docs không nói tới sinh mock từ capture.
- **Hạ tầng dùng lại:** proxy của API client (phase 10) và hybrid upstream của #1.

### 8. Import CSV/JSON thành resource
- **Cách làm ở đối thủ:** JSON Server và My JSON Server biến `db.json` thành REST API. Mockaroo cho Mock API lấy bản ghi từ dataset bằng `from_dataset`.
- **Bằng chứng đối thủ thiếu:** Postman `pm.datasets` chỉ chạy trong Local View của desktop, chỉ có từ gói Solo trở lên và đang beta.
- **Ước lượng:** tier S. Có thể dùng lại validator schema của phase 04, giới hạn theo hạn mức bản ghi của gói.

### 9–12. Ngắn gọn
- **#9 OpenAPI import:** Postman đã có, nên chỉ khác biệt ở điểm "ra resource có trạng thái, không ra example tĩnh". Không nên dùng làm keyword.
- **#10 Drift:** Hoverfly Diff forward request sang server thật, so với simulation đã lưu, rồi lưu diff theo field (`expected`/`actual`). Localman làm được khi đã có #1 hoặc #7, vì đều có response thật để so.
- **#11 Rule-based response:** Postman đã có matching dạng scoring, nên khác biệt yếu. Chỉ nên làm nếu user Localman yêu cầu.
- **#12 GraphQL:** Postman đã có (qua example). Tự sinh GraphQL từ cây resource là hướng mới nhưng tier L, nhu cầu chưa rõ.

## Ma trận trade-off cho ba add-on ưu tiên

| | #1 Hybrid mock | #2 Webhook inbox | #3 Request log |
|---|---|---|---|
| Cả hai đối thủ đều thiếu | Có | Có | Có một phần (Postman có log, không có replay) |
| Dùng lại thứ đã có | Tunelo tunnel-list API, mock-server | Mock-server, SSE, tunnel URL | Mô hình `request-store` của Tunelo, API client phase 10 |
| Rủi ro vận hành | Open proxy, upstream chậm | Spam/lưu trữ (cần TTL và hạn mức) | Dung lượng log (capped collection) |
| Rủi ro sản phẩm | Thấp | Đụng quyết định v1 "không Webhooks" | Thấp |
| Tier | M | M | M |

**Thứ tự đề xuất:**
1. #3 trước, vì #1 và #2 cần có log để debug.
2. Sau đó #5 (S) và #1.
3. Cuối cùng #2, sau khi user xác nhận.

#4 làm sau khi Tunelo relay ổn định.

## Adoption risk và kiến trúc
- Cả ba add-on ưu tiên đều chạy trong process mock runtime, nên giữ được nguyên tắc tách dashboard khỏi runtime (plan.md).
- Nên tách ingest của #2 và #3 thành worker hoặc queue nếu traffic tăng; hiện chưa cần.
- #1, #2 và #4 phụ thuộc Tunelo tunnel-list API (đang `blockedBy`). Nếu Tunelo trễ thì keyword chính và ba add-on này trễ theo.

## Giới hạn của nghiên cứu này
- Không kiểm chứng được code mock của Postman có gọi được HTTP ra ngoài (proxy hay passthrough) hay không. Nếu có, ưu thế của #1 so với Postman chỉ còn ở mức "không cần code, chạy trên web, gói Free".
- Không đọc được các trang wiki con của mockapi.io (lỗi tải trang). Kết luận "thiếu" dựa trên trang Home của wiki, danh sách tính năng trên landing và phân tích bundle trong `xia-261008-1123…`.
- Không đọc trang giá live của Postman. Thông tin "mock không giới hạn" lấy từ docs billing chính thức.
- Không đo thực tế hiệu năng, giá hay retention của Beeceptor, WireMock Cloud và Mockoon Pro.
- Không xem docs của Smocker, Pipedream RequestBin và Requestly (trang chính không mô tả chi tiết), nên không dùng các công cụ này làm bằng chứng chính.

## Nguồn (đọc ngày 2026-10-08)
- Postman mock matching: https://learning.postman.com/docs/design-apis/mock-apis/matching-algorithm/
- Postman thiết lập mock (delay, `pm.state`, session, auto deploy): https://learning.postman.com/docs/design-apis/mock-apis/set-up-mock-servers/
- Postman tổng quan mock và code mock: https://learning.postman.com/docs/design-apis/mock-apis/overview/ · https://learning.postman.com/latest-v-12/docs/design-apis/mock-apis/local-mock-servers
- Postman `pm.state` (beta, Local View): https://learning.postman.com/docs/tests-and-scripts/write-scripts/postman-sandbox-reference/pm-state
- Postman `pm.datasets` (desktop, Solo+): https://learning.postman.com/docs/tests-and-scripts/write-scripts/postman-sandbox-reference/pm-datasets
- Postman dynamic response và template helper: https://learning.postman.com/docs/design-apis/mock-apis/create-dynamic-responses/
- Postman call log: https://learning.postman.com/docs/design-apis/mock-apis/mock-server-calls/
- Postman gói 2026 ("mock server usage is now unlimited on all plans"): https://learning.postman.com/docs/billing/about-plans
- Postman proxy capture (chỉ desktop): https://learning.postman.com/docs/sending-requests/capturing-request-data/capturing-http-requests/
- Postman collection webhooks: https://learning.postman.com/docs/collections/running-collections/collection-webhooks/
- Postman GraphQL mock qua example: https://learning.postman.com/docs/design-apis/mock-apis/mock-with-examples/
- mockapi.io docs wiki: https://github.com/mockapi-io/docs/wiki · Landing và bundle: `../xia-261008-1123-mockapi-io-anatomy.md`
- Mockoon features: https://mockoon.com/features/ · Rules: https://mockoon.com/docs/latest/route-responses/dynamic-rules/ · Pro: https://mockoon.com/cloud/
- Beeceptor: https://beeceptor.com/ · Local tunnel và hybrid: https://beeceptor.com/docs/local-tunneling-by-exposing-service-port/ · Rate limits: https://beeceptor.com/docs/rate-limits/
- WireMock Cloud: https://www.wiremock.io/product · Chaos: https://docs.wiremock.io/chaos
- Hoverfly modes: https://docs.hoverfly.io/en/latest/pages/keyconcepts/modes/modes.html · Diff: https://docs.hoverfly.io/en/latest/pages/keyconcepts/modes/diff.html
- Webhook.site: https://docs.webhook.site/ · CLI forward: https://docs.webhook.site/cli.html
- ngrok Traffic Inspector (cloud, replay, modify, retention): https://ngrok.com/docs/obs/traffic-inspection/
- Mockaroo: https://www.mockaroo.com/ · My JSON Server: https://my-json-server.typicode.com/
- Chrome Local Network Access (Chrome 142): https://blog.openreplay.com/chrome-local-network-access-lna-permission/ · https://www.dynamsoft.com/web-twain/docs/faq/chromium-142-local-network-access-issue.html
- Tunelo inspector hiện có: `packages/tunelo-cli/src/inspector-server.ts`, `request-store.ts`

## Câu hỏi còn mở
1. Inbox webhook (#2) và callback (#6) có nằm trong quyết định v1 "không làm Webhooks" không? Đề xuất: coi inbox là add-on sau v1, không phải để ngang tính năng với mockapi.io.
2. Có sửa ngay claim "Postman chỉ có example tĩnh" trong `competitive-261008-1308…`, phase 16 và nội dung landing (phase 08) không? Đề xuất: sửa trước khi public bảng so sánh.
3. Hybrid upstream (#1) chỉ cho phép tunnel của owner, hay cho phép cả URL thật bất kỳ? URL bất kỳ thì rủi ro open proxy cao hơn.
