---
title: "Localman web — mô phỏng 100% mockapi.io và 100% quản lý Collections/Environments (kèm share) của Postman"
description: "Xây SaaS mock REST API độc lập, giống mockapi.io về IA, luồng, tương tác, hạn mức gói và hợp đồng API, với design system riêng. Sản phẩm tại localman.hoandat.com."
status: pending
priority: P2
effort: "XL (23 phase: 13×M, 9×L, 1×XL)"
branch: ""
tags: [feature, frontend, backend, api, auth, database]
blockedBy: ["plans/dattqh/261008-1325-central-auth-idp", "plans/dattqh/261008-1156-tunelo-accounts-and-tunnel-list"]
blocks: []
created: 2026-10-08
---

# Localman web — Implementation Plan

> **Hai mục tiêu bắt buộc (user chốt 2026-10-08):**
> 1. Mô phỏng **100% mockapi.io** (phase 01–09).
> 2. Mô phỏng **100% tính năng quản lý Collections và Environments của Postman, kể cả share** (phase 10–15).
>
> Mỗi phase 11–15 có một "ma trận tương đương". Từng dòng trong ma trận là một tiêu chí nghiệm thu.
>
> **Định vị cạnh tranh** (user yêu cầu 2026-10-08; Jev quyết; chi tiết ở `../reports/competitive-261008-1308-localman-vs-mockapi-postman.md`):
> - Keyword chính: **"Localhost ngay trên trình duyệt"**, test API localhost từ web, Tunelo được tự nhận theo port. Postman web phải cài Desktop Agent; mockapi.io không làm được.
> - Keyword phụ: **"Live Mock Sync"** (phase 16), mock có trạng thái tự giữ đồng bộ với collection và environment.
> - Keyword thứ năm: **"Secret không rời trình duyệt"** (phase 10 bước 3 và phase 21; Jev 0.72). Request mặc định gửi thẳng từ trình duyệt; phải qua proxy thì hỏi trước.
> - Keyword thứ tư: **"Mock lai localhost"** (phase 20). Route đã có thì trả mock, route chưa có thì đi vào tunnel Tunelo về máy dev.
> - **Sửa claim** (nghiên cứu ngày 2026-10-08): mock của Postman có code mock giữ trạng thái (`pm.state`, beta, soạn trên desktop, chạy cloud từ gói Solo). Live Mock Sync khác ở chỗ **không cần code, chạy trên web, có ở gói Free, có quan hệ dữ liệu**. Hoppscotch web gọi localhost được qua extension hoặc Agent, nên keyword localhost phải ghi đúng là "**không cần cài app hay extension, chỉ một lệnh Tunelo**".
> - Keyword thứ ba: **"Mock MCP tức thì"** (phase 17): mỗi mock là một MCP endpoint có trạng thái cho AI agent, kèm Localman MCP để coding agent tự dựng mock (phase 17) và làm việc với collection (phase 18).
> - Gói Free hào phóng hơn: 3 project và 10 resource (mockapi.io: 1 và 2); custom response miễn phí; workspace team tối đa 3 người (Postman Free: 1 user); trash 30 ngày (Postman Free: 1 ngày).

## Outcome

Một SaaS cá nhân, độc lập, tên **Localman** (do Jev chọn), chạy ở `localman.hoandat.com`. Người dùng tạo project, khai báo resource dạng cây cha–con, sinh dữ liệu Faker từ 0 đến 100 bản ghi, rồi gọi ngay REST API công khai tại `https://{secret}.localman.hoandat.com{prefix}/{resource}`. Sản phẩm phải ngang tính năng với mockapi.io, trừ cổng thanh toán.

## Nguồn và quyết định đã chốt

- **Giải phẫu nguồn**, gồm source manifest, data model, API, màn hình, dependency matrix, challenge và risk: [`../reports/xia-261008-1123-mockapi-io-anatomy.md`](../reports/xia-261008-1123-mockapi-io-anatomy.md)
- **Prototype để duyệt độ giống:** [`prototype/index.html`](prototype/index.html) cho các màn mock (phase 01–09) và [`prototype/api-client.html`](prototype/api-client.html) cho các màn Postman (phase 10–15). Hai file dùng chung token và liên kết với nhau qua nav.
- **Quyết định đã chốt với user (2026-10-08):**
  - **Repo mới `achoo254/localman-next`** (private) là monorepo để code. Repo cũ `achoo254/localman` giữ nguyên để đọc khi port, archive sau phase 10 (Jev 0.90, thay cho phương án xoá code repo cũ). Frontend React + Tailwind (Vite, TypeScript), backend Express 5 + Mongoose (TypeScript).
  - Domain: dashboard ở `localman.hoandat.com`, mock runtime ở wildcard `{secret}.localman.hoandat.com`.
  - **Design system riêng của Localman** (Jev 2026-10-08): Radix Colors (violet làm màu chủ đạo, slate làm màu xám; giấy phép MIT), font Inter và JetBrains Mono. Giữ nền lưới 100px làm chữ ký thị giác.
  - Ngang tính năng với nguồn: hạn mức Free (1 project, 2 resource) và trả phí (20 project, 50 resource), custom response, object template, collaboration, magic link, clone, generator 0–100, route lồng, các query search/filter/page/limit/sortBy/order.
  - Cổng thanh toán làm ở **plan riêng sau**. Trong plan này gói của user được admin gán qua CLI script.
  - Auth gồm email/password, Google và GitHub. Magic link là link mời tham gia project. Sinh dữ liệu cho resource con theo tổng N bản ghi, chia ngẫu nhiên cho các bản ghi cha.
  - Sau khi phần mock xong sẽ làm API client kiểu Postman chạy trên web; mọi request đi qua proxy phía server và chuyển tiếp IP client (phase 10).
