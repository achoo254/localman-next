# Tunelo web console: phases 01 and 02 (implementation report)

Plan: `plans/dattqh/261012-0930-tunelo-web-console/`. Status: phases 01 and 02 are done. Phase 03 covers the IdP side and
phase 04 covers deploy; neither is part of this work. Nothing is staged or committed.

## What was built
The console is a server-rendered web console in `apps/tunelo-server/src/web/`. It is mounted in `server.ts` after `/api`
and `/login` and before the final relay. It only answers on the host of `TUNELO_WEB_PUBLIC_URL` and only for `/`, `/lang`,
`/auth/*` and `/assets/*`. Every other host and path (for example the old apex `tunnel.inetdev.io.vn`, or `/health`)
falls through to the relay unchanged.

- **OIDC RP** (`web-oidc-client.ts`, openid-client 6.8.8): uses the confidential client `tunelo-web` with
  `client_secret_basic` and Code + PKCE S256 + state + nonce. It requests the scope `openid profile` with
  `ui_locales`. It sends no `resource`, no `offline_access` and no `prompt=consent`. Discovery is lazy and is retried
  after a failure. The request timeout is 10 s.
- **Why that scope** (two follow-up decisions):
  - Jev 0.97: the console asks for no API scope. It reads tunnels in process by `sub`, so the opaque access token
    serves only the IdP's userinfo endpoint.
  - User decision on review item M2: `tunelo-web` refresh tokens are bound to the IdP session, like Localman web.
    Signing out at the IdP therefore ends the console session at the next refresh (within 15 minutes, through
    `invalid_grant`), even if the back-channel POST is lost. The IdP side of this change is the coordinator's.
- **Display name**: at the callback the console calls userinfo with the access token, checked against `sub`. It
  stores `preferred_username` and `name` (trimmed, at most 200 characters) in the session profile. The top bar shows
  the name, or the username when there is no name. If userinfo fails, sign-in still succeeds without a name and the
  failure is logged without data. Refreshes do not call userinfo again, and the profile is never logged.
- **Sign-in cookie** `__Host-tunelo_auth`: state, nonce and verifier are sealed with AES-256-GCM. It lives 5 minutes,
  is cleared at the callback, and a state that does not match leaves it in place.
- **Sessions** (`web_sessions`): `_id` is the SHA-256 of the cookie. The refresh token and the ID token are stored as
  AES-256-GCM blobs bound to `_id`. There is a TTL index on `expiresAt` and indexes on `sid` and `sub`.
  `expiresAt = min(loginAt + 90 d, refresh expiry)`, where the refresh expiry is `refresh_token_expires_in` when the
  IdP sends it and otherwise the IdP's 30-day idle window. The cookie `__Host-tunelo_session` is Secure, HttpOnly,
  SameSite=Lax, Path=/ and host-only.
- **Refresh**: it runs when the access token is within 60 s of expiry. Concurrent requests for one session share one
  in-memory promise, and the session is re-read under that lock. `invalid_grant` deletes the session and the user sees
  the signed-out home page. Any other failure (5xx, 429, timeout, network) keeps the session only until 1 hour after
  the access token expired; after that the session is deleted.
- **Logout** `POST /auth/logout`: it checks the CSRF token (an HMAC of the session id), deletes the session, revokes
  the refresh token (best effort), then redirects with 303 to `end_session_endpoint` with `id_token_hint` and
  `post_logout_redirect_uri=${public}/`.
- **Back-channel logout** `POST /auth/backchannel-logout`: the token is checked against `${issuer}/jwks` (ES256,
  `typ=logout+jwt`). It must have the right `iss`, `aud=tunelo-web`, an `iat` no older than 120 s, a `jti`, the
  back-channel event and a `sid`, and must not have a `nonce`. It deletes the sessions with that `sid` (and that
  `sub` when the token carries one). Answers: 200 when handled (also for an unknown sid), 400 for a bad token, 503
  when the JWKS cannot be reached.
