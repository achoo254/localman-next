---
title: "Localman web — mô phỏng 100% mockapi.io và 100% quản lý Collections/Environments (kèm share) của Postman"
description: "Xây SaaS mock REST API độc lập, giống mockapi.io về IA, luồng, tương tác, hạn mức gói và hợp đồng API, với design system riêng. Sản phẩm tại localman.hoandat.com."
status: in-progress
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
| 01 | [Scaffold monorepo và nền tảng brand](phase-01-scaffold-and-brand-foundation.md) | M | — | in-progress |
| 02 | [Auth: email/password, Google, GitHub, reset password](phase-02-auth.md) | M | 01 | completed |
| 03 | [Projects và giới hạn gói](phase-03-projects-and-plan-limits.md) | M | 02 | completed |
| 04 | [Resources, schema, sinh dữ liệu](phase-04-resources-schema-and-data-generation.md) | L | 03 | completed |
| 05 | [Mock runtime công khai](phase-05-mock-runtime.md) | L | 04 | completed |
| 06 | [UI Project detail: canvas cây resource và các modal](phase-06-project-detail-ui.md) | L | 04 (05 để test end-to-end) | completed |
| 07 | [Collaboration và magic link](phase-07-collaboration-and-magic-link.md) | M | 03 | completed |
| 08 | [Landing, pricing, account](phase-08-landing-pricing-account.md) | M | 03, 06 | completed |
| 09 | [Hardening, E2E, deploy](phase-09-hardening-e2e-deploy.md) | M | 05–08 | completed |
| 10 | [API Client: lõi gửi request và proxy (port từ localman)](phase-10-api-client.md) | L | 09 | in-progress |
| 11 | [Workspace, vai trò và chia sẻ phần tử](phase-11-workspaces-and-sharing.md) | L | 10 | completed |
| 12 | [Collections tương đương 100% Postman](phase-12-collections.md) | L | 11 | completed |
| 13 | [Environments và biến tương đương 100% Postman](phase-13-environments-and-variables.md) | L | 11, 12 | completed |
| 14 | [Fork, merge, pull request, comment, watch](phase-14-fork-merge-comments-watch.md) | XL | 12, 13 | completed |
| 15 | [Chia sẻ công khai: public workspace, guest, nút Run, access key](phase-15-public-sharing.md) | M | 11, 12, 13, 14 | pending |
| 16 | [Live Mock Sync: mock luôn đồng bộ với collection và environment](phase-16-live-mock-sync.md) | M | 12, 13, 14 | pending |
| 17 | [Nền tảng MCP (toolsets, dry-run, coverage) cùng Mock MCP tức thì](phase-17-mock-mcp.md) — **chạy ngay sau 09, trước 10** | M | 5, 9 | in-progress |
| 18 | [Localman MCP: đủ toolset cho API client, chia sẻ, cộng tác, đồng bộ, traffic](phase-18-localman-mcp-client-tools.md) | M | 16, 17, 19, 20, 21 | pending |
| 19 | [Mock power-ups: Faker thông minh, tạo resource từ JSON/OpenAPI/CSV, xuất type, chaos, response theo điều kiện](phase-19-mock-power-ups.md) | M | 4, 5, 6 | in-progress |
| 20 | [Mock lai localhost, log request có replay, webhook inbox về localhost, mock callback](phase-20-mock-traffic-and-hybrid-localhost.md) | L | 5, 10 | completed |
| 21 | [Client power-ups: secret local không rời trình duyệt, nối request không cần script, docs tự sinh](phase-21-client-power-ups.md) | M | 10, 13, 16 | pending |
| 22 | [Browser extension: gửi request vượt CORS, cùng bộ công cụ cookie, storage, network, performance cho tab đang mở](phase-22-browser-extension.md) | L | 10 | cancelled |
| 23 | [Extension: tiện ích mở rộng (cache/SW, console, tạm tắt CORS, giả lập thiết bị, sửa header, xem JSON, thay response bằng mock)](phase-23-extension-utilities.md) | M | 22 | cancelled |

**Thứ tự thực thi:** 01 → 09 → **17 → 19** → 10 → **20** → 11 → 16 → **21 → 18**. Phase 22 và 23 (browser extension) đã huỷ ngày 2026-10-16 (Vòng 39). Sau đó là plan DevOps `../261008-1337-devops-toolkit/` (7 phase). Số phase giữ nguyên để không phá các tham chiếu chéo. Plan IdP và plan Tunelo phải xong trước phase 02 và phase 10.

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
- Bật cờ `mockMcp` ngay sau khi Hosted Mock MCP qua kiểm thật trên production, không chờ user thử OAuth bằng Claude Code (Jev 0.52); cờ production ghi trong `infra/localman/released-features`.

### Vòng 26: khi cook phase 19 (2026-10-09)
- User vắng và ưu tiên có người dùng trước: T1 của phase 19 làm bằng bản đặc tả giao diện (`plans/dattqh/reports/ui-phase-19-mock-power-ups-spec.md`) thay cho sửa prototype rồi chờ user duyệt; user xem trên bản đã deploy.
- Mọi chữ mới của phase 19 đi qua i18n (English mặc định, 中文, Tiếng Việt) và không nêu tên đối thủ.
- Tool của toolset `mock-advanced` dùng chung scope OAuth `mock:read`/`mock:write` để Claude Code và agent khác gọi được qua Localman MCP mà không cần thêm scope ở IdP.

