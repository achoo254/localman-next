# Xia Report: Giải phẫu mockapi.io để thiết kế bản tương đương

**Ngày:** 2026-10-08 · **Mode:** `--copy` (intent "y hệt 100%"), phần Plan đang chờ quyết định vị trí và thương hiệu · **Trạng thái:** Phase 1–4 xong, Phase 5 (Plan) chờ user chốt

## 1. Source manifest

| Mục | Giá trị |
|---|---|
| Nguồn | https://mockapi.io (SaaS mã nguồn đóng, không có repo) |
| Bằng chứng | Quan sát UI trực tiếp (tài khoản user, chỉ xem, không tạo/sửa gì), bundle public `static/js/main.643af039.js` (1 MB), `styles.css`, `main.9a999eaa.css`, wiki `github.com/mockapi-io/docs/wiki` (4 trang) |
| Stack nguồn (suy ra từ bundle) | React (CRA build) + Redux + TanStack Query + framer-motion + d3 (vẽ cây resource bằng SVG) + Tailwind CSS + feather icons + Prism (highlight JSON) + Stripe |
| License | Không có license cho frontend. Chỉ học hành vi, IA và tương tác. Không sao chép mã bundle, logo, wordmark hay copy marketing nguyên văn |

## 2. Giải phẫu sản phẩm

### 2.1 Mô hình dữ liệu

```
User ──< Project { id, name, prefix, resourceTreeId(secret), owner, collaborators[] }
            └──< Resource (dạng cây) { id, name, count(0..100), children[], schema[], generator(object template), endpoints[] }
                     └── Records (mảng JSON, lưu trong DB)
Collaborator { id, email, mockId, user, status: pending|accepted }
```

- **Kiểu field trong schema:** `Faker.js` (khoảng 250 method, nhóm address/animal/color/commerce/company/database/datatype/date/finance/git/hacker/image/internet/lorem/music/name/phone/science/system/vehicle/word), `String`, `Number`, `Boolean`, `Object`, `Array`, `Date`, cộng thêm `Parent Resource` (khi có cha) và `Child Resource` (khi có con).
- **Field tự sinh, không xoá được:** `Object ID` (`id`) và `Parent ID` (ví dụ `userId`).
- **Validate:** tên field khớp `[\w-.]`, prefix khớp `[\w-/]`, tên project khớp `[\w -]`.

### 2.2 Public mock API (hợp đồng cho người dùng cuối)

Base URL: `https://{resourceTreeId}.mockapi.io{prefix}/{resource}`

| Method | Path | Ghi chú |
|---|---|---|
| GET | `/:res` | Danh sách |
| GET | `/:res/:id` | Một bản ghi |
| POST | `/:res` | Tạo |
| PUT / PATCH | `/:res/:id` | Cập nhật |
| DELETE | `/:res/:id` | Xoá, trả về bản ghi |
| (lồng) | `/:parent/:pid/:child[/:cid]` | Sinh tự động khi resource có cha, route phẳng `/:child` vẫn dùng được |

- **Query:** `search`/`filter` (khớp ở mọi field), `<field>=value`, `page`/`p`, `limit`/`l`, `sortBy`/`sortby`/`orderBy`/`orderby`, `order=asc|desc` (mặc định asc).
- **Custom response (bản trả phí):** mỗi endpoint có thể bật/tắt và có template JSON riêng. Biến hỗ trợ: `$mockData` (dữ liệu trong DB), `$count` (số bản ghi), `$category.method` (gọi Faker mỗi request).
- **Object template (bản trả phí):** template JSON thay cho schema dạng bảng, dùng cho cấu trúc lồng phức tạp.

### 2.3 API nội bộ của dashboard

`/auth/local`, `/auth/github`, `/auth/google`, `/auth/reset_password[/:token]`, `/api/users/me`, `/api/users`, `/api/mocks` (CRUD project), `/api/mocks/:id/collaborators`, `/api/collaborators` (mời/xoá), `/api/collaborators/:id/accept`, `/api/subscriptions/{info,checkout,manage}`. Xác thực bằng header `token`.

### 2.4 Màn hình và luồng

