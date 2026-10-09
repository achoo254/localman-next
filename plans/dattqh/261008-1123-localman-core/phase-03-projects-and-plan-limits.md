---
phase: 3
title: "Projects và giới hạn gói"
status: pending
priority: P1
effort: "M"
dependencies: [2]
---

# Phase 03: Projects và giới hạn gói

## Goal
Làm CRUD và clone project, áp giới hạn gói Free/Pro ở server, và dựng màn Projects giống nguồn.

## Files to Create / Modify
- Create `apps/api/src/modules/projects/project-model.ts`: `{name, prefix, secret (nanoid 24, unique index), owner, createdAt}`
- Create `apps/api/src/modules/projects/project-routes.ts`, `project-service.ts`, `project-access.ts` (owner hoặc collaborator đã accepted; dùng làm filter dùng chung cho mọi truy vấn)
- Create `apps/api/src/modules/billing/plan-guard.ts` (dùng `limitsFor` từ shared, ném `PlanLimitError` với code `PLAN_LIMIT_REACHED`)
- Create `apps/api/scripts/set-user-plan.ts`: CLI cho admin gán `plan` và `planExpiresAt`. Đây là cách thay thế tạm cho tới khi có billing.
- Create `apps/web/src/pages/projects/projects-page.tsx`, `project-row.tsx`, `project-avatar.tsx`, `project-actions-menu.tsx`, `project-form-modal.tsx`, `delete-project-modal.tsx`
- Create `apps/web/src/features/subscription/manage-subscription-modal.tsx`: hiện cảnh báo hạn mức và 2 thẻ gói. Thẻ Pro **không có giá**; nút "Liên hệ nâng cấp" mở form quan tâm Pro (user chốt 2026-10-08, xem bên dưới).
- Create `apps/web/src/features/subscription/pro-interest-form.tsx` và `apps/api/src/modules/feedback/pro-interest-*` (phase này tạo nền module `feedback` có field `type`, dùng `type: 'pro_interest'`; phase 08 chạy sau và thêm `type: 'contact'` vào cùng module, không viết module mới).

## Tasks & Steps
1. Các route API:
   - `GET /api/projects` trả project user sở hữu và project user được mời.
   - `POST /api/projects`, `PUT /api/projects/:id`, `DELETE /api/projects/:id` (xoá cascade resources, records và collaborators).
   - `POST /api/projects/:id/clone` copy schema, cây resource và dữ liệu, đồng thời sinh secret mới.
2. Validate theo regex của nguồn: tên `^[\w -]*$` (cho phép thêm ký tự tiếng Việt), prefix `^[\w\-/]*$`, và chuẩn hoá prefix khi blur thành `/x/y` (có `/` đầu, không có `/` cuối).
3. Giới hạn gói tính trên project do user **sở hữu**, không tính project được mời. Khi vượt trả 403 `PLAN_LIMIT_REACHED`.
   - `project-access.ts` để lộ ra đúng một hàm `can(user, action, project)`, mọi route chỉ gọi hàm này. Nhờ vậy phase 11 thay ruột bằng `access-policy` chung mà không phải sửa các route.
4. UI giống nguồn:
   - Breadcrumb "Projects /" cùng nút `+` vuông màu primary.
   - Avatar chữ cái, màu theo chữ đầu chia 7 nhóm, map sang 7 thang màu Radix (bước 9 làm nền, bước 1 làm chữ) cho đạt WCAG.
   - Menu ⋮ gồm Collaborators, Magic link, Clone, Edit, Delete (Delete màu error).
   - Trạng thái rỗng "Chưa có project nào…".
   - Gặp `PLAN_LIMIT_REACHED` thì mở modal Quản lý gói.
   - Trang Account có **đồng hồ hạn mức**: số project, request tới mock và request qua proxy đã dùng trong tháng so với hạn mức; từ 80% chuyển màu cảnh báo.

