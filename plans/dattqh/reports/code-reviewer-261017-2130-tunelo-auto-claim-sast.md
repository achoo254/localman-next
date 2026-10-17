# SAST review: T8b, the API client finds the user's Tunelo tunnels on its own

Date: 2026-10-17. Base: HEAD `e7a7e96` plus the uncommitted working tree. `plans/dattqh/261016-2140-tenant-blocks-own-real-ip/` was excluded.
Design reference: the "T8b, thiết kế chốt 2026-10-17" block in `plans/dattqh/261008-1123-localman-core/phase-10-api-client.md:87-92`.

## Scope

- Server: `apps/api/src/modules/tunelo/*` (new, 11 files plus `testing/`), `auth-module.ts`, `main.ts`, `feature-env.ts`, `feature-gates.ts`, `registry.ts`, `tenant-move.ts`
- Web: `routing/{auto-tunnel-hop,use-ask-queue,routed-sender,direct-hop,route-hops,use-router}`, `tunelo/{auto-tunnel,auto-tunnel-badge,choose-tunnel-modal,tunelo-connect-modal,tunnel-links-section,use-pairing,use-tunnel-links,local-tunnels-query,tunelo-accounts-api}`, i18n
- E2E: `e2e/specs/api-client-tunelo-accounts.spec.ts`, `e2e/support/tunelo-{server,control}.ts`, plus changes to `stack.ts` and `ports.ts`
- Tunelo contract (read only): `apps/tunelo-server/src/api/{tunnel-list-routes,link-routes}.ts`, `tunnel-directory.ts`, `services/device-link-service.ts`

## Checks run

| Check | Result |
|---|---|
| `vitest run --maxWorkers=2 src/modules/tunelo src/operations/feature-gates.test.ts src/tenancy` (api) | 12 files, 59/59 pass |
| `vitest run --maxWorkers=2 src/features/api-client/routing src/features/api-client/tunelo` (web) | 20 files, 94/94 pass |
| `biome check` on the changed dirs (103 files) | 0 diagnostics |
| `pnpm check:i18n`, `check:tokens`, `check:mcp-coverage` | exit 0 for each |
| grep for `any`, non-null `!` and `export default` in the new files | none found |
| New file length | largest is 199 lines (`tunelo-accounts-ui.test.tsx`); all ≤ 200 |

Not run: `pnpm typecheck`, the full suites, and `pnpm e2e`.

## Verdict

No Critical or High findings. Token handling, owner and tenant scoping, URL trust, and the feature gate hold. There are 2 Medium findings: one bypasses the secret-consent rule, the other lets one user block pairing for everyone. There are also 6 Low findings.

## Medium

### M1. Choosing "Proxy" on a tab skips the secret prompt for a tunnel the router picked on its own

- `apps/web/src/features/api-client/routing/routed-sender.ts:65-70`: `needTunnel` calls `viaAutoTunnel` with `why: "manual"`.
- `route-hops.ts` `consent()`: `const chosen = why === "manual" && ctx.routeChosen; if (chosen …) return true;`
- `route-plan.ts:93-96`: `mode === "proxy"` for a local target without a mapping gives `needTunnel`.
- **Scenario:** the user picks "Proxy" in a tab's route selector (`routeChosen = true`) and sends `http://localhost:3000` with a `{{secret}}` bearer. They have no mapping, and one of their machines linked with `tunelo link` has a tunnel on :3000. The router picks that tunnel and sends the secret through Tunelo to the machine without asking. In T8a, skipping the prompt was acceptable because the user had typed the mapping. Here the user chose "Proxy" (through the Localman server), not that tunnel or machine. This breaks the rule "a request with secrets going to Tunelo asks first" (`phase-10-api-client.md:112`).
- **Fix:** for tunnels found automatically, do not count `routeChosen` as consent. For example, use `why: "found"` (a new `RouteWhy`) or pass `found` into `consent()` and set `chosen = false` when `found` is set. Add a test to `auto-tunnel-hop.test.ts`: route Proxy chosen, one auto tunnel, a secret in the request, and `confirmSecrets` must be called.

### M2. One user can use up Tunelo's pairing budget for every Localman user

