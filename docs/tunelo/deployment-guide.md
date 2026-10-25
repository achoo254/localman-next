# Deployment Guide

## Release & Deploy

Tunelo nằm trong monorepo `localman-next` (GitHub `achoo254/localman-next`): server ở
`apps/tunelo-server`, CLI ở `packages/tunelo-cli`, code dùng chung ở `packages/tunelo-shared`
(xem [system-architecture.md](../system-architecture.md)). Repo riêng `achoo254/tunelo` cũ đã xoá.
CLI và server được phát hành theo hai đường riêng.

### CLI — publish lên npm (GitHub Actions)

CLI phát hành công khai trên npm với tên gói **`tunelo`**
(<https://www.npmjs.com/package/tunelo>). Workflow
`.github/workflows/tunelo-publish-cli.yml` chạy khi đẩy git tag `tunelo-vX.Y.Z`: kiểm tra tag
khớp version → `pnpm lint` → `pnpm test` → `pnpm build:tunelo-cli` → `npm publish`
từ `packages/tunelo-cli/dist`.

Quy trình phát hành:

```bash
npm version <patch|minor|major> --workspace tunelo --no-git-tag-version   # bump packages/tunelo-cli
# đặt cùng version vào packages/tunelo-cli/src/version.ts (VERSION) — test version.test.ts kiểm tra khớp
git commit -am "chore(tunelo): release X.Y.Z" && git tag tunelo-vX.Y.Z && git push && git push --tags
```

- Xác thực bằng npm trusted publishing (OIDC), không token: npmjs.com → gói `tunelo` →
  Settings → Trusted Publisher (user `achoo254`, repo `localman-next`, workflow
  `tunelo-publish-cli.yml`, cho phép `npm publish`). Workflow có `id-token: write` và
  nâng npm lên 11 (cần ≥ 11.5.1). Recovery code 2FA của npm nằm ở iCloud
  `ENV production/npmjs/`.
- Một version đã lên npm không publish lại được — luôn bump version trước khi tag.
- Người dùng cài bằng `npm install -g tunelo`, cập nhật bằng `tunelo update`
  (xem `README.md`). Bản cũ `@dattqh/tunelo` từng phát hành trên GitLab registry
  đã ngừng; hướng dẫn chuyển nằm trong `README.md`.

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
`/var/www/tunelo/.env` và được `ecosystem.config.cjs` nạp qua `--env-file`.
Bản server hiện tại (MongoDB key-store) **bắt buộc** `MONGO_URI` và `JWT_SECRET`
trong file này, nếu thiếu process crash-loop lúc khởi động. Set tối thiểu:

```bash
TUNNEL_PORT=3001
TUNNEL_DOMAINS=tunnel.hoandat.com   # primary first; any others also accepted
MONGO_URI=mongodb://<user>:<pass>@localhost:27017/<db>   # required
JWT_SECRET=<openssl rand -base64 48>                     # required
ADMIN_EMAILS=you@example.com                             # optional
NODE_ENV=production
```

## Prerequisites

- VPS: Ubuntu 22.04+, 2-4 vCPU, 4-8GB RAM
- Domain: `tunnel.hoandat.com` + `*.tunnel.hoandat.com` (Cloudflare zone `hoandat.com`)
- Node.js 20+ installed on VPS
- pnpm installed on VPS
- MongoDB 5.0+ (v0.3: can run on same VPS or remote host)
- Email service (for future notifications, optional)

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
Rollback: remove the two variables and restart `tunelo`, or restore
`server.mjs.bak-pre-web-console` and `package.json.bak-pre-web-console`.

## Domain move from `tunnel.inetdev.io.vn`

Retired on 2026-10-13: the server answers `tunnel.hoandat.com` only. From 2026-10-12
to then it answered both domains (`TUNNEL_DOMAINS=tunnel.hoandat.com,tunnel.inetdev.io.vn`).

Moved on 2026-10-12: the three lab tunnel clients (`onedash-s3` on lab .171 via
`/root/.tunelo/config.json`; `onedash-staging` on .174, same file; `miu-staging` on
.176 via `TUNELO_SERVER` in `miu-tunnel.service`), the `Host` header of the
`onedash-s3.conf` and `miu-staging.conf` proxies, and OneDash staging log shipping
(`VL_INGEST_ENDPOINT`). The `ods3lab` tunnel and the `office.tunnel.inetdev.io.vn`
vhost were retired the same day (configs kept in `/root/nginx-bak/`).
Miu staging (`miu-staging` tunnel on .176, `miu-staging.conf` on .65, DNS
`miu-staging.hoandat.com`) was removed later that day; only Miu production remains.

Also moved on 2026-10-12: every lab machine runs `tunelo@1.7.0` from npmjs (the
old `@dattqh/tunelo` package removed), and `server-tools.conf` (`cloudpanel-dev.inet.vn`)
sends `Host onedash-staging.tunnel.hoandat.com` after OneDash learned that alias
(commit `50f03783c`: MCP public base, backend OAuth issuer, client host lists).

Checked on 2026-10-13 (read-only): `cloudpanel-dev.inet.vn` no longer depends on the
old domain (its proxy sends `Host onedash-staging.tunnel.hoandat.com`, the staging
client on 202.92.7.26 connects to `tunnel.hoandat.com` since 2026-10-12, no staging
request on the old domain since 2026-10-12 08:54). The old domain is therefore
retired; what remained on it:

- The OneDash dev setup, `onedash-dev.tunnel.inetdev.io.vn` (`.env.dattqh_lab` and
  the dev entries of the OneDash host lists) and the agents and OTLP exporters that
  call it: move them to `onedash-dev.tunnel.hoandat.com`.

`mail.tunnel.inetdev.io.vn` (OneMail dev, Collabora WOPI) goes too, by the owner's
decision of 2026-10-13: OneMail dev uses `mail.tunnel.hoandat.com` and Collabora
is tested another way.

Done on the server on 2026-10-13: `TUNNEL_DOMAINS=tunnel.hoandat.com` in
`/var/www/tunelo/.env`; the old domain's 443 block, its `tunnel_old_domain` log, its
port 80 names and both `mail.tunnel.inetdev.io.vn` blocks dropped from `tunelo.conf`
(previous file `/root/tunelo.conf.bak-261013-142454`); DNS records `tunnel`, `*.tunnel`
and `mail.tunnel` deleted in Cloudflare zone `inetdev.io.vn`; both certificates deleted
(archived in `/root/letsencrypt-inetdev-tunnel-261013.tgz`). CLI 1.6.x still defaults to
the old apex: those machines need `--server https://tunnel.hoandat.com` or a newer CLI.

From 2026-10-13 to 2026-10-24 `inetdev.io.vn` was a tenant of the IdP (the owner's
acceptance domain) and `tunnel.inetdev.io.vn` answered again for that tenant. The tenant
and its DNS records were removed on 2026-10-24: `TUNNEL_DOMAINS` is only
`tunnel.hoandat.com` now.

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

## MongoDB Setup (v0.3+)

### Option A: Local MongoDB (Same VPS)

```bash
# Install MongoDB Community Edition
curl -fsSL https://www.mongodb.org/static/pgp/server-5.0.asc | sudo apt-key add -
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/5.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-5.0.list
sudo apt update && sudo apt install -y mongodb-org

# Start and enable
sudo systemctl start mongod
sudo systemctl enable mongod

# Verify
mongo --eval "db.version()"

# Create tunelo database + indexes
mongo << 'EOF'
use tunelo
db.users.createIndex({ "email": 1 }, { unique: true })
db.apikeys.createIndex({ "userId": 1 })
db.apikeys.createIndex({ "keyHash": 1 }, { unique: true })
db.usagelogs.createIndex({ "keyId": 1 })
db.usagelogs.createIndex({ "date": 1 })
EOF

# Set connection string in .env
echo "MONGO_URI=mongodb://localhost/tunelo" >> /opt/tunelo/.env
```

### Option B: Remote MongoDB (e.g., Atlas)

1. Create cluster at [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Create database user (username + password)
3. Whitelist VPS IP in Network Access
4. Copy connection string

```bash
# .env example
MONGO_URI=mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/tunelo?retryWrites=true&w=majority
```

### Database Initialization

Server will auto-create collections and indexes on startup via Mongoose schemas.

## nginx Configuration

The deployed file is `infra/tunelo/nginx.conf`, installed as
`/etc/nginx/conf.d/tunelo.conf`. Back the old one up, copy, `nginx -t`, then
`systemctl reload nginx` (the server is shared: never reload on a failed test).

## PM2 Setup

```bash
# Install PM2 globally
sudo npm install -g pm2

# Build and deploy
cd /opt/tunelo
pnpm install --frozen-lockfile
pnpm build

# Start using config file
pm2 start infra/tunelo/pm2.config.cjs

# Save for auto-start on reboot
pm2 save
pm2 startup
```

PM2 config (`infra/tunelo/pm2.config.cjs`):
```javascript
module.exports = {
  apps: [{
    name: 'tunelo-server',
    script: 'apps/tunelo-server/dist/server.js',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      PORT: 3001,

      // Database (v0.3+)
      MONGO_URI: 'mongodb://localhost/tunelo',

      // JWT tokens
      JWT_SECRET: 'your-secret-key-min-32-chars',
      JWT_REFRESH_SECRET: 'your-refresh-key-min-32-chars',

      // Admin email whitelist (comma-separated)
      ADMIN_EMAILS: 'admin@example.com,dev@example.com',

      // Tunnel config
      TUNNEL_DOMAINS: 'tunnel.hoandat.com'
    }
  }]
};
```

**Important Environment Variables:**

| Var | Type | Example | Notes |
|-----|------|---------|-------|
| `MONGO_URI` | String | `mongodb://localhost/tunelo` | v0.3: Required for user/key storage |
| `JWT_SECRET` | String | 32+ random chars | Used to sign access tokens (24h) |
| `JWT_REFRESH_SECRET` | String | 32+ random chars | Used to sign refresh tokens (7d) |
| `ADMIN_EMAILS` | String | `admin@ex.com,dev@ex.com` | Comma-separated emails with admin access |
| `TUNNEL_DOMAINS` | String | `tunnel.hoandat.com` | Primary first (used in every URL handed out); others still accepted. `TUNNEL_DOMAIN` is read only when this is unset |
| `NODE_ENV` | String | `production` | Controls logging, error details |

**Generate secure secrets:**
```bash
# Generate random 32-char string
openssl rand -base64 24
```

## Deploy Steps (v0.3)

```bash
# On VPS as deploy user
git clone <repo> /opt/tunelo
cd /opt/tunelo

# Install dependencies (pnpm workspace)
pnpm install --frozen-lockfile

# Build all packages (TypeScript + Vite)
pnpm build

# (v0.3) Generate secrets
JWT_SECRET=$(openssl rand -base64 24)
JWT_REFRESH_SECRET=$(openssl rand -base64 24)
echo "JWT_SECRET: $JWT_SECRET"
echo "JWT_REFRESH_SECRET: $JWT_REFRESH_SECRET"

# (v0.3) Set up MongoDB
# ... (see MongoDB Setup section above)

# Edit PM2 config with secrets + MongoDB URI
vim infra/tunelo/pm2.config.cjs
# Set: MONGO_URI, JWT_SECRET, JWT_REFRESH_SECRET, ADMIN_EMAILS

# Start tunnel server
pm2 start infra/tunelo/pm2.config.cjs

# Verify it's running
pm2 status
curl http://localhost:3001/health  # Should return 200 OK
curl http://localhost:3001/api/admin/users \
  -H "Authorization: Bearer {admin_token}"  # Protected endpoint
```

**Verify Deployment:**
```bash
# Check server logs
pm2 logs tunelo-server

# Test tunnel endpoint from local machine
curl -i -N \
  -H "Connection: Upgrade" \
  -H "Upgrade: websocket" \
  -H "Sec-WebSocket-Key: x3JJHMbDL1EzLkh9GBhXDw==" \
  https://tunnel.hoandat.com/tunnel

# Should upgrade connection successfully
```

## Environment Variables Summary

### Core (v0.1+)

| Variable | Required | Type | Default | Notes |
|----------|----------|------|---------|-------|
| `PORT` | No | Number | 3001 | Server listening port |
| `NODE_ENV` | No | String | development | production / development |

### Database & Auth (v0.3+)

| Variable | Required | Type | Example | Notes |
|----------|----------|------|---------|-------|
| `MONGO_URI` | Yes | String | `mongodb://localhost/tunelo` | Connection string (local or Atlas) |
| `JWT_SECRET` | Yes | String | (32+ random chars) | Sign access tokens (24h expiry) |
| `JWT_REFRESH_SECRET` | Yes | String | (32+ random chars) | Sign refresh tokens (7d expiry) |
| `ADMIN_EMAILS` | No | String | `admin@ex.com,dev@ex.com` | Comma-separated admin emails |
| `TUNNEL_DOMAINS` | Yes | String | `tunnel.hoandat.com` | Tunnel domains, primary first |

### Response Cache (Valkey — optional, dev-first)

Tunnel server caches static FE responses in Valkey to skip the WS round-trip on
repeated loads. Respect-origin only (dev servers sending `no-cache` are never
cached); API/JSON/SSE/authed requests always bypass. Disabled entirely if
`REDIS_URL` is unset. See
`plans/dattqh/260724-1332-redis-response-cache/` and ADR-0001.

| Variable | Required | Default | Notes |
|----------|----------|---------|-------|
| `REDIS_URL` | No | (unset → cache off) | e.g. `redis://:<pass>@127.0.0.1:6379/0` |
| `CACHE_ENABLED` | No | `true` if `REDIS_URL` set | Kill-switch (`false` disables) |
| `CACHE_MAX_OBJECT_BYTES` | No | `5242880` (5MB) | Max cached response size |
| `CACHE_MAX_TTL_SECONDS` | No | `86400` | Cap on TTL (effective TTL = origin max-age) |

Install (CentOS Stream 9): `dnf install -y valkey`, deploy `infra/tunelo/valkey.conf`
to `/etc/valkey/valkey.conf` (set `requirepass`), `systemctl enable --now valkey`.

### Optional (Future)

| Variable | Purpose |
|----------|---------|
| `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` | Email service (future notifications) |

### .env.example Template

```bash
# Server
PORT=3001
NODE_ENV=production

# Database
MONGO_URI=mongodb://localhost/tunelo

# JWT
JWT_SECRET=your-32-char-secret-here-generate-new
JWT_REFRESH_SECRET=your-32-char-secret-here-generate-new

# Admin whitelist
ADMIN_EMAILS=admin@example.com

# Tunnel config
TUNNEL_DOMAINS=tunnel.hoandat.com
```
