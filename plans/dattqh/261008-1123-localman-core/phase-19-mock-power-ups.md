---
phase: 19
title: "Mock power-ups: Faker thông minh, tạo resource từ JSON/OpenAPI/CSV, xuất type, chaos, response theo điều kiện"
status: in-progress
priority: P2
effort: "M"
dependencies: [4, 5, 6]
---

# Phase 19: Mock power-ups

> **Thứ tự chạy:** sau phase 09, cùng đợt với phase 17 (trước phần Postman). Nguồn: `../reports/competitors/research-261008-1316-*.md`. Jev chọn ngày 2026-10-08.

## Goal
Thêm 5 tiện ích cho mock, đều không cần viết code, chạy trên web và có ở gói Free. Mục tiêu là vượt cả mockapi.io (không có cái nào) lẫn Postman (phải viết code mock, hoặc tốn AI credit).

| Tiện ích | Jev | Đối thủ |
|---|---|---|
| **Tự chọn Faker theo tên và kiểu field** (`email`, `avatar`, `createdAt`, `price`…) | 0.72 | Apidog có "Smart Mock". mockapi.io bắt chọn tay; Postman phải viết code |
| **Tạo resource từ JSON mẫu, OpenAPI hoặc CSV/JSON** (dán JSON là suy ra schema và seed dữ liệu thật) | 0.78 | Postman: OpenAPI ra mock example, không có trạng thái; tạo từ JSON phải dùng Agent Mode (tốn AI credit). mockapi.io không có |
| **Xuất type TypeScript và Zod** từ schema resource | 0.77 | Cả hai đều không có sẵn |
| **Chaos theo endpoint:** khoảng delay, tỉ lệ lỗi %, timeout, trả 429 | 0.78 | Postman chỉ có delay cố định; mockapi.io không có |
| **Response theo điều kiện, không cần code:** theo header, query, body, hoặc request thứ N | 0.67 | Postman chỉ có matching hoặc phải viết code; mockapi.io không có |

## Files to Create / Modify
- Create `packages/shared/src/faker-field-matcher.ts`: bảng luật gồm tên field (regex, có tiếng Việt không dấu như `ten`, `sdt`, `diachi`) và kiểu, map sang method Faker trong whitelist của phase 04. Đầu ra kèm độ tin cậy; UI chỉ gợi ý, user vẫn đổi được.
- Create `packages/shared/src/schema-inference.ts`: suy schema từ mẫu JSON (object hoặc mảng; phân biệt `id`, khoá cha `*Id`, string, number, boolean, date ISO, url, email, object, array), từ OpenAPI 3.x (**dùng lại** `packages/shared/src/schema-from-openapi.ts` của phase 17 rồi map `components.schemas` sang resource, `$ref` lồng sang quan hệ; không viết parser thứ hai), và từ CSV (header thành field, suy kiểu theo 100 dòng đầu).
- Create `packages/shared/src/type-exporters.ts`: schema sang TypeScript interface và Zod schema, có quan hệ cha–con.
- Create `apps/api/src/modules/mock-runtime/chaos.ts` và `conditional-rules.ts`, dạng hàm thuần. Rule gồm `{match:{header|query|body(JSONPath)|nth}, op:eq|neq|contains|regex|exists|gt|lt, value, response:{status, body template, headers}}`. Đánh giá theo thứ tự, rule đầu tiên khớp thì dừng.
- Modify `apps/api/src/modules/mock-runtime/crud-handlers.ts`: chạy rule rồi tới chaos, trước khi chạy CRUD.
- Modify resource model của phase 04: thêm `chaos:{latencyMs:[min,max], errorRate, errorStatus, timeoutRate}` và `rules[]`. Giới hạn: tối đa 20 rule mỗi endpoint; delay tối đa 30 giây.
- Create `apps/web/src/features/resources/import-resource-dialog.tsx` (3 tab: JSON mẫu, OpenAPI, CSV/JSON; xem trước schema cùng 5 dòng dữ liệu trước khi tạo), `export-types-menu.tsx`, `chaos-panel.tsx`, `rules-editor.tsx`.

## Verification
- Unit:
  - `faker-field-matcher`: khoảng 60 tên field mẫu, cả Anh lẫn Việt.
  - `schema-inference`: JSON lồng, mảng rỗng, OpenAPI có `$ref` vòng thì phải báo lỗi rõ ràng, CSV có BOM và dấu phẩy trong ngoặc kép.
  - `type-exporters`: snapshot; output Zod parse được dữ liệu do generator sinh ra.
  - `chaos` (seed ngẫu nhiên cố định) và `conditional-rules` (test dạng bảng).
- Integration:
  - Dán JSON 3 bản ghi thì ra resource kèm 3 bản ghi và schema đúng.
  - Import OpenAPI petstore thì ra cây resource có quan hệ.
  - Đặt `errorRate=0.5` rồi gọi 1.000 lần: tỉ lệ lỗi trong khoảng 45–55%.
  - Rule header `x-role: admin` thì trả 403 theo đúng cấu hình.
- Bảo mật: OpenAPI hay CSV có kích thước tối đa 2 MB; không gọi `$ref` ra URL bên ngoài.

## Giao việc
**Đợt:** 3 · **Phụ thuộc trước khi bắt đầu:** phase 04, 05, 06 đã xong và phần mock (01–09) đã lên staging; chạy cùng đợt với phase 17, nên phần OpenAPI dùng lại `schema-from-openapi.ts` của phase 17 (T4 bên đó) thay vì viết parser thứ hai · **Lệnh cook:** `/ak:cook plans/dattqh/261008-1123-localman-core/phase-19-mock-power-ups.md`

