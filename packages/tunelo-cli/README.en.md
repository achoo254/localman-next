# Tunelo

**[Tieng Viet](./README.md)** | English

Self-hosted tunnel proxy that exposes local services via public HTTPS wildcard subdomains. Your infrastructure, your rules — no cloud dependency, no artificial limits.

```
npx tunelo http 3000
# => https://myapp.tunnel.hoandat.com
```

## Why Tunelo?

ngrok is great — until you hit the free tier wall. Tunelo is a self-hosted alternative that removes those limits entirely.

### Tunelo vs ngrok

| | **Tunelo** (self-hosted) | **ngrok Free** | **ngrok Pay-as-you-go** |
|---|---|---|---|
| **Cost** | Free (your VPS) | $0 | $20+/month |
| **Endpoints** | Unlimited | 3 max | Unlimited |
| **Bandwidth** | Unlimited (VPS limit) | 1 GB/month | 5 GB included, then $0.10/GB |
| **Requests** | Unlimited | 20k/month | 100k included, then $1/100k |
| **Rate limit** | Configurable | 4k req/min | 20k req/min |
| **Custom subdomains** | Yes (wildcard `*.your-domain`) | No | Yes |
| **Self-hosted** | Yes | No | No |
| **Open source** | Yes (MIT) | No (proprietary) | No (proprietary) |
| **Data routing** | Direct (your server) | Through ngrok cloud | Through ngrok cloud |
| **Interstitial page** | None | Yes (free tier) | None |

