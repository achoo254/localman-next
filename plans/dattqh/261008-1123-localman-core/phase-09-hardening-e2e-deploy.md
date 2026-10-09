---
phase: 9
title: "Hardening, E2E, deploy"
status: pending
priority: P1
effort: "M"
dependencies: [5, 6, 7, 8]
---

# Phase 09: Hardening, E2E, deploy

## Goal
Đưa sản phẩm lên staging: có DNS wildcard và TLS, E2E cho các luồng chính, quét bảo mật, và docs vận hành.

## Files to Create / Modify
- Create `e2e/playwright.config.ts`, `e2e/specs/signup-to-first-api-call.spec.ts`, `e2e/specs/nested-resources.spec.ts`, `e2e/specs/plan-limits.spec.ts`, `e2e/specs/collaboration.spec.ts`
- Create `apps/api/Dockerfile`, `apps/web/Dockerfile` (hoặc build static), `deploy/compose.staging.yml`
- Create `apps/api/scripts/cleanup-abandoned-projects.ts` (project của user Free không có request nào trong N ngày; chạy dry-run trước)
- Create `README.md`, `docs/system-architecture.md`, `docs/deployment-guide.md`, `docs/api-contract.md` (hợp đồng mock runtime)

## Tasks & Steps
1. E2E luồng chính: signup, tạo project, tạo resource `users` + child `posts`, generate, rồi `fetch` từ trang thử để gọi API mock.
2. Chạy `/ak:security` trên toàn repo. Ưu tiên: template engine, query engine, OAuth state, cookie flags, rate-limit, CORS của dashboard (chỉ cho phép origin app, khác runtime mở `*`).
3. Hạ tầng: VPS riêng chạy Docker Compose, Cloudflare quản lý DNS và TLS (Jev chọn):
   - **Cloudflare DNS** (zone `hoandat.com`):
     - `localman` và `auth` để proxied: Universal SSL miễn phí phủ được tên miền một cấp.
     - `*.localman` để **DNS only**, vì Universal SSL miễn phí không phủ wildcard hai cấp.
   - **TLS cho `*.localman.hoandat.com`:** wildcard Let's Encrypt cấp bằng `certbot --dns-cloudflare`, giống cách làm của `*.tunnel.hoandat.com` (dùng chung token Cloudflare `Zone:DNS:Edit`), nginx giữ TLS và tự gia hạn. Chặn các subdomain dành riêng (`www`, `api`, `app`, `admin`, `mail`) không cho làm secret.
   - MongoDB replica set để transaction chạy được. Nếu Localman chạy trên .65 như IdP: mongod native ở đó đang là standalone (auth bật, dùng chung cho ~10 app), phải chuyển sang single-node replica set (`replication.replSetName` + `rs.initiate`, cần keyFile vì auth bật). Việc này restart mongod, các app khác gián đoạn vài giây; backup toàn bộ trước, báo user trước khi làm. Từ phase 04 generate dữ liệu chạy trong transaction nên không có replica set thì Localman không chạy được.
   - Backup Mongo hằng ngày.
   - Dọn tombstone xoá project: lúc khởi động (hoặc job định kỳ), tiếp tục dọn các project có `deletingAt` cũ hơn vài phút, để project xoá dở do lỗi không chiếm hạn mức mãi (phase 04, ADR-0001).
   - **IP client thật cho rate-limit** (review phase 02): `/auth/login` giới hạn theo IP, nên `TRUST_PROXY` phải đúng topo thật. Nếu deploy theo quy ước của server .65 như IdP (pm2 + nginx cùng máy, real-IP của Cloudflare đặt ở cấp `http` của nginx) thì `TRUST_PROXY=127.0.0.1` và nginx chuyển `X-Forwarded-For $remote_addr`. Nếu dùng Docker Compose thì đặt đúng địa chỉ container nginx (không tin cả dải mạng) và cấu hình `set_real_ip_from` cho dải IP Cloudflare; thiếu bước này thì mọi user dùng chung một quota đăng nhập. Chốt khi bắt đầu phase này.
   - **Một process API duy nhất** (phase 07): dashboard và mock runtime chạy chung một process (`apps/api/src/main.ts`). Rate-limit, bộ đếm quota tháng và cache LRU của `resolve-project` nằm trong bộ nhớ; xoay secret hay đổi prefix chỉ xoá cache của chính process đó. Vì vậy pm2 chạy `exec_mode: fork`, `instances: 1`; muốn scale ngang thì phải chuyển các trạng thái này sang store chung trước.
   - **URL mock dự phòng** (phase 08): trang docs ghi `https://localman.hoandat.com/m/{secret}{prefix}` (hằng `MOCK_URL_FALLBACK` trong `apps/web/src/pages/docs/docs-pages.ts`). nginx của host chính phải chuyển `/m/` sang cổng mock 4100; nếu không làm thì sửa hằng đó cho khớp.
   - **nginx cho mock runtime** (review phase 05):
     - Ghi đè hoặc xoá `X-Forwarded-Host` (`proxy_set_header X-Forwarded-Host "";` hoặc `$host`) để client không giả được host: mock runtime đọc secret từ `req.hostname`, mà Express tin `X-Forwarded-Host` khi tin proxy. Đặt `X-Forwarded-For $remote_addr` (sau `set_real_ip_from` của Cloudflare nếu có) để rate limit theo IP thấy IP thật.
     - Fallback `/m/{secret}` phục vụ ở host không thuộc `*.MOCK_BASE_DOMAIN` (ví dụ `localman.hoandat.com/m/...`): định tuyến `location /m/` của host chính tới cổng 4100, hoặc ghi rõ là chỉ dùng ở local nếu không mở.
     - `limit_req` và `limit_conn` toàn cục ở nginx cho `*.localman.hoandat.com` và `/m/` (theo IP), chặn dò secret hàng loạt trước khi tới Node; rate limit trong process chỉ đếm theo secret và IP sau khi request đã vào.
   - Secret của kênh thông báo: `TELEGRAM_BOT_TOKEN` (bot **riêng** `@localman_hoandat_bot`; bot chỉ gửi tin, không có webhook nên không cần `TELEGRAM_WEBHOOK_SECRET` hay `setWebhook` — chat của user đến từ liên kết Telegram ở IdP), `OWNER_TELEGRAM_CHAT_ID`, `VAPID_PUBLIC_KEY` và `VAPID_PRIVATE_KEY` (sinh bằng `web-push generate-vapid-keys`, hoặc dùng project FCM sẵn có). Owner bấm Start với bot một lần để lấy `OWNER_TELEGRAM_CHAT_ID`. Không có SMTP.
   - **Turnstile và CSP** (review phase 03): CSP của web phải cho `https://challenges.cloudflare.com` ở `script-src` và `frame-src`; production bắt buộc `TURNSTILE_SITE_KEY`/`TURNSTILE_SECRET_KEY`, và `PUBLIC_URL` phải đúng host công khai vì server so `hostname` của token với nó.
   - **Script inline trong `apps/web/index.html`** (phase 08): script đặt theme trước khi vẽ và script xoá markup prerender của landing trên các path khác `/`. CSP `script-src` phải có hash `sha256-…` của cả hai (tính từ `dist/index.html` sau build, vì minify có thể đổi nội dung), không dùng `'unsafe-inline'`.
   - **CGNAT di động** (review phase 03): rate limit form công khai theo IP (IPv6 gộp /64) có thể chặn nhầm nhiều người sau một IP nhà mạng; theo dõi 429 `RATE_LIMITED` sau khi mở form rồi chỉnh `feedbackRateLimit.perIp` nếu cần.
   - **MCP không có `clientIp`** (review phase 03): `OperationContext.clientIp` chỉ có qua HTTP; khi dựng MCP server (phase 17) phải truyền địa chỉ thật hoặc `null`, và mọi rate limit theo IP phải có hạn mức theo token/tài khoản thay thế.