- **Không làm:** dùng tên, logo hay copy marketing của mockapi.io; sao chép mã bundle của họ; Custom endpoints và Webhooks (nguồn cũng mới để "Coming soon"); billing/checkout.

## Kiến trúc

```
localman-next/                 (pnpm workspace, repo achoo254/localman-next)
├─ apps/tunelo-server   server Tunelo (gộp từ repo tunelo, giữ lịch sử; deploy PM2 như cũ)
├─ packages/tunelo-cli  npm `tunelo` (tag phát hành `tunelo-v*`)
├─ packages/tunelo-shared
├─ apps/web        React 19 + Vite + Tailwind 4 + TanStack Query + React Router
├─ apps/api        Express 5 + Mongoose, hai entrypoint dùng chung src/:
│    ├─ src/dashboard-server.ts   /auth/*, /api/*  (localman.hoandat.com)
│    └─ src/mock-server.ts        mock runtime công khai  ({secret}.localman.hoandat.com | /m/:secret)
└─ packages/shared  (@localman/shared) type, zod schema, whitelist method Faker, quy tắc giới hạn gói

Đăng nhập: IdP riêng `auth.hoandat.com` (repo `hoandat-auth`), dùng chung cho Localman, Localman MCP và Tunelo.
```

Dashboard và mock runtime là hai process riêng. Lý do: runtime công khai có thể bị lạm dụng, nên tách ra để rate-limit, scale và cô lập lỗi độc lập với dashboard.

## Các phase

| # | Phase | Tier | Phụ thuộc | Trạng thái |
|---|---|---|---|---|
| 01 | [Scaffold monorepo và nền tảng brand](phase-01-scaffold-and-brand-foundation.md) | M | — | pending |
| 02 | [Auth: email/password, Google, GitHub, reset password](phase-02-auth.md) | M | 01 | pending |
| 03 | [Projects và giới hạn gói](phase-03-projects-and-plan-limits.md) | M | 02 | pending |
| 04 | [Resources, schema, sinh dữ liệu](phase-04-resources-schema-and-data-generation.md) | L | 03 | pending |
| 05 | [Mock runtime công khai](phase-05-mock-runtime.md) | L | 04 | pending |
| 06 | [UI Project detail: canvas cây resource và các modal](phase-06-project-detail-ui.md) | L | 04 (05 để test end-to-end) | pending |
| 07 | [Collaboration và magic link](phase-07-collaboration-and-magic-link.md) | M | 03 | pending |
| 08 | [Landing, pricing, account](phase-08-landing-pricing-account.md) | M | 03, 06 | pending |
| 09 | [Hardening, E2E, deploy](phase-09-hardening-e2e-deploy.md) | M | 05–08 | pending |
| 10 | [API Client: lõi gửi request và proxy (port từ localman)](phase-10-api-client.md) | L | 09 | pending |
| 11 | [Workspace, vai trò và chia sẻ phần tử](phase-11-workspaces-and-sharing.md) | L | 10 | pending |
| 12 | [Collections tương đương 100% Postman](phase-12-collections.md) | L | 11 | pending |
| 13 | [Environments và biến tương đương 100% Postman](phase-13-environments-and-variables.md) | L | 11, 12 | pending |
| 14 | [Fork, merge, pull request, comment, watch](phase-14-fork-merge-comments-watch.md) | XL | 12, 13 | pending |
| 15 | [Chia sẻ công khai: public workspace, guest, nút Run, access key](phase-15-public-sharing.md) | M | 11, 12, 13, 14 | pending |
| 16 | [Live Mock Sync: mock luôn đồng bộ với collection và environment](phase-16-live-mock-sync.md) | M | 12, 13, 14 | pending |
| 17 | [Nền tảng MCP (toolsets, dry-run, coverage) cùng Mock MCP tức thì](phase-17-mock-mcp.md) — **chạy ngay sau 09, trước 10** | M | 5, 9 | pending |
| 18 | [Localman MCP: đủ toolset cho API client, chia sẻ, cộng tác, đồng bộ, traffic](phase-18-localman-mcp-client-tools.md) | M | 16, 17, 19, 20, 21 | pending |

