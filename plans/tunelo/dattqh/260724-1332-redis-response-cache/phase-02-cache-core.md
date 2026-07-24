# Phase 02 — Cache core trong Node relay

**Tier:** L — 4 module cache mới + tests trong `packages/server`, sửa nhỏ `request-relay.ts` + `tunnel-manager.ts`, thêm dep `ioredis`. Không đổi WS protocol → client không sửa.

## Ràng buộc code-standards (bắt buộc)

TS strict, **no `any`** (dùng `unknown` + type guard), ESM, **named export**, **≤200 dòng/file**, kebab-case, **không barrel**, **pino** (không `console.log`), `TuneloError` + `TUNELO_xxx` cho lỗi có cấu trúc, test co-located `__tests__/`.

## Files

### Tạo mới
- `packages/server/src/cache/redis-client.ts` — khởi tạo singleton `ioredis` từ `REDIS_URL`.
  - `lazyConnect: true`, `enableOfflineQueue: false`, `maxRetriesPerRequest: 1`, `retryStrategy` có cap (vd 2s), `connectTimeout: 1000`.
  - Export `getRedis(): Redis | null` (null nếu `CACHE_ENABLED=false` hoặc thiếu `REDIS_URL`) và `isCacheEnabled(): boolean`.
  - Bắt `error` event → log `warn` một lần, **không** crash. Cache là best-effort.
- `packages/server/src/cache/cacheability.ts` — thuần, test được.
  - `classifyRequest(method, path)` → `{ eligible, isApiPath }` (eligible = GET + không phải API path denylist).
  - `classifyResponse(status, headers)` → `{ cacheable, ttl }`: cacheable **chỉ khi** origin tuyên bố cacheable (parse `Cache-Control`: có `max-age>0`/`s-maxage>0`/`immutable`; **loại** `no-store`/`no-cache`/`private`/`max-age=0`) **và** status ∈ {200,301,308} **và** không có `Set-Cookie` **và** có `content-length` **và** content-type/đuôi thuộc allowlist FE. Không có micro-cache/TTL bịa. `ttl = min(maxAgeOrigin, CACHE_MAX_TTL)`.
  - Hằng số: `STATIC_EXTENSIONS`, `STATIC_CONTENT_TYPES`, `API_PATH_PREFIXES` (`/api`,`/graphql`,`/trpc`,`/rest`,`/socket.io`,`/_next/data`).
  - **Nguyên tắc dev-first:** respect-origin thuần → dev-server (`no-cache`) không bao giờ cacheable. Không đoán/ép cache.
- `packages/server/src/cache/response-cache.ts` — I/O Redis, bọc try/catch (lỗi → coi như MISS/no-op).
  - `cacheKey(subdomain, path)` = `tunelo:cache:${subdomain}:${sha1(path)}` (path gồm query; hash để bound độ dài + không log query thô).
  - `getCached(subdomain, path): Promise<CachedResponse | null>` — đọc + parse.
  - `setCached(subdomain, path, entry, ttl)` — `SET key <json> EX ttl`. Bỏ qua nếu body > `CACHE_MAX_OBJECT_BYTES` (mặc định 5MB).
  - `purgeSubdomain(subdomain)` — `SCAN MATCH tunelo:cache:{subdomain}:* COUNT 200` theo vòng + `UNLINK` theo lô; fire-and-forget, log số key xóa.
  - `CachedResponse = { status: number; headers: Record<string,string|string[]>; body: string /*base64*/ }`.
- `packages/server/src/cache/caching-sink.ts` — `createCachingSink(inner: StreamSink, ctx): StreamSink`.
  - Tách khỏi `request-relay.ts` để file relay không vượt 200 dòng.
  - `onStart`: lưu status+headers, gọi `classifyResponse`; set `cacheable` + `ttl`; **luôn** forward `inner.onStart` (gắn `X-Tunelo-Cache: MISS`/`BYPASS`).
  - `onData(chunk)`: `inner.onData(chunk)` **trước** (không chặn stream ra browser); nếu `cacheable` thì `buf.push(chunk)`, cộng dồn size — vượt `CACHE_MAX_OBJECT_BYTES` thì bỏ buffer + `cacheable=false` (memory-safe).
  - `onEnd`: `inner.onEnd()`; nếu `cacheable` → `setCached(...)` (await trong microtask, không chặn `res.end`).
  - `onError`: chỉ forward, **không** lưu.