## Form quan tâm gói Pro (user chốt 2026-10-08)
Mục đích: biết có bao nhiêu người muốn dùng Pro, thay cho giá "chưa chốt". **Không có mail server**, nên form chỉ thu email để sau này liên hệ, hệ thống không gửi email nào.
- **Trường:** email (đã đăng nhập thì điền sẵn từ IdP, sửa được), tên, nhu cầu (chọn nhiều: mock, API client, team, DevOps/CI, MCP, Tunelo), quy mô team (1, 2–5, 6–20, >20), mức giá sẵn sàng trả (tuỳ chọn), ghi chú, cùng **ô đồng ý** cho phép lưu email để liên hệ về gói Pro (đúng luật bảo vệ dữ liệu cá nhân, có hiệu lực từ 2026).
- **Mở form từ:** thẻ Pro trên landing (không cần đăng nhập), modal Quản lý gói, và mọi nút "Xem gói" hay `PLAN_LIMIT_REACHED`. Form tự ghi lại nguồn mở: landing, giới hạn project, giới hạn proxy, DevOps…
- **Khi gửi:**
  - Lưu `{email, userSub?, name, needs[], teamSize, priceHint?, note, source, consentAt, createdAt}`, gộp trùng theo email.
  - Bot Telegram báo về `OWNER_TELEGRAM_CHAT_ID` một tin ngắn (nhu cầu, quy mô, nguồn); địa chỉ email bị che một phần.
  - User thấy màn "Đã ghi nhận, sẽ liên hệ qua email bạn để lại".
- **Chống spam:** rate-limit theo IP, honeypot, và Cloudflare Turnstile (miễn phí) cho người chưa đăng nhập.
- **Trang admin `/admin/pro-interest`** (chỉ owner): tổng số người quan tâm, số mới trong 7 và 30 ngày, biểu đồ theo nguồn và theo nhu cầu, danh sách có lọc, xuất CSV, đánh dấu "đã liên hệ", xoá theo yêu cầu của người đăng ký.

## Verification
- Form quan tâm Pro: gửi khi chưa đăng nhập (có Turnstile) và khi đã đăng nhập (email điền sẵn); thiếu ô đồng ý thì không gửi được; gửi lại cùng email thì cập nhật bản ghi cũ chứ không tạo bản mới; bot Telegram nhận đúng một tin (dùng mock); trang admin đếm đúng; user thường gọi API admin thì nhận 403.
- Integration: user Free tạo được 3 project, bị 403 ở project thứ 4. User Pro tạo được 20 và bị chặn ở project thứ 21. Số liệu lấy từ `plan-limits`, test không hardcode. Clone đúng cây resource và secret mới khác secret cũ.
- Access: user B không đọc, sửa hay xoá được project của user A (trả 404, không phải 403, để không lộ project tồn tại).
- UI: so khớp với prototype màn `#/projects` ở 375px và 1440px.

## Giao việc
**Đợt:** 2 · **Phụ thuộc trước khi bắt đầu:** phase 02 (phiên đăng nhập, module `notifications` dùng cho bot Telegram) · **Lệnh cook:** `/ak:cook plans/dattqh/261008-1123-localman-core/phase-03-projects-and-plan-limits.md`

