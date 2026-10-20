# Red-team: Localman Mobile chat-app plan (261020-0742)

Scope: plan.md + phase-01..07, verified against HEAD (working tree has no code changes, only untracked plans).
Lenses: security, failure modes, scope, assumptions. Read-only; no plan or code edited.

## High

**H1. PKCE does not stop a malicious app that starts the flow itself (phase-01 Risk Assessment is wrong).**
Evidence: the handoff binds the code to whoever sent `code_challenge`, so an attacker app that opens `/auth/login?client=mobile&code_challenge=<its own>` holds the matching verifier. The IdP is same-site and SSO'd in the system browser (`infra/localman/.env.production.example:25,32`), so the flow can finish with no user interaction. On Android any app can register the `localman://` scheme. On iOS `ASWebAuthenticationSession` delivers the callback to whichever app started it. The stolen session counts as a browser session (`http/require-auth.ts:85-87`, `isAgentCall` false), so it can read secret values in plaintext and send through the proxy.
Plan edit (phase 1):
- Rewrite the risk line so it says PKCE only stops interception of *another* app's code.
- For `client=mobile`, refuse `prompt=none`.
- Before redirecting to `localman://`, show a server-rendered confirmation page ("Continue to the Localman app as <user>?") with a button. This forces a user gesture.
- Recommended: use a claimed HTTPS redirect (Android App Links plus iOS Universal Links on `https://<tenant>/auth/mobile/return`) in v1. At minimum the ADR must record the risk as accepted, with this reasoning.

**H2. The handoff cannot return the token: the server never stores it.**
Evidence: `session-store.ts:64-75` creates `cookieValue` and stores only `hashSessionToken(cookieValue)`. Phase-01 step 2 model is `{ codeHash, sessionId, codeChallenge, expiresAt }`, which is a hash, so step 3 ("returns the cookie value") is impossible.
Plan edit: create the session at redemption, not at callback. The handoff stores `{ codeHash, codeChallenge, sub, sid, sealedTokens (tokenCipher, AAD=codeHash), accessTokenExpiresAt, appState }`. `POST /auth/mobile/token` then calls `sessions.create()` and returns that `cookieValue`. This also avoids orphan 30-day sessions (with live refresh tokens) for abandoned or failed handoffs.

**H3. The CSRF guard will reject `POST /auth/mobile/token`.**
Evidence: the guard runs before every route (`dashboard-server.ts:122-128`). It passes only safe methods, `exempt`, an allowed Origin, or `Sec-Fetch-Site: same-origin` (`csrf-guard.ts:28-44`). The token request carries no Bearer (so the planned `isBearerOnly` does not apply) and no Origin (native fetch).
Plan edit (phase-01 step 7): add `POST /auth/mobile/token` to `csrfExempt` in `auth-module.ts:135-138`. This is acceptable because it is authenticated by code plus PKCE, sets no cookie and reads no cookie. Add a test for it.

**H4. Phase 5's central assumption is false: the proxy does not fill in variables, redact or record history.**
Evidence:
- `client.sendRequest` (`proxy-operations.ts:73-130`) forwards the input URL and headers as-is. It never calls `recordHistory`.
- The web does all three on the client: `{{var}}` resolution in `apps/web/src/features/api-client/workbench/send-variables.ts` and `prepareSend` in `send-steps.ts`; history in `record-send.ts`, which calls `recordHistoryEntry(redactDraft(draft), …)`.
- History keeps only status, ms, size, route and finalUrl, with no response body (`history-operations.ts:51`).

Plan edit (phase 5):
- Replace the Key Insight with: the app resolves variables using `@localman/shared/api-client` (`prepareRequest`, `interpolationScope`, `withheldNames`), calls `client.recordHistory` with `redactDraft` after each send, and loads environments/globals itself. Environment secrets therefore reach the phone's memory, so add that to Security Considerations.
- Reopened conversations can show only status/size/time bubbles. Bodies exist only for the current session. Update the prototype and Success Criteria to match.
- "Resend" from history uses a redacted draft (literal credentials blanked), so it may fail. Document this or resend from the in-memory draft.

## Medium

