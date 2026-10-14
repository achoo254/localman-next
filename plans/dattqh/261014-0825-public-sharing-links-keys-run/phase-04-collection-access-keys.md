---
phase: 4
title: "Collection Access Key và JSON chỉ đọc"
status: completed
priority: P2
effort: "M"
dependencies: [1, 2]
---

# Phase 04: Collection Access Key

## Goal
Thành viên Editor+ tạo key chỉ đọc cho một collection để script hay CI lấy JSON v2.1 đã che, luôn là bản hiện tại; key
hiện một lần, thu hồi được, hết hạn sau 60 ngày không dùng, và ngừng ngay khi Admin tắt `accessKeysAllowed`.

## Bối cảnh đã kiểm
- Token đã có hai bản sinh và băm: `apps/api/src/modules/mcp/mcp-token-model.ts:8,42-73` (`MCP_TOKEN_PREFIX`,
  `newMcpToken`, `tokenMatches`) và `apps/api/src/modules/collaborators/invite-token.ts:25-36`.
- `createsCredential` tự thêm scope `credentials:write`, không được là operation công khai
  (`packages/operations/src/define-operation.ts:91`, `docs/operation-registry.md:85`).
- Mount thật của operation là `/api/v1` (`apps/api/src/dashboard-server.ts:21`).
- Log request chỉ ghi route mẫu, không ghi query (`apps/api/src/http/request-log.ts:95-106`); nginx bỏ query
  (`infra/localman/nginx/localman-http.conf:44-49`).
- `takeRateLimitSlot` upsert một document mỗi bucket (`apps/api/src/lib/rate-limit-windows.ts:66-85`).
- Phase 02: `canPublish`, `stillServable`, `accessKeysAllowed`, map che log, zone nginx cho `/api/v1/public/`.

## Files to Create / Modify
- Create `apps/api/src/lib/prefixed-token.ts`: `issuePrefixedToken(prefix)` (32 byte base64url, trả `{ token, hash,
  last4 }`) và `hashToken`; chuyển `newMcpToken` sang dùng nó (giữ hành vi, test MCP token chạy lại).
- Create `apps/api/src/modules/public-sharing/collection-access-key-model.ts`: `{ collectionId, userId, name, keyHash,
  last4, lastUsedAt? }` (timestamps, không `workspaceId`); prefix `lmck_`; index `{ keyHash: 1 }` unique,
  `{ collectionId: 1, userId: 1 }`. Thu hồi = xoá.
- Create `collection-access-key-service.ts`: tạo (`canPublish`, `accessKeysAllowed`, tối đa 10 key mỗi user mỗi
  collection, cảnh báo secret ở UI); liệt kê (của mình; Admin thấy mọi key của collection); thu hồi (chủ key hoặc
  Admin); xác thực: `findOne({ keyHash: hashToken(presented) })`, đúng `collectionId`, `(lastUsedAt ?? createdAt) + 60
  ngày` còn hạn, collection còn sống, `stillServable` với công tắc `accessKeysAllowed` (người tạo vẫn là thành viên
  Editor+).
- Create `access-key-operations.ts`:
  - `sharing.createCollectionAccessKey` `POST /collections/:collectionId/access-keys` (`createsCredential`, trả key một
    lần, MCP tool);
  - `sharing.listCollectionAccessKeys` (readOnly, MCP tool, không bao giờ trả hash);
  - `sharing.revokeCollectionAccessKey` `DELETE …/access-keys/:keyId` (`destructive`, `dryRun`, MCP tool);
  - `public.getCollectionByAccessKey` `GET /public/collections/:collectionId?access_key=…` (URL thật
    `/api/v1/public/collections/:collectionId`; `scopes: []`, readOnly, `mcp.exempt`): **giới hạn theo IP trước** mọi
    tra cứu; sau khi key khớp mới tính giới hạn theo key; mọi lỗi xác thực 401 `ACCESS_KEY_INVALID` một thông điệp;
    trả `exportCollectionV21(publicCollectionTree(...))`; cập nhật `lastUsedAt` tối đa mỗi giờ một lần (ghi sổ; ghi
    chú trong code vì sao vẫn là readOnly).
- Modify `apps/api/src/config/runtime-settings.ts`: `accessKeyPerIp`, `accessKeyPerKey`.
- Modify chỗ purge collection: xoá key của nó.
- Web: `features/public-sharing/access-keys-tab.tsx` (tạo có tên, cảnh báo secret, `CopyField` hiện một lần, danh sách
  tên/last4/lần dùng cuối/ngày hết hạn, thu hồi có xác nhận, lệnh `curl` mẫu với `<YOUR_KEY>`).
- Modify `docs/api-contract.md` (mục của phase 02): endpoint key, `ACCESS_KEY_INVALID`.

## Tasks & Steps
1. `prefixed-token` + chuyển `newMcpToken`; test MCP token cũ pass.
2. Model + service + test mọi nhánh 401 (sai key, key collection khác, quá 60 ngày, người tạo không còn Editor+ của
   workspace, `accessKeysAllowed` tắt, collection ở thùng rác, cổng tắt) cùng thông điệp.
3. Operation công khai: payload sạch (bảng phase 01); key ngẫu nhiên liên tục từ một IP nhận 429 mà không tạo document
   theo từng key; dòng log của route không chứa `access_key` (`apps/api/src/test-support/log-capture.ts`).
4. UI tab; i18n.

## Verification
- `pnpm --filter @localman/api test -- access-key mcp-token`; `pnpm check:mcp-coverage` (tạo key có
  `credentials:write`).

## Rủi ro
- Key trong query string (hợp đồng kiểu Postman) dễ lọt vào log của bên gọi: UI khuyên giữ như mật khẩu; phía ta che.
