# Deploy Localman (localman.hoandat.com)

Localman chạy trên server dùng chung `103.72.98.65` theo quy ước của server đó, giống IdP `auth.hoandat.com`: một process pm2, nginx giữ TLS, không Docker Compose. MongoDB của Localman là một mongod **riêng** (single-node replica set để chạy transaction) ở `127.0.0.1:27018`; mongod chung cổng 27017 của các app khác không bị đụng tới. Quyết định này ghi ở Validation Log "Vòng 24" của `plans/dattqh/261008-1123-localman-core/plan.md`.

Mọi script nằm ở [`infra/localman/`](../infra/localman/); tài liệu này chỉ nêu thứ tự và cách kiểm tra, chi tiết nằm trong comment đầu mỗi script.

## Thành phần

| Thành phần | Vị trí |
|---|---|
| DNS (Cloudflare, zone `hoandat.com`) | `localman` → `103.72.98.65` proxied; `*.localman` → `103.72.98.65` DNS only (Universal SSL miễn phí không phủ wildcard hai cấp) |
| TLS | Let's Encrypt `localman.hoandat.com` + `*.localman.hoandat.com`, gia hạn bằng DNS-01 Cloudflare (`authenticator = dns-cloudflare`, `renew_hook = systemctl reload nginx`) qua [`issue-wildcard-cert.sh`](../infra/localman/issue-wildcard-cert.sh); dùng cho cả host proxied (SSL "full") lẫn wildcard |
| Release | `/opt/localman/releases/<id>/{api,web,nginx}` (id = giờ UTC + commit, thêm `-dirty` nếu cây làm việc có sửa đổi), symlink `/opt/localman/current` trỏ release đang chạy; giữ 5 release gần nhất. Lên release mới: [`activate-release.sh`](../infra/localman/activate-release.sh); đổi qua lại giữa các release: [`switch-release.sh`](../infra/localman/switch-release.sh) |
| nginx | `/etc/nginx/conf.d/localman-http.conf` (zone `limit_req`/`limit_conn`, log che secret) và `/etc/nginx/conf.d/localman.hoandat.com.conf` (CSP mang hash của đúng bản build). Mỗi release có bản conf riêng trong `releases/<id>/nginx/`, `switch-release.sh` cài bản đó cùng lúc với đổi symlink; bản gốc ở [`infra/localman/nginx/`](../infra/localman/nginx/), không chép tay |
| IP client thật | Host proxied dựa vào `set_real_ip_from` (dải Cloudflare) + `real_ip_header CF-Connecting-IP` đã có ở cấp `http` trên server, Localman không lặp lại (`activate-release.sh` cảnh báo nếu thiếu). Host DNS-only `*.localman` không tin header nào (`set_real_ip_from unix:;` trong server block), `$remote_addr` là IP kết nối thật. Site chỉ chuyển `X-Forwarded-For $remote_addr` và `X-Forwarded-Host $host`, API tin proxy `127.0.0.1` (`TRUST_PROXY=127.0.0.1`) |
| `/internal/` | Chỉ cho `103.72.98.65` (IdP trên chính server này, đi qua Cloudflare nên sau real-IP là IPv4 công khai của server), `127.0.0.1`, `::1`; nơi khác nhận 403 |
| `/mcp` | Localman MCP (Streamable HTTP, Bearer token của IdP): `proxy_buffering off` cho SSE, body tối đa 4 MB, `proxy_read_timeout 300s` (Cloudflare vẫn cắt kết nối im lặng sau 100 giây, client MCP tự nối lại). `/.well-known/oauth-protected-resource` (metadata RFC 9728) cũng tới API |
| Cổng nội bộ | API nghe `127.0.0.1` (`HOST=127.0.0.1`) ở 4000 và 4100, mongod-localman `127.0.0.1:27018`; tường lửa chung không mở ba cổng này. `setup-server.sh` chỉ **báo** nếu có cổng nghe ngoài loopback hay firewalld mở chúng, không tự đổi tường lửa |
| Log nginx | Access log format `localman`: che secret trong `/m/{secret}`, token trong `/invite/{token}`, bỏ mọi query string (`code`/`state` của `/auth/callback`, `returnTo` chứa link mời, `?token=`), không ghi host (secret mock) và Referer. Error log của host wildcard, cổng 80 và `location /m/` chỉ ghi mức `crit` vì mỗi dòng lỗi đều nêu host hoặc request; từ chối do `limit_req`/`limit_conn` ghi mức `warn` (không vào error log mức `error`), đếm 429 ở access log |
| Header của web | CSP (hash các script inline, Turnstile ở `script-src`/`frame-src`, `connect-src 'self'`, `form-action 'self' https://auth.hoandat.com` cho đăng xuất, `frame-ancestors 'none'`), `X-Frame-Options: DENY`, HSTS; chặn nhúng khung vì `*.tunnel.hoandat.com` cùng site chứa HTML tuỳ ý |
| Process | pm2 `localman-api` ([`ecosystem.config.cjs`](../infra/localman/ecosystem.config.cjs)), fork, **một instance** (rate limit, quota tháng và cache nằm trong bộ nhớ), chạy dưới user hệ thống `localman` với bản sao Node ở `/opt/localman/runtime/node`, mã ở `/opt/localman/current/api`; dashboard `127.0.0.1:4000`, mock runtime `127.0.0.1:4100` |
| Thư mục | `/opt/localman/{releases,current,infra,runtime,backups}`; `infra/` là bản đồng bộ của `infra/localman/` (script vận hành, ecosystem) |
| Log | pm2 ghi `/var/log/localman/api.{out,err}.log`, chỉ module `pm2-logrotate` của server xoay (logrotate không đụng, để không xoay hai lần; `setup-server.sh` cảnh báo nếu thiếu module). logrotate chỉ xoay `/var/log/localman/backup.log` và log mongod (`maxsize 500M`) |
| Cấu hình | `/opt/localman/.env` (root:localman, 640), mẫu [`.env.production.example`](../infra/localman/.env.production.example); không bao giờ sync từ máy dev |
| Database | systemd `mongod-localman` (sandbox: `ProtectSystem=full`, `ProtectHome`, `PrivateDevices`, `UMask=0077`…), `/etc/mongod-localman.conf`, dữ liệu `/var/lib/mongodb-localman`, log `/var/log/mongodb-localman`, replica set `rs-localman`, cache WiredTiger 0,25 GB; user `localman` chỉ `readWrite` trên db `localman` ([`setup-mongo-localman.sh`](../infra/localman/setup-mongo-localman.sh)) |
| Backup | [`backup-localman-db.sh`](../infra/localman/backup-localman-db.sh), cron 02:45 (`/etc/cron.d/localman-backup`, sau backup IdP 02:30), giữ 14 bản trong `/opt/localman/backups`; lỗi thì bot Localman nhắn `OWNER_TELEGRAM_CHAT_ID` |

