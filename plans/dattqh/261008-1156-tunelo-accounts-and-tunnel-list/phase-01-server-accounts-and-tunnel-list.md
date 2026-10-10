---
phase: 1
title: "Server: xác minh token của IdP, tài khoản, scope, API liệt kê tunnel, link-code"
status: completed
priority: P1
effort: "L"
dependencies: []
---

# Phase 01: Server Tunelo

## Goal
`apps/tunelo-server` chấp nhận access token JWT do `auth.hoandat.com` ký (`aud=https://tunnel.hoandat.com`), gắn tunnel với tài khoản (`sub`), thêm scope, có `GET /api/tunnels` liệt kê theo tài khoản, và có luồng `links/*` cho máy chưa gắn tài khoản. Token ẩn danh cũ vẫn chạy tới `LEGACY_TOKEN_CUTOFF`.

## Files và thay đổi (path tính từ root monorepo)
- MỚI `apps/tunelo-server/src/auth/idp-token-verifier.ts`: dùng thư viện `jose`. `createRemoteJWKSet(AUTH_ISSUER/jwks)` có cache; kiểm `iss`, `aud`, `exp` và scope. Trả về `{sub, scopes, clientId}`.
- `apps/tunelo-server/src/key-store/*`: `KeyInfo` thêm `kind:'idp'|'legacy'|'link'`, `ownerSub?`, `deviceId?` và `scopes`.
- `apps/tunelo-server/src/ws-handler.ts`:
  - Token dạng JWT đi qua `idp-token-verifier`; cần scope `tunnels:open`.
  - Token `tunelo_…` cũ đi qua `ApiKey`, chỉ hợp lệ khi `Date.now() < LEGACY_TOKEN_CUTOFF`; quá hạn thì trả `TUNELO_AUTH_004` (token ẩn danh hết hạn) kèm hướng dẫn chạy `tunelo login`.
  - Token link (`scopes=['tunnels:read']`) bị từ chối với `TUNELO_AUTH_003`.
  - Giới hạn số tunnel theo tài khoản: `maxTunnels` lấy từ claim, mặc định 3.
- `apps/tunelo-server/src/tunnel-manager.ts` và `tcp-port-manager.ts`: lúc register thì lưu `ownerSub|null`, `deviceId`, `deviceName`, `localPort`, `protocol:'http'|'tcp'`, `publicPort?`. Thêm `listByOwner(sub)` và `listByDeviceId(id)`.
- `apps/tunelo-server/src/db/models/api-key-model.ts`: thêm `scopes: string[]` (mặc định rỗng, nghĩa là token ẩn danh đầy đủ quyền như hiện nay), `linkedDeviceId` và `clientName`.
- `apps/tunelo-server/src/services/access-token-service.ts`:
  - Câu lệnh thu hồi khi login lại **chỉ** áp cho token đầy đủ quyền: `{deviceId, status:'active', scopes:{$size:0}}`.
  - Thêm `issueLinkToken({linkedDeviceId, clientName})` với scope `['tunnels:read']`, không ghi `deviceId`.
- MỚI `apps/tunelo-server/src/db/models/link-request-model.ts` và `services/device-link-service.ts` (mã `XXXX-XXXX`, TTL 10 phút, dùng 1 lần, khoá sau 5 lần sai, poll trả token đúng 1 lần), `api/link-routes.ts`:
  - `POST /api/links/init`, `POST /api/links/approve` (Bearer là token **ẩn danh** của máy), `POST /api/links/poll`
  - `GET /api/links`, `DELETE /api/links/:id`, `DELETE /api/links/self`
- MỚI `apps/tunelo-server/src/api/tunnel-list-routes.ts`: `GET /api/tunnels`.
  - JWT `aud=https://tunnel.hoandat.com` có scope `tunnels:read` thì trả `listByOwner(sub)`.
  - Token link thì trả `listByDeviceId(linkedDeviceId)`.
  - Kết quả `{tunnels:[{subdomain, url, protocol, localPort, publicPort?, deviceName, connectedAt, basicAuth:boolean}]}`. Không bao giờ trả hash hay key.
