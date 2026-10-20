# Research: Expo / React Native mobile app inside the localman-next monorepo

Date: 2026-10-20 (Asia/Saigon). Read-only research; no repo code changed.
Scope: the 7 questions from the planning brief. Package versions come from `npm view` run on 2026-10-20, so they are primary data.

## Bottom line

Build on **Expo SDK 58** (React Native 0.88, React 19.3, New Architecture only) with **Expo Router 58** and the `default@sdk-58` template (`src/app`). Keep pnpm's default **isolated** linker and **no Metro monorepo config**. Two things block a clean import of `@localman/shared` and need small fixes:

1. **Metro does not map `./x.js` to `./x.ts`.** I confirmed this by reading the `metro-resolver@0.87.1` and `@expo/cli@58.1.13` source.
2. **Sign-in:** the dashboard API authenticates with a cookie session (BFF), so the app needs a new token path on the API side, not just a client library.

The recommended stack, in rank order per area:

- **Auth:** `expo-auth-session` + `expo-secure-store`.
- **Lists and keyboard:** FlashList v2 + `react-native-keyboard-controller` (`KeyboardChatScrollView`).
- **Chat UI:** custom bubbles, not gifted-chat (now in maintenance mode).
- **Navigation:** JS `Tabs` from Expo Router.
- **Styling:** a tokens TS file generated from `packages/design-tokens/tokens.css`, used through `StyleSheet`.
- **i18n:** the web's TS dictionaries extracted to a shared package, plus `expo-localization`.
- **Testing and builds:** jest-expo + RNTL 14 for tests, Maestro for E2E, and the EAS free tier for builds and OTA updates.

## 1. Expo SDK, React Native, React, Router, New Architecture

| Item | Current fact (2026-10-20) |
|---|---|
| Latest stable SDK | **58** (released 2026-10-15). npm `expo@latest` = 58.0.16 |
| React Native / React | 0.88 / **19.3.0**; React Native Web 0.21. Min Node 22.13 (no odd versions); min iOS 16.4, Android 7, compileSdk 37 |
| Expo Router | `expo-router@58.0.24`. It now uses SDK-aligned versioning, so there is no separate "v7". SDK 58 reworked the navigation core and made loaders, SSR and middleware stable |
| Template | `npx create-expo-app --template default@sdk-58`. App code lives in `src/app`. Native Tabs are the default since SDK 55 |
| New Architecture | The legacy architecture was **removed in SDK 55**, and the `newArchEnabled` flag is gone. Hermes V1 is opt-in. In SDK 57, monorepo Android support for Hermes V1 was not recommended yet |
| SDK 58 breaking changes to plan for | Strict RN TypeScript API by default (deep `react-native/Libraries/*` imports are type errors). iOS scene lifecycle (`SceneDelegate`). Expo CLI sets `NODE_ENV`, which changes which `.env` files load. `InteractionManager` removed. R8 on by default for Android release builds |

Node fit: the repo runs Node 24.18 locally, which satisfies the SDK 58 requirement of `^24.3`.

