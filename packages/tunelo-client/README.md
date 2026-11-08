# @tunelo/client

The Tunelo tunnel client and account sign-in as a library: expose a local HTTP or WebSocket server through a Tunelo relay without installing the `tunelo` CLI. The CLI is built on this package.

## Install

Git dependency, pinned to a tag (no npm release):

```json
"@tunelo/client": "github:achoo254/localman-next#tunelo-client-v0.1.0&path:/packages/tunelo-client"
```

`dist/` (JS and `.d.ts`) is committed, so the package installs as is. Node ≥ 20; types need `@types/node`.

## Open a tunnel

```ts
import {
	TunnelClient,
	accountTokenFor,
	fileSessionStore,
} from "@tunelo/client";

const serverUrl = "https://tunnel.hoandat.com";
const store = fileSessionStore("/path/chosen/by/you/session.json");

const client = new TunnelClient({
	serverUrl,
	getApiKey: accountTokenFor(store, serverUrl), // required
	kind: "machine", // background agent: held subdomain, own quota
	deviceId: stableMachineId, // keys the held subdomain
	subdomain: savedSubdomain, // optional: the one granted before
	localPort: 43123, // your local HTTP/WebSocket server
});
client.on("error", (err) => log(err));
const { url, subdomain } = await client.connect();
```

The library never reads credentials on its own: `getApiKey` is called before every connect and reconnect. `client.connect()` rejects with `TunnelAuthError` (`code`: `TUNELO_*`) when the server refuses; reconnects stop on errors with `fatal: true` (see `stopsReconnecting`). Event payloads: `TunnelClientEvents`.

Refusal codes (`TUNNEL_REFUSAL_CODES`): `TUNELO_TUNNEL_001` subdomain in use, `TUNELO_TUNNEL_004` subdomain held for another account or machine, `TUNELO_TUNNEL_005` quota exceeded.

## Sign in

```ts
import { deviceSignIn, serverIdentity } from "@tunelo/client";

await deviceSignIn({
	issuer: serverIdentity(serverUrl)?.issuer ?? "https://auth.hoandat.com",
	store,
	onCode: (a) => show(a.verificationUriComplete ?? a.verificationUri, a.userCode),
});
```

The session (rotating refresh token) stays in the file you chose, owner-only; refreshes run under a lock file beside it (`<path>.lock`), so several processes sharing the file rotate the token once. `getAccessToken(store)` throws `SessionExpiredError` when the grant is gone.

## Measure

`scripts/ws-echo-roundtrip.ts` opens a machine tunnel to a local WebSocket echo server and prints round-trip times (usage in the file header).

## Develop

`src/shared/` is a copy of `@tunelo/shared` sources (`pnpm --filter @tunelo/client sync:shared`; a test fails when it drifts). Rebuild with `pnpm --filter @tunelo/client build` and commit `dist/`; CI fails when it differs from a fresh build.