- `apps/tunelo-server/src/api/render-login-page.ts` cùng `device-routes.ts`: khi `AUTH_MODE=hybrid` thì trang approve cũ **redirect sang IdP** (login bắt buộc). Luồng device-code cũ chỉ còn cho CLI 1.6.x tới hết hạn cutoff.
- `apps/tunelo-server/src/api/create-api-router.ts`: mount `/links` và `/tunnels`; cập nhật comment về API surface.
- **Domain mới `tunnel.hoandat.com`:**
  - `packages/tunelo-shared/src/constants.ts` bỏ hằng `TUNNEL_DOMAIN` hardcode.
  - Server đọc biến `TUNNEL_DOMAINS` (danh sách, phần tử đầu là domain chính, ví dụ `tunnel.hoandat.com`). `request-relay.ts` (`extractSubdomain`) và `tcp-ws-handler.ts` nhận subdomain của **mọi** domain trong danh sách, nên trong lúc chuyển đổi chạy song song được cả domain cũ.
  - URL trả về cho CLI luôn dùng domain chính.
- `.env.example` của server: `AUTH_ISSUER`, `AUTH_AUDIENCE=https://tunnel.hoandat.com`, `AUTH_MODE`, `LEGACY_TOKEN_CUTOFF`, `TUNNEL_DOMAINS`.

## Verification
Test trong `apps/tunelo-server/src/**/__tests__/`:
- `idp-token-verifier` dùng JWKS giả: `aud` sai, hết hạn hay thiếu scope đều bị từ chối.
- `ws-handler`:
  - JWT `tunnels:open` mở được tunnel.
  - Token link bị từ chối bằng `TUNELO_AUTH_003`.
  - Token ẩn danh trước cutoff thì mở được; sau cutoff (giả lập đồng hồ) bị từ chối bằng `TUNELO_AUTH_004`.
- `listByOwner` gom được tunnel từ 2 máy; `listByDeviceId` chỉ thấy máy của mình.
- Điều kiện thu hồi của `access-token-service`: login lại không đụng tới token link.
- `extractSubdomain` nhận đúng subdomain của cả hai domain trong `TUNNEL_DOMAINS`. URL tunnel trả về luôn là `https://<tên>.tunnel.hoandat.com`.
- `pnpm --filter @tunelo/server test` và `biome check` sạch.

## Giao việc
**Đợt:** 4 · **Phụ thuộc trước khi bắt đầu:** IdP phase 03 xong (client `tunelo-cli`, `tunelo-web` và token exchange có trên staging); Localman phase 01 đã gộp Tunelo vào monorepo, `pnpm --filter @tunelo/server test` pass trên code gộp · **Lệnh cook:** `/ak:cook plans/dattqh/261008-1156-tunelo-accounts-and-tunnel-list/phase-01-server-accounts-and-tunnel-list.md`

