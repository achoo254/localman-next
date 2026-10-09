---
phase: 4
title: "Resources, schema, sinh dữ liệu"
status: pending
priority: P1
effort: "L"
dependencies: [3]
---

# Phase 04: Resources, schema, sinh dữ liệu

## Goal
Làm resource dạng cây kèm schema, object template và cấu hình endpoint. Dữ liệu sinh bằng Faker theo whitelist, có thể generate hoặc reset từng resource hay toàn project, và sửa được dữ liệu thô dạng JSON.

## Files to Create / Modify
- Create `packages/shared/src/faker-methods.ts`: danh sách whitelist khoảng 250 method theo các nhóm address, animal, color, commerce, company, database, datatype, date, finance, git, hacker, image, internet, lorem, music, name, phone, science, system, vehicle, word. Mỗi method là một cặp `id` và hàm gọi, không truy cập Faker động theo chuỗi.
- Create `packages/shared/src/resource-schema.ts`: zod cho field `{name: /^[\w\-.]+$/, type: 'Faker.js'|'String'|'Number'|'Boolean'|'Object'|'Array'|'Date'|'Parent Resource'|'Child Resource', fakerMethod?, childId?}`, cùng các field hệ thống `id` (Object ID) và `{parent}Id` (Parent ID)
- Create `packages/shared/src/json-template.ts`: duyệt cây JSON, thay chuỗi `$mockData`, `$count`, `$<category.method>` bằng giá trị (hàm thuần, không eval)
- Create `apps/api/src/modules/resources/resource-model.ts`: `{projectId, parentId|null, name, schema[], template|null, endpoints:[{method, path, enabled, response}], count, nextId}` với index unique `(projectId, parentId, name)`
- Create `apps/api/src/modules/resources/record-model.ts`: `{resourceId, projectId, parentRecordId|null, id:string, data:Mixed}` với index `(resourceId, id)` unique và `(resourceId, parentRecordId)`
- Create `apps/api/src/modules/resources/resource-routes.ts`, `resource-service.ts`, `data-generator.ts`, `resource-tree.ts` (build cây, chặn chu trình và tên trùng giữa các anh em)

## Tasks & Steps
1. Các route API, đều nằm dưới `/api/projects/:pid/resources`:
   - `POST /` và `PUT /:rid` nhận `{name, parentId, schema, template, endpoints}`.
   - `DELETE /:rid` xoá cascade resource con và records.
   - `PUT /:rid/parent` nhận `{parentId|null}` để lồng hoặc gỡ lồng. Thao tác này đổi field `{parent}Id` trong schema và reset dữ liệu của resource bị đổi cha.
   - `POST /:rid/generate` nhận `{count: 0..100}`. Count bằng 0 nghĩa là reset.
   - `POST /generate_all` và `POST /reset_all`.
   - `GET /:rid/data` và `PUT /:rid/data` (body là mảng JSON, tối đa `MAX_RECORDS_PER_RESOURCE`).
2. Giới hạn gói: chặn resource thứ 11 ở gói Free (theo `plan-limits`). Custom response (`endpoints[].response`) và object template (`template`) **miễn phí cho mọi gói** (Jev 0.89). Đây là điểm hơn mockapi.io, nơi hai tính năng này phải trả phí.
3. Cách sinh dữ liệu:
   - Áp từng field theo kiểu: Faker gọi method trong whitelist; String, Number, Boolean, Date, Object, Array lấy giá trị mặc định ngẫu nhiên.
   - Có `template` thì dùng `json-template` thay cho schema.
   - `id` là chuỗi tăng dần ("1", "2", …) như nguồn.
   - Resource con chỉ sinh được khi cha có `count > 0`, nếu không trả lỗi "Hãy sinh dữ liệu cho resource cha trước". Mỗi bản ghi con nhận `parentRecordId` ngẫu nhiên trong số bản ghi của cha (user chốt 2026-10-08: tổng N bản ghi chia ngẫu nhiên).
   - Generate là thay toàn bộ dữ liệu, không cộng dồn, và chạy trong transaction Mongo (cần replica set).
4. Mặc định khi tạo resource:
   - Endpoints: `GET /:res`, `GET /:res/:id`, `POST /:res`, `PUT /:res/:id`, `DELETE /:res/:id`, mỗi cái `enabled: true`, `response: "$mockData"`. PATCH dùng chung cấu hình với PUT.
   - Schema mặc định gồm `id`, `createdAt` (date.past), `name` (name.fullName), `avatar` (image.avatar).

## Verification
- Unit:
  - `json-template` với các biến, method lạ (bị từ chối, không chạy), template lồng sâu và chuỗi kiểu `$constructor`.
  - Whitelist faker không lộ `faker.helpers.fake` hay gọi động.
  - `resource-tree` chặn được chu trình và tên trùng.
