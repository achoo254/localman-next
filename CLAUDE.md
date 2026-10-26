# CLAUDE.md

Monorepo `localman-next`: bộ Localman (mock API, API client trên web, MCP, DevOps toolkit) và Tunelo (tunnel tới localhost). Thứ tự triển khai: `plans/dattqh/EXECUTION.md`.

## Localman

```
apps/web/                # React 19 + Vite 7 + Tailwind 4 (:5173)
apps/api/                # Express 5: dashboard API (:4000) và mock runtime (:4100)
packages/operations/     # defineOperation → route REST, MCP tool, OpenAPI 3.1
packages/shared/         # @localman/shared, plan-limits.ts là nguồn duy nhất của hạn mức
packages/design-tokens/  # tokens.css, nơi duy nhất chứa literal màu (kèm SVG icon và badge)
packages/brand/generated/ # manifest + icon do pnpm brand:gen sinh (scripts/brand-gen.ts, gói @shared-next/brand)
scripts/                 # check-mcp-coverage.ts, check-tokens.ts, brand-gen.ts
e2e/                     # Playwright: whole stack on fixed ports 46xx (support/stack.ts)
```

Commands: `pnpm dev`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm e2e`, `pnpm check:mcp-coverage`, `pnpm check:tokens`, `pnpm check:i18n`, `pnpm check:brand` (ba lệnh này chạy kèm `pnpm lint`), `pnpm brand:gen`. Mỗi phase phải sạch `pnpm lint && pnpm typecheck && pnpm test && pnpm check:mcp-coverage` và E2E. Máy dev 16 GB dùng chung: **không chạy full `pnpm test` hay `pnpm e2e` trên máy dev**. Local chỉ chạy `pnpm lint`, `pnpm typecheck` và đúng file test liên quan (`pnpm vitest run <file>`); bộ đầy đủ chạy trên CI (`.github/workflows/ci.yml`, kích hoạt khi push `main` hoặc mở PR): push rồi đọc kết quả bằng `gh run watch`, CI xanh mới báo xong. Tunelo cũng theo luật này: không chạy cả bộ `pnpm test:tunelo-e2e` trên máy dev.

Quy tắc:
- **API nghiệp vụ chỉ khai báo qua `defineOperation`** rồi thêm vào `apps/api/src/operations/registry.ts`; không viết route Express tay. Mọi operation có MCP tool, hoặc `mcp: { exempt: "<lý do>" }`. Xem `docs/operation-registry.md`.
- **Hạn mức gói** chỉ đọc qua `limitsFor(plan)` từ `@localman/shared`. `Infinity` thành `null` khi `JSON.stringify`, nên map tường minh trước khi trả cho client.
- **UI** chỉ dùng token và utility Tailwind đã map (`bg-surface`, `text-fg`, `text-muted`…), không hex/rgb/px khoảng cách. Dùng primitive trong `apps/web/src/components/ui/` trước khi tạo mới. Xem `docs/design-system.md`.
- **Chữ người dùng thấy** đi qua `t()` (`apps/web/src/i18n/`): English là nguồn và mặc định, kèm `zh-CN` và `vi`; không hard-code chuỗi, không nêu tên đối thủ. Xem `docs/i18n.md`.
- **Tên sản phẩm, bundle id, mẫu host** chỉ khai trong `brand.config.json`; code đọc `brand.appName` từ `@localman/shared/brand`, không viết cứng `"Localman"` (`check:brand`, CLI của `@shared-next/brand`, chặn). Mã thương hiệu (schema, generator, check) nằm ở gói dùng chung `@shared-next/brand` (repo `shared-next`), không sửa tại chỗ; desktop chỉ là PWA. Xem `docs/decisions/0006-brand-config-and-product-name.md`.
- **Favicon/manifest/icon cài app của web** (`apps/web/src/config/brand-install-assets.ts`) bật bằng `"webInstall": true` trong `brand.config.json` từ 26/10/2026 (icon thiết kế bằng AI đã có trong `packages/design-tokens`); nginx trả `manifest.webmanifest` với MIME `application/manifest+json` (`infra/localman/nginx/localman-app.inc`). Đổi icon: thay SVG, `pnpm brand:gen`, commit; chi tiết ở ADR-0006.
- Lỗi API theo dạng `{ error: { code, message } }`; không lộ stack ra client, không log secret.
- Internal package `@localman/*` là source-only TS (`exports` trỏ vào `src/index.ts`); import tương đối dùng đuôi `.js` (NodeNext), trừ `apps/web` (Bundler).
- TypeScript strict, không `any` (dùng `unknown` + type guard), không non-null assertion `!`, named exports, file kebab-case, ≤ 200 dòng.
- **Dữ liệu theo tenant** (`docs/decisions/0003-tenant-scoped-data.md`): model mới gắn `schema.plugin(tenantScopePlugin)` sau mọi `schema.index` và trước `mongoose.model`. Không ghi thô qua `Model.collection` hay dùng `acrossTenants` ngoài danh sách của `tenant-models.test.ts`. Việc chạy ngoài request (timer, job) phải giữ tenant của mục và ghi trong `runInTenant`; job định kỳ đi qua `runInPrimaryTenant`. Chỉ có tenant `primary` (đơn tenant từ 24/10/2026, ADR-0003 đã superseded): Host ngoài allowlist (`PUBLIC_URL`, `MOCK_BASE_DOMAIN`, `TUNNEL_DOMAINS` cùng subdomain; loopback ngoài production) nhận 421.
- Kiến trúc tổng thể: `docs/system-architecture.md`.

## Tunelo

Self-hosted ngrok alternative. WebSocket relay tunnel proxy that exposes local services via public HTTPS wildcard subdomains. Gộp vào monorepo này (lịch sử giữ nguyên, tag cũ đổi thành `tunelo-v*`).

```
apps/tunelo-server/      # Tunnel server (deployed to VPS, PM2)
packages/tunelo-cli/     # CLI tool (npm package: tunelo)
packages/tunelo-shared/  # Shared types & WS protocol (@tunelo/shared)
infra/tunelo/            # nginx, certbot, PM2 configs, deploy.sh
docs/tunelo/             # Tunelo documentation
tests/tunelo/            # E2E tests
```

Commands (run from the repo root):

```bash
pnpm dev:tunelo-server                 # Dev server (reads apps/tunelo-server/.env)
pnpm dev:tunelo-cli                    # Dev client
pnpm build:tunelo-server               # Bundle server into dist/tunelo-server/
pnpm build:tunelo-cli                  # Bundle CLI into packages/tunelo-cli/dist/
pnpm --filter @tunelo/server test
pnpm --filter tunelo test
pnpm test:tunelo-e2e
VPS_HOST=<ssh alias> bash infra/tunelo/deploy.sh   # Deploy server (PM2)
```

Release CLI: tag `tunelo-vX.Y.Z` triggers `.github/workflows/tunelo-publish-cli.yml`.

- **Dữ liệu Tunelo** (mục "One domain" của `docs/tunelo/deployment-guide.md`): model mới gắn `tenantScopePlugin`; request chạy trong tenant `primary` dựng từ env khi Host thuộc `TUNNEL_DOMAINS` (hoặc loopback ngoài production), host khác nhận 421 (`apps/tunelo-server/src/tenancy/`); trạng thái trong bộ nhớ (tunnel, cache, stream) khoá theo `tenantKey(subdomain)`; frame từ client chỉ nhận từ đúng connection đã gửi request. Phần dùng chung với Localman nằm ở `packages/tenancy` (`@localman/tenancy`). CLI chỉ gửi token tới Tunelo cùng domain với issuer của phiên (`acceptsAccountToken`).

### Coding Rules

Read `docs/tunelo/code-standards.md` for full details. Quick reference:

- **TypeScript strict** — `strict: true`, no `any` (use `unknown` + type guards)
- **ESM only** — `"type": "module"` in all package.json
- **Named exports only** — no `export default`
- **Max 200 lines/file** — split if exceeds
- **kebab-case filenames** — `tunnel-manager.ts`, `request-relay.ts`
- **Structured errors** — `TuneloError` class with `TUNELO_xxx` error codes
- **pino logging** — JSON structured, never string concatenation
- **vitest** — co-located `__tests__/` directories
- **Biome** — lint + format, run before commit

### Security Rules

This is a **tunnel proxy** — it relays untrusted HTTP traffic. Critical rules:

1. **Validate all WS messages** — JSON.parse in try-catch, validate schema with type guards
2. **Sanitize headers** — strip hop-by-hop headers (`Connection`, `Transfer-Encoding`, `Upgrade`, etc.)
3. **Max body size** — reject payloads >10MB
4. **Rate limit WS** — drop connections exceeding 100 msg/s
5. **Subdomain validation** — regex `^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$`
6. **Timeout everything** — HTTP relay 30s, WS ping/pong 30s
7. **API keys** — store hashed (SHA-256), never log plaintext
8. **No eval/exec** — never use `eval()`, `Function()`, `child_process.exec()` with user input

### What NOT to Do

- Never use `any` type — use `unknown` + narrowing
- Never log API keys or sensitive data in plaintext
- Never use `eval()` or `exec()` with user input
- Never skip input validation on WS messages
- Never commit `.env` files or API keys
- Never store plaintext API keys on server
- Never use barrel files (`index.ts` re-exports) — import directly
- Never use `console.log` — use pino logger
- Never skip Biome lint before committing

### Error Code Reference

| Code | Meaning |
|------|---------|
| `TUNELO_AUTH_001` | Invalid API key |
| `TUNELO_AUTH_002` | API key required |
| `TUNELO_AUTH_003` | Token lacks the scope (link token opening a tunnel, `tunnels:read` vs `tunnels:open`) |
| `TUNELO_AUTH_004` | Anonymous token past `LEGACY_TOKEN_CUTOFF`; run `tunelo login` |
| `TUNELO_TUNNEL_001` | Subdomain already in use |
| `TUNELO_TUNNEL_002` | No tunnel found for subdomain |
| `TUNELO_TUNNEL_003` | Tunnel connection lost |
| `TUNELO_RELAY_001` | Request relay timeout |
| `TUNELO_RELAY_002` | Response too large |
| `TUNELO_SERVER_001` | Server startup failed |
| `TUNELO_DEVICE_004` | Anonymous device sign-in closed (`AUTH_MODE=hybrid`); update CLI and `tunelo login` |
| `TUNELO_LINK_001` | Invalid or expired link code |
| `TUNELO_LINK_002` | Too many wrong link codes / link requests (rate limited) |
| `TUNELO_LINK_003` | Link not found |
| `TUNELO_LINK_004` | Token not bound to a machine (cannot link) |

### Architecture Reference

See `docs/tunelo/system-architecture.md` for full details.

```
Browser → nginx (443, TLS, wildcard cert)
       → Tunnel Server (HTTP + WS)
       → WebSocket (persistent)
       → Client CLI
       → localhost:PORT
```

## Đồng bộ context và ghi lý do thay đổi

Vì code clone/chạy trên nhiều máy, "lý do thay đổi" phải đi theo `git pull` — KHÔNG để trong session/memory cục bộ của Claude. Quy ước:

- **Commit message phải có "why"** trong body (conventional commit), không chỉ "what".
- **Quyết định kiến trúc / đánh đổi lâu dài** → ghi ADR vào `docs/decisions/` (ADR của Tunelo ở `docs/decisions/tunelo/`) (copy `0000-adr-template.md`).
- **Kế hoạch feature/fix** → `plans/<user>/` (scope theo người, tránh xung đột merge).
- **Đặt tên file/ADR theo nội dung**, không theo số phase / mã plan (plan đổi tên thì reference thành rác).
- **Secret**: mọi `.env.*` đã gitignore — KHÔNG commit. Lỡ lộ lên git → **rotate ngay** (`git rm --cached` không đủ vì secret vẫn trong history).
