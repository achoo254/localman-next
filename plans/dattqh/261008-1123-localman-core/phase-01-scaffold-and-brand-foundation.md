---
phase: 1
title: "Scaffold monorepo và nền tảng brand"
status: pending
priority: P1
effort: "M"
dependencies: []
---

# Phase 01: Scaffold monorepo và nền tảng brand

## Goal
Dựng monorepo trong **repo mới `achoo254/localman-next`** (private, tạo ngày 2026-10-08; Jev chọn repo mới thay cho phương án xoá code repo cũ, 0.90). Monorepo chạy được cả web lẫn api ở local. Repo có design system riêng của Localman (Radix Colors (violet làm màu chủ đạo, slate làm màu xám; giấy phép MIT), font Inter và JetBrains Mono), cùng lint, typecheck và test.

Repo root: root của repo `localman-next`. Mọi path dưới đây tính tương đối từ root này.

### Bước 0: repo cũ `achoo254/localman`
1. **Không xoá code repo cũ.** Repo cũ giữ nguyên để đọc khi port ở phase 10: dùng bản clone sẵn có ở `$WORKSPACE/localman`, chỉ đọc.
2. Khi phase 10 port xong, **archive** repo cũ trên GitHub, kèm commit README cuối "Đã chuyển sang achoo254/localman-next". Archive là thao tác public, phải hỏi user trước. Các release cũ (`v0.1.0`…`v0.2.1`) vẫn giữ trong repo cũ.
3. Viết `README.md`, `CLAUDE.md` và `docs/` của `localman-next` theo kiến trúc mới.

### Bước 0b: gộp repo Tunelo vào monorepo, giữ lịch sử (user chốt 2026-10-08; Jev giữ lịch sử 0.90)
Repo Tunelo gốc **không bị sửa**, mọi thao tác chạy trên bản clone mới.
1. `git clone https://github.com/achoo254/tunelo.git $WORKSPACE/tunelo-import` (bản clone tạm, xoá sau khi gộp), rồi chạy `git filter-repo` trên bản clone đó để đổi path:
   - `packages/server/` → `apps/tunelo-server/`
   - `packages/client/` → `packages/tunelo-cli/`
   - `packages/shared/` → `packages/tunelo-shared/`
   - `infra/` → `infra/tunelo/`
   - `docs/` → `docs/tunelo/`
   - `plans/` → `plans/tunelo/`
   - `tests/` → `tests/tunelo/`
   - `scripts/` → `scripts/tunelo/`
   - File ở root (`README*`, `CLAUDE.md`, `biome.json`, `tsconfig.base.json`, `vitest.config.ts`, `package.json`, `pnpm-workspace.yaml`, `.github/`) → `tunelo-root-import/`, để gộp tay ở bước 3.
   - Đổi tag: `v*` → `tunelo-v*` (Jev 0.70: tag có tiền tố theo sản phẩm, tránh trùng `v0.x` của Localman).
2. Trong repo `localman-next`: `git remote add tunelo-import $WORKSPACE/tunelo-import`, `git fetch tunelo-import --tags`, rồi `git merge --allow-unrelated-histories tunelo-import/main`. Commit message ghi rõ lý do gộp.
3. Gộp file ở root trong một commit riêng:
   - Workspace gồm `apps/*` và `packages/*`.
   - **Biome** dùng chung cho cả monorepo (Tunelo đã dùng; thay ESLint/Prettier ở bước 1 của phase này).
   - Script root có filter theo package.
   - `CLAUDE.md` có một mục riêng cho Tunelo (giữ các quy tắc bảo mật và bảng mã lỗi).
   - Workflow publish đổi thành `.github/workflows/tunelo-publish-cli.yml`, chạy theo tag `tunelo-v*`.
   - Đổi tên ADR của Tunelo sang `docs/decisions/tunelo/`.
   - Xoá `tunelo-root-import/` sau khi gộp xong.