- Integration: generate 0, 50 và 100 đúng số bản ghi. Generate 101 trả 400. Child không có dữ liệu cha trả 409. `PUT /data` với JSON không phải mảng trả 400.
- Hiệu năng: generate_all trên 50 resource × 100 bản ghi chạy dưới 3 giây trên Mongo local.

## Giao việc
**Đợt:** 2 · **Phụ thuộc trước khi bắt đầu:** phase 03 (project, `can()`, `plan-guard`); Mongo dev chạy replica set (phase 01) · **Lệnh cook:** `/ak:cook plans/dattqh/261008-1123-localman-core/phase-04-resources-schema-and-data-generation.md`

| # | Việc | Vai trò | Song song | File chính |
|---|---|---|---|---|
| T1 | Whitelist khoảng 250 method Faker theo 21 nhóm, mỗi method là cặp `id` và hàm gọi tĩnh, không truy cập Faker động theo chuỗi; unit test chứng minh không lộ `faker.helpers.fake` hay gọi động | fullstack-developer | với T2, T3 | `packages/shared/src/faker-methods.ts` |
| T2 | `resource-schema.ts` (zod field, kiểu, field hệ thống `id` và `{parent}Id`) và `json-template.ts` (hàm thuần thay `$mockData`, `$count`, `$<category.method>`; nhận resolver method qua tham số để không phụ thuộc T1); unit cho biến, method lạ bị từ chối, template lồng sâu, chuỗi `$constructor` | fullstack-developer | với T1, T3 | `packages/shared/src/{resource-schema,json-template}.ts` |
| T3 | `resource-model.ts` (index unique `(projectId, parentId, name)`), `record-model.ts` (index `(resourceId, id)` unique và `(resourceId, parentRecordId)`), `resource-tree.ts` (dựng cây, chặn chu trình và tên trùng giữa anh em) kèm unit | fullstack-developer | với T1, T2 | `apps/api/src/modules/resources/{resource-model,record-model,resource-tree}.ts` |
| T4 | `data-generator.ts`: sinh theo kiểu field hoặc theo `template`, `id` tăng dần dạng chuỗi, resource con chia ngẫu nhiên `parentRecordId` theo bản ghi cha (cha `count = 0` thì lỗi), generate thay toàn bộ dữ liệu trong transaction | fullstack-developer | — (sau T1–T3) | `apps/api/src/modules/resources/data-generator.ts` |
| T5 | `resource-service.ts` và operation qua registry cho mọi route ở bước 1 (CRUD, `parent`, `generate`, `generate_all`, `reset_all`, `data` GET/PUT tối đa `MAX_RECORDS_PER_RESOURCE`); chặn resource thứ 11 ở Free; mặc định endpoints và schema theo bước 4; custom response và template mở cho mọi gói | fullstack-developer | — (sau T4) | `apps/api/src/modules/resources/{resource-service,resource-routes}.ts` |
| T6 | Integration: generate 0, 50, 100 đúng số bản ghi; generate 101 trả 400; con không có dữ liệu cha trả 409; `PUT /data` không phải mảng trả 400; xoá cascade; giới hạn resource thứ 11. Đo hiệu năng `generate_all` trên 50 resource × 100 bản ghi | tester | — | `apps/api/src/modules/resources/*.test.ts` |
| T7 | Review cuối phase, ưu tiên `json-template` và whitelist Faker (không có đường thực thi code tuỳ ý) | code-reviewer | — | toàn phase |

### Checklist
- [x] T1 Whitelist Faker và unit chống gọi động xong
- [x] T2 `resource-schema` và `json-template` cùng unit xong
- [x] T3 Model resource, record và `resource-tree` xong
- [x] T4 `data-generator` chạy trong transaction xong
- [x] T5 Service và operation resource xong
- [x] T6 Integration và đo hiệu năng pass
- [x] T7 Review không còn finding chặn
- [x] Verification: `json-template` từ chối method lạ và `$constructor`, xử lý đúng template lồng sâu
- [x] Verification: whitelist không lộ `faker.helpers.fake` hay gọi động; `resource-tree` chặn chu trình và tên trùng
- [x] Verification: generate 0/50/100 đúng số; 101 trả 400; con thiếu dữ liệu cha trả 409; `PUT /data` không phải mảng trả 400
- [x] Verification: `generate_all` trên 50 resource × 100 bản ghi chạy dưới 3 giây trên Mongo local
- [x] `pnpm lint && pnpm typecheck && pnpm test` sạch
- [x] `pnpm check:mcp-coverage` pass
