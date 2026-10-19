---
phase: 18
title: "Localman MCP: đủ toolset cho API client, chia sẻ, cộng tác, công khai, đồng bộ và traffic"
status: in-progress
priority: P2
effort: "M"
dependencies: [16, 17, 19, 20, 21]
---

# Phase 18: Localman MCP, phần API client

> Chạy sau phase 16, khi phần Postman và Live Mock Sync đã xong (Jev 0.86, tách theo tính năng). Dùng lại server MCP và OAuth của phase 17.

## Goal
Mở rộng Localman MCP để coding agent làm việc với API client: tạo và sửa collection/request, đọc và ghi biến environment, gửi request qua proxy (kể cả localhost qua Tunelo), và tạo collection đồng bộ từ mock.

## Phạm vi: mọi tính năng của API client đều có tool
Operation của phase 10–16 và 19–21 đã khai báo qua registry nên tự có tool. Phase này **đóng gói toolset, kiểm đủ coverage và test end-to-end bằng agent**:

| Toolset | Gồm (ví dụ) |
|---|---|
| `client` | request (lưu, gửi qua proxy), history, import/export, snippet, chaining (phase 21) |
| `client` (collections, environments) | collection, folder, request, example, tag, status, favorite, changelog, restore, trash (phase 12); environment, globals, biến, local và shared value (phase 13) |
| `sharing` | workspace, thành viên, vai trò, share, request access, move (phase 11) |
| `collab` | fork, pull changes, merge, conflict, PR, comment, watch (phase 14) |
| `public` | public link, guest, nút Run, access key (tạo key cần `credentials:write`) (phase 15) |
| `sync` | Live Mock Sync: tạo liên kết, xem conflict, chọn bản giữ (phase 16) |
| `traffic` | request log, replay, upstream (mock lai localhost), webhook inbox, callback (phase 20) |
| `mock-advanced` | import JSON/OpenAPI/CSV, export type, chaos, rule (phase 19), docs (phase 21) |

## Tool tiêu biểu (mọi dòng là tiêu chí nghiệm thu)

| Tool | Hành vi | Scope |
|---|---|---|
| `list_workspaces`, `list_collections`, `get_collection` | Đọc theo quyền của phase 11 | `client:read` |
| `create_collection`, `upsert_request`, `move_item`, `delete_item` (`destructiveHint`) | Ghi revision vào changelog với tác giả là "<user> qua MCP" | `client:write` |
| `list_environments`, `get_environment` | **Chỉ trả giá trị shared và local của chính user; biến secret luôn bị che** | `client:read` |
| `set_variable` | Mặc định ghi vào giá trị local. Ghi shared thì cần Editor và cờ `shared: true` | `client:write` |
| `send_request` | Gửi qua proxy của phase 10 (tính vào `proxyRequestsPerMonth`). Host là localhost thì tự đi qua Tunelo (phase 10, bước 4); không có tunnel thì trả hướng dẫn `tunelo http <port>` | `client:send` |
| `create_synced_collection_from_mock` | Gọi Live Mock Sync (phase 16) | `client:write`, `mock:read` |
| `import_collection` | Nhận cURL, Postman v2.1 hoặc OpenAPI (phase 10, 12) | `client:write` |

## Files to Create / Modify
- Create `apps/api/src/modules/mcp/client-tools/`: `collection-tools.ts`, `environment-tools.ts`, `send-request-tool.ts`, `import-tools.ts`
- Modify `apps/api/src/modules/mcp/localman-mcp-server.ts` để đăng ký nhóm tool mới theo scope
- Phía IdP (plan central-auth, phase 03): thêm mô tả dễ hiểu cho các scope `client:*` trên trang consent

## Verification
- `pnpm check:mcp-coverage` cho 100% operation của phase 10–16 và 19–21 (trừ các mục `exempt` có lý do).
- Kịch bản agent E2E: dùng client MCP của TypeScript SDK đi trọn luồng "tạo mock, tạo collection đồng bộ, share cho thành viên, fork, PR, merge, xem request log" chỉ bằng tool.
- Integration: agent tạo collection, thêm request, đặt biến local, `send_request` tới mock thì nhận 200. Viewer gọi tool ghi thì bị từ chối. `get_environment` không bao giờ trả plaintext của biến secret (test bắt buộc).
- `send_request` tới `http://localhost:3000` khi có tunnel thì đi qua tunnel; khi không có tunnel thì trả hướng dẫn.
- Hạn mức proxy bị trừ đúng 1 cho mỗi lần `send_request`.

