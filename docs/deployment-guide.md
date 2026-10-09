# Deploy Localman (localman.hoandat.com)

Localman chạy trên server dùng chung `103.72.98.65` theo quy ước của server đó, giống IdP `auth.hoandat.com`: một process pm2, nginx giữ TLS, không Docker Compose. MongoDB của Localman là một mongod **riêng** (single-node replica set để chạy transaction) ở `127.0.0.1:27018`; mongod chung cổng 27017 của các app khác không bị đụng tới. Quyết định này ghi ở Validation Log "Vòng 24" của `plans/dattqh/261008-1123-localman-core/plan.md`.

Mọi script nằm ở [`infra/localman/`](../infra/localman/); tài liệu này chỉ nêu thứ tự và cách kiểm tra, chi tiết nằm trong comment đầu mỗi script.

## Thành phần

| Thành phần | Vị trí |
|---|---|
| DNS (Cloudflare, zone `hoandat.com`) | `localman` → `103.72.98.65` proxied; `*.localman` → `103.72.98.65` DNS only (Universal SSL miễn phí không phủ wildcard hai cấp) |
| TLS | Let's Encrypt `localman.hoandat.com` + `*.localman.hoandat.com` cấp bằng DNS-01 Cloudflare ([`issue-wildcard-cert.sh`](../infra/localman/issue-wildcard-cert.sh)); dùng cho cả host proxied (SSL "full") lẫn wildcard |
| nginx | `/etc/nginx/conf.d/localman-http.conf` (zone `limit_req`/`limit_conn`, log che secret) và `/etc/nginx/conf.d/localman.hoandat.com.conf` (CSP điền hash lúc deploy); bản gốc ở [`infra/localman/nginx/`](../infra/localman/nginx/), do `deploy.sh` cài |
| IP client thật | Host proxied dựa vào `set_real_ip_from` (dải Cloudflare) + `real_ip_header CF-Connecting-IP` đã có ở cấp `http` trên server, Localman không lặp lại (`deploy.sh` cảnh báo nếu thiếu). Host DNS-only `*.localman` không tin header nào (`set_real_ip_from unix:;` trong server block), `$remote_addr` là IP kết nối thật. Site chỉ chuyển `X-Forwarded-For $remote_addr` và `X-Forwarded-Host $host`, API tin proxy `127.0.0.1` (`TRUST_PROXY=127.0.0.1`) |
| Cổng nội bộ | API nghe `127.0.0.1` (`HOST=127.0.0.1`) ở 4000 và 4100, mongod-localman `127.0.0.1:27018`; tường lửa chung không mở ba cổng này. `setup-server.sh` chỉ **báo** nếu có cổng nghe ngoài loopback hay firewalld mở chúng, không tự đổi tường lửa |
| Access log nginx | Format `localman`: che secret trong `/m/{secret}`, token trong `/invite/{token}`, bỏ mọi query string (`code`/`state` của `/auth/callback`, `returnTo` chứa link mời, `?token=`), không ghi host (secret mock) và Referer |
| Header của web | CSP (hash các script inline, Turnstile ở `script-src`/`frame-src`, `connect-src 'self'`, `form-action 'self' https://auth.hoandat.com` cho đăng xuất, `frame-ancestors 'none'`), `X-Frame-Options: DENY`, HSTS; chặn nhúng khung vì `*.tunnel.hoandat.com` cùng site chứa HTML tuỳ ý |
| Process | pm2 `localman-api` ([`ecosystem.config.cjs`](../infra/localman/ecosystem.config.cjs)), fork, **một instance** (rate limit, quota tháng và cache nằm trong bộ nhớ), chạy dưới user hệ thống `localman`; dashboard `127.0.0.1:4000`, mock runtime `127.0.0.1:4100` |
| Thư mục app | `/opt/localman/{api,web,infra,runtime,backups}`; log pm2 `/var/log/localman/` (logrotate 14 ngày) |
| Cấu hình | `/opt/localman/.env` (root:localman, 640), mẫu [`.env.production.example`](../infra/localman/.env.production.example); không bao giờ sync từ máy dev |
| Database | systemd `mongod-localman`, `/etc/mongod-localman.conf`, dữ liệu `/var/lib/mongodb-localman`, log `/var/log/mongodb-localman`, replica set `rs-localman`, cache WiredTiger 0,25 GB; user `localman` chỉ `readWrite` trên db `localman` ([`setup-mongo-localman.sh`](../infra/localman/setup-mongo-localman.sh)) |
| Backup | [`backup-localman-db.sh`](../infra/localman/backup-localman-db.sh), cron 02:45 (`/etc/cron.d/localman-backup`, sau backup IdP 02:30), giữ 14 bản trong `/opt/localman/backups` |