## Trạng thái hiện tại

- Chứng chỉ: đã chuyển sang `dns-cloudflare` bằng `certbot reconfigure` ngày 2026-10-09, hết hạn 2027-01-07 (certbot timer gia hạn trước 30 ngày). Token Cloudflare chỉ có quyền DNS Edit trên `hoandat.com`, giới hạn IP `103.72.98.65`, nằm ở `/etc/letsencrypt/cloudflare-localman.ini` (600).
- **Việc còn mở:** backup chỉ nằm trên chính server `.65`. Chưa có đích lưu ngoài server (mất ổ hay mất server là mất cả dữ liệu lẫn backup); cần chọn đích (ví dụ object storage) rồi thêm bước đẩy bản dump.

## Chuẩn bị trước khi deploy

Secret (bản sao ngoài server để trong thư mục iCloud "ENV production" của chủ sở hữu, không vào repo):

- Mật khẩu MongoDB: admin `localman_admin` và app `localman` (chỉ ký tự URL-safe, ví dụ `openssl rand -hex 24`).
- API token Cloudflare chỉ có quyền DNS Edit trên zone `hoandat.com` (cho certbot cấp và gia hạn).
- `OIDC_CLIENT_SECRET` bằng `LOCALMAN_WEB_CLIENT_SECRET` trong `/var/www/hoandat-auth/.env` của IdP.
- Turnstile: site key và secret key của widget cho hostname `localman.hoandat.com`.
- Bot Telegram `@localman_hoandat_bot`: token; chat id của owner cho `OWNER_TELEGRAM_CHAT_ID`.
- VAPID: `npx web-push generate-vapid-keys` (cặp khoá) và `VAPID_SUBJECT` (ví dụ `mailto:admin@hoandat.com`).
- `OWNER_SUBS`: `sub` của tài khoản owner trên IdP.
- `AUDIT_CLIENT_ID`/`AUDIT_CLIENT_SECRET` (bắt buộc): cặp Basic mà IdP dùng để đẩy sự kiện audit (`email.reclaimed` gỡ email IdP đã cấp cho tài khoản khác, `method.unlinked` xoá chat Telegram). Đặt cùng giá trị ở `.env` của IdP kèm `AUDIT_EVENTS_URL=https://localman.hoandat.com/internal/audit-events`. IdP ở production chỉ nhận URL https công khai; đặt `http://127.0.0.1:4000/...` làm IdP không khởi động được.