- **Pages**: the signed-out home has a hero, the 3 steps and a sign-in button. The signed-in page lists the tunnels
  grouped by machine, from `listByOwner(sub)` in the same process. Each entry shows the URL (a link for HTTP),
  protocol, local port, Basic Auth and a relative "connected" time. The empty state explains that tunnels opened
  with CLI 1.6.x use an anonymous key and appear only after `tunelo login` with CLI 1.7.0. "Manage devices" links to
  `${issuer}/account`.
- **Languages**: en, zh-CN and vi. The choice comes from the `tunelo_lang` cookie (set via `/lang?set=`), then
  `Accept-Language`, then en. A missing or extra key is a typecheck error.
- **Headers**: the CSP is exactly the one specified, plus `nosniff` and `referrer-policy: no-referrer`. `/` and
  `/auth/*` send `no-store`.
- **No JavaScript**: there is no `<script>`, no inline style and no `on*` attribute (a test asserts this). All HTML
  goes through the auto-escaping `html` template.
- **CSS**: `static/css/tokens.css` is a byte-identical copy (a test checks this). `static/css/web.css` takes colours
  only from token variables (a test scans it for colour literals) and uses the system font stacks.
- **Web optional**: if `TUNELO_WEB_CLIENT_SECRET` or `WEB_SESSION_KEY` is missing or invalid, the server logs
  `Web console disabled {missing, invalid}` with variable names only. The console is not mounted and `/` returns the
  relay's 400 as today.

## Files
- **New**: `apps/tunelo-server/src/web/` contains html, web-config, token-cipher, web-session-model,
  web-session-store, web-oidc-client, auth-transaction, web-cookies, csrf, session-middleware, logout-token,
  auth-routes, backchannel-logout-route, web-context, web-console, page-routes, layout, getting-started, home-page,
  tunnels-page, oidc-errors, logout-route, sign-in-guards, and i18n/{locale,messages,en,vi,zh-cn}. Every `.ts` file is at most 196 lines.
- **New**: `apps/tunelo-server/static/css/tokens.css` and `web.css`.
- **New tests** in `src/web/__tests__/`: auth-flow, profile, session-refresh, backchannel-logout,
  web-session-store, token-cipher, web-config, pages, page-headers, sign-in-guards and web-console-disabled. The fake issuer also
  serves userinfo at `/me`. Helpers: fake-oidc-issuer,
  fake-oidc-support and web-harness.
- **Modified**:
  - `src/server.ts` (+15/-1)
  - `package.json` (adds `openid-client ^6.8.8`)
  - `pnpm-lock.yaml` (+3, through `pnpm add`)
  - `scripts/tunelo/build-server.ts` (copies `static/` into `dist/tunelo-server/static`)
  - `infra/tunelo/deploy.sh` (rsyncs `static/`)
  - `.env.example` (documents the 4 new variables)

## Verification
- `pnpm exec biome check apps/tunelo-server scripts/tunelo infra/tunelo`: `Checked 120 files in 34ms. No fixes applied.`
- `pnpm --filter @tunelo/server typecheck`: `tsc -b ../../packages/tunelo-shared && tsc --noEmit` ran with exit 0 and
  no output.
- `pnpm --filter @tunelo/server test`: `Test Files 25 passed (25)`, `Tests 205 passed (205)`. Of these, 76 tests in
  11 files are new.
- I checked that the refresh-lock test is meaningful: with the lock removed, "concurrent requests of one session
  share a single refresh" fails.
- `pnpm build:tunelo-server`: the bundle builds, `dist/tunelo-server/static/css/{tokens,web}.css` are copied, and
  `openid-client` is in the production `package.json`.
