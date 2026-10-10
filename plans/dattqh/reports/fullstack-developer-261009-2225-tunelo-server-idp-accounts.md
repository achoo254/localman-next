# Tunelo: tài khoản qua IdP, API liệt kê tunnel, CLI device login (phase 01 + 02)

Plan: `plans/dattqh/261008-1156-tunelo-accounts-and-tunnel-list/`. Phase 01 (server) và phase 02 (CLI) đã cài xong; phase 03 (docs, release npm, deploy, ngày cutoff) chưa làm theo phân công. Không commit, không deploy, không đụng `hoandat-auth`.

## Kết quả kiểm tra

| Lệnh | Kết quả |
|---|---|
| `pnpm --filter @tunelo/server test` | 14 file, **129/129 pass** (trước thay đổi: 6 file test cũ) |
| `pnpm --filter tunelo test` | 9 file, **42/42 pass**; còn 5 cảnh báo "object as third argument" của vitest trong 2 test cũ (`tunnel-client-keepalive`, `tunnel-client-reconnect`), không phải test mới |
| `pnpm test:tunelo-e2e` | 2 file, **10/10 pass** (chạy local, không cần mạng ngoài) |
| typecheck `@tunelo/server`, `tunelo` (`tsc -b shared && tsc --noEmit`) | 0 lỗi |
| `biome check apps/tunelo-server packages/tunelo-shared packages/tunelo-cli` | 153 file, 0 lỗi, 0 cảnh báo |
| `pnpm check:mcp-coverage` | OK: 59 operation, 51 tool, 8 exempt (không bị ảnh hưởng) |
| `pnpm build:tunelo-server`, `pnpm build:tunelo-cli` | build được; `dist/tunelo-server/package.json` có `jose`; `cli.js` 1,44 MB vì MCP SDK và zod được bundle vào (script build chỉ để external `chalk, commander, pino, ws`) |
| Smoke `node packages/tunelo-cli/dist/cli.js mcp` | trả lời `initialize` (serverInfo `tunelo` 1.7.0), thoát khi stdin đóng |

Test không gọi mạng thật: verifier dùng JWKS sinh tại chỗ (`jose`) và một server JWKS trên `127.0.0.1`; test Mongo dùng `mongodb-memory-server` (binary đã cache); CLI dùng IdP giả và tunnel server giả trên loopback.

## Phase 01: server

- **Xác minh JWT** (`auth/idp-token-verifier.ts`): `createRemoteJWKSet(${AUTH_ISSUER}/jwks)` (timeout 5 s, cache của jose), kiểm `iss`, `aud`, `exp`, `sub`, `alg=ES256`, `typ=at+jwt`, scope; trả `{sub, scopes, clientId, maxTunnels}`. JWKS không với tới được thì trả `unavailable` (WS đóng 1013, HTTP 503) chứ không coi là token sai.
- **Phân luồng token** (`auth/token-authenticator.ts`), dùng chung cho WS và HTTP: JWT → tài khoản; `tunelo_…` → `ApiKey` (`legacy` nếu không có scope, `link` nếu có `tunnels:read`). Token link mở tunnel bị `TUNELO_AUTH_003`; token ẩn danh từ `LEGACY_TOKEN_CUTOFF` bị `TUNELO_AUTH_004` kèm hướng dẫn `tunelo login`. `AUTH_MODE=legacy` tắt nhánh JWT và bỏ cutoff.
- **ws-handler** tách thành `ws-tunnel-auth.ts`, `ws-register-tunnel.ts`, `ws-message-guards.ts`, `ws-connection-state.ts` (file cũ 427 dòng, giờ 259). Mọi message `auth`, `register-tunnel`, `tcp-register` được kiểm kiểu và độ dài; auth chạy một lần mỗi kết nối; socket đóng trong lúc kiểm token thì không đăng ký tunnel (trước đây có thể rò tunnel). `maxTunnels`: tài khoản tính chung mọi máy theo `sub` (claim `max_tunnels` nếu có, trần 100, mặc định 3), token khác tính theo key.
- **Registry**: tunnel HTTP và cấp phát TCP lưu `owner {ownerSub, deviceId, deviceName}` và `localPort`; `tunnel-directory.ts` có `listByOwner(sub)` và `listByDeviceId(id)` (chỉ tunnel ẩn danh, vì `deviceId` của tunnel tài khoản là do client tự khai).
- **Token và link**: `ApiKey` thêm `scopes`, `linkedDeviceId`, `clientName`. Thu hồi khi login lại chỉ áp cho token đầy đủ quyền, kể cả dòng cũ chưa có trường `scopes`. `issueLinkToken` cấp `['tunnels:read']`, không ghi `deviceId`. Link-code: mã `XXXX-XXXX` (bảng chữ không có 0/O/1/I), chỉ lưu hash, TTL 10 phút, dùng một lần, khoá token duyệt sau 5 lần sai (429), poll trả token đúng một lần (xoá có điều kiện), `init` giới hạn 20 lần/10 phút mỗi IP.
- **Route mới**: `POST /api/links/init|approve|poll`, `GET /api/links`, `DELETE /api/links/self`, `DELETE /api/links/:id`, `GET /api/tunnels` (`{tunnels:[{subdomain, url, protocol, localPort, publicPort?, deviceName, connectedAt, basicAuth}]}`, `cache-control: no-store`). `/api/verify` nhận cả JWT, trả thêm `kind` và `legacyTokenCutoff`.
- **Domain**: bỏ hằng `TUNNEL_DOMAIN` ở `@tunelo/shared`; `buildTunnelUrl(subdomain, domain)` nhận domain. Server đọc `TUNNEL_DOMAINS`, `extractSubdomain` nhận mọi domain trong danh sách, khớp chặt hơn (`a.tunnel.x.evil.com`, `a.b.tunnel.x` không còn được nhận là subdomain), URL HTTP và TCP luôn dùng domain đầu.
- `app.set("trust proxy", "loopback")` để rate limit theo IP thật sau nginx cùng máy.
- `UsageLog.keyId/userId` đổi từ ObjectId sang String: `sub` (`acc_…`) không phải ObjectId và sẽ làm hỏng cả lô ghi usage.
- Mã lỗi mới đã thêm vào bảng trong `CLAUDE.md`: `TUNELO_AUTH_003`, `TUNELO_AUTH_004`, `TUNELO_DEVICE_004`, `TUNELO_LINK_001..004`.

