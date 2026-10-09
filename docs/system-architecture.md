# Kiến trúc hệ thống

Monorepo `localman-next` là pnpm workspace gồm `apps/*` và `packages/*`, chạy trên Node ≥ 22 và TypeScript strict (ESM).

## Bố cục

| Thư mục | Package | Vai trò |
|---|---|---|
| `apps/web` | `@localman/web` | Dashboard React 19, Vite 7, Tailwind 4 và React Router 7. Dev server ở cổng 5173 |
| `apps/api` | `@localman/api` | Hai server Express 5 trong một process: dashboard API ở cổng 4000 và mock runtime công khai ở cổng 4100 |
| `packages/operations` | `@localman/operations` | Operation registry: một khai báo sinh route REST, MCP tool descriptor và OpenAPI 3.1. Xem [operation-registry.md](operation-registry.md) |
| `packages/shared` | `@localman/shared` | Code dùng chung cho web và api. `plan-limits.ts` là nguồn duy nhất của mọi hạn mức gói |
| `packages/design-tokens` | `@localman/design-tokens` | `tokens.css`, nơi duy nhất được chứa literal màu. Xem [design-system.md](design-system.md) |
| `apps/tunelo-server`, `packages/tunelo-cli`, `packages/tunelo-shared` | `@tunelo/server`, `tunelo`, `@tunelo/shared` | Tunelo, gộp từ repo cũ và giữ nguyên lịch sử. Xem `docs/tunelo/` |
| `scripts/` | — | Script kiểm tra cho CI (`check-mcp-coverage.ts`, `check-tokens.ts`) và script build của Tunelo (`scripts/tunelo/`) |
| `infra/tunelo/` | — | nginx, certbot, PM2 và `deploy.sh` của Tunelo |

Các internal package `@localman/*` là package chỉ có source TypeScript: `exports` trỏ thẳng vào `src/index.ts`. Vite, Vitest và tsx đọc source trực tiếp. Bản build production của api dùng esbuild bundle các package này vào `apps/api/dist/main.mjs` (`apps/api/scripts/build-api.ts`).

## Luồng request của api

```
apps/api/src/main.ts
  ├─ loadEnv()            zod validate biến môi trường, sai thì log fatal và exit 1
  ├─ connectMongo()       không kết nối được thì exit 1 (fail-fast, PM2/Compose tự restart)
  ├─ dashboard app :4000  helmet → CSRF guard → json 100kb → /healthz → /auth/*, /internal/audit-events → /api/v1/openapi.json → no-store + router từ registry → 404 → error handler
  └─ mock app      :4100  helmet → json 100kb → /healthz → 404 → error handler (route mock thêm ở phase 05)
```

- Phần khung dùng chung cho hai server nằm ở `apps/api/src/http/create-base-app.ts`.
- `/healthz` luôn trả 200 kèm trạng thái kết nối DB, kể cả khi Mongo rớt giữa chừng.
- Mọi lỗi trả về dạng `{ "error": { "code", "message", "details"? } }`. Lỗi không lường trước trả 500 `INTERNAL_ERROR`, không lộ stack.
- SIGTERM/SIGINT đóng cả hai server rồi ngắt Mongo; quá 10 giây thì ép thoát.

## Đăng nhập và phiên

Localman không giữ mật khẩu. User đăng nhập ở IdP dùng chung `auth.hoandat.com` (repo `hoandat-auth`, hợp đồng ở `docs/integration-guide.md` của repo đó); Localman là client OIDC confidential `localman-web` (`apps/api/src/modules/auth/`).