- Visual check with Playwright Chromium 1.64. Screenshots are under
  `/private/tmp/claude-501/-Users-hoandat-inet-gitlab-hoandat-auth/95852f29-2ffe-46e9-8bdf-4b551f1a5e1b/scratchpad/shots/`
  as `{home-en,tunnels-vi,empty-zh-CN}-{375,768,1440}-{light,dark}.png` (18 files). `scrollWidth - clientWidth = 0`
  on all 18, and there were no console or CSP errors.
- Not run: `pnpm check:tokens` (it scans `apps/web` only) and the repo-wide `pnpm lint` (other sessions are editing
  `apps/web`).

## Deviations
1. **No access token is stored.** The console reads tunnels in the same process, so refreshes only prove the grant is
   still alive. The ID token is stored encrypted instead, for `id_token_hint`. The plan's schema listed `accessToken`.
2. **The sign-in cookie is sealed with AES-GCM rather than HMAC-signed.** This is still tamper-proof, and it also
   hides the verifier.
3. **The "e2e sign-in with a fake IdP" is a full HTTP round trip, not Playwright.** It runs login, then the fake
   authorization endpoint, then the callback, the tunnel list and logout, all over real sockets
   (`auth-flow.test.ts`). The fake issuer is hand-written (discovery, JWKS, authorization, token, revocation,
   end-session), so there is no new dev dependency such as `oidc-provider`.
4. **`web.css` is 445 lines**, over the 200-line guide. That guide is for code, and the IdP's `app.css` is 548 lines.
   I kept it as a single file because the spec names it.
5. **`cache-control: no-store` covers `/` in both states**, because the same URL serves both.

## Fixes applied after the security review
These follow `code-reviewer-261012-0958-tunelo-web-console.md`.
- **H1, the console can never stop the server.**
  - `web-config.ts` parses `TUNELO_WEB_PUBLIC_URL` with `new URL` inside try/catch (no `URL.parse`).
  - `server.ts` calls `mountWebConsole`, which wraps all console setup in try/catch. An error is logged with
    `describeError` (no values) and leaves the console off; the API, relay, `/login` and WebSockets start normally.
  - Tests use the real public `Host` and run three malformed URLs, an env whose reads throw, and a valid config. In
    each failing case `/api`, `/login` and the relay keep answering as before.
- **M1, sign-ins are single-use and rate-limited.**
  - `PendingSignIns` (`sign-in-guards.ts`) records each `state` at `/auth/login` with its 5-minute expiry. The map is
    capped at 10,000 entries: expired entries are swept first, then the oldest are dropped.
  - `/auth/callback` consumes the state after the cookie and state checks and before any IdP call. An unknown or
    reused state goes to `/?error=login_expired` without contacting the IdP. A forged state does not consume the real
    sign-in.
  - `/auth/login` and `/auth/callback` each allow 20 calls per minute per `req.ip` (in memory, reusing
    `lib/attempt-limiter.ts`). Beyond that they answer 429 with `retry-after: 60`.
  - Tests: a callback replayed 3 times makes no token-endpoint call; a limit of 3 per minute gives 429 on the 4th
    call to each route without reaching the IdP; the map's bound and expiry are tested directly.
- **L2, a bounded grace for transient refresh failures.** Any refresh failure other than `invalid_grant` keeps the
  session only while its access token expired less than 1 hour ago; beyond that the session is deleted. Tested with
  an IdP answering 503, at 30 minutes past expiry and at 2 hours past expiry.
- **L4, missing `sid`.** If the ID token has no `sid`, the session is still created and a warning is logged with no
  token data. This is tested.
- **M2**: decided by the user and applied as described above (scope `openid profile`, refresh bound to the IdP
  session).
- **Other low items** (1, 3, 5 to 9) are unchanged, as instructed.
- **New split for the 200-line limit:** `logout-route.ts` now holds `POST /auth/logout`.

## Open questions
None. The display name now comes from userinfo, decided by the coordinator (Jev 0.97). The session expiry rule (30
days since the last refresh, capped at 90 days from sign-in) matches the IdP's `src/oidc/sliding-grants.ts`, and
the coordinator confirmed it.
