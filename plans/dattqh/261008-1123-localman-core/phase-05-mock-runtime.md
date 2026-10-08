---
phase: 5
title: "Mock runtime công khai"
status: pending
priority: P1
effort: "L"
dependencies: [4]
---

# Phase 05: Mock runtime công khai

## Goal
Viết `mock-server.ts` phục vụ REST API công khai đúng hợp đồng của nguồn (báo cáo §2.2) trên `{secret}.localman.hoandat.com{prefix}`, có fallback `/m/:secret{prefix}`, an toàn khi mở ra internet.

## Files to Create / Modify
- Create `apps/api/src/modules/mock-runtime/`: `resolve-project.ts` (lấy secret từ Host hoặc path, bỏ prefix, cache LRU 60 giây), `route-matcher.ts` (tách path thành chuỗi `[res, id?, childRes, id?…]` theo cây resource), `query-engine.ts` (search/filter/field filter/page/limit/sort), `crud-handlers.ts`, `render-response.ts` (dùng `json-template`), `rate-limit.ts`
- Modify `apps/api/src/mock-server.ts`: gắn CORS `*` cùng preflight, giới hạn body 100 KB, rate-limit, router catch-all

## Tasks & Steps
1. **Phân giải route.** Hỗ trợ cả route phẳng `/:res[/:id]` lẫn route lồng `/:parent/:pid/:child[/:cid]` với độ sâu tuỳ ý theo cây. Route lồng lọc theo `parentRecordId`, route phẳng trả toàn bộ.
2. **CRUD:**
   - GET list trả mảng. GET one trả object hoặc 404 `"Not found"`.
   - POST gán `id = nextId++`, lưu body, và field có trong schema mà body thiếu thì sinh bằng Faker (Jev chọn, độ tin cậy thấp 0.16; muốn đảo thì sửa một chỗ trong `crud-handlers.ts`), route lồng thì gán `{parent}Id`, trả 201.
   - PUT và PATCH merge body vào bản ghi, không cho đổi `id`.
   - DELETE trả bản ghi đã xoá và xoá cascade bản ghi con.
3. **Query** (giống nguồn):
   - `search` và `filter` khớp chuỗi con, không phân biệt hoa thường, trên mọi field chuỗi.
   - `<field>=v` khớp theo field có trong schema, giá trị ép kiểu theo schema. Khi có nhiều field thì kết hợp AND.
   - `page`/`p` và `limit`/`l`. Không có `limit` thì trả tất cả. `limit` tối đa 100.
   - `sortBy`/`sortby`/`orderBy`/`orderby` cùng `order=asc|desc`, mặc định asc.
   - Mọi key bắt đầu bằng `$` hoặc chứa `.` đều bị từ chối, để chặn NoSQL injection.
4. **Endpoint tắt** trả 404. **Response tuỳ chỉnh** render template kèm `$count`; `$count` là tổng bản ghi sau khi filter, trước khi phân trang (Jev chọn).
5. **Giới hạn:**
   - Rate-limit 60 request/giây theo secret và 30 request/giây theo IP, cấu hình qua env, trả 429.
   - Hạn mức tháng theo **chủ project**: lấy `mockRequestsPerMonth` từ `plan-limits` (Free 10.000; Pro `null` là không giới hạn tháng). Đếm bằng bộ đếm theo tháng (Mongo `$inc` theo `ownerId` + `yyyymm`, flush mỗi 5 giây). Vượt hạn mức trả 429 với `{error:{code:"MONTHLY_QUOTA_EXCEEDED"}}`, và trang Account hiện cảnh báo.
   - POST chặn khi số bản ghi chạm `MAX_RECORDS_PER_RESOURCE` (mặc định 1000; generator vẫn dừng ở 100).
   - Body tối đa 100 KB.
6. **Header:** `Content-Type: application/json` và `X-Localman-Request-Id`. Không trả stack trace ra ngoài.

## Verification
- Bộ contract test (supertest) chạy lại toàn bộ ví dụ trong wiki nguồn: Quick start, Code examples và Custom responses. Mỗi ví dụ khớp status và shape.
- Test bảo mật: query `?title[$ne]=x`, `?$where=1`, `sortBy=__proto__`, template `$constructor.constructor` đều phải bị từ chối hoặc trả rỗng an toàn.
- Load nhanh bằng `autocannon` trong 30 giây: 429 xuất hiện khi vượt ngưỡng, p95 dưới 50 ms khi dưới ngưỡng (Mongo local).
- Thủ công: chạy `curl` qua cả `{secret}.localtest.me:4100` lẫn `localhost:4100/m/{secret}`.

