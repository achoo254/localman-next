# Edge cache Phase 1 — bật nginx proxy_cache trước Node relay

**Trạng thái (23/10/2026):** superseded bởi `260724-1332-redis-response-cache` (cache trong Node relay); `infra/tunelo/nginx.conf` không dùng `proxy_cache`.

**Tier:** S–M (2 file chạm: `infra/nginx.conf` + `packages/shared/src/http-headers.ts`; 1 file sửa nhỏ `request-relay.ts`). Không migration, không breaking contract.

**Mục tiêu:** Cache các response tĩnh cacheable ngay tại nginx trên VPS tunnel (.65), để reload trang / nhiều user cùng tunnel không phải round-trip qua WS xuống máy client. Tôn trọng `Cache-Control` của origin, cô lập tenant bằng cache key có `$host`, và **không phá** SSE/chunked streaming đã ship (commit `9cb33bc`, `b20c5cc`).

## Vì sao (why)

- Chi phí lớn nhất khi tải asset qua tunnel là chặng `nginx → Node relay → WS → máy client → local app`. Cache tại nginx cắt được chặng này cho các response tĩnh lặp lại.
- .65 đã có nginx đứng trước Node relay (`nginx.conf:28`, `location /` → `127.0.0.1:3001`) → không cần dựng box mới. Đây là nơi đặt cache đúng và rẻ nhất.
- Cloudflare Tunnel "có cache" là vì tunnel đổ vào edge/CDN của họ; bản thân relay không cache. Phase 1 tái tạo đúng tầng đó ở quy mô 1 VPS, chỉ với phần an toàn nhất.

## Bối cảnh kỹ thuật (đã verify trong code)

- **Không có tầng cache nào** trong data path hiện tại: `nginx.conf:47` để `proxy_buffering off`, không có `proxy_cache`; relay (`request-relay.ts`) và client (`http-stream.ts`) đều passthrough.
- Header được forward transparent 2 chiều, chỉ strip hop-by-hop (`shared/src/http-headers.ts`). `Cache-Control`/`ETag`/`Last-Modified` và `If-None-Match`/`If-Modified-Since` đi xuyên qua → browser cache + 304 đã hoạt động sẵn; nginx cache là lớp bổ sung.
- **Routing server** (`server.ts:27-37`): `/api/*` (device pairing + `GET /api/verify` mang Bearer), `/login`, và `/health` (`request-relay.ts:89`) chạy trên apex `tunnel.inetdev.io.vn` **cùng `location /`**. Traffic tenant đi qua wildcard `*.tunnel...`.
- **Điểm ghi response ra HTTP**: `createResponseSink.onStart` (`request-relay.ts:44`) — nơi `res.writeHead(status, headers)`.
- **WS**: control channel + browser WS (ws-app-relay) đều đi qua HTTP Upgrade → nginx tự bypass buffering/cache khi có `Upgrade`.

## Kiến trúc phase 1

```
Browser → nginx (proxy_cache, key=$scheme://$host$uri) → Node relay :3001 → WS → client → local app
                    │
       HIT static cacheable → trả thẳng, KHÔNG đi tiếp xuống WS
       SSE / no content-length → origin gắn X-Accel-Buffering:no → nginx tắt buffering + KHÔNG cache
       /api, /login, /health, WS upgrade → bypass cache
```

Nguyên tắc an toàn:
- **Chỉ cache `GET`/`HEAD`** (mặc định nginx).
- **Tôn trọng origin**: giữ hành vi mặc định của nginx — response có `Set-Cookie`, `Cache-Control: private/no-store/no-cache` sẽ **không** được cache. KHÔNG dùng `proxy_cache_valid` blanket cho 200, KHÔNG `proxy_ignore_headers Cache-Control` (đó là phase 3).
- **Cache key có `$host`** để hai subdomain khác nhau không đụng nhau.

## Thay đổi

### 1. `packages/shared/src/http-headers.ts` — thêm helper nhận diện streaming
Đặt ở đây (không đặt trong `request-relay.ts`) vì file relay đã 190 dòng, sát cap 200; và helper là tiện ích header dùng chung, có thể tái dùng ở client sau này.

```ts
/**
 * Response cần relay không-buffer (real-time): SSE, hoặc thân không có
 * content-length (chunked / streaming độ dài chưa biết). Dùng để gắn
 * `X-Accel-Buffering: no` cho nginx: tắt buffering + không cache đúng
 * những response này, giữ static (có content-length) vẫn cache được.
 */
export function needsUnbufferedRelay(
	headers: Record<string, string | string[]>,
): boolean {
	let contentType = "";
	let hasContentLength = false;
	for (const [key, value] of Object.entries(headers)) {
		const lower = key.toLowerCase();
		if (lower === "content-type")
			contentType = Array.isArray(value) ? value.join(" ") : value;
		if (lower === "content-length") hasContentLength = true;
	}
	return contentType.includes("text/event-stream") || !hasContentLength;
}
```
Export qua `packages/shared/src/index.ts` (repo cấm barrel re-export tùy tiện nhưng shared index là entrypoint hiện có — thêm 1 named export cùng chỗ `stripHopByHopHeaders` đang export).