### Sửa
- `packages/server/src/request-relay.ts` — sau khi qua các check hiện có (subdomain, tunnel tồn tại, **basic auth**), thêm nhánh cache cho `GET` không có `Authorization`:
  1. **Lookup** (trước `openStream`): `getCached(subdomain, req.url)`. HIT → `res.writeHead(status, {...headers, 'x-tunelo-cache':'HIT'})`, `res.end(Buffer.from(body,'base64'))`, `usageTracker.record(...)` cho bytesOut, **return** (không mở WS). MISS → tiếp.
  2. **Store**: bọc sink hiện tại bằng `createCachingSink(responseSink, { subdomain, method, path, req })` rồi truyền vào `openStream`.
  - Giữ nguyên `needsUnbufferedRelay`/`X-Accel-Buffering` (giờ chỉ là safeguard vô hại vì nginx `proxy_buffering off`).
  - Nếu file chạm gần 200 dòng: đưa 2 nhánh trên vào helper `cache/serve-from-cache.ts` (`tryServeFromCache(req,res)` + `wrapSinkForCache(...)`).
- `packages/server/src/tunnel-manager.ts` — trong `register()`, **chỉ khi không phải grace-recovery** (`orphaned` undefined) → `void purgeSubdomain(subdomain)` (fire-and-forget, đã bọc try/catch trong cache module). Grace-reconnect (blip WS, nội dung không đổi) không purge.
- `packages/server/package.json` — thêm `"ioredis": "^5.x"`.
- `docs/deployment-guide.md` — cập nhật bảng env: `REDIS_URL`, `CACHE_ENABLED`, `CACHE_MAX_OBJECT_BYTES`, `CACHE_MAX_TTL_SECONDS` (đã có dòng `REDIS_URI` cũ cho rate-limit — thống nhất tên `REDIS_URL`).

### ADR
- `docs/decisions/redis-response-cache-in-node-relay.md` (copy `0000-adr-template.md`): ghi **quyết định** (Redis-only trong Node, không nginx-srcache vì stock nginx thiếu module + front nhiều service prod; **respect-origin thuần, không force-cache** vì tunelo là công cụ dev → freshness > hit-rate), **bối cảnh** (yêu cầu FE-cache/API-bypass, dev-first, RAM mỏng), **hệ quả** (bỏ edge-offload nginx, cache best-effort, purge theo subdomain, dev-server không bao giờ cache). Đặt tên theo nội dung, không theo mã plan.

## Env đọc trong code (đều có default an toàn)

| Env | Default | Ý nghĩa |
|---|---|---|
| `REDIS_URL` | (unset → cache off) | Chuỗi kết nối Valkey |
| `CACHE_ENABLED` | `true` nếu có `REDIS_URL` | Kill-switch |
| `CACHE_MAX_OBJECT_BYTES` | `5242880` (5MB) | Cap 1 object |
| `CACHE_MAX_TTL_SECONDS` | `86400` | Trần TTL (chỉ để bound Redis; TTL thực = max-age origin) |

## Tests (vitest, co-located)

- `cache/__tests__/cacheability.test.ts` — ma trận: asset FE (`.js/.css/.png/.woff2`) **có** `Cache-Control: max-age>0`/`immutable` → cacheable, `ttl=min(max-age,86400)`; **cùng asset đó nhưng `no-cache`/không có Cache-Control (dev server) → bypass**; `/api/x` + `application/json` → bypass (kể cả khi có max-age); `text/event-stream` → bypass; POST → không eligible; có `Authorization` → không eligible; response có `Set-Cookie`/`no-store`/`private`/`max-age=0` → không cacheable; thiếu `content-length` → không cacheable.
- `cache/__tests__/response-cache.test.ts` — key ổn định + isolate theo subdomain; round-trip serialize/deserialize (kể cả header array-valued); `setCached` bỏ qua khi > cap; `purgeSubdomain` gọi SCAN+UNLINK đúng pattern (mock ioredis).
- `cache/__tests__/caching-sink.test.ts` — tee lưu đúng khi kết thúc dưới cap; **bỏ** cache khi vượt cap giữa chừng; non-cacheable chỉ passthrough; `onError` không lưu; luôn forward `inner`.
- Regression: `request-relay.test.ts` giữ pass; thêm case HIT trả từ cache không gọi `openStream`, và `Authorization`/API luôn bypass.

## Nghiệm thu phase

`pnpm --filter @tunelo/server test` xanh; `pnpm lint` (biome) + `tsc --noEmit` sạch (0 error/warning); không `any`/`console.log`; mọi file cache ≤200 dòng. Verify tích hợp (Valkey thật) làm ở phase-03.
