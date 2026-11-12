# CLAUDE.md

Monorepo `localman-next`: bộ Localman (mock API, API client trên web, MCP, DevOps toolkit) và Tunelo (tunnel tới localhost). Thứ tự triển khai: `plans/dattqh/EXECUTION.md`.

## Localman

```
apps/web/                # React 19 + Vite 7 + Tailwind 4 (:5173)
apps/api/                # Express 5: dashboard API (:4000) và mock runtime (:4100)
packages/operations/     # defineOperation → route REST, MCP tool, OpenAPI 3.1
packages/shared/         # @localman/shared, account-limits.ts là nguồn duy nhất của hạn mức
packages/design-tokens/  # tokens.css gốc (web nạp bản của @achoo254/app-shell, test giữ hai bản bằng nhau), SVG icon và badge
packages/brand/generated/ # manifest + icon do pnpm brand:gen sinh (scripts/brand-gen.ts, gói @achoo254/brand)
scripts/                 # check-mcp-coverage.ts, check-tokens.ts, brand-gen.ts
e2e/                     # Playwright: whole stack on fixed ports 46xx (support/stack.ts)
```

Commands: `pnpm dev`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm e2e`, `pnpm e2e:smoke`, `pnpm check:mcp-coverage`, `pnpm check:tokens`, `pnpm check:i18n`, `pnpm check:brand` (ba lệnh này chạy kèm `pnpm lint`), `pnpm brand:gen`. Mỗi phase phải sạch `pnpm lint && pnpm typecheck && pnpm test && pnpm check:mcp-coverage` và E2E smoke. Máy dev 16 GB dùng chung: **không chạy full `pnpm test` hay `pnpm e2e` trên máy dev**. Local chỉ chạy `pnpm lint`, `pnpm typecheck` và đúng file test liên quan (`pnpm vitest run <file>`); bộ đầy đủ chạy trên CI (`.github/workflows/ci.yml`, kích hoạt khi push `main` hoặc mở PR; các job chạy song song, unit chia 4 shard): push rồi đọc kết quả bằng `gh run watch`, CI xanh mới báo xong. Tunelo cũng theo luật này: không chạy cả bộ `pnpm test:tunelo-e2e` trên máy dev.

E2E Playwright (`e2e/specs/`) chỉ giữ hành trình quan trọng:
- Push/PR chạy bộ smoke (`pnpm e2e:smoke`, test có `@smoke` cuối tên): đăng ký tới lần gọi API đầu, đăng nhập im lặng, xoá tài khoản, kho secret (cả agent), chia sẻ công khai (khách, link), MCP OAuth và luồng agent, một luồng collection.
- Spec không có `@smoke` là hành vi chỉ trình duyệt thật kiểm được (CORS và redirect của trình duyệt, Web Worker chạy script, Tunelo qua fake server, nút Run nhúng trang khác); chúng chạy hằng đêm cùng smoke (`.github/workflows/e2e-nightly.yml`, 02:00 giờ Việt Nam, chạy tay bằng `gh workflow run e2e-nightly.yml`).
- Logic nghiệp vụ (hạn mức, route, biến, fork, changelog, traffic…) khoá bằng unit test hoặc integration test của API (Mongo in-memory, `apps/api/src/**/*.test.ts`) và test component của web, không viết thêm e2e.
- Chỉ thêm spec e2e cho một hành trình quan trọng mới mà unit/API test không thay được; spec đó gắn `@smoke` nếu hỏng là người dùng không dùng được sản phẩm, còn lại để chạy đêm.

Quy tắc:
- **API nghiệp vụ chỉ khai báo qua `defineOperation`** rồi thêm vào `apps/api/src/operations/registry.ts`; không viết route Express tay. Mọi operation có MCP tool, hoặc `mcp: { exempt: "<lý do>" }`. Xem `docs/operation-registry.md`.
- **Hạn mức** (một mức cho mọi tài khoản, không có gói: ADR-0011) chỉ đọc qua `LIMITS` từ `@localman/shared`. `Infinity` thành `null` khi `JSON.stringify`, nên map tường minh trước khi trả cho client.
- **UI** chỉ dùng token và utility Tailwind đã map (`bg-surface`, `text-fg`, `text-muted`…), không hex/rgb/px khoảng cách. Dùng primitive trong `apps/web/src/components/ui/` trước khi tạo mới. Xem `docs/design-system.md`.
- **Chữ người dùng thấy** đi qua `t()` (`apps/web/src/i18n/`): English là nguồn và mặc định, kèm `zh-CN` và `vi`; không hard-code chuỗi, không nêu tên đối thủ. Xem `docs/i18n.md`.
- **Tên sản phẩm, bundle id, mẫu host** chỉ khai trong `brand.config.json`; code đọc `brand.appName` từ `@localman/shared/brand`, không viết cứng `"Localman"` (`check:brand`, CLI của `@achoo254/brand`, chặn). Mã thương hiệu (schema, generator, check) nằm ở gói dùng chung `@achoo254/brand` (repo `shared-next`), không sửa tại chỗ; desktop chỉ là PWA. Xem `docs/decisions/0006-brand-config-and-product-name.md`.
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
packages/tunelo-cli/     # npm package tunelo, last version 1.12: hands every command to tunelo 2.x (chat-next apps/agent)
packages/tunelo-client/  # @tunelo/client: tunnel client + device-flow sign-in as a library (built output committed)
packages/tunelo-shared/  # Shared types & WS protocol (@tunelo/shared, built output committed)
infra/tunelo/            # nginx, certbot, PM2 configs, deploy.sh
docs/tunelo/             # Deployment guide (ADR: docs/decisions/tunelo/)
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
pnpm --filter @tunelo/client test
pnpm --filter @tunelo/client build        # Rebuild the committed build after changing src/
pnpm --filter @tunelo/shared build        # Same for @tunelo/shared
pnpm --filter @tunelo/client sync:shared  # Re-copy @tunelo/shared sources into src/shared/
pnpm test:tunelo-e2e
VPS_HOST=<ssh alias> bash infra/tunelo/deploy.sh   # Deploy server (PM2)
```

