# Changelog

Changes to the `tunelo` CLI on npm. Each version is released from the tag `tunelo-vX.Y.Z`.

## 1.9.1 — 2026-10-19

### Fixed

- `tunelo link` works on a machine whose saved sign-in belongs to another server. Such a machine runs its tunnels on its anonymous token, so it could not be linked and Localman never saw its tunnels; `link` now applies the same rule as `tunelo http` and suggests `tunelo login` to use the account instead.
- The stopped-tunnel message names the panel's actual "Send again" button.

## 1.9.0 — 2026-10-13

### Added

- `tunelo watch [PID|subdomain|URL]` follows a running tunnel's requests from another terminal: the last recorded requests, then each new one (time, method, status, duration, path). `--status` and `--path` filter; `--headers` and `--body` print details. With no target it watches the only running HTTP tunnel, otherwise lists them.

## 1.8.0 — 2026-10-13

### Added

- `tunelo login --server https://tunnel.<domain>` signs in for the Tunelo of another domain at `https://auth.<domain>` and makes that server the default. Account tokens are only sent to the Tunelo of the account's own domain.

### Changed

- The old domain `tunnel.inetdev.io.vn` is retired. A saved config on it moves to `tunnel.hoandat.com`. **CLI 1.6.x defaults to the old domain and can no longer connect: run `npm i -g tunelo@latest && tunelo login`.**

### Fixed

- A failed `tunelo login --server` keeps the current sign-in and default server; the old grant is revoked only after the new sign-in succeeds.
- A machine signed in on a domain that later returned as a tenant keeps its server instead of being moved to the primary one.

## 1.7.0 — 2026-10-12

### Added

- `tunelo login` signs in with your account at `auth.hoandat.com` (OAuth device flow) instead of the old Approve page. The refresh token is stored in `~/.tunelo/config.json` (mode 600) and refreshed under a file lock. `--legacy-key` keeps an anonymous token for CI.
- `tunelo logout` revokes this machine's sign-in at the identity provider.
- `tunelo whoami` shows the account, or the anonymous token in use.
- `tunelo link <code>`, `tunelo links`, `tunelo links revoke <id>` let Localman see the tunnels of a machine without an account.
- `tunelo mcp` runs a local MCP server (stdio) so AI agents can open and close tunnels.
- Machines still on an anonymous token get a reminder to sign in.

### Changed

- The default server is `tunnel.hoandat.com`; a saved config on the old domain moves there with a one-line notice.
- Anonymous tokens keep working until the server's cutoff date, which has not been announced yet.
