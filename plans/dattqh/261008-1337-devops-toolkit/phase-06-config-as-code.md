---
phase: 6
title: "Cấu hình dạng code `localman.yaml`"
status: pending
priority: P3
effort: "L"
dependencies: [2, 3, 5]
---

# Phase 06: Cấu hình dạng code

## Goal
Khai báo mock project, collection và environment (chỉ phần không phải secret) trong file text nằm cùng repo của user, rồi review được qua PR theo kiểu GitOps (Jev 0.58).

## Thiết kế
- **Định dạng:**
  - `localman.yaml` ở root trỏ tới thư mục `.localman/`.
  - Mỗi resource mock là một file YAML: schema, endpoint, chaos, rule.
  - Collection dùng Postman Collection v2.1 tách theo request (`.localman/collections/<name>/<folder>/<request>.json`), cho diff dễ đọc.
  - Environment lưu tên biến cùng giá trị shared; biến secret chỉ ghi tên và nguồn, ví dụ `vault://…`.
- **CLI:**
  - `localman pull` tải trạng thái server về file.
  - `localman diff` so file với server.
  - `localman push [--dry-run]` áp file lên server, có xác nhận và audit.
  - Gặp xung đột (server đã đổi kể từ lần pull trước) thì dừng và hiện diff; merge dùng `three-way-merge` của Localman phase 14.
- **CI:** template "localman push khi merge vào main". Trên PR chạy `localman push --dry-run --comment-pr` để comment diff vào PR (cần `GITHUB_TOKEN` hoặc `CI_JOB_TOKEN`).

## Files to Create / Modify
- `packages/config-as-code/src/` (schema zod cho file, `serialize.ts`, `parse.ts`, `diff.ts`)
- `packages/localman-cli/src/commands/{pull,push,diff}.ts`
- `apps/api/src/modules/config-sync/` (endpoint áp theo lô, kiểm revision, scope `config:sync`)

## Verification
- Mọi operation của phase này có MCP tool trong toolset tương ứng (`pnpm check:mcp-coverage`); tool phá huỷ có dry-run kèm `confirm_token`.
- Round-trip: `pull` rồi `push` không sinh thay đổi nào. Snapshot diff khi sửa một field.
- Server bị đổi sau lần pull thì `push` báo xung đột. Không có secret nào nằm trong file.

## Giao việc
**Đợt:** 9 · **Phụ thuộc trước khi bắt đầu:** DevOps phase 02, 03 và 05 đã merge; Localman phase 14 (`three-way-merge`) đã merge · **Lệnh cook:** `/ak:cook plans/dattqh/261008-1337-devops-toolkit/phase-06-config-as-code.md`

| # | Việc | Vai trò | Song song | File chính |
|---|---|---|---|---|
| T1 | Định dạng file: schema zod cho `localman.yaml` và thư mục `.localman/`; mỗi resource mock là một file YAML (schema, endpoint, chaos, rule); collection theo Postman v2.1 tách từng request; environment chỉ ghi tên biến, giá trị shared và nguồn của biến secret; `serialize` và `parse` | fullstack-developer | — | `packages/config-as-code/src/` (schema), `serialize.ts`, `parse.ts` |
| T2 | So sánh file với server cho ra diff dễ đọc | fullstack-developer | Song song với T3 (sau T1) | `packages/config-as-code/src/diff.ts` |
| T3 | API áp theo lô có kiểm revision (server đổi sau lần pull thì trả xung đột), scope `config:sync`, ghi audit; operation pull, diff, push trong toolset `devops`, `config_push` có dry-run kèm `confirm_token` | fullstack-developer | Song song với T2 (sau T1) | `apps/api/src/modules/config-sync/` |
| T4 | CLI `localman pull`, `localman diff`, `localman push [--dry-run]`: push có xác nhận, gặp xung đột thì dừng và hiện diff, merge bằng `three-way-merge` | fullstack-developer | — (sau T2, T3) | `packages/localman-cli/src/commands/pull.ts`, `diff.ts`, `push.ts` |
| T5 | `push --dry-run --comment-pr` (dùng `GITHUB_TOKEN` hoặc `CI_JOB_TOKEN`) và template CI: push khi merge vào main, dry-run kèm comment diff trên PR. Theo prototype `devops.html` màn `#/config` | fullstack-developer (hạ tầng) | — (sau T4) | `packages/localman-cli/src/commands/push.ts`, `ci-templates/`, `.github/actions/` |
| T6 | Test: round-trip `pull` rồi `push` không sinh thay đổi; snapshot diff khi sửa một field; server đổi sau lần pull thì `push` báo xung đột; không có secret nào trong file | tester | — (sau T5) | test của `packages/config-as-code`, `apps/api/src/modules/config-sync/`, `packages/localman-cli` |
| T7 | Review cuối phase | code-reviewer | — | toàn phase |

### Checklist
- [ ] T1 Schema, `serialize` và `parse` cho đủ 3 loại phần tử
- [ ] T2 Diff dễ đọc
- [ ] T3 API áp theo lô, kiểm revision, audit, `config_push` có dry-run
- [ ] T4 `pull`, `diff`, `push` chạy, xung đột hiện diff
- [ ] T5 `--comment-pr` và template CI
- [ ] T6 Test pass
- [ ] T7 Review không còn finding mức high
- [ ] Verification: round-trip không sinh thay đổi; snapshot diff đúng; xung đột được báo; file không chứa secret; tool phá huỷ có dry-run kèm `confirm_token`
- [ ] lint/typecheck/test sạch: `biome check`, `tsc --noEmit`, test của `packages/config-as-code`, `apps/api`, `packages/localman-cli`
- [ ] `pnpm check:mcp-coverage` pass
