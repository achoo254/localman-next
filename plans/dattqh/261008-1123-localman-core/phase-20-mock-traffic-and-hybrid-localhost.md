---
phase: 20
title: "Mock lai localhost, log request có replay, webhook inbox về localhost, mock callback"
status: pending
priority: P1
effort: "L"
dependencies: [5, 10]
blockedBy: ["plans/dattqh/261008-1156-tunelo-accounts-and-tunnel-list"]
---

# Phase 20: Mock lai localhost và traffic

> **Thứ tự chạy:** sau phase 10, khi đã có proxy và Tunelo theo tài khoản. Keyword mới **"Mock lai localhost"** (Jev 0.46, sát "Secret không rời trình duyệt" 0.42). Nguồn: `../reports/competitors/research-261008-1316-mock-tunnel-tools.md`.

## Goal
Nối mock, Tunelo và API client thành một luồng mà mockapi.io và Postman đều không có:
- **Mock lai localhost** (Jev 0.68): route đã khai báo trong mock thì trả dữ liệu mock; route **chưa có** thì chuyển tiếp vào tunnel Tunelo của owner (hoặc một base URL thật được duyệt). Frontend làm việc với một URL duy nhất: phần backend đã làm thì đi vào máy dev, phần chưa làm thì là mock. Hiện chỉ Beeceptor có tính năng này.
- **Log request có replay** (Jev 0.68): log live của mock runtime. Mỗi dòng có "Replay" và "Mở trong API client".
- **Webhook inbox về localhost** (Jev 0.56, sát ngưỡng, P3): URL công khai hứng webhook (từ Stripe, GitHub, SePay…), xem nội dung, tuỳ chọn forward vào tunnel về localhost. Postman không có; mockapi.io vẫn ghi "Coming soon".
- **Mock callback** (Jev 0.55, sát ngưỡng, P3): khi có CRUD trên resource thì mock bắn webhook ra URL đã cấu hình, gửi được vào tunnel.

## Hành vi (mọi dòng là tiêu chí nghiệm thu)

| Hạng mục | Hành vi |
|---|---|
| Upstream của mock lai | Mỗi project có `upstream`: `none` (mặc định), `tunnel:<localPort>` (tunnel của **chính owner**, tìm theo tài khoản như phase 10), hoặc `url:<https base>`. Với `url`, host phải qua bộ chặn SSRF của phase 10, và chỉ owner hay Editor mới đặt được |
| Quyết định chuyển tiếp | Path khớp resource hoặc endpoint đang bật thì là mock. Còn lại thì chuyển nguyên request (method, header trừ hop-by-hop, body) sang upstream. Response có header `X-Localman-Source: mock` hoặc `upstream` |
| Hạn mức | **Mọi** request đi vào mock runtime đều tính vào `mockRequestsPerMonth`, kể cả request được chuyển sang upstream, vì tất cả đều tốn băng thông của server |
| Upstream lỗi | Tunnel đã dừng (kể cả khi chính Tunelo trả 502/504) thì trả 502 theo dạng lỗi chung `{ error: { code: "UPSTREAM_UNAVAILABLE", message, hint: "tunelo http <port>" } }` |
| Log | Lưu 7 ngày ở gói Free, 30 ngày ở Pro (`plan-limits.requestLogDays`). Mỗi dòng có thời gian, method, path, status, thời gian xử lý, nguồn (mock, upstream hay rule), header và body (cắt ở 64 KB). **Header nhạy cảm bị che** (`authorization`, `cookie`, `x-api-key`, cộng danh sách tuỳ chỉnh) |
| Live | Cập nhật live qua SSE trên trang project; lọc theo method, status và path |
| Replay | "Replay" gửi lại đúng request vào mock (tính vào hạn mức). "Mở trong API client" tạo tab request ở phase 10 |
| Webhook inbox | `https://{secret}.localman.hoandat.com/_inbox/<name>`. Hứng mọi method, trả 200 tuỳ chỉnh được. Tuỳ chọn forward tới `tunnel:<port><path>` kèm thử lại 3 lần. Áp cùng log, che header và hạn mức |
| Mock callback | Mỗi resource có `callbacks:[{on:create|update|delete, url|tunnel, bodyTemplate, headers}]`. Gửi bất đồng bộ qua hàng đợi Mongo, thử lại có backoff, ghi kết quả vào log. URL qua bộ chặn SSRF |