## Giao việc
**Đợt:** 2 · **Phụ thuộc trước khi bắt đầu:** phase 04 (resource, record, `json-template`); bộ đếm tháng ở `billing` (phase 03) · **Lệnh cook:** `/ak:cook plans/dattqh/261008-1123-localman-core/phase-05-mock-runtime.md`

| # | Việc | Vai trò | Song song | File chính |
|---|---|---|---|---|
| T1 | `resolve-project.ts` (secret lấy từ Host hoặc `/m/:secret`, bỏ prefix, cache LRU 60 giây) và `route-matcher.ts` (route phẳng và route lồng độ sâu tuỳ ý theo cây resource) kèm unit | fullstack-developer | với T2 | `apps/api/src/modules/mock-runtime/{resolve-project,route-matcher}.ts` |
| T2 | `query-engine.ts`: `search`/`filter` khớp chuỗi con không phân biệt hoa thường, `<field>=v` theo schema có ép kiểu và kết hợp AND, `page`/`p`, `limit`/`l` tối đa 100, `sortBy` và các alias cùng `order`; từ chối mọi key bắt đầu bằng `$` hoặc chứa `.`; kèm unit | fullstack-developer | với T1 | `apps/api/src/modules/mock-runtime/query-engine.ts` |
| T3 | `crud-handlers.ts` (GET list/one, POST gán `nextId` và sinh Faker cho field thiếu, gán `{parent}Id` ở route lồng, PUT/PATCH merge không đổi `id`, DELETE cascade) và `render-response.ts` (endpoint tắt trả 404, template kèm `$count` tính sau filter trước phân trang) | fullstack-developer | — (sau T1, T2) | `apps/api/src/modules/mock-runtime/{crud-handlers,render-response}.ts` |
| T4 | `rate-limit.ts` (60 req/giây theo secret, 30 req/giây theo IP, cấu hình qua env, trả 429); hạn mức tháng theo chủ project bằng bộ đếm `ownerId` + `yyyymm` flush mỗi 5 giây, vượt thì 429 `MONTHLY_QUOTA_EXCEEDED`; chặn POST khi chạm `MAX_RECORDS_PER_RESOURCE` | fullstack-developer | với T3 | `apps/api/src/modules/mock-runtime/rate-limit.ts`, `apps/api/src/modules/billing/usage-counter-model.ts` |
| T5 | Nối `mock-server.ts`: CORS `*` kèm preflight, body tối đa 100 KB, rate-limit, router catch-all, header `Content-Type: application/json` và `X-Localman-Request-Id`, không trả stack trace | fullstack-developer | — (sau T3, T4) | `apps/api/src/mock-server.ts` |
| T6 | Bộ contract test supertest chạy lại toàn bộ ví dụ Quick start, Code examples và Custom responses của wiki nguồn; mỗi ví dụ khớp status và shape | tester | với T7 | `apps/api/src/modules/mock-runtime/contract.test.ts` |
| T7 | Test bảo mật (`?title[$ne]=x`, `?$where=1`, `sortBy=__proto__`, template `$constructor.constructor`), load `autocannon` 30 giây (429 khi vượt ngưỡng, p95 dưới 50 ms khi dưới ngưỡng), và chạy `curl` qua `{secret}.localtest.me:4100` lẫn `localhost:4100/m/{secret}` | tester | với T6 | `apps/api/src/modules/mock-runtime/security.test.ts`, `apps/api/scripts/load-mock.ts` |
| T8 | Review cuối phase, ưu tiên NoSQL injection, prototype pollution và rate-limit | code-reviewer | — | toàn phase |

### Checklist
- [ ] T1 Phân giải project và route xong
- [ ] T2 Query engine chặn toán tử `$` xong
- [ ] T3 CRUD và render response xong
- [ ] T4 Rate-limit, hạn mức tháng và trần bản ghi xong
- [ ] T5 `mock-server.ts` đã nối đầy đủ
- [ ] T6 Contract test pass
- [ ] T7 Test bảo mật, load và curl thủ công pass
- [ ] T8 Review không còn finding chặn
- [ ] Verification: mọi ví dụ trong wiki nguồn khớp status và shape
- [ ] Verification: `?title[$ne]=x`, `?$where=1`, `sortBy=__proto__`, `$constructor.constructor` bị từ chối hoặc trả rỗng an toàn
- [ ] Verification: `autocannon` 30 giây có 429 khi vượt ngưỡng, p95 dưới 50 ms khi dưới ngưỡng
- [ ] Verification: `curl` qua `{secret}.localtest.me:4100` và `localhost:4100/m/{secret}` đều trả dữ liệu
- [ ] `pnpm lint && pnpm typecheck && pnpm test` sạch
- [ ] `pnpm check:mcp-coverage` pass