- `tunnel-pairing-service.ts:51-62` counts only pending pairings (at most 3), and cancelling a pending row (`deleteTunnelLink`) never calls Tunelo.
- On the Tunelo side, `link-routes.ts:13-14,56-60` allows 20 `POST /api/links/init` per 10 minutes **per client IP**. Every pairing comes from the Localman server's single IP, shared by all users and, on the primary install, all tenants.
- **Scenario:** a user loops start, cancel, start in the connect modal (or with a script against `POST /api/v1/client/tunnel-links` and `DELETE …/:id`). Twenty calls in 10 minutes make Tunelo answer 429 to every Localman user until the window ends. Honest use also adds up: 7 users holding 3 pending codes each already exceeds the budget. React StrictMode in dev opens and cancels a second pairing on every modal open.
- **Fix:** take a per-user slot over a time window before `initLink`, using the existing `takeOperationSlot` / `takeRateLimitSlot` (`apps/api/src/lib/operation-rate-limit.ts`), for example 5 starts per 10 minutes. Alternatively, count cancelled pairings until `pendingUntil` instead of deleting them. Raising Tunelo's per-IP limit for Localman's address (or keying it per client) is a Tunelo-side follow-up and outside this change.

## Low

### L1. `refresh=true` lets anyone fan out to Tunelo with no limit
`tunnel-list-service.ts:141-151`: with `refresh=true`, every call skips the cache. Each call makes 1 account call plus one call per linked machine (up to 20). There is no in-flight deduplication and no rate limit. One signed-in user can loop it and generate about 21 Tunelo requests plus a token exchange per Localman request. Tunelo's `GET /api/tunnels` has no limiter of its own. **Fix:** use `takeOperationSlot` on refresh only, or treat a refresh younger than a few seconds as a cache hit. Also share the in-flight `fetchAll` promise per `tenantKey(userSub)`.

### L2. A delete that races a poll's approval can leave a link token alive at Tunelo
`tunnel-link-service.ts:64-76` reads the row (`pending`) and then calls `deleteOne({ _id, userSub })` without a status filter. If `pollTunnelLink` sets the row to `linked` in between, the delete removes a linked row and never revokes its token. Tunelo keeps a valid read-only link token that Localman has forgotten; the machine owner sees it in `tunelo link` and can revoke it there. The client cleanup in `use-pairing.ts:75-79` (closing the modal while a poll is in flight) can trigger this. **Fix:** call `deleteOne({ _id, userSub, status: row.status })`. If nothing was deleted, read the row again and revoke when it is now `linked`.

### L3. `TUNELO_API_URL` is accepted in production and over plain http
`feature-env.ts` (TUNELO_API_URL) accepts any `http(s)` URL in every environment. If it is set in production, every tenant's account tokens (exchanged for audience `https://tunnel.<tenant domain>`) and every link token go to that one host, possibly unencrypted. The `.env.production.example` file says "dev only", but nothing enforces it. **Fix:** in `parseEnv`, reject `TUNELO_API_URL` when `NODE_ENV=production`, or require https there.

### L4. Dead links are never shown to the user
The server returns `failures` (`unauthorized` when the machine revoked the link), but `tunelo-accounts-api.ts:93-98` drops them. Settings keeps listing the machine as linked. Every list call (every 10 s while the user sends) hits Tunelo with the dead token and logs a warning. **Fix:** show `unauthorized` failures next to the machine in `tunnel-links-section.tsx` ("revoked on the machine, remove it"), or mark the row so it stops being polled.

### L5. Tunnel URLs are not checked again in the browser
The server checks every HTTP tunnel URL against the tenant's domains (`tunnel-list-service.ts:22-33` → `normalizeTunnelUrl`, which requires bare https on `TUNNEL_DOMAINS`). The web uses `LocalTunnel.url` as given (`auto-tunnel-hop.ts:90`). A server regression would send request credentials to any origin through the proxy. The proxy's own SSRF guard is unchanged, so internal hosts stay blocked. **Fix (defence in depth):** in `parseTunnel`, drop rows for which `tunnelOrigin(url, domains)` from `tunelo-commands.ts` returns null.

### L6. The pairing poll stops on the first transient error, and a code that expired with its row reads as "failed"
`use-pairing.ts:44-58`: any error (a 502 during a Tunelo blip, or a 404 once the TTL removed the row) ends polling and shows the raw error as `failed` instead of `expired`. The user can press "Get a new code", so this is UX only. **Fix:** retry 502/429 with backoff, and map a 404 on poll to `expired`.

## Disproven concerns (non-issues)

