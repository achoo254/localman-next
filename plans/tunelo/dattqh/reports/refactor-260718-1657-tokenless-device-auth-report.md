# Bỏ account/admin — device auth (report)

**Ngày:** 2026-07-18 | **Branch:** main | **Client:** `@dattqh/tunelo@1.3.0`

> **Cập nhật v1.3.0 (LUỒNG CUỐI — device-initiated, browser approve):**
> `tunelo login`: CLI có **device id** cố định (`config.deviceId`) → `POST /api/device/init {deviceId,name}` → mở browser `/login?req=<id>` → CLI **poll**. Trang hiện **thiết bị + nút Approve**; bấm Approve → server cấp token gắn `deviceId` (revoke token active cũ cùng device) → CLI poll nhận token (browser KHÔNG thấy token) → trang báo success.
> - **Idempotent/máy:** token local còn hạn → `login` báo "Already authorized" (không round-trip); mint token mới revoke token cũ cùng deviceId → mỗi máy đúng 1 token. `--force` để làm lại, `--key <token>` cho headless.
> - **Server:** `login-request-model` (TTL, thay device-session), `device-login-service` (init/getRequest/approve/poll), `access-token-service` (nhận deviceId + rotate), `api/device-routes` (`/init,/request,/approve,/poll`), `render-login-page` (thiết bị + Approve), `GET /login?req=`. `api-key-model` thêm `deviceId`.
> - **Client:** `login` init→browser→poll; `config.deviceId`; `api-client.initDeviceLogin/pollDeviceLogin`.
> - **E2E verified:** init→request(pending)→approve→poll(token)→poll lại(expired) | verify token 200 | **cùng device login lại: token cũ→401 (revoked), token mới→200** | tunnel bằng token → curl public **HTTP 200**. Deploy #7153 + publish v1.3.0 #7154 xanh.
> - **Bảo mật:** nút Approve không có cổng (ai mở trang cũng approve được). Gate thực tế: cần registry token để cài + reachable server. Muốn siết → thêm mật khẩu trên trang Approve.

---
_Bên dưới là mô tả các bản trung gian (v1.1.0 paste-token, v1.2.0 browser-code) — giữ để tham chiếu:_

## Mục tiêu
Bỏ hẳn account/admin/login/dashboard. End-user: cài CLI → `tunelo login` → paste access token (BE sinh, lưu Mongo) → `tunelo http`.

## Kết quả — DONE (E2E verified)
Cài `@dattqh/tunelo@1.1.0` từ registry → `tunelo login --key <token>` → **✓ Verified & saved** → `tunelo http 5599` → `https://j87sf5ro.tunnel.inetdev.io.vn` → **curl public = HTTP 200** (proxy về local). Pipeline #7144 (deploy) + tag v1.1.0 (publish) đều xanh.

## Thay đổi

### Server (giữ MongoDB cho apikeys)
- `db/models/api-key-model.ts`: `userId` optional, thêm `maxTunnels` (default 3).
- `key-store/mongo-key-store.ts`: bỏ User lookup; key đứng độc lập, `_id` là identity, `maxTunnels` từ key.
- MỚI `api/verify-routes.ts`: `GET /api/verify` (Bearer) → 200/401.
- `api/create-api-router.ts`: chỉ còn `/verify` (bỏ auth/admin/device/keys/profile/usage + csrf/cookie/cors/json).
- `server.ts`: bỏ serve `/dashboard`. `build-server.ts`: bỏ build/copy dashboard.
- **Xoá:** admin/auth/profile/usage/device-auth/key routers, admin-guard, api-key-auth, cookie-auth, csrf, rate-limiter, require-user-id, validate-body, schemas/, rate-limit/, services admin/auth/device-auth/key/totp, user-model, device-code-model, **package dashboard**.

### Client (`@dattqh/tunelo` 1.1.0)
- MỚI `cli-login-command.ts`: `tunelo login` prompt/`--key` → verify `/api/verify` → save config. `logout` giữ.
- `api-client.ts`: rút gọn còn `getApiBaseUrl` + `verifyKey`.
- `cli.ts`: bỏ `keys` command; version 1.1.0.
- **Xoá:** cli-device-auth, cli-auth-commands, cli-keys-commands.

### Ops
- MỚI `scripts/create-access-token.mjs`: sinh token + hash + insert Mongo (chạy trên server: `cd /var/www/tunelo && node --env-file=.env create-access-token.mjs [label]`). Đã seed 1 token label `cli-access`.
- `.gitlab-ci.yml` + `infra/deploy.sh`: bỏ sync dashboard.
- Endpoint xác nhận: health 200 | `/api/verify` no-token 401 | `/dashboard` 400 (đã bỏ).

## Cách dùng (end-user)
```bash
npm config set @dattqh:registry https://gitlabs.inet.vn/api/v4/projects/343/packages/npm/
npm config set "//gitlabs.inet.vn/api/v4/projects/343/packages/npm/:_authToken" <read-token>
npm install -g @dattqh/tunelo
tunelo login --key <access-token>      # hoặc `tunelo login` rồi paste
tunelo http 3000
```

## Unresolved / lưu ý
1. `.env` server còn `JWT_SECRET`/`ADMIN_EMAILS` (từ kiến trúc cũ) — server mới không đọc, vô hại; xoá được nếu muốn sạch.
2. Client vẫn còn `src/portal` (request-inspector cục bộ, port 4041) + `portal-dist`; modal tạo key trong đó gọi `/api/keys` đã bỏ → nút đó hỏng. Không ảnh hưởng tunnel. Gỡ nếu muốn.
3. Thư mục `/var/www/tunelo/dashboard` cũ còn sót trên server (không được serve) — xoá thủ công nếu muốn.
4. Sinh thêm token: chạy `create-access-token.mjs` trên server (đã có sẵn tại `/var/www/tunelo/`).