## Files to Create / Modify
- Create `apps/api/src/modules/mock-runtime/upstream-forwarder.ts` (dùng chung bộ chặn SSRF và tìm tunnel của phase 10), `request-log-model.ts` (có TTL index), `request-log-service.ts` (ghi bất đồng bộ, gom theo lô), `log-stream-routes.ts` (SSE), `replay-service.ts`
- Create `apps/api/src/modules/webhook-inbox/` (model, routes, `forward-service.ts`) và `apps/api/src/modules/mock-callbacks/` (model, `dispatcher.ts`, `retry-queue.ts`)
- Modify `packages/shared/src/plan-limits.ts`: thêm `requestLogDays` (Free 7, Pro 30) và `webhookInboxes` (Free 2, Pro 20)
- Create `apps/web/src/features/request-log/` (bảng live, chi tiết, Replay, Mở trong API client), `apps/web/src/features/upstream/upstream-settings.tsx`, `apps/web/src/features/webhook-inbox/`, `apps/web/src/features/mock-callbacks/callbacks-editor.tsx`

## Verification
- Integration:
  - Mock có `users`, upstream là tunnel giả: `GET /users` ra từ mock; `GET /orders` chuyển sang upstream và có header `X-Localman-Source: upstream`.
  - Tunnel tắt thì nhận 502 kèm hint.
  - Upstream `url` trỏ vào IP private bị chặn.
- Log: header `authorization` bị che; quá TTL thì bị xoá; replay ra kết quả đúng.
- Inbox: POST vào inbox thì xuất hiện trong log và được forward vào tunnel giả; upstream lỗi thì thử lại 3 lần.
- Callback: tạo bản ghi thì callback được gửi với body render từ template.

## Giao việc
**Đợt:** 5 · **Phụ thuộc trước khi bắt đầu:** plan Tunelo `../261008-1156-tunelo-accounts-and-tunnel-list/` đã xong (đợt 4, có `GET /api/tunnels` theo tài khoản); phase 05 đã xong; phase 10 đã xong trong cùng đợt 5 (bộ chặn SSRF, tìm tunnel theo tài khoản, tab request để "Mở trong API client"). `plan-limits` đã có sẵn `requestLogDays` và `webhookInboxes` từ phase 01 với đúng giá trị, nên phase này chỉ dùng, không thêm lại · **Lệnh cook:** `/ak:cook plans/dattqh/261008-1123-localman-core/phase-20-mock-traffic-and-hybrid-localhost.md`

