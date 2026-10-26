# Localman: hồ sơ App Store và Google Play (bản nháp)

Bản nháp để dán vào App Store Connect và Play Console khi có app record. App là vỏ Capacitor bọc toàn bộ web app
([mobile-app.md](../mobile-app.md)). Ngôn ngữ chính của trang cửa hàng: **Tiếng Việt**; thêm **English (U.S.)** bằng
các dòng tiếng Anh. Số trong ngoặc là số ký tự (cửa hàng đếm theo ký tự Unicode; ô từ khoá của Apple đếm byte).

Mọi câu về dữ liệu rút từ trang [/privacy](https://localman.hoandat.com/privacy) (chữ ở
`apps/web/src/i18n/messages/en/legal-privacy.ts`, nguồn từng câu ở [legal-pages-review.md](../legal-pages-review.md)).
Sửa chính sách thì sửa các bảng dưới đây cùng lúc.

## Thông tin chung

| Trường | Giá trị |
|---|---|
| Bundle ID / Application ID | `com.hoandat.localman` (cả hai nền tảng, `brand.config.json`) |
| SKU (App Store) | `localman-ios` |
| Danh mục chính / phụ | Developer Tools / Productivity (Play: Tools) |
| Giá | Miễn phí, không mua trong app, không quảng cáo. Hạn mức mở rộng do người vận hành cấp; trong app không có chỗ mua hay link mua (giữ như vậy để không vướng guideline 3.1.1 và chính sách thanh toán của Play) |
| Thiết bị | iPhone, iOS 17.4 trở lên (`ASWebAuthenticationSession` với callback https). Android 7.0 (API 24) trở lên |
| Bản quyền | `2026 hoandat` |
| URL hỗ trợ | `https://localman.hoandat.com/privacy#contact` (email `quocdat254@gmail.com` và form "Góp ý / Liên hệ") |
| URL marketing | `https://localman.hoandat.com/` |
| URL chính sách quyền riêng tư | `https://localman.hoandat.com/privacy` |
| URL điều khoản (EULA tuỳ chỉnh, không bắt buộc) | `https://localman.hoandat.com/terms` |
| URL xoá tài khoản (Play bắt buộc; App Review hỏi) | `https://localman.hoandat.com/account/delete` |
| Email liên hệ của nhà phát triển (Play) | `quocdat254@gmail.com` |

## Tên, phụ đề, văn bản quảng bá

| Trường | Tiếng Việt | English |
|---|---|---|
| Tên (≤ 30; Play: tên app ≤ 30) | `Localman – Mock API & Client` (28) | `Localman – Mock API & Client` (28) |
| Phụ đề App Store (≤ 30) | `Mock REST API, gửi request` (26) | `Mock REST APIs, send requests` (29) |
| Mô tả ngắn Play (≤ 80) | `Mock REST API có dữ liệu Faker, gửi request, xem webhook ngay trên điện thoại.` (78) | `Build stateful mock REST APIs with Faker data, send requests, inspect webhooks.` (79) |

Văn bản quảng bá App Store (≤ 170, đổi được không cần gửi bản build):

- VI (126): `Khai báo resource, bấm sinh dữ liệu là có endpoint CRUD. Gửi request, xem log từng lượt gọi và webhook đổ về ngay trên iPhone.`
- EN (138): `Declare resources, generate data in one tap and get CRUD endpoints. Send requests and watch every call and webhook arrive, on your iPhone.`

## Mô tả (≤ 4000, dùng cho cả App Store và mô tả đầy đủ của Play)

VI:

```
Localman giúp developer dựng mock REST API có trạng thái trong vài phút, gửi request và theo dõi từng lượt gọi, ngay trên điện thoại. Đây là toàn bộ Localman bản web, cùng tài khoản và dữ liệu.

MOCK REST API CÓ TRẠNG THÁI
• Khai báo resource bằng bảng field, chọn kiểu dữ liệu hoặc method Faker.js.
• Bấm một lần để sinh dữ liệu giả, có ngay endpoint CRUD: GET, POST, PUT, PATCH, DELETE.
• Lồng resource để có endpoint dạng /users/:userId/orders.
• Phân trang, sắp xếp, lọc bằng query string; tuỳ biến response cho từng endpoint, custom endpoint, rule và lỗi giả lập.
• Chế độ hybrid: chuyển tiếp sang API thật những route chưa mock.

THEO DÕI LƯU LƯỢNG
• Log request trực tiếp: method, path, status, thời gian, header và body; header nhạy cảm được che.
• Webhook inbox: một URL nhận webhook, trả lời theo cấu hình của bạn và ghi lại từng lượt gửi.
• Mở một request trong log bằng API client để gửi lại hoặc sửa.

API CLIENT
• Collection, environment và biến (giá trị bí mật được mã hoá), lịch sử request.
• Dán lệnh cURL để tạo request, xem response dạng JSON đẹp, header và thời gian.
• Gửi tới localhost hay máy trong mạng LAN qua tunnel Tunelo.

LÀM VIỆC CÙNG NHAU VÀ AI AGENT
• Workspace, mời đồng đội vào project, bình luận, fork và pull request cho collection.
• Mỗi project mock có sẵn MCP endpoint: AI agent gọi tool trên chính dữ liệu của mock.

RIÊNG TƯ
• Không quảng cáo, không công cụ phân tích hay theo dõi.
• Đăng nhập bằng tài khoản hoandat.com qua trình duyệt của hệ thống; app không giữ mật khẩu của bạn.
• Xoá tài khoản và dữ liệu ngay trong app, ở Tài khoản và hạn mức.
```

