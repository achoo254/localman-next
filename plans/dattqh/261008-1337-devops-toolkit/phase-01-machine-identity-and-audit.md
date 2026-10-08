---
phase: 1
title: "Danh tính máy (service account, PAT có scope) và audit log"
status: pending
priority: P1
effort: "M"
dependencies: []
---

# Phase 01: Danh tính máy và audit log

## Goal
CI và script tự động xác thực được mà không cần user đăng nhập tương tác. Mọi hành động của người lẫn máy đều ghi audit.

## Thiết kế
- **Service account** ở IdP (`auth.hoandat.com`):
  - Thuộc một workspace của Localman, do Admin tạo.
  - Dùng grant `client_credentials` với `aud` là Localman hoặc Tunelo, kèm scope.
  - Secret chỉ hiện một lần và xoay vòng được.
- **Personal Access Token (PAT)** cho user: tạo ở `/account` của IdP, có scope và TTL (1 ngày đến 90 ngày), thu hồi được. Tiền tố `lmk_` cho Localman, `tlk_` cho Tunelo, để secret scanner của GitHub và GitLab nhận ra.
- **Scope mới:** `ci:run`, `mock:ephemeral`, `tunnels:open`, `tunnels:read`, `tunnels:access` (gọi API vào tunnel được chặn bằng SSO, xem phase 04), `env:read`, `env:write`, `config:sync`, `monitors:*`, `audit:read`.
- **Audit log:**
  - Mỗi bản ghi gồm `{at, actor (user|service-account|token), action, target, ip, userAgent, result}`.
  - Ghi cho các việc: đăng nhập, tạo hay thu hồi token, share, đổi quyền, đổi giá trị shared, xoá, mở tunnel, chạy CI, sync config.
  - Lưu 90 ngày; xuất CSV/JSON.
  - Xem ở Workspace settings › Audit (Admin).

## Hợp đồng với IdP (Jev 2026-10-08)
- Localman nhận sự kiện audit do IdP đẩy sang (0.94) ở `POST /internal/audit-events`: kiểm chữ ký JWS cùng client credentials của IdP, bỏ trùng theo `eventId`.
- Localman phục vụ `GET /internal/users/:sub/workspaces` (0.78) cho IdP và Tunelo. Route nội bộ này không phải tool cho agent, nên đánh dấu `mcp: {exempt: 'route nội bộ giữa các dịch vụ'}` trong registry.

## Files to Create / Modify
- IdP (`hoandat-auth`): `src/accounts/service-account-model.ts`, `src/accounts/pat-model.ts` (lưu hash), `src/oidc/client-credentials-policy.ts`, và trang `/account/tokens`, `/workspace/service-accounts`.
- Localman (`apps/api/src/modules/audit/`): `audit-log-model.ts` (TTL index 90 ngày), `audit-service.ts` (ghi bất đồng bộ), `audit-routes.ts` (lọc, xuất file). Thêm middleware gọi `audit-service` sau mỗi hành động ghi.
- Localman và Tunelo xác minh PAT bằng endpoint introspection của IdP, có cache 60 giây; xác minh token của service account bằng JWKS.
- `apps/web/src/features/audit/audit-page.tsx`.

## Verification
- Mọi operation của phase này có MCP tool trong toolset tương ứng (`pnpm check:mcp-coverage`); tool phá huỷ có dry-run kèm `confirm_token`.
- Token của service account sai `aud` hoặc thiếu scope bị từ chối. PAT hết hạn hoặc đã thu hồi trả 401 trong vòng tối đa 60 giây.
- Mỗi loại hành động ở trên sinh đúng một bản ghi audit; file xuất ra không chứa token.
- Secret scanner: tiền tố `lmk_` và `tlk_` có regex đã đăng ký trong docs (đăng ký với GitHub secret scanning partner là follow-up).

## Giao việc
**Đợt:** 9 · **Phụ thuộc trước khi bắt đầu:** plan IdP và plan Tunelo đã xong, IdP chạy production; Localman phase 11 (workspace, vai trò) và phase 17 (MCP sinh từ operation registry) đã merge. Việc T1–T3 làm ở repo `hoandat-auth`, các việc còn lại ở monorepo `localman-next` · **Lệnh cook:** `/ak:cook plans/dattqh/261008-1337-devops-toolkit/phase-01-machine-identity-and-audit.md`