### Vòng 27: chuyển sang API client (2026-10-09, user chốt)
- User yêu cầu: hoàn thiện mock API rồi làm phần gọi API giống Postman. Phase 10 làm trước đợt 4 (Tunelo theo tài khoản); phần T8 tự nhận tunnel qua `GET /api/tunnels` hoãn tới khi xong plan Tunelo, phase 10 vẫn có phát hiện host local, thử gửi thẳng localhost, panel Tunelo và dán URL tunnel thủ công.
- Phase 20 (mock lai localhost, log có replay, webhook inbox, mock callback) làm sau phase 10 vì cần API client và tunnel theo tài khoản.
- Câu hỏi mở của bước xia phase 10 (`plans/dattqh/reports/xia-phase-10-api-client-port.md`), chốt theo khuyến nghị: hộp thoại "hỏi trước khi secret đi qua proxy" kiểm bằng unit với dữ liệu giả, E2E dời sang phase 13 (biến `type=secret`); script dùng `lm.*`, không alias `pm.*`; nhãn import/export ghi "Collection v2.1" (không nêu tên đối thủ); thêm tab Tests ở response, chỉ hiện khi request có script; OpenAPI chỉ nhận JSON, YAML báo lỗi rõ.
- Bước xia phát hiện CSP `connect-src 'self'` sẽ chặn mọi request gửi thẳng từ trình duyệt và thiếu `'wasm-unsafe-eval'` cho QuickJS; T3 phải sửa CSP và thêm `location` riêng cho proxy (body 10 MB, timeout 120 s).

### Vòng 28: khi cook phase 20 (2026-10-10, user: "tiếp tục đi, xong thì deploy luôn")
- `tunnel:<localPort>` của upstream, inbox forward và callback tìm URL tunnel trong ánh xạ thủ công của **chính owner** project (client settings `tunnelMappings` của phase 10, key `localhost:<port>`, chỉ mapping đang bật, URL đã qua kiểm `TUNNEL_DOMAINS`). Tự nhận tunnel qua `GET /api/tunnels` của Tunelo làm cùng T8b khi plan Tunelo xong; phase 20 không chờ.
- Mọi request ra ngoài (upstream, inbox forward, callback) dùng forwarder có ghim DNS và bộ chặn SSRF của proxy phase 10, kèm `X-Localman-Proxy: 1`.
- T1: màn Inbox và Callback bổ sung vào prototype rồi làm luôn, không chờ duyệt (user yêu cầu làm tiếp và deploy). T10: deploy production và thêm cờ `hybridMock` vào `released-features` sau khi mọi cổng kiểm tra và review pass.
- Chốt sau T1 (spec `plans/dattqh/reports/ui-phase-20-traffic-spec.md`): lỗi upstream theo quy ước repo `{ error: { code: "UPSTREAM_UNAVAILABLE", message, hint } }`; chưa có role Editor nên chỉ owner đặt upstream, inbox, callback, collaborator chỉ đọc; hạn mức `webhookInboxes` tính theo project; có operation xoá log (owner, cần xác nhận).

### Vòng 29: trang chủ khi đã đăng nhập (2026-10-10, user hỏi, Jev quyết)
- Vấn đề: `/` chuyển người đã đăng nhập sang `/projects`, nên họ không xem lại landing (tính năng, giá, FAQ) được nữa.
- `/` luôn hiện landing, kể cả khi đã đăng nhập (Jev 0.99). Với người đã đăng nhập, header của landing hiện "Open app" và avatar thay cho "Sign in", nút chính ở hero dẫn tới `/projects`. Wordmark trong app vẫn về `/projects`. Menu tài khoản và footer có link "Localman home" về `/`.
- Thêm trang `/pricing` riêng, link từ landing, menu tài khoản và hộp thoại giới hạn gói (noul 0.75).
- Không nhớ lựa chọn để tự chuyển người đã đăng nhập từ `/` sang `/projects` (noul 0.14).

