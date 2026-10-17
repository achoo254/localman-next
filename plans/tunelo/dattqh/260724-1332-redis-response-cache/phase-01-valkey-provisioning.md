# Phase 01 — Provision Valkey bounded trên .65

**Tier:** S — thao tác hạ tầng trên staging `.65`. Không đụng code app.

## Bối cảnh (đã verify 2026-07-24)

- CentOS Stream 9, `dnf` có sẵn `valkey.x86_64 8.1.6-1.el9` (appstream). Port `6379` trống, chưa có redis/valkey.
- RAM mỏng (available ~3.3G phần lớn là page cache; swap đã dùng ~894M) → **bắt buộc `maxmemory` + tắt persistence** (theo report).

## Việc cần làm

1. Cài: `dnf install -y valkey`.
2. Ghi config bounded (từ `infra/valkey.conf` trong repo, xem dưới) vào `/etc/valkey/valkey.conf`. Sinh password mạnh: `openssl rand -base64 36`.
3. `systemctl enable --now valkey` → verify `valkey-cli -a '<pass>' ping` = `PONG`.
4. Thêm vào `/var/www/tunelo/.env`:
   ```
   REDIS_URL=redis://:<url-encoded-pass>@127.0.0.1:6379/0
   CACHE_ENABLED=true
   ```
   (URL-encode password nếu có ký tự đặc biệt; hoặc dùng `redis://default:<pass>@...`.)

## `infra/valkey.conf` (commit vào repo, deploy lên `/etc/valkey/valkey.conf`)

```conf
# Tunelo response-cache — cache thuần, bounded, KHÔNG persistence.
bind 127.0.0.1 -::1          # chỉ localhost; Node relay connect nội bộ
protected-mode yes
port 6379

maxmemory 256mb
maxmemory-policy allkeys-lru # cache: đầy thì evict LRU
save ""                      # TẮT RDB (tránh fork nhân đôi RAM lúc BGSAVE khi RAM mỏng)
appendonly no                # TẮT AOF
requirepass CHANGE_ME_AT_DEPLOY   # đặt password thật lúc deploy, KHÔNG commit password

# Cache có thể bị đầy — cho phép ghi tiếp nhờ eviction, không chặn ghi
# (allkeys-lru đã tự evict; giữ mặc định).
```

> Password **không commit** — chỉ đặt trên server. File `.env` staging đã gitignore; giá trị thật set trực tiếp trên `.65`.

## Kiểm tra / nghiệm thu

- `systemctl is-active valkey` = `active`; `ss -ltnp | grep 6379` chỉ bind `127.0.0.1`/`::1` (không `0.0.0.0`).
- `valkey-cli -a '<pass>' config get maxmemory maxmemory-policy save appendonly` khớp config.
- `valkey-cli -a '<pass>' info memory | grep used_memory_human` ~5–10M lúc idle.
- Từ ngoài: `redis-cli -h 103.72.98.65 -p 6379 ping` **phải fail/timeout** (không expose).

## Rollback

`systemctl disable --now valkey; dnf remove -y valkey` và gỡ `REDIS_URL` khỏi `.env`. Không mất dữ liệu (không persistence).

## Ghi chú deploy

CI/CD (`.gitlab-ci.yml`) **không** đồng bộ `.env` và **không** cài package hệ thống → bước cài Valkey + set `REDIS_URL` là **thủ công một lần** trên `.65` (SSH). Chỉ code Node (phase-02) đi qua pipeline.