EN:

```
Localman lets developers build stateful mock REST APIs in minutes, send requests and follow every call, right on the phone. It is the whole Localman web app, with the same account and data.

STATEFUL MOCK REST APIS
• Declare resources as a table of fields; pick a data type or a Faker.js method.
• Generate fake data in one tap and get CRUD endpoints right away: GET, POST, PUT, PATCH, DELETE.
• Nest resources for endpoints like /users/:userId/orders.
• Pagination, sorting and filtering by query string; custom responses per endpoint, custom endpoints, rules and simulated errors.
• Hybrid mode: forward the routes you have not mocked to the real API.

WATCH THE TRAFFIC
• Live request log: method, path, status, duration, headers and bodies, with sensitive headers hidden.
• Webhook inbox: a URL that receives webhooks, answers the way you set it and records every delivery.
• Open any logged request in the API client to resend or edit it.

API CLIENT
• Collections, environments and variables (secret values encrypted), request history.
• Paste a cURL command to create a request; see pretty JSON, headers and timing.
• Reach localhost or machines on your LAN through a Tunelo tunnel.

TEAMS AND AI AGENTS
• Workspaces, invite teammates to a project, comments, forks and pull requests for collections.
• Every mock project has an MCP endpoint: AI agents call tools on the mock's own data.

PRIVACY
• No ads, no analytics or tracking tools.
• Sign in with your hoandat.com account in the system browser; the app never holds your password.
• Delete your account and its data in the app, under Account and limits.
```

## Từ khoá App Store (≤ 100 byte, phẩy không cách; không lặp chữ đã có trong tên/phụ đề)

- VI (95 byte): `json,faker,webhook,http,curl,endpoint,backend,frontend,developer,lập trình,kiểm thử,test`
- Không đưa tên sản phẩm khác vào từ khoá (guideline 2.3.7, và quy tắc của repo không nêu tên đối thủ).
- EN (94 byte): `json,faker,webhook,http,curl,endpoint,backend,frontend,developer,testing,stub,fake data,tunnel`

## Ảnh

| Loại | File | Ghi chú |
|---|---|---|
| iPhone 6.9" (1320 × 2868) | `screenshots/ios-6.9/*.png` | bắt buộc; App Store tự thu nhỏ cho máy nhỏ hơn |
| iPhone 6.5" (1284 × 2778) | `screenshots/ios-6.5/*.png` | |
| Play, điện thoại 9:16 (1080 × 1920) | `screenshots/android/*.png` | 2–8 ảnh |
| Play, icon 512 × 512 | `play/icon-512.png` | sinh bằng `pnpm brand:gen` |
| Play, feature graphic 1024 × 500 | `play/feature-graphic.png` | bắt buộc để xuất bản; sinh bằng `pnpm brand:gen` |