**M1. Mobile sign-in signs the user out of the web in the same browser.**
Evidence: `auth-routes.ts:149-154` destroys the session behind the `__Host-lm_session` cookie on every callback. `auth.hoandat.com` and `localman.hoandat.com` are same-site, so the Strict cookie is sent on the IdP to callback redirect. Line 166 also sets `ssoHint`.
Plan edit (phase-01 step 4): the mobile branch must not destroy the previous web session and must not set `ssoHint`. Add a test: web cookie present plus `client=mobile` leaves the web session intact.

**M2. Failure paths and app `state` are not designed.**
Evidence:
- Every failure redirects to `/?authError=` in the browser (`auth-redirects.ts:13-29`; rate-limit handler at :43-45). The auth tab never returns to the app.
- `/auth/login` already uses `state` for the OIDC state (`login-transaction.ts:50`), and the plan stores only `client` and `codeChallenge`. The app's state therefore has no field to live in.

Plan edit:
- Add an `appState` field (query `app_state`) to the transaction.
- For mobile, every failure redirects to `localman://auth/callback?error=<code>&state=<appState>`.
- The S256 `code_challenge` is exactly 43 base64url characters; 43-128 is the verifier length. Validate `code_verifier` against 43-128.

**M3. Rate limits and route registration.**
Evidence: the `loginRateLimit` handler returns a 303 redirect (`auth-redirects.ts:36-46`), which is wrong for a JSON endpoint. `protocol-routes.test.ts` checks that `PROTOCOL_ROUTES` (`operations/protocol-routes.ts`) matches the mounted routes.
Plan edit:
- Use `ipRateLimit` (JSON 429, `http/ip-rate-limit.ts`) for `/auth/mobile/token` and `/auth/mobile/logout`. Apply `noStore` to the token response.
- Add both paths to `AUTH_PATHS` and `PROTOCOL_ROUTES` with an `mcpExempt` reason. List `protocol-routes.ts` in Related Code Files.

**M4. Redemption must be atomic.**
Plan edit (phase-01 step 5): use a single `findOneAndDelete({ codeHash, expiresAt: { $gt: now } })` (pattern at `login-transaction.ts:80-84`), then verify PKCE. A wrong verifier burns the code. Add a parallel-redeem test where only one call returns 200.

**M5. SSE stream cap and stale streams on mobile.**
Evidence:
- `MAX_STREAMS_PER_USER = 5` (`log-stream-routes.ts:21`), and exceeding it returns `429 TOO_MANY_STREAMS` (:80-90).
- Half-open mobile sockets keep their slot until heartbeat writes fail.
- The heartbeat re-checks project access, not the session (:109-122), so logout leaves streams open.

Plan edit (phase 4):
- Close the stream on background and on logout.
- Treat 429 as "back off, then poll with cursor".
- Web tabs plus phone share the 5-stream cap; note this in the risk section.

**M6. Moving i18n to a package is a large web refactor during the acceptance freeze.**
Evidence: 189 dictionary files; all use extensionless relative imports (`../../message-types`). A package under the NodeNext `tsconfig.base.json` needs `.js` suffixes or its own Bundler tsconfig. `check-i18n.ts:27-29` hard-codes `apps/web/src`.
Plan edit (phase 2):
- State the package's module resolution (Bundler, consumed only by web and mobile) or the suffix rewrite.
- Keep the web on lazy per-locale chunks (`load-messages.ts:9-12`).
- Move the competitor-name and Vietnamese checks to the new path.
- Mark this as touching web, so it needs approval under the post-2026-10-19 "no new scope" rule.

**M7. The mobile Bearer session has full browser privileges.**
Evidence: `sessionIdOf` returns the session id, so `isAgentCall` is false. Plaintext secrets, `requireSession` ops (`tunelo-operations.ts:42`, `push-operations.ts:87`) and the proxy's tunnel routing (`proxy-operations.ts:103`) all work for it.
Plan edit: the ADR must state this explicitly. That raises the impact of H1 and of a lost or stolen phone.

## Low

