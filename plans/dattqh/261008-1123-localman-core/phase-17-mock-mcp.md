---
phase: 17
title: "Nền tảng MCP (toolsets, xác nhận, coverage), Mock MCP tức thì và toolset mock"
status: in-progress
priority: P1
effort: "M"
dependencies: [5, 9]
---

# Phase 17: Mock MCP tức thì và Localman MCP (phần mock)

> **Thứ tự chạy:** ngay sau phase 09, **trước** phase 10. Phase này chỉ dùng mock runtime và model resource, nên không kéo phần Postman lên sớm (Jev 0.86, tách theo tính năng). Lúc làm, dùng skill `ak:mcp-builder` (MCP spec 2026-07-28, TypeScript SDK v2).

## Goal
Làm keyword thứ ba **"Mock MCP tức thì"** (Jev 0.67) cùng phần mock của **Localman MCP** cho AI coding agent (Jev 0.68).

- **Hosted Mock MCP** (Jev 0.62): mỗi project mock tự có một MCP endpoint. Tool của endpoint thao tác trên chính dữ liệu có trạng thái của mock. Dev làm AI agent nhờ vậy có ngay một backend giả để test agent, không phải tự viết MCP server.
- **Localman MCP (mock):** Claude Code, Cursor và các agent khác tạo được project, resource, schema và sinh dữ liệu mock bằng lời.

**Đối thủ:** Postman có MCP Server (agent quản lý workspace, collection, mock tĩnh), gửi được request tới MCP server, và có MCP Generator (sinh MCP server từ API công khai và từ Flows). Không thấy tài liệu nào nói mock của Postman được mở thành MCP endpoint (độ tin cậy trung bình, cần kiểm lại trước khi đưa lên bảng so sánh). Code mock giữ trạng thái của Postman cũng chỉ là beta, soạn trên desktop. mockapi.io không có MCP.

## Nền tảng MCP dùng cho mọi tính năng (user yêu cầu 2026-10-08: mock, API client và DevOps đều có MCP tool)
- **Sinh tool từ operation registry** (phase 01). Mọi operation có `mcp: true` tự thành tool, có JSON Schema, scope và annotation.
- **Toolsets** (Jev 1.00): `mock`, `mock-advanced` (phase 19), `client`, `sharing`, `collab`, `public`, `sync`, `traffic`, `devops`, `tunnels`, `admin`.
  - Mặc định bật `mock` cùng `client` lõi.
  - Client chọn toolset qua `?toolsets=a,b` hoặc qua meta-tool `list_toolsets` và `enable_toolset` (gửi `notifications/tools/list_changed`).
- **Tool phá huỷ** (Jev 0.87):
  - Gắn `destructiveHint`.
  - Tool ảnh hưởng nhiều thứ (xoá project hoặc collection, `config_push`, `env_sync_github`, đóng tunnel, `reset_all`) phải gọi `dry_run=true` trước. Lần gọi đó trả về tóm tắt cùng `confirm_token` (TTL 5 phút, gắn với đúng input). Lần gọi thật phải gửi kèm token này.
- **Tool tạo credential** (Jev 0.74):
  - Tạo PAT, tạo hoặc xoay secret của service account, tạo access key cần scope riêng `credentials:write`. Màn consent của IdP hiện cảnh báo đỏ cho scope này.
  - Secret chỉ trả về **đúng một lần** lúc tạo.
  - **Không tool nào đọc lại** secret đã có.
- **Không có MCP, có ghi lý do** (`exempt`): tiện ích của browser extension (phase 22 và 23; dữ liệu tab chỉ ở trong trình duyệt, Jev 0.77), trang consent OAuth, và các bước UI thuần (kéo thả, đổi theme).
- **Coverage:** CI chạy `pnpm check:mcp-coverage` và in bảng operation sang tool theo toolset; bảng đó cũng được đăng thành trang docs "MCP tools".

## Hosted Mock MCP (mọi dòng là tiêu chí nghiệm thu)