4. Observability: log JSON có `requestId`, đếm request theo project (phục vụ hạn mức và cleanup về sau).
5. Docs: cập nhật đúng các mục trên, link tới script và manifest thay vì chép nội dung.

## Verification
- `pnpm test && pnpm e2e` pass trên CI (giới hạn worker bằng `--workers=2`).
- `/ak:security` không còn finding mức high hoặc critical.
- Staging: chạy `curl https://{secret}.localman.hoandat.com/users` trả dữ liệu; vượt rate-limit trả 429.

## Follow-up (ngoài plan này)
- Plan billing: chọn cổng thanh toán (SePay/VietQR hoặc Stripe), checkout, webhook, gia hạn, hạ gói, hoá đơn.

## Giao việc
**Đợt:** 2 · **Phụ thuộc trước khi bắt đầu:** phase 05, 06, 07, 08; IdP đã chạy ở `auth.hoandat.com` (Đợt 0) · **Lệnh cook:** `/ak:cook plans/dattqh/261008-1123-localman-core/phase-09-hardening-e2e-deploy.md`

| # | Việc | Vai trò | Song song | File chính |
|---|---|---|---|---|
| T1 | Playwright config và 4 spec: `signup-to-first-api-call` (signup qua IdP local, tạo project, `users` + child `posts`, generate, `fetch` API mock), `nested-resources`, `plan-limits`, `collaboration`; chạy với `--workers=2` | tester | với T2, T3 | `e2e/playwright.config.ts`, `e2e/specs/*.spec.ts` |
| T2 | `cleanup-abandoned-projects.ts` (project Free không có request trong N ngày, mặc định dry-run) và observability: log JSON có `requestId`, đếm request theo project | fullstack-developer | với T1, T3 | `apps/api/scripts/cleanup-abandoned-projects.ts`, `apps/api/src/http/*` |
| T3 | `apps/api/Dockerfile`, `apps/web/Dockerfile` (hoặc build static), `deploy/compose.staging.yml` (hai server, Mongo replica set, nginx giữ TLS wildcard), script backup Mongo hằng ngày, `.env.example` đủ biến kênh thông báo (không có SMTP); nginx chặn subdomain dành riêng `www`, `api`, `app`, `admin`, `mail` | fullstack-developer | với T1, T2 | `apps/api/Dockerfile`, `apps/web/Dockerfile`, `deploy/*`, `.env.example` |
| T4 | Chạy `/ak:security` trên toàn repo, ưu tiên template engine, query engine, OAuth state, cookie flags, rate-limit và CORS dashboard; lập danh sách finding high/critical | code-reviewer | — (sau T1–T3) | toàn repo |
| T5 | Sửa mọi finding high/critical của T4; CORS dashboard chỉ cho origin app, runtime giữ `*` | fullstack-developer | — (sau T4) | theo finding |
| T6 | Viết `README.md`, `docs/system-architecture.md`, `docs/deployment-guide.md`, `docs/api-contract.md`; link tới script và manifest thay vì chép nội dung | docs-manager | với T4, T5 | `README.md`, `docs/*` |
| T7 | Hạ tầng Cloudflare và secret: record `localman` và `auth` proxied, `*.localman` DNS only; cấp wildcard `*.localman.hoandat.com` bằng `certbot --dns-cloudflare`; tạo bot Telegram riêng qua @BotFather; sinh VAPID; đặt secret trên VPS **(cần user xác nhận)** | fullstack-developer | với T4–T6 | Cloudflare zone `hoandat.com`, VPS |
| T8 | Deploy production lên .65 bằng `infra/localman/deploy.sh` (pm2 + nginx, mongod riêng 27018 — Vòng 24), bật backup Mongo **(cần user xác nhận)** | fullstack-developer | — (sau T5, T7) | VPS staging |
| T9 | Chạy `pnpm test && pnpm e2e` trên CI (`--workers=2`); trên staging `curl https://{secret}.localman.hoandat.com/users` trả dữ liệu và vượt rate-limit trả 429; chạy lại `/ak:security` xác nhận không còn high/critical | tester | — (sau T8) | CI, staging |
| T10 | Review cuối phase | code-reviewer | — | toàn phase |

