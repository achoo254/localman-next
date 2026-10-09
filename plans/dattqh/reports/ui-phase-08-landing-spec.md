# Đặc tả UI phase 08: landing, bảng giá, header tài khoản, form góp ý

Đầu vào cho T2–T5 và T8. Nguồn đã đối chiếu: `prototype/index.html` (`topbar` 1732, `PLAN_CARDS`/`planItems` 1768–1796, `FEATURES` 1790, `heroHTML` 1803, `liveSyncSection` 1846, `directSection` 1892, `mockMcpSection` 1907, `comparisonSection` 1932, `viewLanding` 1951, `endpointGroups` 2077, `openFeedback` 2264, `hybridSection` 2813, `viewAccount` 2842, `accountMenu` 2863, `COMPETITOR_FACTS` 1055, `TREE_GEOMETRY.demo` 1489, `seedLanding` 1305), `competitive-261008-1308-…md`, `docs/design-system.md`, `packages/shared/src/plan-limits.ts`, code hiện có (`landing-page.tsx`, `landing-pricing.tsx`, `plan-card.tsx`, `app-header.tsx`, `app-layout.tsx`, `account-page.tsx`, `resource-tree/*`, `pro-interest-*`).

## 0. Nguyên tắc trung thực (áp cho mọi khối)

- Một mục chỉ hiện khi tính năng đã lên production. Mục chưa có cờ thì **không render** (không ghi "Sắp có"), trừ hai thẻ Custom endpoints và Webhooks trong khối "Và nhiều hơn", vì phase yêu cầu rõ.
- Theo trạng thái repo ngày 09/10/2026: đã có mock runtime, query, Faker, custom response, object template, cộng tác theo project (phase 07). Chưa có: API client và proxy (phase 10), workspace team (11), thùng rác (12), fork/PR/public (14–15), Live Mock Sync (16), Mock MCP (17), Mock lai (20), chế độ gửi thẳng (21).
- **Đính chính so với phase:** phase ghi thẻ Free có "5.000 request qua proxy" và "trash 30 ngày". Hai mục này vi phạm quy tắc ở bước 2, nên proxy chỉ hiện khi `features.apiClient`, còn trash chỉ hiện khi có cờ của phase 12 (xem Concerns).
- Mọi số của Localman đọc từ `limitsFor()`; số Faker đọc từ `FAKER_METHOD_IDS.length` (hiện là 249), số bản ghi mỗi lần sinh đọc từ `MAX_GENERATE_COUNT` (100).

## 1. Thứ tự khối

Giữ khung của nguồn (mockapi.io: hero, giá, schema, quan hệ, "And more"), đúng thứ tự ở bước 1 của phase. Prototype đặt Live Mock Sync trước Mock lai; spec theo phase.

| # | Khối | `id` neo | `data-id` | Cờ tắt (mặc định) | Cờ bật |
|---|---|---|---|---|---|
| 1 | Hero | — | `landing-hero` | biến thể mock | biến thể localhost (`apiClient`) |
| 2 | Secret không rời trình duyệt | `direct` | `landing-direct` | ẩn | `apiClient && directMode` |
| 3 | Mock lai localhost | `hybrid` | `landing-hybrid` | ẩn | `hybridMock` |
| 4 | Live Mock Sync | `live-sync` | `landing-live-sync` | ẩn | `liveMockSync` |
| 5 | Mock MCP tức thì | `mock-mcp` | `landing-mock-mcp` | ẩn | `mockMcp` |
| 6 | So sánh | `compare` | `landing-compare` | hiện, 5 hàng | hiện, thêm hàng theo cờ |
| 7 | Bảng giá | `pricing` | `landing-pricing` | hiện | hiện, thêm mục theo cờ |
| 8 | Mô hình dữ liệu | `modeling` | `landing-modeling` | hiện | hiện |
| 9 | Quan hệ giữa resources | `relations` | `landing-relations` | hiện | hiện |
| 10 | Và nhiều hơn | `features` | `landing-features` | hiện | hiện |
| 11 | Dải CTA | — | `landing-cta` | hiện | hiện |
| 12 | Footer | — | `app-footer` (dùng chung) | hiện | hiện |

Khi tắt hết cờ, trang là: 1 → 6 → 7 → 8 → 9 → 10 → 11 → 12. Nút "Xem cách hoạt động" cuộn tới `#live-sync` nếu `liveMockSync`, ngược lại tới `#relations`.

## 2. Bố cục chung

- Container `max-w-page` (1120px), `px-gutter` (16px, lên 24px từ 768px). Khoảng dọc mỗi khối: `py-16` (64px), lên `md:py-24` (96px).
- Đầu khối: eyebrow `<p>` (mono 12px, `uppercase`, `tracking-[0.12em]`, `text-primary`; trong source viết sentence case), `h2` (bold, `clamp(26px,4vw,36px)`, `tracking-[-0.02em]`), lead `<p>` (`text-muted`, 17px, `max-w-160`). Tất cả **căn trái**.
- Mỗi `<section>` có `aria-labelledby` trỏ vào `h2`. Trang chỉ có một `h1` (hero).
- Breakpoint: prototype dùng 960px; spec map sang `lg` (1024px) của Tailwind. Dải 960–1023 sẽ xếp một cột, chấp nhận được.
- **Thêm `size="lg"` cho `Button`** (`min-h-12 px-6 text-base`, `pointer-coarse:min-h-12`). Có 3 call-site: 2 CTA ở hero và CTA ở dải cuối trang.
- Cuộn mượt chỉ khi `motion-safe`; `scroll-padding-top` bằng `--topbar-h` + 16px để tiêu đề không bị topbar che.