Release CLI: tag `tunelo-vX.Y.Z` triggers `.github/workflows/tunelo-release.yml` (GitHub release with `tunelo.tgz`; the CLI is not on npm). 1.12.0 is the last one: the commands, inspector and MCP of Tunelo now live in tunelo 2.x (chat-next `apps/agent`, released there as `tunelo-v2.*` binaries; it has no local portal, the web side is only `tunnel.hoandat.com` on tunelo-server; [ADR-0006](docs/decisions/tunelo/0006-cli-moved-to-tunelo-agent.md)); 1.12 runs the 2.x binary at `%LOCALAPPDATA%\tunelo\tunelo.exe` / `~/.local/bin/tunelo` with the same argv, and without it `tunelo update` runs the 2.x install script (`TUNELO_INSTALL_COMMANDS` in `packages/tunelo-shared/src/release.ts`).

Release `@tunelo/client`: git tag `tunelo-client-vX.Y.Z` only (no GitHub Release, so `releases/latest`, which `tunelo update` reads, stays the CLI). Consumers install `github:achoo254/localman-next#tunelo-client-vX.Y.Z&path:/packages/tunelo-client`, so the package has no `workspace:*` dependency: `src/shared/` is a copy of `@tunelo/shared` (a test fails when it drifts), and its built output is committed (CI fails when it is stale). The library never reads credentials: callers pass `getApiKey` and choose the session file (`fileSessionStore(path)`).

Release `@tunelo/shared` the same way: git tag `tunelo-shared-vX.Y.Z`, installed as `github:achoo254/localman-next#tunelo-shared-vX.Y.Z&path:/packages/tunelo-shared`; its built output is committed too (same CI check). The `tunelo` 2.x process (chat-next `apps/agent`) uses both packages from these tags.

- **Machine tunnels** (`kind: "machine"` in `auth`, used by background agents): subdomain `m-<hash>` derived from the account (`ownerSub`) and `deviceId` (`apps/tunelo-server/src/machine-subdomain.ts`), so it is the same on every connection with nothing stored; only that account opens it, no other tunnel may take a name of that shape, and a new connection of the same machine replaces its stale one. Own quota (20 per account, `DEFAULT_MAX_MACHINE_TUNNELS`, the same as Chat's machines and Localman's `MAX_TUNNEL_LINKS`), apart from the 3 `tunelo http` tunnels. One tunnel per machine channel (no `register-tunnel`/`tcp-register`).

- **Local forward** (`LOCAL_FORWARD` in `packages/tunelo-shared/src/constants.ts`): `tunelo` gets a link token for its machine with `POST /api/links/self` (account token, `deviceId`, `clientName`) and hands it to Localman (`POST /tunelo/links/self`, `machines:write`; nginx location in `infra/localman/nginx/localman-app.inc`); the link token lists that machine's tunnels and, sent as `Tunelo-Access` to `<machine tunnel>/.tunelo/forward/<path>` with `Tunelo-Local-Port`, reaches `localhost:<port>` on it. The relay drops every client-sent `tunelo-*` header on machine tunnels (`Tunelo-Forward-*` on every tunnel), answers 404 to anything but the owner's token for that machine, refuses `DENY_PORTS`, logs each forward without headers or body, and only then adds `Tunelo-Forward-Granted: 1` (`apps/tunelo-server/src/local-forward-gate.ts`). Machine tunnels get `features: ["local-forward"]` in `auth-result`: the machine serves the path only from servers that say so.