### 2. `packages/server/src/request-relay.ts` — inject header trong `onStart`
Chỉ sửa nhánh `onStart` (`:44`), không đổi chữ ký/hành vi khác:

```ts
onStart(status, headers) {
	if (res.headersSent || res.writableEnded || res.destroyed) return;
	try {
		const outHeaders = stripHopByHopHeaders(headers);
		if (needsUnbufferedRelay(headers)) outHeaders["x-accel-buffering"] = "no";
		res.writeHead(status, outHeaders as http.OutgoingHttpHeaders);
		res.flushHeaders();
	} catch (err) {
		// ... giữ nguyên nhánh catch hiện tại
	}
}
```
Import `needsUnbufferedRelay` từ `@tunelo/shared`.

### 3. `infra/nginx.conf` — bật cache có kỷ luật

**Cách triển khai thực tế** (khác plan gốc — dùng kế thừa directive cấp `server` thay vì file `.inc`; idiomatic hơn, DRY tương đương, không thêm file/indirection).

`proxy_cache_path` đặt **ngay trong `infra/nginx.conf`** cạnh `map` — file này được include từ `http` block (giống `map` đang chạy được), nên `proxy_cache_path` (cũng http-context) hợp lệ tại đây, KHÔNG cần sửa `/etc/nginx/nginx.conf` riêng:
```nginx
proxy_cache_path /var/cache/nginx/tunelo levels=1:2 keys_zone=tunelo:50m
                 max_size=5g inactive=1h use_temp_path=off;
```

Trong `server { listen 443 ssl; ... }`: đưa các directive proxy chung (`proxy_http_version`, `proxy_set_header` Upgrade/Connection/Host/X-Real-IP/X-Forwarded-*, `proxy_read/send_timeout 86400s`) lên **cấp server** để mọi location kế thừa. Cache **chỉ** khai ở `location /`; control-plane không khai `proxy_cache` nên tự động không cache:
```nginx
# Control-plane: không khai proxy_cache → không cache (Bearer verify, pairing, health)
location /api    { proxy_pass http://127.0.0.1:3001; proxy_buffering off; }
location /login  { proxy_pass http://127.0.0.1:3001; proxy_buffering off; }
location /health { proxy_pass http://127.0.0.1:3001; proxy_buffering off; }

location / {
	proxy_pass http://127.0.0.1:3001;
	proxy_cache tunelo;
	proxy_cache_key "$scheme://$host$request_uri";        # $host = cô lập tenant
	proxy_cache_methods GET HEAD;
	# Bypass WS upgrade VÀ mọi request có Authorization — tunnel dùng `--auth`
	# enforce Basic Auth ở Node relay; cache sẽ phục vụ mà không chạy lại checkAuth.
	proxy_cache_bypass $http_upgrade $http_authorization;
	proxy_no_cache     $http_upgrade $http_authorization;
	proxy_buffering on;                                   # BẮT BUỘC để cache; SSE opt-out qua X-Accel-Buffering
	add_header X-Cache-Status $upstream_cache_status always;
}
```
**Bỏ `proxy_buffering off` global cũ** — chuyển thành `on` ở `location /`. Đánh đổi đã biết: tunnel bật `--auth` sẽ **không** được cache (đúng — nội dung có auth không shared-cache an toàn nếu không key theo credential). Giới hạn nhỏ: path tenant kiểu `/apidocs`/`/loginx` rơi vào location no-cache (prefix rộng hơn segment của Express) → mất cache, không ảnh hưởng đúng/sai.

> Ghi chú ops: file `infra/nginx.conf` trong repo là bản tham chiếu; bản chạy thật ở `/etc/nginx/sites-available/tunelo` trên .65. Cập nhật cả hai cho khớp.

## Các bước thực hiện

1. Thêm `needsUnbufferedRelay` vào `shared/http-headers.ts` + export ở `shared/index.ts`. Viết unit test (co-located `__tests__`): SSE → true, no content-length → true, có content-length + `text/html` → false, header mixed-case → nhận đúng.
2. Sửa `request-relay.ts` `onStart` gọi helper, import từ `@tunelo/shared`. Cập nhật/viết test cho relay nếu có harness sẵn.
3. Cập nhật `infra/nginx.conf`: thêm cache zone (cạnh `map`), đưa directive proxy chung lên cấp `server`, thêm 4 location (cache ở `location /`, bypass WS + Authorization). Cập nhật bản trên .65.
4. `pnpm build` + `pnpm test` + `pnpm lint` sạch trước khi đụng nginx.
5. Trên .65: `mkdir -p /var/cache/nginx/tunelo && chown` cho user nginx; `nginx -t`; `systemctl reload nginx`.
6. Deploy server build mới (relay có header) theo quy trình hiện hành.

