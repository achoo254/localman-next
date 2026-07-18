# Bỏ account/admin — auth bằng access token paste (report)

**Ngày:** 2026-07-18 | **Branch:** main | **Client:** `@dattqh/tunelo@1.1.0`

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
