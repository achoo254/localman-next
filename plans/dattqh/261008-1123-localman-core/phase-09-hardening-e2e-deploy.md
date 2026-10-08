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
   - MongoDB replica set để transaction chạy được.
   - Backup Mongo hằng ngày.
   - Secret của kênh thông báo: `TELEGRAM_BOT_TOKEN` (một bot **riêng** cho Localman, tạo qua @BotFather), `TELEGRAM_WEBHOOK_SECRET`, `OWNER_TELEGRAM_CHAT_ID`, `VAPID_PUBLIC_KEY` và `VAPID_PRIVATE_KEY` (sinh bằng `web-push generate-vapid-keys`, hoặc dùng project FCM sẵn có). Đăng ký webhook bằng `setWebhook` sau khi deploy. Không có SMTP.
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
| T8 | Deploy staging bằng `deploy/compose.staging.yml`, đăng ký webhook Telegram bằng `setWebhook`, bật backup Mongo **(cần user xác nhận)** | fullstack-developer | — (sau T5, T7) | VPS staging |
| T9 | Chạy `pnpm test && pnpm e2e` trên CI (`--workers=2`); trên staging `curl https://{secret}.localman.hoandat.com/users` trả dữ liệu và vượt rate-limit trả 429; chạy lại `/ak:security` xác nhận không còn high/critical | tester | — (sau T8) | CI, staging |
| T10 | Review cuối phase | code-reviewer | — | toàn phase |

### Checklist
- [ ] T1 Playwright và 4 spec E2E xong
- [ ] T2 Script cleanup dry-run và observability xong
- [ ] T3 Dockerfile, compose staging, backup và `.env.example` xong
- [ ] T4 Đã chạy `/ak:security` và có danh sách finding
- [ ] T5 Finding high/critical đã sửa
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
