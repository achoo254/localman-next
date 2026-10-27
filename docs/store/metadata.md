# Localman — hồ sơ App Store (bản nháp)

Bản nháp để dán vào App Store Connect cho app iOS `com.hoandat.localman`. Cách build và tải lên TestFlight: [mobile-app.md](../mobile-app.md#phát-hành-testflight). Hồ sơ chung cả App Store lẫn Google Play (kèm Data safety của Play): [listing.md](listing.md). Ngôn ngữ chính của trang App Store: **Tiếng Việt**; thêm bản **English (U.S.)** bằng các dòng tiếng Anh dưới đây.

Ký tự đếm bằng số ký tự Unicode (App Store Connect đếm như vậy); riêng ô từ khoá đếm byte UTF-8. Số trong ngoặc là độ dài thật. Mọi giá trị dưới đây kiểm lại trên code và prod lúc 27/10/2026 09:11 (giờ Việt Nam).

## Thông tin app

| Trường | Giá trị |
|---|---|
| Bundle ID | `com.hoandat.localman` (`brand.config.json` › `appIds.ios`) |
| SKU | `localman-ios` |
| Tên (≤ 30) | `Localman – Mock API & Client` (28) · EN: `Localman – Mock API & Client` (28) |
| Phụ đề (≤ 30) | `Mock REST API, gửi request` (26) · EN: `Mock REST APIs, send requests` (29) |
| Danh mục chính / phụ | Developer Tools / Productivity |
| URL hỗ trợ | `https://localman.hoandat.com/privacy#contact` (trả 200; mục Liên hệ `id="contact"` ở `apps/web/src/pages/legal/legal-page.tsx`, email `quocdat254@gmail.com` cố định ở `apps/web/src/lib/legal.ts` và form "Góp ý / Liên hệ") |
| URL marketing | `https://localman.hoandat.com/` (200) |
| URL chính sách quyền riêng tư | `https://localman.hoandat.com/privacy` (200) |
| URL điều khoản (EULA tuỳ chỉnh, không bắt buộc) | `https://localman.hoandat.com/terms` (200) |
| Bản quyền | `2026 hoandat` |
| Giá | Miễn phí, không mua trong app, không quảng cáo. Hạn mức mở rộng do người vận hành cấp. Trong app không có trang giá, nút nâng cấp hay link mua: `/pricing` chuyển về trang chủ (`apps/web/src/routes/public-routes.tsx`), trang Tài khoản chỉ hiện hạn mức và đồng hồ đo, "No plan, price or upgrade" (`apps/web/src/pages/account/account-page.tsx`), báo vượt hạn mức chỉ bảo xoá bớt (`i18n/messages/*/limits.ts`, `trial.ts`). Trang "Quan tâm gói Pro" (có khoảng giá VND) chỉ là trang quản trị `/admin/pro-interest`, menu chỉ hiện cho admin. Giữ như vậy để không vướng guideline 3.1.1 |
| Thiết bị | iPhone **và iPad** (`TARGETED_DEVICE_FAMILY = "1,2"` trong `apps/mobile/ios/App/App.xcodeproj/project.pbxproj`), xem mục Rủi ro |
| iOS tối thiểu | iOS 17.4 (`IPHONEOS_DEPLOYMENT_TARGET = 17.4`, cần cho callback https của `ASWebAuthenticationSession`) |
| Phiên bản | `MARKETING_VERSION = 1.0` |

### Văn bản quảng bá (≤ 170)

VI (126): `Khai báo resource, bấm sinh dữ liệu là có endpoint CRUD. Gửi request, xem log từng lượt gọi và webhook đổ về ngay trên iPhone.`

EN (138): `Declare resources, generate data in one tap and get CRUD endpoints. Send requests and watch every call and webhook arrive, on your iPhone.`

### Mô tả (≤ 4000)

VI (1667):

```
Localman giúp developer dựng mock REST API có trạng thái trong vài phút, gửi request và theo dõi từng lượt gọi, ngay trên iPhone. Cùng tài khoản và dữ liệu với Localman trên web.

MOCK REST API CÓ TRẠNG THÁI
• Khai báo resource bằng bảng field, chọn kiểu dữ liệu hoặc method Faker.js.
• Bấm một lần để sinh dữ liệu giả, có ngay endpoint CRUD: GET, POST, PUT, PATCH, DELETE.
• Lồng resource để có endpoint dạng /users/:userId/orders.
• Phân trang, sắp xếp, lọc bằng query string; tuỳ biến response cho từng endpoint, custom endpoint, rule có điều kiện và lỗi giả lập.
• Chế độ hybrid: chuyển tiếp sang API thật những route chưa mock.

THEO DÕI LƯU LƯỢNG
• Log request trực tiếp: method, path, status, thời gian, header và body; header nhạy cảm luôn được che.
• Webhook inbox: một URL nhận webhook, trả lời theo cấu hình của bạn và ghi lại từng lượt gửi.
• Mở một request trong log bằng API client để gửi lại hoặc sửa.

API CLIENT
• Collection, environment và biến (giá trị bí mật được mã hoá), lịch sử request.
• Dán lệnh cURL hoặc nhập file OpenAPI để tạo request; xem response JSON, header và thời gian.
• Gọi app đang chạy trên máy tính của bạn (localhost) qua tunnel Tunelo.

LÀM VIỆC CÙNG NHAU VÀ AI AGENT
• Workspace, mời đồng đội vào project, bình luận, fork và pull request cho collection.
• Mỗi project mock có sẵn MCP endpoint: AI agent gọi tool trên chính dữ liệu của mock.

RIÊNG TƯ
• Không quảng cáo, không công cụ phân tích hay theo dõi trong app.
• Đăng nhập bằng tài khoản hoandat.com qua trình duyệt của hệ thống; app không giữ mật khẩu, phiên đăng nhập nằm trong Keychain của iPhone.
• Xoá tài khoản và dữ liệu ngay trong app, ở Tài khoản và hạn mức.
```

EN (1712):

```
Localman lets developers build stateful mock REST APIs in minutes, send requests and follow every call, right on the iPhone. Same account and data as Localman on the web.

STATEFUL MOCK REST APIS
• Declare resources as a table of fields; pick a data type or a Faker.js method.
• Generate fake data in one tap and get CRUD endpoints right away: GET, POST, PUT, PATCH, DELETE.
• Nest resources for endpoints like /users/:userId/orders.
• Pagination, sorting and filtering by query string; custom responses per endpoint, custom endpoints, conditional rules and simulated errors.
• Hybrid mode: forward the routes you have not mocked to the real API.

WATCH THE TRAFFIC
• Live request log: method, path, status, duration, headers and bodies, with sensitive headers always masked.
• Webhook inbox: a URL that receives webhooks, answers the way you set it and records every delivery.
• Open any logged request in the API client to resend or edit it.

API CLIENT
• Collections, environments and variables (secret values encrypted), request history.
• Paste a cURL command or import an OpenAPI file to create requests; see the JSON response, headers and timing.
• Reach an app running on your computer (localhost) through a Tunelo tunnel.

TEAMS AND AI AGENTS
• Workspaces, invite teammates to a project, comments, forks and pull requests for collections.
• Every mock project has an MCP endpoint: AI agents call tools on the mock's own data.

PRIVACY
• No ads, no analytics or tracking tools in the app.
• Sign in with your hoandat.com account in the system browser; the app never holds your password and keeps the session in the iPhone Keychain.
• Delete your account and its data in the app, under Account and limits.
```

Nguồn từng ý (đều thuộc tính năng đã bật trên prod, `infra/localman/released-features`): resource/Faker/CRUD/lồng resource/phân trang-lọc-sắp xếp (`i18n/messages/en/docs-reference.ts`, `resource-tree.ts`), rule có điều kiện và lỗi giả lập (`mockPowerUps`: `resource-rules.ts`, `resource-chaos.ts`), hybrid (`hybridMock`, `upstream.ts`), log trực tiếp và che header (`traffic-log.ts`), webhook inbox (`webhook-inbox.ts`), "Open in API Client" từ log (`traffic-log.ts`), API client, import cURL/OpenAPI, Tunelo (`apiClient`, `tuneloAccounts`), workspace, bình luận, fork và pull request (`workspaces`, `comments`, `forks`), MCP (`mockMcp`), đăng nhập trình duyệt hệ thống và Keychain (`apps/web/src/platform/native/mobile-sign-in.ts`, `mobile-session.ts`).

### Từ khoá (≤ 100 byte, ngăn bằng dấu phẩy, không dấu cách sau phẩy, không lặp chữ trong tên/phụ đề)

VI (99 byte): `json,faker,webhook,http,curl,endpoint,backend,frontend,developer,lập trình,kiểm thử,test,mcp`

EN (98 byte): `json,faker,webhook,http,curl,endpoint,backend,frontend,developer,testing,stub,fake data,tunnel,mcp`

Không đưa tên sản phẩm khác vào từ khoá (guideline 2.3.7; quy tắc repo không nêu tên đối thủ).

## Phân loại độ tuổi (Age Rating)

Kết quả mong đợi: **4+** (Apple tự tính). Trả lời bảng câu hỏi:

| Câu hỏi | Trả lời | Lý do |
|---|---|---|
| Bạo lực (hoạt hình, thực tế, kéo dài), nội dung tình dục, khoả thân, ngôn từ thô tục, kinh dị, thuốc, rượu, thuốc lá, mô phỏng cờ bạc, chủ đề y tế/sức khoẻ, nội dung người lớn | None | Công cụ cho developer |
| Cờ bạc bằng tiền thật, cuộc thi | No | |
| Trình duyệt web không giới hạn | No | API client hiện response; xem trước HTML nằm trong `<iframe sandbox="">` (không script, không điều hướng, `apps/web/src/features/api-client/response/html-preview.tsx`); link sang site khác mở ra Safari/trình duyệt hệ thống |
| Nội dung do người dùng tạo | **Yes** | Bình luận trên collection giữa những người được mời vào workspace/project; link xem collection công khai chỉ ai có link mới xem được (không có trang khám phá công khai) |
| Nhắn tin / chat | No | Bình luận gắn với collection, không có chat |
| Quảng cáo | No | |
| Kiểm soát của phụ huynh, xác minh tuổi | No | |
| Made for Kids | No | |

## App Privacy ("nhãn dinh dưỡng")

Rút từ [/privacy](https://localman.hoandat.com/privacy) (chữ ở `apps/web/src/i18n/messages/en/legal-privacy.ts`). **Theo dõi (tracking): No** cho mọi loại; app không có SDK quảng cáo hay phân tích (plugin native chỉ có `@capacitor/app`, `@aparajita/capacitor-secure-storage`, `@achoo254/capacitor-system-auth`). Mọi loại dưới đây: thu thập = Yes, liên kết với danh tính = **Yes**, mục đích = **App Functionality** (gồm bảo mật và chống lạm dụng).

| Nhóm App Store Connect | Loại | Ghi chú |
|---|---|---|
| Contact Info | Name | Tên hiển thị từ tài khoản hoandat.com; tên tuỳ chọn trong form góp ý |
| Contact Info | Email Address | Email tài khoản (và đã xác minh hay chưa); email trả lời tuỳ chọn trong form góp ý |
| Contact Info | Other User Contact Info | Chat Telegram đã liên kết ở hoandat.com (nếu có); username Telegram tuỳ chọn trong form góp ý |
| Identifiers | User ID | Account ID, username |
| User Content | Customer Support | Nội dung form "Góp ý / Liên hệ" |
| User Content | Other User Content | Project, resource và dữ liệu mock, rule, webhook inbox, callback, collection, request, environment, biến (giá trị bí mật mã hoá), bình luận, fork, pull request, tab đang mở, lịch sử request; log request tới mock của chính người dùng (header, body, đã che header nhạy cảm) |
| Usage Data | Other Usage Data | Bộ đếm mock và proxy request mỗi tháng (cho hạn mức) |
| Diagnostics | Other Diagnostic Data | Log kỹ thuật mỗi request tới server (ID, method, route, status, thời gian; không header, cookie, body, query); request qua proxy kèm account ID và host đích |

Không thu thập: Location, Contacts, Health & Fitness, Financial Info, Purchases, Photos or Videos, Audio, Browsing History, Search History, Sensitive Info, Device ID, Crash Data, Performance Data, Advertising Data. Ảnh đại diện chỉ là link từ hoandat.com, không phải ảnh người dùng tải lên. Bộ đếm rate limit dùng hash của dải IP, xoá khi hết cửa sổ thời gian. Cloudflare Web Analytics chỉ đếm lượt xem trên website, không chạy trong app; Web Push không có trong bản iOS (WKWebView không có `PushManager`).

## Ghi chú cho App Review

Dán vào **App Review Information → Notes** (tiếng Anh). Bản này giả định **Sign in with Apple đã bật trên auth.hoandat.com** — lúc 27/10/2026 09:11 trang đăng nhập prod mới có Google, GitHub và "App reviewer sign-in", **chưa có nút Apple** (xem Rủi ro). Chưa bật kịp thì dùng bản thay thế bên dưới.

```
Localman is a developer tool: build stateful mock REST APIs, send HTTP requests and inspect the
traffic live. The app shares its account and data with Localman on the web.

SIGN-IN
Tap "Sign in" ("Đăng nhập") in the top bar. Sign-in opens our own account service,
auth.hoandat.com (shared by our apps), in the system browser (ASWebAuthenticationSession), then
returns to the app through a verified universal link. Choose "Sign in with Apple" and use any
Apple ID: the first sign-in creates a new, empty Localman account. No demo account is needed.
The session token is stored in the iOS Keychain and sent as a Bearer token; the app never sees
a password.

WHAT TO TRY
1. Projects > "Create a new project", open it, "Add resource" (for example "users"), then
   "Generate all": the resource gets CRUD endpoints (GET, POST, PUT, PATCH, DELETE) at the mock
   URL shown on the page.
2. Open the "Request log" tab of the endpoint card and call the mock URL from the API Client
   (top bar): the call appears live.
3. "Inbox" tab: create a webhook inbox and send a request to its URL from the API Client.
4. API Client: send any request and see the response.

ACCOUNT DELETION (5.1.1(v))
Account menu (avatar, top right) > "Account and limits" ("Tài khoản và hạn mức") > scroll to
"Delete account" > "Delete account..." ("Xoá tài khoản…") > type the username shown to confirm >
"Delete account". The Localman account and its data are deleted at once. The shared hoandat.com
sign-in account is deleted separately on its own account page (linked in the same dialog).
Public page: https://localman.hoandat.com/account/delete

PRIVACY AND TERMS
https://localman.hoandat.com/privacy and https://localman.hoandat.com/terms, also linked in the
app footer.

No in-app purchases, no ads, no tracking. The interface is available in English, Vietnamese and Simplified
Chinese (language menu in the app). Support: quocdat254@gmail.com
```

Bản thay thế khi Apple chưa bật (đoạn SIGN-IN): thay câu bắt đầu bằng `Choose "Sign in with Apple"` bằng `On the sign-in page, below the Google and GitHub buttons, tap "App reviewer sign-in" and enter the email and password given in the Sign-In Information of this submission.` Tài khoản duyệt bật trên auth-next bằng `REVIEW_LOGIN_EMAIL` / `REVIEW_LOGIN_PASSWORD_HASH_PATH` (chi tiết ở [listing.md](listing.md#ghi-chú-cho-app-review-app-store-notes-play-app-access)); email và mật khẩu chỉ nhập vào ô **Sign-In Information** của App Store Connect, không ghi vào repo. Khi Apple đã bật thì bỏ tích "Sign-in required" hoặc ghi rõ "use Sign in with Apple, no credentials needed".

Đường xoá tài khoản kiểm trong code: menu `account-menu.tsx` mục "Tài khoản và hạn mức" → `/account` (`pages/account/account-page.tsx`) → `DeleteAccountSection` (`features/account-deletion/delete-account-section.tsx`, nút "Xoá tài khoản…") → `DeleteAccountModal` (gõ đúng username mới bật nút "Xoá tài khoản").

## Ảnh chụp màn hình

Sinh bằng `pnpm store:screenshots` (Playwright, giao diện tiếng Việt, dữ liệu demo; [mobile-app.md](../mobile-app.md#ảnh-cửa-hàng)). PNG không kênh alpha (kiểm bằng `sips`):

| Thư mục | Nhóm App Store Connect | Kích thước |
|---|---|---|
| `screenshots/ios-6.9/` | iPhone 6.9" | 1320 × 2868 |
| `screenshots/ios-6.5/` | iPhone 6.5" | 1284 × 2778 |
| (chưa có) | iPad 13" — bắt buộc khi app khai iPad | 2064 × 2752 hoặc 2048 × 2732 |

Thứ tự tải lên (giống nhau ở cả hai cỡ, mỗi file đúng kích thước của thư mục):

1. `01-mock-api.png` — project và cây resource. Chú thích gợi ý: "Mock REST API trong vài phút".
2. `02-du-lieu-faker.png` — dữ liệu sinh bằng Faker. "Dữ liệu giả có quan hệ".
3. `03-api-client.png` — gửi request, xem response. "API client ngay trên iPhone".
4. `04-nhat-ky-request.png` — log request trực tiếp. "Xem từng lượt gọi".
5. `05-webhook-inbox.png` — webhook inbox. "Bắt webhook từ dịch vụ ngoài".

Ảnh là giao diện thật của app (bản web trong vỏ iOS) với dữ liệu giả, không có thanh trạng thái iOS. [mobile-app.md](../mobile-app.md#ảnh-cửa-hàng) còn ghi ba lỗi bố cục điện thoại chưa sửa (cây resource bị cắt ở `01`, cột log nằm ngoài khung ở `04`, tên tab bị cắt ở `03`); nên sửa và chụp lại trước khi nộp vì người duyệt so ảnh với app (2.3.3).

## Rủi ro cần chủ app quyết trước khi nộp

1. **Sign in with Apple chưa bật trên prod (4.8).** `https://auth.hoandat.com` (qua `https://localman.hoandat.com/auth/login`) lúc 27/10/2026 09:11 chỉ có "Sign in with Google", "Sign in with GitHub" và "App reviewer sign-in". Code Apple có sẵn ở auth-next nhưng "chưa bật" (`auth-next/docs/deployment-guide.md`, cách bật ở `auth-next/docs/sign-in-with-apple.md`). App dùng Google/GitHub cho tài khoản chính nên cần một lựa chọn như Sign in with Apple; tài khoản duyệt bằng mật khẩu không thay được yêu cầu này. Đề xuất: bật Apple trên auth-next trước khi nộp (cùng một lần cho cả 5 app), rồi dùng ghi chú duyệt bản Apple.
2. **4.2 (Minimum Functionality) — rủi ro cao.** App bọc toàn bộ web app; phần native thật sự có trong code chỉ là: đăng nhập bằng `ASWebAuthenticationSession` + universal link `/m/auth/callback` (`App.entitlements`), lưu token phiên trong Keychain, đọc live log bằng `fetch` stream thay EventSource. Không có push, widget, share extension, Shortcuts hay tính năng dùng phần cứng (APNs ghi ở mục "Chưa làm" của `mobile-app.md`). Lập luận khi bị hỏi: app là công cụ có backend, trạng thái và dữ liệu riêng của người dùng (mock API chạy thật, log trực tiếp, API client), không phải trang web quảng bá. Muốn giảm rủi ro thì cần thêm giá trị native thật (ví dụ thông báo đẩy khi webhook inbox nhận request) — chưa có, không ghi vào mô tả.
3. **App khai cả iPad** (`TARGETED_DEVICE_FAMILY = "1,2"`) nhưng chưa có ảnh iPad: App Store Connect sẽ đòi ảnh iPad 13". Đề xuất: chuyển về chỉ iPhone (`TARGETED_DEVICE_FAMILY = 1`, build lại) vì giao diện và ảnh mới làm cho khổ điện thoại; hoặc chụp thêm ảnh iPad.
4. **3.1.1: không thấy rủi ro.** Không có giá, nút nâng cấp hay link mua trong bản iOS (xem dòng Giá). Giữ nguyên khi đổi copy trang chủ/hạn mức.
5. **URL hỗ trợ** sống (200) nhưng là trang SPA: mọi đường dẫn (kể cả đường dẫn không tồn tại) đều trả 200, chữ của `/privacy` vẽ phía trình duyệt. Mở bằng trình duyệt thì thấy mục Liên hệ có email; ổn cho App Review.
6. Trang `/privacy` và `/terms` còn mục "đang cập nhật" (tên người vận hành, tuổi tối thiểu) theo [listing.md](listing.md#việc-của-chủ-app-trước-khi-nộp); nên chốt trước khi nộp.
7. Target app không có `PrivacyInfo.xcprivacy` riêng; app không tự gọi API "required reason", các SDK Capacitor tự mang manifest. Nếu App Store Connect cảnh báo ITMS-91053 lúc tải build thì thêm manifest cho target.