## Phase 02: CLI (`tunelo` 1.7.0)

- `tunelo login`: device flow với client `tunelo-cli`, scope `openid offline_access tunnels:open tunnels:read`, `resource=https://tunnel.hoandat.com`, `device_name` lọc theo ký tự IdP cho phép; endpoint lấy từ discovery; in `user_code` và mở `verification_uri_complete`; poll xử lý `authorization_pending`, `slow_down` (+5 s), `expired_token`, `access_denied`, chịu được 3 lần lỗi mạng liên tiếp. `--legacy-key <token>` cho CI. `tunelo logout` thu hồi refresh token qua `revocation_endpoint` rồi xoá phiên và key.
- `idp-session.ts`: refresh trước mỗi lần mở WebSocket và mỗi lần reconnect (TunnelClient nhận `getApiKey`), dưới file lock `~/.tunelo/session.lock` và đọc lại config trong lock, nên nhiều tiến trình chỉ xoay refresh token một lần; lỗi mạng thử lại 1/2/4 s; IdP từ chối (`invalid_grant`…) thì xoá phiên và báo `tunelo login`, vòng reconnect dừng hẳn.
- `~/.tunelo/config.json` ghi atomic, quyền 600 (thư mục 700), tự siết file cũ 644. `tunelo config --show` không còn in token.
- `tunelo whoami`; dòng nhắc cho máy ẩn danh mỗi lần chạy, ngày cutoff lấy từ `auth-result` của server.
- `tunelo link <code>`, `tunelo links` (= `links list`), `tunelo links revoke <id>`; máy đã đăng nhập thì báo không cần.
- Server mặc định `https://tunnel.hoandat.com`; config cũ trỏ `tunnel.inetdev.io.vn` tự chuyển kèm một dòng thông báo (stderr). Inspector hiển thị URL thật server trả thay cho domain viết cứng.
- Token tài khoản chỉ được gửi tới server chính thức hoặc loopback (xem mục Review).
- `tunelo mcp` (MCP stdio, SDK v2): `open_http_tunnel`, `open_tcp_tunnel`, `list_local_tunnels`, `close_tunnel` (`destructiveHint`), `tunnel_status` (kèm danh sách tunnel của tài khoản qua `GET /api/tunnels` khi đã đăng nhập), `whoami`. Tunnel đóng khi hết TTL, khi `close_tunnel`, khi client MCP ngắt hoặc tiến trình nhận SIGINT/SIGTERM.

**Về dependency** (câu hỏi của coordinator): chính tôi thêm `@modelcontextprotocol/server` 2.3.1 và `zod` ^4.3.6 (dependencies), `@modelcontextprotocol/client` 2.3.1 (devDependency, cho test stdio) vào `packages/tunelo-cli`, và `jose` ^6.2.12 vào `apps/tunelo-server`. Cả bốn đều cần: `tunelo mcp` thuộc phạm vi phase 02, còn `jose` để xác minh JWT. Tôi giữ chúng; `pnpm install --offline` đã chạy một lần, lockfile chỉ thêm các importer này. Diff hiện tại của `pnpm-lock.yaml` còn có `quickjs-*` do phiên khác thêm, không phải của tôi.