- **L1.** Phase 4's `pathPrefix` filter is unnecessary. `traffic.listRequestLogs` already filters `source=inbox` plus `path` substring (`request-log-operations.ts:24-25`), and the web uses exactly that (`apps/web/src/features/webhook-inbox/inbox-urls.ts:14`). Drop the API change.
- **L2.** N+1 project preview. Projects already store `lastRequestAt` and `mockRequests` (`project-model.ts:32-33`), but `projectView` does not expose them (`project-view.ts:11-35`). Option: add both as optional output fields (one gated API change) and sort the chat list by recency. Fetch the `limit=1` preview only for visible rows. `lastRequestAt` lags because activity is flushed in batches (`project-activity.ts`).
- **L3.** No operation exposes `requestLogDays` (it appears only in `request-log-entry.ts` and `request-log-model.ts`). Retention also follows the owner's plan, not the viewer's. Show a generic "older entries expired" row, or add a field (scope).
- **L4.** Wrong refs:
  - `tenant-models.test.ts` is at `apps/api/src/tenancy/`, not `modules/tenancy/`.
  - The openapi route is at `dashboard-server.ts:132`, not 109-113.
  - The ADR number is 0005 (the last one is 0004).
- **L5.** Backchannel coupling. The mobile session shares the system browser's IdP `sid`, so web logout at the IdP ends the app session (`backchannel-logout-route.ts:97-98`). Also, `/auth/mobile/logout` does not end the IdP session, so the next sign-in is silent. Decide ephemeral vs shared browser session in the ADR.
- **L6.** CORS: the dashboard sets no ACAO except the MCP metadata (`mcp-resource-metadata.ts:54-57`, GET/OPTIONS), so the Bearer-only exemption is sound today. Add a regression test that a preflight to `/api/v1/*` gets no `Access-Control-Allow-*`. The app's fetch should use `credentials: "omit"` so a stray cookie never flips it back to the Origin check.
- **L7.** Phase 1's "regex 43 like findByCookie": also reject a non-`Bearer` scheme without falling back to the cookie, and add a test for it.
- **L8.** Phase 7: if the IdP allows sign-up from the app (`prompt=create`, `auth-routes.ts:39-41`), App Store guideline 5.1.1(v) requires in-app account deletion before any non-internal release. Note it as a follow-up.

## Failure-mode checks (no finding / already covered)

- **Metro `.js` to `.ts`:** the plan already gates on an `expo export` smoke test. Also enable package `exports` resolution: `@localman/shared` exposes subpaths only through `exports`. Import only subpaths; `.` pulls in `faker` and `quickjs`.
- **React duplication:** pnpm isolated gives each app its own React, and no `@localman/*` package depends on React. The risk is limited to `@types/react` skew in the root `pnpm -r typecheck` (`package.json:15`).
- **Root vitest:** projects glob `apps/*/vitest.config.ts` (`vitest.config.ts:7`), so mobile without that file is skipped. The claim holds.
- **SSE auth:** the stream calls `resolveAuth` (`log-stream-routes.ts:64`), so Bearer works once `authenticate` reads it. The claim holds.
- **Tenant binding:** `Session`, `LoginTransaction` and the new handoff are tenant-scoped (`session-model.ts:25`, `login-transaction.ts:28`). A cross-tenant Bearer resolves to null. Sound.
- **Logging:** the logger redacts `authorization` and `cookie` (`logger.ts:18-20`), and the request log omits query strings (`request-log.ts:78`). The handoff code in the redirect does not reach logs.
- **Login CSRF / fixation:** an attacker-crafted `localman://…?code=` fails because the victim's verifier never matches the attacker's challenge, as long as the app also checks `appState` (needs M2).

## Scope

- **In scope:** native Expo app, chat-list navigation, conversation-style client, log/inbox timelines.
- **Additions beyond the request:**
  - Notifications tab: S tier, reuses ops; acceptable, but call it out.
  - i18n package move (M6).
  - EAS/store pipeline with paid accounts: an external decision, already flagged as an open question.
  - "Sign in with a code on the computer" button in the prototype, with no backend: remove it from the prototype.
- **Missing:** an approval line saying phases 1, 4 and 5 change the production auth surface while the product is in acceptance (the plan says it starts only after approval; keep that).

Status: DONE_WITH_CONCERNS
Summary: The handoff design has three blocking defects. The token is unrecoverable from a hash-only store, the CSRF guard rejects the token endpoint, and the risk analysis misses malicious-initiator code theft via custom scheme plus silent SSO. Phase 5 is built on a false claim that the proxy fills in variables and records history.