| # | Việc | Vai trò | Song song | File chính |
|---|---|---|---|---|
| T1 | Đối chiếu prototype `prototype/index.html#/projects` (hàng project, avatar 7 nhóm màu, menu ⋮, trạng thái rỗng, `openProjectForm`, `openSubscription`, `openProInterest`), `#/account` (đồng hồ hạn mức) và `#/admin/pro-interest`; chốt state và `data-id` cho T6, T7, T5 | ui-ux-designer | với T2, T3, T4 | `prototype/index.html` (chỉ đọc) |
| T2 | Module projects: model (secret nanoid 24, unique index), service, operation CRUD và clone qua registry (clone copy schema, cây resource, dữ liệu, sinh secret mới; xoá thì cascade). Zod tên và prefix đặt ở `packages/shared` kèm chuẩn hoá prefix. `project-access.ts` chỉ để lộ `can(user, action, project)`; người không có quyền nhận 404 | fullstack-developer | với T1, T4 | `apps/api/src/modules/projects/*`, `packages/shared/src/project-schema.ts` |
| T3 | Giới hạn gói: `plan-guard.ts` ném `PLAN_LIMIT_REACHED` theo `limitsFor`, chỉ đếm project user sở hữu; CLI `set-user-plan.ts`; operation `GET /api/account/usage` trả số project và bộ đếm tháng của mock và proxy (model bộ đếm `ownerId` + `yyyymm` đặt ở `billing`, phase 05 và 10 ghi vào, chưa có thì 0) | fullstack-developer | — (sau T2) | `apps/api/src/modules/billing/{plan-guard,usage-counter-model}.ts`, `apps/api/scripts/set-user-plan.ts` |
| T4 | Nền module `feedback` (phase 08 dùng lại với `type: 'contact'`): model có `type`, lưu form quan tâm Pro, gộp trùng theo email, bắt buộc `consentAt`, báo Telegram về `OWNER_TELEGRAM_CHAT_ID` với email che một phần, rate-limit theo IP, honeypot, xác minh Cloudflare Turnstile cho khách | fullstack-developer | với T1, T2 | `apps/api/src/modules/feedback/*` |
| T5 | Trang admin `/admin/pro-interest` (chỉ owner): operation thống kê tổng, mới 7 và 30 ngày, theo nguồn và nhu cầu, danh sách có lọc, xuất CSV, đánh dấu "đã liên hệ", xoá theo yêu cầu; trang web tương ứng | fullstack-developer | với T6 (sau T4) | `apps/api/src/modules/feedback/pro-interest-admin-*.ts`, `apps/web/src/pages/admin/pro-interest-page.tsx` |
| T6 | Màn Projects: `projects-page`, `project-row`, `project-avatar`, `project-actions-menu` (Clone, Edit, Delete màu error; mục Collaborators và Magic link do phase 07 thêm), `project-form-modal`, `delete-project-modal`, breadcrumb "Projects /" với nút `+`, trạng thái rỗng, gặp `PLAN_LIMIT_REACHED` thì mở modal Quản lý gói | fullstack-developer | với T5, T7 (sau T1, T2) | `apps/web/src/pages/projects/*` |
| T7 | `manage-subscription-modal` (thẻ Pro không có giá, nút "Liên hệ nâng cấp"), `pro-interest-form` (điền sẵn email, ghi nguồn mở, Turnstile cho khách, ô đồng ý bắt buộc), đồng hồ hạn mức ở trang Account (từ 80% chuyển màu cảnh báo) | fullstack-developer | với T5, T6 (sau T3, T4) | `apps/web/src/features/subscription/*`, `apps/web/src/pages/account/*` |
| T8 | Integration: Free tạo 3 project và bị 403 ở project thứ 4, Pro bị chặn ở project thứ 21 (số lấy từ `plan-limits`); clone đúng cây và secret mới; user B nhận 404 với project của A; form Pro (khách có Turnstile, đã đăng nhập điền sẵn email, thiếu đồng ý bị chặn, gộp trùng, Telegram mock nhận đúng 1 tin, admin đếm đúng, user thường gọi API admin nhận 403) | tester | với T9 | `apps/api/src/modules/{projects,billing,feedback}/*.test.ts` |
| T9 | So khớp UI với prototype `#/projects` ở 375px và 1440px; chạy `pnpm check:tokens` trên file mới | ui-ux-designer | với T8 | `apps/web/src/pages/projects/*`, `apps/web/src/features/subscription/*` |
| T10 | Review cuối phase | code-reviewer | — | toàn phase |

### Checklist
- [x] T1 State và `data-id` của màn Projects, Account và admin đã chốt theo prototype
- [x] T2 Module projects với CRUD, clone và `can()` xong
- [x] T3 `plan-guard`, CLI gán gói và operation usage xong
- [x] T4 Nền module `feedback` cho form quan tâm Pro xong
- [x] T5 Trang admin `/admin/pro-interest` xong
- [x] T6 Màn Projects xong
- [x] T7 Modal gói, form quan tâm Pro và đồng hồ hạn mức xong
- [x] T8 Integration pass
- [x] T9 UI khớp prototype ở 375px và 1440px (chụp và đo trên stack local IdP + API + Vite bằng agent-browser, light và dark; 4 lỗi cần sửa đã sửa và kiểm lại)
- [x] T10 Review không còn finding chặn
- [x] Verification: Free tạo được 3 project, bị 403 `PLAN_LIMIT_REACHED` ở project thứ 4; Pro bị chặn ở project thứ 21; test không hardcode số
- [x] Verification: clone đúng cây resource, secret mới khác secret cũ (phase này chưa có resource: clone và cascade đi qua hook `registerProjectDependent`, phase 04 đăng ký cây resource và dữ liệu)
- [x] Verification: user B đọc, sửa, xoá project của user A đều nhận 404
- [x] Verification: form Pro chặn khi thiếu đồng ý, gộp trùng theo email, bot Telegram nhận đúng 1 tin, admin đếm đúng, user thường nhận 403 ở API admin
- [x] Verification: UI khớp prototype `#/projects` ở 375px và 1440px
- [x] `pnpm lint && pnpm typecheck && pnpm test` sạch
- [x] `pnpm check:mcp-coverage` pass