## 3. Header

### 3.1 Header công khai (`AppLayout`, trang `/` và `/invite/:token`)

| Phần tử | Chữ | `data-id` | 375 | 768 | 1440 |
|---|---|---|---|---|---|
| Wordmark (link `/`) | `aria-label="Localman — trang chủ"` (giữ nguyên) | `topbar-home` | có | có | có |
| `<nav aria-label="Điều hướng chính">` gồm 3 link neo (`<a href="#features">`…), chỉ ở `/` | Tính năng · So sánh · Bảng giá | `topbar-features`, `topbar-compare`, `topbar-pricing` | ẩn | có | có |
| Link Docs (route `/docs` của T6), ghost | Docs | `topbar-docs` | ẩn (có ở footer) | có | có |
| `ThemeToggle` | (giữ) | `topbar-theme` | ẩn (có ở footer) | có | có |
| `LoginLink`, ghost | Đăng nhập | `topbar-login` | có | có | có |
| `LoginLink prompt="create"`, primary | Bắt đầu | `topbar-signup` | có | có | có |

Lý do ẩn ở 375: wordmark (~110px), "Đăng nhập" và "Bắt đầu" đã chiếm ~300 trên 343px khả dụng. Link neo dùng `<a>`, không dùng `<button>` như prototype, để trình đọc màn hình hiểu đây là điều hướng trong trang.

### 3.2 Header khi đã đăng nhập (`app-header.tsx`)

Thêm link **Docs** (ghost `sm`, `data-id="topbar-docs"`, `max-sm:hidden`) đứng trước chuông. Ở 375 thì Docs nằm trong menu tài khoản.

Menu tài khoản (`data-id="account-menu"`), theo thứ tự:

| # | Mục | Mở ở đâu | Primitive / hành vi | `data-id` |
|---|---|---|---|---|
| — | Label: tên, email, "Gói Free" | — | `DropdownMenuLabel` (giữ) | — |
| 1 | Tài khoản và hạn mức | **Trang trong app** `/account` | `navigate` | `account-menu-account` (giữ) |
| 2 | Quản lý gói | **Modal trong app** (`ManageSubscriptionModal`) | `useSubscriptionDialogs().openPlans()` | `account-menu-plan` (giữ) |
| 3 | Kênh thông báo | **Trang trong app** `/account/notifications` (không phải modal) | `navigate(NOTIFICATION_SETTINGS_PATH)` | `account-menu-notifications` (giữ, đổi chữ "Thông báo" thành "Kênh thông báo" cho khỏi nhầm với chuông) |
| 4 | Docs (chỉ `sm:hidden`) | Trang trong app `/docs` | `navigate` | `account-menu-docs` |
| — | Separator, rồi label nhỏ "Tài khoản hoandat · mở tab mới" | — | `DropdownMenuLabel` | — |
| 5 | Đổi email ↗ | **Trang IdP** `auth.hoandat.com/account` | `openExternal(idpAccountUrl)` | `account-menu-email` |
| 6 | Mã khôi phục ↗ | **Trang IdP** `auth.hoandat.com/account` | `openExternal(idpAccountUrl)` | `account-menu-recovery` |
| 7 | Mật khẩu và đăng nhập ↗ | **Trang IdP** (mật khẩu, Google/GitHub, Telegram, phiên) | `openExternal(idpAccountUrl)` | `account-menu-idp` (giữ id, đổi chữ "Quản lý tài khoản") |
| 8 | Quản trị · Quan tâm gói Pro (owner) | Trang trong app | giữ | `account-menu-admin-pro` |
| 9 | Quản trị · Hộp thư góp ý (owner) | Trang trong app `/admin/feedback` (T5) | `navigate` | `account-menu-admin-feedback` |
| — | Separator | | | |
| 10 | Đăng xuất | Form POST `/auth/logout` (giữ `useLogout`) | | `topbar-logout` (giữ) |

- Ba mục IdP có icon `IconExternalLink` 14px ở cuối (`aria-hidden`), kèm `<span className="sr-only">, mở trang tài khoản hoandat ở tab mới</span>`.
- Localman không tự sửa email hay mã khôi phục: email là claim của IdP, Localman chỉ đồng bộ khi đăng nhập hoặc refresh. Nếu IdP có neo (`/account#email`, `/account#recovery`) thì dùng neo (xem Concerns).
- Icon: Tài khoản `IconGauge`, Gói `IconBox`, Kênh `IconBell`, Docs `IconBook`, Email `IconMail`, Mã khôi phục `IconKey`, Mật khẩu `IconUser`, Hộp thư `IconInbox`, Đăng xuất `IconLogout`.