- **Đăng nhập:** `GET /auth/login` tạo `state`, `nonce`, PKCE verifier, dựng URL tới IdP (scope `openid profile email telegram`, không `offline_access`, không `resource`, nên access token là opaque và làm được subject của token exchange), rồi mới lưu transaction ở `login_transactions` (TTL 10 phút). Trình duyệt chỉ giữ một handle ngẫu nhiên trong cookie `lm_login` (SameSite=Lax). Giới hạn 20 lần mỗi phút cho mỗi IP; vượt thì 303 về `/?authError=rate_limited`. IdP không phản hồi thì 303 về `/?authError=idp_unavailable`. Cả hai là điều hướng trình duyệt nên không trả JSON.
- **`returnTo` và link nội bộ:** chỉ nhận path bắt đầu bằng một `/`. Path được chuẩn hoá như trình duyệt (dot segment, `%2e`) rồi kiểm lại, nên `/.//evil.com` hay `/%2E%2E//evil.com` (chuẩn hoá thành `//evil.com`) bị chặn và về `/projects`. Luật này nằm ở `http/internal-path.ts`, dùng chung cho `link` của thông báo.
- **Callback:** transaction chỉ bị tiêu khi `state` của callback khớp, nên một callback giả không huỷ được lượt đăng nhập thật đang chờ. Sau đó đổi code (kiểm state, nonce, PKCE), đọc `userinfo` để upsert user (`users`, kèm chat Telegram), tạo phiên mới và đặt cookie `__Host-lm_session` (HttpOnly, Secure, SameSite=Strict, Path=/; trên http dev là `lm_session`). Lỗi thì về `/?authError=access_denied|login_expired|login_failed|idp_unavailable|rate_limited`.
- **Phiên** (collection `sessions`): `_id` là SHA-256 của giá trị cookie; `sub`, `sid` của IdP, access/refresh/ID token mã hoá chung một blob AES-256-GCM (AAD là id phiên, key từ `SESSION_ENCRYPTION_KEY` có key id để xoay vòng). Hết hạn 30 ngày không dùng, tối đa 90 ngày, giống grant của IdP. Huỷ phiên (đăng xuất, back-channel, refresh bị từ chối) thì xoá luôn các thiết bị Web Push mà phiên đó đã đăng ký.
- **Refresh:** access token còn dưới 60 giây thì refresh ngay khi xử lý request. Refresh token xoay vòng và dùng lại sẽ làm IdP thu hồi grant, nên mỗi phiên chỉ một lượt refresh: request cùng process dùng chung một promise, các process khác nhường nhau qua lease `refreshLockedUntil` trên document phiên. Refresh xong đọc lại `userinfo`. IdP trả `invalid_grant` thì xoá phiên (401).
- **Khi IdP sập (đánh đổi có chủ ý):** lỗi refresh tạm thời không xoá phiên; request vẫn chạy bằng access token cũ tới khi nó hết hạn (15 phút). Sau đó mọi API có scope trả 503 `AUTH_UNAVAILABLE` cho tới khi IdP trở lại, thay vì cho dùng tiếp một phiên mà IdP không còn xác nhận được.
- **Đăng xuất:** `POST /auth/logout` (form) xoá phiên rồi 303 tới `end_session_endpoint` với `id_token_hint`. `POST /auth/backchannel-logout` nhận logout token từ IdP, xác minh bằng JWKS (`iss`, `aud=localman-web`, `typ=logout+jwt`, `iat` trong 2 phút, sự kiện back-channel, không `nonce`, có `sid` hoặc `sub`), huỷ phiên theo `sid` (hoặc mọi phiên của `sub`) rồi mới ghi `jti` vào `logout_token_jtis`, để lượt IdP gửi lại vẫn đăng xuất được nếu bước ghi lỗi.
- **Sự kiện audit:** `POST /internal/audit-events` nhận SET (`application/secevent+jwt`, ES256, `typ: secevent+jwt`, `aud` là URL đầy đủ của endpoint `${PUBLIC_URL}/internal/audit-events`, `iat` không quá 15 phút và `exp` không quá 15 phút sau `iat`, dung sai đồng hồ 30 giây) kèm `Authorization: Basic` so khớp constant-time với `AUDIT_CLIENT_ID`/`AUDIT_CLIENT_SECRET`; thiếu hai biến này thì route trả 404. `jti` (bằng `Idempotency-Key`) lưu ở `audit_events` (30 ngày); sự kiện gửi lại được trả 202 mà không xử lý lại. `method.unlinked` với `method: "telegram"` xoá chat đã lưu ngay; `method.linked` telegram tạm dừng Telegram (`telegram.refreshPendingAt`) cho tới lần đọc `userinfo` kế tiếp (refresh hoặc đăng nhập). Sự kiện khác chỉ được ghi lại.
- **Token exchange:** `TunnelTokenExchange` đổi phiên lấy token `aud=https://tunnel.hoandat.com`, `scope=tunnels:read` (RFC 8693), cache theo phiên tới gần hết hạn. Phase 10 dùng.
- Mọi response `/api/v1/*` có `Cache-Control: no-store`; các route `/auth/*` và `/internal/*` cũng vậy.