## Tiêu chí hoàn thành (acceptance)

- [ ] `needsUnbufferedRelay` có test phủ 4 case trên, pass.
- [ ] `pnpm build && pnpm test && pnpm lint` sạch (0 error, 0 warning chặn).
- [ ] `nginx -t` OK; reload không lỗi.
- [ ] Asset tĩnh (vd `GET /favicon.ico` hoặc `.js` có `Cache-Control`) reload lần 2 → `X-Cache-Status: HIT`, và **không** thấy request tương ứng tới local app (kiểm qua log client/inspector).
- [ ] SSE endpoint (nếu app có) hoặc response chunked → `X-Cache-Status: BYPASS` (do `X-Accel-Buffering: no`) và vẫn stream real-time, không bị gom cục.
- [ ] `GET /api/verify` với 2 Bearer khác nhau → luôn `BYPASS`, không HIT chéo; response đúng theo từng token.
- [ ] Hai subdomain khác nhau cùng path (vd `a.tunnel.../app.js` vs `b.tunnel.../app.js`) → **không** trả nhầm nội dung của nhau (test bằng 2 tunnel local khác nội dung).
- [ ] Tunnel bật `--auth`: request có/không Basic Auth tới cùng URL cacheable → luôn `BYPASS`, không bao giờ phục vụ từ cache khi thiếu credential (không bypass auth).
- [ ] Tunnel WebSocket của app (ws-app-relay) vẫn hoạt động (không bị buffer/cache).

## Rủi ro & giảm thiểu

- **Lộ dữ liệu chéo tenant nếu quên `$host` trong key** → nghiêm trọng nhất. Đã cố định trong config + acceptance test 2-subdomain.
- **Buffering on phá SSE** → xử bằng `X-Accel-Buffering: no` từ origin cho response streaming; acceptance test SSE bắt buộc.
- **Subdomain tái sử dụng → cache cũ của chủ trước** (`a.tunnel` đổi chủ) → phase 1 giảm bằng `inactive=1h` + chỉ cache theo `Cache-Control` origin (TTL ngắn tự nhiên). **Xử triệt để ở phase 2** (purge theo subdomain khi tunnel đóng). Ghi rõ đây là giới hạn đã biết của phase 1.
- **`GET /api/verify` bị cache theo token** → bypass toàn bộ `/api` bằng location riêng.
- **Bypass Basic Auth qua cache** (tunnel `--auth`): response cacheable của URL được bảo vệ bị cache theo key không có Authorization → request sau thiếu credential nhận từ cache, `checkAuth` không chạy. → Vá bằng `proxy_cache_bypass/no_cache $http_authorization` (phát hiện ở code-review). Đánh đổi: tunnel `--auth` không được cache — chấp nhận.
- **Cache không "ăn" vì local app không set `Cache-Control`** → đúng thiết kế phase 1 (an toàn). Force-cache theo extension là **phase 3**, không làm ở đây.

## Rollback

- nginx: khôi phục `location /` cũ (bỏ `proxy_cache`, trả `proxy_buffering off`), `nginx -t` + reload. Cache đứng độc lập nên rollback tầng nginx không cần rollback server.
- server: header `X-Accel-Buffering: no` vô hại khi nginx không bật cache (client bỏ qua) → không bắt buộc revert; revert được bằng deploy build trước nếu muốn sạch.

## Ngoài phạm vi (out of scope — không làm ở phase 1)

- Purge cache theo subdomain khi tunnel đóng → **phase 2**.
- Force-cache theo đuôi file kiểu Cloudflare (`proxy_ignore_headers Cache-Control`) → **phase 3**.
- Tiered cache / nhiều edge / geo-distribution.
- Đổi `MAX_BODY_SIZE` hay chính sách body limit.

## Validation Log

### Verification Results (Session 1)
- Tier: Light (1 phase, Fact Checker).
- Claims checked: 6 | Verified: 6 | Failed: 0 | Unverified: 0.
- Điểm chỉnh: `request-relay.ts` là 190 dòng (không phải 191) — không đổi kết luận đặt helper ở `shared`.
- Xác nhận: `nginx.conf:28-29`, `nginx.conf:47`, `request-relay.ts:44`, `shared/http-headers.ts` (export `stripHopByHopHeaders`; `shared/index.ts` dùng `export *` nên `needsUnbufferedRelay` tự export), `server.ts:27-40` routing + `/health` tại `request-relay.ts:89`, `MAX_BODY_SIZE=50MB`.