| 19 | [Mock power-ups: Faker thông minh, tạo resource từ JSON/OpenAPI/CSV, xuất type, chaos, response theo điều kiện](phase-19-mock-power-ups.md) | M | 4, 5, 6 | pending |
| 20 | [Mock lai localhost, log request có replay, webhook inbox về localhost, mock callback](phase-20-mock-traffic-and-hybrid-localhost.md) | L | 5, 10 | pending |
| 21 | [Client power-ups: secret local không rời trình duyệt, nối request không cần script, docs tự sinh](phase-21-client-power-ups.md) | M | 10, 13, 16 | pending |
| 22 | [Browser extension: gửi request vượt CORS, cùng bộ công cụ cookie, storage, network, performance cho tab đang mở](phase-22-browser-extension.md) | L | 10 | pending |
| 23 | [Extension: tiện ích mở rộng (cache/SW, console, tạm tắt CORS, giả lập thiết bị, sửa header, xem JSON, thay response bằng mock)](phase-23-extension-utilities.md) | M | 22 | pending |

**Thứ tự thực thi:** 01 → 09 → **17 → 19** → 10 → **20** → 11 → 16 → **21 → 18**. Phase 22 và 23 (extension, tuỳ chọn) làm sau cùng. Sau đó là plan DevOps `../261008-1337-devops-toolkit/` (7 phase). Số phase giữ nguyên để không phá các tham chiếu chéo. Plan IdP và plan Tunelo phải xong trước phase 02 và phase 10.

Phase 10–15 chỉ bắt đầu khi phần mock API (01–09) đã lên staging, theo thứ tự user yêu cầu. Ngoại lệ duy nhất: phase 11 viết `access-policy` dùng chung, nên phase 03 và 07 thiết kế module phân quyền ở dạng dễ chuyển sang policy đó (giao diện mock không đổi).

**Ngoài phạm vi phần Postman** (theo Jev): Postman Vault (0.37). Collection Runner (0.44 lúc xét phạm vi Postman) **đã chuyển sang plan DevOps** `../261008-1337-devops-toolkit/` (Jev 0.70), kèm scope `data` và chạy theo file CSV/JSON ở gói Free. Cả hai đều sát ngưỡng, ghi thành follow-up. Các sản phẩm khác của Postman (Monitors, Flows, API Network, Spec Hub) không thuộc "quản lý Collections/Environments".

## Acceptance criteria (toàn plan)

1. Người dùng mới đăng ký, tạo project, tạo resource `users` cùng child `posts`, sinh 50 users và 100 posts, rồi `GET /users/1/posts?page=1&limit=10&sortBy=createdAt&order=desc` trả đúng dữ liệu.
2. Đủ 6 method (GET list, GET one, POST, PUT, PATCH, DELETE) trên cả route phẳng lẫn route lồng. Endpoint bị tắt trả 404.
3. Template response render đúng `$mockData`, `$count` và `$faker.method`. Không có đường nào thực thi code tuỳ ý: Faker được gọi qua whitelist, không dùng `eval` hay `Function`.
4. Hạn mức theo `packages/shared/src/plan-limits.ts`, nguồn duy nhất. Free bị chặn ở project thứ 4, resource thứ 11 và thành viên thứ 4 (API trả 403 `PLAN_LIMIT_REACHED`, UI mở modal "Quản lý gói"). Vượt hạn mức tháng của mock hoặc proxy thì trả 429 `MONTHLY_QUOTA_EXCEEDED`. Custom response và object template mở cho mọi gói. Fork, PR và public sharing chỉ có ở Pro.
5. Mỗi màn hình trong §2.4 của báo cáo giải phẫu có bản tương đương, và đã được user duyệt qua prototype trước khi code UI.
6. Mọi dòng trong ma trận tương đương của phase 11–15 đều có test hoặc kịch bản E2E pass. Import một collection và environment Postman thật, dùng, rồi export lại thì JSON tương đương với bản gốc.
7. Phân quyền theo đúng bảng Viewer/Editor/Admin của Postman (test dạng bảng). Chia sẻ có Viewer/Editor, copy link, request access, include environment, giá trị local và shared, fork/merge/PR, comment, watch, public link, guest, nút Run, access key.
8. Hai keyword đều chạy được end-to-end: (a) gửi `http://localhost:<port>` có tunnel thì tự đi qua Tunelo; (b) đổi schema mock thì collection đồng bộ tự cập nhật. Landing chỉ quảng bá keyword khi cờ tính năng tương ứng đã bật.
9. **Mọi tính năng của mock API, API client và DevOps đều có MCP tool**, sinh từ operation registry. `pnpm check:mcp-coverage` pass; chỉ được miễn khi có ghi lý do (extension, consent UI, thao tác UI thuần).
10. Lint, typecheck, unit test và E2E Playwright cho luồng chính đều pass. `pnpm check:tokens` sạch.

## Rủi ro chính và rollback

| Rủi ro | Giảm thiểu |
|---|---|
| Runtime public bị lạm dụng (spam, làm kho dữ liệu) | Rate-limit theo secret và IP, body tối đa 100 KB, trần số bản ghi mỗi resource, xoá project bỏ hoang |
| Template engine thành lỗ RCE | Whitelist map `category.method` sang hàm Faker, parse JSON thuần, test fuzz |
| NoSQL injection qua query filter | Chỉ khớp field có trong schema, ép giá trị về string hoặc number, cấm toán tử `$` |
| Cần DNS và TLS wildcard | Fallback `/m/:secret` cho dev và khi chưa có wildcard |
| Canvas cây phức tạp | Duyệt prototype trước, tách thuật toán layout thành hàm thuần có unit test |
| Merge 3 chiều của fork/PR sai, làm mất dữ liệu | Merge theo ID ổn định của item, có bộ test ca xung đột, mọi merge sinh revision nên restore được |
| Lộ secret hay giá trị local khi share hoặc publish | Resolver tách rõ local/shared; export và public chỉ có shared; secret mã hoá AES-256-GCM; có cảnh báo trước khi publish |
| Khối lượng phần Postman rất lớn (XL) | Mỗi phase là một mốc nghiệm thu riêng theo ma trận; có thể dừng giữa chừng mà phần đã xong vẫn dùng được |