4. Kiểm tra: `pnpm install`, `pnpm --filter @tunelo/server test`, `pnpm --filter tunelo test`, `pnpm --filter tunelo build`. `git log --follow apps/tunelo-server/src/tunnel-manager.ts` phải thấy được lịch sử cũ.
5. Repo `github.com/achoo254/tunelo` cũ (Jev 0.94): thêm commit cuối có README "Đã chuyển sang github.com/achoo254/localman-next (packages/tunelo-cli, apps/tunelo-server)", rồi **archive** trên GitHub. Field `repository` của npm package `tunelo` trỏ sang `achoo254/localman-next`. Archive là thao tác public trên GitHub nên phải hỏi user trước.
6. Deploy server Tunelo **giữ PM2** qua `infra/tunelo/deploy.sh` (Jev 0.98); chỉ sửa path trong script. Đổi sang Docker Compose thì làm sau.

## Files to Create
- `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `.editorconfig`, `.gitignore`, `.env.example`, `docker-compose.yml` (mongo:7 cho dev)
- `biome.json` dùng chung cho monorepo (gộp với cấu hình của Tunelo ở bước 0b): bật `noExplicitAny` và `noNonNullAssertion` ở mức error
- `apps/web/`: `vite.config.ts`, `index.html`, `src/main.tsx`, `src/app.tsx`, `src/router.tsx`, `src/styles/tokens.css`, `src/styles/global.css`, `tailwind` theme qua `@theme` trong `global.css`
- `apps/web/src/components/ui/`: `button.tsx`, `icon-button.tsx`, `input.tsx`, `select.tsx`, `textarea.tsx`, `modal.tsx`, `dropdown-menu.tsx`, `badge.tsx`, `alert.tsx`, `tooltip.tsx`, `toast.tsx`, `form-field.tsx`, `modal-footer.tsx`
- `apps/api/`: `src/config/env.ts` (zod validate env), `src/db/connect-mongo.ts`, `src/dashboard-server.ts`, `src/mock-server.ts`, `src/http/error-handler.ts`, `src/http/async-handler.ts`, `vitest.config.ts`
- `packages/shared/` (tên package `@localman/shared`, tránh trùng `@tunelo/shared`): `src/index.ts`, `src/plan-limits.ts`

## Tasks & Steps
1. Khởi tạo pnpm workspace với Node 22 LTS. Thêm script gốc `dev`, `build`, `lint`, `typecheck`, `test`.
2. Viết `packages/design-tokens/tokens.css` dựa trên **Radix Colors v3** (`@radix-ui/colors`, MIT):
   - Neutral light: 50 `#F4F7FA` … 900 `#0F1E2D`.
   - Màu chủ đạo `violet`, màu xám `slate`; semantic: success `green`, warning `amber`, error `red`, info `blue`. Dùng các bước theo đúng ý nghĩa của Radix: 1–2 nền, 3–5 nền component (thường, hover, active), 6–8 viền, 9–10 màu đặc, 11 chữ độ tương phản thấp, 12 chữ độ tương phản cao. Dark mode dùng các thang `*Dark`.
   - Màu semantic: success `#0B7F58`, warning `#A35F08`, error `#B91C1C`.
   - Radius 4/8/12/16/24. Motion 150/200/300ms với các easing standard, decelerate, accelerate.
   - Font: **Inter** cho UI và văn xuôi, **JetBrains Mono** cho code, URL, nhãn method và wordmark (OFL; chọn sau khi so sánh hiển thị tiếng Việt có dấu chồng, xem Validation Log; tự host qua `@fontsource` kèm subset `vietnamese`).
   - Dark mode: viết `@media (prefers-color-scheme: dark)`, có guard `:root:not([data-theme="light"])`, kèm khối `:root[data-theme="dark"]`.
