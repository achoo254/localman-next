---
phase: 2
title: "Public link, trang chỉ đọc, cài đặt chia sẻ của workspace"
status: completed
priority: P1
effort: "M"
dependencies: [1]
---

# Phase 02: Public link, trang chỉ đọc, cài đặt chia sẻ

## Goal
Thành viên Editor+ bật được public link cho collection; ai có link xem bản đã che, không cần đăng nhập. Admin có ba
công tắc chia sẻ cho workspace. Phase này dựng model link, quyền "ai được công khai" và cây chỉ đọc mà phase 03–05
dùng lại.

## Bối cảnh đã kiểm
- Operation công khai: `scopes: []` (`packages/operations/src/types.ts:132`), GET phải `readOnly`
  (`define-operation.ts:74-77`), destructive bắt buộc `dryRun: true` (`docs/operation-registry.md:46`,
  `packages/operations/src/mcp-coverage.ts:74-78`), `requiresConfirmation` cần dry run (`types.ts:155-161`).
- `sharing.updateWorkspace` `PATCH /workspaces/:workspaceId` (Admin, MCP tool) đã có
  (`apps/api/src/modules/workspaces/workspace-crud-operations.ts:84-108`); workspace chưa có trường cài đặt
  (`workspace-model.ts:17-24`).
- Vai trò workspace và phần tử: `apps/api/src/modules/access/access-policy.ts:26-52`; quyền theo vai trò workspace ở
  `packages/shared/src/access-permissions.ts:30-56`.
- `move-service.ts:23-31`: chuyển collection giữ share; collection có `workspaceId` hiện tại
  (`collections/collection-model.ts:25-27`), đọc bằng `findLiveCollection` (`collection-store.ts:62`).
- Rate limit: `takeRateLimitSlot` (`apps/api/src/lib/rate-limit-windows.ts:68`), bucket IP `clientIpBucket`; mẫu ở
  `feedback/feedback-guards.ts:32-44`; giới hạn khai trong `config/runtime-settings.ts:103-131`.
- nginx: map log `$localman_logged_uri` chỉ che `/m/`, `/invite/`, query (`infra/localman/nginx/localman-http.conf:44-49`);
  `location /api/` không có `limit_req` (`localman-app.inc:25-28`), các zone ở `localman-http.conf:18-37`.
- Web: trang không đăng nhập ở `apps/web/src/routes/public-routes.tsx`; `apiRequest` mặc định redirect khi 401
  (`apps/web/src/lib/api-client.ts:69-74,105-111`); `AppLayout`/`PublicHeader` gọi `useCurrentUser`, nên người từng
  đăng nhập có thể đi một vòng silent sign-in (`features/auth/silent-sign-in.ts:24-33`) rồi quay lại đúng trang.
  `CollectionTree` cần prop của sidebar (`features/collections/collection-tree.tsx:14-38`), không dùng cho trang này.
  `ShareDialog` 170 dòng (`features/sharing/share-dialog.tsx`), test tab "Link" ở `share-dialog.test.tsx:147-158`.

## Files to Create / Modify
- Modify `workspace-model.ts`: `sharing: { publicLinksAllowed, guestsAllowed, accessKeysAllowed }` (boolean, mặc định
  true; document cũ đọc ra mặc định); `sharing.updateWorkspace` nhận thêm `sharing` (Admin). Tắt một công tắc là
  `destructive` có dry run (đếm link/key/nút sẽ ngừng): thêm trường vào operation hiện có hay tách
  `sharing.updateWorkspaceSharing` tuỳ registry cho phép khai `destructive` theo input; chọn khi làm và ghi lý do.
- Create `apps/api/src/modules/public-sharing/publish-access.ts`: `canPublish(userId, collection)` = vai trò
  **workspace** hiện tại của collection thuộc `WORKSPACE_PERMISSIONS.publishPublic`; `stillServable(record,
  collection)` = người tạo vẫn `canPublish` và công tắc tương ứng của workspace hiện tại còn bật. Dùng ở phase 02–05.
- Create `collection-link-model.ts`: `{ collectionId, kind: "public" | "guest", linkId, createdBy }` (timestamps,
  **không** `workspaceId`); `linkId` 32 byte base64url; index `{ linkId: 1 }` unique, `{ collectionId: 1, kind: 1 }`
  unique (plugin thêm `tenantId` đứng đầu). Thu hồi = xoá.
