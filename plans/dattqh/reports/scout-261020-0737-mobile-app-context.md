# Scout: context for a native Expo app (apps/mobile)

Read-only scout. Paths are relative to `/Users/hoandat/inet-gitlab/localman-next`.

## Outcome

The dashboard REST API (`/api/v1`) accepts only the `lm_session` browser cookie. A native client has no supported way to authenticate today, so the auth decision below must come before any mobile API work. Everything else needed for the list, detail, request log and inbox screens already exists as `defineOperation` REST routes plus two SSE/poll-friendly endpoints.

## 1. Auth

- Web sign-in is OIDC Authorization Code + PKCE against the shared IdP `auth.hoandat.com` (external repo `hoandat-auth`). Localman is the confidential client `localman-web` (`docs/system-architecture.md:41`, `:43`). The login transaction uses a cookie handle `lm_login`, and the session is `__Host-lm_session`, HttpOnly, SameSite=Strict (`docs/system-architecture.md:45`; `apps/api/src/modules/auth/auth-cookies.ts:9-19`, `:36-40`).
- The dashboard authenticator reads only that cookie: `apps/api/src/modules/auth/auth-module.ts:151-154` (`readCookie` then `sessions.findByCookie`). `createSessionAuthResolver` maps the session to scope `user` (`apps/api/src/http/require-auth.ts:14`, `:32-44`). No Bearer path is wired into `resolveAuth` (`apps/api/src/dashboard-server.ts:114-117`).
- Bearer tokens exist only for the Localman MCP endpoint `/mcp`. Those are ES256 JWTs verified against the IdP JWKS, and `aud` must contain `{PUBLIC_URL}/mcp` (`docs/system-architecture.md:285-287`; `apps/api/src/modules/mcp/mcp-resource-metadata.ts:114`, `:144-167`). A REST-scoped token would fail that audience check. The mock-runtime `lmmcp_` tokens (`apps/api/src/modules/mcp/mcp-token-model.ts:9`) guard only the public mock `/mcp`.
- Mutations pass a CSRF guard that requires an allowed `Origin` (PUBLIC_URL or WEB_ORIGIN) or `Sec-Fetch-Site: same-origin`, otherwise 403 `CSRF_REJECTED` (`apps/api/src/http/csrf-guard.ts:27-44`; wired at `apps/api/src/dashboard-server.ts:124-127`). A native fetch sends neither header by default. This applies to any Bearer design too unless the guard is changed or exempted.
- There is no CORS middleware in `apps/api/src/main.ts`, `dashboard-server.ts` or `http/create-base-app.ts`. CORS exists only on the mock runtime (`docs/system-architecture.md:245`). Native clients are not subject to CORS, so this is not a blocker.
- Existing token flows that a mobile client could reuse:
  - Device Authorization Grant (RFC 8628) is already enabled at the IdP. The `tunelo-cli` public client uses it with `refresh_token` (`plans/dattqh/261008-1325-central-auth-idp/phase-01-idp-core.md:34`; `plans/dattqh/261008-1325-central-auth-idp/phase-03-integrations.md:24`). The CLI code is `packages/tunelo-cli/src/device-login.ts:1-14`.
  - Token exchange (RFC 8693) exists only for `localman-web` to Tunelo (`docs/system-architecture.md:53`).
  - Dynamic client registration and PKCE exist for MCP clients (`plans/dattqh/261008-1325-central-auth-idp/plan.md:43`).
  - Localman does not issue personal access tokens for REST. The `access-keys` routes are public-sharing keys (`apps/api/src/modules/public-sharing/access-key-operations.ts:31`), not user credentials.
- The IdP client registry is not in this checkout, so a `localman-mobile` client cannot be verified here.

Options for the auth decision (needs your choice):
- A. New IdP public client `localman-mobile` with device flow or PKCE, plus a Bearer resolver on `/api/v1` that verifies the JWT for audience `PUBLIC_URL`. Recommended: it follows the `tunelo-cli` precedent, keeps the cookie path unchanged, and needs no browser cookie handling. Costs: an IdP-side change in the external repo and an API auth change that needs a security review.
- B. Keep the cookie session and sign in through the system browser with a redirect. Costs: native cookie handling is platform-dependent and was not verified, and the Origin requirement must still be satisfied.
- C. Use the MCP OAuth token on `/mcp` only. Not suitable: the MCP API is JSON-RPC tools, not the REST routes the app needs, and tool scopes are limited by toolset.

