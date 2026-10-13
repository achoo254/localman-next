---
phase: 7
title: "Collaboration và magic link"
status: completed
priority: P2
effort: "M"
dependencies: [3]
---

# Phase 07: Collaboration và magic link

## Goal
Owner mời được collaborator ở mọi gói, không qua email (phase 02). Free tối đa 3 người mỗi project tính cả owner; Pro tối đa 10 (Jev 0.70 và 0.66, lấy theo `membersPerWorkspace`). Collaborator accept rồi được thao tác project như owner, trừ xoá project và quản lý thành viên. Magic link cho phép chia sẻ quyền tham gia qua một đường link.

## Files to Create / Modify
- Create `apps/api/src/modules/collaborators/collaborator-model.ts`: `{mockId(projectId), inviteeEmail?, inviteeUserId?, inviteTokenHash, expiresAt, status:'pending'|'accepted', invitedBy, createdAt}` với index unique `(mockId, inviteeUserId)` và `(mockId, inviteeEmail)`
- Create `apps/api/src/modules/collaborators/collaborator-routes.ts`:
  - `GET /api/projects/:id/collaborators`
  - `POST /api/collaborators` nhận `{usernameOrEmail, mockId}`, trả `{inviteLink}` (chỉ hiện một lần)
  - `DELETE /api/collaborators/:id` (owner xoá người khác, hoặc collaborator tự rời)
  - `PUT /api/collaborators/:id/accept`
- Create `apps/api/src/modules/collaborators/magic-link-service.ts`: token ký, có hạn và thu hồi được, lưu `{projectId, tokenHash, expiresAt, revokedAt}`. Ngữ nghĩa: link mời; ai đã đăng nhập mà mở link thì được thêm làm collaborator (user chốt 2026-10-08)
- Modify `apps/api/src/modules/projects/project-access.ts` để thêm vai trò collaborator
- Create `apps/web/src/features/collaborators/collaborators-modal.tsx`, `collaborator-row.tsx`, `magic-link-modal.tsx`, `apps/web/src/pages/accept-invite-page.tsx`

## Tasks & Steps
1. Mời người:
   - Chỉ owner mời được. Số người (gồm lời mời đang chờ) không vượt `membersPerWorkspace` của gói chủ project.
   - Mời không qua email (Jev 0.97): owner nhập **username hoặc email**.
     - Người đó đã có tài khoản thì nhận thông báo qua các kênh của phase 02 (trong app, Web Push, Telegram).
     - Chưa có tài khoản thì owner bấm **copy link mời dùng một lần** (TTL 7 ngày) và tự gửi qua Zalo, Telegram hay kênh khác.
     - Dialog mời hiện tên và avatar của tài khoản khớp, kèm nhãn "email chưa xác minh" nếu có, để owner nhận ra tài khoản giả.
   - Link có dạng `/invite/:token`. Người nhận chưa có tài khoản thì đăng ký trước rồi tự quay lại link này.
2. Accept cần **link token** và thêm một trong hai điều kiện:
     - lời mời đã gắn với đúng tài khoản (khi mời bằng username, hoặc email khớp một tài khoản lúc mời); hoặc
     - email đã xác minh bằng Google/GitHub khớp với email được mời.
   Email/password chưa xác minh mà chỉ khớp chữ email thì **không đủ** để accept.
   Thoả điều kiện thì đặt `status=accepted` và redirect về `/projects/:id`.
3. Danh sách thành viên: owner có badge "owner", collaborator hiện badge trạng thái pending hoặc accepted. Animation thêm/xoá giống nguồn (thay framer-motion bằng CSS transition 200ms).
4. Phân quyền:
   - Collaborator thao tác resource và dữ liệu được, và được dùng tính năng Pro theo gói của owner.
   - Collaborator không xoá hay sửa thông tin project, không quản lý thành viên.

## Verification
- Integration: luồng mời, accept rồi truy cập. Accept bằng tài khoản không thoả điều kiện, như email/password chưa xác minh chỉ khớp chữ email, trả 403. Link dùng lại hoặc hết hạn thì bị từ chối. Thông báo mời tới đúng kênh. Owner gói Free mời người thứ 3 thì được, mời người thứ 4 thì trả 403 `PLAN_LIMIT_REACHED`. Collaborator tự rời xong thì mất quyền truy cập.
- Magic link: hết hạn, đã thu hồi hoặc dùng lại sai project đều bị từ chối.

