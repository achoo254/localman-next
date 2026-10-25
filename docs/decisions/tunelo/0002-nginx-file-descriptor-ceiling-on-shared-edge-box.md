# ADR-0002: Nâng trần file-descriptor của nginx trên edge box dùng chung

- **Ngày:** 2026-08-16
- **Trạng thái:** Đã chốt
- **Người quyết định:** dattqh

## Bối cảnh

Tunelo chạy production trên `<SERVER_65_IP>` — **không phải box riêng**. nginx ở đó phục vụ 14 server block cho nhiều hệ thống khác (cloudpanel-dev, sa-dashboard, onescribe, onedash-s3, vaultic, hoc-cloud, meilisearch, office-tunnel…). Máy: CentOS Stream 9, nginx 1.20.1 (RPM AppStream), 4 vCPU, 7,6 GB RAM.

Cấu hình `/etc/nginx/nginx.conf` khi kiểm tra:

```
worker_processes auto;        → 4 worker
worker_connections 1024;
worker_rlimit_nofile          → không set
nginx master: open files      → soft 1024 / hard 524288
```

Worker kế thừa soft limit 1024 fd. Mỗi connection được proxy tiêu 2 fd (client + upstream), nên trần thực tế là **~512 connection/worker ≈ 2.048 cho toàn bộ 14 site** — chứ không phải 1024×4 như con số `worker_connections` gợi ý. `worker_connections` khi đó chỉ là số trang trí vì fd cạn trước.

Mục tiêu thiết kế của Tunelo là 5-10k tunnel đồng thời. Mỗi tunnel chiếm 2 connection nginx (WS client→nginx và nginx→relay), tức 10k tunnel cần ~20k connection. Trần cũ chặn ở mức thấp hơn một bậc độ lớn.

## Quyết định

Đặt `worker_rlimit_nofile 65536;` và nâng `worker_connections` từ 1024 lên 8192 trong `/etc/nginx/nginx.conf`, áp dụng bằng `systemctl reload`.

## Lý do (tại sao)

- Trần fd là ràng buộc **binding** duy nhất chặn scale ở tầng nginx; mọi tuning khác (HTTP/2, cache, buffer) đều vô nghĩa khi connection thứ ~2.048 bị từ chối.
- Hard limit của systemd unit đã là 524288, nên nâng soft limit lên 65536 không cần đụng systemd override — nginx tự `setrlimit()` trong worker.
- `reload` (không phải `restart`) nạp worker mới với limit mới mà không drop connection đang mở — đo được: 64 → 66 connection qua thời điểm reload, 4 tunnel không đứt.
- 8192 × 4 worker = 32.768 connection, đủ headroom cho mục tiêu 10k tunnel mà vẫn để RAM làm trần thật.

## Đánh đổi & hệ quả

- **Được:** trần connection tầng nginx tăng ~16 lần; mục tiêu 5-10k tunnel không còn bị chặn bởi fd.
- **Mất / nợ kỹ thuật:** trần thật tiếp theo chuyển sang **RAM** — box 7,6 GB đã dùng 4,5 GB và chia cho 14 site. Con số 32.768 là trần lý thuyết, không phải năng lực thật. Nâng limit cũng có nghĩa dưới tải cực đại nginx sẽ nhận connection tới lúc RAM cạn thay vì từ chối sớm.
- **Ảnh hưởng:** file này dùng chung cho cả 14 site, nên thay đổi có lợi (hoặc rủi ro) cho tất cả, không riêng Tunelo.
- File global không nằm trong repo (repo chỉ version `infra/tunelo/nginx.conf` = site config `conf.d/tunelo.conf`), nên ADR này là nơi duy nhất ghi lại thay đổi. Backup trên máy: `/etc/nginx/nginx.conf.bak-fdlimit-20260816-122824`.

## Phương án đã cân nhắc

- **Bật HTTP/2 trước:** loại — với tải thực tế lúc quyết định (4 tunnel, 57 connection) h2 không tạo khác biệt đo được, trong khi trần fd chặn thẳng mục tiêu. Ngoài ra trên nginx 1.20.1 `http2` là cờ của listen socket, không tách được theo server block, nên bật cho Tunelo là bật cho cả 13 hệ thống khác — quyết định vượt ngoài phạm vi Tunelo.
- **Tách Tunelo sang box riêng:** đúng về dài hạn nhưng không giải quyết được ngay; trần fd vẫn phải sửa dù ở box nào.
- **Nâng `worker_connections` mà không đặt `worker_rlimit_nofile`:** vô tác dụng — fd cạn trước, đúng cái bẫy đang mắc phải.
