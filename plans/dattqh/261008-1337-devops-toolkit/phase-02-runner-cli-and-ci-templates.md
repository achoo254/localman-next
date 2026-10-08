---
phase: 2
title: "Collection Runner, CLI `localman`, template CI"
status: pending
priority: P1
effort: "L"
dependencies: [1]
---

# Phase 02: Runner, CLI và template CI

## Goal
Chạy được collection (hoặc folder) theo thứ tự, kèm assert và vòng lặp dữ liệu, ở cả web lẫn CLI. Lệnh `localman test` trong CI kết hợp **mock tạm, tunnel và test trong một lệnh**; đây là nền cho keyword "Test API trong CI bằng 1 lệnh".

## Phạm vi
- **Runner engine** (`packages/runner`, dùng chung cho web và CLI):
  - Chạy request theo thứ tự trong collection hoặc folder; có số vòng lặp, delay, và dừng khi gặp lỗi (tuỳ chọn).
  - Chạy script pre/post trong sandbox QuickJS (Localman phase 10), hỗ trợ `pm.test` và `pm.expect` (dạng chai) để giữ tương thích với Postman.
  - **File dữ liệu CSV/JSON** sinh scope `data` (thứ tự ưu tiên global < collection < environment < data < local), **có ở gói Free**.
  - Kết quả gồm từng request, từng assert, thời gian và kích thước.
- **Web:** nút "Run" ở collection hoặc folder; trang kết quả có lịch sử chạy.
- **CLI `localman`** (npm `localman`, thư mục `packages/localman-cli`):
  - `localman login` (device flow giống Tunelo) hoặc biến `LOCALMAN_TOKEN` (PAT, service account).
  - `localman run <collection|id> --env <name> [--data file.csv] [--folder X] [--iterations N] [--bail] --report junit,json,html`
  - `localman test …` gồm toàn bộ `run` cộng `--mock <openapi|json|projectId>` (gọi phase 03, nhận `baseUrl` mock tiêm vào env) và `--tunnel <port>` (mở Tunelo bằng token máy, tiêm URL tunnel vào env). Kết thúc thì tự dọn mock và tunnel.
  - Exit code: 0 nếu pass, 1 nếu assert fail, 2 nếu lỗi cấu hình.
  - Runner chạy **ngay trên máy CI**; request đi thẳng từ CI, **không qua proxy** (CI không bị CORS). Server chỉ nhận kết quả để lưu lịch sử. Tính `ciRunsPerMonth`.
- **Template CI:**
  - `.github/actions/localman-test/action.yml` (composite action) cùng ví dụ workflow.
  - `ci-templates/gitlab/localman-test.gitlab-ci.yml`.
  - README hướng dẫn đặt secret `LOCALMAN_TOKEN` và `TUNELO_TOKEN`.

## Files to Create / Modify
- Create `packages/runner/src/` (`run-collection.ts`, `iteration-data.ts`, `assertions.ts`, `reporters/{junit,json,html}.ts`)
- Create `packages/localman-cli/src/` (`cli.ts`, `commands/{login,run,test,mock}.ts`, `idp-session.ts` dùng chung cách làm với `tunelo-cli`)
- Create `apps/api/src/modules/runs/` (model lịch sử chạy, routes nhận kết quả từ CLI), `apps/web/src/features/runner/`
- Modify `packages/shared/src/variable-resolver.ts` để thêm scope `data`
- Release: tag `localman-cli-v*`, workflow `.github/workflows/localman-cli-publish.yml`

## Verification
- Mọi operation của phase này có MCP tool trong toolset tương ứng (`pnpm check:mcp-coverage`); tool phá huỷ có dry-run kèm `confirm_token`.
- Unit cho runner: thứ tự chạy, vòng lặp dữ liệu, `pm.test`, `--bail`; snapshot báo cáo JUnit.
- E2E: workflow GitHub Actions mẫu (chạy bằng `act` trên máy) với service Express mẫu trên port 3000. `localman test --mock petstore.yaml --tunnel 3000` pass, rồi một assert cố ý sai cho exit code 1, và mock cùng tunnel đã được dọn.
- So với Postman: chạy một collection Postman đã import (có `pm.test`) thì cho kết quả giống.

## Giao việc
**Đợt:** 9 · **Phụ thuộc trước khi bắt đầu:** DevOps phase 01 đã merge; Localman phase 10 (sandbox QuickJS), 12 (collections) và 13 (`variable-resolver`) đã merge. Phần `--mock` của `localman test` cần API của DevOps phase 03, phần `--tunnel` cần plan Tunelo đã lên production · **Lệnh cook:** `/ak:cook plans/dattqh/261008-1337-devops-toolkit/phase-02-runner-cli-and-ci-templates.md`