| Hạng mục | Hành vi |
|---|---|
| Endpoint | `https://{secret}.localman.hoandat.com{prefix}/mcp`, transport Streamable HTTP. Fallback `/m/:secret/mcp` |
| Tool | Mỗi resource (gồm cả resource lồng) có `list_<res>` (search/filter/page/limit/sortBy/order đúng như REST), `get_<res>`, `create_<res>`, `update_<res>`, `delete_<res>`. Resource con nhận thêm `parentId`. Chỉ sinh tool cho endpoint đang bật |
| Schema input | Sinh JSON Schema từ schema resource (kiểu dữ liệu, field bắt buộc). Tool annotations: `readOnlyHint` cho list/get, `destructiveHint` cho delete |
| MCP resources | `mock://schema`: cây resource và schema; `mock://openapi`: OpenAPI 3.1 sinh từ mock |
| Dữ liệu | Dùng chung store với REST: tạo qua MCP thì GET REST thấy ngay. Custom response không áp cho MCP; MCP trả JSON thuần |
| Bảo mật | Mặc định giống REST: biết secret là gọi được. Tuỳ chọn cho mọi gói: "Yêu cầu token cho MCP", Bearer token theo project, xoay vòng được. Rate-limit và body tối đa giống phase 05 |
| Hạn mức | Mỗi lần gọi tool tính 1 request vào `mockRequestsPerMonth` |
| UI | Card API endpoint thêm tab "MCP": URL, nút copy cấu hình cho Claude Code (`claude mcp add --transport http …`), Cursor và JSON chung. Có nút "Thử" mở MCP Inspector |

## Localman MCP, phần mock (cho AI coding agent)

| Hạng mục | Hành vi |
|---|---|
| Endpoint | `https://localman.hoandat.com/mcp`, Streamable HTTP, xác thực bằng **OAuth 2.1 theo MCP auth spec**. Authorization server là **IdP chung `auth.hoandat.com`**, Localman chỉ đóng vai resource server (client MCP đăng ký động ở IdP, `resource=https://localman.hoandat.com/mcp`). Scope `mock:read` và `mock:write` |
| Tool | `list_projects`, `create_project`, `create_resource` (nhận JSON Schema, TypeScript interface **hoặc** một đoạn OpenAPI), `update_resource_schema`, `nest_resource`, `generate_data(count 0–100)`, `reset_data`, `get_resource_data`, `replace_resource_data`, `get_mock_urls` (trả cả URL REST lẫn URL MCP), `delete_resource` (`destructiveHint`) |
| Quyền | Tool chạy dưới quyền user đã cấp OAuth, qua `access-policy` (phase 11; trước phase 11 thì qua `project-access.can`). Tôn trọng `plan-limits` |
| Đầu ra | Trả kết quả có cấu trúc (structured content) kèm link tới UI Localman để user mở xem |

## Files to Create / Modify
- Create `apps/api/src/modules/mcp/`:
  - `mock-mcp-server.ts`: dựng server theo project, sinh tool từ resource tree, cache theo `secret` và revision.
  - `mock-tool-factory.ts`: hàm thuần, đầu vào là resource, đầu ra là định nghĩa tool kèm JSON Schema.
  - `localman-mcp-server.ts`
  - `mcp-resource-metadata.ts`: endpoint Protected Resource Metadata (RFC 9728) trỏ `authorization_servers` về `https://auth.hoandat.com`; xác minh JWT của IdP bằng JWKS (`aud` phải là `/mcp`, kiểm scope).
  - `mcp-token-model.ts`
  - `packages/shared/src/schema-from-typescript.ts` và `packages/shared/src/schema-from-openapi.ts`: parse có giới hạn kích thước, không eval. Đặt trong `packages/shared` vì phase 19 dùng chung.
- Modify `apps/api/src/mock-server.ts` để mount `/mcp` trước router catch-all.
- Modify `apps/api/src/dashboard-server.ts` để mount `/mcp` và `/.well-known/oauth-protected-resource`.
- Create `apps/web/src/features/mcp/`: `mcp-tab.tsx`, `mcp-config-snippets.tsx`, `mcp-token-settings.tsx`. Trang consent và danh sách ứng dụng đã cấp quyền nằm ở IdP.