## Proxy và IP của client

Localman deploy theo quy ước của server .65: pm2 chạy API, nginx giữ TLS và chạy **cùng máy**. Vì vậy `TRUST_PROXY` mặc định `loopback` (tương đương `127.0.0.1` và `::1`) là đúng: chỉ nginx trên máy được đặt `X-Forwarded-For`, và giới hạn theo IP (`GET /auth/login`) thấy IP thật của client. Giá trị được kiểm lúc khởi động bằng chính `proxy-addr` mà Express dùng: IP/CIDR sai làm API không khởi động. `true` luôn bị từ chối (ai cũng giả được `X-Forwarded-For`); ở production số hop cũng bị từ chối, phải ghi địa chỉ. Nếu chạy sau proxy khác (load balancer, Cloudflare Tunnel, nginx ở máy khác) thì phải đặt `TRUST_PROXY` bằng đúng địa chỉ hoặc CIDR của proxy đó, nếu không mọi request bị tính chung một IP.

## Thông báo

Không có email. `apps/api/src/modules/notifications/` gửi mỗi sự kiện tới các kênh user chọn cho loại sự kiện đó (`notification_preferences`):

- **Trong app** (mặc định bật, tắt được theo từng loại): lưu ở `notifications` (giữ 90 ngày), là dữ liệu của chuông.
- **Web Push** (mặc định tắt): VAPID (`VAPID_*`, tuỳ chọn), subscription theo thiết bị (`push_subscriptions`, endpoint duy nhất, chỉ nhận host của dịch vụ push trình duyệt), gắn với phiên đã đăng ký nó. Phiên kết thúc hoặc hết hạn thì thiết bị không nhận push nữa và bị xoá. Dịch vụ push trả 404/410 thì xoá subscription.
- **Telegram** (mặc định tắt): bot riêng của Localman (`TELEGRAM_BOT_TOKEN`, tuỳ chọn), `chatId` lấy từ `userinfo` của IdP. 429 thì gửi lại theo `retry_after` hoặc backoff luỹ thừa, tối đa 3 lượt và chờ không quá 10 giây; 403 thì đánh dấu kênh chưa kích hoạt cho tới khi chat đổi hoặc user bật lại Telegram trong tuỳ chọn.

`notify()` lưu bản trong app rồi trả về ngay; Web Push và Telegram chạy nền, lỗi chỉ ghi log. Khi tắt server, `drain()` chờ các lượt gửi nền xong. Danh mục sự kiện ở `notification-events.ts`; module khác gọi `getNotificationService().notify(sub, { type, title, body, link })`.

## Dữ liệu

MongoDB 7 chạy dạng single-node replica set (`rs0`), vì phase 04 cần transaction. File `docker-compose.yml` dựng sẵn và tự `rs.initiate` ở lần chạy đầu.

## Domain

| Domain | Thành phần |
|---|---|
| `localman.hoandat.com` | Web và dashboard API |
| `{secret}.localman.hoandat.com` | Mock runtime công khai |
| `auth.hoandat.com` | IdP dùng chung (plan `261008-1325-central-auth-idp`) |
| `*.tunnel.hoandat.com` | Tunelo (plan `261008-1156-tunelo-accounts-and-tunnel-list`) |