### Vòng 30: khi cook phase 11 (2026-10-10, user: "làm tiếp công việc trong plan", Jev quyết)
- Collection và environment chưa có (phase 12, 13), nên UI Share, Manage access, trang Request access và nút duyệt/từ chối trong panel thông báo làm đủ ngay ở phase 11, test riêng; phase 12 chỉ việc gắn vào collection (Jev 0.78, dời sang 12 là 0.22).
- UI workspace đặt sau cờ `workspaces`, chưa bật ở prod cho tới khi workspace chứa collection (Jev 1.0). Bốn loại thông báo mới cũng ẩn khỏi trang cài đặt khi cờ tắt.
- Theo Postman: phần tử trong workspace cá nhân không chia sẻ được, phải chuyển sang workspace team trước (Jev noul 0.72).
- Bảng quyền đặt ở `@localman/shared/access` (`packages/shared/src/access-permissions.ts`) để API và web dùng chung. Các dòng Postman về đối tượng Localman không có (specification, flow, monitor, integration, API) được bỏ, có ghi chú trong file.
- Vai trò trên phần tử = mạnh hơn giữa vai trò suy từ workspace (Admin/Editor thành Editor, Viewer thành Viewer) và vai trò chia sẻ riêng; chia sẻ riêng chỉ nâng, không hạ.
- Sau review backend: chủ rời workspace thì quyền chủ chuyển cho Admin cũ nhất còn lại, kể cả khi người đó vượt hạn mức workspace team; họ chỉ bị chặn tạo workspace mới (Jev 0.87, phương án chặn rời đi là 0.13).
- Chia sẻ riêng một phần tử cho người ngoài workspace không chiếm ghế thành viên (Jev noul 0.12).
- Move cần quyền `moveDeleteElements` ở workspace nguồn (Admin hoặc Editor của workspace), không chỉ share Editor, vì Localman tách chia sẻ phần tử khỏi tư cách thành viên. Approve phải nêu vai trò người duyệt đã thấy; yêu cầu đổi vai trò sau đó thì trả 409 `REQUEST_CHANGED`.

### Vòng 31: sau phase 11 (2026-10-11, user: "gửi model jev quyết định")
- Thứ tự ghi trong plan đặt phase 16 ngay sau 11, nhưng 16 cần 12, 13 và 14. Việc tiếp theo là phase 12 Collections (Jev 0.83; tạm dừng plan để tập trung thu hút người dùng 0.17; làm 16 theo đúng thứ tự 0.0; nhảy sang extension 0.0).
- Khi phase 12 xong và qua review, nghiêng về bật cờ `workspaces` trên prod (Jev noul 0.6). Deploy vẫn chờ user yêu cầu tường minh.

### Vòng 32: khi cook phase 12 (2026-10-11, Jev quyết)
- Phase 12 chia 2 đợt (Jev 0.99). Đợt A đủ để bật cờ cho người dùng: cây collection CRUD và kéo thả, lưu request từ tab vào collection, auth/scripts/variables kế thừa, import/export v2.1 round-trip, Share/Move, Overview, xoá phải gõ "delete", thùng rác cơ bản (restore chọn workspace, xoá vĩnh viễn, job dọn sau `trashDays`). Đợt B: changelog có diff và restore-to-change, tag và status tag, example, trang trash có lọc, chọn nhiều. Revision bắt đầu ghi từ đợt B, trước khi bật cờ cho người dùng.
- Xoá workspace team thì collection bên trong vào thùng rác, người có quyền restore về workspace khác (Jev 0.92; chặn xoá khi còn collection 0.08; xoá vĩnh viễn 0.0).
- Export collection để trống giá trị biến secret (Jev 0.98). Qua API, ai xem được collection đều nhận giá trị biến và credential của auth; cờ secret chỉ để che trên UI (Jev 1.0).
- Thùng rác (review backend đợt A chứng minh người xoá bị loại khỏi team vẫn mang được collection sang workspace riêng): quyền restore và xoá vĩnh viễn theo vai trò hiện tại. Khi workspace gốc còn, chỉ Admin hoặc Editor hiện tại của nó làm được; restore sang workspace khác phải qua luật move. Khi workspace gốc đã xoá, người xoá hoặc Admin/Editor cũ làm được. User chốt; Jev chia đôi: người xoá luôn có quyền 0.59, theo vai trò hiện tại 0.41.
- Kỹ thuật: codec v2.1 đặt ở `packages/shared` để web import/export dùng chung; kiểm bằng JSON Schema chính thức v2.1 (draft-04, `ajv` + `ajv-draft-04` chỉ trong test). Thùng rác dùng `deletedAt` (khác tombstone `deletingAt` của project, vốn chỉ để xoá dây chuyền). Template "Từ project mock" dùng hàm thuần `mockRequestsOf` của web, tạo collection qua cùng đường import.

### Vòng 33: sau đợt A của phase 12 (2026-10-11, user chốt)
- Đợt A đã commit (`8f099c0`). Bước tiếp theo: làm đợt B, chưa push và chưa deploy; khi đợt B xong mới deploy và bật cờ `workspaces`. User chốt; Jev phân vân: làm tiếp đợt B 0.40, deploy và bật cờ 0.31, deploy giữ cờ tắt 0.29.
- Changelog: "Hide diff" chỉ để giảm nhiễu, chỉ ẩn diff của chính thay đổi đó và UI ghi rõ thao tác này không xoá dữ liệu khỏi lịch sử (Jev 0.89; ẩn cả ở diff liền kề 0.09; thêm thao tác purge 0.02). Thay đổi có patch vượt 4 MiB chỉ lưu metadata; dry run và hộp thoại xác nhận báo `irreversible` (Jev 0.80; lưu nghịch đảo riêng 0.14; chặn hẳn 0.06).

