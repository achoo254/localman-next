# Code review: Tunelo web console (pre-production)

Date: 2026-10-12 10:05 (Asia/Saigon). Read-only review; no source file changed.

## Scope
- Files: `apps/tunelo-server/src/web/**` (21 source files + 13 test/support files), `apps/tunelo-server/src/server.ts`,
  `apps/tunelo-server/static/css/{tokens,web}.css`, `scripts/tunelo/build-server.ts`, `infra/tunelo/deploy.sh`,
  `apps/tunelo-server/package.json` (+ `.env.example`, `infra/tunelo/nginx.conf`, `ecosystem.config.cjs` read for context).
- LOC: about 4.4k new (about 1.8k source, 1.6k tests, 0.7k CSS), server.ts +13.
- Spec: `plans/dattqh/261012-0930-tunelo-web-console/{plan,phase-01,phase-02}.md` (scope `openid profile offline_access`, no resource).
- Cross-checked on the IdP side (`hoandat-auth`): `src/oidc/clients.ts` (tunelo-web registration), `src/oidc/provider.ts`
  (TTLs, refresh rotation, `issueRefreshToken`), `src/http/security.ts` (rate limits), `src/__tests__/tunelo-web-flow.test.ts`.

## Evidence run
- `pnpm --filter @tunelo/server exec vitest run src/web`: 10 files, 64 tests, 64 passed, 0 failed (2.93 s).
- `pnpm --filter @tunelo/server typecheck`: exit 0, no errors.
- `biome check` on the scoped files: 41 files, 0 diagnostics.
- Full suite, e2e and root lint not run: out of the requested scope, and the machine is shared.

## Overall assessment
Solid, carefully bounded implementation. I found no critical defect. These work as specified:
- The OIDC transaction (state, nonce and PKCE live in a sealed `__Host-` cookie, and openid-client checks `iss`).
- Session fixation: a new random id at every sign-in, and the previous session is deleted.
- Cookies: `__Host-`, HttpOnly, Lax, no Domain.
- CSRF: an HMAC of the session id under an HKDF sub-key.
- Back-channel logout claim checks: alg ES256, `typ` logout+jwt, `iss`, `aud`, `iat` within 120 s, `jti`, `events`, no
  `nonce`, `sid`, and `sub` matched when present.
- The per-session refresh single-flight.
- HTML escaping and CSP.
- Host routing.

The findings below cover availability under abuse, deploy-time robustness and the logout guarantees. No finding is a
direct account-takeover or data-leak path.

## Critical issues
None.

## High priority

### H1. On a VPS Node older than 20.18, the server crashes at start, even when the console is not configured (conditional)
- `src/web/web-config.ts:35` calls `URL.parse` (Node 22.1, back-ported to the 20.x line only late). It is the only use in
  the server. The bundle targets `node20` (`scripts/tunelo/build-server.ts`), and `docs/tunelo/deployment-guide.md:65`
  says "Node.js 20+".
- `isAllowedOrigin` runs inside a zod `refine` for `TUNELO_WEB_PUBLIC_URL` on every start. The default
  `https://<primary domain>` is always present, so the refine runs even when the secret and key are missing. Zod does not
  catch a throwing refine, so `loadWebConfig` throws.
- `server.ts:72-80` does not guard `webConsoleFromEnv`. `start()` rejects, then `process.exit(1)`: every tunnel, `/api`
  and WebSocket goes down.
- This breaks the plan's rollback promise ("bỏ biến `TUNELO_WEB_*` ⟹ server như cũ").
- Fix:
  - Run `ssh $VPS_HOST node -v` before deploy.
  - Replace `URL.parse` with `try { new URL(value) } catch { return false }`, or `URL.canParse` (Node 19.9+).
  - Wrap `webConsoleFromEnv(...)` in server.ts in try/catch that logs `describeError` and continues without the console,
    so an optional feature can never be fatal.

## Medium priority

### M1. Anyone can replay the callback and use up Tunelo's IdP token-endpoint budget, which blocks console sign-in for everyone
- `auth-transaction.ts:41-58`: the sign-in transaction is stateless and valid for 5 minutes. `auth-routes.ts:70` only
  asks the browser to clear the cookie. Nothing on the server consumes it.