## 4. Hero (`hero-section.tsx`)

Lưới `lg:grid-cols-[1.05fr_0.95fr] lg:gap-12`, `py-16 lg:py-24`. Cột trái là chữ (`landing-hero-copy`), cột phải là thẻ code (`landing-hero-preview`). `AuthErrorAlert` (giữ, `landing-auth-error`) nằm đầu cột chữ.

| Phần | Cờ tắt (mock) | Cờ bật (`apiClient`) |
|---|---|---|
| Badge `primary` | Mock REST API cho developer | Localhost ngay trên trình duyệt |
| `h1` | Mock `REST API` có trạng thái, quan hệ và Faker, gói Free {projects} project | Test API `localhost` ngay trên trình duyệt |
| Phụ đề (`landing-hero-sub`) | Khai báo resource, sinh dữ liệu giả bằng một click và có ngay endpoint CRUD đầy đủ. Frontend không phải chờ backend nữa. | **Không cần cài app hay extension, chỉ một lệnh Tunelo.** Chạy `tunelo http 3000`, Localman tự nhận tunnel theo port và gửi request tới `localhost` hay máy trong mạng LAN. Kèm mock REST API có trạng thái để frontend không phải chờ backend. |
| CTA 1, primary `lg` | Bắt đầu miễn phí → (`LoginLink prompt="create"`, `landing-hero-cta`) | như bên trái |
| CTA 2, secondary `lg` | Xem cách hoạt động (`landing-hero-how`) | như bên trái |
| Ghi chú 13px muted | Không cần thẻ thanh toán. Gói Free gồm {projects} project, {resources} resource mỗi project, custom response miễn phí. | Không cần thẻ thanh toán. Gói Free gồm {projects} project mock, {resources} resource và {proxy} request qua proxy mỗi tháng. |
| Thẻ code | `GET https://{secret}.localman.hoandat.com/api/v1/users?page=1&limit=2`, JSON 2 bản ghi, chân thẻ "200 OK" · "2 bản ghi" | `GET http://localhost:3000/api/orders?limit=2`, chip "qua Tunelo" (`landing-hero-preview-tunnel`), chân thẻ "200 OK" · "Tự nhận tunnel port 3000" |

- Bỏ số "38 ms"/"41 ms" của prototype: thẻ là minh hoạ tĩnh, số thời gian không đo thật.
- JSON lấy từ fixture (`content/landing-samples.ts`), không import Faker vào landing (Lighthouse). Fixture được sinh một lần bằng runner Faker thật của `@localman/shared`; test kiểm mỗi bản ghi có đủ field của schema demo.
- Từ "Mock" và "localhost" trong `h1` bọc `<span className="font-mono text-primary">`.
- **375:** một cột. `h1` `clamp(30px,4.4vw,46px)`, hai CTA `w-full` xếp chồng (`max-sm:`), URL trong thẻ code cuộn ngang trong thẻ. **768:** một cột, hai CTA nằm cùng hàng. **1440:** hai cột, thẻ code căn giữa theo chiều dọc.

## 5. Khối gắn cờ (copy lấy từ prototype, chỉ render khi cờ bật)

**2. Secret không rời trình duyệt.** Eyebrow "Gửi thẳng từ trình duyệt"; h2 "Secret không rời trình duyệt"; lead: "Ở chế độ Auto, request đi thẳng từ trình duyệt tới API khi đích cho phép, không qua server trung gian. Secret không rời trình duyệt với request gửi thẳng; nếu phải qua proxy, Localman hỏi bạn trước." Thẻ "Đường đi của một request" có 3 dòng (`landing-direct-route-{direct|proxy|localhost}`), giữ đúng chữ của `DIRECT_ROUTES`. Link "Dữ liệu của bạn nằm ở đâu →" (`landing-direct-data-link`) trỏ trang của phase 21.

**3. Mock lai localhost.** Eyebrow "Mock lai localhost"; h2 "Mock phần chưa có, phần đã có chạy thật trên máy bạn"; lead: "Route khớp resource trong mock thì mock trả. Route còn lại chuyển tiếp tới backend local qua Tunelo (`tunnel:3000`) hoặc một URL. Frontend chỉ cần một base URL, request log ghi lại mọi lượt gọi." Danh sách 4 route (`landing-hybrid-route-{slug}`): badge `primary` "Mock · 200" hoặc `neutral` "localhost:3000 · 200".

**4. Live Mock Sync.** Eyebrow "Live Mock Sync"; h2 "Đổi mock, collection tự cập nhật"; lead: "Mock có trạng thái tự sinh một collection kèm environment chạy được ngay, và giữ chúng đồng bộ. Đổi tên resource thì path của request đổi theo; header hay body bạn đã sửa vẫn được giữ." Hai thẻ (`landing-live-sync-mock`, `landing-live-sync-collection`), nút "Đổi tên users → members" (`landing-live-sync-play`), "Đặt lại" (`landing-live-sync-reset`), badge "Đã đồng bộ" hoặc "5 request đã cập nhật" (`aria-live="polite"`). Dòng cuối: "Header `X-Debug` bạn đã thêm vào “List members” được giữ nguyên". Khi bật cờ, phải rà lại câu "vẫn được giữ" với hành vi thật của phase 16 (có bước xem diff trước khi áp).