## Review (code-reviewer) và các sửa sau review

Reviewer không thấy lỗi critical. Đã sửa cả 5 lỗi mức high, kèm test:

1. **File lock khi refresh**: lock ghi nonce, chỉ người giữ mới được xoá; mtime được làm mới mỗi 5 s nên lock đang dùng không bao giờ bị coi là stale; mỗi lần vào lock chỉ refresh một lần, backoff chạy ngoài lock.
2. **429 từ IdP không còn xoá phiên**: phiên chỉ kết thúc khi gặp `invalid_grant`, `invalid_client` hoặc `unauthorized_client`; 429, 5xx và lỗi mạng thì thử lại. Lúc poll device flow, 429 được xử lý như `slow_down`, lỗi mạng nhân đôi interval.
3. **`tunelo mcp` không còn crash vì unhandled rejection** khi mở TCP thất bại: chỉ chờ kết quả đăng ký sau khi connect xong.
4. **Token tài khoản chỉ gửi tới server chính thức** (`tunnel.hoandat.com`, `tunnel.inetdev.io.vn` qua https/wss, cùng loopback để dev). Server khác phải dùng `--key`.
5. **Không còn lưu link token dạng plaintext**: approve chỉ ghi `linkedDeviceId`; token được mint ở lần poll giành được (xoá) bản ghi đã duyệt. Nhờ vậy cũng hết lỗi medium "poll trễ để lại token mồ côi".

Đã sửa thêm:
- `tunelo tcp` và MCP `open_tcp_tunnel` gửi `tcpOnly`, nên server không mở thêm tunnel HTTP công khai trỏ vào cổng TCP. Server bản cũ bỏ qua cờ này.
- Tunnel TCP tính vào quota của tài khoản. Socket đóng thì luôn gỡ tunnel.
- `clientName` của link bị lọc ký tự điều khiển C0/C1 ở server, và CLI lọc thêm lần nữa khi in.
- JWKS trả lỗi non-200 giờ được tính là `unavailable` (503), không phải token sai.
- `extractSubdomain` xét domain dài trước.
- `login --force` thu hồi grant cũ trước khi đăng nhập lại.
- `--legacy-key` để trống giá trị thì đọc `TUNELO_KEY`, để token không vào shell history.

Chưa sửa (low/medium, cần quyết định hoặc để phase sau):
- Giới hạn `/api/links/init` 20 lần/10 phút theo IP. Nếu Localman gọi từ server của nó thì mọi user chung một hạn mức. Cần chốt Localman gọi từ đâu.
- Sau `LEGACY_TOKEN_CUTOFF`, máy ẩn danh không liệt kê hay thu hồi link được nữa, mà link token thì không hết hạn. Nên cho token ẩn danh đã quá hạn quản lý link, hoặc đặt `expiresAt` cho link token.
- `ws-handler.ts` (264 dòng), `tunnel-client.ts`, `cli.ts` vẫn quá 200 dòng (đều đã quá từ trước; `ws-handler` giảm từ 427). Còn vài cast nhỏ ở chỗ đọc body JSON.

## Lệch so với plan

1. **Trang approve cũ ở `hybrid`**: `GET /login` chuyển hướng sang `${AUTH_ISSUER}/account`, nhưng `POST /api/device/init` và `/approve` trả 403 `TUNELO_DEVICE_004`, để CLI 1.6.x in ngay hướng dẫn nâng cấp thay vì chờ một trang không ai duyệt được. Token đã cấp vẫn chạy tới cutoff. Muốn duyệt sau khi đăng nhập IdP thì server phải thành OIDC relying party (client `tunelo-web`), việc này plan không đề cập.
2. **`listByOwner`/`listByDeviceId`** nằm ở `tunnel-directory.ts`, không ở `tunnel-manager.ts` (file đó đã 362 dòng).
3. **MCP**: không có `sso`, `allow`, `ip`, vì server chưa có cơ chế kiểm soát truy cập nào như vậy, khai ra sẽ gây hiểu nhầm là được bảo vệ. HTTP có `auth` (Basic Auth server hỗ trợ sẵn) và `ttl`; TCP **bắt buộc `ttl`** (tối đa 8 giờ) thay cho "sso|ip bắt buộc".
4. **`whoami`** in id tài khoản (`sub`), không có username: client `tunelo-cli` không có scope `profile`.
5. `AuthMessage` thêm `localPort`, `deviceId`, `deviceName`, `tcpOnly` (đều tuỳ chọn); `AuthResult` thêm `code`, `legacyTokenCutoff`. CLI 1.6.x không gửi thì `localPort` là `null` trong danh sách.
6. Test CLI đặt cạnh file nguồn (`src/*.test.ts`) theo quy ước sẵn có của package, không trong `__tests__/`.

