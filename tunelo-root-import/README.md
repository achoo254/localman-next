# Tunelo CLI

Expose dịch vụ local ra internet qua HTTPS wildcard subdomain — `https://<tên>.tunnel.inetdev.io.vn` chuyển tiếp về `localhost` của bạn.

## Cài đặt

Yêu cầu: **Node.js 20+** (kèm npm; hoặc pnpm 9+). Không cần clone repo, không cần cấu hình registry hay token — CLI phát hành công khai trên [npmjs](https://www.npmjs.com/package/tunelo). Lệnh chạy được trên **macOS / Windows / Linux** (cmd, PowerShell, bash, zsh).

```bash
# npm
npm install -g tunelo

# hoặc pnpm (chạy `pnpm setup` 1 lần để có global bin trên PATH)
pnpm setup && pnpm add -g tunelo
```

Kiểm tra:

```bash
tunelo --version
```

### Cập nhật

```bash
tunelo update           # kiểm tra rồi cài bản mới nhất
tunelo update --check   # chỉ xem có bản mới không, không cài
```

Lệnh này tự nhận biết bạn cài bằng npm hay pnpm và gọi đúng trình quản lý. Nếu registry không truy cập được, nó in ra lệnh cài thủ công tương ứng.

Tunnel đang chạy vẫn giữ code cũ trong bộ nhớ — khởi động lại để dùng bản mới.

### Chuyển từ bản cũ `@dattqh/tunelo` (cài từ GitLab registry)

Bản cũ không tự cập nhật sang tên gói mới. Làm một lần: gỡ bản cũ, xóa cấu hình registry cũ, rồi cài lại như trên. Thông tin đăng nhập trong `~/.tunelo/config.json` được giữ nguyên, không cần `tunelo login` lại.

```bash
npm uninstall -g @dattqh/tunelo          # hoặc: pnpm remove -g @dattqh/tunelo
npm config delete @dattqh:registry
npm config delete "//gitlabs.inet.vn/api/v4/projects/343/packages/npm/:_authToken"
npm install -g tunelo
```

## Sử dụng nhanh

### Bước 1 — xác thực thiết bị

Chạy `tunelo login` → trình duyệt mở trang hiển thị **thiết bị của bạn** (tên máy) + nút **Approve**. Bấm Approve → trang báo thành công và CLI tự nhận token (lưu `~/.tunelo/config.json`):

```bash
tunelo login
#   Opening browser to authorize this device...
#   Waiting for approval in the browser...   ← bấm "Approve" trên trang
#   ✓ Device authorized & signed in.
```

Đăng nhập lại trên cùng máy là **idempotent** — nếu token còn hạn, CLI báo "Already authorized" (dùng `--force` để làm lại). Mỗi máy giữ 1 token; login lại thu hồi token cũ của máy đó.

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