**Rollback:** rollback theo từng phase bằng `git revert` commit của phase đó. Bản cũ vẫn nằm nguyên trong repo `achoo254/localman`. Dữ liệu Mongo ở staging có thể drop vì chưa có user thật.

## Validation Log

### Vòng 1: user trả lời (2026-10-08)
- Domain mock: `localman.hoandat.com` với wildcard subdomain. Đây là sản phẩm cá nhân, không liên quan công ty.
- Auth: email/password, Google và GitHub.
- Magic link: link mời tham gia project.
- Sinh resource con: tổng N bản ghi, chia ngẫu nhiên cho các bản ghi cha.

### Vòng 2: Jev quyết thay user (2026-10-08, model `jev-1.13.0`)
User yêu cầu mọi câu cần hỏi người đều chuyển cho Jev quyết. Request và response gốc nằm trong scratchpad của session, không commit.

| Câu hỏi | Jev chọn | Xác suất | Độ tin cậy | Ghi chú |
|---|---|---|---|---|
| Tên sản phẩm | Localman | 0.59 (Localman Mock 0.37) | 0.38 thấp | Dễ đổi: chỉ ảnh hưởng wordmark và copy |
| Tên repo | `localman-web` | 0.77 | 0.66 | **Đã thay**: user chốt dùng luôn repo `localman`, bỏ code cũ |
| Host dashboard | Root `localman.hoandat.com` | 0.97 | 0.94 | Giống bố cục của mockapi.io |
| Ý nghĩa `$count` | Tổng sau filter, trước phân trang | 0.85 | 0.77 | |
| POST thiếu field | Sinh Faker cho field thiếu | 0.58 (lưu nguyên 0.42) | 0.16 rất thấp | Gần như ngang nhau. Có thể đảo khi test thực tế |
| Request tới localhost/LAN trong API client | Tạm chặn, thêm phase local agent sau | 0.68 | 0.52 | **Đã thay** bằng Tunelo ở vòng 4 |
| Hạ tầng | VPS riêng + Docker Compose + Cloudflare | 1.00 | 1.00 | |

### Vòng 3: phạm vi Postman, Jev quyết (2026-10-08)
User yêu cầu đạt 100% quản lý Collections và Environments của Postman, kể cả share. Tài liệu tham chiếu là learning.postman.com (dẫn link trong từng phase).

| Câu hỏi | Jev | Áp dụng |
|---|---|---|
| Workspace cùng vai trò workspace | 0.79 có | Phase 11 |
| Share phần tử theo người kèm vai trò, copy link, request access, include environment | 0.93 có | Phase 11 |
| Giá trị local và shared | 0.86 có | Phase 13 |
| Fork, merge, pull request | 0.68 có | Phase 14 |
| Comment, watch | 0.66 có | Phase 14 |
| Changelog, trash | 0.89 có | Phase 12 |
| Public link, guest, nút Run, access key | 0.73 có | Phase 15 |
| Tag, favorite, sort, chọn nhiều | 0.94 có | Phase 12 |
| Vault | 0.37 không | Follow-up; chỉ làm biến secret có mã hoá |
| Collection Runner | 0.44 không | Follow-up |
| Thứ tự | "Làm sớm nền phân quyền" 0.85 | **Không ghi đè** yêu cầu "làm sau mockapi" của user: chỉ thiết kế phân quyền phase 03/07 sẵn để chuyển sang policy chung |
| Gói cho phần Postman | Lõi Free, cộng tác Pro (0.99) | Phase 11 |
| Thời gian giữ trash | 30 ngày (0.76) | Phase 12 |

### Vòng 4: gọi localhost qua Tunelo (2026-10-08)
User yêu cầu: khi URL là localhost hoặc IP local thì hiện hướng dẫn cài Tunelo CLI, và phải kiểm cơ chế của Postman web trước khi gửi Jev.

Kết quả kiểm tra: Postman web dùng Desktop Agent cài trên máy (Cloud Agent không gọi được tài nguyên local) và không dùng tunnel. Server Tunelo không có API liệt kê tunnel của user.

| Câu hỏi | Jev chọn | Xác suất |
|---|---|---|
| Cơ chế | Panel hướng dẫn kèm lệnh điền sẵn port, dán URL tunnel, "Thay host", nhớ cặp ánh xạ | 0.85 |
| Nơi lưu ánh xạ | Riêng từng user, không đi theo share | 0.96 |
| Luôn cảnh báo dịch vụ local bị lộ ra internet | Có | 0.86 |

Quyết định này thay thế quyết định trước đó là "tạm chặn, làm local agent sau".