Sources: [SDK 58 changelog](https://expo.dev/changelog/sdk-58), [SDK version table](https://docs.expo.dev/versions/latest/), [SDK 55 changelog (legacy architecture removed, template)](https://expo.dev/changelog/sdk-55), [SDK 57 changelog](https://expo.dev/changelog/sdk-57).

## 2. Expo in this pnpm monorepo

**Linker.** Expo officially supports pnpm's isolated installs from SDK 54 onward. `nodeLinker: hoisted` in `pnpm-workspace.yaml` is the documented fallback, not a requirement. Some community guides from 2026 still recommend hoisted, but they rely on older advice. Start isolated, and switch only if a native module fails to autolink. Switching to hoisted changes the layout for the whole workspace, including the api and web apps, so it is not a free choice.

**Metro.** Since SDK 52, `expo/metro-config` detects monorepos on its own. The docs say to *remove* any custom `watchFolders`, `nodeModulesPaths`, `extraNodeModules` or `disableHierarchicalLookup` settings. Autolinking module resolution is automatic in monorepos from SDK 55.

**Hard rules.** The app must have exactly one copy of `react` and one of `react-native` (check with `pnpm why --depth=10 react-native`). Native modules must never be duplicated.

**Version clash with the web app.** The web app declares `react ^19.1`, while SDK 58 pins React 19.3.0. They can coexist under the isolated linker, but the mobile app must resolve only the 19.3 copy. A single React version across the workspace is the safer goal.

**Source-only TS packages:**
- `exports` that point at `./src/index.ts` work. Metro has enabled package `exports` resolution by default since 0.82, and `.ts` is in the default `sourceExts`.
- **`.js` import suffixes do not work under NodeNext.** `@localman/shared/src/index.ts` contains `export * from "./constants.js"`. Metro's `resolveSourceFile` tries the literal path and then *appends* each extension (`constants.js.ts`, and so on). It never substitutes `.ts` for `.js`. Expo's extra resolvers (tsconfig `paths`, autolinking, fallback, and `.mjs` ordering) do not add this mapping either. I verified both by reading the published sources (`metro-resolver@0.87.1` `resolve.js` lines 608-658, and `@expo/cli@58.1.13` `start/server/metro/*`).
- **Fix:** add about 10 lines to `apps/mobile/metro.config.js`. Use a `resolver.resolveRequest` hook: for a relative specifier ending in `.js` whose origin is inside `packages/*`, retry with the suffix stripped, and otherwise fall through to `context.resolveRequest`. This is the same idea as webpack's `extensionAlias`. Changing the shared packages away from NodeNext would break the API build, which is the wrong trade.
- **Bundle size risk.** Import narrow subpaths (`@localman/shared/constants`) rather than the root index. The root index pulls in `@faker-js/faker`, `quickjs-emscripten-core` (WASM) and `ajv`, which are heavy or not Hermes-friendly.
- **Biome.** Biome covers the new app with no extra tooling. Expo's ESLint config is optional.

Sources: [Expo monorepo guide](https://docs.expo.dev/guides/monorepos/), [Metro configuration](https://metrobundler.dev/docs/configuration/), [Metro resolution algorithm](https://metrobundler.dev/docs/resolution/), [Callstack pnpm monorepo article](https://www.callstack.com/blog/react-native-monorepo-with-pnpm-workspaces) (community, older advice).

## 3. OIDC sign-in with PKCE against the self-hosted IdP

**Architecture fit comes first.** Per `docs/system-architecture.md` §Đăng nhập/Phiên, web sign-in is a server-side BFF: the API runs PKCE against the IdP, keeps the encrypted IdP tokens in `sessions`, and the browser holds only the `__Host-lm_session` cookie. Dashboard REST has no bearer path today. The only bearer path, MCP, is scoped to `resource={PUBLIC_URL}/mcp`. Two designs fit, ranked:

| Rank | Design | Pros | Cons |
|---|---|---|---|
| 1 | **BFF handoff.** The app opens `{API}/auth/login?client=mobile` in an auth session. The callback redirects to `localman://auth?code=<one-time>`. The app exchanges that code (bound with app-side PKCE) for an opaque Localman session token, then sends `Authorization: Bearer <session>` | Reuses existing sessions, refresh, back-channel logout and revocation. IdP tokens never reach the device. No new IdP client | Needs a new API endpoint plus bearer acceptance on dashboard routes (an M-tier API change). This is an auth change, so SAST/DAST per project memory |
| 2 | **Native public OIDC client.** The app registers at the IdP and does PKCE directly, holding access and refresh tokens | Standard RFC 8252 | The API must validate IdP access tokens for a new audience. Refresh tokens live on the phone. Duplicates the session logic the BFF already owns |

**Library choice (needed in both designs), ranked:**

1. **`expo-auth-session@58.0.13`.** First-party and versioned with the SDK. `usePKCE` defaults to `true`. It provides `useAutoDiscovery(issuer)`, `exchangeCodeAsync`, `refreshAsync`, `TokenResponse.shouldRefresh()` and `revokeAsync`. It runs on `expo-web-browser`, which uses ASWebAuthenticationSession on iOS. It does not work in Expo Go because the custom scheme can't be set there, so use a development build.
2. **`react-native-app-auth@9.0.0`** (published 2026-10-19, maintained by Nearform). Built on AppAuth-iOS and AppAuth-Android, so it is the most RFC-8252-faithful option. v9 requires RN 0.86+ and Expo SDK 57+ with a dev build plus `ios.enableSceneSupport`. It adds no value over option 1 for this case and is a one-day-old major release, so adoption risk is higher.

**Redirect URIs.** Use a custom scheme (`scheme: "localman"` in the app config, `makeRedirectUri()`). HTTPS universal-link callbacks need iOS 17.4+, the `webcredentials:` Associated Domains entitlement and an AASA file. There are open reports that the auth sheet does not auto-dismiss on HTTPS callbacks. Use the custom scheme for v1. Universal links are only worth adding later for shareable deep links.

**Token storage.** Use `expo-secure-store` (iOS Keychain, Android Keystore-encrypted SharedPreferences), with `keychainAccessible: AFTER_FIRST_UNLOCK` so background refresh still works. Some iOS versions reject values over about 2 KB, so store the opaque session token (design 1) or the refresh token only, never a JWT bundle. iOS Keychain entries can survive an uninstall, so clear them on the first launch after a fresh install. Never use AsyncStorage for tokens.

**Refresh.** In design 1, the server-side session already refreshes IdP tokens, so the app just handles 401 by signing in again. In design 2, call `refreshAsync` when `shouldRefresh()` is true, behind a single-flight mutex.

Sources: [Expo authentication guide](https://docs.expo.dev/guides/authentication/), [AuthSession API](https://docs.expo.dev/versions/latest/sdk/auth-session/), [react-native-app-auth](https://github.com/FormidableLabs/react-native-app-auth), [SecureStore API](https://docs.expo.dev/versions/latest/sdk/securestore/), [Apple forum: HTTPS callback needs iOS 17.4](https://developer.apple.com/forums/thread/769749), [Auth0: HTTPS universal-link callback issue](https://support.auth0.com/center/s/article/auth0-https-scheme-does-not-work-for-ios-universal-link).

## 4. Chat UI building blocks

| Need | Recommendation | Why |
|---|---|---|
| Message list | **`@shopify/flash-list@2.3.3`** | v2 is New-Architecture-only (fine on SDK 58) and needs no size estimates. For chat, v2 docs use `maintainVisibleContentPosition` (on by default) + `startRenderingFromBottom` + `autoscrollToBottomThreshold`; `inverted` is deprecated. FlatList inverted still works but is slower and has known Android inverted quirks. If you cap history at a few hundred items, FlatList is acceptable, but FlashList costs nothing extra here |
| Keyboard | **`react-native-keyboard-controller@1.22.8`** | `KeyboardChatScrollView` (present since about 1.21) is plugged into FlashList via `renderScrollComponent`. It provides `keyboardLiftBehavior`, interactive dismiss, and `extraContentPadding` for a growing composer. Use `KeyboardStickyView` for the composer. Included in Expo Go |
| Bubbles | **Custom** components (bubble, composer, request/response card) | `react-native-gifted-chat@3.4.0` says in its README that it is **in maintenance mode** ("active development has moved" to a fork). It is built around FlatList and `IMessage` (`_id`, `user`, avatars). A request/response UI (method chip, status, JSON body, timing) would override almost every render prop, so the library adds dependencies without saving code |
| Tabs | **JS `Tabs` from `expo-router`** | Native Tabs (`expo-router/native-tabs`, stable import in SDK 58) cap Android at 5 tabs, give no tab-bar height, ignore background color on iOS 26+, and have limited FlatList scroll-to-top. JS tabs follow the tokens. Choose Native Tabs only if a native iOS 26 look is a product requirement |

For streaming response text, render the last bubble from state and leave the list's data stable, so FlashList recycling does not re-layout the whole list.

Sources: [FlashList v2 announcement](https://shopify.engineering/flashlist-v2), [FlashList v2 changes](https://www.mintlify.com/shopify/flash-list/migration/v2-changes), [KeyboardChatScrollView docs](https://kirillzyusko.github.io/react-native-keyboard-controller/docs/api/components/keyboard-chat-scroll-view), [Expo keyboard-controller](https://docs.expo.dev/versions/v58.0.0/sdk/keyboard-controller.md), [gifted-chat README](https://github.com/FaridSafi/react-native-gifted-chat), [Native Tabs](https://docs.expo.dev/router/advanced/native-tabs/).

## 5. Styling with design tokens and dark mode

How the repo's tokens work today: `packages/design-tokens/tokens.css` holds about 170 CSS custom properties. Dark mode comes from `@media (prefers-color-scheme: dark)` plus overrides via `[data-theme]`. Some tokens use `color-mix()`, and spacing changes with a 768px media query. None of these CSS features exist in React Native, so every option needs a translation step.

| Rank | Option | Maturity | Fit |
|---|---|---|---|
| 1 | **Tokens TS file generated from `tokens.css`** (`{ light, dark }` objects, with `color-mix` pre-computed to rgba at build time), plus `StyleSheet` and a `useTheme()` hook on `useColorScheme()` | No dependency | `tokens.css` stays the only literal source. Add a `check:tokens`-style guard so the generated file can't drift. Simplest option, strict-TS friendly, no runtime cost |
| 2 | **Unistyles `3.5.3`** (stable, Nitro/JSI, New-Architecture-only) | Stable since mid-2025, active | Same generated file feeds `StyleSheet.configure({ themes, settings: { adaptiveThemes: true } })`. Theme switches happen without re-renders, and it supports variants and breakpoints. Add it when theming code starts to grow |
| 3 | **NativeWind** | `latest` = 4.2.7, which uses **Tailwind v3**. v5 (Tailwind v4.1) is **`5.0.0-rc.0`** only | It would let mobile reuse class names like `bg-surface`, but v4 conflicts with the repo's Tailwind 4, and v5 is a release candidate that needs a babel/CSS pipeline and has `color-mix` gaps. Revisit when v5 is promoted to `latest` |

Sources: [NativeWind v5 release plan discussion](https://github.com/nativewind/nativewind/discussions/1818), [NativeWind 5.0.0-rc.0](https://newreleases.io/project/npm/nativewind/release/5.0.0-rc.0), [NativeWind v4 to v5 migration](https://www.nativewind.dev/v5/guides/migrate-from-v4), [2026 styling comparison](https://reactnativerelay.com/article/react-native-styling-2026-nativewind-unistyles-tamagui-compared) (community), npm dist-tags.

## 6. i18n sharing with the web app

The web app does not use i18next or JSON. Its dictionaries are typed TS modules (`apps/web/src/i18n/messages/{en,vi,zh-CN}/*.ts`, 63 namespaces, about 5,000 lines for `en`) with a custom `t()`. That makes JSON-sharing advice moot. Ranked:

1. **Extract the dictionaries plus the framework-free part of `t()` into a workspace package** (for example `packages/i18n`), and have both apps consume it. This keeps one source for all three locales and the `Messages` type safety, and `check:i18n` keeps working. Watch two things. First, the web files use extensionless imports; inside a NodeNext package they would gain `.js` suffixes, so the same Metro resolver fix from §2 applies. Second, mobile should import only the namespaces it uses (and lazy-load `vi` and `zh-CN` as the web does) to keep the Hermes bundle small.
2. Add `i18next` + `react-i18next` (26.5 / 17.1) on mobile only. Rejected, because it duplicates `t()` semantics (DRY) and would mean converting the dictionaries.

**Locale detection.** Use `expo-localization@58.0.5`: `getLocales()[0].languageTag` with a fallback to `en`, and the `useLocales()` hook to react to OS changes. Map `zh-Hans-*` to `zh-CN`. Persist the user's choice and sync it to the account the same way the web's `account-locale-sync.ts` does.

Sources: [expo-localization](https://docs.expo.dev/versions/latest/sdk/localization/), repo files `apps/web/src/i18n/load-messages.ts` and `messages/en/dictionary.ts`.

## 7. Testing, CI, EAS, and the stores

**Unit and component tests.** Use `jest-expo@58.0.11` (the preset mocks the native side of the Expo SDK) with `@testing-library/react-native@14.1.0`. v14 is now `latest`; it requires React 19+ and RN 0.78+, and `render`, `fireEvent` and `act` are async. `react-test-renderer` is deprecated for React 19. Note that the repo runs Vitest everywhere else. Jest is still the only supported runner for RN component tests. Keep the Jest run inside `apps/mobile` with `--maxWorkers=2`, and run it only in CI per CLAUDE.md.

**E2E.** Use Maestro YAML flows in `apps/mobile/.maestro`. EAS Workflows has a ready-made Maestro job that runs on a fresh emulator or simulator. Detox is the heavier alternative and is not needed here.

**EAS pricing (expo.dev/pricing, read 2026-10-20):**

| Plan | Builds | EAS Update (OTA) |
|---|---|---|
| Free $0 | 15 Android + 15 iOS builds/month, low-priority queue (waits can exceed 90 minutes at peak) | 1,000 MAU, 100 GiB bandwidth, hard cap |
| Starter $19/month | $45 build credit, then $1-2 per Android build and $2-4 per iOS build; high priority | 3,000 MAU, then $0.005/MAU |
| Production $199/month | $225 credit | 50,000 MAU |

EAS Submit is included on every plan. An alternative to paid builds is `eas build --local` or a GitHub Actions macOS runner. Local iOS builds are not an option on this 16 GB shared dev machine.

**Store requirements:**
- **Apple Developer Program:** $99/year. An organization account needs a D-U-N-S number. TestFlight covers internal testing.
- **Google Play:** $25 one-time. **Personal accounts created after 2023-11-13 need a closed test with at least 12 testers opted in for 14 consecutive days** before production access. A tester who leaves and rejoins restarts their own 14 days. Third-party sources say organization accounts are exempt, but Google's page does not state this. Registering as an organization (iNET) avoids the risk.

Sources: [Expo unit testing](https://docs.expo.dev/develop/unit-testing/), [RNTL v14 migration](https://oss.callstack.com/react-native-testing-library/docs/start/migration-v14), [EAS Workflows E2E](https://docs.expo.dev/eas/workflows/reference/e2e-tests/), [Expo pricing](https://expo.dev/pricing), [Google Play testing requirements](https://support.google.com/googleplay/android-developer/answer/14151465), [12-tester rule overview](https://www.testerscommunity.com/blog/google-play-closed-testing-requirements-2026) (community), [Apple Developer Program enrollment](https://developer.apple.com/programs/enroll/).

## Adoption risk summary

| Choice | Risk | Note |
|---|---|---|
| SDK 58 / RN 0.88 | Medium | Released five days ago. Pin `expo@~58.0.16` and expect patch churn. SDK 57 is the conservative fallback, but its iOS 27 scene support is opt-in |
| Isolated pnpm linker | Low-Medium | Officially supported. Hoisted is the escape hatch, but it touches the whole workspace |
| Metro `.js` resolver shim | Low | Small and testable. It breaks only if Metro later adds native `extensionAlias` support, which would make the shim redundant rather than broken |
| expo-auth-session | Low | First-party, SDK-versioned |
| FlashList v2 / keyboard-controller | Low | Both active (releases in Oct 2026). keyboard-controller ships in Expo Go |
| Unistyles (deferred) / NativeWind v5 (avoid now) | Medium / High | v5 is a release candidate |
| Google Play personal account | High (schedule) | The 14-day closed test is on the critical path if the account is personal |

## Limitations

- I verified the Metro `.js` finding from source, not by running a bundle. The `resolveRequest` shim needs a smoke test (`expo export`) before the plan commits to it.
- I did not look at the IdP itself (whether it supports native public clients, custom-scheme redirect registration, or DCR for mobile). Design 1 avoids depending on that.
- I did not cover push notifications, offline storage (MMKV 4.3.2 exists), OTA update policy, accessibility, crash reporting or app-store review rules beyond account setup.
- Apple and Google fees are well-established figures that I did not re-fetch today.

## Unresolved questions

1. Will iNET publish under an **organization** or a personal Google Play account? This decides whether the 12-tester / 14-day rule applies.
2. Is the API team willing to add a **bearer session path to dashboard REST** (design 1)? That is an auth change that needs ADR, SAST and DAST.
3. Should mobile share **Tailwind class names** with the web (which would mean waiting for NativeWind v5 stable), or only token values (option 1, available now)?
4. Is an iOS Native Tabs look a product requirement, or are JS tabs acceptable?