Trên máy deploy: pnpm 11.9, Node ≥ 22.12, ssh tới server qua alias (`SSH_TARGET`, thêm `SSH_OPTS="-F ssh_config"` nếu khoá để ngoài `~/.ssh`).

## Lần đầu

1. **DNS.** Cloudflare: `localman` (proxied) và `*.localman` (DNS only) trỏ `103.72.98.65`, zone SSL mode "full" (đã có cho IdP). Widget Turnstile cho `localman.hoandat.com`.
2. **Đồng bộ script lên server.** Từ repo: `SSH_TARGET=<alias> bash infra/localman/deploy.sh --infra-only` (chỉ chép `infra/localman/` vào `/opt/localman/infra`).
3. **mongod-localman.** Trên server, với root (mật khẩu đi qua biến môi trường hoặc stdin, không qua argv):
   ```bash
   bash /opt/localman/infra/setup-mongo-localman.sh < /root/localman-mongo-passwords   # dòng 1 admin, dòng 2 app
   shred -u /root/localman-mongo-passwords
   ```
   Script cài unit, tạo keyFile, `rs.initiate` với `127.0.0.1:27018` qua localhost exception, tạo user admin rồi user `localman`. Chạy lại có mật khẩu thì đồng bộ cấu hình và **đặt lại** mật khẩu (dùng đúng mật khẩu cũ, nếu không phải sửa `MONGO_URI`); chỉ cần áp cấu hình hay unit mới thì dùng `--config-only` (không cần mật khẩu, mongod restart nếu có thay đổi). Kiểm: `systemctl status mongod-localman`, `ss -ltnp | grep 27018` chỉ thấy `127.0.0.1`.
4. **Server.** `bash /opt/localman/infra/setup-server.sh`: tạo user `localman`, thư mục, bản sao Node cho user đó, logrotate, cron backup, `pm2 startup` nếu chưa có, và `/opt/localman/.env` từ mẫu với `SESSION_ENCRYPTION_KEY` mới (không ghi đè nếu đã có). Mỗi lần deploy, `activate-release.sh` chạy lại script này.
5. **Chứng chỉ.** `bash /opt/localman/infra/issue-wildcard-cert.sh < /root/cloudflare-token` rồi `shred -u` file token. Chưa có chứng chỉ thì script cấp mới bằng `dns-cloudflare`. Đã có nhưng cấp cách khác thì script `certbot reconfigure` sang `dns-cloudflare` (có thử gia hạn với staging). Thiếu hook reload nginx thì script thêm vào. Kiểm: `certbot renew --dry-run --cert-name localman.hoandat.com`.
6. **nginx.** Không chép tay: mỗi lần deploy, `switch-release.sh` cài conf của release, chạy `nginx -t`, giữ bản cũ nếu lỗi, rồi reload. Trước lần deploy đầu, kiểm trên server:
   - `nginx -T 2>/dev/null | grep -E 'set_real_ip_from|real_ip_header'` có dải IP Cloudflare và `real_ip_header CF-Connecting-IP` ở cấp `http` (nếu không, mọi người dùng chung rate limit của một IP edge Cloudflare, và `/internal/` từ chối IdP). Nếu thiếu, thêm một lần ở cấp `http` cho cả server (dải IP lấy từ `https://www.cloudflare.com/ips-v4` và `ips-v6`); đây là cấu hình chung với IdP nên báo user trước.
   - SELinux enforcing: `getsebool httpd_can_network_connect` phải `on` (setup-server cảnh báo nếu tắt); `web/` của mọi release mang nhãn `httpd_sys_content_t` (setup-server khai, activate-release `restorecon`).