### Vòng 5: API liệt kê tunnel trong Tunelo (2026-10-08)
User yêu cầu thêm luôn vào Tunelo API liệt kê tunnel, để Localman tự nhận tunnel. Đã đọc code Tunelo: không có tài khoản, mỗi máy một token, tunnel nằm trong bộ nhớ của 1 instance, CLI đã gửi `localPort`.

| Câu hỏi | Jev chọn | Xác suất |
|---|---|---|
| Cách liên kết | Mã một lần cộng `tunelo link <code>`, cấp token chỉ đọc theo máy | 0.91 |
| Nơi đặt plan | Plan riêng trong repo Tunelo, chặn phase 10 | 1.00 |
| Liệt kê cả tunnel TCP | Có (sát ngưỡng) | 0.53 |
| Cập nhật danh sách | Localman gọi khi cần, không đẩy realtime | 0.95 |

Plan Tunelo: `plans/dattqh/261008-1156-tunelo-accounts-and-tunnel-list/plan.md`. Phase 10 giờ tự nhận tunnel làm cơ chế chính, còn dán URL thành dự phòng.

### Vòng 6: định vị cạnh tranh (2026-10-08)
User yêu cầu coi mockapi.io và Postman là đối thủ, bổ sung tài nguyên cho gói Free, và phải có keyword mà hai app kia không có. Số liệu lấy từ postman.com/pricing (đọc ngày 2026-10-08) và bundle của mockapi.io. Báo cáo và toàn bộ bảng xác suất: `../reports/competitive-261008-1308-localman-vs-mockapi-postman.md`.

Tóm tắt quyết định của Jev:
- Keyword chính: localhost trên trình duyệt (0.85). Keyword phụ: Live Mock Sync (0.90), thêm thành phase 16.
- Free: 3 project, 10 resource, custom response và template miễn phí (0.89); 3 thành viên (0.70); 10.000 request tới mock mỗi tháng (0.47, sát ngưỡng); 5.000 request qua proxy mỗi tháng (0.68); trash 30 ngày (0.80).
- Pro: 20 project, 50 resource; 10 thành viên (0.66); không giới hạn tháng cho mock (0.57) và proxy (0.51, gần hoà); trash 30 ngày (0.81).

### Vòng 7: MCP (2026-10-08)
User hỏi về việc thêm MCP server. Đã kiểm tra: Postman đã có MCP Server (quản lý workspace, collection, mock tĩnh; hơn 100 tool), gửi request tới MCP server, và MCP Generator (sinh từ API công khai và Flows). Không thấy Postman mở mock thành MCP endpoint. mockapi.io không có MCP.

| Câu hỏi | Jev | Áp dụng |
|---|---|---|
| A. Hosted Mock MCP (mỗi mock là một MCP endpoint có trạng thái) | 0.62 có | Phase 17 |
| B. Localman MCP cho coding agent | 0.68 có | Phase 17 (mock) và 18 (client) |
| C. Test MCP server trong API client | 0.48 không | Follow-up, chỉ là đuổi kịp Postman |
| Keyword MCP | "Mock MCP tức thì" 0.67 | Landing (sau cờ `features.mockMcp`) |
| Thời điểm | Tách theo tính năng 0.86 | 17 ngay sau 09; 18 sau 16 |

### Vòng 8: không có mail server (2026-10-08)
User không có mail server: mọi việc gửi hoặc nhận mail chuyển sang kênh thông báo miễn phí.
- Kênh (0.97): thông báo trong app, Web Push và Telegram.
- Quên mật khẩu (0.95): mã khôi phục, Telegram, hoặc đăng nhập Google/GitHub đã liên kết.
- Lời mời (0.97): link mời cộng danh tính đã xác minh.
- Liên hệ (0.81): form góp ý gửi về Telegram của owner.
- Email (0.83): vẫn là tên đăng nhập nhưng đánh dấu chưa xác minh.

Đã sửa phase 02, 07, 08, 09, 11, 14.

### Vòng 9: xác thực tập trung (2026-10-08)
User muốn chỉ login một nơi cho cả Tunelo và Localman.
- Jev chọn: OIDC IdP riêng tại `auth.hoandat.com` (1.00); token ẩn danh của Tunelo chạy thêm 60 ngày rồi chặn (0.99); liệt kê tunnel theo tài khoản, giữ link-code cho máy ẩn danh (0.56).
- Jev cho rằng IdP dùng dịch vụ gửi mail bên thứ ba cũng được (0.71). **Không áp dụng**, vì trái quy tắc user vừa đặt; ghi thành câu hỏi mở.
- Plan mới: `../261008-1325-central-auth-idp/`. Phase 02 thu gọn thành OIDC client cộng module thông báo; phase 17 dùng IdP làm authorization server.

### Vòng 10: thay repo cũ và gộp Tunelo (2026-10-08)
- User: bỏ hết repo `localman` cũ, thay bằng plan này. Code cũ giữ ở tag `legacy-final` để port (phase 01, bước 0).
- User: gộp repo Tunelo vào repo `localman`. Jev chọn:
  - Giữ toàn bộ lịch sử bằng `filter-repo` (0.90).
  - IdP vẫn là repo riêng (0.86).
  - Archive repo Tunelo cũ, kèm README trỏ sang monorepo (0.94).
  - Tag có tiền tố `tunelo-v*` (0.70).
  - Giữ deploy PM2 cho server Tunelo (0.98).
