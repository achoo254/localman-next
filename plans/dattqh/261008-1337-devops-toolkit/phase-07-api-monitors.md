---
phase: 7
title: "Giám sát API theo lịch, cảnh báo, status page"
status: pending
priority: P3
effort: "M"
dependencies: [2]
---

# Phase 07: Giám sát API

> Jev 0.53, sát ngưỡng: làm sau cùng, có thể lùi.

## Goal
Chạy collection theo lịch từ server Localman (dùng runner của phase 02, request qua proxy của Localman phase 10, gồm cả Tunelo cho service nội bộ). Gặp lỗi thì cảnh báo qua Telegram, Web Push, Slack hoặc Discord, **không dùng email**. Có status page công khai.

## Thiết kế
- **Monitor:** `{collection|folder, env, schedule (cron, tối thiểu monitorIntervalMin), timeoutMs, alertAfterFailures, channels[]}`.
  - Chạy bằng hàng đợi trên Mongo; worker là một container riêng trong monorepo (`apps/monitor-worker`).
  - Kết quả lưu 30 ngày; tính thời gian phản hồi p50/p95 và tỉ lệ uptime.
- **Cảnh báo:** khi chuyển trạng thái (`ok` sang `failing`, và ngược lại), gửi một tin qua `notification-service` của Localman phase 02, cộng webhook Slack hoặc Discord theo workspace. Có chống spam: không cảnh báo lặp lại trong 30 phút.
- **Status page:** `https://localman.hoandat.com/status/<slug>` hiện các monitor được chọn, uptime 90 ngày và sự cố gần nhất. Trang chỉ đọc, không lộ URL hay biến.
- **Hạn mức:** `monitors` và `monitorIntervalMin` trong `plan-limits` (chốt ở phase 02).

## Files to Create / Modify
- `apps/monitor-worker/src/` (`scheduler.ts`, `run-monitor.ts` dùng `packages/runner`, `alerting.ts`)
- `apps/api/src/modules/monitors/` (model, routes, `uptime-aggregator.ts`)
- `apps/web/src/features/monitors/`, `apps/web/src/pages/status-page.tsx`

## Verification
- Mọi operation của phase này có MCP tool trong toolset tương ứng (`pnpm check:mcp-coverage`); tool phá huỷ có dry-run kèm `confirm_token`.
- Monitor fail 2 lần liên tiếp thì có đúng một cảnh báo Telegram (dùng mock Bot API); khi phục hồi thì có một tin "đã ổn". Không có cảnh báo lặp trong 30 phút.
- Uptime tính đúng với dữ liệu mẫu. Status page không lộ URL hay biến.
- Worker chết giữa chừng: job được nhận lại, không chạy trùng (có lock theo `monitorId` và slot thời gian).

## Giao việc
**Đợt:** 9 · **Phụ thuộc trước khi bắt đầu:** DevOps phase 02 (`packages/runner`, `plan-limits` có `monitors` và `monitorIntervalMin`) đã merge; Localman phase 02 (`notification-service`) và phase 10 (proxy) đã merge. Jev cho 0.53, có thể lùi · **Lệnh cook:** `/ak:cook plans/dattqh/261008-1337-devops-toolkit/phase-07-api-monitors.md`

| # | Việc | Vai trò | Song song | File chính |
|---|---|---|---|---|
| T1 | Model monitor `{collection hoặc folder, env, schedule, timeoutMs, alertAfterFailures, channels[]}`, CRUD qua operation trong toolset `devops` (xoá có dry-run kèm `confirm_token`); lịch không dưới `monitorIntervalMin`; áp hạn mức `monitors` | fullstack-developer | — | `apps/api/src/modules/monitors/` (model, routes) |
| T2 | Worker `apps/monitor-worker`: hàng đợi trên Mongo, lock theo `monitorId` và slot thời gian, worker chết giữa chừng thì job được nhận lại mà không chạy trùng | fullstack-developer | Song song với T5 (sau T1) | `apps/monitor-worker/src/scheduler.ts` |
| T3 | Chạy monitor bằng `packages/runner`, request qua proxy của Localman (gồm Tunelo cho service nội bộ), lưu kết quả 30 ngày | fullstack-developer | — (sau T2) | `apps/monitor-worker/src/run-monitor.ts` |
| T4 | Cảnh báo khi đổi trạng thái `ok` và `failing`: gửi qua `notification-service` (trong app, Web Push, Telegram) cộng webhook Slack hoặc Discord theo workspace; không lặp cảnh báo trong 30 phút | fullstack-developer | Song song với T3 (sau T2) | `apps/monitor-worker/src/alerting.ts` |
| T5 | Tổng hợp p50, p95 thời gian phản hồi và tỉ lệ uptime | fullstack-developer | Song song với T2 | `apps/api/src/modules/monitors/uptime-aggregator.ts` |
| T6 | Tool `run_collection` chạy runner phía server, dùng chung worker với monitor, request qua proxy, có tính hạn mức (theo mục MCP của plan) | fullstack-developer | — (sau T3) | `apps/monitor-worker/src/`, `apps/api/src/modules/runs/` |
| T7 | Web: trang Monitors (tạo, sửa, lịch sử, uptime) theo prototype `devops.html` màn `#/monitors`; status page công khai `/status/<slug>` chỉ đọc, uptime 90 ngày, sự cố gần nhất, không lộ URL hay biến, theo màn `#/status/demo` | fullstack-developer | Song song với T6 (sau T1, T5) | `apps/web/src/features/monitors/`, `apps/web/src/pages/status-page.tsx` |
| T8 | Thêm container `monitor-worker` vào Docker Compose của Localman và deploy (cần user xác nhận) | fullstack-developer (hạ tầng) | — (sau T9) | Docker Compose của Localman, VPS |
| T9 | Test: fail 2 lần liên tiếp thì đúng một cảnh báo Telegram (Bot API giả), phục hồi thì một tin "đã ổn", không lặp trong 30 phút; uptime đúng với dữ liệu mẫu; status page không lộ URL hay biến; worker chết giữa chừng thì job được nhận lại, không chạy trùng | tester | — (sau T3–T7) | test của `apps/monitor-worker`, `apps/api/src/modules/monitors/`, `apps/web` |
| T10 | Review cuối phase | code-reviewer | — | toàn phase |

### Checklist
- [ ] T1 Model và operation monitor, áp hạn mức và lịch tối thiểu
- [ ] T2 Scheduler có lock, nhận lại job khi worker chết
- [ ] T3 Monitor chạy qua runner và proxy, lưu 30 ngày
- [ ] T4 Cảnh báo theo chuyển trạng thái, chống spam 30 phút
- [ ] T5 p50, p95 và uptime đúng
- [ ] T6 `run_collection` phía server có tính hạn mức
- [ ] T7 Trang Monitors và status page khớp prototype
- [ ] T8 Worker chạy trên VPS sau khi user xác nhận
- [ ] T9 Test pass
- [ ] T10 Review không còn finding mức high
- [ ] Verification: đúng một cảnh báo khi fail 2 lần và một tin khi phục hồi; uptime đúng; status page không lộ dữ liệu; không chạy trùng khi worker chết; tool phá huỷ có dry-run kèm `confirm_token`
- [ ] lint/typecheck/test sạch: `biome check`, `tsc --noEmit`, test của `apps/monitor-worker`, `apps/api`, `apps/web`
- [ ] `pnpm check:mcp-coverage` pass