## Chuẩn bị trước khi deploy

Secret (bản sao ngoài server để trong thư mục iCloud "ENV production" của chủ sở hữu, không vào repo):

- Mật khẩu MongoDB: admin `localman_admin` và app `localman` (chỉ ký tự URL-safe, ví dụ `openssl rand -hex 24`).
- API token Cloudflare chỉ có quyền DNS Edit trên zone `hoandat.com` (cho certbot cấp và gia hạn).
- `OIDC_CLIENT_SECRET` bằng `LOCALMAN_WEB_CLIENT_SECRET` trong `/var/www/hoandat-auth/.env` của IdP.
- Turnstile: site key và secret key của widget cho hostname `localman.hoandat.com`.
- Bot Telegram `@localman_hoandat_bot`: token; chat id của owner cho `OWNER_TELEGRAM_CHAT_ID`.
- VAPID: `npx web-push generate-vapid-keys` (cặp khoá) và `VAPID_SUBJECT` (ví dụ `mailto:admin@hoandat.com`).
- `OWNER_SUBS`: `sub` của tài khoản owner trên IdP.
- Tuỳ chọn: `AUDIT_CLIENT_ID`/`AUDIT_CLIENT_SECRET` nếu bật audit từ IdP.

Trên máy deploy: pnpm 11.9, Node ≥ 22.12, ssh tới server qua alias (`SSH_TARGET`, thêm `SSH_OPTS="-F ssh_config"` nếu khoá để ngoài `~/.ssh`).

## Lần đầu

1. **DNS.** Cloudflare: `localman` (proxied) và `*.localman` (DNS only) trỏ `103.72.98.65`, zone SSL mode "full" (đã có cho IdP). Widget Turnstile cho `localman.hoandat.com`.
2. **Đồng bộ script lên server.** Từ repo: `SSH_TARGET=<alias> bash infra/localman/deploy.sh --infra-only` (chỉ chép `infra/localman/` vào `/opt/localman/infra`).
3. **mongod-localman.** Trên server, với root (mật khẩu đi qua biến môi trường hoặc stdin, không qua argv):
   ```bash
   bash /opt/localman/infra/setup-mongo-localman.sh < /root/localman-mongo-passwords   # dòng 1 admin, dòng 2 app
   shred -u /root/localman-mongo-passwords
   ```
   Script cài unit, tạo keyFile, `rs.initiate` với `127.0.0.1:27018` qua localhost exception, tạo user admin rồi user `localman`; chạy lại thì chỉ đồng bộ cấu hình và đặt lại mật khẩu. Kiểm: `systemctl status mongod-localman`, `ss -ltnp | grep 27018` chỉ thấy `127.0.0.1`.
