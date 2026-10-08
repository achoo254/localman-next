---
phase: 3
title: "Mock tạm cho CI/PR"
status: pending
priority: P1
effort: "M"
dependencies: [1, 2]
---

# Phase 03: Mock tạm cho CI/PR

## Goal
Dựng một project mock có trạng thái **dùng một lần, có TTL** từ OpenAPI, JSON hoặc một project có sẵn (clone), qua API hoặc CLI. Dùng cho job CI và preview của PR, hết hạn thì tự xoá (Jev 0.72).

## Thiết kế
- **API:** `POST /api/ephemeral-mocks` nhận `{from:{openapi|json|projectId}, seed?:{count}, ttl:'15m'..'24h', label}`, trả `{id, baseUrl, mcpUrl, expiresAt}`. Có `DELETE /api/ephemeral-mocks/:id`. Cần scope `mock:ephemeral`.
- **Dùng lại** suy luận schema của phase 19 (Localman) và clone của phase 03.
- Mock tạm **không tính** vào số project của gói, nhưng có hạn mức riêng `ephemeralMocks` (số mock chạy cùng lúc) cùng hạn mức request của tháng.
- **Dọn dẹp:** TTL index trên Mongo cộng một job dọn mỗi phút (xoá resource, record và log).
- **CLI:** `localman mock up --from openapi.yaml --ttl 2h --label pr-123` in ra `BASE_URL=…` (dùng được trong `$GITHUB_OUTPUT`), `localman mock down <id>`.
- **Template preview PR:** GitHub Action comment URL mock vào PR, rồi xoá mock khi PR đóng.

## Files to Create / Modify
- Create `apps/api/src/modules/ephemeral-mocks/` (model có `expiresAt`, routes, `cleanup-job.ts`)
- Modify `packages/localman-cli/src/commands/mock.ts`
- Create `.github/actions/localman-mock-preview/action.yml`

## Verification
- Mọi operation của phase này có MCP tool trong toolset tương ứng (`pnpm check:mcp-coverage`); tool phá huỷ có dry-run kèm `confirm_token`.
- Integration: tạo mock từ petstore và gọi được CRUD. Hết TTL (giả lập đồng hồ) thì URL trả 404 và dữ liệu đã bị xoá. Vượt `ephemeralMocks` thì trả 403 `PLAN_LIMIT_REACHED`.
- Workflow PR mẫu có comment URL; đóng PR thì mock bị xoá.

## Giao việc
**Đợt:** 9 · **Phụ thuộc trước khi bắt đầu:** DevOps phase 01 (scope `mock:ephemeral`) đã merge; Localman phase 03 (clone project) và 19 (`schema-inference`) đã merge; `packages/localman-cli` của DevOps phase 02 đã có (cho T4) · **Lệnh cook:** `/ak:cook plans/dattqh/261008-1337-devops-toolkit/phase-03-ephemeral-mocks.md`

| # | Việc | Vai trò | Song song | File chính |
|---|---|---|---|---|
| T1 | Model mock tạm có `expiresAt` và API: tạo từ OpenAPI, JSON hoặc `projectId` (dùng lại `schema-inference` và clone), `seed`, TTL từ 15 phút tới 24 giờ, `label`; trả `{id, baseUrl, mcpUrl, expiresAt}`; xoá theo id. Khai báo operation vào toolset `devops`, cần scope `mock:ephemeral`, xoá có dry-run kèm `confirm_token` | fullstack-developer | — | `apps/api/src/modules/ephemeral-mocks/` (model, routes) |
| T2 | Hạn mức: mock tạm không tính vào số project, có hạn mức riêng `ephemeralMocks` cùng hạn mức request của tháng; vượt thì 403 `PLAN_LIMIT_REACHED` | fullstack-developer | — (sau T1) | `apps/api/src/modules/ephemeral-mocks/`, `packages/shared/src/plan-limits.ts` |
| T3 | Dọn dẹp: TTL index trên Mongo cộng job chạy mỗi phút xoá resource, record và log; mock hết hạn trả 404 | fullstack-developer | Song song với T4, T5 (sau T1) | `apps/api/src/modules/ephemeral-mocks/cleanup-job.ts` |
| T4 | CLI `localman mock up --from … --ttl … --label …` in `BASE_URL=…` dùng được với `$GITHUB_OUTPUT`; `localman mock down <id>` | fullstack-developer | Song song với T3, T5 | `packages/localman-cli/src/commands/mock.ts` |
| T5 | Action preview PR: comment URL mock vào PR, xoá mock khi PR đóng | fullstack-developer (hạ tầng) | Song song với T3, T4 | `.github/actions/localman-mock-preview/action.yml` |
| T6 | Test: tạo mock từ petstore và gọi được CRUD; hết TTL (đồng hồ giả) thì URL trả 404 và dữ liệu đã xoá; vượt `ephemeralMocks` trả 403 `PLAN_LIMIT_REACHED`; workflow PR mẫu có comment URL, đóng PR thì mock bị xoá | tester | — (sau T2–T5) | test của `apps/api/src/modules/ephemeral-mocks/`, workflow mẫu |
| T7 | Review cuối phase | code-reviewer | — | toàn phase |

### Checklist
- [ ] T1 API tạo và xoá mock tạm, operation thuộc toolset `devops`
- [ ] T2 Hạn mức `ephemeralMocks` áp đúng, không tính vào số project
- [ ] T3 Job dọn dẹp xoá đủ resource, record và log
- [ ] T4 `mock up` và `mock down` chạy, in `BASE_URL`
- [ ] T5 Action preview PR comment và dọn mock
- [ ] T6 Test pass
- [ ] T7 Review không còn finding mức high
- [ ] Verification: CRUD trên mock petstore; hết TTL trả 404 và sạch dữ liệu; 403 khi vượt hạn mức; comment PR và dọn khi đóng PR; tool phá huỷ có dry-run kèm `confirm_token`
- [ ] lint/typecheck/test sạch: `biome check`, `tsc --noEmit`, test của `apps/api` và `packages/localman-cli`
- [ ] `pnpm check:mcp-coverage` pass
