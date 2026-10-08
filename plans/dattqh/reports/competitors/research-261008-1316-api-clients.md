# Research cụm A (API clients): tính năng Localman có thể làm mà Postman và mockapi.io không có hoặc làm kém

**Ngày:** 2026-10-08 · **Phạm vi:** Apidog, Hoppscotch, Insomnia, Bruno, HTTPie, Kreya, Yaak, Thunder Client, Requestly, RapidAPI for Mac (Paw) · **Báo cáo liên quan:** `../competitive-261008-1308-localman-vs-mockapi-postman.md`

## Kết luận

- **Nên làm trước (S, gắn với mock):** (1) **Mock tự hiểu tên field**: gõ `email`, `avatar`, `createdAt` là tự chọn đúng method Faker, giống Smart Mock của Apidog. (2) **Tạo resource từ JSON mẫu hoặc OpenAPI.** (3) **Xuất TypeScript/Zod type từ schema resource.** Postman và mockapi.io đều không làm được ba việc này theo cách "không cần code, không tốn AI credit". Cả ba khai thác đúng thứ Localman có mà Postman không có: schema mock có cấu trúc.
- **Tầng hai (M):** chain request không cần script (giống template tag `response` của Insomnia/Yaak), snapshot và diff response (Kreya để ở gói Pro), widget nhúng mock playground (Hoppscotch Embeds), docs tự sinh từ mock project.
- **Bằng chứng mới làm yếu claim cũ:** Postman v12 đã có **code mock có state** (`pm.state`, `pm.datasets`), Agent Mode sinh được mock. Cloud deploy chỉ có từ gói Solo trở lên; Free chỉ chạy Local View trên desktop. Câu "mock của Postman chỉ trả example tĩnh" trong báo cáo competitive cần sửa thành "mock có state của Postman phải viết JS hoặc tốn AI credit, và muốn mock luôn chạy trên cloud thì phải trả phí". Chi tiết ở mục Rủi ro.
- **Không nên làm:** plugin system, self-host, thao tác DB trong script, load test qua proxy, chặn và sửa traffic trình duyệt. Những thứ này hoặc Postman đã có, hoặc là cỡ XL, hoặc mở rủi ro lạm dụng proxy.

## Bảng xếp hạng top 12

Thứ hạng theo: độ khác biệt so với Postman và mockapi.io × giá trị với user × độ khớp với stack (React + Tailwind, Express 5 + Mongoose, mọi request đi qua proxy) ÷ effort.

| # | Tính năng | Tool đang có | Postman / mockapi.io | Effort | Keyword? | Tin cậy |
|---|---|---|---|---|---|---|
| 1 | Mock tự hiểu tên field (tự chọn Faker theo tên và kiểu) | Apidog Smart Mock | Postman: classic mock trả example, code mock phải viết JS. mockapi: chọn tay từng field | S | Có | Cao |
| 2 | Tạo resource mock từ JSON mẫu hoặc OpenAPI | Apidog (import JSON, DDL), Insomnia 12 (AI mock) | Postman: cần Agent Mode (50 AI credit/tháng ở Free). mockapi: không có | S–M | Có | Trung bình |
| 3 | Xuất TypeScript/Zod type từ schema resource | Apidog (generate code từ spec) | Postman: chỉ sinh JSON Schema, không có export TS sẵn. mockapi: không có | S | Có | Trung bình |
| 4 | Chain request không cần script, tự gửi lại, có TTL | Insomnia (tag `response`), Yaak (`response()` có TTL) | Postman: "Set as variable" giá trị tĩnh, hoặc phải viết script/Flows. mockapi: không áp dụng | M | Phụ | Trung bình |
| 5 | Snapshot test và diff response | Kreya (Pro/Enterprise) | Postman: forum chỉ có workaround bằng lodash. mockapi: không áp dụng | M | Có | Trung bình |
| 6 | Kiểm response thật theo schema mock (phát hiện lệch hợp đồng) | Apidog (validate response theo schema khi debug) | Postman: làm được bằng script `jsonSchema`, không tự động gắn với mock. mockapi: không có | M | Có | Thấp–TB |
| 7 | Widget nhúng mock playground (iframe chạy được) | Hoppscotch Embeds | Postman: nút "Run in Postman" mở app, chưa thấy bản nhúng chạy tại chỗ. mockapi: không có | M | Có | Thấp–TB |
| 8 | Docs tự sinh từ mock project, luôn đồng bộ | Apidog, Hoppscotch (docs có version, 2026.2) | Postman: có publish docs ở Free nhưng mang brand Postman, custom domain phải trả phí. mockapi: không có docs | M | Phụ | Trung bình |
| 9 | Mock expectation có điều kiện (theo param, header, body) | Apidog | Postman classic: match theo header hoặc body, code mock phải viết JS. mockapi: không có | M | Phụ | Trung bình |
| 10 | Chạy theo dữ liệu CSV/JSON ở gói Free | Insomnia (Free), Thunder Client, Requestly | **Postman: data file chỉ có ở gói trả phí** (docs và bảng giá). mockapi: không áp dụng | L (cần Collection Runner) | Có | Cao |
| 11 | Dùng không cần đăng nhập (chỉ gọi mock và Tunelo) | Hoppscotch, HTTPie | Postman: không xác nhận được web dùng không cần login; bản không cần tài khoản là app desktop. mockapi: phải login | S–M | Phụ | Thấp |
| 12 | Đồng bộ collection với GitHub/GitLab ngay trên web | Bruno (file `.bru`/YAML), Insomnia (Free ≤3 user), Yaak | Postman: Native Git có ở Free nhưng **chỉ trên desktop**. mockapi: không có | L | Không | Trung bình |