## Biến môi trường của server

| Biến | Ý nghĩa | Mặc định |
|---|---|---|
| `TUNNEL_DOMAINS` | Danh sách domain, phần tử đầu là domain chính trong mọi URL trả ra | không có; nếu thiếu thì đọc `TUNNEL_DOMAIN`; **thiếu cả hai thì server không khởi động** |
| `AUTH_MODE` | `hybrid` (JWT + token ẩn danh tới cutoff, đóng đăng nhập ẩn danh) hoặc `legacy` (rollback) | `hybrid` |
| `AUTH_ISSUER` | `iss` của JWT; JWKS lấy ở `${AUTH_ISSUER}/jwks` | `https://auth.hoandat.com` |
| `AUTH_AUDIENCE` | `aud` của JWT (resource của IdP) | `https://tunnel.hoandat.com` |
| `LEGACY_TOKEN_CUTOFF` | Ngày ISO từ đó token ẩn danh không mở tunnel được | rỗng = chưa chặn |

**Giá trị an toàn khi deploy lên `tunnel.inetdev.io.vn` lúc này:**

```env
TUNNEL_DOMAINS=tunnel.inetdev.io.vn
AUTH_MODE=hybrid
AUTH_ISSUER=https://auth.hoandat.com
AUTH_AUDIENCE=https://tunnel.hoandat.com
LEGACY_TOKEN_CUTOFF=
```

- Chỉ đưa `tunnel.hoandat.com` lên đầu `TUNNEL_DOMAINS` khi DNS wildcard, chứng chỉ và `server_name` của nginx cho domain đó đã sẵn sàng. Nếu không, mọi URL trả cho CLI sẽ không truy cập được.
- `AUTH_AUDIENCE` phải giữ `https://tunnel.hoandat.com` dù server đang chạy trên domain cũ: đó là resource mà IdP ghi vào token.
- **Cần cân nhắc trước khi bật `hybrid`:** chế độ này đóng đăng nhập ẩn danh ngay. CLI 1.7.0 chưa publish (phase 03), nên máy mới chưa có cách đăng nhập (trừ `--legacy-key` với token có sẵn). Token ẩn danh đang dùng vẫn chạy vì `LEGACY_TOKEN_CUTOFF` để trống. Nếu cần giữ đăng nhập ẩn danh cho tới khi phát hành 1.7.0, deploy với `AUTH_MODE=legacy`, sau đó chuyển sang `hybrid` cùng lúc publish.
- `hybrid` cần `auth.hoandat.com/jwks` truy cập được từ VPS và client `tunelo-cli` đã có trên IdP.
- Rollback: `AUTH_MODE=legacy`. Nếu quay về **bản server cũ** thì phải chạy trước `ApiKey.updateMany({scopes:'tunnels:read'}, {$set:{status:'revoked'}})`, vì bản cũ không đọc scope.
- Bundle server cần `npm install` trên VPS để có `jose` (đã nằm trong `dist/tunelo-server/package.json`).

## Trạng thái plan

- `phase-01-server-accounts-and-tunnel-list.md`: tick hết, `status: completed`.
- `phase-02-cli-device-login.md`: `status: in-progress`. Còn T8 và Verification, vì E2E với IdP thật chưa chạy (xem dưới).
- `plan.md` giữ nguyên.

## Còn lại cho phase 03 và việc chưa làm được

- **E2E với IdP thật chưa chạy** (đăng nhập bằng trình duyệt headless, `tunelo http 3000`, `GET /api/tunnels` bằng token đổi từ Localman, `tunelo logout`): cần `hoandat-auth` chạy local (MongoDB, khoá ký, client `localman-web` có secret), trong khi repo đó đang được agent khác sửa. Hai ô T8/Verification của phase 02 vì vậy còn để trống.
- `tests/tunelo/e2e/test-helpers.ts` còn gọi `buildTunnelUrl(sub)` với một tham số (thành `https://sub.undefined`). Test vẫn pass vì chỉ kiểm `toContain`, nhưng nên sửa thành `buildTunnelUrl(sub, "tunnel.hoandat.com")`. Thư mục này không nằm trong quyền sửa của tôi.
- Phase 03: README/CHANGELOG của CLI (lệnh mới, ngày cutoff), ADR, publish `tunelo-v1.7.0`, deploy, đặt `LEGACY_TOKEN_CUTOFF`, nginx và chứng chỉ cho `tunnel.hoandat.com`. Có thể cân nhắc đưa `@modelcontextprotocol/server`/`zod` vào `runtimeDeps` của `scripts/tunelo/build-client.ts` để bundle nhỏ lại.
- Cảnh báo không chặn: mongoose báo option `new` của `findOneAndUpdate` đã deprecated, do `device-login-service.ts` có sẵn từ trước (code mới đã dùng `returnDocument`).
