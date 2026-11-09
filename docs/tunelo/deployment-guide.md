# Deployment Guide

## Release & Deploy

Tunelo nằm trong monorepo `localman-next` (GitHub `achoo254/localman-next`): server ở `apps/tunelo-server`, thư viện ở
`packages/tunelo-client` và `packages/tunelo-shared`, gói CLI cũ ở `packages/tunelo-cli` (xem
[system-architecture.md](../system-architecture.md)). Chương trình chạy trên máy người dùng là `tunelo` 2.x của chat-next
([ADR-0006](../decisions/tunelo/0006-cli-moved-to-tunelo-agent.md)).

### Chương trình trên máy người dùng

- **`tunelo` 2.x** là binary của chat-next (`apps/agent`), phát hành ở GitHub Releases của `achoo254/chat-next` với tag
  `tunelo-v2.*` (asset `tunelo-darwin-arm64`, `tunelo-darwin-x64`, `tunelo-windows-x64.exe`, kèm `.minisig` và
  `SHA256SUMS`), cập nhật bằng `tunelo update` của chính nó. Cài: lệnh trong `TUNELO_INSTALL_COMMANDS` của
  `packages/tunelo-shared/src/release.ts` (script `https://chat.hoandat.com/agent/install.sh` cho macOS,
  `install.ps1` cho Windows PowerShell). Cách phát hành và gỡ: chat-next `apps/agent/README.md`.
- **Gói `tunelo` 1.12.0** (`tunelo-v1.12.0`, file `tunelo.tgz`) là bản cuối của gói cũ; nội dung ở
  `packages/tunelo-cli/CHANGELOG.md`. Workflow `.github/workflows/tunelo-release.yml` (đẩy tag `tunelo-vX.Y.Z`) chỉ còn
  để sửa khẩn bản này; không phát hành tính năng mới ở đây, không dùng npm registry.
- `releases/latest` của repo này phải luôn là `tunelo-v1.12.0`: CLI 1.11 trở về trước đọc nó để lên 1.12. Release khác
  trong repo này tạo với `--latest=false`.
- Thư viện `@tunelo/client`, `@tunelo/shared`: chỉ git tag `tunelo-client-vX.Y.Z` / `tunelo-shared-vX.Y.Z` (cách phát hành
  trong `CLAUDE.md`). Đổi giao thức tunnel: tag thư viện ở đây, deploy server, rồi chat-next nâng tag và phát hành binary.

### Thứ tự deploy khi đổi hợp đồng với tunelo 2.x

Mỗi bước chỉ thêm, bước sau dựa vào bước trước:

1. auth-next có client và scope mà binary cần (`tunelo-agent`, `machines:write`).
2. **tunelo-server** (cửa kiểm `/.tunelo/forward`, `POST|GET /api/links/self`): phải chạy trước khi bất kỳ `tunelo` nào
   bật chuyển tiếp. Server tương thích ngược, tunnel thường và CLI 1.x vẫn chạy.
3. **Localman** api + web (`infra/localman/deploy.sh`, runbook [`docs/deployment-guide.md`](../deployment-guide.md)): route
   `POST /tunelo/links/self` và nginx `location = /tunelo/links/self` trong `infra/localman/nginx/localman-app.inc`
   (route nằm ngoài `/api/`, thiếu location thì rơi vào trang tĩnh và trả 405).
4. Phát hành binary `tunelo` 2.x ở chat-next, rồi gói 1.12 ở đây.

Sao lưu ngay trước bước 2 và 3:

- Tunelo: cả DB bằng `mongodump --gzip --archive=/var/www/tunelo/backups/tunelo-<stamp>.archive.gz`, URI đọc từ tệp
  cấu hình chứ không qua argv; chép `server.mjs`, `server.mjs.map`, `package.json`, `pnpm-lock.yaml`,
  `ecosystem.config.cjs`, `static/` sang `/var/www/tunelo/backups/release-<stamp>/` để lùi code.
- Localman: `bash /opt/localman/infra/backup-localman-db.sh`.

Kiểm sau deploy (ngoài `/health` và `pm2 status tunelo` ở mục PM2):

```bash
# Đường forward không mở cho header giả: 404 trên tunnel máy, "Tunnel not found" (502) trên subdomain không tồn tại
curl -s -o /dev/null -w '%{http_code}\n' -H 'Tunelo-Forward-Granted: 1' -H 'Tunelo-Local-Port: 22' \
  https://m-<hash>.tunnel.hoandat.com/.tunelo/forward/
# Localman nhận self-link: 401 khi không có token (405 là nginx thiếu location)
curl -s -o /dev/null -w '%{http_code}\n' -X POST https://localman.hoandat.com/tunelo/links/self
```

Log của process mới phải có `MongoDB connected` và các tunnel cũ `Tunnel registered` lại; không dòng nào chứa token.
Lùi tunelo-server: chép lại các file từ `backups/release-<stamp>/`, `pnpm install --prod`, khởi động lại pm2 app
`tunelo`; dữ liệu chỉ cần `mongorestore` khi bản mới đã ghi vào DB.