7. **Env.** `HOST=127.0.0.1` có sẵn trong mẫu (file cũ thiếu thì `setup-server.sh` thêm vào). Điền `/opt/localman/.env` theo mẫu: `MONGO_URI` (mật khẩu app ở bước 3), `OIDC_CLIENT_SECRET`, `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`, `TELEGRAM_BOT_TOKEN`, `OWNER_TELEGRAM_CHAT_ID`, `OWNER_SUBS`, bộ VAPID, `AUDIT_CLIENT_ID`/`AUDIT_CLIENT_SECRET`. Biến thiếu hoặc sai thì API dừng ngay khi khởi động và log tên biến (không in giá trị).
8. **Deploy.** `SSH_TARGET=<alias> bash infra/localman/deploy.sh` (xem mục dưới).
9. **Telegram.** Bot của Localman chỉ **gửi** tin (API không có route webhook, nên không có `setWebhook` hay `TELEGRAM_WEBHOOK_SECRET`). Owner mở `@localman_hoandat_bot` và bấm Start để bot được phép nhắn; user nhận thông báo cũng phải Start bot (chat id lấy từ IdP). Kiểm token mà không để lộ qua argv:
   ```bash
   read -rs TOKEN && printf 'url = "https://api.telegram.org/bot%s/getMe"\n' "$TOKEN" | curl -s --config -; unset TOKEN
   ```
   Lấy chat id của owner: thay `getMe` bằng `getUpdates` sau khi owner nhắn bot, đọc `message.chat.id`.

   `curl` thành công chưa chứng minh Node gửi được. Trên .65, IPv6 tới `api.telegram.org` không đi được còn IPv4 mất khoảng 290 ms để kết nối (đo 09/10/2026). Ngưỡng happy-eyeballs mặc định của Node là 250 ms, nên với mặc định đó `fetch` báo `ETIMEDOUT` khoảng 2/3 số lần. Vì vậy `main.ts` của API (và `server.ts` của IdP) nâng ngưỡng lên 1000 ms. Để kiểm bằng chính Node của release, chạy `getMe` vài lần bằng `/opt/localman/runtime/node -e 'fetch(...)'`; mọi lần phải trả `ok`.
10. **Backup.** Cron đã cài ở bước 4. Chạy thử một lần: `bash /opt/localman/infra/backup-localman-db.sh` rồi `ls -l /opt/localman/backups`. Khi lỗi, script nhắn owner qua bot Localman (`TELEGRAM_BOT_TOKEN`, `OWNER_TELEGRAM_CHAT_ID` trong `.env`), nên bước 9 phải xong trước.

## Các lần sau

```bash
SSH_TARGET=<alias> [SSH_OPTS="-F ssh_config"] [VITE_FEATURES=...] bash infra/localman/deploy.sh
```

[`deploy.sh`](../infra/localman/deploy.sh) chạy ở máy:

1. Build `@localman/api` và `@localman/web`; cố định `VITE_*` để `.env.local` của dev không lọt vào bản production.
2. Dựng `package.json` và `pnpm-lock.yaml` runtime: `pnpm --filter @localman/api deploy --prod` cho phiên bản đã khoá theo lockfile của workspace, [`runtime-manifest.mjs`](../infra/localman/runtime-manifest.mjs) bỏ package `@localman/*` (đã bundle), `pnpm install --lockfile-only` tỉa lockfile mà giữ nguyên mọi phiên bản, rồi kiểm lại bằng `--frozen-lockfile`.
3. Điền vào CSP hash các script inline của `apps/web/dist/index.html` ([`csp-hashes.mjs`](../infra/localman/csp-hashes.mjs)).
4. rsync `-rlptz` (openrsync của macOS không có `--chown`; file thuộc root) `infra/localman` và thư mục release mới lên server.
5. Gọi `activate-release.sh` trên server:
   - `setup-server.sh`;
   - `pnpm install --prod --frozen-lockfile` trong release;
   - mang asset web của release trước sang bằng hard link (asset quá 14 ngày bị bỏ), để tab mở trước khi deploy vẫn tải được chunk cũ;
   - kiểm real-IP;
   - `switch-release.sh`: cài nginx conf của release và `nginx -t`, đổi symlink nguyên tử, reload nginx, `pm2 reload`, đợi `/healthz` của `:4000` và `:4100` báo `"db":"connected"` rồi gọi thử qua nginx;
   - lỗi ở bước nào thì tự trỏ lại release trước (conf nginx, symlink, pm2) và thoát 1;
   - xoá release cũ, giữ 5 bản.

`ecosystem.config.cjs` đổi thì `switch-release.sh` tự `pm2 delete` + `pm2 start` (reload không áp dụng `script`/`args` mới); nó nhận ra nhờ hash lưu ở `/opt/localman/.ecosystem.sha256`.

**Chuyển từ bố cục cũ** (`/opt/localman/{api,web}`): lần deploy đầu theo bố cục release không có release trước để quay về. Nếu lần đó lỗi, sửa rồi deploy lại. Sau khi chạy ổn, xoá `/opt/localman/api` và `/opt/localman/web`. Nếu SELinux enforcing, xoá thêm luật nhãn cũ: `semanage fcontext -d '/opt/localman/web(/.*)?'`.

## Kiểm tra sau deploy

```bash
curl -fsS https://localman.hoandat.com/ -o /dev/null -w '%{http_code}\n'           # 200
curl -sI https://localman.hoandat.com/ | grep -i content-security-policy            # có 3 sha256
curl -fsS "https://{secret}.localman.hoandat.com{prefix}/users"                     # dữ liệu mock
curl -fsS "https://localman.hoandat.com/m/{secret}{prefix}/users"                   # cùng dữ liệu qua /m/
curl -s -o /dev/null -w '%{http_code}\n' https://www.localman.hoandat.com/          # 404 (tên dành riêng)
curl -s -o /dev/null -w '%{http_code}\n' -X POST https://localman.hoandat.com/internal/audit-events   # 403 từ máy ngoài
MOCK_URL="https://{secret}.localman.hoandat.com{prefix}/users"
seq 1 100 | xargs -P 20 -I % curl -s -o /dev/null -w '%{http_code}\n' "$MOCK_URL" | sort | uniq -c   # có 429
```

- Release: `readlink /opt/localman/current`, `ls /opt/localman/releases`.
- Cổng nội bộ đóng từ ngoài (chạy ở máy khác, phải báo lỗi hoặc timeout): `for p in 4000 4100 27018; do nc -vz -w 3 103.72.98.65 $p; done`. Trên server: `ss -ltnp | grep -E ':(4000|4100|27018) '` chỉ thấy `127.0.0.1`.
- Log không lộ token hay secret (cả access và error log; secret mock nằm trong host nên cũng tìm theo tên miền):
  ```bash
  grep -E '/invite/[^\[]|\?[^\[]' /var/log/nginx/localman*.access.log          # không ra dòng nào
  grep -cE '[a-z0-9-]+\.localman\.hoandat\.com|/m/[^\[ ]|/invite/' /var/log/nginx/localman*.error.log   # 0 với dòng ghi sau deploy
  ```
  Dòng ghi trước khi bật `crit` vẫn còn trong `localman-mock.error.log` cũ; xoá file đó (`truncate -s 0`) sau khi chuyển.
