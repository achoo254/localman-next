---
phase: 3
title: "Guest link: xem bản đã che khi đăng nhập, xin quyền"
status: completed
priority: P2
effort: "M"
dependencies: [2]
---

# Phase 03: Guest link

## Goal
Thành viên Editor+ bật guest link; người đã đăng nhập mở link thấy bản đã che (cùng dữ liệu với public link) và nút
"Xin quyền chỉnh sửa". Mở link **không** cấp quyền nào; quyền thật chỉ có khi access request được duyệt.

## Bối cảnh đã kiểm
- Viewer nội bộ nhận dữ liệu thô (`apps/api/src/modules/collections/collection-view.ts:139-143`) và duplicate được
  (`collection-write-operations.ts:84`): lý do guest **không** nhận element role (quyết định của user 2026-10-14).
- Access request: `POST /elements/:elementType/:elementId/access-requests` (`USER_SCOPE`,
  `apps/api/src/modules/access/access-request-operations.ts:17-27`); duyệt qua `grantElementRole`
  (`access-request-resolution.ts:101-107`, `share-service.ts:58-80`); `assertShareable` từ chối workspace cá nhân
  (`share-service.ts:42-52`, 409 `PERSONAL_WORKSPACE`).
- Lời mời workspace gửi token trong body POST để nginx không ghi (`docs/operation-registry.md:111`,
  `workspaces/workspace-invite-token-operations.ts:24-25,79-80`).
- Phase 02 đã có `collection-link-model` (`kind: "guest"`), `canPublish`, `stillServable`, `guestsAllowed`, cây chỉ đọc
  và trang public.

## Files to Create / Modify
- Create `apps/api/src/modules/public-sharing/guest-link-operations.ts`:
  - `sharing.enableCollectionGuestLink` `POST /collections/:collectionId/guest-link` (`canPublish`, `guestsAllowed`
    bật, `dryRun` + `requiresConfirmation`, MCP tool); `getCollectionGuestLink` (readOnly); `disableCollectionGuestLink`
    (`destructive`, `dryRun`);
  - `sharing.viewGuestCollection` `POST /guest-links/view` body `{ linkId }` (`USER_SCOPE`, readOnly theo nghĩa không
    đổi dữ liệu, `mcp.exempt: "Trang cho người đã mở link trên trình duyệt"`): giới hạn theo user và IP, `stillServable`
    với công tắc `guestsAllowed`, trả `{ collectionId, name, description, tree: publicCollectionTree(...), updatedAt,
    canRequestAccess, alreadyHasAccess }`. `canRequestAccess` false khi workspace là cá nhân; `alreadyHasAccess` true
    khi user đã có vai trò (để trang đưa thẳng vào collection).
- Web: `apps/web/src/pages/guest/guest-collection-page.tsx` (route app `guest/:linkId`, có `RequireAuth`, gọi
  `viewGuestCollection`, dùng lại cây chỉ đọc và `public-request-view` của phase 02); nút "Xin quyền chỉnh sửa" mở form
  request access có sẵn (`features/sharing/request-access-form.tsx`) cho `collection/:id` với role editor; đã có quyền
  thì hiện "Mở trong workspace"; `features/public-sharing/guest-link-tab.tsx` (switch trong Share, cảnh báo secret).
- Modify `docs/api-contract.md` (mục của phase 02): thêm `viewGuestCollection`, `GUESTS_DISABLED`.

## Tasks & Steps
1. Operation + test: Viewer được share lẻ không bật được; guest thấy đúng bản đã che (bảng phase 01); mở link không tạo
   `element_roles`, không tạo thành viên; `guestsAllowed` tắt hoặc người tạo hết là Editor của workspace → 404 ngay;
   workspace cá nhân → `canRequestAccess: false`; cổng tắt → 404.
2. Luồng xin quyền: tạo access request từ trang guest; Admin/Editor duyệt bằng luồng sẵn có; sau duyệt người đó có
   quyền thật và `alreadyHasAccess: true`.
3. UI: trang guest (375 px, axe), tab guest, i18n.

## Verification
- `pnpm --filter @localman/api test -- guest`, test web cho trang guest.
- `pnpm check:mcp-coverage`.

## Rủi ro
- Guest link là capability lâu dài: id đi trong body POST và nằm trong map che log của phase 02; Editor thu hồi bằng
  cách tắt link.