- How it fails:
  1. The attacker runs `GET /auth/login` once, then keeps the sealed `__Host-tunelo_auth` value and the `state` from the
     `Location` header.
  2. The attacker loops `GET /auth/callback?code=x&state=<state>` with that cookie for 5 minutes, then repeats.
  3. Every request makes Tunelo call `POST https://auth.hoandat.com/token` (`web-oidc-client.ts:145`).
  4. The IdP limits `/token` to 60 per minute per IP (`hoandat-auth/src/http/security.ts:26`). All console traffic comes
     from the one Tunelo VPS IP, so after 60 requests the IdP answers 429 to Tunelo.
- Effects while the attack lasts:
  - Every real sign-in ends on `login_failed`.
  - Every refresh fails as non-`invalid_grant`, so `session-middleware.ts:72-78` keeps stale sessions. Grant revocation
    at `/account` is not noticed.
- Each attack request costs one cheap unauthenticated GET.
- Fix (any one, the first preferred):
  - (a) Make the transaction single-use on the server. Single pm2 instance, so a bounded in-memory map works: at
    `/auth/login`, store `state → exp` (capped size, swept on expiry). At the callback, delete it before calling the
    token endpoint. A Mongo TTL collection with `findOneAndDelete` would also work.
  - (b) Rate-limit `/auth/callback` per client IP (express-rate-limit, trust proxy loopback is already set).
  - (c) On the IdP, key the `/token` limiter by authenticated confidential client rather than by IP for first-party
    clients.

### M2. Signing out at the IdP does not reliably end console sessions (acceptance 5)
- `tunelo-web` holds `offline_access`. `refreshesWithSession` excludes it (`hoandat-auth/src/oidc/clients.ts:50-54`), so
  its grant and refresh tokens outlive the IdP session. The console session dies at an IdP logout only through the
  back-channel POST.
- Gap 1:
  - oidc-provider sends that POST once and never retries.
  - If Tunelo is restarting (deploy.sh runs `pm2 delete` then `start`), the JWKS fetch fails (`backchannel-logout-route.ts:56-61`
    answers 503), or the network blips, the session goes on refreshing for up to 90 days.
- Gap 2:
  - The IdP session TTL is 30 days (`provider.ts` `TTL_SECONDS.Session`). The console session can last 90 days and keeps
    the `sid` of the original IdP session.
  - After that IdP session expires (no logout token is sent on expiry), a later "sign out" at the IdP comes from a new
    `sid` that has no `tunelo-web` authorization. Nothing reaches Tunelo, and the console stays signed in.
- This is a product trade-off, not a code bug. The user chose "phiên lưu MongoDB kèm refresh token mã hoá, trần 90 ngày"
  (Jev 0.53). So I do not recommend reversing it silently. Options:
  - (a) Accept it and document that IdP logout is best-effort for the console.
  - (b) Bind tunelo-web refreshes to the IdP session, as Localman web does (Jev 0.94). An IdP logout then kills the
    console within 15 minutes through `invalid_grant`. The cost: console sessions are capped by the 30-day IdP session.
  - (c) Keep offline_access and also check grant liveness through introspection of the refresh token on every refresh
    failure. This does not close Gap 2.
- My lean is (b): it matches the precedent set for Localman web and makes acceptance 5 hold without depending on one
  POST.

## Low priority

1. **Sessions are deleted without revoking their offline grant** (`backchannel-logout-route.ts:63`,
   `auth-routes.ts:108-112` re-sign-in, `web-session-store.ts:147-156` undecryptable rows, TTL expiry). Each one leaves a
   live 30-day sliding offline grant at the IdP whose refresh token nobody holds. That clutters `/account` and is a latent
   credential. Fix: revoke best-effort (`oidc.revoke`) before deleting on the re-sign-in path and the back-channel path.
   Use `findOneAndDelete` / find, then delete, to get the token.
2. **A failed refresh keeps the session open with no upper bound** (`session-middleware.ts:72-78`). After a 5xx, 429,
   timeout or `invalid_client`, the stale session is returned and retried on every page view until `expiresAt` (up to
   30 days). A grant revoked at `/account` while the IdP is unreachable (or rate-limited, see M1) stays visible. Suggest a
   grace bound, for example fail closed when `accessExp` is more than 1 hour in the past.
3. **No `jti` replay cache for logout tokens** (`logout-token.ts:58-66`). The spec says a client SHOULD reject a
   replayed `jti`. The impact is negligible: a replay within the 120 s window only deletes sessions of an already-dead
   `sid`. Optional fix: an in-memory set of `jti` until `iat + 150 s`.