- Đã làm: phase 01 thêm bước 0b; Biome dùng chung cho monorepo; plan Tunelo chuyển về `../261008-1156-tunelo-accounts-and-tunnel-list/` và viết lại theo IdP cùng path monorepo.

### Vòng 11: add-on mà mockapi.io và Postman đều không có (2026-10-08)
Dùng skill `ak:competitor` cùng 3 researcher song song. Báo cáo: `../reports/competitors/research-261008-1316-{api-clients,mock-tunnel-tools,user-needs}.md`.

Jev chọn 13 trên 23 ứng viên (lấy các mục > 0.5):
- **Phase 19:** import_to_resource 0.78, chaos 0.78, export_types 0.77, smart_faker 0.72, conditional_rules 0.67.
- **Phase 20:** request_log_replay 0.68, hybrid_mock_to_localhost 0.68, webhook_inbox 0.56, mock_callbacks 0.55.
- **Phase 21:** secrets_client_side 0.62, auto_docs 0.54, chaining 0.53.
- **Loại:** embed 0.50, contract validation 0.44, snapshot 0.41, performance budget 0.33, record real API 0.26, Postman script shim 0.24, tunnel inspector 0.23, git sync 0.22, guest mode 0.21, GraphQL 0.18.
- **Keyword mới:** "Mock lai localhost" 0.46, sát "Secret không rời trình duyệt" 0.42.
- **Chờ user:** gửi thẳng từ trình duyệt không qua proxy (Jev 0.64). Mục này ngược yêu cầu "mọi request qua proxy" của user nên chưa áp.

### Vòng 12: domain chỉ dùng `hoandat.com` (2026-10-08)
- User: plan không nhắc domain tunnel cũ nữa; Tunelo chuyển sang `tunnel.hoandat.com`, quản lý trên Cloudflare; domain cũ gỡ sau khi domain mới chạy ổn.
- Các record wildcard hai cấp (`*.tunnel`, `*.localman`) để DNS only; chứng chỉ wildcard cấp bằng `certbot --dns-cloudflare` (Universal SSL miễn phí của Cloudflare không phủ wildcard hai cấp).
- `TUNNEL_DOMAINS` cho phép chạy song song cả hai domain trong lúc chuyển (plan Tunelo, phase 01 và 03).

### Vòng 13: gửi thẳng từ trình duyệt (2026-10-08)
User cho phép và muốn ưu tiên gửi thẳng; lo ngại duy nhất là kiến trúc có làm được không. Kết luận: làm được, với giới hạn của CORS và các header bị trình duyệt cấm.

Jev chọn:
- Mặc định Auto: gửi thẳng trước, bị chặn thì qua proxy (0.99).
- Gặp TypeError thì tự chuyển proxy, có badge và nhớ theo host (0.98).
- Request có secret thì hỏi trước khi chuyển sang proxy (0.85).
- Localhost: thử gửi thẳng trước, không được thì dùng Tunelo (0.73).
- Keyword "Secret không rời trình duyệt" (0.72).
- Browser extension tuỳ chọn (0.55): phase 22.

Đã sửa phase 10 (bước 3 định tuyến, bước 4 localhost), 21, 08.

### Vòng 14: extension thành bộ công cụ cho tab đang mở (2026-10-08)
User bổ sung: extension dùng để tuỳ chỉnh và quản lý cookie, storage, network, performance… của tab đang mở, như một tiện ích cho người cài. Jev chọn:
- Bắt network: panel DevTools là chính, `chrome.debugger` là tuỳ chọn (0.97).
- Giao diện: side panel cùng panel DevTools (0.82).
- Dữ liệu: mặc định ở lại trình duyệt, chỉ gửi khi user bấm (1.00).
- Tiện ích thêm: Cache/SW 0.66, console 0.62, tạm tắt CORS 0.61, giả lập thiết bị/UA/mạng 0.60, sửa header 0.59, xem JSON 0.59, thay response bằng mock 0.58. Loại: chụp màn hình 0.41.

Phase 22 mở rộng lên tier L; thêm phase 23.

### Vòng 15: gói Pro chuyển thành "Liên hệ" (2026-10-08)
User muốn gói Pro hiện "Liên hệ" kèm form điền email gửi thông tin cho quản trị, thay vì ghi "chưa chốt", để biết có bao nhiêu người quan tâm.
- Form quan tâm Pro dùng lại module `feedback` (phase 03 và 08). Form chỉ thu email, không gửi email.
- Mỗi lần có người gửi, bot Telegram báo về owner.
- Trang `/admin/pro-interest` đếm số người theo nguồn và theo nhu cầu.
- Có ô đồng ý lưu email để liên hệ (theo luật bảo vệ dữ liệu cá nhân).

### Vòng 16: mọi tính năng đều có MCP tool (2026-10-08)
User yêu cầu: toàn bộ tính năng DevOps, API client và mock API đều có MCP tool.
- Kiến trúc (AI tự quyết, theo nguyên tắc DRY): operation registry ở phase 01 sinh cùng lúc REST, MCP và OpenAPI, cộng CI kiểm coverage.
- Jev chọn:
  - Toolsets với mặc định nhỏ (1.00).
  - Tool phá huỷ phải dry-run và có confirm token (0.87).
  - Tạo credential cần scope riêng `credentials:write` (0.74).
  - Tunelo có MCP local `tunelo mcp` (0.89).
  - Tiện ích extension được miễn, có ghi lý do (0.77).
