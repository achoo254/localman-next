# Redis response-cache trong Node relay (FE cache, API bypass)

**Tier:** M–L (server: 4 file cache mới + tests, sửa `request-relay.ts` + `tunnel-manager.ts`; infra: `nginx.conf` revert tenant cache, `valkey.conf` mới, `.env` + ecosystem; 1 ADR). Không migration, **không đổi WS protocol / public contract** → client không cần sửa.

**Trạng thái:** ✅ xong. Triển khai và verify trên `.65` (2026-07-24); code đã commit (`99f4cec`, `d413559`, `a2bfca0`, rà 23/10/2026). Code review: 1 Critical (C1) + 1 Medium (M1) đã fix; test 77 pass.

## Mục tiêu

Cache response ở **Node relay** (backed by Valkey trên `127.0.0.1:6379`) để reload trang / nhiều người cùng xem một tunnel không phải round-trip `WS → máy client → local app` cho từng asset. Cache **chủ yếu asset FE** (js/css/ảnh/font/wasm + HTML shell). **Mọi request API/động (JSON, non-GET, có Authorization/Set-Cookie, SSE) bỏ qua cache hoàn toàn.**

## Vì sao (why)

- Chặng đắt nhất khi tải asset qua tunnel là `nginx → Node → WS → client → local app`. Cache tại Node cắt hẳn phần `WS → client` — đúng động lực của commit edge-cache trước (`5ed63c7`), nhưng tổng quát hơn: chạy được cả với dev-server không gắn cache header, và **bảo đảm được yêu cầu "API bypass hoàn toàn"** ở một chỗ test được.
- `.65` dùng **stock nginx 1.20.1 không có module redis/srcache/lua** → không thể để nginx dùng Redis làm backend nếu không thay bằng OpenResty (nginx này đang front nhiều service prod → rủi ro cao). Vì vậy Redis đặt **trong Node** — đúng hướng report `redis-tunelo-resource-assessment-2026-07-24.md` ("tunelo kết nối thẳng `127.0.0.1:6379`").
- Tầng nginx edge-cache hiện tại **không thỏa** yêu cầu mới: API của **tenant** (`app.tunnel.../api/...`) đi qua `location /`, nếu app đặt `Cache-Control: public` thì nginx **sẽ cache** → vi phạm "API bypass hoàn toàn". nginx stock cũng **không purge được theo subdomain** khi dev restart app.

## Quyết định (đã chốt với user 2026-07-24)

1. **Kiến trúc A — Redis-only trong Node relay.** Node là cache authority duy nhất cho traffic tenant. Revert tenant `location /` của nginx về passthrough (`proxy_buffering off`, bỏ `proxy_cache`). → phân loại FE/API + force-cache + purge nằm 1 chỗ (TypeScript, test được). Đánh đổi đã chấp nhận: bỏ edge-offload của nginx (HIT giờ đi qua Node — rẻ, vì traffic mỗi tunnel thấp).
2. **Engine: Valkey 8.1.6 native + systemd** (`dnf install valkey`), bounded config, không persistence.
3. Client Redis trong Node: **`ioredis`** (lazyConnect, tắt offline-queue → Redis chết thì cache fail-fast, relay vẫn chạy). Cache là **best-effort, không bao giờ được làm hỏng relay**.

## Định hướng: tunelo là công cụ DEV (chi phối toàn bộ policy)

tunelo chủ yếu dùng để **dev/preview/demo**, không phục vụ production traffic. Với công cụ dev, **freshness > hit-rate**: sai lầm tệ nhất là trả asset cũ cho lập trình viên đang sửa code. Cache chỉ giữ hai loại **an toàn không thể stale**: (1) asset origin tự tuyên bố cacheable, và (2) asset **content-hashed** (tên file đổi khi nội dung đổi — nhận diện qua pattern tên). File non-hashed không có cache-header → luôn đi thẳng xuống app. **KHÔNG force-cache theo TTL bịa** cho file non-hashed. (Bổ sung auto-cache hashed sau khi user chọn phương án B, 2026-07-24.)

## Chính sách cache (tóm tắt — chi tiết ở phase-02)

- **Chỉ cache khi HỘI ĐỦ:** `GET`; **không** có header `Authorization`; response **không** có `Set-Cookie`; status ∈ {200, 301, 308}; **và origin tuyên bố cacheable** — `Cache-Control` có `max-age>0`/`s-maxage>0`/`immutable` (hoặc `public` kèm max-age dương). Bất kỳ `no-store`/`no-cache`/`private`/`max-age=0` → **bypass**.
- **CACHE (allowlist FE):** content-type là `text/css` / `*/javascript` / `image/*` / `font/*` / `application/wasm`, **hoặc** path có đuôi asset tĩnh (`.js .mjs .css .map .png .jpg .jpeg .gif .svg .webp .avif .ico .woff .woff2 .ttf .otf .eot .wasm`). (HTML thường được origin đánh `no-cache` để app shell luôn tươi → mặc định không vào cache, đúng ý dev.)
- **BYPASS (deny mặc định):** mọi thứ còn lại — đặc biệt `application/json`, `text/event-stream`, path bắt đầu `/api /graphql /trpc /rest /socket.io /_next/data`, non-GET, body không có `content-length` (chunked/stream), body > cap. **Dev-server (`no-cache`) → luôn bypass → dev luôn thấy code mới.**
- **TTL = max-age của origin** (cap `CACHE_MAX_TTL=86400s` chỉ để bound Redis; LRU + maxmemory tự evict). Không có TTL floor/micro-cache.
- **Purge:** khi tunnel **mở phiên mới** (`register()` không phải grace-reconnect) → xóa toàn bộ key của subdomain (`SCAN MATCH tunelo:cache:{subdomain}:* → UNLINK`), best-effort fire-and-forget → restart tunnel gần như luôn thấy asset mới (asset hashed luôn tươi; asset non-hashed có cửa sổ race <1s).
- **Isolation:** cache key = `tunelo:cache:{subdomain}:{sha1(GET+path+query)}` → tenant không đụng nhau. Bảo mật: không cache khi có `Authorization`/`Set-Cookie` (tránh auth-bypass / rò dữ liệu cá nhân hóa); cap kích thước object chống memory-DoS.