4. **Server.** `bash /opt/localman/infra/setup-server.sh`: tạo user `localman`, thư mục, bản sao Node cho user đó, logrotate, cron backup, `pm2 startup` nếu chưa có, và `/opt/localman/.env` từ mẫu với `SESSION_ENCRYPTION_KEY` mới (không ghi đè nếu đã có). `deploy.sh` chạy lại script này mỗi lần.
5. **Chứng chỉ.** `bash /opt/localman/infra/issue-wildcard-cert.sh < /root/cloudflare-token` rồi xoá file token. Script cài plugin `dns-cloudflare` nếu thiếu, ghi `/etc/letsencrypt/cloudflare-localman.ini` (600), cấp chứng chỉ và lưu deploy-hook `systemctl reload nginx` cho mỗi lần gia hạn. Kiểm: `certbot renew --dry-run --cert-name localman.hoandat.com`.
6. **nginx.** Không chép tay: `deploy.sh` cài hai file conf, chạy `nginx -t`, reload, và khôi phục bản cũ nếu `nginx -t` lỗi. Trước lần deploy đầu, kiểm trên server:
   - `nginx -T 2>/dev/null | grep -E 'set_real_ip_from|real_ip_header'` có dải IP Cloudflare và `real_ip_header CF-Connecting-IP` ở cấp `http` (nếu không, mọi người dùng chung rate limit của một IP edge Cloudflare). Nếu thiếu, thêm một lần ở cấp `http` cho cả server (dải IP lấy từ `https://www.cloudflare.com/ips-v4` và `ips-v6`); đây là cấu hình chung với IdP nên báo user trước.
   - SELinux enforcing: `getsebool httpd_can_network_connect` phải `on` (setup-server cảnh báo nếu tắt) và `/opt/localman/web` mang nhãn `httpd_sys_content_t` (setup-server tự gán).
7. **Env.** `HOST=127.0.0.1` có sẵn trong mẫu (file cũ thiếu thì `setup-server.sh` thêm vào). Điền `/opt/localman/.env` theo mẫu: `MONGO_URI` (mật khẩu app ở bước 3), `OIDC_CLIENT_SECRET`, `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`, `TELEGRAM_BOT_TOKEN`, `OWNER_TELEGRAM_CHAT_ID`, `OWNER_SUBS`, bộ VAPID. Biến thiếu hoặc sai thì API dừng ngay khi khởi động và log tên biến (không in giá trị).
8. **Deploy.** `SSH_TARGET=<alias> bash infra/localman/deploy.sh` (xem mục dưới).
9. **Telegram.** Bot của Localman chỉ **gửi** tin (API không có route webhook, nên không có `setWebhook` hay `TELEGRAM_WEBHOOK_SECRET`). Owner mở `@localman_hoandat_bot` và bấm Start để bot được phép nhắn; user nhận thông báo cũng phải Start bot (chat id lấy từ IdP). Kiểm token mà không để lộ qua argv:
   ```bash
   read -rs TOKEN && printf 'url = "https://api.telegram.org/bot%s/getMe"\n' "$TOKEN" | curl -s --config -; unset TOKEN
   ```
   Lấy chat id của owner: thay `getMe` bằng `getUpdates` sau khi owner nhắn bot, đọc `message.chat.id`.
10. **Backup.** Cron đã cài ở bước 4. Chạy thử một lần: `bash /opt/localman/infra/backup-localman-db.sh` rồi `ls -l /opt/localman/backups`.

## Các lần sau

```bash
SSH_TARGET=<alias> [SSH_OPTS="-F ssh_config"] [VITE_FEATURES=...] bash infra/localman/deploy.sh
```

[`deploy.sh`](../infra/localman/deploy.sh) build `@localman/api` và `@localman/web` ở máy (cố định `VITE_*` để `.env.local` của dev không lọt vào bản production), viết `package.json` runtime với phiên bản đã khoá theo workspace ([`runtime-manifest.mjs`](../infra/localman/runtime-manifest.mjs)), tính hash các script inline của `apps/web/dist/index.html` ([`csp-hashes.mjs`](../infra/localman/csp-hashes.mjs)) để điền vào CSP, rsync `-rlptz` (openrsync của macOS không có `--chown`; file thuộc root) bundle API, web và `infra/localman`, rồi trên server: `setup-server.sh`, `pnpm install --prod`, cài nginx conf, `pm2 startOrReload` + `pm2 save`, đợi `/healthz` của cả `:4000` và `:4100` báo `"db":"connected"`, và gọi thử qua nginx.