### Vòng 34: khi cook phase 13 (2026-10-12, user: "làm tuần tự, cần quyết định gửi model jev quyết")
- Phase 13 chia 2 đợt như phase 12 (Jev 0.96; một lượt 0.03). Đợt A: model, secret, resolver, CRUD environment và globals, active environment, local/shared từng biến, UI selector, editor và globals, nối resolver vào gửi request. Đợt B: thao tác "all" có revision, import/export Postman, highlighter, tooltip, gợi ý `{{`, "Set as variable", script, pane Variables, thanh Info. Mỗi đợt commit riêng.
- UI environment đặt sau cờ mới `environments`, chỉ bật ở dev và E2E, chưa vào `released-features` cho tới khi phase xong và qua review (Jev 0.99), vì cờ `workspaces` sẽ lên prod ở lần deploy tới.
- Script giữ quyết định Vòng 27: `lm.environment`, `lm.collectionVariables`, `lm.globals`, `lm.variables`, không alias `pm.*`.
- Biến secret của environment và globals mã hoá bằng keyring mới `VARIABLE_ENCRYPTION_KEY` (định dạng như `SESSION_ENCRYPTION_KEY`), không bắt buộc lúc khởi động: thiếu khoá thì tạo hoặc sửa biến secret trả 503, phần còn lại vẫn chạy (Jev 0.52; bắt buộc 0.36; dùng chung khoá session 0.12). Lý do tách khoá: session xoay khoá rồi bỏ khoá cũ được, còn biến secret sống vô thời hạn.
- Xoá environment là xoá vĩnh viễn cùng biến và giá trị local, có dry run và hộp thoại xác nhận nêu số biến (Jev 0.98; thùng rác 0.02).
- Biến collection giữ quyết định Vòng 32: không mã hoá, cờ secret chỉ che UI; phase 13 chỉ thêm giá trị local riêng từng user cho biến collection (Jev 0.81; mã hoá cả biến collection 0.19).

### Vòng 35: sau đợt A của phase 13 (2026-10-12, Jev quyết)
- Phần server điền secret bị giấu khi gửi qua proxy dời sang đợt B (Jev 0.92; làm ngay 0.08). Đợt A dừng request dùng secret bị giấu với `SECRET_WITHHELD`.
- CI chập chờn sửa gốc ngay thay vì bật retry (Jev 0.95; retry 0.01; để sau 0.04): 7 test phụ thuộc tốc độ runner đã sửa qua ba lượt.
- Review độc lập đợt A: 3 High, 4 Medium, 8 Low, sửa hết kèm test tái hiện (`plans/dattqh/reports/code-reviewer-261012-0935-phase-13-slice-a.md`). SAST đạt trước và sau bản sửa.
- Prod chạy release `20261011-084333-217f3064cb16` (workspaces và collections đã lên), nên giới hạn body 128k của nginx đang làm import và lưu collection lớn hơn 128 KB trả 413 cho người dùng. Bản sửa ở `origin/main`, chờ deploy.
- Deploy: Jev khuyên deploy ngay với cờ `environments` vẫn tắt (0.93; chờ đợt B 0.07; bật cờ luôn 0.0), để sửa lỗi 413 và chạy DAST thật trên API environments. Deploy chờ user yêu cầu tường minh.

### Vòng 36: deploy sau đợt A của phase 13 (2026-10-12, user chốt "Deploy, cờ tắt")
- Deploy release `20261012-031014-e9751e0e2a0f-dirty` lên prod, cờ `environments` vẫn tắt; backup trước đó `localman-20261012-101006`. `setup-server.sh` thêm `VARIABLE_ENCRYPTION_KEY` vào `/opt/localman/.env`.
- DAST đạt cho API environments và nginx (`plans/dattqh/reports/security-261012-1016-phase-13-environments-dast.md`): 15 endpoint mới đòi đăng nhập, kiểm Origin, body 200 KB tới API không còn 413 (lỗi collections trên prod đã hết), trần 16m và zone rate limit có hiệu lực, secret mã hoá khi lưu trên Mongo prod, đổi kiểu biến seal lại đúng, IDOR trả 404, xoá dọn sạch. UI chưa kiểm trên prod vì cờ tắt.

### Vòng 37: chưa thương mại, gỡ giao diện gói và giá (2026-10-12, user yêu cầu, Jev quyết phần kỹ thuật)
- User: gỡ sạch bảng giá, thanh toán… khỏi web, giữ backend; mọi tài khoản chưa từng dùng thử (cũ và mới) tự được Pro 30 ngày rồi về Free; gia hạn hay nâng lại gói do quản trị quyết; trang tài khoản hiện usage và ngày hạn mức mở rộng kết thúc. Kế hoạch: `plans/dattqh/261012-1105-hide-commercial-ui/plan.md`; ADR-0002.
- Jev: gia hạn chỉ admin làm, bỏ form trên web, giữ endpoint (0,98); nhắc hạn vẫn gửi, câu trung tính (0,90); chạm giới hạn thì một câu nêu giới hạn và gợi ý góp ý, không link gói (0,74).
- Tự cấp Pro chạy lúc đăng nhập và mỗi lần làm mới phiên (`syncUserFromUserInfo`), không ở `GET /users/me`, để route đọc nóng nhất không có lượt ghi.
- Sau review, Jev: admin hạ về Free một tài khoản chưa từng dùng thử thì chấp nhận việc tự cấp lại, chỉ ghi tài liệu (0,89, `mark_used` 0,11); `/pricing` chuyển bằng 302 thay vì 301 (1,0); chữ hạn mức resource sửa cho khớp server, tính tổng trên mọi project (0,88, giữ "mỗi project" 0,12, đổi server 0,00).
- Deploy (user: "chờ CI xanh rồi deploy"): release `20261012-065240-61c4601aa3c8`, backup `localman-20261012-135233`; DAST đạt phần từ ngoài và phía server (`plans/dattqh/reports/security-261012-1355-hide-commercial-ui-dast.md`).