| # | Việc | Vai trò | Song song | File chính |
|---|---|---|---|---|
| T1 | [hoandat-auth] Service account thuộc workspace Localman: secret lưu hash, chỉ hiện một lần, xoay vòng được; policy `client_credentials` với `aud` là Localman hoặc Tunelo kèm scope; đăng ký các scope mới (`ci:run`, `mock:ephemeral`, `tunnels:access`, `env:read`, `env:write`, `config:sync`, `monitors:*`, `audit:read`) | fullstack-developer | Song song với T4 | `src/accounts/service-account-model.ts`, `src/oidc/client-credentials-policy.ts`, `src/oidc/provider.ts` |
| T2 | [hoandat-auth] PAT: lưu hash, tiền tố `lmk_` cho Localman và `tlk_` cho Tunelo, scope, TTL từ 1 tới 90 ngày, thu hồi được; endpoint introspection trả trạng thái PAT | fullstack-developer | — (sau T1, cùng `provider.ts`) | `src/accounts/pat-model.ts`, `src/oidc/provider.ts` |
| T3 | [hoandat-auth] Trang `/account/tokens` và `/workspace/service-accounts`: tạo, hiện secret một lần, thu hồi, xoay vòng. Theo prototype `../261008-1123-localman-core/prototype/devops.html` màn `#/tokens` và `#/service-accounts` | fullstack-developer | — (sau T2) | `src/account-portal/` (trang tokens và service accounts) |
| T4 | Module audit: model có TTL index 90 ngày, service ghi bất đồng bộ, operation lọc và xuất CSV/JSON (toolset `admin`, scope `audit:read`), middleware ghi sau mỗi hành động ghi; file xuất không chứa token | fullstack-developer | Song song với T1 | `apps/api/src/modules/audit/audit-log-model.ts`, `audit-service.ts`, `audit-routes.ts` |
| T5 | Localman nhận token máy: PAT qua introspection có cache 60 giây, token service account qua JWKS; mỗi lần dùng ghi audit; operation tạo hoặc xoay credential cần `credentials:write` | fullstack-developer | Song song với T6 (sau T2, T4) | `apps/api/src/http/require-auth.ts`, `apps/api/src/modules/auth/` |
| T6 | Tunelo server nhận token máy: PAT `tlk_` qua introspection có cache 60 giây, token service account qua JWKS cùng bộ verifier hiện có | fullstack-developer | Song song với T5 | `apps/tunelo-server/src/auth/` |
| T7 | Trang Audit trong Workspace settings (chỉ Admin): lọc, xuất file. Theo prototype `devops.html` màn `#/audit` | fullstack-developer | Song song với T5, T6 (sau T4) | `apps/web/src/features/audit/audit-page.tsx` |
| T8 | Docs: regex của tiền tố `lmk_` và `tlk_` cho secret scanner, cách dùng PAT và service account trong CI | docs-manager | Song song với T7 | `docs/` (trang token máy, chọn theo cấu trúc docs hiện có) |
| T9 | Test: token service account sai `aud` hoặc thiếu scope bị từ chối; PAT hết hạn hoặc đã thu hồi trả 401 trong tối đa 60 giây; mỗi loại hành động sinh đúng một bản ghi audit; file xuất không chứa token; tool phá huỷ có dry-run kèm `confirm_token` | tester | — (sau T5–T7) | test của `apps/api/src/modules/audit/`, `apps/api/src/http/`, `apps/tunelo-server/src/auth/`, repo `hoandat-auth` |
| T10 | Deploy thay đổi IdP lên production (cần user xác nhận) | fullstack-developer (hạ tầng) | — (sau T9) | VPS `auth.hoandat.com` |
| T11 | Review cuối phase | code-reviewer | — | toàn phase |

### Checklist
- [ ] T1 Service account, `client_credentials` và scope mới chạy ở IdP
- [ ] T2 PAT có tiền tố, TTL, thu hồi và introspection
- [ ] T3 Trang tokens và service accounts khớp prototype
- [ ] T4 Module audit ghi, lọc, xuất; TTL 90 ngày
- [ ] T5 Localman nhận PAT và service account, có cache 60 giây
- [ ] T6 Tunelo server nhận PAT và service account
- [ ] T7 Trang Audit chỉ Admin thấy, xuất được file
- [ ] T8 Docs regex tiền tố đã viết
- [ ] T9 Test pass
- [ ] T10 IdP production đã cập nhật sau khi user xác nhận
- [ ] T11 Review không còn finding mức high
- [ ] Verification: sai `aud` hoặc thiếu scope bị từ chối; PAT thu hồi trả 401 trong 60 giây; mỗi hành động một bản ghi audit, file xuất không có token; tiền tố có regex trong docs
- [ ] lint/typecheck/test sạch: `biome check`, `tsc --noEmit`, test của các package bị chạm (cả hai repo)
- [ ] `pnpm check:mcp-coverage` pass