Asset cũ của web được giữ 14 ngày để tab mở trước khi deploy vẫn tải được chunk cũ. Đổi `script`/`args` trong `ecosystem.config.cjs` thì `pm2 delete localman-api` trước khi deploy, vì reload không áp dụng thay đổi đó.

## Kiểm tra sau deploy

```bash
curl -fsS https://localman.hoandat.com/ -o /dev/null -w '%{http_code}\n'           # 200
curl -sI https://localman.hoandat.com/ | grep -i content-security-policy            # có 3 sha256
curl -fsS "https://{secret}.localman.hoandat.com{prefix}/users"                     # dữ liệu mock
curl -fsS "https://localman.hoandat.com/m/{secret}{prefix}/users"                   # cùng dữ liệu qua /m/
curl -s -o /dev/null -w '%{http_code}\n' https://www.localman.hoandat.com/          # 404 (tên dành riêng)
MOCK_URL="https://{secret}.localman.hoandat.com{prefix}/users"
seq 1 100 | xargs -P 20 -I % curl -s -o /dev/null -w '%{http_code}\n' "$MOCK_URL" | sort | uniq -c   # có 429
```

- Cổng nội bộ đóng từ ngoài (chạy ở máy khác, phải báo lỗi hoặc timeout): `for p in 4000 4100 27018; do nc -vz -w 3 103.72.98.65 $p; done`. Trên server: `ss -ltnp | grep -E ':(4000|4100|27018) '` chỉ thấy `127.0.0.1`.
- Log không lộ token: `grep -E '/invite/[^\[]|\?[^\[]' /var/log/nginx/localman*.access.log` không ra dòng nào.
- Trình duyệt: mở `/`, `/docs` và form góp ý (Turnstile hiện), console không có lỗi CSP; đăng nhập và đăng xuất qua IdP.
- Server: `pm2 status localman-api`, `pm2 logs localman-api --lines 50 --nostream`, `tail /var/log/nginx/localman-mock.access.log` (đường dẫn `/m/` hiện `[secret]`).
- 429 `RATE_LIMITED` của form công khai sau khi mở form: theo dõi để chỉnh `feedbackRateLimit.perIp` nếu người dùng sau CGNAT bị chặn nhầm.

## Dọn project bỏ hoang

Bundle có thêm `api/cleanup-abandoned-projects.mjs`: project của chủ gói Free không có request mock trong N ngày (mặc định 90). Chạy bằng cùng Node, cùng user và cùng env file với pm2, **luôn dry-run trước**, đọc danh sách trong log, rồi mới `--apply`. Không có cron tự xoá.

```bash
cd /opt/localman/api
runuser -u localman -- /opt/localman/runtime/node --env-file=/opt/localman/.env cleanup-abandoned-projects.mjs --days 90          # dry-run
runuser -u localman -- /opt/localman/runtime/node --env-file=/opt/localman/.env cleanup-abandoned-projects.mjs --days 90 --apply  # xoá
```

Mã thoát: 0 xong, 1 có project xoá lỗi hoặc lỗi chạy, 2 sai tham số hoặc env. Nên chạy backup ngay trước `--apply`.

## Rollback

- Code: checkout commit trước rồi chạy lại `deploy.sh`.
- Gỡ site: `pm2 delete localman-api && pm2 save`, xoá hai file `localman*.conf` trong `/etc/nginx/conf.d/`, `nginx -t`, `systemctl reload nginx`.
- Database: `mongod-localman` độc lập với mongod chung. Khôi phục từ backup bằng user `localman` (URI để trong file cấu hình, không qua argv):
  ```bash
  cd /opt/localman && umask 077
  printf 'uri: "%s"\n' "$(sed -n 's/^MONGO_URI=//p' .env)" > /root/localman-restore.yaml
  mongorestore --config=/root/localman-restore.yaml --gzip --archive=backups/localman-<stamp>.archive.gz --nsInclude='localman.*' --drop
  rm -f /root/localman-restore.yaml
  ```
- Dừng hẳn database: `systemctl disable --now mongod-localman` (dữ liệu vẫn ở `/var/lib/mongodb-localman`).