4. **An ID token without `sid` makes the session immune to back-channel logout, silently** (`web-oidc-client.ts:69`,
   `auth-routes.ts:113-116` store `sid: null`). The IdP test pins `sid` today. Log a warning, or refuse the sign-in, when
   `sid` is missing, because the client registers `backchannel_logout_session_required: true`.
5. **A second sign-in tab overwrites `__Host-tunelo_auth`** (`auth-routes.ts:56`), so the first tab's callback ends on
   `login_expired`. UX only. Fix: key the cookie name by a short state prefix, or keep up to 2 transactions in the sealed
   value.
6. **A lost refresh response signs the user out.** If the IdP rotates the token but the 10 s timeout fires on the way
   back (`web-oidc-client.ts:166`), the stored token is the consumed one. The next refresh replays it, oidc-provider
   revokes the grant, and the session ends (`invalid_grant`). This fails safe; documented here for on-call.
7. **`FALLBACK_ACCESS_TTL_SECONDS = 60` (`web-oidc-client.ts:15`) equals `REFRESH_MARGIN_MS` (`session-middleware.ts:9`).**
   If `expires_in` were ever missing, every page view would refresh. oidc-provider always sends it, so this is
   theoretical. Use a fallback larger than the margin (for example 300 s).
8. **Test gap: the real `server.ts` wiring is not exercised.** `web-harness.ts:85-99` rebuilds "console, then relay" and
   leaves out the subdomain-first relay and the `/api` and `/login` precedence. I verified the ordering by reading
   server.ts:58-83, but nothing would catch a future reorder. Suggest extracting the app construction from `start()` into
   a testable `createApp(...)` and adding:
   - `Host: x.tunnel.hoandat.com` `GET /auth/login` → relay;
   - `Host: mail.tunnel.inetdev.io.vn` → relay;
   - `GET /api/...` and `/login` on the apex unchanged with the console on.
9. **Test gap: no cross-repo proof that a real oidc-provider logout token passes `verifyLogoutToken`.** The IdP test
   only records that delivery was attempted; the Tunelo tests sign with a fake signer that sets `typ: logout+jwt`. Run it
   once against staging during phase 04, or capture the token in the IdP test and run the same jose checks.

## Informational (no action needed for this change)
- `tunelo_lang` (`web-cookies.ts:44`) is not `__Host-`, so a tunnel page can toss it with `Domain=hoandat.com`. The
  value is validated by `isLocale`; the only effect is the page language.
- Architecture: `*.tunnel.hoandat.com` is the same registrable domain as `auth.hoandat.com` and `localman.hoandat.com`.
  A tunnel page can set `Domain=hoandat.com` cookies, including oversized ones (a cookie bomb). That can push a victim's
  requests to the console, the IdP and Localman past nginx header limits (4xx) until the cookies expire. The `__Host-`
  design stops fixation and tossing of the console's own cookies but not this. The structural fix is a separate
  registrable domain for tunnel content, or a Public Suffix List entry for `tunnel.hoandat.com`.
- The `sub` index on `web_sessions` (`web-session-model.ts:13`) is not used by any query. `deleteBySid` filters on `sid`
  (plus `sub`), which the `sid` index serves. Harmless.
- CSP has no `base-uri` or `form-action`. No injection point exists, and `form-action 'self'` would break the logout
  redirect to the IdP in Chrome, so leaving it out is correct.

## Checked and found correct
- **OIDC binding.**
  - state, nonce and the PKCE verifier are random (openid-client) and sealed with AES-256-GCM, with AAD `tunelo_auth`
    and a 5-minute `exp` inside the ciphertext.
  - A state mismatch does not clear the real transaction.
  - openid-client validates `iss`, state, nonce, `aud`/`azp`, the ID token alg ES256 and the userinfo `sub`.
  - `redirect_uri` comes from the public URL, not the Host header.
  - IdP cancellation maps to `access_denied`.
- **Open redirect:** none. Every redirect target is a constant (`/`, `/?error=<enum>`) or comes from discovery metadata
  (authorization and end-session endpoints).
- **Session fixation:** a new 256-bit cookie value at every callback, the previous session is deleted, and only the
  SHA-256 is stored as `_id`.
- **Cookies:** `__Host-` over https, HttpOnly, Secure, SameSite=Lax, Path=/, no Domain (tests assert this). Session
  cookie lifetime 90 days; the server side is authoritative (`expiresAt > now` is checked before the TTL sweep).
