---
status: completed
tier: S
created: 2026-10-16
from: hoandat-auth (bàn giao)
---

# Block tenant của Localman và Tunelo tự khai real-IP

## Bối cảnh

- Cổng 80 của mọi host tenant (`tenants-acme.conf`, repo hoandat-auth) chuyển lưu lượng Cloudflare
  Flexible tới block 443 của chính host qua `https://127.0.0.1:443`, kèm `CF-Connecting-IP` là IP thật.
- Để block 443 thấy IP thật, hoandat-auth đang khai `set_real_ip_from 127.0.0.1;` ở **cấp http**
  (`/etc/nginx/conf.d/00-tenants-http.conf`). Ở cấp http, mọi tiến trình trên .65 gửi tới nginx qua
  loopback kèm `CF-Connecting-IP` đều đặt được IP client cho **mọi app** trên máy.
- Đã chuyển xuống cấp server (16/10/2026): `chat.tenants.conf` (chat-next) và `tenant-auth.conf`
  (hoandat-auth). Danh sách cấp server thay hẳn danh sách kế thừa từ cấp http.
- Còn dựa vào dòng cấp http: block chính trong `infra/localman/nginx/localman-tenants.conf` và
  `infra/tunelo/nginx-tenants.conf`.

## Việc cần làm

1. Trong từng block 443 tenant **trừ block mock** (block mock cố ý `set_real_ip_from unix:;`, không
   tin header nào), thêm ở cấp server:
   - `real_ip_header CF-Connecting-IP;` và `real_ip_recursive on;`
   - `set_real_ip_from 127.0.0.1;`
   - `set_real_ip_from` cho các dải Cloudflare IPv4 và IPv6, cùng danh sách với
     `hoandat-auth/src/tenants/cloudflare-ips.ts` (https://www.cloudflare.com/ips-v4, ips-v6).
     Mẫu: `hoandat-auth/infra/nginx/tenant-auth.conf`.
2. Nếu repo có test giữ danh sách dải IP (như `cloudflare-ips.test.ts` bên hoandat-auth), thêm kiểm tra tương tự.
3. Prod (.65, user duyệt): backup conf, `nginx -t`, reload; kiểm IP thật trong access log của
   localman/tunelo tenant và các host đang chạy.
4. Nhắn phiên hoandat-auth: lúc đó mới bỏ dòng `set_real_ip_from 127.0.0.1;` cấp http trong
   `00-tenants-http.conf` (ADR 0006 của hoandat-auth ghi việc còn mở này).

## Rủi ro

Hiện không tenant nào để host localman/tunnel Proxied (wildcard hai cấp cần chứng chỉ edge trả phí), nên
thiếu bước 1 chưa làm sai IP của ai; bỏ dòng cấp http trước bước 1 thì lưu lượng Flexible tới các block
này sẽ thấy IP `127.0.0.1`.

## Kết quả (23/10/2026)

- Repo: `80efb07` thêm real-IP cấp server vào block `localman.<tenant>` và block tunnel tenant; block mock giữ
  `set_real_ip_from unix:;`, block `www|api|app|admin|mail` chỉ trả 404 không log nên không cần. Test
  `scripts/nginx-real-ip` giữ danh sách bằng với `auth-next/src/tenants/cloudflare-ips.ts`.
- auth-next `e5c10a4` bỏ `set_real_ip_from 127.0.0.1` cấp http trong `tenants-http.conf`, kèm test chặn thêm lại.
- Prod .65, 06:09–06:10: cài `localman-tenants.conf` (vá đúng khối này vào bản đang chạy để giữ hash CSP, đối chiếu
  bằng với repo), `tunelo-tenants.conf`, rồi `00-tenants-http.conf`; mỗi file có bản `.bak-261023-0609xx`/`-061004`,
  `nginx -t` đạt trước mỗi reload.
- Kiểm: request qua loopback kèm `CF-Connecting-IP` giả vẫn cho IP gửi kèm ở block tenant localman, tunnel, auth
  (đúng cho Flexible); ở `auth.hoandat.com` và `miu.hoandat.com` giờ log `127.0.0.1` (trước đó nhận IP giả).
  Request thật qua Cloudflare vẫn log IP thật. localman, tunnel, auth, chat, scribe, miu đều 200.
- Lùi: chép lại các bản `.bak-261023-*` trong `/etc/nginx/conf.d/`, `nginx -t`, reload.