## Verification
- Unit: `mock-tool-factory` (snapshot với cây users → posts → comments; endpoint tắt thì không sinh tool), parse TypeScript và OpenAPI (input xấu bị từ chối, có giới hạn kích thước).
- Integration với MCP client của TypeScript SDK:
  - Gọi `list_users` có filter và phân trang ra đúng như REST.
  - `create_posts` có `parentId` thì GET REST lồng thấy bản ghi.
  - Bật token thì gọi không có token nhận 401.
  - Vượt hạn mức tháng thì nhận lỗi `MONTHLY_QUOTA_EXCEEDED`.
- E2E OAuth: discovery, consent, cấp token, gọi `create_project`, thu hồi.
- Thủ công: `claude mcp add --transport http localman https://localman.hoandat.com/mcp`, rồi nhờ agent "tạo mock users có 20 bản ghi" và kiểm trên UI.

## Giao việc
**Đợt:** 3 · **Phụ thuộc trước khi bắt đầu:** phase 05 và 09 đã xong (mock runtime đã lên staging); plan IdP `../261008-1325-central-auth-idp/` đã xong, nhất là phase 03 (DCR cho client MCP với scope `mock:*`, resource indicator `https://localman.hoandat.com/mcp`); operation registry và `pnpm check:mcp-coverage` của phase 01 đã có. Chạy cùng đợt với phase 19 · **Lệnh cook:** `/ak:cook plans/dattqh/261008-1123-localman-core/phase-17-mock-mcp.md`

| # | Việc | Vai trò | Song song | File chính |
|---|---|---|---|---|
| T1 | Đối chiếu với prototype `prototype/index.html`: tab MCP của card endpoint trong `#/projects/demo` (`project-detail-endpoint-tab-mcp`, `project-detail-mcp-url`, `mcp-token`, `mcp-tool-*`) và khối landing "Mock MCP tức thì"; xem thêm `prototype/api-client.html` `#/oauth/consent` để chuyển câu chữ scope cho IdP. Chốt spec; danh sách ứng dụng đã cấp quyền theo phase file nằm ở IdP, nên mục `settings-mcp-apps` của prototype chỉ còn là link sang IdP | ui-ux-designer | với T2, T3, T4 | `prototype/index.html` (chỉ đọc) |
| T2 | Dựng nền MCP dùng chung: sinh tool từ operation có `mcp: true`, toolsets (`?toolsets=`, `list_toolsets`, `enable_toolset` gửi `notifications/tools/list_changed`, mặc định `mock` cùng `client` lõi), dry-run với `confirm_token` (TTL 5 phút, gắn với input) cho tool phá huỷ, scope `credentials:write`, xử lý `exempt`; mở rộng `pnpm check:mcp-coverage` để in bảng operation sang tool theo toolset | fullstack-developer | với T1, T3, T4 | `packages/operations/src/`, `apps/api/src/modules/mcp/` (phần dùng chung) |
| T3 | Viết `mock-tool-factory` dạng hàm thuần: `list_/get_/create_/update_/delete_<res>`, `parentId` cho resource con, chỉ sinh cho endpoint đang bật, JSON Schema từ schema resource, annotation `readOnlyHint`/`destructiveHint`; test snapshot cây users, posts, comments | fullstack-developer | với T1, T2, T4 | `apps/api/src/modules/mcp/mock-tool-factory.ts` |
| T4 | Viết `schema-from-typescript` và `schema-from-openapi`: parse có giới hạn kích thước, không eval, từ chối input xấu; test. Phase 19 dùng lại parser OpenAPI này, không viết bản thứ hai | fullstack-developer | với T1, T2, T3 | `apps/api/src/modules/mcp/schema-from-typescript.ts`, `schema-from-openapi.ts` |
| T5 | Làm Hosted Mock MCP: `mock-mcp-server` (Streamable HTTP, cache theo `secret` và revision), MCP resources `mock://schema` và `mock://openapi`, dùng chung store với REST, tính 1 request vào `mockRequestsPerMonth` mỗi lần gọi tool, rate-limit và body tối đa như phase 05, Bearer token tuỳ chọn có xoay vòng; mount `/mcp` trước router catch-all cùng fallback `/m/:secret/mcp` | fullstack-developer | — | `apps/api/src/modules/mcp/mock-mcp-server.ts`, `mcp-token-model.ts`, `apps/api/src/mock-server.ts` |
| T6 | Làm Localman MCP phần mock: `localman-mcp-server`, `mcp-resource-metadata` (RFC 9728 trỏ về `https://auth.hoandat.com`, xác minh JWT qua JWKS, `aud` là `/mcp`, kiểm scope `mock:read`/`mock:write`); đủ tool `list_projects` tới `delete_resource`, quyền qua `project-access.can`, tôn trọng `plan-limits`, trả structured content kèm link UI; mount `/mcp` và `/.well-known/oauth-protected-resource` | fullstack-developer | — | `apps/api/src/modules/mcp/localman-mcp-server.ts`, `mcp-resource-metadata.ts`, `apps/api/src/dashboard-server.ts` |
| T7 | Làm UI tab MCP: URL, snippet cấu hình Claude Code (`claude mcp add --transport http …`), Cursor và JSON chung, cài đặt token theo project, nút "Thử" mở MCP Inspector | fullstack-developer | với T8 | `apps/web/src/features/mcp/` |
| T8 | Viết integration test bằng MCP client của TypeScript SDK: `list_users` có filter và phân trang khớp REST, `create_posts` có `parentId` thì GET REST lồng thấy bản ghi, bật token thì thiếu token nhận 401, vượt hạn mức nhận `MONTHLY_QUOTA_EXCEEDED`, dry-run và `confirm_token` sai input bị từ chối | tester | với T7 | test trong `apps/api/src/modules/mcp/` |
| T9 | Viết E2E OAuth trên staging của IdP: discovery, consent, cấp token, gọi `create_project`, thu hồi | tester | — | `e2e/specs/localman-mcp-oauth.spec.ts` |
| T10 | Viết trang docs "MCP tools" từ bảng coverage theo toolset, kèm hướng dẫn thêm Localman MCP và Hosted Mock MCP vào agent | docs-manager | — | `docs/` (trang MCP tools) |
| T11 | Deploy staging, chạy kiểm thủ công `claude mcp add --transport http localman https://localman.hoandat.com/mcp` rồi nhờ agent "tạo mock users có 20 bản ghi", sau đó bật cờ `features.mockMcp` cho landing (cần user xác nhận) | fullstack-developer | — | `deploy/compose.staging.yml`, cấu hình cờ tính năng |
| T12 | Review cuối phase, chú trọng xác minh token, scope và tool phá huỷ | code-reviewer | — | toàn phase |

