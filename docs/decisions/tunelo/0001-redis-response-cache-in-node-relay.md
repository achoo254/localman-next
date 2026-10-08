# ADR-0001: Response-cache đặt trong Node relay (Valkey), respect-origin dev-first

- **Ngày:** 2026-07-24
- **Trạng thái:** Đã chốt
- **Người quyết định:** dattqh

## Bối cảnh

Tải asset qua tunnel phải đi chặng `nginx → Node relay → WS → máy client → local app`; reload trang lặp lại toàn bộ chặng này. Trước đó đã bật một tầng cache ở nginx (`proxy_cache`, commit `5ed63c7`). Khi cần cache "chủ yếu cho app FE, còn API bỏ qua hoàn toàn" thì lộ ra hai ràng buộc thực tế trên staging `.65`:

- Yêu cầu "API bypass hoàn toàn" **không** thỏa ở tầng nginx cũ: API của tenant (`app.tunnel.../api/...`) đi qua `location /`, nếu app đánh `Cache-Control: public` thì nginx vẫn cache.
- nginx trên `.65` là **stock 1.20.1, không có module redis/srcache/lua**, lại đang front nhiều service prod khác → không thể dùng Redis làm backend cache cho nginx nếu không thay bằng OpenResty (rủi ro cao).
- **tunelo chủ yếu dùng để dev/preview/demo**, không phục vụ production traffic. Với công cụ dev, freshness quan trọng hơn hit-rate: tuyệt đối không được trả asset cũ cho người đang sửa code.
- RAM `.65` mỏng (từng cạn RAM) → cache phải bounded, không persistence.

## Quyết định

Đặt cache **trong Node relay**, backed bởi **Valkey** ở `127.0.0.1:6379`, làm cache authority **duy nhất** cho traffic tenant. Revert tenant `location /` của nginx về passthrough. Asset tĩnh FE được cache khi **một trong hai** điều kiện an toàn đúng: (1) origin tự tuyên bố cacheable (`Cache-Control` max-age/immutable), hoặc (2) tên file **content-hashed** (vd `index-DqxaS-SZ.js`) — content-addressed nên đổi nội dung là đổi tên, không thể trả stale. Opt-out cứng (`no-store`/`private`/`max-age=0`) luôn được tôn trọng. **Không** force-cache theo TTL bịa cho file non-hashed.

## Lý do (tại sao)

- **Một chỗ quyết định, test được:** phân loại FE/API + guarantee "API bypass hoàn toàn" + purge nằm trong TypeScript, có unit test, thay vì rải giữa regex nginx và code Node dễ lệch.
- **An toàn tuyệt đối cho dev:** dev-server (Vite/Next dev) phục vụ source non-hashed kèm `no-cache` → không bao giờ vào cache → sửa code là thấy ngay. Chỉ hai loại an toàn mới cache: origin tự khai cacheable, hoặc asset content-hashed (đổi nội dung = đổi tên → không stale). Không có TTL bịa cho file non-hashed.
- **Auto-cache hashed để "just work" mà không đụng app:** build prod/preview (Vite/webpack/Next) ra asset hashed nhưng nhiều server tĩnh không gắn `Cache-Control`. Nhận diện hash qua tên file cho cache chạy ngay mà vẫn không thể stale — thay vì bắt user cấu hình header phía app.
- **Purge theo subdomain:** khi tunnel mở phiên mới, xóa cache của subdomain đó (best-effort, fire-and-forget) → restart app gần như luôn thấy asset mới. Asset content-hashed vốn luôn tươi (URL đổi); asset non-hashed có cửa sổ race dưới 1 giây có thể trả bản cũ một lần trước khi purge xong — chấp nhận được với công cụ dev. Stock nginx không purge theo subdomain được.
- **Không cần đổi hạ tầng nginx** (thiếu module redis, front nhiều service prod).
- Cắt được chặng đắt nhất `WS → máy client` cho asset lặp lại — đúng động lực ban đầu của tầng cache.

## Đánh đổi & hệ quả

- **Được:** guarantee API-bypass mạnh; dev không bao giờ thấy code cũ; purge theo subdomain; cache bounded, best-effort (Valkey chết thì relay vẫn chạy, chỉ mất cache).
- **Mất:** bỏ "edge-offload" của nginx (HIT giờ đi qua Node) — chấp nhận được vì tunelo là dev tool, traffic mỗi tunnel thấp. Node buffer object cacheable tạm thời (cap 5MB/object) → RSS tăng nhẹ.
- **Ảnh hưởng:** `request-relay.ts` (lookup + tee sink), `tunnel-manager.ts` (purge khi register phiên mới), `infra/tunelo/nginx.conf` (tenant passthrough), thêm service Valkey + biến `REDIS_URL`/`CACHE_*`. Thay thế tầng edge-cache nginx (commit `5ed63c7`).

## Phương án đã cân nhắc

- **Hai tầng (giữ nginx edge + thêm Redis):** loại vì logic FE/API phải đồng bộ ở 2 chỗ (regex nginx + Node) dễ lệch, và nginx vẫn stale độc lập với purge của Redis.
- **Chỉ nginx (không Redis):** loại vì stock nginx không purge được theo subdomain, và không tái dùng được `REDIS_URL` cho rate-limit tương lai.
- **Force micro-cache (TTL 60s cho MỌI response no-cache, kể cả non-hashed):** loại vì trả code cũ ≤60s cho dev đang sửa — sai lầm tệ nhất với công cụ dev. (Khác với auto-cache hashed đã chọn: hashed là content-addressed nên không thể stale, không phải đoán TTL.)