### Server — deploy thủ công lên staging

Server **không** có pipeline tự động. Deploy từ máy có SSH tới staging:

```bash
VPS_HOST=<ssh alias> bash infra/tunelo/deploy.sh   # VPS_HOST bắt buộc; REMOTE_DIR override được
```

Script build bundle (`pnpm build:tunelo-server`), rsync `dist/tunelo-server/server.mjs`, `package.json`
và `ecosystem.config.cjs` lên server, cài dependency production rồi restart PM2.

Trước đây deploy staging chạy tự động bằng GitLab CI mỗi lần push `main`; pipeline
này đã gỡ cùng với repo GitLab. Nếu dựng lại bằng GitHub Actions, workflow cần các
secret tương ứng: `SSH_PRIVATE_KEY`, `STAGING_HOST`, `STAGING_PORT`,
`STAGING_USER`, `DEPLOY_PATH`.

Deploy **không** đồng bộ `.env` — file secret nằm sẵn trên server tại
`/var/www/tunelo/.env` và được `infra/tunelo/ecosystem.config.cjs` nạp qua `--env-file`.
Server **bắt buộc** `MONGO_URI` (thiếu thì process dừng lúc khởi động,
`apps/tunelo-server/src/key-store/create-key-store.ts`). Danh sách biến và giải thích:
`apps/tunelo-server/.env.example`; bản sao production ở iCloud `ENV production/tunelo/.env`.

## Prerequisites

- Domain: `tunnel.hoandat.com` + `*.tunnel.hoandat.com` (Cloudflare zone `hoandat.com`)
- Node.js (theo `engines` trong `package.json` gốc) và pm2 trên server; MongoDB cho `MONGO_URI`

## DNS Setup

Cloudflare zone `hoandat.com`, both records **DNS only** (grey cloud): the
Universal SSL cert does not cover `*.tunnel.hoandat.com`, and tunnels need long
WebSockets and their own TCP ports.
```
tunnel.hoandat.com      A  <SERVER_65_IP>   (DNS only)
*.tunnel.hoandat.com    A  <SERVER_65_IP>   (DNS only)
```

## SSL Certificate (Let's Encrypt)

Wildcard cert by DNS-01 through the Cloudflare plugin, reusing the token that
already renews `localman.hoandat.com` (`Zone:DNS:Edit` on `hoandat.com`, only
usable from <SERVER_65_IP>): `bash infra/tunelo/certbot-setup.sh` on the server.
Cert: `/etc/letsencrypt/live/tunnel.hoandat.com/`; `certbot-renew.timer` renews
it and reloads nginx.

## Web console (tunnel.hoandat.com)

The apex `https://tunnel.hoandat.com/` serves the web console (sign-in through
`auth.hoandat.com` with client `tunelo-web`, live tunnels of the account). It is on
when `/var/www/tunelo/.env` has `TUNELO_WEB_CLIENT_SECRET` (the same value as
`TUNELO_WEB_CLIENT_SECRET` in `/var/www/hoandat-auth/.env`) and `WEB_SESSION_KEY`
(32 random bytes, base64url; changing it signs everyone out), plus
`TUNELO_WEB_CLIENT_ID=tunelo-web` and `TUNELO_WEB_PUBLIC_URL`; see
`apps/tunelo-server/.env.example`. Copies live in iCloud `ENV production/tunelo/.env`.
Missing or invalid values only turn the console off (log line names the variables);
the API, relay and WebSockets keep running. Startup logs `Web console enabled`.
Sessions are in the `web_sessions` collection (TTL); refresh tokens are bound to the
IdP session, so signing out at `auth.hoandat.com` ends console sessions.
The header, page frame, footer, language links and theme switch come from
`@achoo254/app-shell` (bundled into `server.mjs`); `pnpm build:tunelo-server` copies
its `tokens.css`, `app-shell.css` and `app-shell-enhance.js` to `static/app-shell/`,
served at `/assets/app-shell/`. The console's CSP (set by the app, not nginx) allows
scripts from `'self'` for that file plus the Cloudflare beacon, never inline script.
Rollback: remove the two variables and restart `tunelo`, or restore
`server.mjs.bak-pre-web-console` and `package.json.bak-pre-web-console`.

## One domain (no tenants)

Since 2026-10-24 Tunelo serves only `TUNNEL_DOMAINS` (`tunnel.hoandat.com` and
`*.tunnel.hoandat.com`) as the primary tenant, built from `TUNNEL_DOMAINS`,
`AUTH_ISSUER` and `AUTH_AUDIENCE`. Every other Host gets 421 (HTTP) or a refused
WebSocket upgrade, `127.0.0.1` included in production; `/health` still answers on
loopback. Documents keep `tenantId: "primary"` and the tenant-prefixed indexes; nothing
is migrated at startup any more (startup only builds the indexes). The server no longer
reads `IDP_INTERNAL_URL`, `IDP_INTERNAL_SECRET`, `IDP_LOOPBACK_URL`, `TUNELO_CLIENT_KEY`
(unused variables are ignored, so deploy first, then delete them), and the
`tunelo-tenants.conf` nginx file is gone from the repo: remove
`/etc/nginx/conf.d/tunelo-tenants.conf` by hand after the deploy, then `nginx -t`.
Check after a deploy:

```bash
curl -s -o /dev/null -w '%{http_code}\n' -H 'Host: evil.example' http://127.0.0.1:3001/   # 421
curl -s http://127.0.0.1:3001/health                                                       # 200
```

The old `users` collection (one document, no `tenantId`) is a leftover of the account
system removed in July 2026 (no model reads it); it is neither read nor migrated.

The HTTP/WebSocket port listens on `TUNNEL_HOST` (`127.0.0.1` from `infra/tunelo/ecosystem.config.cjs`):
only nginx reaches it, so its Host-equals-SNI check cannot be skipped by calling `:3001` directly.
TCP tunnel ports are not affected.

`tunelo` signs in at `auth.hoandat.com` (client `tunelo-agent`) and sends the account token only to the
production server `tunnel.hoandat.com`, its default; a development server of your own takes the sign-in only with
`TUNELO_DEV_ALLOW_CUSTOM_SERVER=1` (chat-next `apps/agent/src/identity/credentials.ts`).

## Browser WebSockets through a tunnel

A browser WebSocket to `https://<sub>.tunnel.hoandat.com` is relayed as `ws-open` →
`ws-data`/`ws-close` frames to the CLI, which opens the WebSocket to the local app.
How the browser's handshake is answered depends on the CLI:

- **Client that declares `capabilities: ["ws-open-result"]` in `auth`** (`tunelo` 2.x, through `@tunelo/client`):
  the server holds the upgrade, sends `ws-open`, and waits for the CLI's
  `ws-open-result`. `ok: true` ⟹ `101` with the subprotocol the app selected; `ok: false`
  ⟹ the app's own status (403, 401, 404, 429…), its headers minus hop-by-hop, framing and
  `sec-websocket-*`, and at most 4 KiB of its body; app unreachable ⟹ `502`; no answer
  within `WS_APP_OPEN_RESULT_TIMEOUT_MS` (15 s) ⟹ `504`. A browser that hangs up while
  held gets its local WebSocket closed (`ws-close` code 1001). Logs: `Browser WS bridged`,
  `Browser WS rejected by app` (with `status`), `Browser WS rejected`, `Browser WS abandoned`.
- **CLI 1.11 and older**: `101` at once, then the relay closes it if the app refuses — the app's
  status never reaches the caller.

The per-tunnel cap (`WS_APP_MAX_PER_TUNNEL`, held upgrades included) and basic auth are
checked before `ws-open` is sent. Constants: `packages/tunelo-shared/src/constants.ts`;
messages: `packages/tunelo-shared/src/protocol.ts`.

Both sides stay compatible in either order: an older server ignores the `capabilities`
field and the `ws-open-result` message, and the new CLI still sends the `ws-close` an older
server needs. Deploy the server first, then release the CLI; the new behaviour starts for
each tunnel once its CLI is updated and reconnects. Check, with a tunnel on the new CLI in
front of an app that checks `Origin`:

```bash
curl --http1.1 -si https://<sub>.tunnel.hoandat.com/<ws-path> -H 'Origin: https://evil.example' \
  -H 'Connection: Upgrade' -H 'Upgrade: websocket' -H 'Sec-WebSocket-Version: 13' \
  -H 'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==' | head -1     # the app's status, not 101
```

## Database

Server tự tạo collection và index lúc khởi động qua schema Mongoose (`apps/tunelo-server/src/db/models/`).

## nginx Configuration

The deployed file is `infra/tunelo/nginx.conf`, installed as
`/etc/nginx/conf.d/tunelo.conf`. Back the old one up, copy, `nginx -t`, then
`systemctl reload nginx` (the server is shared: never reload on a failed test).

## PM2

pm2 app `tunelo` chạy `/var/www/tunelo/server.mjs` theo `infra/tunelo/ecosystem.config.cjs`;
`infra/tunelo/deploy.sh` chép file đó lên và restart. Kiểm sau deploy: `pm2 status tunelo`,
`curl http://127.0.0.1:3001/health` trên server.

## Response Cache (Valkey — optional, dev-first)

Tunnel server caches static FE responses in Valkey to skip the WS round-trip on
repeated loads. Respect-origin only (dev servers sending `no-cache` are never
cached); API/JSON/SSE/authed requests always bypass. Disabled entirely if
`REDIS_URL` is unset. See
[ADR-0001](../decisions/tunelo/0001-redis-response-cache-in-node-relay.md); variables in
`apps/tunelo-server/src/cache/cache-config.ts`.

Install (CentOS Stream 9): `dnf install -y valkey`, deploy `infra/tunelo/valkey.conf`
to `/etc/valkey/valkey.conf` (set `requirepass`), `systemctl enable --now valkey`.
