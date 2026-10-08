# Phase 03 — Revert tenant cache trong nginx + rollout & verify

**Tier:** M — sửa `infra/nginx.conf`, deploy code (CI/CD), thao tác nginx + verify trên `.65`.

## Vì sao revert nginx

Kiến trúc A đặt cache authority ở Node. Giữ `proxy_cache` ở tenant `location /` sẽ (a) cache cả API tenant nếu app đánh cacheable → **vi phạm "API bypass hoàn toàn"**, và (b) tạo tầng cache thứ 2 stale độc lập với purge của Redis. → tenant `location /` về **passthrough streaming** thuần.

## Thay đổi `infra/nginx.conf`

- **Bỏ** dòng `proxy_cache_path ... keys_zone=tunelo:50m ...` (không còn dùng).
- Trong `location /` (tenant + WS): **bỏ** `proxy_cache tunelo`, `proxy_cache_key`, `proxy_cache_methods`, `proxy_cache_bypass`, `proxy_no_cache`, `add_header X-Cache-Status`; đặt lại `proxy_buffering off` (stream thẳng — Node lo cache).
- **Giữ nguyên**: block `map $http_upgrade`, shared proxy headers, timeout 24h, và 3 location apex `/api` `/login` `/health` (`proxy_buffering off`).
- Kết quả: nginx chỉ còn TLS-terminate + proxy + WS upgrade; **không** cache. `X-Tunelo-Cache` do Node phát là nguồn quan sát HIT/MISS/BYPASS duy nhất.

> Không cần đụng module nginx (stock 1.20.1, không có redis/lua) — chỉ gỡ directive cache.

## Trình tự rollout trên .65

1. **Phase 01 xong** (Valkey chạy, `.env` có `REDIS_URL`).
2. Deploy code phase-02: push `main` → pipeline `build → deploy_staging` (rsync bundle + `pm2 restart`). Hoặc thủ công `bash infra/deploy.sh`.
   - Xác nhận `ioredis` được cài trong bước `pnpm install --prod` trên server.
3. Cập nhật nginx:
   ```bash
   cp /etc/nginx/conf.d/tunelo.conf /etc/nginx/conf.d/tunelo.conf.bak-redisrevert-$(date +%y%m%d-%H%M%S)
   # copy nginx.conf mới từ repo lên /etc/nginx/conf.d/tunelo.conf
   nginx -t && systemctl reload nginx
   ```
4. (Tùy chọn) xóa cache đĩa cũ: `rm -rf /var/cache/nginx/tunelo/*` (không còn dùng).

## Verify (bằng chứng cụ thể — dùng `curl -I` + log relay)

Chạy với 1 tunnel FE thật `app.tunnel.inetdev.io.vn`:

- **HIT asset preview build** (`vite preview`/`next start` — asset hashed + `immutable`): `curl -sI .../assets/index-*.js` 2 lần → lần 2 `x-tunelo-cache: HIT`. Log relay lần 2 **không** có `openStream`/WS request.
- **BYPASS dev server** (`vite dev` — asset `Cache-Control: no-cache`): lặp lại `curl -sI .../src/main.tsx` → luôn `BYPASS`, không bao giờ HIT → sửa file + reload là thấy ngay (không stale).
- **BYPASS API:** `curl -sI https://app.tunnel.inetdev.io.vn/api/health` → luôn `x-tunelo-cache: BYPASS`, không bao giờ HIT dù lặp lại. Kiểm tra thêm 1 endpoint trả `application/json` (kể cả nếu app đánh `Cache-Control: public`).
- **Auth an toàn:** request kèm `-H 'Authorization: Basic ...'` → không HIT, không lưu.
- **SSE:** endpoint `text/event-stream` stream real-time bình thường, không cache, không vỡ.
- **Purge:** tải asset → HIT; restart tunnel client; tải lại → MISS (đã purge) → HIT với nội dung mới.
- **Fail-safe:** `systemctl stop valkey` → site vẫn phục vụ (mọi request BYPASS/MISS, không 5xx); `systemctl start valkey` → cache hoạt động lại.
- **RAM:** sau ~24h, `free -m` + `valkey-cli -a … info memory` (`used_memory` < `maxmemory`), so baseline report; swap không tăng bất thường.

## Cập nhật docs (documentation-management)

- `docs/system-architecture.md`: sơ đồ data path — thêm tầng cache Node+Valkey, nêu nginx không còn cache tenant.
- `docs/deployment-guide.md`: mục cài Valkey + biến `REDIS_URL`/`CACHE_*` (đã thêm ở phase-02) + bước nginx revert.
- Đánh dấu `plans/dattqh/260721-1456-edge-cache-nginx-phase1/plan.md` là **superseded** bởi plan này (1 dòng note đầu file).

## Commit (conventional, có "why", không ref mã plan)

- `feat(server): cache relayed FE responses in Valkey, bypass API` — body nêu: cắt round-trip WS cho asset tĩnh, API/JSON/authed/SSE bypass, best-effort fail-safe, purge theo subdomain khi tunnel mở phiên mới.
- `refactor(infra): drop nginx tenant proxy_cache; Node relay owns caching` — body nêu lý do (guarantee API-bypass + purge ở 1 chỗ; stock nginx thiếu module redis).