## 2. API surface (all via defineOperation, served under /api/v1)

- Registry: `apps/api/src/operations/registry.ts:66-120`. Each module declares its routes through `defineOperation` (`docs/operation-registry.md`). The OpenAPI 3.1 document is generated at startup and served at `GET /api/v1/openapi.json`, unauthenticated (`apps/api/src/dashboard-server.ts:109-113`, `:132-134`). A typed client can be generated from it.
- Feature gates remove some operations from the served registry (`apps/api/src/operations/feature-gates.ts`). Confirm whether the OpenAPI document uses the served or full registry before generating a client.
- Projects and resources:
  - `GET /projects`, `GET /projects/:projectId` (`apps/api/src/modules/projects/project-operations.ts:27`, `:52`).
  - Resource tree: `RESOURCES_PATH=/projects/:projectId/resources` (`apps/api/src/modules/resources/resource-operation-params.ts:7`), with `resource-tree-operations.ts:18` (`/:resourceId`) and `:49` (`/parent`).
  - Resource data: `resource-data-operations.ts:122`, `:159` (`/:resourceId/data`).
- Workspaces and collections:
  - `GET /workspaces`, `POST /workspaces` (`apps/api/src/modules/workspaces/workspace-crud-operations.ts:21`, `:39`).
  - `GET /workspaces/:workspaceId/collections` (`apps/api/src/modules/collections/collection-read-operations.ts:32`), with `COLLECTION_PATH=/collections/:collectionId` (`:27`) for detail and export (`:76`).
  - Creation and import (`collection-write-operations.ts:44`, `collection-import-operations.ts:89`), search (`collection-search-operations.ts:23`), trash (`collection-trash-operations.ts:29`), and batch node duplicate and bulk-delete (`collection-node-batch-operations.ts:63`, `:86`).
- API client send: `POST /api/v1/proxy`, operation `client.sendRequest` (`apps/api/src/modules/api-client/proxy-operations.ts:75-77`). The web app sends directly from the browser when allowed (`apps/web/src/features/api-client/routing/direct-fetch.ts:161`), and otherwise uses the proxy (`apps/web/src/features/api-client/workbench/proxy-sender.ts:13-14`). The envelope limit is 15 MiB, the timeout 30 s by default and 120 s maximum (`docs/system-architecture.md:264`). Native clients have no CORS, so either path is possible. The proxy adds history, redaction and Tunelo routing.
- Environments and variables:
  - `GET/POST /workspaces/:workspaceId/environments` (`apps/api/src/modules/environments/environment-operations.ts:41`, `:59`).
  - `…/variables` (`environment-change-operations.ts:39`), `…/local-values` (`:67`), `…/duplicate` (`:100`).
  - Import and export (`environment-transfer-operations.ts:55`, `:74`).
  - Globals: `/workspaces/:workspaceId/globals` (`environments/globals-operations.ts:34`, `:96`).
- Request log: `traffic.listRequestLogs` `GET /projects/:projectId/request-logs`, cursor-paginated (`apps/api/src/modules/mock-runtime/request-log-operations.ts:27-41`), plus `GET …/request-logs/:logId` (`:64`), `DELETE` (`:84`), replay `POST` (`traffic-operations.ts:49`) and draft `GET` (`:83`).
- Webhook inbox: `GET/POST /projects/:projectId/inboxes`, `PUT/DELETE …/inboxes/:name`, and `PUT …/inboxes/:name/forward` (`apps/api/src/modules/webhook-inbox/inbox-operations.ts:22`, `:56`, `:87`, `:117`; `inbox-forward-operation.ts:16`). The web reads `requestCount` per inbox (`apps/web/src/features/webhook-inbox/inbox-api.ts:35`).
- Notifications: `GET /notifications`, `POST /notifications/:notificationId/read`, `POST /notifications/read-all` (`apps/api/src/modules/notifications/notification-operations.ts:30`, `:60`, `:86`). Preferences at `/notification-preferences` (`preference-operations.ts:97`, `:115`). Web Push at `/push-subscriptions` and `/push/vapid-public-key` (`push-operations.ts:54`, `:70`, `:120`). No Expo or APNs/FCM push path exists.
- Account: `GET /users/me`, `PUT /users/me/locale` (`apps/api/src/modules/users/user-operations.ts:9`, `:25`). Public `GET /tenant` (`apps/api/src/modules/tenant-info/tenant-info-operation.ts:13`).
- Tenancy: the tenant comes from the request Host header, and a request without a known host gets 421 (`docs/system-architecture.md:27`). The mobile app must use the tenant's API host as its base URL.