> **Sources:** [ngrok Pricing](https://ngrok.com/pricing) | [ngrok Agent Docs](https://ngrok.com/docs/agent/)

### Why Not Other Alternatives?

| Tool | Trade-off |
|------|-----------|
| **Cloudflare Tunnel** | Free but requires Cloudflare — still cloud-dependent, vendor lock-in |
| **FRP** | Self-hosted & battle-tested (100k+ GitHub stars), but steeper learning curve, no out-of-box HTTPS |
| **localtunnel** | Unmaintained since 2024, public servers unreliable |
| **bore** | TCP-only, no HTTP/HTTPS support |

Tunelo targets the sweet spot: **ngrok-like simplicity** + **FRP-like self-hosting** + **out-of-box HTTPS** via wildcard certs.

## How It Works

```
Browser → nginx (TLS, wildcard cert) → Tunnel Server (WS) → Client CLI → localhost:PORT
```

1. Client CLI connects to tunnel server via WebSocket
2. Server assigns a public subdomain (e.g. `myapp.tunnel.hoandat.com`)
3. HTTP requests to that subdomain are relayed through the WS connection to your local service

### Performance

Tunelo uses the raw [`ws`](https://github.com/websockets/ws) library (189M+ weekly npm downloads) instead of Socket.IO for maximum performance:

| Metric | ws (Tunelo) | Socket.IO | Improvement |
|--------|-------------|-----------|-------------|
| Memory per connection | ~3 KB | ~8 KB | 2.7x less |
| Latency (p99, 1K clients) | ~12 ms | ~32 ms | 2.7x faster |
| Throughput | 44K+ msg/s | 27K msg/s | 1.6x more |
| Connection handshake | <50 ms | ~186 ms | 3.7x faster |

At 5K concurrent tunnels, Tunelo uses ~15-20 MB server memory vs ~150-200 MB with Socket.IO.

> **Sources:** [ResearchGate: WebSocket Library Benchmarks (2024)](https://www.researchgate.net/publication/397311491) | [DEV Community: ws vs socket.io](https://dev.to/alex_aslam/nodejs-websockets-when-to-use-ws-vs-socketio-and-why-we-switched-di9)

## Quick Start

### Install the CLI

The CLI is published on [npm](https://www.npmjs.com/package/tunelo) as `tunelo` — no repo clone, registry setup or token needed. Requires Node.js 20+.

```bash
# npm
npm install -g tunelo

# or pnpm (run `pnpm setup` once so the global bin is on PATH)
pnpm setup && pnpm add -g tunelo

tunelo --version
tunelo update           # upgrade to the latest version
tunelo update --check   # only check, do not install
```

Upgrading from the old `@dattqh/tunelo` (installed from a GitLab registry)? See [README.md](./README.md#chuyển-từ-bản-cũ-dattqhtunelo-cài-từ-gitlab-registry) for the one-time migration.

### Upgrading from 1.6.x to 1.7.0

- The default server is now `tunnel.hoandat.com`. A saved config pointing at `tunnel.inetdev.io.vn` is moved to the new server on first run.
- Sign in with your account instead of the old Approve page. Old anonymous tokens still work, but `tunelo whoami` reminds you to sign in; run `tunelo login` once so this machine's tunnels belong to your account:

```bash
npm i -g tunelo@latest && tunelo login
```

### Step 1 — sign in

```bash
tunelo login
#   Sign in to Tunelo in your browser:
#   https://auth.hoandat.com/device?user_code=...
#   Confirm the code: ABCD-EFGH
#   Waiting for approval...
```

The browser opens `auth.hoandat.com`: sign in with Google or GitHub (skipped if you already have a session), check that the code matches the terminal, then allow this machine. The CLI stores a refresh token in `~/.tunelo/config.json` (mode 600) and refreshes the access token whenever it opens a tunnel. Each machine is its own device; review or sign out machines at [auth.hoandat.com/account](https://auth.hoandat.com/account).

- Already signed in: `tunelo login` says so and stops; `--force` signs in again.
- Another Tunelo server: `tunelo login --server https://tunnel.<domain>`. The CLI signs in at `https://auth.<domain>` (derived from the server name) and makes that server the default. Account tokens are only sent to the Tunelo of the account's own domain.
- No browser (CI): `tunelo login --legacy-key <token>`, or `--legacy-key` with the token in `TUNELO_KEY` (anonymous token).

### Step 2 — open a tunnel

```bash
tunelo http 3000
# => https://<random>.tunnel.hoandat.com  →  http://localhost:3000

tunelo http 3000 -s myapp        # specific subdomain → https://myapp.tunnel.hoandat.com
tunelo http 3000:web 5000:api    # several tunnels, one subdomain per port
tunelo http 8080 -a user:pass    # protect the tunnel with Basic Auth
tunelo tcp 5432                  # TCP tunnel (e.g. PostgreSQL)
```

Press `Ctrl+C` to stop.

## CLI Usage

| Command | What it does |
|---------|--------------|
| `tunelo login [--force] [--server <url>] [--legacy-key [token]]` | Sign in with your account (device flow in the browser) |
| `tunelo whoami [--server <url>]` | Which account (or anonymous token) this machine uses |
| `tunelo logout` | Revoke this machine's sign-in and remove its tokens |
| `tunelo http <ports...>` | HTTP tunnel(s); `<port>` or `<port>:<subdomain>`, see `tunelo http --help` |
| `tunelo tcp <port> [--remote-port <port>]` | TCP tunnel |
| `tunelo status` | List tunnels running on this machine |
| `tunelo kill <pid\|subdomain\|all>` | Stop a running tunnel |
| `tunelo watch [pid\|subdomain\|URL]` | Follow a running tunnel's requests from another terminal (`-n`, `--status 5xx`, `--path <text>`, `--headers`, `--body`). Since 1.9.0 |
| `tunelo link <code>` | Let Localman see this machine's tunnels without an account (anonymous machines only) |
| `tunelo links` / `tunelo links revoke <id>` | List or revoke this machine's links |
| `tunelo mcp` | Run an MCP server (stdio) so AI agents can open tunnels |
| `tunelo update [--check]` | Update to the latest version |
| `tunelo config --server <url>` / `--key <token>` / `--show` | Set the default server, set an anonymous token, show config |

Config priority: CLI flags (`--key`, `--server`) > env vars (`TUNELO_KEY`, `TUNELO_SERVER`) > `~/.tunelo/config.json`.

Changes per version: [CHANGELOG.md](./CHANGELOG.md).

## Project Structure

Tunelo lives in the [localman-next](https://github.com/achoo254/localman-next) monorepo:

```
localman-next/
├── apps/tunelo-server/      # Tunnel server (HTTP + WebSocket relay)
├── packages/tunelo-cli/     # CLI tool (npm: tunelo)
├── packages/tunelo-shared/  # WS protocol types, constants, error codes
├── infra/tunelo/            # nginx, certbot, PM2, deploy script
├── tests/tunelo/            # E2E test suite
└── docs/tunelo/             # Documentation
```

## Development

Run from the monorepo root:

```bash
pnpm dev:tunelo-server   # Dev server (tsx --watch)
pnpm dev:tunelo-cli      # Dev client
pnpm build:tunelo-server # Bundle server into dist/tunelo-server
pnpm build:tunelo-cli    # Bundle CLI into packages/tunelo-cli/dist
pnpm --filter @tunelo/server test
pnpm --filter tunelo test
pnpm lint                # Lint (biome)
```

## Deploy to VPS

See `docs/tunelo/deployment-guide.md` in the monorepo for full instructions. Quick summary:

1. Setup DNS: `A tunnel.hoandat.com` and `A *.tunnel.hoandat.com → VPS_IP` (DNS only)
2. Get wildcard SSL: `bash infra/certbot-setup.sh`
3. Configure nginx: `cp infra/nginx.conf /etc/nginx/sites-available/tunelo`
4. Deploy: `bash infra/deploy.sh`

## Security

- API keys validated via SHA-256 hash comparison
- WS message rate limiting (configurable, default 1000 msg/s)
- Request/response body size limit (50 MB)
- Subdomain validation via RFC 1123 regex
- Hop-by-hop header stripping
- Native WS ping/pong keepalive (30s interval)
- Auth timeout (10s) — unauthenticated connections terminated
- `readyState` guard on all WebSocket sends — no writes to closed connections
- Graceful shutdown on SIGTERM/SIGINT

## Tech Stack

- **Runtime:** Node.js 20+ (ESM, TypeScript strict)
- **Server:** `http` + `ws` WebSocketServer (no framework, no Socket.IO)
- **Client:** `commander` + `chalk` + `ws`
- **Protocol:** JSON discriminated unions over raw WebSocket
- **Testing:** vitest (19 tests — unit + E2E)
- **Lint:** Biome
- **Deploy:** nginx + PM2 + rsync

## License

MIT