| Màn hình | Thành phần chính |
|---|---|
| **Landing** (`/`) | Hero "The easiest way to mock REST APIs" kèm CTA Get started. 3 thẻ giá (Free / $5 tháng / $35 năm). Khối "Simple data modeling" có demo bảng schema. Khối "Relations between resources" có cây resource tương tác và danh sách "Generated endpoints" cập nhật live. Danh sách "And more!": Pagination, Sorting, Filtering, Data generation, Customizable responses, Collaboration, cùng Custom endpoints và Webhooks gắn badge "Coming soon" |
| **Auth** | Đăng nhập, đăng ký, quên mật khẩu, đặt mật khẩu mới (tối thiểu 7 ký tự, có checklist yêu cầu chạy live), GitHub OAuth, Google OAuth |
| **Projects** (`/projects`) | Breadcrumb "Projects /" đi kèm nút `+` vuông màu xanh. Danh sách project có avatar chữ cái, màu theo chữ đầu (7 nhóm màu). Menu ⋮ gồm Collaborators, Magic link, Clone, Edit, Delete. Trạng thái rỗng "No projects yet..." |
| **Project detail** (`/projects/:id`) | Thẻ "API endpoint" hiện URL tô màu từng phần: secret (chip xanh dương), prefix (chip tím), `:endpoint` (chip cam), mỗi chip có tooltip. Footer thẻ gồm New resource, Generate all, Reset all. Bên dưới là **canvas SVG dạng cây resource** |
| **Resource tree canvas** | Thanh dọc "Add to root" bên trái. Mỗi node gồm tên resource (link mở thẳng endpoint) và **thanh generator** xám rộng 106px: rê chuột hiện số 0–100, click để sinh đúng số bản ghi đó, phần đã có dữ liệu tô gradient. Resource con chỉ sinh được khi cha đã có dữ liệu. Muốn lồng resource thì chọn node rồi click connector của node khác (snap/unsnap), có chặn chu trình và trùng tên. Hover node hiện các action Edit, Data, Delete |
| **Modal New/Edit resource** (size xl) | Resource name. Schema dạng lưới 10 cột (tên 3, kiểu 3, method Faker hoặc child 3, nút xoá 1 hiện khi hover). Object template (cần trả phí). Endpoints: bật/tắt cùng template response, có ghi chú `$mockData` và `$count` (cần trả phí) |
| **Modal Resource data** | Textarea JSON để sửa hoặc thay toàn bộ mảng, validate khi blur, nút Update chỉ bật khi có thay đổi |
| **Modal Collaborators** | Mời qua email, danh sách gồm owner (badge) và collaborator kèm trạng thái, có nút xoá. Luồng accept đi qua link `/collaborators/:id/accept` |
| **Modal Manage subscription** | Cảnh báo cam "reached limit", 2 thẻ chọn radio (tháng/năm), Close và Continue chuyển sang Stripe checkout |

### 2.5 Hạn mức gói

| | Free | $5/tháng | $35/năm |
|---|---|---|---|
| Projects | 1 | 20 | 20 |
| Resources | 2 | 50 | 50 |
| Custom response + Object template | ✗ | ✓ | ✓ |
| Collaboration | ✗ | ✓ | ✓ |
| Số bản ghi mỗi resource | 0–100 (giới hạn của thanh generator) | như Free | như Free |

### 2.6 Design language

- **Nền:** `#f9fafb`, lưới kẻ 1px `#e5e7eb` với ô 100×100px phủ toàn trang. Đây là chi tiết nhận diện mạnh nhất.
- **Font:** JetBrains Mono (400–700) dùng cho gần như toàn bộ UI. Logo là wordmark viết tay dạng script.
- **Màu:** primary `blue-500`, link `blue-700`. Chip màu: blue-100, violet-100, orange-100. Badge có các biến thể success, danger (rose), warning (orange).
- **Nút:** `rounded-xl`, shadow có màu (`shadow-blue-500/50`), `hover:scale-105 active:scale-95`, focus outline 2px blue-500 offset 2. Nút icon kích thước 36×36.
- **Thẻ và modal:** thẻ project `rounded-3xl bg-white shadow`, modal `rounded-2xl` với các size sm/md/lg(xl)/xl(3xl). Animation fade cùng trượt từ -20px, khoảng 0.3s. Footer modal dính đáy, nền `bg-gray-50`, lưới 2 cột (Cancel minimal, Primary).
- **Badge:** chữ `text-xs font-mono font-semibold uppercase tracking-wider rounded-lg border`.