- **Dữ liệu Tunelo** (mục "One domain" của `docs/tunelo/deployment-guide.md`): model mới gắn `tenantScopePlugin`; request chạy trong tenant `primary` dựng từ env khi Host thuộc `TUNNEL_DOMAINS` (hoặc loopback ngoài production), host khác nhận 421 (`apps/tunelo-server/src/tenancy/`); trạng thái trong bộ nhớ (tunnel, cache, stream) khoá theo `tenantKey(subdomain)`; frame từ client chỉ nhận từ đúng connection đã gửi request. Phần dùng chung với Localman nằm ở `packages/tenancy` (`@localman/tenancy`). CLI chỉ gửi token tới Tunelo cùng domain với issuer của phiên (`acceptsAccountToken`).

### Coding Rules

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
3. **Max body size** — reject payloads above `MAX_BODY_SIZE` (`packages/tunelo-shared/src/constants.ts`)
4. **Rate limit WS** — drop connections exceeding `WS_RATE_LIMIT` (same file)
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
| `TUNELO_TUNNEL_004` | Subdomain held for another account or machine (client stops reconnecting) |
| `TUNELO_TUNNEL_005` | Tunnel quota exceeded (`tunelo http` or machine; a machine client stops reconnecting) |
| `TUNELO_RELAY_001` | Request relay timeout |
| `TUNELO_RELAY_002` | Response too large |
| `TUNELO_SERVER_001` | Server startup failed |
| `TUNELO_DEVICE_004` | Anonymous device sign-in closed (`AUTH_MODE=hybrid`); update CLI and `tunelo login` |
| `TUNELO_LINK_001` | Invalid self-link request (`clientName` missing) |
| `TUNELO_LINK_002` | Retired with the code pairing (`/api/links/init`, `approve`, `poll`); no longer sent |
| `TUNELO_LINK_003` | Link not found |
| `TUNELO_LINK_004` | Token not bound to a machine (cannot link) |
| `TUNELO_FORWARD_001` | Local forward: no link token of this machine's owner (404) |
| `TUNELO_FORWARD_002` | Local forward: port on the deny list (403) |
| `TUNELO_FORWARD_003` | Local forward: turned off on the machine (403, from `tunelo`) |
| `TUNELO_FORWARD_004` | Local forward: `Tunelo-Local-Port` is not a port (400) |
| `TUNELO_FORWARD_005` | Local forward: nothing listens on the port (502, from `tunelo`) |
| `TUNELO_FORWARD_006` | Local forward: rate limited (1200 a minute per machine, 100 refused per caller in 10 minutes) (429) |

### Architecture Reference

Decisions and boundaries: accounts via the shared IdP in `docs/decisions/tunelo/0004-accounts-via-central-idp.md`; boundary with Localman (import check, cross contracts) in `docs/decisions/tunelo/0005-stay-in-localman-monorepo.md`; CLI moved to tunelo 2.x in `docs/decisions/tunelo/0006-cli-moved-to-tunelo-agent.md`. Code linking (`/api/links/init|approve|poll`) retired, machines link to Localman only through `tunelo login`: `docs/decisions/tunelo/0007-retire-code-linking.md`. Operations: `docs/tunelo/deployment-guide.md`. Current API: `apps/tunelo-server/src/api/create-api-router.ts`.

```
Browser → nginx (443, TLS, wildcard cert)
       → Tunnel Server (HTTP + WS)
       → WebSocket (persistent)
       → tunelo (2.x binary, or CLI 1.x)
       → localhost:PORT
```

## Đồng bộ context và ghi lý do thay đổi

Vì code clone/chạy trên nhiều máy, "lý do thay đổi" phải đi theo `git pull` — KHÔNG để trong session/memory cục bộ của Claude. Quy ước:

- **Commit message phải có "why"** trong body (conventional commit), không chỉ "what".
- **Quyết định kiến trúc / đánh đổi lâu dài** → ghi ADR vào `docs/decisions/` (ADR của Tunelo ở `docs/decisions/tunelo/`) (copy `0000-adr-template.md`).
- **Kế hoạch feature/fix** → `plans/<user>/` (scope theo người, tránh xung đột merge).
- **Đặt tên file/ADR theo nội dung**, không theo số phase / mã plan (plan đổi tên thì reference thành rác).
- **Secret**: mọi `.env.*` đã gitignore — KHÔNG commit. Lỡ lộ lên git → **rotate ngay** (`git rm --cached` không đủ vì secret vẫn trong history).