### Checklist
- [x] T1 Playwright và 4 spec E2E xong
- [x] T2 Script cleanup dry-run và observability xong
- [x] T3 Hạ tầng deploy, backup và env production xong. Đã đổi theo Vòng 24: pm2 + nginx trên .65 thay cho Dockerfile/compose, mongod riêng `rs-localman` ở 127.0.0.1:27018; file ở `infra/localman/` (setup mongod/server, cert wildcard, nginx, ecosystem, deploy, backup, `.env.production.example`) và `docs/deployment-guide.md`; bundle API có thêm `dist/cleanup-abandoned-projects.mjs`
- [ ] T4 Đã chạy `/ak:security` và có danh sách finding
- [x] T5 Finding high/critical đã sửa. Theo `plans/dattqh/reports/security-phase-09-audit.md`: H1 (một field quan hệ mỗi nguồn khi lưu; runtime mỗi nguồn một truy vấn, kiểm `dataBytes` trước khi nạp, đọc theo ngân sách rồi 422), H2 (dấu `member_removals`, mã `REMOVED_BY_OWNER`), M1 (`heavyOperationRateLimit`), M3 (`HOST`, production `127.0.0.1`), Low thuộc app (L1 quét tính vào ngân sách byte, L2 `AMBIGUOUS_USERNAME`, L4 rate limit callback và route server-to-server, L5 `query-coercion`). M2 chờ user quyết; Low hạ tầng/CI để review infra
- [ ] T6 README và docs vận hành xong
- [ ] T7 DNS, TLS wildcard, bot Telegram, VAPID và secret đã đặt sau khi user xác nhận
- [ ] T8 Staging đã deploy và webhook Telegram đã đăng ký sau khi user xác nhận
- [ ] T9 CI và kiểm staging pass
- [ ] T10 Review không còn finding chặn
- [ ] Verification: `pnpm test && pnpm e2e` pass trên CI với `--workers=2`
- [ ] Verification: `/ak:security` không còn finding high hoặc critical
- [ ] Verification: `curl https://{secret}.localman.hoandat.com/users` trên staging trả dữ liệu; vượt rate-limit trả 429
- [ ] `pnpm lint && pnpm typecheck && pnpm test` sạch
- [ ] `pnpm check:mcp-coverage` pass