3. Map các token này vào Tailwind `@theme` để class kiểu `bg-surface` hay `text-primary` không phải hardcode hex.
4. Viết `global.css`: nền lưới 100px bằng `linear-gradient` dùng token, `prefers-reduced-motion` đưa duration về 1ms.
5. Dựng primitive UI theo ngôn ngữ của nguồn (xem báo cáo §2.6):
   - Nút bo 12px, scale ≤1.03 khi hover và 0.97 khi active, focus ring 2px offset 2.
   - Modal bo 16px với 4 size sm/md/lg/xl. Animation fade cùng trượt từ -20px trong 200ms, easing decelerate. Footer dính đáy gồm 2 cột.
   - Badge chữ mono uppercase. Icon dạng Tabler stroke 1.5 (`@tabler/icons-react`).
   - Gắn `data-id` cho các khối cấp trang.
6. Wordmark `Localman`: JetBrains Mono đậm, chữ "Local" màu violet bước 11. Không dùng logo của mockapi.io hay Postman.
7. **Operation registry, nguồn duy nhất cho REST, MCP và OpenAPI.** User yêu cầu mọi tính năng đều có MCP tool (2026-10-08).
   - `packages/operations/src/define-operation.ts`: `defineOperation({id, method, path, input: zod, output: zod, scopes, policy, annotations:{readOnly, destructive, idempotent}, toolset, mcp: true | {exempt: '<lý do>'}, dryRun?: boolean, handler})`.
   - Từ một khai báo, hệ thống sinh ra: (a) route Express có validate và check quyền, (b) MCP tool có JSON Schema lấy từ zod (phase 17 dựng server), (c) OpenAPI 3.1 cho docs.
   - Từ phase 02 trở đi, mọi API **phải** khai báo qua registry; không viết route Express tay cho nghiệp vụ.
   - Script `pnpm check:mcp-coverage` chạy trong CI: operation nào thiếu MCP mà không có `exempt` kèm lý do thì CI fail.
8. API: Express 5 với `helmet`, `express.json({limit:'100kb'})`, error handler chuẩn `{error:{code,message}}`, endpoint `GET /healthz` trên cả hai server.
9. `packages/shared/plan-limits.ts` là **nguồn duy nhất** cho mọi hạn mức (Jev quyết 2026-10-08, xem `../reports/competitive-261008-1308-localman-vs-mockapi-postman.md`). Có kèm hàm `limitsFor(plan)`.
   - `FREE = {projects:3, resources:10, customResponse:true, objectTemplate:true, teamWorkspaces:1, membersPerWorkspace:3, forkPrPublic:false, mockRequestsPerMonth:10_000, proxyRequestsPerMonth:5_000, trashDays:30, requestLogDays:7, webhookInboxes:2}`
   - `PRO = {projects:20, resources:50, customResponse:true, objectTemplate:true, teamWorkspaces:Infinity, membersPerWorkspace:10, forkPrPublic:true, mockRequestsPerMonth:null, proxyRequestsPerMonth:null, trashDays:30, requestLogDays:30, webhookInboxes:20}`
   - `null` nghĩa là không giới hạn theo tháng, chỉ còn rate-limit theo giây.
   - Hạn mức Free được đặt cao hơn mockapi.io và Postman Free một cách có chủ đích. Hạn mức đó không phải một phần của việc "mô phỏng 100%", vì mô phỏng 100% là về tính năng.

## Verification
- `pnpm install && pnpm lint && pnpm typecheck && pnpm test` đều pass.
- `docker compose up -d mongo && pnpm dev`: web mở được ở `localhost:5173`, `curl localhost:4000/healthz` và `curl localhost:4100/healthz` đều trả 200.
- `pnpm check:tokens` (script tự viết: không có hex, rgb hay px khoảng cách nằm ngoài `tokens.css`) sạch; kiểm tương phản bằng `apca-w3`/WCAG cho các cặp chữ và nền chính ở cả hai theme.