Ảnh chụp sinh lại bằng `pnpm store:screenshots` (xem [mobile-app.md](../mobile-app.md#ảnh-cửa-hàng)). Icon và ảnh Play
đang dùng **dấu tạm** (chữ L trên nền violet, ADR-0006): có icon thiết kế thì thay SVG, chạy `pnpm brand:gen` và tải
lại ảnh Play; icon App Store đi theo bản build.

## Phân loại độ tuổi

App Store (bảng câu hỏi Age Rating), Play (bảng IARC). Trả lời theo nội dung thật của app:

| Câu hỏi | Trả lời | Lý do |
|---|---|---|
| Bạo lực, nội dung người lớn, ngôn từ thô tục, ma tuý/rượu/thuốc lá, kinh dị, cờ bạc, mô phỏng cờ bạc, thông tin y tế, chủ đề người lớn | Không | Công cụ cho developer |
| Cuộc thi, giải thưởng | Không | |
| Truy cập web không giới hạn | **Không** | API client hiện response; xem trước HTML nằm trong khung sandbox (không script, link không mở được, `apps/web/src/features/api-client/response/html-preview.tsx`), không phải trình duyệt |
| Nội dung do người dùng tạo / người dùng tương tác | **Có** | Bình luận giữa người được mời vào project, link xem collection công khai (chỉ người có link, không có trang khám phá). Play IARC: "Users can interact" = Có, "Shares user location" = Không, "Digital purchases" = Không |
| Nhắn tin / chat | Không | Bình luận gắn với collection, không có chat |
| Quảng cáo | Không | |
| Kiểm soát của phụ huynh, xác minh tuổi | Không | |
| Dự kiến | App Store 4+ (Apple tự tính), Play: mọi lứa tuổi / PEGI 3 | Đối tượng mục tiêu Play: 18+ (công cụ cho developer; trang privacy chưa nêu tuổi tối thiểu, xem việc của chủ app) |

## App Privacy (App Store Connect)

Không theo dõi (tracking): **Không**. Không SDK quảng cáo hay phân tích. Mọi dữ liệu dưới đây **liên kết với danh tính
người dùng** (gắn tài khoản) và chỉ dùng cho **chức năng của app** (App Functionality); không dùng cho quảng cáo,
phân tích hay cá nhân hoá.

| Loại của Apple | Thu thập | Gồm (theo /privacy) |
|---|---|---|
| Contact Info › Name | Có | Tên hiển thị từ tài khoản hoandat.com; tên tuỳ chọn trong form góp ý |
| Contact Info › Email Address | Có | Email của tài khoản (và đã xác minh hay chưa); email trả lời tuỳ chọn trong form góp ý |
| Contact Info › Other User Contact Info | Có | Chat Telegram đã liên kết (nếu có); username Telegram tuỳ chọn trong form góp ý |
| Identifiers › User ID | Có | Account ID, username |
| User Content › Customer Support | Có | Nội dung form góp ý / liên hệ |
| User Content › Other User Content | Có | Project, resource và dữ liệu mock, rule, webhook inbox, collection, request, environment, biến, bình luận, fork, lịch sử request |
| Usage Data › Other Usage Data | Có | Bộ đếm mock và proxy request mỗi tháng (cho hạn mức) |
| Diagnostics › Other Diagnostic Data | Có | Log kỹ thuật mỗi request tới server (ID, method, route, status, thời gian); request qua proxy kèm account ID và host đích |
| Location, Health, Financial, Contacts, Browsing/Search History, Sensitive Info, Purchases, Photos/Videos, Audio | Không | |

Ghi chú: log request tới mock API (header, body) là dữ liệu người dùng tự gửi tới mock của mình, đã tính trong "Other
User Content". Bộ đếm rate limit dùng hash của dải IP, xoá khi hết cửa sổ thời gian, không lưu vị trí.

## Play Data safety (Play Console)

| Câu hỏi | Trả lời |
|---|---|
| App có thu thập hoặc chia sẻ dữ liệu người dùng thuộc các loại bắt buộc khai? | Có |
| Mọi dữ liệu được mã hoá khi truyền? | Có (HTTPS tới `localman.hoandat.com`) |
| Người dùng có thể yêu cầu xoá dữ liệu? | Có: trong app (Tài khoản và hạn mức › Xoá tài khoản) và `https://localman.hoandat.com/account/delete` |
| Chia sẻ với bên thứ ba | **Không**: Cloudflare là nhà cung cấp dịch vụ xử lý thay mặt (được miễn khai); thông báo Telegram và request tới địa chỉ người dùng tự đặt là hành động do người dùng khởi tạo (được miễn khai) |

Dữ liệu thu thập (đều là **bắt buộc** để dùng app trừ khi ghi "tuỳ chọn"; mục đích: **App functionality**, **Account
management**; với log kỹ thuật thêm **Fraud prevention, security, and compliance**; không xử lý tạm thời):

| Nhóm › Loại của Play | Gồm |
|---|---|
| Personal info › Name | Tên hiển thị; tên trong form góp ý (tuỳ chọn) |
| Personal info › Email address | Email tài khoản; email trả lời trong form góp ý (tuỳ chọn) |
| Personal info › User IDs | Account ID, username, chat Telegram đã liên kết (tuỳ chọn) |
| Messages › Other in-app messages | Bình luận trong project (tuỳ chọn) |
| App activity › Other user-generated content | Project, mock, collection, request, environment, biến, lịch sử, nội dung form góp ý |
| App activity › Other actions | Bộ đếm request mỗi tháng (hạn mức) |
| App info and performance › Diagnostics | Log kỹ thuật mỗi request (không header, cookie, body hay query) |

Không thu thập: Location, Financial info, Health, Photos/videos, Audio, Files and docs, Calendar, Contacts, Web
browsing, Device or other IDs (app không đọc ID thiết bị; token phiên nằm trong Keystore/Keychain của máy).

## Ghi chú cho App Review (App Store "Notes", Play "App access")

Dán bản tiếng Anh; điền email/mật khẩu vào ô "Sign-in information" (App Store) hoặc "App access › instructions" (Play)
**lúc nộp**, không ghi vào repo.

```
Localman is a developer tool: build mock REST APIs, send HTTP requests and inspect the traffic. The app is the full Localman web app (https://localman.hoandat.com) in a native shell.

SIGN-IN
Sign-in uses our account service, auth.hoandat.com, opened in the system browser (ASWebAuthenticationSession on iOS, Auth Tab / Custom Tabs on Android). Tap "Sign in" ("Đăng nhập") in the top bar. On the sign-in page, below the Google/GitHub/Apple buttons, tap "App reviewer sign-in" ("Tài khoản dành cho người duyệt ứng dụng") and enter the email and password given in the sign-in information of this submission. The app then returns to the project list. This review account holds no real user data and is turned off after review.

WHAT TO TRY
1. Projects > "Create a new project", open it, "Add resource" (for example "users"), then "Generate all": the resource gets CRUD endpoints (GET, POST, PUT, PATCH, DELETE) at the mock URL shown on the page.
2. Open the "Request log" tab of the endpoint card and call the mock URL from the API client: the call appears live.
3. "Inbox" tab: create a webhook inbox and send a request to its URL from the API client.
4. API client (top bar): send any request and see the response.

ACCOUNT DELETION
In the app: account menu (avatar, top right) > "Account and limits" > "Delete account…", confirm by typing the username. Public page: https://localman.hoandat.com/account/delete

No in-app purchases, no ads, no tracking. Support: quocdat254@gmail.com
```

Bản tiếng Việt (để chủ app đối chiếu):

```
Localman là công cụ cho developer: dựng mock REST API, gửi request HTTP và xem lưu lượng. App là toàn bộ web app Localman (https://localman.hoandat.com) trong vỏ native.

ĐĂNG NHẬP
Đăng nhập qua dịch vụ tài khoản auth.hoandat.com, mở trong trình duyệt của hệ thống. Bấm "Đăng nhập" trên thanh trên cùng. Ở trang đăng nhập, dưới các nút Google/GitHub/Apple, bấm "Tài khoản dành cho người duyệt ứng dụng" (tiếng Anh: "App reviewer sign-in") rồi nhập email và mật khẩu ghi trong phần thông tin đăng nhập của lần nộp này. App quay lại danh sách project. Tài khoản duyệt không có dữ liệu thật và được tắt sau khi duyệt xong.

XOÁ TÀI KHOẢN
Trong app: menu tài khoản (ảnh đại diện, góc phải trên) > "Tài khoản và hạn mức" > "Xoá tài khoản…", gõ username để xác nhận. Trang công khai: https://localman.hoandat.com/account/delete
```

Tài khoản duyệt là của auth-next (repo `auth-next`, `docs/decisions/0010-review-only-password-sign-in.md`):
chủ app bật trên IdP prod bằng `REVIEW_LOGIN_EMAIL` và `REVIEW_LOGIN_PASSWORD_HASH_PATH` (hash sinh bằng
`pnpm -s review-login:hash` của auth-next, mật khẩu đọc từ stdin), mục "Đăng nhập cho người duyệt ứng dụng" của
deployment guide auth-next; duyệt xong thì xoá hai biến và restart. Repo này không giữ email hay mật khẩu đó.

## Việc của chủ app trước khi nộp

1. Tạo app record `com.hoandat.localman` trên App Store Connect (team `AM5C55N339`) và Play Console.
2. Bật đăng nhập mobile trên prod: `MOBILE_IOS_TEAM_ID` và `MOBILE_ANDROID_CERT_SHA256` (vân tay khoá ký Play App
   Signing) trong `/opt/localman/.env` ([mobile-app.md](../mobile-app.md#bật-đăng-nhập-trên-prod)).
3. Bật tài khoản duyệt trên auth-next (ở trên) và điền email/mật khẩu vào ô thông tin đăng nhập lúc nộp.
4. Trang `/privacy` và `/terms` còn mục "đang cập nhật": tên người vận hành (operator) và tuổi tối thiểu. Play yêu cầu
   chính sách nêu nhà phát triển; nên chốt hai mục này trước khi nộp (`docs/legal-pages-review.md`).
5. Xác nhận từ khoá và danh mục (Developer Tools / Productivity).
6. Icon thiết kế (tuỳ chọn trước lần nộp đầu): thay SVG, `pnpm brand:gen`.