## 3. Realtime

- Request log live feed: SSE at `GET /api/v1/projects/:projectId/request-logs/stream` (`apps/api/src/operations/protocol-routes.ts:48-49`, `:121`; `apps/api/src/modules/mock-runtime/log-stream-routes.ts:92` sets `text/event-stream`, `:150` registers it). The router takes the same `resolveAuth`, so extending that resolver also covers the stream. The web uses browser `EventSource` (`apps/web/src/features/request-log/use-log-stream.ts:49`). React Native has no built-in `EventSource`, so a polyfill or a fetch-stream reader would be needed, and this was not verified on device.
- Webhook inbox: no SSE found. The web loads on demand (`inbox-api.ts:93` `fetchInboxes`).
- Notifications: no polling. The web fetches on mount and on a local "changed" event (`apps/web/src/features/notifications/use-notifications.ts:134-138`).

## 4. Reusability for React Native

- `packages/shared` (`@localman/shared`, `packages/shared/package.json:6-16`): the subpath `./constants` is documented as light (no zod, no Faker catalog; `docs/system-architecture.md:12`). The root entry re-exports `./constants.js` plus further modules (`packages/shared/src/index.ts`). Several files reference `quickjs` or `node:` (grep match, not checked import by import) (for example `api-client/script-sandbox/run-script.ts`, `api-client/collections/collection-tree.ts`). Use subpaths in RN and verify with a Metro bundle; this was not run.
- `packages/operations`: the root index exports the router, and `operation-router.ts` imports `express`. A mobile app should not import it. It only needs the generated OpenAPI types.
- `packages/design-tokens`: `tokens.css` only (263 lines, Radix Colors source, dark blocks `[2]` and `[3]`, `packages/design-tokens/tokens.css:1-20`). `package.json` exports only `./tokens.css` and `./run-button.svg`. No JSON or JS export exists, so RN would need a generated or hand-written mapping.
- i18n: dictionaries are TypeScript modules, not JSON: `apps/web/src/i18n/messages/{en,zh-CN,vi}/*.ts` aggregated by `messages/*/dictionary.ts`, typed by `apps/web/src/i18n/message-types.ts`. English is loaded eagerly and the others are dynamic imports (`apps/web/src/i18n/load-messages.ts:1-22`). Locales come from `packages/shared/src/locales.ts:7-11` (`en`, `zh-CN`, `vi`; default `en`). `translate.ts` imports only the `Locale` type from `@localman/shared/constants`. Sharing dictionaries would mean moving them to a package, or importing the TS files directly; the DOM-freeness of those files was not checked line by line.

## 5. Workspace tooling