### Vòng 38: đợt B phase 13 (2026-10-12, user: "làm tiếp Environments. Đảm bảo cho tôi phần collection và Environments phải hoàn thiện 100%. Xong hết thì deploy prod")
- Phạm vi "100%": mọi dòng ma trận của phase 12 và 13 thuộc chính hai phase, bật cờ `environments`; Fork, Pull requests, Comments, Watch để phase 14 (Jev 0,99; làm luôn phase 14 0,01). Rà lại ma trận phase 12 trên code và UI thay vì tin checklist (Jev 0,79).
- Server **không** điền secret bị giấu với Viewer khi proxy: proxy gửi tới URL bất kỳ nên Viewer đọc được secret qua server riêng; giữ `SECRET_WITHHELD` và cho đặt giá trị local (Jev 0,99), thay cho T6b phần server.
- Thao tác "all" (Share all, Update all shared values, Reset all, Unshare all) là một lần ghi nguyên tử, không làm model revision cho environment vì ma trận không có changelog environment (Jev 0,93).
- "Set as variable" và "Add to": Editor tạo biến ở scope chọn với shared value bằng giá trị chọn; Viewer chỉ được biến tạm (Jev 0,85, chỉ ghi local 0,13). Biến tạm sống riêng từng tab, mất khi đóng tab (Jev 0,98).
- Biến động `$random*`: map sang whitelist Faker, web chỉ tải chunk Faker riêng khi request sắp gửi có `{{$random…}}` (Jev 1,0; tự viết bộ sinh 0,00).
- Rà soát phase 12 (`plans/dattqh/reports/code-reviewer-261012-1430-collections-environments-parity-audit.md`): 10/16 dòng đạt, 5 dòng mới một phần, 2 lối vào chết trên prod (import file environment, snippet `lm.environment.set`). Jev: lưu trường liên kết `mockProjectId` (ghi khi tạo từ mock) và `linkedEnvironmentId` (Editor chọn, mặc định environment share kèm) (0,99); diff đã ẩn vẫn cho Editor xem kèm ghi chú, Viewer không (0,55, độ tự tin 0,10); session changelog là cửa sổ cố định 5 phút từ thay đổi đầu, không cắt ở ranh giới trang (0,68); Unshare giữ hành vi xoá shared, không chuyển thành local (0,82).
- Sau review đợt B (`reports/code-reviewer-261012-1535-phase-13-slice-b-{backend,web}.md`, 0 Critical; backend 4 Medium, web 2 High + 6 Medium), Jev: duplicate collection mang theo `linkedEnvironmentId` (noul 0,68); thay đổi của pre-request script vẫn lưu khi request lỗi hoặc bị huỷ như Postman (0,61); phân trang changelog lưu `sessionStartSeq` lúc ghi (0,98); "nơi đang dùng" trong Info của environment là danh sách collection liên quan người xem đọc được (0,99); link phần tử share riêng cho người ngoài workspace mở phần tử mà không đổi workspace (0,53, độ tự tin 0,06); Move environment không thuộc đợt này (noul 0,09); "Set as variable"/"Add to" trùng tên thì cảnh báo thay shared cho mọi người và reset local của người bấm (0,67).
- Deploy và DAST đợt B (user: "chạy DAST thật cho Environments sau deploy"): CI đỏ hai lần vì test chập chờn của workbench (đếm render History khi refetch về muộn; lượt lưu draft của tab mới trống chen trước), sửa ở `3eb9a1e`, `1ab6185`, CI xanh. Hai session thống nhất chỉ deploy một lần, session auth deploy release `20261012-105625-1ab618562676` sau backup `localman-20261012-175619`. DAST đạt (`reports/security-261012-1805-phase-13-slice-b-dast.md`): endpoint mới đòi đăng nhập và kiểm Origin, export không lộ secret, import seal secret trên Mongo, `{{baseUrl}}` qua Proxy/Tunelo 200, `lm.environment.set` lưu thành local, log không có secret. Còn 1 Low (nhãn SHARED cho biến chưa chia sẻ) và 2 Info (502 cho body lớn bị chặn CSRF, thiếu trang 404 của app).