| # | Việc | Vai trò | Song song | File chính |
|---|---|---|---|---|
| T1 | Prototype `prototype/index.html` chưa có màn cho tiện ích của phase này. Bổ sung vào màn `#/projects/demo` (cạnh `project-detail-new-resource` và modal resource `resource-form-*`): dialog import 3 tab có xem trước schema và 5 dòng, menu xuất type, panel chaos, rules editor, gợi ý Faker trong form resource; trình user duyệt trước khi code UI (cần user xác nhận) | ui-ux-designer | với T2, T3, T4 | `prototype/index.html` |
| T2 | Viết `faker-field-matcher`: bảng luật tên field (regex, có tiếng Việt không dấu như `ten`, `sdt`, `diachi`) và kiểu sang method trong whitelist phase 04, trả độ tin cậy; test khoảng 60 tên field Anh và Việt | fullstack-developer | với T1, T3, T4 | `packages/shared/src/faker-field-matcher.ts` |
| T3 | Viết `schema-inference` cho JSON mẫu, OpenAPI 3.x (dùng parser của phase 17) và CSV: phân biệt `id`, khoá cha `*Id`, các kiểu, quan hệ từ `$ref`; tối đa 2 MB, không gọi `$ref` ra ngoài, `$ref` vòng báo lỗi rõ, CSV có BOM và dấu phẩy trong ngoặc kép | fullstack-developer | với T1, T2, T4 | `packages/shared/src/schema-inference.ts` |
| T4 | Viết `type-exporters`: schema sang TypeScript interface và Zod có quan hệ cha–con; test snapshot và Zod parse được dữ liệu generator sinh ra | fullstack-developer | với T1, T2, T3 | `packages/shared/src/type-exporters.ts` |
| T5 | Viết `chaos` và `conditional-rules` dạng hàm thuần (rule đầu tiên khớp thì dừng, op `eq`, `neq`, `contains`, `regex`, `exists`, `gt`, `lt`); test với seed cố định và test dạng bảng; thêm field `chaos` và `rules[]` vào resource model (tối đa 20 rule mỗi endpoint, delay tối đa 30 giây); `crud-handlers` chạy rule rồi chaos trước CRUD | fullstack-developer | — | `apps/api/src/modules/mock-runtime/chaos.ts`, `conditional-rules.ts`, `crud-handlers.ts`, `apps/api/src/modules/resources/resource-model.ts` |
| T6 | Khai báo operation qua registry (toolset `mock-advanced`): import resource từ JSON/OpenAPI/CSV (xem trước rồi tạo resource kèm seed), xuất type, đặt chaos và rule, gợi ý Faker cho schema | fullstack-developer | — | `apps/api/src/modules/resources/` (routes, service) |
| T7 | Làm UI: `import-resource-dialog`, `export-types-menu`, `chaos-panel`, `rules-editor`, gợi ý Faker trong form resource (user vẫn đổi được) theo màn đã duyệt ở T1 | fullstack-developer | — | `apps/web/src/features/resources/` |
| T8 | Viết integration test: dán JSON 3 bản ghi ra resource kèm 3 bản ghi đúng schema; import OpenAPI petstore ra cây có quan hệ; `errorRate=0.5` gọi 1.000 lần nằm trong 45–55%; rule header `x-role: admin` trả 403; file trên 2 MB và `$ref` ra ngoài bị từ chối | tester | — | test trong `apps/api/src/modules/resources/`, `mock-runtime/` |
| T9 | Deploy bản phase lên staging (cần user xác nhận) | fullstack-developer | — | `deploy/compose.staging.yml` |
| T10 | Review cuối phase, chú trọng parse input không tin cậy và giới hạn delay | code-reviewer | — | toàn phase |

### Checklist
- [x] T1 Màn import, xuất type, chaos, rules, gợi ý Faker: thay prototype bằng spec UI `../reports/ui-phase-19-mock-power-ups-spec.md` (chờ user duyệt)
- [x] T2 `faker-field-matcher` có test khoảng 60 tên field
- [x] T3 `schema-inference` cho JSON, OpenAPI (dùng parser phase 17), CSV
- [x] T4 `type-exporters` có snapshot, Zod parse được dữ liệu sinh ra
- [x] T5 Chaos và rule chạy trước CRUD, có giới hạn
- [x] T6 Operation `mock-advanced` qua registry
- [x] T7 UI bốn tiện ích và gợi ý Faker (sau cờ `mockPowerUps`)
- [x] T8 Integration và bảo mật pass
- [ ] T9 Staging đã deploy sau khi user xác nhận
- [x] T10 Review không còn finding mức high
- [x] Verification: unit matcher, inference (JSON lồng, mảng rỗng, `$ref` vòng, CSV BOM), exporters, chaos, rules pass (2026-10-16: `faker-field-matcher*.test.ts`, `schema-inference*.test.ts` có JSON lồng, mảng rỗng, `$ref` vòng, CSV BOM; `type-exporters*.test.ts`, `chaos.test.ts`, `conditional-rules.test.ts`)
- [x] Verification: integration JSON 3 bản ghi, petstore, `errorRate` 45–55%, rule `x-role: admin` 403 pass (2026-10-16: `resource-import-tree.test.ts`, `resource-import-operations.test.ts`, `mock-behavior.test.ts` có `errorRate` và rule `x-role: admin` trả 403)
- [x] Verification: OpenAPI/CSV tối đa 2 MB, không gọi `$ref` ra URL ngoài (2026-10-16: `resource-import-limits.test.ts`, `schema-inference-openapi-limits.test.ts`)
- [x] `pnpm lint && pnpm typecheck && pnpm test` sạch (2026-10-16: 681 file, 4869 test)
- [x] `pnpm check:mcp-coverage` pass (2026-10-16)