## 3. Dependency matrix (đánh giá trên hai ứng viên đích)

| Thành phần nguồn | Repo mới (Vue 3 + Express 5 + Mongoose) | Module trong `localman` (React 19 + Tailwind 4 + Fastify/Hono + PostgreSQL + Better Auth) |
|---|---|---|
| UI React + Tailwind | NEW, phải viết lại bằng Vue | EXISTS, cùng họ stack nên port gần 1:1 |
| Cây resource SVG (d3) | NEW | NEW |
| Faker | EXISTS (`@faker-js/faker` có ở workspace-backend, domain-auction-client) | NEW |
| Auth email + OAuth | NEW | EXISTS (Better Auth, Firebase Google) |
| Collaboration / RBAC | NEW | EXISTS (workspace, RBAC, invite) |
| Mock runtime theo subdomain wildcard | NEW (DNS `*.domain`, TLS wildcard, router theo Host) | NEW |
| Billing | NEW | CONFLICT: requirement cũ đề xuất Stripe/Pro $8 nhưng chưa làm |
| Lưu bản ghi | Mongo hợp tự nhiên (document JSON) | PostgreSQL JSONB |

## 4. Challenge

| Quyết định | Cách của nguồn | Cách của mình | Khuyến nghị |
|---|---|---|---|
| Mức "y hệt" | Brand riêng (wordmark script, JetBrains Mono, nền lưới) | Có thể copy pixel-perfect hoặc dùng design system riêng | **Clone 100% IA, luồng, tương tác, hạn mức và hợp đồng API. Không dùng tên, logo, wordmark và copy marketing nguyên văn của mockapi.io.** Phần layout và tương tác không phải tài sản độc quyền, còn tên và logo thì có rủi ro trade dress |
| Vị trí | SaaS độc lập | Repo mới hoặc tính năng Mock Server trong localman | Xem câu hỏi mở 1 |
| Runtime mock | Subdomain theo secret | Subdomain wildcard hoặc path `/m/:secret/...` | Subdomain cho giống 100%, có path fallback cho môi trường dev |
| Faker chạy khi nào | Lúc generate thì ghi DB, còn template response chạy mỗi request | Giữ nguyên | Giữ nguyên, có sandbox (whitelist method, không eval) |
| Giới hạn 100 bản ghi | Thanh generator 0–100 | Giữ nguyên | Giữ để chặn lạm dụng storage |
| Tính năng "Coming soon" (Custom endpoints, Webhooks) | Chưa có | Không bắt buộc | Không làm ở v1, chỉ để badge nếu muốn giống landing |

**Rủi ro chính:**
1. Mock runtime là endpoint public, ai có secret đều ghi được, nên bị lạm dụng làm kho dữ liệu hoặc spam. Cần rate-limit theo project và giới hạn kích thước body.
2. Template engine (`$faker.method`) nếu làm bằng `eval` sẽ thành lỗ RCE. Bắt buộc dùng whitelist map tới method.
3. Wildcard DNS và TLS cần hạ tầng (ví dụ Cloudflare).
4. Canvas cây SVG với các thao tác snap/connector là phần UI khó nhất.

**Risk score:** Trung bình (6/10). Phần lõi CRUD thì đơn giản, rủi ro tập trung ở runtime public, template engine và canvas cây.

**Tier ước lượng:** L (khoảng 15–25 file, gồm frontend, backend dashboard và mock runtime, có schema mới). Chưa tính billing.

## 5. Câu hỏi mở (chặn Phase 5)

1. Đặt sản phẩm ở đâu: repo mới hay tính năng Mock Server trong `localman`?
2. Thương hiệu: dùng design system riêng hay giữ ngôn ngữ thị giác của mockapi (nền lưới, mono) dưới tên mới?
3. Phạm vi v1: có gồm billing/gói trả phí và collaboration không, hay mở hết miễn phí cho nội bộ?