### Quyết định (Session 1)
1. **Môi trường rollout:** .65 chỉ staging/test, chưa user thật → **không thêm bước canary**; verify trên staging là đủ. Blast radius ~0.
2. **Cache-Control của app tunnel:** đa số là dev server (Vite/Next…) có sẵn ETag/Cache-Control → **phase-1 có giá trị ngay**, không cần kéo phase-3 lên.
3. **Subdomain tái sử dụng:** giữ `inactive=1h` + dựa `Cache-Control` origin; xử triệt để ở phase-2 (purge khi tunnel đóng). Đây là giới hạn đã biết, chấp nhận vì môi trường staging.

### Whole-Plan Consistency Sweep (Session 1)
- Plan 1 file, không có phase-*.md → không có mâu thuẫn chéo phase.
- 3 quyết định đều trùng thiết kế plan gốc → không phát sinh thay đổi lan truyền.
- Không còn claim `[UNVERIFIED]`, không có thuật ngữ/đường dẫn/contract lỗi thời.
- **Kết luận: 0 mâu thuẫn tồn đọng — plan sẵn sàng implement.**

### Implementation & Code Review (Session 2)
Đã code trong session (chưa deploy .65):
- `shared/http-headers.ts`: thêm `needsUnbufferedRelay` (+6 unit test) — auto-export qua `index.ts`.
- `request-relay.ts` `onStart`: inject `X-Accel-Buffering: no` khi streaming.
- `infra/nginx.conf`: cache zone + kế thừa cấp server + cache ở `location /` (khác plan gốc: dùng inheritance, KHÔNG dùng `.inc`).

Gate: `pnpm build` exit 0; `pnpm test` 27/27 pass; `pnpm lint` (biome, 90 file) 0 lỗi.

Code-review (`code-reviewer`) phát hiện **1 lỗ hổng Critical** đã vá:
- **Bypass Basic Auth qua cache** (tunnel `--auth`): vá bằng `proxy_cache_bypass/no_cache $http_upgrade $http_authorization`. Verified: `cli.ts:32` `--auth`, `tunnel-manager.ts:260` checkAuth là feature thật.
- Nit không chặn (chưa làm, chấp nhận): `location /api|/login|/health` prefix rộng hơn segment của Express (path `/apidocs` mất cache, không sai); chưa có test riêng cho wiring `X-Accel-Buffering` trong `onStart` (helper đã test kỹ, wiring one-liner); `X-Cache-Status` lộ nhẹ info hạ tầng (cần cho verify phase-1, có thể gate sau).

### Deploy lên staging .65 (Session 3) — ĐÃ TRIỂN KHAI
Server `103.72.98.65` (nhãn "SERVER STAGING .65"), shared host nhiều service, config tunelo ở `/etc/nginx/conf.d/tunelo.conf` (include http-context → `proxy_cache_path` đặt trong file này OK). nginx 1.20.1, user `nginx`, Node v22, pm2.

Đã làm:
- Server: `pnpm build:server` → rsync `server.mjs`(+map) vào `/var/www/tunelo` → `pm2 restart tunelo`. Health `{"status":"ok"}`. Backup: `server.mjs.bak-<ts>`.
- nginx: backup `tunelo.conf.bak-edgecache-260721-153804` → upload config mới → tạo `/var/cache/nginx/tunelo` (chown nginx) → `nginx -t` OK → `systemctl reload nginx`.

Verify:
- ✅ Tầng cache engaged: `location /` trả header `X-Cache-Status`; `/health` (control-plane) KHÔNG có → bypass đúng.
- ✅ Không regression: onedash-staging vẫn HTTP 200; không lỗi mới trong nginx error log sau reload.
- ⚠️ **CHƯA quan sát được HIT thật**: tunnel active duy nhất (onedash-staging) **không gửi `Cache-Control`** kể cả asset tĩnh (PNG) → mọi request `MISS`, cache dir rỗng. Đúng hành vi an toàn phase-1, nhưng nghĩa là app này **không hưởng lợi** từ cache → mâu thuẫn với giả định "dev server có sẵn Cache-Control" ở validate. Cơ chế store+HIT chưa được chứng minh end-to-end (cần 1 origin gửi Cache-Control để demo MISS→HIT).
- ⬜ Chưa test: SSE stream, 2-subdomain isolation, `--auth` bypass (cần tunnel/app phù hợp).

Rollback: server `cp server.mjs.bak-<ts> server.mjs && pm2 restart tunelo`; nginx `cp tunelo.conf.bak-edgecache-260721-153804 tunelo.conf && nginx -t && systemctl reload nginx`.

Lưu ý: commit `5ed63c7` mới ở local main, **chưa push** — server build từ local nên đã có thay đổi; máy khác pull sẽ chưa thấy tới khi push.