## Follow-up (ngoài plan)
- Test MCP server ngay trong API client, gồm server local qua Tunelo. Jev cho 0.48 (sát ngưỡng), và Postman đã có MCP requests nên làm cũng chỉ là đuổi kịp.

## Giao việc
**Đợt:** 7 · **Phụ thuộc trước khi bắt đầu:** phase 16 và 17 đã xong; phase 10–15, 19 và 20 đã xong vì coverage và kịch bản agent E2E đi qua toolset của chúng. Phase 21 chạy cùng đợt, nên bước kiểm coverage cuối (T9) chỉ chạy sau khi phase 21 đã merge. Thay đổi câu chữ scope phía IdP nằm ở repo `hoandat-auth` · **Lệnh cook:** `/ak:cook plans/dattqh/261008-1123-localman-core/phase-18-localman-mcp-client-tools.md`

| # | Việc | Vai trò | Song song | File chính |
|---|---|---|---|---|
| T1 | Chạy `pnpm check:mcp-coverage`, lập danh sách operation của phase 10–16, 19, 20 còn thiếu tool, toolset hoặc scope; gán đúng toolset `client`, `sharing`, `collab`, `public`, `sync`, `traffic`, `mock-advanced` và bổ sung khai báo còn thiếu (chỉ sửa metadata của operation) | fullstack-developer | — | `packages/operations/src/`, khai báo operation trong `apps/api/src/modules/*/` |
| T2 | Làm `collection-tools`: `list_workspaces`, `list_collections`, `get_collection` (`client:read`), `create_collection`, `upsert_request`, `move_item`, `delete_item` (`destructiveHint`, `client:write`); revision ghi tác giả "<user> qua MCP" | fullstack-developer | với T3, T4 | `apps/api/src/modules/mcp/client-tools/collection-tools.ts` |
| T3 | Làm `environment-tools`: `list_environments`, `get_environment` chỉ trả shared và local của chính user, secret luôn bị che; `set_variable` mặc định ghi local, ghi shared cần Editor và `shared: true` | fullstack-developer | với T2, T4 | `apps/api/src/modules/mcp/client-tools/environment-tools.ts` |
| T4 | Làm `send-request-tool` (qua proxy phase 10, trừ `proxyRequestsPerMonth`, localhost tự đi qua Tunelo, không có tunnel thì trả hướng dẫn `tunelo http <port>`, scope `client:send`), `import-tools` (cURL, Postman v2.1, OpenAPI) và `create_synced_collection_from_mock` (`client:write` cùng `mock:read`) | fullstack-developer | với T2, T3 | `apps/api/src/modules/mcp/client-tools/send-request-tool.ts`, `import-tools.ts` |
| T5 | Đăng ký nhóm tool mới trong Localman MCP theo scope `client:read`, `client:write`, `client:send` và theo toolset | fullstack-developer | với T6 | `apps/api/src/modules/mcp/localman-mcp-server.ts` |
| T6 | Thêm mô tả dễ hiểu cho các scope `client:*` trên trang consent của IdP, đối chiếu prototype `prototype/api-client.html` `#/oauth/consent` (repo `hoandat-auth`, plan IdP phase 03) | fullstack-developer | với T5 | repo `hoandat-auth`: `src/interactions/consent-page` |
| T7 | Viết integration test: agent tạo collection, thêm request, đặt biến local, `send_request` tới mock nhận 200; Viewer gọi tool ghi bị từ chối; `get_environment` không bao giờ trả plaintext secret (bắt buộc); `send_request` tới `http://localhost:3000` có và không có tunnel; hạn mức proxy trừ đúng 1 | tester | với T8 | test trong `apps/api/src/modules/mcp/client-tools/` |
| T8 | Viết kịch bản agent E2E bằng MCP client của TypeScript SDK: tạo mock, tạo collection đồng bộ, share cho thành viên, fork, PR, merge, xem request log, chỉ dùng tool | tester | với T7 | `e2e/specs/localman-mcp-agent-flow.spec.ts` |
| T9 | Sau khi phase 21 merge, chạy lại `pnpm check:mcp-coverage` và xác nhận 100% operation của phase 10–16 và 19–21 có tool, chỉ còn mục `exempt` có lý do | tester | — | output `pnpm check:mcp-coverage` |
| T10 | Deploy thay đổi consent của IdP và bản Localman lên staging (cần user xác nhận) | fullstack-developer | — | `deploy/compose.staging.yml`, deploy của `hoandat-auth` |
| T11 | Review cuối phase, chú trọng lộ secret và kiểm scope | code-reviewer | — | toàn phase |