## Giao việc
**Đợt:** 2 · **Phụ thuộc trước khi bắt đầu:** phase 03 (`project-access.ts`, `plan-guard`); module `notifications` của phase 02 · **Lệnh cook:** `/ak:cook plans/dattqh/261008-1123-localman-core/phase-07-collaboration-and-magic-link.md`

| # | Việc | Vai trò | Song song | File chính |
|---|---|---|---|---|
| T1 | Đối chiếu prototype `prototype/index.html#/projects`: modal Collaborators (`openCollaborators`), modal Magic link (`openMagicLink`) và trang nhận lời mời; chốt state (pending, accepted, owner, "email chưa xác minh", link hết hạn) và `data-id` | ui-ux-designer | với T2 | `prototype/index.html` (chỉ đọc) |
| T2 | `collaborator-model.ts` và operation qua registry: liệt kê, mời bằng username hoặc email (trả `inviteLink` dùng một lần TTL 7 ngày, chỉ hiện một lần; trả tên, avatar và nhãn "email chưa xác minh" của tài khoản khớp), xoá hoặc tự rời; giới hạn `membersPerWorkspace` tính cả lời mời đang chờ; gửi thông báo mời qua `notification-service` | fullstack-developer | với T1 | `apps/api/src/modules/collaborators/{collaborator-model,collaborator-routes}.ts` |
| T3 | `magic-link-service.ts` (token ký, hash, có hạn, thu hồi được) và accept: cần link token cùng một trong hai điều kiện ở bước 2 (lời mời gắn đúng tài khoản, hoặc email đã xác minh qua Google/GitHub khớp); sửa `project-access.ts` thêm vai trò collaborator (không xoá, không sửa project, không quản lý thành viên) | fullstack-developer | — (sau T2) | `apps/api/src/modules/collaborators/magic-link-service.ts`, `apps/api/src/modules/projects/project-access.ts` |
| T4 | Web: `collaborators-modal`, `collaborator-row` (badge owner/pending/accepted, CSS transition 200ms), `magic-link-modal`, `accept-invite-page` (chưa có tài khoản thì đăng ký rồi quay lại `/invite/:token`, accept xong về `/projects/:id`); thêm mục Collaborators và Magic link vào `project-actions-menu.tsx` | fullstack-developer | với T3 (sau T1, T2) | `apps/web/src/features/collaborators/*`, `apps/web/src/pages/accept-invite-page.tsx`, `apps/web/src/pages/projects/project-actions-menu.tsx` |
| T5 | Integration: mời, accept, truy cập; email/password chưa xác minh chỉ khớp chữ email bị 403; link dùng lại hoặc hết hạn bị từ chối; thông báo tới đúng kênh; Free mời người thứ 3 được, người thứ 4 bị 403 `PLAN_LIMIT_REACHED`; tự rời thì mất quyền; magic link hết hạn, đã thu hồi hoặc sai project bị từ chối | tester | — | `apps/api/src/modules/collaborators/*.test.ts` |
| T6 | Review cuối phase, ưu tiên điều kiện accept và chống chiếm quyền qua email chưa xác minh | code-reviewer | — | toàn phase |

### Checklist
- [x] T1 State và `data-id` của modal và trang mời đã chốt theo prototype
- [x] T2 Model, operation mời, liệt kê, xoá và giới hạn thành viên xong
- [x] T3 Magic link, điều kiện accept và vai trò collaborator xong
- [x] T4 Modal, trang accept và mục menu xong
- [x] T5 Integration pass
- [x] T6 Review không còn finding chặn
- [x] Verification: luồng mời, accept rồi truy cập chạy đúng; tài khoản không thoả điều kiện accept nhận 403
- [x] Verification: link dùng lại hoặc hết hạn bị từ chối; thông báo mời tới đúng kênh
- [x] Verification: owner Free mời người thứ 3 được, người thứ 4 nhận 403 `PLAN_LIMIT_REACHED`; collaborator tự rời thì mất quyền
- [x] Verification: magic link hết hạn, đã thu hồi hoặc dùng sai project đều bị từ chối
- [x] `pnpm lint && pnpm typecheck && pnpm test` sạch
- [x] `pnpm check:mcp-coverage` pass