- **CSRF:** logout needs an HMAC token bound to the session, compared with `timingSafeEqual`. Back-channel logout is
  authenticated by the signed token. Bodies are parsed only inside the route, with 4 kb and 16 kb limits (413 is
  handled).
- **Refresh:**
  - One promise per session, and the session is re-read under the lock.
  - `invalid_grant` deletes the session.
  - `saveRefreshed` has no upsert, so a session deleted meanwhile is not brought back.
  - pm2 runs `instances: 1`, `exec_mode: fork`, so the in-memory lock is enough.
- **Secrets at rest:** the refresh and ID tokens are sealed with AAD bound to the row id; a copied blob fails and the
  row is dropped. HKDF sub-keys separate the cipher key from the CSRF key.
- **Logs:**
  - Only `sessionId` (a hash), counts and `describeError` fields (name, message, code, OAuth error code) are logged.
    No body, token, code, cookie or profile appears; tests assert this.
  - The disabled-config log names variables only.
- **HTML:** an auto-escaping `html` template. Tunnel `deviceName` (client-reported), the profile name or username, and
  URLs are all escaped. There is no script and no inline style. `nosniff`, `no-referrer`, `frame-ancestors 'none'`, and
  `no-store` are set on `/` and `/auth/*`.
- **Host routing (server.ts):**
  - Tenant single-label subdomains on both domains (including `mail.tunnel.inetdev.io.vn` → tunnel `mail`) are relayed
    before any apex route, as before.
  - The console requires `Host` to equal the public host exactly; nginx sends `$host`, which is lowercase with no port.
  - The old apex `tunnel.inetdev.io.vn`, unknown hosts and other paths fall through unchanged. `/health`, `/api`, `/login`
    and WebSocket upgrades (`attachWsHandler` on the http server) are untouched.
  - The console only takes `/`, `/lang`, `/auth/*` and `/assets/*`, which previously answered 400.
- **Missing web env:** the console is off, and only the names of missing or invalid variables are logged (subject to H1
  on old Node).
- **Mongo:** the `expiresAt` TTL index (`expireAfterSeconds: 0`) and the `sid` and `sub` indexes are created by mongoose
  autoIndex after `keyStore.initialize()` connects. No query is unbounded.
- **Tunnel isolation:** `listByOwner(session.sub)` runs in process, and the `sub` comes only from the verified ID token.
  Tests cover another account's tunnels and anonymous tunnels.
- **Build and deploy:**
  - `openid-client` is in `dependencies`, so it is external in the bundle and installed on the VPS.
  - `static/` is copied next to `server.mjs` and rsynced with `--delete`.
  - `findStaticDir` resolves both the bundle and `src` layouts.

## Recommended actions (in order)
1. H1: check the VPS `node -v`, replace `URL.parse`, and make `webConsoleFromEnv` non-fatal in server.ts.
2. M1: make the callback transaction single-use on the server (or rate-limit `/auth/callback`).
3. M2: decide on IdP-logout semantics for tunelo-web (my lean is (b), session-bound refresh). This is a user decision.
4. Low 1-2: revoke the grant when a session is deleted server-side, and bound the fail-open refresh grace.
5. Low 8-9: test the server.ts wiring, and run the phase 04 staging check of a real logout token.

## Metrics
- Type coverage: strict TS, typecheck clean. No `any` and no non-null `!` in the scope; one `as` cast in
  `clientErrorStatus`, guarded.
- Tests: 64 of 64 web tests pass. They cover callback, cookies, CSRF, refresh lock, `invalid_grant`, back-channel claim
  rejection, `sub` isolation, the 3 locales, CSP and log safety. Gaps: Low 8-9, callback replay (M1), fail-open refresh
  (Low 2).
- Linting issues: 0 (biome, scoped).

## Plan follow-ups (for the lead; plan files not edited)
- Phase 01 and 02 checklists match the code, with these exceptions:
  - Acceptance 5 (IdP logout ends the Tunelo session) holds only in the best case (M2).
  - The rollback claim in phase 01 depends on H1.
- Phase 04 should add: the VPS Node version check, the new `.env` variables, a manual back-channel logout check against
  the real IdP, and a check that `GET /` on `tunnel.inetdev.io.vn` still answers 400.

## Unresolved questions
1. Which Node version runs on 103.72.98.65 (pm2 `tunelo`)? It decides whether H1 is live.
2. M2: should IdP sign-out end console sessions within 15 minutes (session-bound refresh, sessions capped at the 30-day
   IdP session), or is best-effort back-channel logout with 90-day offline sessions acceptable?