| # | Việc | Vai trò | Song song | File chính |
|---|---|---|---|---|
| T1 | Bộ xác minh JWT của IdP bằng `jose`: `createRemoteJWKSet` có cache, kiểm `iss`, `aud` (giá trị thật là `https://tunnel.hoandat.com`; plan ghi tắt `aud=https://tunnel.hoandat.com`), `exp` và scope, trả `{sub, scopes, clientId}`; thêm biến `AUTH_ISSUER`, `AUTH_AUDIENCE`, `AUTH_MODE`, `LEGACY_TOKEN_CUTOFF`, `TUNNEL_DOMAINS` | fullstack-developer | Song song với T2, T3 | `apps/tunelo-server/src/auth/idp-token-verifier.ts`, `apps/tunelo-server/.env.example` |
| T2 | Dữ liệu token: `KeyInfo` thêm `kind`, `ownerSub?`, `deviceId?`, `scopes`; `ApiKey` thêm `scopes` (mặc định rỗng), `linkedDeviceId`, `clientName`; điều kiện thu hồi khi login lại chỉ áp cho token có `scopes` rỗng; thêm `issueLinkToken` | fullstack-developer | Song song với T1, T3 | `apps/tunelo-server/src/key-store/*`, `apps/tunelo-server/src/db/models/api-key-model.ts`, `apps/tunelo-server/src/services/access-token-service.ts` |
| T3 | Registry tunnel: lưu `ownerSub`, `deviceId`, `deviceName`, `localPort`, `protocol`, `publicPort?` lúc register; thêm `listByOwner(sub)` và `listByDeviceId(id)` | fullstack-developer | Song song với T1, T2 | `apps/tunelo-server/src/tunnel-manager.ts`, `apps/tunelo-server/src/tcp-port-manager.ts` |
| T4 | Phân luồng xác thực trong ws-handler: JWT cần `tunnels:open`; token `tunelo_…` chỉ hợp lệ trước `LEGACY_TOKEN_CUTOFF`, quá hạn trả `TUNELO_AUTH_004` kèm hướng dẫn `tunelo login`; token link bị từ chối bằng `TUNELO_AUTH_003`; giới hạn `maxTunnels` theo claim, mặc định 3 | fullstack-developer | — (sau T1, T2, T3) | `apps/tunelo-server/src/ws-handler.ts` |
| T5 | Luồng link-code: mã `XXXX-XXXX`, TTL 10 phút, dùng một lần, khoá sau 5 lần sai, poll trả token đúng một lần; route `init`, `approve` (Bearer là token ẩn danh), `poll`, liệt kê, xoá theo id, xoá `self` | fullstack-developer | Song song với T4, T7, T8 (sau T2) | `apps/tunelo-server/src/db/models/link-request-model.ts`, `apps/tunelo-server/src/services/device-link-service.ts`, `apps/tunelo-server/src/api/link-routes.ts` |
| T6 | `GET /api/tunnels`: JWT có `tunnels:read` thì trả `listByOwner(sub)`, token link thì trả `listByDeviceId(linkedDeviceId)`; không bao giờ trả hash hay key. Mount `/links` và `/tunnels`, cập nhật comment API surface | fullstack-developer | — (sau T3, T5) | `apps/tunelo-server/src/api/tunnel-list-routes.ts`, `apps/tunelo-server/src/api/create-api-router.ts` |
| T7 | Khi `AUTH_MODE=hybrid`, trang approve cũ redirect sang IdP (bắt buộc đăng nhập); luồng device-code cũ chỉ còn cho CLI 1.6.x tới cutoff | fullstack-developer | Song song với T5, T8 (sau T1) | `apps/tunelo-server/src/api/render-login-page.ts`, `apps/tunelo-server/src/api/device-routes.ts` |
| T8 | Nhiều domain: bỏ hằng `TUNNEL_DOMAIN` hardcode, server đọc `TUNNEL_DOMAINS` (phần tử đầu là domain chính), `extractSubdomain` và TCP nhận subdomain của mọi domain trong danh sách, URL trả cho CLI luôn dùng domain chính. Grep mọi chỗ dùng hằng cũ (kể cả `packages/tunelo-cli`) để build không vỡ | fullstack-developer | Song song với T5, T7 | `packages/tunelo-shared/src/constants.ts`, `apps/tunelo-server/src/request-relay.ts`, `apps/tunelo-server/src/tcp-ws-handler.ts` |
| T9 | Test: verifier với JWKS giả (sai `aud`, hết hạn, thiếu scope); ws-handler (JWT mở được, token link bị `TUNELO_AUTH_003`, ẩn danh trước và sau cutoff bằng đồng hồ giả); `listByOwner` gom 2 máy, `listByDeviceId` chỉ thấy máy mình; thu hồi không đụng token link; `extractSubdomain` với 2 domain | tester | — (sau T4–T8) | `apps/tunelo-server/src/**/__tests__/` |
| T10 | Review cuối phase | code-reviewer | — | toàn phase |

### Checklist
- [x] T1 Verifier JWT và biến môi trường mới
- [x] T2 Model token có scope, thu hồi chỉ áp cho token đầy đủ quyền, có `issueLinkToken`
- [x] T3 Registry lưu chủ sở hữu và thiết bị, có `listByOwner` và `listByDeviceId`
- [x] T4 ws-handler trả đúng `TUNELO_AUTH_003`, `TUNELO_AUTH_004` và áp `maxTunnels`
- [x] T5 Link-code đủ 6 route, TTL, khoá sai nhiều lần
- [x] T6 `GET /api/tunnels` trả đúng shape, không lộ hash hay key
- [x] T7 Trang approve cũ redirect sang IdP khi `AUTH_MODE=hybrid`
- [x] T8 `TUNNEL_DOMAINS` chạy song song 2 domain, URL trả về là `https://<tên>.tunnel.hoandat.com`
- [x] T9 Toàn bộ test mới pass
- [x] T10 Review không còn finding mức high
- [x] Verification: các case của verifier, ws-handler, registry, thu hồi token và `extractSubdomain` pass
- [x] lint/typecheck/test sạch: `biome check`, `tsc --noEmit`, `pnpm --filter @tunelo/server test`
- [x] `pnpm check:mcp-coverage` pass