## Giao việc
**Đợt:** 1 · **Phụ thuộc trước khi bắt đầu:** không có phụ thuộc kỹ thuật; theo thứ tự đợt thì chạy sau Đợt 0 (plan IdP 01–03) · **Lệnh cook:** `/ak:cook plans/dattqh/261008-1123-localman-core/phase-01-scaffold-and-brand-foundation.md`

| # | Việc | Vai trò | Song song | File chính |
|---|---|---|---|---|
| T1 | Clone chỉ đọc repo cũ vào `../localman` (bước 0.1). Khởi tạo pnpm workspace Node 22 với script gốc `dev`, `build`, `lint`, `typecheck`, `test`. `docker-compose.yml` chạy mongo:7 dạng single-node replica set, vì phase 04 cần transaction | fullstack-developer | — | `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `.editorconfig`, `.gitignore`, `.env.example`, `docker-compose.yml` |
| T2 | Gộp Tunelo giữ lịch sử (bước 0b.1–2): chạy `git filter-repo` trên `/tmp/tunelo-import` theo bảng đổi path, đổi tag `v*` thành `tunelo-v*`, rồi merge `--allow-unrelated-histories` với commit message ghi rõ lý do gộp | fullstack-developer | — | `apps/tunelo-server/`, `packages/tunelo-cli/`, `packages/tunelo-shared/`, `infra/tunelo/`, `docs/tunelo/` |
| T3 | Gộp file root trong một commit riêng (bước 0b.3 và 0b.6): `biome.json` chung bật `noExplicitAny` và `noNonNullAssertion` mức error, script root có filter, mục Tunelo trong `CLAUDE.md`, workflow `tunelo-publish-cli.yml` theo tag `tunelo-v*`, ADR sang `docs/decisions/tunelo/`, field `repository` của npm `tunelo` trỏ sang `achoo254/localman-next`, sửa path trong `infra/tunelo/deploy.sh`, rồi xoá `tunelo-root-import/`. Chạy kiểm tra ở bước 0b.4 | fullstack-developer | — | `biome.json`, `CLAUDE.md`, `.github/workflows/tunelo-publish-cli.yml`, `packages/tunelo-cli/package.json`, `infra/tunelo/deploy.sh` |
| T4 | Push nhánh và các tag `tunelo-v*` lên `achoo254/localman-next`. Trước khi push, xác nhận commit của tag lịch sử không có `.github/workflows/` ở root (filter-repo đã dời vào `tunelo-root-import/`), để tag cũ không kích hoạt publish npm **(cần user xác nhận)** | fullstack-developer | — | remote `origin` |
| T5 | Commit README cuối "Đã chuyển sang github.com/achoo254/localman-next (packages/tunelo-cli, apps/tunelo-server)" vào repo `achoo254/tunelo` cũ, rồi archive repo đó trên GitHub (bước 0b.5) **(cần user xác nhận)** | fullstack-developer | với T6–T10 | repo `achoo254/tunelo` |
| T6 | Viết design token dựa trên Radix Colors và Inter và JetBrains Mono (bước 2–4): `tokens.css` đủ neutral, primary/accent, semantic, radius, motion, font và dark mode; map token vào Tailwind `@theme`; nền lưới 100px và `prefers-reduced-motion` trong `global.css`. Đối chiếu màu, chữ và nền lưới với `prototype/index.html` | ui-ux-designer | với T8, T9 | `apps/web/src/styles/tokens.css`, `apps/web/src/styles/global.css` |
| T7 | Dựng khung `apps/web` (Vite, React 19, router) và 13 primitive UI theo bước 5: nút bo 12px scale 1.03/0.97, modal 4 size với animation 200ms decelerate và footer dính đáy, badge mono uppercase, icon Tabler stroke 1.5, `data-id` cho khối cấp trang. Thêm wordmark `Localman` (bước 6). Đối chiếu primitive với `prototype/index.html` | fullstack-developer | với T8, T9 (sau T6) | `apps/web/vite.config.ts`, `apps/web/index.html`, `apps/web/src/{main,app,router}.tsx`, `apps/web/src/components/ui/*` |
| T8 | Khung `apps/api` (bước 8): `env.ts` validate bằng zod, `connect-mongo.ts`, hai entrypoint có `helmet`, `express.json({limit:'100kb'})`, error handler `{error:{code,message}}`, `async-handler` và `GET /healthz` ở cổng 4000 và 4100. Tạo `@localman/shared` với `plan-limits.ts` và `limitsFor(plan)` đúng số ở bước 9 | fullstack-developer | với T6, T7 | `apps/api/src/{config/env.ts,db/connect-mongo.ts,dashboard-server.ts,mock-server.ts}`, `apps/api/src/http/*`, `apps/api/vitest.config.ts`, `packages/shared/src/{index,plan-limits}.ts` |
| T9 | Operation registry (bước 7): `defineOperation` sinh route Express có validate và check quyền, descriptor MCP tool có JSON Schema lấy từ zod, và OpenAPI 3.1. Viết script `pnpm check:mcp-coverage` fail khi operation thiếu MCP mà không có `exempt` kèm lý do. Phần mount route vào `dashboard-server.ts` làm sau khi T8 xong | fullstack-developer | với T6, T7 | `packages/operations/src/*`, `scripts/check-mcp-coverage.ts` |
| T10 | Viết `README.md`, phần Localman trong `CLAUDE.md` (giữ mục Tunelo của T3) và `docs/` theo kiến trúc monorepo mới, có mô tả operation registry (bước 0.3) | docs-manager | — (sau T9) | `README.md`, `CLAUDE.md`, `docs/*` |
| T11 | Viết unit test cho `plan-limits`, `defineOperation` và `check:mcp-coverage` (ca thiếu MCP phải fail), rồi chạy toàn bộ mục Verification | tester | — | `packages/*/src/**/*.test.ts`, `apps/api/src/**/*.test.ts` |
| T12 | Review cuối phase | code-reviewer | — | toàn phase |

### Checklist
- [ ] T1 Clone chỉ đọc repo cũ; workspace pnpm, script gốc và Mongo replica set chạy được
- [ ] T2 Tunelo đã gộp với path mới, tag `tunelo-v*`, lịch sử còn nguyên
- [ ] T3 File root đã gộp trong một commit riêng; `tunelo-root-import/` đã xoá
- [ ] T4 Đã push nhánh và tag `tunelo-v*` sau khi user xác nhận
- [ ] T5 Repo `achoo254/tunelo` cũ có README chuyển hướng và đã archive sau khi user xác nhận
- [ ] T6 `tokens.css`, `@theme` và `global.css` xong, khớp prototype
- [ ] T7 Khung web, 13 primitive và wordmark xong
- [ ] T8 Khung api, hai `/healthz` và `plan-limits` xong
- [ ] T9 Operation registry và `check:mcp-coverage` xong
- [ ] T10 README, CLAUDE.md và docs phản ánh kiến trúc mới
- [ ] T11 Test mới pass và các mục Verification đã chạy
- [ ] T12 Review không còn finding chặn
- [ ] Verification: `pnpm install && pnpm lint && pnpm typecheck && pnpm test` pass
- [ ] Verification: `docker compose up -d mongo && pnpm dev` mở được web ở `localhost:5173`; `curl localhost:4000/healthz` và `curl localhost:4100/healthz` trả 200
- [ ] Verification: `pnpm check:tokens` sạch; không có hex nằm ngoài `tokens.css`; tương phản đạt ở cả hai theme
- [ ] Verification: `pnpm --filter @tunelo/server test`, `pnpm --filter tunelo test` và `pnpm --filter tunelo build` pass; `git log --follow apps/tunelo-server/src/tunnel-manager.ts` thấy lịch sử cũ
- [ ] `pnpm lint && pnpm typecheck && pnpm test` sạch
- [ ] `pnpm check:mcp-coverage` chạy được và fail đúng khi có operation thiếu MCP (phase này tạo script)