- **Tokens reaching the client, logs or errors:** none found. `TuneloApiError` carries only the call name and status (`tunelo-api.ts:44-51`). Views carry no token or `requestId` (`tunelo-view.ts`). Log calls pass `{call,status}`, `{status}`, `{linkId}` or `{source,linkId,status}`, and the `err` field holds only non-Tunelo errors (`TokenCipherError` and exchange errors carry no token). The test "never answers or logs a link token" covers this.
- **Associated data (AAD):** `linkTokenSlot(userSub, rowId)` is applied before the `findOneAndUpdate` that writes it to the same `_id`. `deleteTunnelLink` handles a decrypt failure (logs, then deletes the row). In `fetchAll`, a decrypt failure becomes an `unavailable` source.
- **Owner and tenant scoping:** every read and write of `TunnelLinkModel` filters by `userSub` (`ownLink`, list, delete, `findOneAndUpdate`); `learnDeviceName` runs only on the user's own rows. `tenantScopePlugin` is applied after both `schema.index` calls and before `mongoose.model` (`tunelo-link-model.ts:38-43`). The TTL index stays single-field (`tenant-indexes.ts:30-33`). Another user's id gets a 404 (test "polls and revokes the user's own pairings only"; E2E "another user sees none…").
- **10-second cache:** keyed by `tenantKey(userSub)` (`tunnel-list-cache.ts:24,31,35`), so lists are not shared across tenants or users.
- **SSRF on Tunelo calls:** the base is `tunnelResource()` (from operator-configured tenant domains) or the env override. `redirect: "error"` and a 5 s `AbortSignal.timeout` also cover reading the body. Responses are checked with zod and capped at 200 rows. The proxy's SSRF guard is untouched (no diff under `modules/api-client`).
- **Feature gate:** `servedOperations` removes all 5 operations while `TUNELO_ACCOUNTS_ENABLED` is off (test asserts 404). The web wires `autoTunnels`, `ChooseTunnelModal`, `TunnelLinksSection` and `AutoTunnelBadge` only under `tuneloAccounts`. The flag is not in `released-features`. Without it, the panel behaves as in T8a.
- **Brute-forcing pairing codes:** 32^8 ≈ 2^40 per code, 5 wrong attempts per approving token, at most about 20 live codes per 10 minutes. Not practical.
- **Concurrent polls for a token issued once:** the second poll gets `expired` from Tunelo, reads the row again, and answers `pending` while `pendingUntil` is in the future. A pairing cancelled during approval revokes the new token (`tunnel-pairing-service.ts:144-147`).
- **A remembered choice reused across accounts in one browser:** `decideAutoTunnel` uses a remembered URL only if it is in the current user's server list, so nothing is misrouted. The only effect is that another account can show a "stopped" notice.
- **A tunnel answering 404 or 502:** "stopped" is shown only when a fresh list (`refresh=true`) no longer has the tunnel. Otherwise the app's own 404 is shown (accepted deviation, tested).
- **Repo rules:** all 5 operations are declared with `defineOperation` and are `mcp: { exempt }`. User-facing strings go through `t()` in en, vi and zh-CN (`check:i18n` passes). Styling uses token classes only (`check:tokens` passes). Named exports only, no `any` and no `!`.

## Accepted deviations from the design (verified)

| Deviation | Assessment |
|---|---|
| Poll by row id `/client/tunnel-links/:id/poll` | Safer than accepting a `requestId` from the client: `requestId` never leaves the server |
| `refresh=true` on the list | Fine; it needs the rate limit in L1 |
| "Stopped" only when the tunnel is also gone from the list | Fine; avoids false alarms on the app's own 404 |
| At most 3 pending pairings per user | Not enough on its own (M2) |
| `tunelo_links` in `COLLECTIONS_NOT_MOVED` | Correct: link tokens are sealed with the source install's session keyring and the target cannot open them; users link again |

## Residual design risks (not defects)

- One HTTP tunnel from a linked anonymous machine is used without asking, and every header except secret variables goes through without a prompt. That includes `Authorization` and `Cookie`. Anyone who talks a user into reading out a pairing code gets that user's localhost traffic for the port. The "linked" confirmation (`tunelo-connect-modal.tsx:55-71`) does not show which machine approved, because the device name is learnt only later. Consider showing the approving machine's name (Tunelo's poll does not return it today).
- A released subdomain could be taken by someone else within the cache window (≤10 s on the server plus the web's 10 s `staleTime`). This is a shorter window than a manual mapping, which never expires.

## Recommended actions

1. M1: do not let `routeChosen` count as consent for tunnels found automatically, and add a test.
2. M2: add a per-user start rate limit with `takeOperationSlot`.
3. L1 and L2 next (refresh limit or in-flight deduplication; a delete guarded by status).
4. L3 to L6 can follow.

## Unresolved questions

- Does production run more than one API process (PM2 cluster)? If so, `cache.drop` on revoke reaches only one process, and the others may keep a revoked machine's tunnels for up to 10 s.