| # | Việc | Vai trò | Song song | File chính |
|---|---|---|---|---|
| T1 | Chốt số hạn mức Free cho DevOps (`ciRunsPerMonth`, `ephemeralMocks`, `monitors`, `monitorIntervalMin`; số tạm trong prototype là 300, 3, 3, 15 phút) với Jev theo số liệu tải thật, rồi ghi vào `plan-limits` (cần user xác nhận) | fullstack-developer | Song song với T2, T3 | `packages/shared/src/plan-limits.ts` |
| T2 | Runner engine: chạy request theo thứ tự trong collection hoặc folder, vòng lặp, delay, `--bail`; script pre/post trong sandbox QuickJS với `pm.test` và `pm.expect` dạng chai; kết quả theo request, assert, thời gian và kích thước | fullstack-developer | Song song với T1, T3 | `packages/runner/src/run-collection.ts`, `packages/runner/src/assertions.ts` |
| T3 | Dữ liệu vòng lặp: đọc CSV/JSON thành scope `data`, thứ tự ưu tiên global < collection < environment < data < local | fullstack-developer | Song song với T1, T2 | `packages/runner/src/iteration-data.ts`, `packages/shared/src/variable-resolver.ts` |
| T4 | Báo cáo JUnit, JSON và HTML | fullstack-developer | Song song với T5 (sau T2) | `packages/runner/src/reporters/junit.ts`, `json.ts`, `html.ts` |
| T5 | API lịch sử chạy: model, operation nhận kết quả từ CLI, đếm `ciRunsPerMonth`, khai báo vào toolset `devops` | fullstack-developer | Song song với T2, T3, T4 | `apps/api/src/modules/runs/` |
| T6 | CLI `localman`: `login` bằng device flow hoặc `LOCALMAN_TOKEN`, phiên IdP theo cùng cách làm với `tunelo-cli`, lệnh `run` với `--env`, `--data`, `--folder`, `--iterations`, `--bail`, `--report`; exit code 0, 1, 2; che token khi in | fullstack-developer | — (sau T2–T5) | `packages/localman-cli/src/cli.ts`, `packages/localman-cli/src/idp-session.ts`, `packages/localman-cli/src/commands/login.ts`, `packages/localman-cli/src/commands/run.ts` |
| T7 | `localman test`: toàn bộ `run` cộng `--mock` (gọi API mock tạm, tiêm `baseUrl` vào env) và `--tunnel <port>` (mở Tunelo bằng token máy, tiêm URL tunnel); luôn dọn mock và tunnel khi kết thúc, kể cả khi lỗi | fullstack-developer | — (sau T6) | `packages/localman-cli/src/commands/test.ts`, `packages/localman-cli/src/commands/mock.ts` |
| T8 | Web: nút Run ở collection hoặc folder, trang kết quả kèm lịch sử chạy (gồm lượt từ CI). Theo prototype `devops.html` màn `#/runs` | fullstack-developer | Song song với T6, T7 (sau T5) | `apps/web/src/features/runner/` |
| T9 | Template CI: composite action và workflow mẫu, file GitLab CI, README đặt secret `LOCALMAN_TOKEN` và `TUNELO_TOKEN`. Theo prototype `devops.html` màn `#/ci` | fullstack-developer (hạ tầng) | Song song với T8 | `.github/actions/localman-test/action.yml`, `ci-templates/gitlab/localman-test.gitlab-ci.yml` |
| T10 | Test: unit runner (thứ tự, vòng lặp dữ liệu, `pm.test`, `--bail`), snapshot JUnit; so kết quả với Postman trên một collection Postman đã import; E2E bằng `act` với service Express mẫu port 3000: `localman test --mock petstore.yaml --tunnel 3000` pass, assert cố ý sai cho exit code 1, mock và tunnel đã dọn (phần `--mock` chạy khi DevOps phase 03 có API) | tester | — (sau T7, T9) | `packages/runner/src/**/__tests__/`, test E2E của `packages/localman-cli` |
| T11 | Workflow publish theo tag `localman-cli-v*` và publish npm `localman` (cần user xác nhận) | fullstack-developer (hạ tầng) | — (sau T10) | `.github/workflows/localman-cli-publish.yml` |
| T12 | Review cuối phase | code-reviewer | — | toàn phase |

### Checklist
- [ ] T1 Hạn mức Free cho DevOps đã chốt sau khi user xác nhận và nằm trong `plan-limits`
- [ ] T2 Runner chạy đúng thứ tự, vòng lặp, `--bail`, `pm.test`
- [ ] T3 Scope `data` đúng thứ tự ưu tiên
- [ ] T4 3 reporter xuất đúng định dạng
- [ ] T5 API lịch sử chạy và đếm `ciRunsPerMonth`
- [ ] T6 `localman login` và `localman run` với exit code đúng
- [ ] T7 `localman test` dựng và dọn mock cùng tunnel
- [ ] T8 Nút Run và trang lịch sử khớp prototype
- [ ] T9 Template GitHub Actions và GitLab CI cùng README
- [ ] T10 Unit, snapshot, so với Postman và E2E `act` pass
- [ ] T11 `localman` có trên npm sau khi user xác nhận
- [ ] T12 Review không còn finding mức high
- [ ] Verification: unit runner và snapshot JUnit pass; E2E `localman test --mock --tunnel` pass, assert sai cho exit code 1, dọn sạch; kết quả giống Postman; tool phá huỷ có dry-run kèm `confirm_token`
- [ ] lint/typecheck/test sạch: `biome check`, `tsc --noEmit`, test của `packages/runner`, `packages/localman-cli`, `apps/api`, `apps/web`
- [ ] `pnpm check:mcp-coverage` pass
