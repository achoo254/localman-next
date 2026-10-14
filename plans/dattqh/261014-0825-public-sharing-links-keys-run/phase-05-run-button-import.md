---
phase: 5
title: "Nút Run in Localman, chế độ import"
status: completed
priority: P1
effort: "M"
dependencies: [1, 2]
---

# Phase 05: Nút Run in Localman (import)

## Goal
Thành viên Editor+ tạo nút Run cho collection (environment tuỳ chọn, visibility Team hoặc Public) và copy mã HTML hoặc
Markdown; người bấm đăng nhập, chọn workspace, xem trước (có liệt kê script) rồi import bản đã che vào đó.

## Bối cảnh đã kiểm
- Tạo collection từ `tree`: service `createCollection(sub, workspaceId, source)` (`apps/api/src/modules/collections/collection-service.ts:91`),
  `assertWorkspaceRoom` (`collection-store.ts:106`), `COLLECTION_BYTES_MAX` (`collection-bytes.ts:15`);
  `TREE_BODY_LIMIT` là bodyLimit HTTP, không áp cho tree dựng trên server (`collection-write-operations.ts:28,52`).
- Environment import nhận **file** Postman và kiểm quyền người gọi
  (`apps/api/src/modules/environments/environment-transfer-operations.ts:70-90`) nên cần tách lõi tạo environment.
- `deleteTeamWorkspace` xoá environment, collection vào thùng rác (`workspaces/workspace-service.ts:176-186`).
- Script đọc giá trị gửi đi và ghi local value (`packages/shared/src/api-client/environments/script-scope-values.ts:1-7`).
- Trang trong `publicRoutes`; `apiRequest` mặc định redirect khi 401 (`apps/web/src/lib/api-client.ts:69-74`);
  `useWorkspaces` cần phiên (`features/workspaces/current-workspace.ts:75-82`); `returnTo` an toàn phía server ở
  `apps/api/src/modules/auth/return-to.ts`.
- `frame-ancestors 'none'` cấm iframe; `check-tokens` chỉ quét `apps/web/src` (`scripts/check-tokens.ts:31-32`); màu
  có ở `packages/design-tokens/tokens.css:94-96`; `vite.config.ts` đã có plugin tự viết (`prerenderPages`).
- `location /` dùng `try_files $uri /index.html` (`infra/localman/nginx/localman-app.inc:158-160`).

## Files to Create / Modify
- Create `apps/api/src/modules/environments/environment-from-variables.ts`: `createEnvironmentFromVariables(sub,
  workspaceId, name, variables)`; `client.importEnvironment` gọi hàm này sau khi parse file (hành vi không đổi, test cũ
  pass).
- Create `apps/api/src/modules/public-sharing/run-button-model.ts`: `{ buttonId (16 byte base64url), collectionId,
  environmentId?, visibility: "team" | "public", createdBy }` (không `workspaceId`); index `{ buttonId: 1 }` unique,
  `{ collectionId: 1 }`. Xoá = xoá document; purge collection hoặc xoá environment thì xoá nút.
- Create `run-button-operations.ts`:
  - `sharing.createRunButton` `POST /collections/:collectionId/run-buttons` (`canPublish`; environment phải cùng
    workspace và người tạo có `shareVariables` trên nó; `visibility: "public"` cần `publicLinksAllowed`; `dryRun` +
    `requiresConfirmation` khi public; MCP tool); `sharing.listRunButtons` (readOnly); `sharing.deleteRunButton`
    (`destructive`, `dryRun`);
  - `client.getRunButton` `POST /run-buttons/preview` body `{ buttonId }` (`USER_SCOPE`, readOnly theo nghĩa không đổi
    dữ liệu, MCP tool): tên, mô tả, số request, có environment không, danh sách script (vị trí, không nội dung); nút
    `team` chỉ thành viên workspace nguồn thấy; `stillServable` mỗi lần; còn lại 404;
  - `client.importRunButton` `POST /run-buttons/import` body `{ buttonId, workspaceId, includeScripts, idempotencyKey }`
    (`USER_SCOPE`, `dryRun` + `requiresConfirmation`, MCP tool): người gọi Admin/Editor ở workspace đích; kiểm lại nút,
    collection nguồn (thùng rác → 404), environment (còn tồn tại, người tạo còn quyền); dựng `publicCollectionTree` +
    `publicEnvironment` trên server; bỏ script khi `includeScripts` false; kiểm kích thước bằng `MAX_IMPORT_BYTES`
    sau khi che; tạo qua `createCollection` và `createEnvironmentFromVariables`; cùng `idempotencyKey` trong 10 phút trả
    lại kết quả cũ; environment lỗi giới hạn → collection vẫn tạo, trả `environmentError` rõ ràng; giới hạn theo user.
- Create `packages/design-tokens/run-button.svg` (literal màu được phép ở package này) và test so màu SVG với
  `--c-primary-solid`, `--c-on-primary` trong `tokens.css`; plugin Vite nhỏ (`generateBundle`) copy file vào
  `dist/run-button.svg` để cả `pnpm build` lẫn `vite build` của stack e2e đều có; nginx `location = /run-button.svg {
  try_files $uri =404; }`.
- Web: `apps/web/src/pages/run/run-button-page.tsx` (route `run/:buttonId` trong `publicRoutes`, cờ `publicSharing`):
  chưa đăng nhập → bước 1 với `LoginLink` (`returnTo` là chính trang), không gọi API; đã đăng nhập → bước 2 chọn
  workspace (chỉ Admin/Editor), bước 3 xem trước và chọn có nhập script không (mặc định tắt với nút public, bật với nút
  team), bước 4 kết quả; mọi lời gọi `redirectOnUnauthorized: false`; `features/public-sharing/run-button-tab.tsx`
  (environment, visibility, cảnh báo secret, mã HTML `<a href=".../run/ID"><img src=".../run-button.svg" alt="Run in
  Localman"></a>` và Markdown `[![Run in Localman](.../run-button.svg)](.../run/ID)` qua `CodeBlock`, URL theo host
  của tenant).
- Modify `docs/api-contract.md` (mục của phase 02): endpoint nút Run.

## Tasks & Steps
1. `createEnvironmentFromVariables` + test cũ của environment import pass.
2. Model + operation + test: Editor được share lẻ không tạo được; Viewer của environment không gắn được environment;
   `team` chỉ thành viên thấy; import vào workspace mình là Viewer → 403; dữ liệu đã che (bảng phase 01); không nhập
   script khi `includeScripts` false; collection nguồn ở thùng rác → 404; cùng `idempotencyKey` → một collection;
   vượt `COLLECTIONS_PER_WORKSPACE_MAX` → lỗi của `createCollection`; `publicLinksAllowed` tắt → nút public 404.
3. Badge + plugin + nginx location; `pnpm --filter @localman/web build` sinh `dist/run-button.svg`.
4. Trang Run bốn bước (375 px, axe); i18n ba ngôn ngữ (chữ trên badge là "Run in Localman").

## Verification
- `pnpm --filter @localman/api test -- run-button environment`, test web trang Run.
- `pnpm check:tokens && pnpm check:mcp-coverage`.

## Rủi ro
- `returnTo` của trang Run: test `returnTo=/\t/evil.com` bị server từ chối (`return-to.ts`).
