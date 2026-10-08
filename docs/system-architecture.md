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
  ├─ dashboard app :4000  helmet → json 100kb → /healthz → /api/v1/openapi.json → router từ registry → 404 → error handler
  └─ mock app      :4100  helmet → json 100kb → /healthz → 404 → error handler (route mock thêm ở phase 05)
```

- Phần khung dùng chung cho hai server nằm ở `apps/api/src/http/create-base-app.ts`.
- `/healthz` luôn trả 200 kèm trạng thái kết nối DB, kể cả khi Mongo rớt giữa chừng.
- Mọi lỗi trả về dạng `{ "error": { "code", "message", "details"? } }`. Lỗi không lường trước trả 500 `INTERNAL_ERROR`, không lộ stack.
- SIGTERM/SIGINT đóng cả hai server rồi ngắt Mongo; quá 10 giây thì ép thoát.

## Dữ liệu

MongoDB 7 chạy dạng single-node replica set (`rs0`), vì phase 04 cần transaction. File `docker-compose.yml` dựng sẵn và tự `rs.initiate` ở lần chạy đầu.

## Domain

| Domain | Thành phần |
|---|---|
| `localman.hoandat.com` | Web và dashboard API |
| `{secret}.localman.hoandat.com` | Mock runtime công khai |
| `auth.hoandat.com` | IdP dùng chung (plan `261008-1325-central-auth-idp`) |
| `*.tunnel.hoandat.com` | Tunelo (plan `261008-1156-tunelo-accounts-and-tunnel-list`) |