- Trình duyệt: mở `/`, `/docs` và form góp ý (Turnstile hiện), console không có lỗi CSP; đăng nhập và đăng xuất qua IdP.
- Server: `pm2 status localman-api`, `pm2 logs localman-api --lines 50 --nostream`, `tail /var/log/nginx/localman-mock.access.log` (đường dẫn `/m/` hiện `[secret]`).
- 429 `RATE_LIMITED` của form công khai sau khi mở form: theo dõi để chỉnh `feedbackRateLimit.perIp` nếu người dùng sau CGNAT bị chặn nhầm.

## Dọn project bỏ hoang

Bundle có thêm `api/cleanup-abandoned-projects.mjs`: project của chủ gói Free không có request mock trong N ngày (mặc định 90). Chạy bằng cùng Node, cùng user và cùng env file với pm2, **luôn dry-run trước**, đọc danh sách trong log, rồi mới `--apply`. Không có cron tự xoá.

```bash
cd /opt/localman/current/api
runuser -u localman -- /opt/localman/runtime/node --env-file=/opt/localman/.env cleanup-abandoned-projects.mjs --days 90          # dry-run
runuser -u localman -- /opt/localman/runtime/node --env-file=/opt/localman/.env cleanup-abandoned-projects.mjs --days 90 --apply  # xoá
```

Mã thoát: 0 xong, 1 có project xoá lỗi hoặc lỗi chạy, 2 sai tham số hoặc env. Nên chạy backup ngay trước `--apply`.

## Xoay token Cloudflare

1. Tạo token mới trên Cloudflare: quyền Zone:DNS:Edit, chỉ zone `hoandat.com`, giới hạn IP `103.72.98.65`.
2. Trên server: `bash /opt/localman/infra/issue-wildcard-cert.sh --replace-token < /root/cloudflare-token`, rồi `shred -u /root/cloudflare-token`.
3. `certbot renew --dry-run --cert-name localman.hoandat.com` phải thành công với token mới.
4. Xoá token cũ trên Cloudflare, cập nhật bản sao trong iCloud.

## Rollback

- Code: đổi symlink về một release còn giữ (tối đa 5 bản). Script cài lại nginx conf của release đó (CSP khớp `index.html` của nó), đổi symlink, reload nginx và pm2, kiểm health:
  ```bash
  ls /opt/localman/releases
  bash /opt/localman/infra/switch-release.sh <release-id>
  ```
  Release cũ hơn 5 bản: checkout commit đó rồi chạy lại `deploy.sh`. Rollback code không đảo ngược thay đổi dữ liệu; nếu cần, khôi phục database (dưới đây).
- Gỡ site: `pm2 delete localman-api && pm2 save`, xoá hai file `localman*.conf` trong `/etc/nginx/conf.d/`, `nginx -t`, `systemctl reload nginx`.
- Database: `mongod-localman` độc lập với mongod chung. Khôi phục từ backup bằng user `localman`. Dừng API trước để không có lượt ghi xen giữa, đọc URI như `backup-localman-db.sh` (bỏ dấu nháy kép bao quanh; URI nằm trong file cấu hình, không qua argv):
  ```bash
  pm2 stop localman-api
  cd /opt/localman && umask 077
  URI="$(sed -n 's/^MONGO_URI=//p' .env | tail -n 1)"; URI="${URI#\"}"; URI="${URI%\"}"
  printf 'uri: "%s"\n' "$URI" > /root/localman-restore.yaml; unset URI
  mongorestore --config=/root/localman-restore.yaml --gzip --archive=backups/localman-<stamp>.archive.gz --nsInclude='localman.*' --drop
  rm -f /root/localman-restore.yaml
  pm2 start localman-api
  ```
- Dừng hẳn database: `systemctl disable --now mongod-localman` (dữ liệu vẫn ở `/var/lib/mongodb-localman`).
