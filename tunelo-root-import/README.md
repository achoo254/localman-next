# Tunelo CLI

Expose dịch vụ local ra internet qua HTTPS wildcard subdomain — `https://<tên>.tunnel.inetdev.io.vn` chuyển tiếp về `localhost` của bạn.

## Cài đặt

Yêu cầu: **Node.js 20+** (kèm npm; hoặc pnpm 9+). Không cần clone repo.

### Bước 1 — cấu hình registry `@dattqh` (làm 1 lần)

CLI phát hành trên GitLab Package Registry. Lệnh dưới chạy được trên **macOS / Windows / Linux** (cmd, PowerShell, bash, zsh); npm và pnpm dùng chung `~/.npmrc`:

```bash
npm config set @dattqh:registry https://gitlabs.inet.vn/api/v4/projects/343/packages/npm/
npm config set "//gitlabs.inet.vn/api/v4/projects/343/packages/npm/:_authToken" GB1Tos8sUW1F9yBP9Ymz
```

> Token trên chỉ có quyền **đọc** registry — dùng để cài, không truy cập được gì khác.

### Bước 2 — cài global

```bash
# npm
npm install -g @dattqh/tunelo

# hoặc pnpm (chạy `pnpm setup` 1 lần để có global bin trên PATH)
pnpm setup && pnpm add -g @dattqh/tunelo
```

Kiểm tra:

```bash
tunelo --version
```

Cập nhật bản mới: `npm update -g @dattqh/tunelo` (hoặc `pnpm update -g @dattqh/tunelo`).

## Sử dụng nhanh

### Bước 1 — xác thực thiết bị

Chạy `tunelo login` → trình duyệt mở trang hiển thị **mã ngẫu nhiên**. Copy mã đó, dán vào terminal. Xác nhận xong, trình duyệt chuyển sang màn hình thành công và CLI đã đăng nhập (token lưu `~/.tunelo/config.json`):

```bash
tunelo login
#   Opening browser to authorize this device...
#   Paste the code shown in your browser: XXXX-XXXX
#   ✓ Device authorized & signed in.
```

Máy không có trình duyệt (CI/server)? Dùng access token trực tiếp:

```bash
tunelo login --key tunelo_xxxxxxxx
```

> Không có tài khoản/đăng ký — xác thực thiết bị qua trình duyệt là đủ.

### Bước 2 — mở tunnel

```bash
tunelo http 3000
# => https://<random>.tunnel.inetdev.io.vn  →  http://localhost:3000
```

Nhấn `Ctrl+C` để dừng.

Tùy chọn hay dùng:

```bash
tunelo http 3000 -s myapp        # subdomain cụ thể → https://myapp.tunnel.inetdev.io.vn
tunelo http 8080 -a user:pass    # bảo vệ tunnel bằng Basic Auth
tunelo http 3000 5000            # mở nhiều tunnel cùng lúc
tunelo tcp 5432                  # tunnel TCP (vd PostgreSQL)
```

## Các lệnh khác

| Lệnh | Việc |
|------|------|
| `tunelo keys list` | Liệt kê API key |
| `tunelo keys create` | Tạo API key mới |
| `tunelo keys revoke <keyId>` | Thu hồi API key |
| `tunelo config --key <key>` | Đặt API key mặc định (thủ công) |
| `tunelo config --server <url>` | Đổi server mặc định |
| `tunelo config --show` | Xem cấu hình hiện tại |
| `tunelo logout` | Xoá API key khỏi config |

Thứ tự ưu tiên cấu hình: cờ CLI (`--key`, `--server`) > biến môi trường (`TUNELO_KEY`, `TUNELO_SERVER`) > `~/.tunelo/config.json`.

## License

MIT