### Vòng 39: bỏ browser extension (2026-10-16, user: "plan browser extension bỏ đi nhé")
- Huỷ phase 22 và 23 (đợt 8, issue #61 và #62). Cả hai chưa có mục nào làm và repo chưa có code extension, nên không phải gỡ gì trong code.
- Giữ tệp phase và `prototype/extension.html` làm hồ sơ, đánh dấu `cancelled`, không xoá (Jev 0,74; xoá tệp 0,26). Số phase giữ nguyên để không phá tham chiếu chéo.
- Ghi chú miễn MCP cho tiện ích extension ở phase 17 hết hiệu lực vì không còn tiện ích đó.

### Vòng 40: làm tiếp plan chính (2026-10-16, user: "làm tiếp các công việc nhỏ rồi cook plan chính. Các câu hỏi mở hay đề xuất gửi model jev quyết định")
- Việc nhỏ: phase 17 T10 đã xong từ trước (trang `/docs/mcp`), chỉ chưa tick; verification phase 19 chạy lại bằng test có sẵn (222 test) rồi tick.
- Issue #61, #62 đóng dạng *not planned* và đóng milestone đợt 8 (Jev 0,65; để mở 0,35; xoá milestone 0,0).
- Việc tiếp theo trong plan chính là phase 14 (Jev 0,51), không phải T8b của phase 10 trước rồi mới 14 (0,48). T8b đã hết bị chặn vì Tunelo `v1.7.0`–`v1.9.0` đã phát hành.
- Phase 14 chia hai đợt (Jev 0,51): đợt A là comment và watch, chạy được ở workspace team của gói Free; đợt B là `three-way-merge`, fork, merge, giải xung đột và pull request. Chia theo kiểu "version control trước" được 0,39.
- Không giữ cả phase sau một cờ tới khi xong hết (Jev noul 0,40): mỗi đợt có cờ riêng, bật khi đợt đó qua review.
- Thiết kế đợt A (Jev): watch báo qua job định kỳ đọc changelog, mỗi người theo dõi nhận một thông báo tổng hợp cho mỗi collection mỗi lượt, bỏ thay đổi của chính họ (0,96; báo ngay sau mỗi lần ghi 0,04). Comment cho cả collection ở workspace cá nhân (noul 0,53) và cho Viewer (0,52). Comment inline lưu đoạn chữ đã chọn, "outdated" khi chỗ đó không còn đúng đoạn chữ ấy (0,81; lệch ngay khi phần đó đổi 0,19). Trả lời trong thread báo cho người đã viết trong thread (0,58). Comment và watch có MCP tool (0,84). Không tự watch collection mới tạo (0,50, không qua ngưỡng).

### Vòng 41: SAST đợt A phase 14 (2026-10-16)
- Review bảo mật không có Critical. Đã sửa: High không giới hạn thông báo (thêm giới hạn `comment` và giới hạn thông báo theo người nhận); Medium thiếu cổng server (thêm `COMMENTS_ENABLED`, mặc định tắt, gom chung cơ chế với `PUBLIC_SHARING_ENABLED` ở `operations/feature-gates.ts`; Jev noul 0,84); anchor lệch với body CRLF; quyền resolve đọc từ `COLLECTION_PERMISSIONS`. Sửa luôn các Low: reply chạy đua với xoá thread, lỗi tra cứu sau khi ghi gây comment trùng, @ trong code, IME và `role="combobox"` của ô soạn.
- Comment của node đã xoá: giữ lại (restore change mang node về cùng id) và vẫn tính vào hạn mức (Jev 0,70; không tính 0,26; xoá theo node 0,04).
- Chấp nhận, không sửa: hạn mức 5000 là trần mềm khi ghi đua nhau; job watch đọc mọi watch mỗi phút (đủ ở quy mô hiện tại); Markdown chậm với chuỗi `[[[` dài là component có sẵn, chỉ làm chậm tab của người xem.

### Vòng 42: đợt A phase 14 lên production và DAST (2026-10-16, user: "đồng ý" deploy, "làm xong đợt 1 đã")
- Deploy release `20261016-093326-047ccf396ad0` (`047ccf3`, sạch), thêm `comments` vào `released-features`, `COMMENTS_ENABLED=true` trong `/opt/localman/.env`. Backup trước khi ghi: DB `localman-20261016-163320`, `.env.bak-261016-comments`. `restarts` 35 lên 36 (lần reload của deploy), không có log lỗi sau deploy.
- Kiểm sau deploy: `/` và `openapi.json` 200, CSP 5 hash, cổng 4000/4100/27018 chỉ nghe `127.0.0.1`, route comment/watch trả 401 khi chưa đăng nhập.
- DAST bằng phiên đăng nhập thật trên production (workspace team và collection tạm, đã xoá hẳn sau đó): tạo, trả lời, reaction, resolve, ẩn/hiện thread đã xong; anchor sai 400 `ANCHOR_MISMATCH`, khoá lạ trong anchor bị bỏ khi lưu, reaction lạ 400; id của collection khác, id lạ và id sai dạng đều 404; body rỗng hoặc quá 10.000 ký tự 400; xoá dry run không xoá; giới hạn `comment` trả 429 `RATE_LIMITED` ở lượt thứ 20 trong một phút; watch ở workspace cá nhân 409 `WATCH_UNAVAILABLE`; job watch chuyển `lastSeq` qua thay đổi của chính người theo dõi mà không gửi thông báo; nội dung `<img onerror>` và link `javascript:` hiện thành chữ trên UI, console không có lỗi CSP. **Kết luận: SAST và DAST đều đạt, comment và watch vận hành được.**
- Chưa kiểm được trên production: thông báo @mention và watch giữa hai tài khoản thật (chỉ có một tài khoản; đã có test tích hợp). Tool MCP comment: token Localman MCP hiện cấp không có scope `collab`, nên agent qua MCP chưa dùng được nhóm tool cộng tác (có từ trước, không do bản này).
- Ngoài phạm vi, thấy khi đọc log: 12 lỗi `ERR_JWKS_TIMEOUT` lúc 14:55–14:59 (trước deploy). API trả 500 khi không lấy kịp JWKS của IdP để xác thực token MCP.

### Vòng 43: hai việc ngoài phạm vi thấy khi deploy (2026-10-16, user: "phân tích ngoài phạm vi rồi gửi model jev quyết định")
- `ERR_JWKS_TIMEOUT` lúc 14:55–14:59: nguyên nhân là `POST /auth/backchannel-logout` chỉ đổi `IdpUnavailableError` thành 503, còn lỗi lấy JWKS của IdP (`JWKSTimeout`) thành 500 và không huỷ phiên Localman khi IdP báo đăng xuất. Đường xác thực token MCP đã xử lý đúng. Sửa route cho lỗi JWKS trả 503 `AUTH_UNAVAILABLE`, kèm test (đỏ trước khi sửa, xanh sau) (Jev 0,52; sửa và điều tra luôn vì sao JWKS chậm 0,48). Vì sao JWKS chậm lúc đó còn mở: log IdP không có gì ở mốc giờ ấy.
- Agent qua Localman MCP không thấy tool comment vì IdP chỉ cấp scope `mock:*` và `client:*`, còn comment và watch nằm ở toolset `collab` (cùng chỗ quản lý thành viên project, cố ý để ngoài tầm OAuth). Chuyển comment và watch sang toolset `client`, cùng chỗ collections; không đổi IdP, quản lý thành viên vẫn ngoài tầm agent (Jev 0,97; thêm scope `collab` ở IdP 0,00; để tới phase 18 0,03). Operation đổi tiền tố `collab.*` thành `client.*`, tên tool MCP giữ nguyên.
- Làm ngay trước đợt B (Jev noul 0,66). Deploy bản sửa chờ user yêu cầu.

- Deploy bản sửa (user: "đồng ý deploy"): release `20261016-145505-378ac07634cc`; `/` và `openapi.json` 200, CSP 5 hash, back-channel logout 400 với token rác, operation comment là `client.*`, metadata MCP quảng bá `client:*`; `restarts` 36 lên 37, không log lỗi.

### Vòng 44: thiết kế đợt B phase 14 (2026-10-16, user: "xong thì làm tiếp đợt B", Jev quyết)
- Chia đợt B (Jev 0,91): **B1** fork, pull changes, merge 3 tuỳ chọn và giải xung đột cho collection và environment; **B2** pull request, review, comment trên diff.
- Gốc chung để merge là snapshot nội dung nguồn lúc fork, thay bằng kết quả sau mỗi lần pull hoặc merge (0,93; dựng lại từ changelog 0,07, vì changelog bị cắt và có revision không giữ patch). Snapshot lưu mỗi node một bản ghi riêng, gốc collection nằm trên bản ghi fork (0,91), để không chạm giới hạn 16 MB mỗi document.
- Ghép node fork với node nguồn bằng bản đồ id nguồn sang id fork lưu trên liên kết fork, thêm vào khi merge hay pull tạo node mới (0,63; trường `originId` trên từng node 0,35).
- Viewer của collection chỉ fork vào workspace cá nhân (0,63; mọi workspace được thêm phần tử 0,35). Editor fork vào workspace nào mình được thêm phần tử.
- Environment: fork chép giá trị secret chỉ cho Editor của nguồn (như duplicate); pull và merge mang key, kiểu và giá trị không phải secret, không bao giờ mang giá trị secret (0,95).
- Fork của fork được phép (noul 0,72). Xoá nguồn thì fork ở lại thành collection thường, hiện nguồn không còn, pull và merge trả 404 (0,99).
- Comment của pull request (B2) dùng lại module comment, thêm đích pull request và loại anchor trỏ vào một thay đổi trong diff (0,98).

### Vòng 45: SAST đợt B1 phase 14 (2026-10-16)
- Không có Critical. Đã sửa: **H1** cặp id ghi sai khi một node bị một bên xoá được giữ lại bằng Keep Source (lần merge sau nhân đôi hoặc tạo lại request); nay cặp mới luôn quy về id thật của phía bên kia và thay cặp cũ, có test đỏ trước khi sửa. **H2** pull/merge environment có thể mất cập nhật: ghi biến và tên/màu trong một lần, chỉ khi `updatedAt` chưa đổi kể từ lúc đọc (409 `ENVIRONMENT_CHANGED`). **M1** "merge and delete" kiểm quyền xoá fork trước khi merge; bước sau merge thất bại thì trả `followUp: "failed"`, merge vẫn giữ. **M2/M3** giới hạn `fork` (10/phút mỗi người, 20 mỗi nguồn) và `sync` (30/phút mỗi người, 60 mỗi fork); web không tự so sánh lại khi quay lại cửa sổ. **L1/L2** merge chỉ đọc thuộc tính riêng, kết quả không có prototype (biến tên `constructor`, `__proto__`); khoá phần gốc environment là chuỗi rỗng. **L3** bộ ghi chung kiểm kích thước từng node. **L4** `auth` merge nguyên khối. **L5** sửa key danh sách thay đổi, hiện "(trống)" cho trường thiếu.
- Hiển thị fork người gọi không mở được trong danh sách: giữ như Postman, hiện nhãn và người tạo (Jev 0,95).
- Chấp nhận, ghi lại: danh sách fork gọi kiểm quyền từng fork (tối đa 200); snapshot gốc không tính vào dung lượng (đã có giới hạn tốc độ); restore một mục `merge` ở nguồn không đổi gốc, nên lần pull sau mang việc restore sang fork; ở lại trang fork sau "merge and delete".

### Vòng 45b: đợt B1 lên production và DAST (2026-10-16, user: "đồng ý deploy")
- Release `20261016-155903-33a73d25cf51` (`33a73d2`, sạch), cờ `forks` và `FORKS_ENABLED=true`. Backup: DB `localman-20261016-225903`, `.env.bak-261016-forks`. `restarts` 37 lên 38 (lần reload của deploy), không log lỗi; route fork trả 401 khi chưa đăng nhập.
- DAST bằng phiên đăng nhập thật (workspace, collection, environment tạm, đã xoá hẳn): collection không phải fork trả 404 `FORK_NOT_FOUND`; fork, trạng thái và số fork đúng; hai bên cùng sửa URL ra một xung đột, pull không chọn trả 409, lựa chọn hay tuỳ chọn lạ trả 400; pull giữ bản fork; "merge and delete" mang thay đổi sang nguồn, xoá fork (404), changelog ghi `merge`; fork environment chép secret cho Editor, xem trước không chứa giá trị secret nào, merge mang `baseUrl`, giữ `token` của nguồn, biến `constructor` merge đúng; giới hạn `fork` trả 429 ở lượt thứ 11 trong một phút; nút Fork và panel Forks hiện trên giao diện. **Kết luận: SAST và DAST đều đạt, fork, pull, merge vận hành được.**
- Chưa kiểm được trên production: quy tắc Viewer chỉ fork vào workspace cá nhân (cần tài khoản thứ hai; đã có test tích hợp).

### Vòng 46: thiết kế đợt B2 phase 14, pull request (2026-10-16, user: "đồng ý deploy, xong làm tiếp đợt B2", Jev quyết)
- Diff của pull request tính trực tiếp mỗi lần xem từ fork, nguồn và gốc chung, như bản xem trước merge (0,92; lưu snapshot lúc mở 0,08). "Pull updates" là pull sẵn có vào fork.
- Reviewer là người có vai trò Editor ở collection nguồn (0,73). Chỉ reviewer được duyệt hay từ chối (0,72).
- Không bắt buộc duyệt mới merge: Editor của nguồn merge được pull request đang mở, duyệt chỉ là tín hiệu, như Postman (0,83).
- Một fork được có nhiều pull request đang mở (noul 0,24).
- Thông báo cốt lõi (0,96): reviewer khi pull request mở; tác giả khi được duyệt, bị từ chối hoặc đã merge; comment thông báo như comment hiện có.

### Vòng 46b: đợt B2 lên production và DAST (2026-10-17, user: "đồng ý deploy B2 rồi chạy DAST")
- Release `20261016-232319-9bfd1b26afad` (commit `9bfd1b2`, không `-dirty`), backup `localman-20261017-062315` trước deploy; `localman-api` restarts 38 → 39 (đúng lần reload của deploy), không log lỗi; index tenant của `pull_requests` đã dựng.
- DAST bằng phiên đăng nhập thật (workspace, collection, fork tạm, đã xoá hẳn): mở PR từ collection không phải fork trả 404 `FORK_NOT_FOUND`; tiêu đề rỗng, quá dài, reviewer dạng object `$ne`, quyết định lạ, tuỳ chọn merge lạ trả 400; reviewer không phải Editor trả 400 `INVALID_REVIEWER`; tự đặt mình làm reviewer được bỏ đi lặng lẽ (PR mở với 0 reviewer, đúng thiết kế); id lạ trả 404 `PULL_REQUEST_NOT_FOUND`; người không phải reviewer duyệt trả 403; thay đổi mang `key` theo id của nguồn; comment trên một thay đổi nằm ở thread của PR, không lẫn vào comment collection; merge mang URL của fork sang nguồn, giữ fork; merge lại hay sửa PR đã merge trả 409 `PULL_REQUEST_CLOSED`; xoá hẳn nguồn xoá luôn PR và comment của nó (Mongo đếm 0). Giao diện: liên kết `?pr=` mở đúng dialog, panel Pull request liệt kê PR, tiêu đề `<img onerror>` hiện như chữ, không chạy script. **Kết luận: SAST và DAST đều đạt, pull request vận hành được.**
- Chưa kiểm được trên production: duyệt/từ chối và thông báo giữa hai tài khoản (cần tài khoản thứ hai; đã có test tích hợp).

### Verification
Repo đích chưa tồn tại nên không có claim nào về code để kiểm. Path và module của `localman` được dẫn ở phase 10 đã đối chiếu với `localman/docs/codebase-summary.md` và cây thư mục `localman/client/src`.

## Câu hỏi mở