**5. Mock MCP tức thì.** Eyebrow "Mock MCP tức thì"; h2 "Mock của bạn thành tool cho AI agent"; lead: "Mỗi project mock có sẵn một MCP endpoint. Agent gọi `list_users` hay `create_posts` trên chính dữ liệu có trạng thái của mock, không phải tự viết MCP server." Snippet `claude mcp add --transport http localman-mock {url}` kèm nút "Sao chép" (`landing-mock-mcp-copy`) báo kết quả qua `aria-live`. Đường dẫn `/api/v1/mcp` phải lấy theo phase 17.

**375/768:** mỗi khối một cột. **1440:** hai thẻ cạnh nhau (`lg:grid-cols-2`); riêng khối 2 và 3 chỉ có một thẻ rộng.

## 6. So sánh (`comparison-section.tsx` + `content/competitor-facts.ts`)

Eyebrow "So sánh"; h2 "Localman so với mockapi.io và Postman"; lead "Số liệu gói Free công khai của từng bên, ghi ngày và nguồn để bạn tự kiểm." Chỉ ghi tên đối thủ, không logo.

| `key` | Tiêu chí | Localman (từ `FREE_LIMITS`) | mockapi.io | Postman | Hiện khi |
|---|---|---|---|---|---|
| `members` | Thành viên ở gói Free | Tối đa {membersPerWorkspace} thành viên mỗi project, tính cả bạn | 1 user, không cộng tác | 1 user, không có viewer hay chia sẻ | luôn |
| `mock-free` | Mock ở gói Free | {projects} project, {resources} resource mỗi project | 1 project, 2 resource | Mock server trả example đã lưu | luôn |
| `custom-response` | Custom response | `customResponse` ? "Miễn phí" : "Gói trả phí" | Chỉ gói trả phí | Có, theo example đã lưu | luôn |
| `stateful` | Mock có trạng thái kèm quan hệ | Có: CRUD, resource lồng nhau, Faker, không cần viết code | Có (CRUD, quan hệ) | Mock trả example; code mock giữ trạng thái (beta, soạn trên desktop, chạy cloud từ gói Solo) | luôn |
| `localhost` | Gọi localhost từ web | Có, qua Tunelo, tự nhận tunnel theo port | Không | Phải cài Postman Desktop Agent | `apiClient` |
| `restore` | Khôi phục collection | Thùng rác giữ {trashDays} ngày | Không có | 1 ngày | cờ thùng rác (phase 12) |
| `vietnamese` | Tiếng Việt | Có, giữ thuật ngữ EN | Không (EN) | Không (EN) | luôn |

**Hàng "gọi localhost từ web" khi cờ tắt: ẩn hẳn, không ghi "Sắp có".** Lý do: bảng so sánh đặt tính năng của mình cạnh tính năng đang chạy của đối thủ. Ô "Sắp có" biến lời hứa thành điểm cộng, và người đọc lướt dễ hiểu nhầm là đã có. Ẩn hàng là cách trung thực, đúng với `requires` của prototype. Hàng `restore` cũng theo quy tắc đó.

Nguồn (`COMPETITOR_FACTS.sources`), đọc ngày **08/10/2026**:

| Hàng | Nguồn |
|---|---|
| members, restore (Postman) | [postman.com/pricing](https://www.postman.com/pricing/) |
| localhost (Postman) | [About the Postman Agent](https://learning.postman.com/docs/getting-started/basics/about-postman-agent/) |
| stateful, custom-response (Postman) | [Postman mock servers](https://learning.postman.com/docs/design-apis/mock-apis/overview/) |
| mọi hàng mockapi.io | [mockapi.io](https://mockapi.io/) (trang giá và modal "Manage subscription" công khai) |

- Dòng meta dưới bảng (`landing-compare-meta`): "Cập nhật 08/10/2026", rồi các link nguồn (`ExternalLink`, `landing-compare-source-{n}`), rồi câu "mockapi.io: hạn mức gói Free lấy từ trang giá và modal Manage subscription công khai."
- `competitor-facts.ts` lưu `updatedAt` dạng ISO (`2026-10-08`) và format bằng `formatDate`. Mỗi ô đối thủ có `sourceId` để rà lại; UI chỉ hiện danh sách nguồn chung.
- Bảng: `<caption className="sr-only">So sánh gói Free của Localman, mockapi.io và Postman</caption>`, `th scope`. Cột Localman có nền tint primary 6%, viền trên 3px và chữ đậm, nên không chỉ dựa vào màu.
- **375:** bảng `min-w-160` cuộn ngang trong thẻ. Khung cuộn có `role="region"`, `aria-label="Bảng so sánh, cuộn ngang"` và `tabIndex={0}` (luật axe `scrollable-region-focusable`); cột tiêu chí `sticky left-0`. **768/1440:** vừa khung, không cuộn.

## 7. Bảng giá (`pricing-section.tsx`, `pricing-table.tsx`)

- Eyebrow **"Bảng giá"** (hiện thành "BẢNG GIÁ"); h2 **"Bắt đầu miễn phí, nâng cấp khi cần"**; căn trái. Lưới thẻ `md:grid-cols-2 max-w-220`, căn trái theo container.
- `PlanCard` cần thêm: prop `price` (dòng giá lớn: mono bold `text-4xl leading-none`) tách khỏi `lead`, và `size: "md" | "sm"`. Landing dùng `md` (`p-6`, danh sách `text-sm` = 14px); modal Quản lý gói giữ `sm` (`p-4`, 13px).
- `planItems(limits, features)` nhận cờ để modal và landing cùng ẩn mục chưa có.

| | Free (`pricing-card-free`) | Pro (`pricing-card-pro`, `featured`) |
|---|---|---|
| Tên | Free | Pro |
| Badge | — | Đang nhận đăng ký (`primary`) |
| Dòng giá / lead | **Miễn phí** (dòng giá lớn) | Không có giá. Lead: "Hạn mức lớn hơn cho team và các project chạy thật. Để lại nhu cầu, chúng tôi liên hệ khi gói Pro mở." |
| Mục 1 | {projects} project | 20 project |
| Mục 2 | {resources} resource mỗi project | 50 resource mỗi project |
| Mục 3 | Custom response và object template | như Free |
| Mục 4 | Tối đa {members} thành viên mỗi project, tính cả bạn | Tối đa 10 thành viên mỗi project, tính cả bạn |
| Mục 5 | 10.000 request tới mock mỗi tháng | **Không giới hạn request tới mock mỗi tháng** |
| Mục 6 (`apiClient`) | 5.000 request qua proxy mỗi tháng | Không giới hạn request qua proxy mỗi tháng |
| Mục 7 (cờ thùng rác) | Thùng rác giữ 30 ngày | Thùng rác giữ 30 ngày |
| CTA | Bắt đầu miễn phí (secondary block, `LoginLink prompt="create"`, `pricing-card-free-cta`) | **Liên hệ** (primary block, mở `ProInterestModal source="landing"`, `pricing-card-pro-cta`) |

- Số lấy từ `limitsFor`; `null` thành "Không giới hạn … mỗi tháng" (đúng như `monthly()` hiện có).
- Ghi chú dưới thẻ (`landing-pricing-note`, 13px muted): "Gói Pro chưa mở thanh toán. Bấm Liên hệ để cho chúng tôi biết bạn cần gì. Mức không giới hạn theo tháng vẫn có giới hạn tốc độ theo giây để chống lạm dụng."
- Mục workspace team và "Fork, pull request, public sharing" của prototype chưa render cho tới khi phase 11 và 14 có cờ.
- **375/768/1440:** 1 cột ở 375, 2 cột từ 768. Nút CTA nằm sát đáy (`mt-auto`) để hai thẻ thẳng hàng.

## 8. Mô hình dữ liệu (`data-modeling-demo.tsx`)

Eyebrow "Schema"; h2 "Mô hình dữ liệu đơn giản"; lead "Mỗi resource là một bảng field. Chọn kiểu dữ liệu hoặc method Faker.js, Localman sinh dữ liệu đúng cấu trúc đó."

- Lưới 8 cột ở `lg`: chữ `col-span-3`, demo `col-span-5`. Trong cột demo, thẻ schema và thẻ preview xếp chồng.
- Thẻ schema (`landing-modeling-schema`): tiêu đề "users · schema", badge "6 field". Bảng Field / Type / Method: `id` · Object ID · — (hàng cố định, muted); `createdAt` · Faker.js · `date.past`; `name` · Faker.js · `name.fullName`; `avatar` · Faker.js · `image.avatar`; `email` · Faker.js · `internet.email`; `isActive` · Boolean · —. Mọi id Faker đều có trong catalog (prototype ghi `person.fullName`, sai catalog).
- Thẻ preview (`landing-modeling-preview`): `GET /users`, JSON 2 bản ghi lấy từ fixture; chân thẻ "Dữ liệu mẫu từ Faker.js" và nút secondary `sm` "Xem mẫu khác" (`landing-modeling-reroll`). Prototype ghi "Sinh lại" nhưng landing không chạy Faker, nên đổi chữ cho đúng.
- **375/768:** chữ, rồi 2 thẻ chồng; bảng cuộn ngang trong thẻ. **1440:** 3/5.

## 9. Quan hệ giữa resources (`relations-demo.tsx`, `generated-endpoints-list.tsx`)

Eyebrow "Quan hệ"; h2 "Quan hệ giữa resources"; lead: "Lồng resource vào nhau để có endpoint dạng `/users/:userId/posts`. Thử lồng **comments** vào **posts** bên dưới."

- Thẻ cây (`landing-relations-tree`): tiêu đề "Cây resource", nút ghost `sm` "Đặt lại" (`landing-relations-reset`), dòng hint `aria-live` của canvas (giữ chữ hiện có), canvas `mode="demo"`.
- Chế độ `demo` của `ResourceTreeCanvas`: hình học `TREE_GEOMETRY.demo` của prototype (node 156×44, hàng 60, cột 200, gốc (64, 12), connector 22). Node chỉ có tên (`<span>`, không phải link), không có thanh generator và hàng Sửa / Dữ liệu / Xoá. `data-id` là `demo-node-{name}` và `demo-node-root`. Dữ liệu chỉ nằm trong state client, không gọi API.
- Thẻ endpoint (`landing-relations-endpoints`): tiêu đề "Endpoint được sinh", badge `primary` "{n} endpoint" (`landing-relations-count`, `aria-live="polite"`). Mỗi nhóm `landing-ep-{name}` có tên resource rồi các dòng `[method badges] path`. Path mới xuất hiện sau thao tác lồng được tô nền tint trong 1,2 giây (`motion-safe`).
- **Thứ tự nhóm:** độ sâu tăng dần, cùng độ sâu thì theo thứ tự cây (cha trước con, anh em cũ trước). **Trong nhóm:** `/{name}` (GET POST), `/{name}/:id` (GET PUT DELETE), rồi nếu có cha thì `/{parent}/:{parentKeyOf(parent)}/{name}` (GET POST) và `…/:id` (GET PUT DELETE). Mỗi resource gốc có 5 endpoint, resource lồng có 10.
- **Lưới:** `lg:grid-cols-8`, cây `col-span-5` (khoảng 650px, đủ cho cây sâu 2 cần 644px), danh sách `col-span-3`, cao bằng thẻ cây, `overflow-y-auto` có `tabIndex={0}`. Ở 375 và 768, thẻ cây nằm trên, danh sách bên dưới; cây cuộn ngang trong thẻ ở 375.

### 4 cấu hình cây mẫu (cho T7)

Tên seed theo `seedLanding` của prototype, sibling theo thứ tự: users, posts, comments, likes. Mỗi dòng ghi `METHOD… path`.

**A. Mặc định (khi tải trang và sau "Đặt lại")**: users › posts; comments, likes ở root. Có **25 endpoint**.
```
users     GET POST /users · GET PUT DELETE /users/:id
comments  GET POST /comments · GET PUT DELETE /comments/:id
likes     GET POST /likes · GET PUT DELETE /likes/:id
posts     GET POST /posts · GET PUT DELETE /posts/:id
          GET POST /users/:userId/posts · GET PUT DELETE /users/:userId/posts/:id
```

**B. Từ A, lồng comments vào posts** (bằng `SAMPLE_TREE` trong `tree-fixtures.ts`): users › posts › comments; likes ở root. Có **30 endpoint**.
```
users     /users · /users/:id
likes     /likes · /likes/:id
posts     /posts · /posts/:id · /users/:userId/posts · /users/:userId/posts/:id
comments  /comments · /comments/:id · /posts/:postId/comments · /posts/:postId/comments/:id
```

**C. Từ A, đưa posts về root** (thanh "Thêm vào root"): cả 4 ở root. Có **20 endpoint**.
```
users · posts · comments · likes   mỗi nhóm: /{name} · /{name}/:id
```

**D. Từ B, lồng likes vào users**: users › posts › comments và users › likes. Có **35 endpoint**. Cấu hình này kiểm luật xếp anh em cùng độ sâu (posts đứng trước likes).
```
users     /users · /users/:id
posts     /posts · /posts/:id · /users/:userId/posts · /users/:userId/posts/:id
likes     /likes · /likes/:id · /users/:userId/likes · /users/:userId/likes/:id
comments  /comments · /comments/:id · /posts/:postId/comments · /posts/:postId/comments/:id
```

Ca bị từ chối: từ A, chọn users rồi lồng vào posts. Canvas báo lỗi vòng lặp qua `onRefuse`, danh sách giữ nguyên 25.

Ghi chú: runtime còn nhận chuỗi đầy đủ (`/users/1/posts/2/comments`, `route-matcher.ts`). Demo chỉ liệt kê dạng cha trực tiếp như nguồn; đây là liệt kê thiếu, không phải nói sai.

## 10. Và nhiều hơn (`more-features-section.tsx`)

Eyebrow "Tính năng"; h2 "Và nhiều hơn". Lưới `sm:grid-cols-2 lg:grid-cols-4`. Mỗi thẻ là `<article>` dùng `cardClassName` với `feature-{slug}`: ô icon 24px, `h3`, mô tả, một dòng `code`, link docs.

| Thẻ | Mô tả | Code | Link docs |
|---|---|---|---|
| Phân trang | Chia trang danh sách bằng query string. | `?page=1&limit=10` | `/docs/code-examples` |
| Sắp xếp | Sắp xếp theo field bất kỳ, tăng hoặc giảm dần. | `?sortBy=createdAt&order=desc` | `/docs/code-examples` |
| Lọc | Tìm trên mọi field hoặc lọc theo một field. | `?search=Hà Nội` · `?name=An` | `/docs/code-examples` |
| Sinh dữ liệu | {FAKER_METHOD_IDS.length} method Faker.js, sinh tới {MAX_GENERATE_COUNT} bản ghi mỗi lần bấm. | `name.fullName` | `/docs` |
| Tuỳ biến response | Template riêng cho từng endpoint, dùng biến `$mockData`, `$count` và Faker. | `{ "items": "$mockData", "total": "$count" }` | `/docs/custom-responses` |
| Cộng tác | Mời đồng đội bằng username, email hoặc link mời, cùng chỉnh một project. | `pending → accepted` | — |
| Custom endpoints · badge `accent` "Sắp có" | Tự định nghĩa đường dẫn và method ngoài CRUD mặc định. | `POST /auth/login` | — |
| Webhooks · badge `accent` "Sắp có" | Gọi URL của bạn mỗi khi dữ liệu thay đổi. | `on: create, update` | — |

- Biến template phải nằm trong ngoặc kép (luật "whole-string" của `resource-templates.ts`); prototype viết `$mockData` không ngoặc là sai.
- Link docs có chữ "Xem ví dụ" kèm `<span className="sr-only">: {tiêu đề thẻ}</span>` để mỗi link có tên riêng. Thẻ "Sắp có" dùng `opacity` thấp hơn cho phần code, chữ vẫn giữ tương phản ≥ 4.5:1.

## 11. Dải CTA và footer

**Dải CTA** (`landing-cta`, một thẻ, `flex-wrap justify-between`): h2 "Dựng mock API đầu tiên trong vài phút"; phụ "Tạo tài khoản, thêm resource, bấm thanh sinh dữ liệu là có endpoint chạy được."; nút primary `lg` "Bắt đầu miễn phí →" (`landing-cta-button`). Bỏ "chỉ mất một phút" của prototype vì đó là cam kết thời gian không đo được.

**Footer** (`app-footer.tsx` của T5, đã gắn vào `AppLayout`; nên gắn cả vào `AppShell`). Giữ `data-id` T5 đã đặt: `app-footer` và `app-footer-feedback`, không tách id riêng cho landing. Viền trên `border-border-subtle`, `py-6`, 13px muted.
- Trái (đã có): "© {năm hiện tại} Localman". Đề xuất thêm " · localman.hoandat.com" như prototype.
- Phải: link "Docs" (`app-footer-docs`, thêm mới), nút dạng link "Góp ý / Liên hệ" (đã có), `ThemeToggle` chỉ ở `<640` (`app-footer-theme`, thêm mới) vì header ẩn nút này ở 375.
- 375: tự xuống hàng (`flex-wrap`), mỗi link có vùng chạm ≥ 44px (`min-h-11`, đã có).

## 12. Form góp ý (`features/feedback/*`, mở từ footer)

**Đã khớp với code T5 đang viết** (`contact-message-schema.ts`, `feedback-fields.tsx`, xem ngày 09/10/2026). Spec này chỉ chốt copy, state và các chỗ còn lệch. `Modal` `md`, `data-id="modal-feedback"`, tiêu đề "Góp ý / Liên hệ".

| Trường | Primitive | Chữ | Ràng buộc (theo API) | `data-id` |
|---|---|---|---|---|
| Loại | `FormField` + `Select` native | Góp ý (`feedback`, mặc định) · Báo lỗi (`bug`) · Hỏi về gói (`plan_question`) | enum | `modal-feedback-kind` |
| Nội dung | `FormField` + `Textarea` 5 hàng, hint đếm "{n}/2000 ký tự" | placeholder theo loại (đề xuất): "Bạn muốn Localman làm tốt hơn điều gì?" / "Bạn đang làm gì thì gặp lỗi, và lỗi hiện ra thế nào?" / "Bạn cần hạn mức hay tính năng nào?" | 1–2.000 ký tự sau trim | `modal-feedback-body` |
| Tên (tuỳ chọn) | `Input autoComplete="name"` | | ≤ 100 | `modal-feedback-name` |
| Email hoặc Telegram (tuỳ chọn) | `Input` | placeholder "ban@example.com hoặc @username"; hint "Để lại nếu bạn muốn được trả lời." | email, hoặc username Telegram 5–32 ký tự | `modal-feedback-contact` |
| Honeypot | `div aria-hidden sr-only` > `input name="contact_extra" tabIndex={-1} autoComplete="off"`, giống `pro-interest-fields.tsx`; trong body request gửi là `website` | "Không điền ô này" | server: có giá trị thì trả như thành công, không lưu, không gửi Telegram | `modal-feedback-honeypot` |
| Turnstile (chỉ khách) | `TurnstileField` sẵn có | | bắt buộc với khách khi server bật | — |
| Nguồn (ẩn) | — | `source` theo khu vực app (`landing`, `projects`, `account`…, còn lại là `other`), không gửi đường dẫn thật, nên không lộ token của `/invite/:token` | enum | — |

Chỗ còn lệch, đề xuất T5 sửa trong lúc T8 rà:
1. **Focus ban đầu:** code đang focus ô Loại. Quy ước của `Modal` là "focus ô đầu tiên cần nhập", nên chuyển sang Nội dung vì Loại đã có giá trị mặc định.
2. **Khi đã đăng nhập:** nên prefill Tên và Email từ tài khoản (sửa được), hint đổi thành "Lấy từ tài khoản của bạn." giống form quan tâm Pro.
3. **Ghi chú dữ liệu gửi kèm** (help 13px dưới form): đã đăng nhập thì "Góp ý gắn với tài khoản của bạn để chúng tôi dễ xem lỗi."; khách thì "Không bắt buộc để lại email." Bỏ câu "Phản hồi sẽ hiện trong chuông thông báo" của prototype vì chưa có chức năng trả lời qua chuông.
4. **Câu thành công:** "Góp ý đã tới người vận hành Localman." Câu sau chỉ hiện khi người dùng có để lại liên hệ: "Chúng tôi sẽ trả lời qua {contact} nếu cần." Code hiện luôn nói "Nếu bạn để lại email hoặc Telegram…", chấp nhận được nhưng kém cụ thể.

Footer modal: Huỷ / Gửi. Các state:

| State | Hiển thị |
|---|---|
| Nhập | Nút Gửi luôn bật; kiểm khi submit, focus về ô lỗi đầu tiên |
| Lỗi trường | "Nhập nội dung góp ý." · "Nhập email hoặc username Telegram hợp lệ, hoặc để trống." |
| Đang gửi | Nút "Đang gửi…" (`disabled`), khoá các trường |
| Thành công | Khối check "Đã gửi, cảm ơn bạn" trong `aria-live` (`modal-feedback-result`); footer còn nút "Đóng" |
| 429 | `Alert` warning: "Bạn gửi nhiều lần liên tiếp. Đợi vài phút rồi thử lại." Giữ nguyên nội dung đã nhập |
| Lỗi mạng hoặc 5xx | `Alert` danger: "Chưa gửi được góp ý. Nội dung vẫn còn đây, hãy thử lại." |
| Không tải được Turnstile | `Alert` danger "Không mở được form" (đã có) kèm nút "Thử lại" |
| Honeypot bị điền | Phía client trông như thành công |

## 13. Trang `#/account` (đối chiếu với code hiện có)

`account-page.tsx` đã khớp bố cục của prototype. Còn 3 lệch cần sửa theo quy tắc trung thực:
1. Meter "Request proxy tháng này" chỉ hiện khi `features.apiClient`. Prototype đã ẩn mục này, code hiện vẫn luôn hiện.
2. Ghi chú meter mock "REST và MCP đều tính." đổi thành "Tính mọi request REST tới mock. Đặt lại ngày {dd/mm/yyyy}." khi `mockMcp` tắt.
3. Dòng tóm tắt gói: "tối đa {n} thành viên mỗi project."
Prototype còn meter "Resources (project lớn nhất)" mà code không có; giữ nguyên quyết định của phase 03.

## 14. SEO (`index.html` tĩnh, vì crawler và bot OG không chạy JS)

| Thẻ | Cờ tắt | Cờ bật (`apiClient`) |
|---|---|---|
| `<title>` (56/51 ký tự) | Localman · Mock REST API có trạng thái, quan hệ và Faker | Localman · Test API localhost ngay trên trình duyệt |
| `meta description` (154/147) | Dựng mock REST API có trạng thái trong vài phút: khai báo resource, sinh dữ liệu bằng Faker.js, lồng quan hệ và có ngay endpoint CRUD. Gói Free 3 project. | Gửi request tới localhost và mạng LAN ngay trên trình duyệt, không cần cài app hay extension, chỉ một lệnh Tunelo. Kèm mock REST API có trạng thái. |
| `og:title` / `og:description` | như title / description | như title / description |

Thêm `link rel="canonical" href="https://localman.hoandat.com/"`, `og:type=website`, `og:site_name=Localman`, `og:locale=vi_VN`, `og:url`, `twitter:card=summary_large_image`, `og:image` (1200×630, xem Concerns). Trang trong app đặt `document.title` riêng ("Projects · Localman"…) để tab không trùng tên. Thêm test kiểm description trong `index.html` chứa `${FREE_LIMITS.projects} project`, để số không lệch khỏi `plan-limits`. Khi bật `apiClient` thì đổi `index.html` trong cùng commit.

## 15. A11y và kiểm tra (cho T8)

- Một `h1`; mọi section có `aria-labelledby`; eyebrow là `<p>`.
- Thêm link "Bỏ qua tới nội dung" (`sr-only focus:not-sr-only`) ở cả hai header, trỏ `<main id="main">`.
- Icon trang trí đặt `aria-hidden`; badge và method chip là chữ, không chỉ dựa vào màu.
- Live region chỉ đặt ở badge đếm endpoint, hint của canvas, kết quả sao chép và tên trong Live Mock Sync; không bọc cả danh sách.
- Khung cuộn (bảng so sánh, cây, danh sách endpoint) có `tabIndex={0}` và tên truy cập.
- Vùng chạm ≥ 44px trên màn cảm ứng (`pointer-coarse`); animation tắt khi `prefers-reduced-motion`.
- Chạy `pnpm check:tokens` và axe trên `/` ở 375/768/1440 với cả hai theme; Lighthouse Performance và Accessibility ≥ 90 (landing không import Faker hay CodeMirror).
