---
phase: 1
title: "Nền chung: serializer công khai, che credential, phát hiện secret, cổng, cờ"
status: completed
priority: P1
effort: "S"
dependencies: []
---

# Phase 01: Nền chung

## Goal
Một serializer duy nhất ở `packages/shared` biến collection và environment thành dữ liệu công khai đã che, một bộ phát
hiện giá trị trông giống secret cho cảnh báo, và cổng server cùng cờ web để chưa phát hành gì trước phase 06.

## Bối cảnh đã kiểm
- `exportCollectionV21` xuất nguyên auth (`packages/shared/src/api-client/export/collection-v21-request-export.ts:20-46`),
  header, và example (`collection-v21-export.ts:69`, `collection-v21-request-export.ts:65-76`: request gốc, header
  và body response); chỉ biến collection `secret` bị để trống (`collection-v21-export.ts:105-111`). Example:
  `packages/shared/src/api-client/import/imported-collection.ts:22-38`, `collections/collection-model.ts:69-90`.
- Logic che đã có ở web: `apps/web/src/features/api-client/history/redact-draft.ts` (`redactDraft`, và
  `hasBlankedSecrets` dùng ở `request/request-editor.tsx:11` và `pages/api-client/api-client-screen.tsx:9`),
  `routing/sensitive-parts.ts` (`isSensitiveName`, `isLiteralValue`), `request/params-sync.ts` (`urlWithParams`,
  `paramsFromUrl` giữ nguyên văn cặp không đổi, `:93-121`).
- **Không** dùng `buildUrlWithParams` của shared để dựng lại URL: nó dựng bằng `URLSearchParams` nên mã hoá `{{var}}`
  (`packages/shared/src/api-client/url-params.ts:48-63`).
- `isSensitiveName` không khớp `set-cookie` (`sensitive-parts.ts:18-28`).
- API không đọc cờ web nào: `VITE_FEATURES` chỉ là cờ build web (`apps/web/src/config/feature-flags.ts:1-14`).
- Mẫu cài đặt runtime của API: `apps/api/src/config/runtime-settings.ts:103-131`.

## Files to Create / Modify
- Create `packages/shared/src/api-client/redaction/sensitive-names.ts`: `isSensitiveName` (thêm `set-cookie`,
  `www-authenticate`), `isLiteralValue`; chuyển từ web cùng test.
- Create `packages/shared/src/api-client/redaction/query-pairs.ts`: chuyển **nguyên văn** `urlWithParams`,
  `paramsFromUrl`, `queryPairs`, `splitUrl` từ `params-sync.ts`; web import lại (`params-sync.ts` giữ phần riêng của
  editor).
- Create `packages/shared/src/api-client/redaction/redact-draft.ts`: `redactDraft`, `hasBlankedSecrets` chuyển từ web;
  thêm che userinfo của URL (`https://user:pass@host` → `https://host`).
- Create `packages/shared/src/api-client/redaction/public-collection.ts`: `publicCollectionTree(tree)`: mọi request và
  `example.request` qua `redactDraft`; auth của folder và collection che như request; header response của example có
  tên nhạy cảm → rỗng; **bỏ body response của example**; biến `secret` → rỗng. `publicEnvironment(env)`: chỉ biến
  có `sharedValue !== null` và không `secret`; không đọc local.
- Create `packages/shared/src/api-client/redaction/secret-heuristics.ts`: `looksLikeSecret(value)` (JWT, tiền tố
  `sk_`, `pk_live_`, `ghp_`, `github_pat_`, `xox[bap]-`, `AKIA`, `AIza`, chuỗi ≥ 24 ký tự entropy cao không khoảng
  trắng) và `findSecretLikeValues(tree, environment?)` trả `{ where: "collectionVariable" | "environmentVariable" |
  "script" | "requestBody" | "exampleHeader" | "url", path, key }`, không trả giá trị.
- Modify `packages/shared/src/api-client/index.ts`: export.
- Modify web: xoá `history/redact-draft.ts` (cả test), sửa import ở `workbench/record-send.ts`,
  `request/request-editor.tsx`, `pages/api-client/api-client-screen.tsx`, `routing/sensitive-parts.ts`,
  `request/params-sync.ts`.
- Modify `apps/api/src/config/env.ts` (và `.env.example`, `infra/localman/.env.production.example`): biến
  `PUBLIC_SHARING_ENABLED` (mặc định `false`).
- Create `apps/api/src/modules/public-sharing/public-sharing-gate.ts`: `publicSharingEnabled()` và cách loại các
  operation của module khỏi router và MCP khi tắt (đăng ký có điều kiện trong `apps/api/src/operations/registry.ts`,
  test cả hai trạng thái).
- Modify `apps/web/src/config/feature-flags.ts`: cờ `publicSharing`.
- Modify `packages/shared/src/access-permissions.ts`: `WORKSPACE_PERMISSIONS.publishPublic: ["admin", "editor"]`.
- Modify `packages/shared/src/plan-limits.ts`: comment `forkPrPublic` = "fork và pull request; public link, guest,
  access key, nút Run dùng được ở mọi gói" (không đổi giá trị).

## Tasks & Steps
1. Chuyển `sensitive-names`, `query-pairs`, `redact-draft` sang shared **không đổi hành vi**: chạy test cũ của web
   (`history`, `routing`, `request`, `record-send`) trước khi thêm gì mới.
2. Thêm test tổ hợp: `https://{{host}}/x?api_key=sk_live_x&user={{userId}}` → `api_key=` rỗng, `user={{userId}}` nguyên
   văn; userinfo; `set-cookie`.
3. `publicCollectionTree`/`publicEnvironment` + bảng test: bearer/basic/apikey gõ thẳng → rỗng; `{{token}}` giữ;
   header `Authorization`/`X-API-Key`/`Cookie` gõ thẳng → rỗng; query `api_key` → rỗng; auth của folder và collection;
   example (request gốc, header `Set-Cookie`, body bị bỏ); biến collection `secret`; biến environment không shared
   hoặc `secret` bị bỏ.
4. `looksLikeSecret`, `findSecretLikeValues` với mẫu dương và âm (UUID, URL, câu chữ, số).
5. Cổng server + cờ web; test: cổng tắt thì route mới trả 404 và danh sách MCP tool không có tool mới.

## Verification
- `pnpm --filter @localman/shared test`, test web của `history`, `routing`, `request`, `workbench`.
- `pnpm lint && pnpm typecheck && pnpm check:mcp-coverage`.

## Rủi ro
- Chuyển file đổi đường import nhiều chỗ ở web: một commit, typecheck toàn repo.
- Heuristic báo nhầm: chỉ cảnh báo, không chặn; che dữ liệu không dựa vào heuristic.