| # | Việc | Vai trò | Song song | File chính |
|---|---|---|---|---|
| T1 | Đối chiếu với prototype `prototype/index.html` `#/projects/demo`: tab Upstream (`.upstream-options`) và Request log (`request-log-*`, `log-detail`) của card endpoint. Prototype chưa có màn Webhook inbox và Mock callback: bổ sung hai màn này rồi trình user duyệt trước khi code UI (cần user xác nhận) | ui-ux-designer | với T2, T3 | `prototype/index.html` |
| T2 | Làm `upstream-forwarder`: path khớp resource hoặc endpoint đang bật thì là mock, còn lại chuyển nguyên method, header (trừ hop-by-hop) và body sang upstream; header `X-Localman-Source`; tìm tunnel của chính owner và chặn SSRF bằng code của phase 10; tunnel dừng trả 502 `UPSTREAM_UNAVAILABLE` kèm hint; mọi request tính vào `mockRequestsPerMonth`; operation đặt `upstream` (`url` chỉ owner hoặc Editor) | fullstack-developer | với T1, T3 | `apps/api/src/modules/mock-runtime/upstream-forwarder.ts`, project model và operation |
| T3 | Làm request log: `request-log-model` có TTL index theo `requestLogDays`, `request-log-service` ghi bất đồng bộ theo lô, cắt body ở 64 KB, che `authorization`, `cookie`, `x-api-key` và danh sách tuỳ chỉnh; `log-stream-routes` SSE có lọc method, status, path | fullstack-developer | với T1, T2 | `apps/api/src/modules/mock-runtime/request-log-model.ts`, `request-log-service.ts`, `log-stream-routes.ts` |
| T4 | Nối forwarder và ghi log vào pipeline của mock runtime; làm `replay-service` (gửi lại vào mock, tính hạn mức) và payload "Mở trong API client"; khai báo operation toolset `traffic` | fullstack-developer | — | `apps/api/src/modules/mock-runtime/replay-service.ts`, `apps/api/src/mock-server.ts` |
| T5 | Làm webhook inbox: `https://{secret}.localman.hoandat.com/_inbox/<name>` hứng mọi method, response 200 tuỳ chỉnh, forward tuỳ chọn tới `tunnel:<port><path>` thử lại 3 lần, áp log, che header, hạn mức `webhookInboxes` | fullstack-developer | với T6 | `apps/api/src/modules/webhook-inbox/` |
| T6 | Làm mock callback: `callbacks[]` theo resource (create, update, delete), `dispatcher` gửi bất đồng bộ qua hàng đợi Mongo, `retry-queue` có backoff, body render từ template, URL qua bộ chặn SSRF, ghi kết quả vào log | fullstack-developer | với T5 | `apps/api/src/modules/mock-callbacks/` |
| T7 | Làm UI request log (bảng live, chi tiết, Replay, Mở trong API client) và `upstream-settings`; task này sở hữu `api-endpoint-card.tsx` để thêm các tab Upstream, Request log và Inbox | fullstack-developer | với T8 | `apps/web/src/features/request-log/`, `apps/web/src/features/upstream/upstream-settings.tsx`, `apps/web/src/pages/project-detail/api-endpoint-card.tsx` |
| T8 | Làm UI webhook inbox và `callbacks-editor` theo màn đã duyệt ở T1, chỉ trong thư mục riêng | fullstack-developer | với T7 | `apps/web/src/features/webhook-inbox/`, `apps/web/src/features/mock-callbacks/callbacks-editor.tsx` |
| T9 | Viết integration test: `GET /users` ra từ mock và `GET /orders` sang upstream có `X-Localman-Source: upstream`; tunnel tắt nhận 502 kèm hint; upstream `url` trỏ IP private bị chặn; `authorization` bị che, quá TTL bị xoá, replay đúng; inbox forward vào tunnel giả và thử lại 3 lần khi lỗi; callback gửi body render từ template | tester | — | test trong `apps/api/src/modules/mock-runtime/`, `webhook-inbox/`, `mock-callbacks/` |
| T10 | Deploy staging và bật cờ `features.hybridMock` để landing quảng bá "Mock lai localhost" (cần user xác nhận) | fullstack-developer | — | `deploy/compose.staging.yml`, cấu hình cờ tính năng |
| T11 | Review cuối phase, chú trọng SSRF, che header và tính hạn mức | code-reviewer | — | toàn phase |

### Checklist
- [x] T1 Spec Upstream và Request log chốt theo prototype; màn Inbox và Callback đã thêm (`plans/dattqh/reports/ui-phase-20-traffic-spec.md`), làm luôn không chờ duyệt theo Vòng 28
- [x] T2 Forwarder, header nguồn, 502 kèm hint, SSRF, hạn mức
- [x] T3 Request log có TTL, che header, cắt body, SSE có lọc
- [x] T4 Pipeline mock runtime ghi log, replay, "Mở trong API client"
- [x] T5 Webhook inbox có forward và thử lại 3 lần
- [x] T6 Mock callback qua hàng đợi, có backoff và SSRF
- [x] T7 UI request log, upstream và các tab trên card endpoint
- [x] T8 UI inbox và callback
- [x] T9 Integration pass
- [ ] T10 Staging deploy và cờ `features.hybridMock` bật sau khi user xác nhận
- [x] T11 Review không còn finding mức high (`plans/dattqh/reports/review-phase-20-traffic.md`: 1 Critical, 4 High, 7 Medium đã sửa: CSP sandbox + nosniff trên mọi response mock và `/m/` ở nginx, inbox chỉ JSON/text, allowlist header upstream, không gửi cookie sang upstream, nhận diện 502 của Tunelo, chặn `%2e%2e`, buffer log 32 MB và 20.000 dòng/project, hàng đợi chia slot theo owner với trần 200 job chờ, callback/forward tính quota, thứ tự shutdown trong 10 s. Còn mở: L3 ký HMAC callback, L8 job đã xếp hàng vẫn gửi khi callback bị tắt)
- [x] Verification: mock và upstream tách đúng, có `X-Localman-Source`; tunnel tắt trả 502 kèm hint; IP private bị chặn
- [x] Verification: log che `authorization`, xoá khi quá TTL, replay đúng
- [x] Verification: inbox forward và thử lại 3 lần; callback gửi body từ template
- [ ] `pnpm lint && pnpm typecheck && pnpm test` sạch
- [ ] `pnpm check:mcp-coverage` pass