- Đã sửa phase 01, 17, 18; plan DevOps (toolset `devops`, `tunnels`, `admin`); plan Tunelo phase 02 (`tunelo mcp`).

### Vòng 17: repo mới `localman-next` và giao việc (2026-10-08)
User yêu cầu: dùng GitHub CLI tạo repo mới trên tài khoản cá nhân (achoo254, quocdat254@gmail.com), chuyển plan vào đó, và chia phase thành việc cụ thể để chuẩn bị cook.

Jev chọn:
- Repo mới là monorepo để code; repo `localman` cũ giữ nguyên để đọc khi port, không xoá code (0.90).
- Tên repo `localman-next` (0.61).
- Phase file có checklist, kèm GitHub milestone theo đợt và mỗi phase một issue (0.97).

Repo tạo ở chế độ private (AI chọn; đổi sang public lúc nào cũng được). Thứ tự chạy và cách giao việc: `plans/dattqh/EXECUTION.md`.

### Vòng 18: chia việc và hợp đồng giữa các dịch vụ (2026-10-08)
3 agent planner thêm mục "Giao việc" (bảng việc, vai trò, việc nào chạy song song, checklist) vào 36 phase và sửa các chỗ lệch.

Jev chọn:
- MongoDB replica set dùng chung, dựng ngay ở đợt 0 (0.68).
- IdP đẩy sự kiện audit sang Localman, có outbox (0.94).
- Workspace của user lấy qua API nội bộ của Localman (0.78).
- MCP cho Tunelo đi qua registry của Localman (0.98).

Sửa phụ thuộc: 15 và 16 phụ thuộc 14; 18 phụ thuộc 19, 20, 21; DevOps 03 và 05 phụ thuộc 02. Parser OpenAPI dùng chung trong `packages/shared`.

### Vòng 19: design system riêng (2026-10-08)
Không dùng design system của bên thứ ba. Jev chọn:
- Radix Colors (0.96), màu chủ đạo violet (0.91; hỏi lại khi đã nêu rõ màu của đối thủ), màu xám slate (0.92).
- Font: lúc đầu chọn IBM Plex. User thấy tiếng Việt hiển thị chưa ổn. So sánh trực quan 12 font sans và 6 font mono có dấu chồng (ặ ẫ ầ ẩ ề ễ ồ ộ ừ ự) ở cỡ 12–24px:
  - IBM Plex đặt dấu thanh lệch sang bên dấu mũ.
  - Fira Code lỗi tiếng Việt.
  - Jev chọn **Inter** (1.00) và **JetBrains Mono** (1.00).
- Badge và nhãn dạng soft ở light mode dùng step 12 để đạt tương phản ≥ 4.5:1.

### Vòng 20: sau khi xong phase 01 (2026-10-08)
Review phase 01 phát hiện: mock runtime `{secret}.localman.hoandat.com` cùng site với dashboard, nên trang mock độc hại có thể gửi request kèm cookie phiên. Router đã sửa: mutation chỉ nhận JSON (body khác trả 415), không đọc query cho method khác GET, GET phải chỉ đọc. User giao 4 câu hỏi còn lại cho Jev (`jev-1.13.0`):
- Push `main` lên `localman-next`, giữ 13 tag `tunelo-v*` ở local tới bản phát hành đầu từ monorepo (0.90). Đã push.
- Giữ mock runtime ở `{secret}.localman.hoandat.com`, phòng CSRF ở phase 02: cookie `__Host-` SameSite=Strict, kiểm `Origin`/`Sec-Fetch-Site`, mutation chỉ nhận JSON (0.90). Không mua domain riêng (0.10).
- Làm plan IdP (đợt 0) trước Localman phase 02, không dùng auth stub (0.96).
- Repo `achoo254/tunelo` cũ: commit README chuyển hướng ngay, archive sau khi `tunelo-v1.7.0` phát hành từ monorepo (0.46; archive ngay 0.35; để nguyên tới khi phát hành 0.19). Độ tin cậy thấp, và `localman-next` đang private nên README chuyển hướng sẽ trỏ tới repo người ngoài không mở được. Chưa làm, chờ user.

### Vòng 21: khi cook plan IdP (2026-10-08)
- Localman không xin `offline_access`; refresh token gắn phiên IdP, đăng xuất ở IdP tự huỷ (Jev 0.94).
- Giữ bot Telegram riêng của Localman, tách khỏi bot bảo mật của IdP; nhắc user bấm Start một lần (Jev 0.99).