### Checklist
- [ ] T1 Mọi operation phase 10–16, 19, 20 đã có toolset và scope đúng
- [x] T2 Collection tools và revision "qua MCP" (2026-10-19: revision `via: "mcp"` qua kênh AsyncLocalStorage của `/mcp`, phiên changelog tách theo kênh, `viaMcp` và nhãn "qua MCP" trên web)
- [x] T3 Environment tools che secret, `set_variable` local/shared đúng quyền (2026-10-19, user chốt: agent không bao giờ đọc được giá trị secret — shared lẫn local, environment, globals, biến secret của collection — kể cả Editor; web giữ nguyên. Gồm diff changelog, diff PR, xung đột khi xem trước merge, và (user chốt thêm) thông tin đăng nhập gõ thẳng trong auth; ghi ngược giá trị đã che thì giữ nguyên giá trị lưu. `set_variable` là `set_environment_local_values`/`set_environment_variables` với quyền Editor sẵn có)
- [ ] T4 `send_request`, import, collection đồng bộ từ mock (2026-10-19, làm trước: `send_request` tới localhost/LAN tự đi qua tunnel của user — ánh xạ đã lưu rồi tunnel của máy liên kết, token agent không đọc tunnel tài khoản; `import_collection` cho Postman v2.1/OpenAPI/cURL; thêm `generate_code_snippet` cho nút Code. Lên production ở release `20261019-060338-53bacda99e7e`, DAST đạt: `reports/security-261019-1303-mcp-client-parity-dast.md`. Còn lại: collection đồng bộ từ mock, chờ phase 16)
- [x] T5 Tool mới đăng ký theo scope và toolset (2026-10-19, user chốt: `send_request` cần `client:send` qua trường `mcpScope`; toolset `sharing`, `public` mở cho OAuth dưới `client:*`, `collab` vẫn đóng; access key vẫn cần `credentials:write`; user chốt thêm: tool cấp quyền cho người khác cần `client:share` (không quảng bá, user tự cấp), xoá workspace và gỡ thành viên cần `confirm_token`. Cùng T2, T3, T7 lên production ở release `20261019-080937-aaba570994cb`, DAST đạt: `reports/security-261019-1509-acceptance-batch-dast.md`)
- [ ] T6 Mô tả scope `client:*` trên consent của IdP (2026-10-19: `client:send` đã đúng; cần sửa câu chữ `client:read`/`client:write` ở repo `hoandat-auth` cho thêm workspace, thành viên, chia sẻ — chờ user)
- [x] T7 Integration pass, gồm test bắt buộc không lộ secret (2026-10-19: `localman-mcp-client-tools.test.ts` qua `/mcp` thật: `get_environment` không có secret, Viewer bị từ chối tool ghi, mỗi `send_request` trừ đúng 1; `localman-mcp-client-scopes.test.ts`, `localman-mcp-changelog-channel.test.ts`, `*agent-secrets*.test.ts`)
- [ ] T8 Kịch bản agent E2E pass (2026-10-19: `e2e/specs/agent-mcp-workflow.spec.ts` — mock, request log, workspace team, collection từ mock, link mời, fork, PR, merge, changelog "qua MCP"; chạy trên CI; bước collection đồng bộ chờ phase 16)
- [ ] T9 Coverage 100% sau khi phase 21 merge
- [ ] T10 Staging (IdP và Localman) đã deploy sau khi user xác nhận
- [ ] T11 Review không còn finding mức high
- [ ] Verification: `pnpm check:mcp-coverage` 100% cho phase 10–16 và 19–21, trừ `exempt` có lý do
- [ ] Verification: agent E2E "mock, collection đồng bộ, share, fork, PR, merge, request log" chỉ bằng tool
- [ ] Verification: Viewer bị từ chối ở tool ghi; `get_environment` không trả plaintext secret
- [ ] Verification: `send_request` localhost có tunnel thì đi qua tunnel, không có thì trả hướng dẫn; hạn mức proxy trừ đúng 1
- [ ] `pnpm lint && pnpm typecheck && pnpm test` sạch
- [ ] `pnpm check:mcp-coverage` pass
