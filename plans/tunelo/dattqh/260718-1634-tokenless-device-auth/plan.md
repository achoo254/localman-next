# Bỏ admin/account — xác thực bằng access token paste

**Trạng thái (23/10/2026):** xong. `GET /api/verify` (`apps/tunelo-server/src/api/verify-routes.ts`), không còn router admin/dashboard, CLI `verifyKey`. Về sau `tunelo login` chuyển sang device flow của IdP chung (`plans/dattqh/261008-1156-tunelo-accounts-and-tunnel-list`), paste token chỉ còn là nhánh cũ.

**Mục tiêu:** Bỏ hẳn account/admin/login/dashboard. End-user: cài CLI → `tunelo login` → paste access token (BE sinh, lưu Mongo) → `tunelo http`. Server validate token; không có user.

**Flow chốt:**
```
$ tunelo login → Paste your Tunelo access token: tk_xxx → ✓ Verified & saved
$ tunelo http 3000 → https://xxx.tunnel.inetdev.io.vn
```

## Thay đổi

### Server
- `db/models/api-key-model.ts`: `userId` optional; thêm `maxTunnels` (default 3).
- `key-store/mongo-key-store.ts`: bỏ User lookup; KeyInfo dùng `keyId` làm identity, `maxTunnels` từ key.
- `key-store/key-store-types.ts`: `userId` giữ (=keyId), bỏ phụ thuộc user/role thực.
- MỚI `api/verify-routes.ts`: `GET /api/verify` (Bearer key) → 200/401.
- `api/create-api-router.ts`: chỉ mount verify (bỏ admin/auth/device/keys/profile/usage + csrf/cookie).
- `server.ts`: bỏ serve `/dashboard`; `/api` = verify; giữ health + WS + relay.
- `scripts/build-server.ts`: bỏ build/copy dashboard.
- MỚI `scripts/create-access-token.ts`: sinh + hash + insert Mongo (dùng seed token).
- Xoá file admin/account không còn tham chiếu (auth/admin/profile/usage/device-auth/keys/totp/cookie/csrf/user model...).

### Client
- `cli-device-auth.ts` → `login` = prompt paste token + verify (`GET /api/verify`) + save; giữ `logout`. Bỏ device-code/browser.
- `cli.ts`: bỏ `keys` command (API keys quản trị đã bỏ). Bump version.
- `api-client.ts`: thêm `verifyKey(baseUrl, key)`.

### Dashboard
- Xoá package `packages/dashboard` (admin UI). Cập nhật lockfile.

### Vận hành
- Seed 1 token vào Mongo staging (.65). Set nothing extra (không cần AUTH_TOTP_SECRET — bỏ ý tưởng TOTP).
- Deploy main (server) + tag republish CLI. Test cài + paste token + tunnel.

## Acceptance
- `tunelo login` paste token hợp lệ → saved; token sai → báo lỗi.
- `tunelo http 3000` với token đã lưu → ra URL, relay OK.
- Không còn `/dashboard`, `/api/auth/*`, `/api/admin/*`.