## Chi tiết từng ứng viên

**1. Mock tự hiểu tên field.** Apidog sinh dữ liệu theo tên và kiểu thuộc tính, dựa trên rule wildcard hoặc regex, có rule tuỳ chỉnh và dùng Faker.js ([docs Smart Mock](https://docs.apidog.com/en/smart-mock-618190m0), đọc 2026-10-08). mockapi.io bắt chọn method Faker cho từng field (xem `xia-261008-1123-mockapi-io-anatomy.md` §2.1). Classic mock của Postman trả example đã lưu; code mock phải viết JS ([Postman v12 code mocks](https://learning.postman.com/latest-v-12/docs/design-apis/mock-apis/local-mock-servers)).
- **Giá trị:** tạo resource chỉ cần gõ tên field, đỡ chọn trong khoảng 250 method Faker.
- **Fit:** một bảng rule `pattern → faker method` trong `packages/shared`, gợi ý khi gõ tên field ở modal schema của phase 04, user vẫn sửa được. Không đụng runtime.
- **Effort:** S. **Keyword:** "Mock tự hiểu field". Tránh chữ "Smart Mock" vì đó là tên tính năng của Apidog.

**2. Tạo resource từ JSON mẫu hoặc OpenAPI.** Apidog sinh schema từ JSON, XML, JSON Schema hoặc DDL ([docs schema](https://docs.apidog.com/create-a-new-schema-534954m0)). Insomnia 12 (GA ngày 2025-11-04) sinh mock từ mô tả, URL, JSON mẫu hoặc OpenAPI, và AI đang miễn phí ([Kong press release](https://konghq.com/company/press-room/press-release/kong-releases-insomnia-12-to-accelerate-api-and-mcp-development-with-ai-powered-testing-and-collaboration)). Postman làm qua Agent Mode, tốn AI credit ([Agent Mode](https://learning.postman.com/docs/use/agent-mode/overview)); Free có 50 credit mỗi tháng ([pricing](https://www.postman.com/pricing/)).
- **Fit:** suy schema từ JSON là thuật toán xác định (kiểu field, mảng con thành child resource), không cần LLM. Ghép với #1 để chọn Faker. Import OpenAPI đã có ở phase 10, chỉ cần map `components.schemas` sang resource.
- **Effort:** S cho JSON mẫu, M cho OpenAPI. **Keyword:** "Dán JSON, có mock CRUD".

**3. Xuất TypeScript/Zod type.** Postman sinh được JSON Schema từ body hoặc response ([Add types to body data](https://learning.postman.com/latest-v-12/docs/design-apis/collections/add-properties-to-body-data)). Không tìm thấy chức năng export TS sẵn có; cộng đồng phải dùng quicktype hoặc `@n1rjal/pm_ts`. Apidog sinh code từ spec ([DEV tutorial](https://dev.to/jasonchan/generate-api-client-codes-as-per-api-specs-with-apidog-2g3n)), nhưng tôi chưa xác nhận được Apidog xuất riêng model TS.
- **Giá trị:** frontend dev dùng mock xong là có type để code luôn.
- **Fit:** schema resource đã có trong Mongo, sinh text TS/Zod ở client, có nút copy. **Effort:** S. **Keyword:** "Mock → TypeScript".

**4. Chain request không cần script.** Insomnia có tag `Response › Body Attribute` (JSONPath/XPath) kèm Trigger Behavior ([Kong how-to](https://developer.konghq.com/how-to/chain-requests/)). Yaak có `response()` từ bản 2024.8.0 và thêm TTL ở 2025.7.0 ([changelog](https://yaak.app/changelog/2025.7.0)). Postman có "Set as variable", lưu giá trị tĩnh; ở docs v11 thao tác trên response body chỉ có trên desktop ([Define variables](https://learning.postman.com/docs/use/send-requests/variables/define-variables/)). Muốn động thì phải dùng script hoặc Flows.
- **Fit:** mở rộng `variable-interpolation.ts` (port ở phase 10) với hàm `{{$response("Login", "$.token", ttl)}}`. Server chạy request phụ thuộc trước, có cache và chặn vòng lặp. Mỗi request phụ thuộc tính vào hạn mức proxy.
- **Effort:** M. **Keyword:** phụ ("Chain không cần code").

**5. Snapshot test và diff response.** Kreya bật snapshot không cần code, lọc bỏ timestamp, hiện diff để accept hoặc reject; tính năng chỉ có ở Pro/Enterprise ([docs](https://kreya.app/docs/scripting-and-tests/tests/snapshot-testing/), [pricing](https://kreya.app/pricing/)). Ở Postman, các thread forum "compare 2 responses" chỉ có workaround bằng script lodash trả pass/fail ([thread](https://community.postman.com/t/compare-responses-from-two-post-requests/19206)). Tôi không tìm thấy tính năng diff response sẵn có trong docs Postman (tin cậy trung bình).
- **Fit:** history đã lưu ở server (phase 10). "Đánh dấu làm snapshot", rồi diff JSON bằng diff-viewer dùng chung của phase 12 và 14. Thêm chế độ "gửi cùng request tới 2 environment và so sánh".
- **Effort:** M. **Keyword:** "Snapshot & Diff".

**6. Kiểm response thật theo schema mock.** Apidog dùng schema để validate response khi debug ([docs schema](https://docs.apidog.com/create-a-new-schema-534954m0)). Postman làm được bằng script `pm.response.to.have.jsonSchema`, có thể còn có validate theo API definition. Tôi chưa xác nhận được Postman tự động hoá việc này, nên mới để tin cậy thấp–TB.
- **Fit rất riêng:** collection gắn với mock qua Live Mock Sync (phase 16). Khi đổi base URL sang API thật, Localman tự báo field nào lệch với schema mock.
- **Effort:** M. **Keyword:** "Mock ↔ API thật: báo lệch".

**7. Widget nhúng mock playground.** Hoppscotch có ba loại widget: link, button và embed, trong đó embed là "mini version of Hoppscotch" để người xem tương tác với request ([docs widgets](https://docs.hoppscotch.io/documentation/features/widgets)). Run in Postman chỉ mở app Postman ([docs](https://learning.postman.com/docs/publishing-your-api/run-in-postman/creating-run-button/)). Tôi chưa thấy Postman có bản nhúng chạy tại chỗ, nhưng chưa kiểm hết (tin cậy thấp–TB).
- **Fit:** phase 15 đã có nút Run. Thêm iframe read-only chỉ gọi được endpoint mock của Localman, không gọi URL tuỳ ý, để không thành open proxy.
- **Effort:** M. **Keyword:** "Nhúng mock vào README/blog".

**8. Docs tự sinh từ mock.** Postman Free có public docs, nhưng mang brand Postman và custom domain chỉ có ở gói trả phí ([pricing](https://www.postman.com/pricing/)). Hoppscotch có docs nhiều version từ bản 2026.2 ([changelog](https://docs.hoppscotch.io/documentation/changelog.md)). mockapi.io không có docs. Điểm khác của Localman là docs sinh từ resource tree và luôn khớp với mock. **Effort:** M. **Tin cậy:** trung bình.

**9. Mock expectation có điều kiện.** Apidog cho trả response theo điều kiện trên param, khớp từ trên xuống, không khớp thì quay về mock mặc định ([docs](https://docs.apidog.com/project-544525/doc-618204)). mockapi chỉ có custom response cố định. Postman classic match example theo header hoặc body; muốn logic thì dùng code mock bằng JS. **Fit:** gắn vào custom response sẵn có, có thêm danh sách rule. **Effort:** M.

**10. Data-driven run ở Free.** Docs Postman ghi "custom data files are available on Postman paid plans" ([docs](https://learning.postman.com/docs/tests-and-scripts/running-collections/working-with-data-files)); bảng giá xếp "Data file support in Collection Runner" vào nhóm trả phí. Insomnia Essentials (Free) cho upload CSV/JSON trong runner ([docs](https://docs.insomnia.rest/insomnia/collection-runner), [pricing](https://insomnia.rest/pricing)). **Chặn:** Localman đang để Collection Runner ngoài phạm vi (plan.md, Jev 0.44), nên effort là L. Nếu làm Runner thì đây là điểm bán rõ nhất so với Postman Free. **Tin cậy:** cao.

**11. Dùng không cần đăng nhập.** Theo listing bên thứ ba (2026-04), web app HTTPie dùng được không cần tài khoản ([Parse](https://www.parse.gl/brands/httpie-io-2)); web app Hoppscotch cũng vậy. Bản không cần tài khoản của Postman là lightweight API Client trên desktop ([docs](https://learning.postman.com/docs/getting-started/basics/using-api-client/)). Xu hướng ngược lại: Requestly **bắt đăng ký** từ 2026-07-17 ([changelog](https://docs.requestly.com/changelogs.md)). Ở Localman, guest không được gọi proxy tới URL tuỳ ý (rủi ro SSRF, lạm dụng). Đáng làm nhất là cho guest dựng mock nháp lưu ở localStorage. **Effort:** S–M. **Tin cậy:** thấp.

**12. Git sync trên web.** Native Git của Postman có ở Free nhưng chỉ chạy trên desktop ([docs](https://learning.postman.com/docs/use/native-git/overview)). Bruno lưu file trong repo; Git UI trong app chỉ có ở Pro và Ultimate ([docs](https://docs.usebruno.com/v2/git-integration/overview)). Insomnia Free có Git Sync cho tối đa 3 user. Localman sẽ làm qua OAuth GitHub/GitLab, commit file JSON (Collection v2.1). **Effort:** L. Ở thị trường này ai cũng có Git sync, nên không nên dùng làm keyword.

## Đã kiểm và loại: Postman đã có hoặc không hợp với Localman

| Tính năng | Lý do loại | Nguồn |
|---|---|---|
| Import HAR | Postman có từ bản v9.6 | [Postman blog](https://blog.postman.com/postman-now-supports-importing-har-files/) |
| Lọc response (JSONPath, jq) | Postman có filter JSONPath (RFC 9535); Hoppscotch đổi sang jq ở 2026.1 | [Postman docs](https://learning.postman.com/docs/use/send-requests/response-data/responses) |
| MCP client | Postman và Insomnia 12 đều có | [heise](https://www.heise.de/en/news/Insomnia-12-Kong-enhances-API-tool-with-MCP-support-and-AI-assistance-11059094.html) |
| AI sinh test | Postman Agent Mode (50 credit ở Free), Requestly Test Authoring Agent (2026-01) | [Postman credits](https://learning.postman.com/docs/billing/agent-mode-usage) |
| Load test | Postman Free chạy local performance test không giới hạn. Chạy load test qua proxy của Localman sẽ thành công cụ DDoS | [pricing](https://www.postman.com/pricing/) |
| Plugin system (Yaak, Insomnia) | XL với solo dev; trên SaaS, code plugin của user phải sandbox phía server | [yaak.app](https://yaak.app/pricing) |
| Self-host (Hoppscotch CE, Requestly) | Ngược mô hình SaaS | [Hoppscotch docs](https://docs.hoppscotch.io/documentation/features/interceptor) |
| Thao tác DB trong script (Apidog: MySQL, MongoDB, Redis) | Proxy sẽ mở kết nối DB tới mạng ngoài, rủi ro SSRF và lộ credential | [Apidog docs](https://docs.apidog.com/) |
| Chặn và sửa traffic trình duyệt (Requestly) | Cần browser extension riêng, cỡ XL | [Requestly](https://requestly.com/products/api-client) |
| Scheduled runs và monitors | Postman Free có 1.000 request monitor mỗi tháng; Requestly thêm từ 2026-07 | [pricing](https://www.postman.com/pricing/) |
| GraphQL, gRPC, WebSocket, MQTT, cookie jar, certificate, Vault | Postman có, phần lớn qua desktop hoặc Agent | [lightweight client](https://learning.postman.com/docs/getting-started/basics/using-api-client/) |

## Ma trận trade-off cho top 5

| | #1 Field-aware | #2 JSON → mock | #3 Type export | #4 Chain | #5 Snapshot |
|---|---|---|---|---|---|
| Khác biệt so với Postman | Cao | Trung bình (Postman có AI) | Trung bình | Trung bình | Trung bình–Cao |
| Khác biệt so với mockapi | Cao | Cao | Cao | Không áp dụng | Không áp dụng |
| Tăng tải server hoặc proxy | Không | Không | Không | Có (request phụ thuộc) | Ít (lưu thêm snapshot) |
| Rủi ro bảo trì | Thấp (bảng rule) | Thấp | Thấp | Trung bình (vòng phụ thuộc, cache) | Trung bình (lọc giá trị động) |
| Phase gắn vào | 04 | 04, 10 | 06 | 13 | 10, 12 |

## Rủi ro và điều chỉnh claim

- **Postman v12 có code mock có state.** Có `pm.state` giữ dữ liệu giữa các request, `pm.datasets` truy vấn kiểu SQL, và session riêng cho mỗi client ([docs](https://learning.postman.com/latest-v-12/docs/design-apis/mock-apis/local-mock-servers)). Cloud View chỉ có ở Solo, Team và Enterprise; Free chạy Local View trên desktop. Live Mock Sync vẫn khác biệt (mock có state không cần code, tự đồng bộ collection), nhưng landing không được viết "Postman chỉ có mock tĩnh". **Tin cậy:** cao (docs chính thức).
- **"Localhost ngay trên trình duyệt" không còn độc quyền.** Hoppscotch web gọi được localhost qua browser extension hoặc Hoppscotch Agent ([docs](https://docs.hoppscotch.io/documentation/features/interceptor)). Localman cũng bắt cài Tunelo CLI, nên claim chính xác là "không cần app desktop hay extension, chỉ cần một lệnh tunnel". Nếu so sánh trực tiếp thì chỉ so với Postman và mockapi.io.
- **Paw / RapidAPI for Mac:** MacGeneration (khoảng 2026-09) đưa tin Nokia đã chính thức ngừng phát triển. Đây là nguồn đơn lẻ, tôi chưa đọc được thông báo gốc trên paw.cloud. Dynamic values của Paw tương đương #4 nên không cần nghiên cứu thêm.
- **Nguồn của đối thủ:** blog Apidog về giới hạn của Postman là nguồn của đối thủ, tôi chỉ dùng để đối chiếu. Mọi kết luận về Postman ở đây dựa trên docs và bảng giá chính thức.

## Giới hạn của research

- Bảng giá của Postman và Bruno được đọc qua trình chuyển HTML sang text. Bảng tính năng bị dẹt nên một số ô (Free/Pro) không đọc chắc được; những ô đó đã ghi rõ ở trên.
- Chưa mở app thật để kiểm. Các kết luận "Postman không có" (#3, #5, #6, #7, #11) dựa trên việc không tìm thấy trong docs, nên chỉ để tin cậy thấp hoặc trung bình.
- Chưa có giá và hạn mức chính thức của Apidog, HTTPie và Thunder Client; các nguồn bên thứ ba mâu thuẫn nhau. Không ứng viên nào trong top 12 phụ thuộc vào các con số này.
- Không xét cụm mock server (Beeceptor, Mockoon, WireMock) và webhook inbox. Đó là cụm research khác.

## Câu hỏi còn mở

1. Có đưa Collection Runner vào phạm vi không? Ứng viên #10, cũng là ứng viên có bằng chứng mạnh nhất về chỗ Postman khoá ở gói trả phí, phụ thuộc vào việc này.
2. Landing có dùng claim "Postman chỉ có mock tĩnh" không? Nếu có thì cần sửa ngay theo bằng chứng Postman v12 ở trên.
3. Guest mode (#11) có xung đột với quyết định "proxy bắt buộc đăng nhập" ở phase 10 không? Đề xuất giới hạn guest chỉ dựng mock nháp, không gọi proxy.

## Nguồn

- Postman: [Pricing](https://www.postman.com/pricing/) (đọc 2026-10-08) · [Code mock servers v12](https://learning.postman.com/latest-v-12/docs/design-apis/mock-apis/local-mock-servers) · [Native Git](https://learning.postman.com/docs/use/native-git/overview) · [Agent Mode](https://learning.postman.com/docs/use/agent-mode/overview) · [AI credits](https://learning.postman.com/docs/billing/agent-mode-usage) · [Data files](https://learning.postman.com/docs/tests-and-scripts/running-collections/working-with-data-files) · [Responses / filter](https://learning.postman.com/docs/use/send-requests/response-data/responses) · [Define variables](https://learning.postman.com/docs/use/send-requests/variables/define-variables/) · [Lightweight API Client](https://learning.postman.com/docs/getting-started/basics/using-api-client/) · [HAR import](https://blog.postman.com/postman-now-supports-importing-har-files/) · [Add types to body](https://learning.postman.com/latest-v-12/docs/design-apis/collections/add-properties-to-body-data) · [Forum: compare responses](https://community.postman.com/t/compare-responses-from-two-post-requests/19206)
- Apidog: [Smart Mock](https://docs.apidog.com/en/smart-mock-618190m0) · [Mock expectations](https://docs.apidog.com/project-544525/doc-618204) · [Schemas](https://docs.apidog.com/create-a-new-schema-534954m0) · [Custom domain docs](https://docs.apidog.com/custom-domain-631339m0) · [DEV: code generation](https://dev.to/jasonchan/generate-api-client-codes-as-per-api-specs-with-apidog-2g3n)
- Hoppscotch: [Interceptor](https://docs.hoppscotch.io/documentation/features/interceptor) · [Widgets/Embeds](https://docs.hoppscotch.io/documentation/features/widgets) · [Changelog 2026](https://docs.hoppscotch.io/documentation/changelog.md)
- Insomnia: [Pricing](https://insomnia.rest/pricing) · [Kong: Insomnia 12, 2025-11-04](https://konghq.com/company/press-room/press-release/kong-releases-insomnia-12-to-accelerate-api-and-mcp-development-with-ai-powered-testing-and-collaboration) · [heise](https://www.heise.de/en/news/Insomnia-12-Kong-enhances-API-tool-with-MCP-support-and-AI-assistance-11059094.html) · [Chain requests](https://developer.konghq.com/how-to/chain-requests/) · [Collection runner](https://docs.insomnia.rest/insomnia/collection-runner)
- Bruno: [Pricing](https://www.usebruno.com/pricing) · [Git integration](https://docs.usebruno.com/v2/git-integration/overview)
- Yaak: [Pricing/License MIT](https://yaak.app/pricing) · [Changelog 2025.7.0](https://yaak.app/changelog/2025.7.0) · [Changelog 2024.8.0](https://yaak.app/changelog/2024.8.0)
- Kreya: [Snapshot testing](https://kreya.app/docs/scripting-and-tests/tests/snapshot-testing/) · [Pricing](https://kreya.app/pricing/) · [Kreya 1.18](https://kreya.app/blog/kreya-1.18-whats-new/)
- Requestly: [API client](https://requestly.com/products/api-client) · [Changelogs](https://docs.requestly.com/changelogs.md) · [Local workspace](https://docs.requestly.com/general/others/workspaces/local-workspace)
- HTTPie: [Parse brand page (bên thứ ba)](https://www.parse.gl/brands/httpie-io-2) · [AI assistant](https://dev.to/pie/httpie-ai-assistant-4pmg)
- Thunder Client: [agentdeals (bên thứ ba)](https://agentdeals.dev/vendor/thunder-client) · [Collection runner docs](https://docs.thunderclient.com/features/collection-runner)
- Paw / RapidAPI for Mac: [paw.cloud updates](https://paw.cloud/updates), cùng bài MacGeneration (khoảng 2026-09) qua kết quả tìm kiếm, chưa đọc được bản gốc.
