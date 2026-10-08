# Đánh giá tài nguyên: thêm Redis làm cache cho tunelo

- **Ngày:** 2026-07-24
- **Host:** staging (`*.inetdev.io.vn`), CentOS Stream 9, kernel 5.14 el9
- **Câu hỏi:** OneDash đã gỡ hoàn toàn — dung lượng/CPU hiện tại có đáp ứng thêm Redis cache cho tunelo không?
- **Kết luận:** ✅ **Đủ tài nguyên**, với điều kiện cấu hình Redis có chặn trần RAM (`maxmemory`) và tắt persistence.

---

## 1. Số liệu tài nguyên tại thời điểm đo

| Tài nguyên | Số liệu | Đánh giá |
|---|---|---|
| **CPU** | 4 cores (Intel Broadwell), load `0.42 / 0.25 / 0.18` (~10%) | ✅ Rất thoải mái |
| **Disk** | `/dev/vda1` 60G — dùng 27G, **còn 34G (44%)** | ✅ Dư sức |
| **RAM** | 7.5G total — used 4.2G, free 375M, **available ~3.3G** | ⚠️ Đủ, cần chặn trần |
| **Swap** | 2.0G total — **895M đang dùng**, free 1.1G | ⚠️ Điểm cần lưu ý |

### Chi tiết RAM (`/proc/meminfo`)
```
MemTotal:      7,865,352 kB (~7.5G)
MemAvailable:  3,469,192 kB (~3.3G)
Cached:        2,864,112 kB (~2.7G, phần lớn thu hồi được)
SwapTotal:     2,097,148 kB
SwapFree:      1,180,624 kB  → đang dùng ~895M
```

## 2. Tiến trình đang chạy

**Xác nhận cụm OneDash đã gỡ:** `pm2 jlist` chỉ còn 10 tiến trình, KHÔNG còn `CP` / `RESOURCE` / `ST`:
`pm2-logrotate`, `DRIVE`, `vaultic`, `hoccloud-server`, `pm2-exporter`, `MAIL`, `INFRA-WATCHDOG`, `tika`, `ai`, `tunelo`.

Top RAM (RSS):
```
1278.8 MB  mongod
 412.1 MB  claude (phiên CLI, tạm thời)
 272.0 MB  dockerd
 224.1 MB  node (tunelo)
 182.2 MB  node (ai)
 165.9 MB  node (DRIVE)
 148.0 MB  java (tika)
 146.1 MB  node (MAIL)
```

Top SWAP (process nguội, KHÔNG thrash — load thấp):
```
211.8 MB  dockerd
154.1 MB  x5  forkit + kit_spare_002..005  (Collabora spare kits, đang ngủ) ≈ 770M
 80.1 MB  mongod
```

**Redis chưa cài:** không có `redis-server`/`redis-cli`, không có systemd unit, `:6379` trống.
Docker đang chạy 2 container: `collabora-code` (:9980), `meilisearch` (:7700).

## 3. Nhận định

- **CPU & Disk:** dư thừa hoàn toàn, không phải lo.
- **RAM:** `available` 3.3G nhưng phần lớn là page cache thu hồi được → RAM anonymous trống thực tế mỏng hơn. Đúng với lịch sử host từng cạn RAM (đã gỡ PostgreSQL/n8n/Elasticsearch ngày 2026-07-02). Swap ~895M chủ yếu là process nguội nằm ì, chưa gây thrash.
- ⇒ Redis **được**, nhưng **phải chặn trần** để không tái diễn tình trạng cạn RAM.

## 4. Khuyến nghị cấu hình (cache thuần, bounded)

Cache cho 1 app tunnel nhỏ chỉ cần **128–256M**. Redis idle ~5–10M RSS; có `maxmemory` sẽ không vượt trần.

```conf
# /etc/redis/redis.conf — các dòng chính
bind 127.0.0.1 -::1          # chỉ localhost; tunelo connect nội bộ
maxmemory 256mb
maxmemory-policy allkeys-lru # cache thuần: đầy thì evict LRU
save ""                      # TẮT RDB snapshot (tránh fork nhân đôi RAM khi BGSAVE)
appendonly no                # TẮT AOF
requirepass <mật_khẩu_mạnh>
```

- **Không cần nginx** — tunelo kết nối thẳng `127.0.0.1:6379`, không expose ra ngoài.
- Tắt persistence quan trọng: tránh `fork()` lúc snapshot nhân đôi RAM tạm thời khi RAM anonymous mỏng; cache thì dữ liệu bỏ đi được.

## 5. Lựa chọn cài (CentOS Stream 9, có sẵn repo)

| Gói | Version | Ghi chú |
|---|---|---|
| `redis` (appstream) | **6.2.22** | Quen thuộc, systemd, nhẹ nhất — `dnf install redis` |
| `valkey` | **8.1.6** | Fork Redis, mới hơn, tương thích hoàn toàn client/protocol — `dnf install valkey` |
| docker `redis:7-alpine` | — | Nếu muốn đồng bộ với hạ tầng docker sẵn có |

**Đề xuất:** native package + systemd (nhẹ hơn thêm container).

## 6. Bước tiếp theo (chờ xác nhận)

1. Chọn `redis` 6.2 / `valkey` 8.1 / docker?
2. Trần RAM (`maxmemory`) — mặc định đề xuất 256M?

Sau khi chốt: cài → viết config như trên → mở service → test `redis-cli ping` trước khi cho tunelo dùng.