### Vòng 22: khi cook phase 02 (2026-10-09)
- Cho phép tắt thông báo trong app theo từng loại sự kiện, đúng như prototype (Jev 0.89). Thay cho câu "thông báo trong app luôn có" ở phase 02; mặc định vẫn bật.
- Web giữ React; để sau này đóng gói Tauri (desktop) và Capacitor (mobile), client gọi API qua một hàm `apiUrl()` có base URL cấu hình được (`VITE_API_BASE_URL`) và gom phần phụ thuộc trình duyệt vào `apps/web/src/platform/`. Bản native sau này cần client OIDC public (PKCE + deep link) ở IdP, API chấp nhận bearer token, và kênh push gốc (FCM/APNs) thay Web Push.
- `/auth/*` và `/internal/audit-events` là route giao thức ngoài registry, liệt kê trong `apps/api/src/operations/protocol-routes.ts` để `check:mcp-coverage` in ra.
- IdP hỗ trợ `prompt=create` (OIDC Prompt Create) để nút "Bắt đầu miễn phí" mở thẳng trang đăng ký.

### Vòng 23: khi cook phase 06 và 07 (2026-10-09)
- Kích thước dữ liệu: 32 KB mỗi bản ghi, 2 MB mỗi resource, mọi gói (Jev, phương án `balanced`).
- Generator và lưu dữ liệu chạy ngay như mockapi.io; chỉ khi thao tác làm mất bản ghi của resource con mới hỏi xác nhận, liệt kê từng resource con bị ảnh hưởng (Jev 0.95).
- Magic link là link mời tham gia project dùng lại được, theo quyết định của user; prototype vẽ nó thành link nhân bản project là bản cũ. Magic link không giữ chỗ trong trần thành viên, trần được kiểm lúc accept.
- Link mời dùng một lần luôn gắn với tài khoản hoặc email được mời, không có link mời không gắn ai (Jev 0.74). Link ai đăng nhập cũng vào được chỉ là magic link.
- Thành viên bị xoá hoặc tự rời mất quyền dashboard ngay, nhưng vẫn biết secret của URL mock. Owner có thao tác "Đổi URL mock" (xoay secret) và được gợi ý dùng sau khi xoá thành viên; không tự xoay vì sẽ làm gãy frontend đang dùng URL cũ (Jev 0.59).
- Owner hạ gói thì thành viên đang có giữ nguyên quyền; chỉ chặn mời hoặc tham gia mới cho tới khi số người dưới trần (Jev 0.65).

### Vòng 24: khi cook phase 09 (2026-10-09, user chốt)
- Localman production chạy trên server .65 bằng pm2 + nginx như IdP, không dựng VPS riêng hay Docker Compose (thay cho phương án Docker Compose ở bước 3 của phase 09).
- MongoDB của Localman là một mongod riêng, single-node replica set ở cổng 27018, chỉ nghe localhost; không chuyển mongod chung cổng 27017 của các app khác.
- Claude tự tạo trên Cloudflare: record `localman` (proxied) và `*.localman` (DNS only), widget Turnstile, và API token chỉ có quyền DNS Edit của `hoandat.com` cho certbot gia hạn wildcard; secret lưu ở iCloud `auth-hoandat`.
- Bot Telegram riêng cho Localman do user tạo qua @BotFather rồi gửi token.
- Owner xoá một collaborator thì giữ dấu "đã bị gỡ" cho người đó: magic link từ chối họ với lời giải thích rõ; lời mời trực tiếp của owner xoá dấu. Không tự thu hồi magic link khi xoá thành viên (Jev 0.92).
- Lời mời theo email vẫn gắn vào tài khoản có email chưa xác minh như đã chốt ở phase 07; audit phase 09 không đưa thêm bằng chứng mới nên giữ nguyên.
- Backup Mongo của Localman tạm giữ trên chính .65 (hằng ngày, 14 bản, báo Telegram khi lỗi); bản sao ngoài server làm khi đã có người dùng thật (Jev 0.44, phương án `defer`). User chốt hướng chung: ưu tiên có người dùng trước, không làm hạ tầng quá kỹ.

### Vòng 25: khi cook phase 17 (2026-10-09)
- Token MCP theo project chỉ hiện một lần lúc bật hoặc xoay; snippet cấu hình đọc token từ biến môi trường, không chép token vào file cấu hình (thường bị commit).
- Dry-run kèm `confirm_token` chỉ bắt buộc cho tool ảnh hưởng nhiều thứ: xoá project, xoá resource kèm con, `reset_all`, `generate_all` (ghi đè mọi resource), xoay secret project và xoay token MCP; các tool `destructive` khác như sinh dữ liệu một resource hay di chuyển resource chạy thẳng, để agent AI không bị phiền.
- Thao tác thành viên (mời, xoá, magic link) thuộc toolset `collab`, không mở qua OAuth `mock:*`: agent cầm `mock:write` không tự mời người hay lấy link tham gia project được (review phase 17).
- Localman MCP qua OAuth chỉ mở toolset có scope ở IdP (`mock`, `client`); scope `credentials:write` không cấp mặc định, consent có cảnh báo đỏ.
- Tên resource `mcp` bị cấm vì trùng route `/mcp` của Hosted Mock MCP.
- OpenAPI nhập từ JSON; YAML cân nhắc ở phase 19.

### Verification
Repo đích chưa tồn tại nên không có claim nào về code để kiểm. Path và module của `localman` được dẫn ở phase 10 đã đối chiếu với `localman/docs/codebase-summary.md` và cây thư mục `localman/client/src`.

## Câu hỏi mở