- Create `collection-link-service.ts`: bật (trả link đang có; bắt duplicate key rồi đọc lại khi hai người bật cùng
  lúc), đọc, thu hồi; phục vụ: tìm link → `findLiveCollection` → `stillServable` → nếu hỏng ở bất kỳ bước nào trả
  cùng một 404.
- Create `public-link-operations.ts`:
  - `sharing.enableCollectionPublicLink` `POST /collections/:collectionId/public-link` (`USER_SCOPE`, `canPublish`,
    `dryRun` + `requiresConfirmation`, MCP tool);
  - `sharing.getCollectionPublicLink` `GET /collections/:collectionId/public-link` (`USER_SCOPE`, Viewer+, readOnly);
  - `sharing.disableCollectionPublicLink` `DELETE …/public-link` (`destructive`, `dryRun`, không xác nhận);
  - `public.getPublicCollection` `GET /public/links/:linkId` (`scopes: []`, readOnly, `mcp.exempt`): giới hạn theo IP
    trước mọi tra cứu, trả `{ name, description, tree: publicCollectionTree(...), updatedAt }`, 404
    `PUBLIC_LINK_NOT_FOUND` một thông điệp.
- Modify `apps/api/src/config/runtime-settings.ts`: giới hạn `publicLinkPerIp` (cho e2e nâng lên).
- Modify chỗ purge collection: xoá link của nó.
- Modify `infra/localman/nginx/localman-http.conf`: map che `~^/(public/c|guest|run)/` và
  `~^/api/v1/(public/links|public/collections|guest-links|run-buttons)/` thành `[redacted]`; thêm zone `limit_req` cho
  `/api/v1/public/` và `location ^~ /api/v1/public/` trong `localman-app.inc`.
- Web: `apps/web/src/features/public-sharing/read-only-tree.tsx` (cây `role="tree"` chỉ mở/đóng, nhận
  `ImportedItem[]`, dùng lại `tree-keys`/phần hiển thị hàng nếu gọn); `public-request-view.tsx` (method, URL, header,
  body, auth đã che, example không body); `pages/public/public-collection-page.tsx` (route `public/c/:linkId` trong
  `publicRoutes`, chỉ khi cờ `publicSharing`; gọi API với `redirectOnUnauthorized: false`; 404/429 hiện trạng thái
  trống); `public-link-tab.tsx`, `secret-warning.tsx` (dùng `findSecretLikeValues`, liệt kê vị trí, câu "biến thường
  được công khai"); Share dialog thêm tab "Public" (file riêng; tab "Link" giữ nguyên); công tắc trong cài đặt
  workspace.
- Create `apps/web/src/i18n/messages/{en,vi,zh-CN}/public-sharing.ts`, khai trong `dictionary.ts`.
- Modify `docs/api-contract.md`: mục chia sẻ công khai (phase này sở hữu; phase 03–05 bổ sung dòng của mình).

## Tasks & Steps
1. Cài đặt `sharing` + `canPublish`/`stillServable` + test (Editor được share lẻ không công khai được; Admin tắt
   `publicLinksAllowed` → link đang có 404 ngay; chuyển collection sang workspace B → công tắc của B có hiệu lực).
2. Model + service + test (bật hai lần cùng link; hai lệnh bật song song chỉ còn một link; thu hồi rồi bật lại ra link
   mới; test gọi `Model.createIndexes()` thật).
3. Operation công khai + integration: payload sạch (bảng phase 01 trên dữ liệu Mongo thật); 404 giống nhau cho mọi
   nhánh; 429 theo IP; tenant B không đọc link của tenant A; cổng tắt → 404.
4. nginx: test cấu hình (chạy `nginx -t` trong deploy) và kiểm bằng mắt map che trên log local nếu có; ghi bước DAST.
5. Web: cây chỉ đọc, trang public (375 px, axe), tab Public, cảnh báo, công tắc; Share dialog đủ tab không cuộn ngang
   ở 375 px.

## Verification
- `pnpm --filter @localman/api test -- public-sharing workspaces`, `pnpm --filter @localman/web test -- public sharing`.
- `pnpm check:mcp-coverage && pnpm check:i18n && pnpm check:tokens`.
- `rg "acrossTenants|\.collection\.|workspaceId" apps/api/src/modules/public-sharing/*-model.ts` không ra kết quả.

## Rủi ro
- Nội dung do user viết (mô tả, body) chỉ render như text/Markdown sẵn có của app, không HTML thô.