### Checklist
- [x] T1 Spec tab MCP và câu chữ scope đã chốt; mục ứng dụng đã cấp quyền trỏ sang IdP (`plans/dattqh/reports/ui-phase-17-mcp-spec.md`)
- [x] T2 Toolsets, dry-run/`confirm_token`, `credentials:write`, `exempt`, bảng coverage (`apps/api/src/modules/mcp/`: `operation-mcp-server.ts`, `operation-tool*.ts`, `toolset-*.ts`, `confirm-token.ts`; `executeOperation` dùng chung REST/MCP; `pnpm check:mcp-coverage --markdown <path>`; `confirm_token` chỉ cho operation khai `requiresConfirmation`: xoá project, xoá resource, `reset_all`, xoay secret project)
- [x] T3 `mock-tool-factory` có snapshot, endpoint tắt không sinh tool
- [x] T4 Parser TypeScript và OpenAPI có giới hạn, không eval (nằm ở `packages/shared/src/`: `schema-from-typescript.ts`, `schema-from-openapi.ts` cùng các module `typescript-*`, `openapi-*`, `schema-import-fields.ts`, `schema-field-hints.ts`; OpenAPI chỉ nhận JSON, chưa nhận YAML)
- [x] T5 Hosted Mock MCP đủ tool, resources, token, hạn mức, rate-limit, fallback path (`apps/api/src/modules/mcp/`: `mock-mcp-server.ts` mount trước REST trong `mock-server.ts`, `mock-tool-call.ts`, `mock-tool-args.ts`, `mock-mcp-tools-cache.ts`, `mock-mcp-resources.ts`, `mock-openapi*.ts`, `mock-mcp-auth.ts`, `mcp-token-model.ts`, `mcp-token-operations.ts`: `get_mcp_token_settings`, `set_mcp_token_required`, `rotate_mcp_token`; tên resource `mcp` bị từ chối)
- [x] T6 Localman MCP phần mock, Protected Resource Metadata, xác minh JWT (`apps/api/src/modules/mcp/`: `localman-mcp-server.ts` mount `/mcp` trước CSRF guard trong `dashboard-server.ts`, `localman-mcp-access.ts`, `mcp-resource-metadata.ts`, `mcp-access-token.ts`, `mcp-fetch-bridge.ts`; operation mới `create_resource_from_schema`, `get_mock_urls`; view project có `uiUrl`; bảng tên plan → tool ở `docs/system-architecture.md` mục Localman MCP; nginx và proxy Vite có `/mcp`, `/.well-known/oauth-protected-resource`)
- [x] T7 UI tab MCP (`apps/web/src/features/mcp/`: tab REST/MCP lưu `?endpoint=mcp`, snippet đọc token từ biến môi trường, token hiện một lần, xoay có xác nhận, danh sách tool từ `mockToolEntries`, panel lệnh MCP Inspector; khối landing "Mock MCP tức thì" và mục `account-menu-apps` gắn cờ `mockMcp`; primitive mới `Tabs`, `Switch`, `SegmentedControl`, `CodeBlock` chuyển sang `components/ui`)
- [x] T8 Integration bằng SDK pass (phần Hosted Mock MCP đã xong: `mock-mcp-server.test.ts`, `mock-mcp-token.test.ts` qua HTTP thật; dry-run/`confirm_token` nằm ở test của T2)
- [x] T9 E2E OAuth pass trên stack E2E (`e2e/specs/localman-mcp-oauth.spec.ts`: discovery, DCR, consent, token có `resource`, `create_project`, project hiện trên UI, thu hồi refresh token; fake IdP có thêm DCR, resource `/mcp`, revocation). SDK client MCP 2.3.1 đăng ký kèm `offline_access`; IdP thật bỏ qua scope đó cho client DCR từ commit `2ff6bad` của `hoandat-auth` (đã deploy 2026-10-09), fake IdP khớp hành vi này
- [ ] T10 Trang docs "MCP tools" đã đăng (làm cùng đợt đa ngôn ngữ, viết tiếng Anh: `plans/dattqh/261009-1741-i18n-en-zh-and-brand-cleanup/`)
- [x] T11 Deploy production 2026-10-09; Hosted Mock MCP kiểm bằng MCP client SDK thật trên production (10 tool, tạo bản ghi, route lồng, `mock://schema`, `mock://openapi`); Localman MCP trả metadata RFC 9728 và 401 đúng; cờ `mockMcp` bật theo Jev 0.52 (`infra/localman/released-features`). Còn lại: user tự thử `claude mcp add` + consent OAuth thật
- [x] T12 Review không còn finding mức high (H1 batch JSON-RPC bị chặn 400 và mỗi tool call tính hạn mức riêng; H2 `allOf` OpenAPI có trần bước; M1 thao tác thành viên sang toolset `collab`; M2 giới hạn theo `sub`)
- [x] Verification: unit `mock-tool-factory` và parse TypeScript/OpenAPI (input xấu bị từ chối) pass
- [x] Verification: integration `list_users`, `create_posts` với `parentId`, 401 khi bật token, `MONTHLY_QUOTA_EXCEEDED` pass
- [x] Verification: E2E OAuth (discovery, consent, token, `create_project`, thu hồi) pass
- [ ] Verification: kiểm thủ công agent tạo mock users 20 bản ghi, thấy trên UI (2026-10-09: IdP đã nhận DCR của Claude Code sau commit `52e8c13` của `hoandat-auth`; user đang chạy Claude Code trên máy remote nên trình duyệt không mở được callback `localhost`. Làm tiếp từ máy chạy Claude Code, hoặc chuyển tiếp cổng callback bằng `ssh -L`)
- [x] `pnpm lint && pnpm typecheck && pnpm test` sạch
- [x] `pnpm check:mcp-coverage` pass và in được bảng theo toolset