- `pnpm-workspace.yaml`: packages `apps/*` and `packages/*`, plus `allowBuilds` for `@biomejs/biome`, `bcrypt`, `esbuild`, `mongodb-memory-server`. A new `apps/mobile` is included automatically.
- Root `package.json`: `pnpm -r build`, `pnpm -r --workspace-concurrency=1 typecheck` (then the root `scripts/` and `e2e/` tsconfigs), `vitest run` at root, `biome check .` plus `check:i18n` for lint, and Node `>=22.12`, `pnpm@11.9.0`. Root `vitest.config.ts` lists `apps/*/vitest.config.ts` as projects, so `apps/mobile` needs either a `vitest.config.ts` or the glob must be checked to tolerate its absence (not verified).
- No `.npmrc` at the root. Expo with pnpm commonly needs `node-linker=hoisted`, which would also affect the rest of the monorepo.
- `biome.json`: tabs, line width 80, double quotes, `recommended` rules, `noExplicitAny` and `noNonNullAssertion` as errors. CSS and HTML are ignored.
- `tsconfig.base.json`: `module` and `moduleResolution` `NodeNext`, `strict`, `target ES2022`. Expo/Metro needs bundler resolution and JSX, so `apps/mobile` should extend it only for shared options.
- CI (`.github/workflows/ci.yml`): `pnpm install --frozen-lockfile`, then `lint`, `typecheck`, `test --maxWorkers=2`, `check:mcp-coverage`, `check:tokens`, `check:i18n`, `build`, then Playwright e2e on ubuntu. A new app would be covered by biome, typecheck (needs a `typecheck` script), and tests. No iOS or Android build is in CI.
- `scripts/check-tokens.ts:21-22` scans only `apps/web/src` and `apps/web/index.html`, and `scripts/check-i18n.ts:24-25` scans only `apps/web/src`. Neither will break on `apps/mobile`. Both rules (no hex literals or raw px, no hard-coded Vietnamese or competitor names) would have to be followed by convention.

## 6. Plan limits, flags, docs

- `packages/shared/src/plan-limits.ts`: `FREE_LIMITS` at line 43 and `PRO_LIMITS` at line 58. Mobile-relevant fields are `requestLogDays` (7 on Free), `webhookInboxes` (2 Free, 20 Pro), and the monthly mock and proxy caps. Read them only through `limitsFor(plan)` (line 82). `Infinity` must be mapped to `null` before JSON.
- `apps/api/src/operations/feature-gates.ts`: `publicSharing`, `comments`, `forks`, `tuneloAccounts`. Gated operations return 404 while off, so the mobile app must treat them as optional.
- Docs: no mention of mobile, Expo, React Native or native clients in `docs/` or `README.md`. `apps/web` has responsive checks at 375 px and 1440 px (`apps/web/src/pages/projects/responsive-layout.test.tsx:1-6`). `docs/design-system.md` has no responsive section.

## 7. Prototype conventions

- Location: `plans/dattqh/261008-1123-localman-core/prototype/` with `index.html`, `api-client.html`, `devops.html` and `extension.html`. Four other plan folders have no prototype.
- `api-client.html` is one self-contained file of about 500 KB. It has no build step. Its inline `<style>` begins with the shared token block copied verbatim from `packages/design-tokens/tokens.css`. It uses `lang="vi"`, Google Fonts (Inter and JetBrains Mono), `color-scheme: light dark`, an inline Tabler-style icon sprite, and a labelled "Prototype controls: review aid only" section. It has two `<script>` blocks.
- Visual checks for prototypes were done in a browser at 375 px and 1440 px, not in automated tests.

## Unresolved questions

1. Which auth option (A, B or C above) should the mobile app use? A needs an IdP client change in the external `hoandat-auth` repo and a Bearer resolver in the API.
2. If option A, should the mobile client send its own `Origin`, or should the CSRF guard be changed for Bearer requests? Changing the guard needs a security review.
3. Should the mobile API client send through `client.sendRequest` (proxy, with history and Tunelo routing) or directly from the device?
4. Is there a push provider plan (Expo push, APNs, FCM)? The server only supports Web Push today.
5. Does the OpenAPI document include the feature-gated operations? This affects the generated client.
6. Does the root `vitest` projects glob fail when `apps/mobile` has no `vitest.config.ts`?
7. Are the dictionary files in `apps/web/src/i18n/messages/` free of DOM and web-only imports, so they can be shared with RN without moving them?

Status: DONE_WITH_CONCERNS
Summary: Localman's dashboard API accepts only the browser session cookie, so the mobile app needs an auth decision (new IdP client plus a Bearer resolver, following the tunelo-cli device flow precedent) before it can call the API. The REST surface, the request-log SSE stream and the webhook and notification endpoints are all in place as defineOperation routes, so the mobile work is mostly the auth change and the RN tooling setup.
