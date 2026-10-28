# Deployment Guide

## Release & Deploy

Tunelo nằm trong monorepo `localman-next` (GitHub `achoo254/localman-next`): server ở
`apps/tunelo-server`, CLI ở `packages/tunelo-cli`, code dùng chung ở `packages/tunelo-shared`
(xem [system-architecture.md](../system-architecture.md)). Repo riêng `achoo254/tunelo` cũ đã xoá.
CLI và server được phát hành theo hai đường riêng.

### CLI — GitHub Releases (GitHub Actions)

CLI phát hành ở GitHub Releases của repo `localman-next`, **không còn trên npm** (chốt
27/10/2026: chỉ chủ hệ sinh thái dùng Tunelo, tài khoản npm đang bị tạm khoá). Workflow
`.github/workflows/tunelo-release.yml` chạy khi đẩy git tag `tunelo-vX.Y.Z`: kiểm tra tag khớp
version → lint, test, E2E của Tunelo → `pnpm build:tunelo-cli` → `npm pack` từ
`packages/tunelo-cli/dist` thành `tunelo.tgz` → `gh release create` (đánh dấu latest, ghi chú lấy
từ mục của version trong `packages/tunelo-cli/CHANGELOG.md`).

Quy trình phát hành:

```bash
npm version <patch|minor|major> --workspace tunelo --no-git-tag-version   # bump packages/tunelo-cli
# đặt cùng version vào packages/tunelo-cli/src/version.ts (VERSION) — test version.test.ts kiểm tra khớp
# thêm mục "## X.Y.Z — <ngày>" vào packages/tunelo-cli/CHANGELOG.md
git commit -am "chore(tunelo): release X.Y.Z" && git tag tunelo-vX.Y.Z && git push && git push --tags
```

- Người dùng cài bằng `npm install -g https://github.com/achoo254/localman-next/releases/latest/download/tunelo.tgz`, cập nhật bằng `tunelo update` (đọc release mới nhất
  qua GitHub API rồi cài `tunelo.tgz` của đúng tag đó). Địa chỉ cài nằm ở `packages/tunelo-shared/src/release.ts`.
- `releases/latest` phải luôn là bản Tunelo: release khác trong repo này phải tạo với `--latest=false`.
- Gói `tunelo` trên npm dừng ở 1.9.1 (bản 1.10.0 publish thử ngày 27/10 bị npm chặn vì tài khoản đang bị khoá); recovery code 2FA
  của npm nằm ở iCloud `ENV production/npmjs/`.

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

The CLI signs in per server: `tunelo login --server https://tunnel.<domain>` signs in at
`https://auth.<domain>` (derived from the host, never from the server's answers) and makes
that server the default; the account token is only sent to the Tunelo of its own domain.
The production server is only `tunnel.hoandat.com`, the CLI's default.

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