## Phases

| Phase | Nội dung | Tier | Phụ thuộc |
|---|---|---|---|
| [01](phase-01-valkey-provisioning.md) | Cài + cấu hình Valkey bounded trên `.65`, thêm `REDIS_URL` vào `.env` | S | — |
| [02](phase-02-cache-core.md) | Cache core trong Node: client, classifier, store/lookup, tee-sink, purge, tests + ADR | L | 01 (để test tích hợp thật) |
| [03](phase-03-nginx-revert-rollout.md) | Revert tenant cache trong `nginx.conf`, deploy, verify HIT/MISS + bypass API, theo dõi RAM | M | 02 |

Phase 01 và code của 02 làm song song được (02 test unit bằng mock ioredis, chỉ cần Valkey thật ở bước verify tích hợp).

## Tiêu chí hoàn thành (acceptance)

- [x] **HIT path**: seed 1 entry Valkey cho tunnel live `onedash-staging` + path test → curl HTTPS trả `X-Tunelo-Cache: HIT` + đúng body inject (không phải origin) → xác nhận cắt round-trip WS.
- [x] **Dev-first bypass**: onedash không gửi `Cache-Control` trên asset nào → mọi GET `X-Tunelo-Cache: BYPASS`, không cache gì (không stale). Bundle JS 28MB > cap → cũng BYPASS đúng.
- [x] `GET /api/*` + response `application/json` (404 test) → luôn `X-Tunelo-Cache: BYPASS`.
- [x] Request có `Authorization` hoặc response có `Set-Cookie`: không cache (unit test + reviewer xác nhận thứ tự auth-check trước cache).
- [x] SSE/chunked: `response-sink.ts` byte-identical với bản cũ (reviewer xác nhận) → stream không đổi.
- [x] Tắt Valkey → onedash vẫn phục vụ 200, không 5xx; bật lại → active/PONG/dbsize 0 (no-persistence tự sạch).
- [x] Purge on fresh session: unit test + log khởi động cho thấy `purgeSubdomain` được gọi.
- [x] `maxmemory` = 268435456 (256MB), allkeys-lru; RAM/swap `.65` ~không đổi sau deploy (4235/901 vs baseline 4296/894).
- [x] `pnpm test` 77 pass + `pnpm lint` sạch (99 files) + `tsc` build sạch; không `any`, không `console.log`, file ≤ 200 dòng, named export, không barrel. **C1/M1 từ code review đã fix.**

## Rủi ro & rollback

- **Stale với dev: đã loại bỏ từ thiết kế.** Respect-origin thuần → dev-server (`no-cache`) không bao giờ vào cache; chỉ asset origin tự đánh cacheable (thường là build hashed/immutable, tên đổi khi nội dung đổi) mới cache → không có kịch bản trả code cũ cho dev. Trường hợp biên duy nhất (asset non-hashed origin đánh `max-age` dài): đó là max-age origin tự khai + purge-on-restart dọn ngay khi mở tunnel mới.
- **Buffer object để lưu cache làm tăng RSS tạm thời** (≤5MB/object, vài object đồng thời). `max_memory_restart` giữ 500M, theo dõi; hạ `CACHE_MAX_OBJECT_BYTES` nếu cần.
- **Rollback code:** `CACHE_ENABLED=false` (hoặc bỏ `REDIS_URL`) → relay về hành vi hiện tại tức thì, không cần redeploy.
- **Rollback nginx:** khôi phục bản edge-cache từ git (commit `5ed63c7`), hoặc dùng `/etc/nginx/conf.d/tunelo.conf.bak-edgecache-260721-153804` (proxy thuần, buffering off — gần với bản passthrough hiện tại). Luôn `nginx -t` trước `systemctl reload`.
- **Rollback Valkey:** `systemctl disable --now valkey` + gỡ `REDIS_URL`; không có dữ liệu bền để mất (persistence tắt).

## Tham chiếu

- Report tài nguyên: `plans/dattqh/reports/redis-tunelo-resource-assessment-2026-07-24.md`
- Edge-cache Phase 1 (bị thay bởi kiến trúc A): `plans/dattqh/260721-1456-edge-cache-nginx-phase1/plan.md`, commit `5ed63c7`
- Code path: `packages/server/src/request-relay.ts`, `tunnel-manager.ts`, `stream/stream-registry.ts`; helper `packages/shared/src/http-headers.ts`
