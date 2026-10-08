---
phase: 5
title: "Đồng bộ biến và secret: .env, GitHub Actions, Doppler/Vault"
status: pending
priority: P2
effort: "M"
dependencies: [1, 2]
---

# Phase 05: Đồng bộ biến và secret

## Goal
Cùng một bộ biến chạy được giữa cấu hình ứng dụng, CI và test API, không phải chép tay (Jev 0.64).

## Phạm vi
- **`.env`:**
  - Import: mỗi dòng `KEY=value` thành một biến; key có `SECRET`, `TOKEN`, `PASSWORD` hoặc `KEY` thì gợi ý `type=secret`.
  - Export environment ra `.env`: chỉ giá trị shared; biến secret thì xuất placeholder, trừ khi user chủ động chọn "kèm secret".
- **GitHub Actions secrets** (ghi): đẩy biến đã chọn lên repository hoặc environment secrets qua GitHub API (mã hoá bằng libsodium sealed box theo public key của repo). Dùng GitHub App hoặc fine-grained PAT do user cấp, token lưu mã hoá.
- **Đọc từ Doppler và HashiCorp Vault:**
  - Biến trỏ được tới `doppler://project/config/KEY` hoặc `vault://path#key`.
  - Proxy hoặc CLI chỉ resolve lúc chạy, không lưu giá trị.
  - Credential của Doppler và Vault lưu mã hoá theo workspace.
- **CLI:** `localman env pull <env> > .env`, `localman env push <env> --from .env`, `localman env sync-github <env> --repo owner/name`.

## Files to Create / Modify
- `apps/api/src/modules/env-integrations/` (`dotenv-codec.ts`, `github-secrets.ts`, `doppler-resolver.ts`, `vault-resolver.ts`, routes)
- Modify `packages/shared/src/variable-resolver.ts`: thêm resolver bên ngoài cho scheme `doppler://` và `vault://`, có timeout và cache ngắn.
- `packages/localman-cli/src/commands/env.ts`
- `apps/web/src/features/environments/integrations-panel.tsx`

## Verification
- Mọi operation của phase này có MCP tool trong toolset tương ứng (`pnpm check:mcp-coverage`); tool phá huỷ có dry-run kèm `confirm_token`.
- `dotenv-codec` đọc và ghi đúng với dấu nháy, `#` comment, chuỗi nhiều dòng và `export KEY=`.
- `github-secrets` (mock GitHub API): mã hoá đúng định dạng sealed box.
- Doppler và Vault (container dev): resolve lúc chạy; giá trị không xuất hiện trong DB hay log; credential sai thì báo lỗi rõ.

## Giao việc
**Đợt:** 9 · **Phụ thuộc trước khi bắt đầu:** DevOps phase 01 (scope `env:read`, `env:write`, audit) đã merge; Localman phase 13 (environments, `variable-resolver`, `secret-cipher`) đã merge; DevOps phase 02 đã merge `packages/localman-cli` và phần sửa `variable-resolver.ts` (tránh hai phase cùng sửa một file) · **Lệnh cook:** `/ak:cook plans/dattqh/261008-1337-devops-toolkit/phase-05-env-and-secrets-sync.md`

| # | Việc | Vai trò | Song song | File chính |
|---|---|---|---|---|
| T1 | Tạo GitHub App cho việc đẩy Actions secrets (quyền Secrets: write) trên tài khoản của user; cách dự phòng là fine-grained PAT do user cấp (cần user xác nhận) | fullstack-developer (hạ tầng) | Song song với T2, T3, T4 | cấu hình GitHub App, env của `apps/api` |
| T2 | Codec `.env`: import từng dòng `KEY=value` (dấu nháy, comment `#`, chuỗi nhiều dòng, `export KEY=`), key có `SECRET`, `TOKEN`, `PASSWORD` hoặc `KEY` thì gợi ý `type=secret`; export chỉ giá trị shared, biến secret thành placeholder trừ khi user chọn "kèm secret" | fullstack-developer | Song song với T1, T3, T4 | `apps/api/src/modules/env-integrations/dotenv-codec.ts` |
| T3 | Đẩy GitHub Actions secrets lên repository hoặc environment qua GitHub API, mã hoá libsodium sealed box theo public key của repo; token GitHub lưu mã hoá | fullstack-developer | Song song với T1, T2, T4 | `apps/api/src/modules/env-integrations/github-secrets.ts` |
| T4 | Resolver `doppler://project/config/KEY` và `vault://path#key`: chỉ resolve lúc chạy, không lưu giá trị, có timeout và cache ngắn; credential Doppler và Vault lưu mã hoá theo workspace | fullstack-developer | Song song với T1, T2, T3 | `apps/api/src/modules/env-integrations/doppler-resolver.ts`, `vault-resolver.ts`, `packages/shared/src/variable-resolver.ts` |
| T5 | Operation và route của module: import, export, đẩy GitHub (`env_sync_github` có dry-run kèm `confirm_token`), lưu credential; toolset `devops`; ghi audit | fullstack-developer | — (sau T2, T3, T4) | `apps/api/src/modules/env-integrations/` (routes, operation) |
| T6 | Panel tích hợp trong Environments: import và export `.env`, đẩy GitHub secrets, tham chiếu Doppler/Vault. Theo prototype `devops.html` màn `#/env-sync` | fullstack-developer | Song song với T7 (sau T5) | `apps/web/src/features/environments/integrations-panel.tsx` |
| T7 | CLI `localman env pull <env> > .env`, `localman env push <env> --from .env`, `localman env sync-github <env> --repo owner/name` | fullstack-developer | Song song với T6 (sau T5) | `packages/localman-cli/src/commands/env.ts` |
| T8 | Test: `dotenv-codec` với dấu nháy, comment, chuỗi nhiều dòng, `export`; `github-secrets` với GitHub API giả cho đúng định dạng sealed box; Doppler và Vault chạy container dev: resolve lúc chạy, giá trị không có trong DB hay log, credential sai báo lỗi rõ | tester | — (sau T5–T7) | test của `apps/api/src/modules/env-integrations/`, `packages/shared` |
| T9 | Review cuối phase | code-reviewer | — | toàn phase |

### Checklist
- [ ] T1 GitHub App đã tạo sau khi user xác nhận (hoặc user chọn fine-grained PAT)
- [ ] T2 Import và export `.env` đúng luật secret
- [ ] T3 Đẩy GitHub secrets bằng sealed box, token lưu mã hoá
- [ ] T4 Resolver Doppler và Vault resolve lúc chạy, không lưu giá trị
- [ ] T5 Operation đủ, `env_sync_github` có dry-run
- [ ] T6 Panel tích hợp khớp prototype
- [ ] T7 3 lệnh `localman env` chạy đúng
- [ ] T8 Test pass
- [ ] T9 Review không còn finding mức high
- [ ] Verification: codec đúng mọi ca cú pháp; sealed box đúng định dạng; Doppler và Vault không để lại giá trị trong DB hay log; tool phá huỷ có dry-run kèm `confirm_token`
- [ ] lint/typecheck/test sạch: `biome check`, `tsc --noEmit`, test của `apps/api`, `packages/shared`, `packages/localman-cli`, `apps/web`
- [ ] `pnpm check:mcp-coverage` pass
