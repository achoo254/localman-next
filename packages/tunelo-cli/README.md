# Tunelo CLI

Expose dịch vụ local ra internet qua HTTPS wildcard subdomain — `https://<tên>.tunnel.hoandat.com` chuyển tiếp về `localhost` của bạn. Đăng nhập bằng tài khoản hoandat.com (Google, GitHub hoặc Apple qua `auth.hoandat.com`); xem tunnel của tài khoản tại [tunnel.hoandat.com](https://tunnel.hoandat.com).

## Cài đặt

Yêu cầu: **Node.js 20+** (kèm npm; hoặc pnpm 9+). CLI phát hành ở [GitHub Releases](https://github.com/achoo254/localman-next/releases) của repo `localman-next` (tag `tunelo-v<phiên bản>`, file `tunelo.tgz`), **không còn trên npm**; npm hay pnpm cài thẳng từ đường dẫn, không cần clone repo, registry hay token. Lệnh chạy được trên **macOS / Windows / Linux** (cmd, PowerShell, bash, zsh).

```bash
# npm
npm install -g https://github.com/achoo254/localman-next/releases/latest/download/tunelo.tgz

# hoặc pnpm (chạy `pnpm setup` 1 lần để có global bin trên PATH)
pnpm setup && pnpm add -g https://github.com/achoo254/localman-next/releases/latest/download/tunelo.tgz
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

Lệnh này đọc bản mới nhất trên GitHub Releases, tự nhận biết bạn cài bằng npm hay pnpm và gọi đúng trình quản lý. Nếu không đọc được GitHub, nó in ra lệnh cài thủ công tương ứng.

Tunnel đang chạy vẫn giữ code cũ trong bộ nhớ — khởi động lại để dùng bản mới.

### Chuyển từ bản cài qua npm (1.9.1 trở xuống)

Gói `tunelo` trên npm dừng ở 1.9.1; `tunelo update` của bản 1.9.1 chỉ hỏi npm nên không thấy bản mới. Cài đè một lần bằng lệnh ở trên; từ 1.10.0 trở đi `tunelo update` lấy bản từ GitHub. Thông tin đăng nhập trong `~/.tunelo/config.json` được giữ nguyên.

### Từ 1.6.x lên 1.7.0

- Server mặc định đổi sang `tunnel.hoandat.com`. Cấu hình còn lưu `tunnel.inetdev.io.vn` được tự chuyển sang server mới ở lần chạy đầu.
- Đăng nhập bằng tài khoản thay cho trang Approve. Token ẩn danh cũ vẫn chạy, nhưng `tunelo whoami` nhắc đăng nhập; chạy `tunelo login` một lần để tunnel của máy gắn với tài khoản.

## Sử dụng nhanh

### Bước 1 — đăng nhập

```bash
tunelo login
#   Sign in to Tunelo in your browser:
#   https://auth.hoandat.com/device?user_code=...
#   Confirm the code: ABCD-EFGH
#   Waiting for approval...
```

Trình duyệt mở trang của `auth.hoandat.com`: đăng nhập bằng Google, GitHub hoặc Apple (đã có phiên thì bỏ qua), kiểm mã trùng với mã trên terminal, rồi bấm cho phép máy này. CLI lưu refresh token vào `~/.tunelo/config.json` (quyền 600) và tự làm mới token khi mở tunnel. Mỗi máy là một thiết bị riêng, xem và đăng xuất từng máy ở [auth.hoandat.com/account](https://auth.hoandat.com/account).

Đã đăng nhập rồi thì `tunelo login` báo và dừng (`--force` để làm lại). Dùng một server Tunelo khác: `tunelo login --server https://tunnel.<domain>`; CLI đăng nhập ở `https://auth.<domain>` (suy từ tên server, không hỏi server) và đặt server đó làm mặc định. Token tài khoản chỉ được gửi tới Tunelo cùng domain với tài khoản. Máy truy cập qua SSH (box lab chạy tunnel dài hạn): chạy `tunelo login` ngay trên máy đó rồi mở URL đã in và duyệt mã từ trình duyệt ở máy khác; phiên nằm trong `~/.tunelo/config.json` của user đã đăng nhập, nên chạy tiến trình tunnel bằng đúng user đó. Không có người duyệt (CI): `tunelo login --legacy-key <token>` hoặc biến `TUNELO_KEY` (token ẩn danh).

### Bước 2 — mở tunnel

```bash
tunelo http 3000
# => https://<random>.tunnel.hoandat.com  →  http://localhost:3000
```

Nhấn `Ctrl+C` để dừng.

Tùy chọn hay dùng:

```bash
tunelo http 3000 -s myapp        # subdomain cụ thể → https://myapp.tunnel.hoandat.com
tunelo http 3000:web 5000:api    # nhiều tunnel, mỗi cổng một subdomain
tunelo http 8080 -a user:pass    # bảo vệ tunnel bằng Basic Auth
tunelo tcp 5432                  # tunnel TCP (vd PostgreSQL)
```

## Các lệnh khác

| Lệnh | Việc |
|------|------|
| `tunelo whoami` | Máy này đang dùng tài khoản nào (hoặc token ẩn danh) |
| `tunelo logout` | Thu hồi đăng nhập của máy này và xoá token |
| `tunelo status` | Liệt kê tunnel đang chạy trên máy |
| `tunelo kill <pid\|subdomain\|all>` | Dừng tunnel đang chạy |
| `tunelo watch [pid\|subdomain\|URL]` | Xem request qua một tunnel đang chạy theo thời gian thực (từ terminal khác): in 10 request gần nhất (`-n`), lọc `--status 5xx`/`--path <chữ>`, thêm `--headers`/`--body`. Từ 1.9.0 |
| `tunelo link <code>` | Cho Localman thấy tunnel của máy chưa đăng nhập (không cần tài khoản) |
| `tunelo links` / `tunelo links revoke <id>` | Xem hoặc thu hồi các liên kết của máy |
| `tunelo mcp` | Chạy MCP server (stdio) cho agent AI, vd `claude mcp add tunelo -- tunelo mcp`: mở/đóng tunnel, xem request qua tunnel, dừng tunnel khác trên máy, xem và thu hồi liên kết (thu hồi cần `dry_run` rồi `confirm_token`) |
| `tunelo update [--check]` | Cập nhật lên bản mới nhất |
| `tunelo config --server <url>` / `--key <token>` / `--show` | Đổi server mặc định, đặt token ẩn danh, xem cấu hình |

Thứ tự ưu tiên cấu hình: cờ CLI (`--key`, `--server`) > biến môi trường (`TUNELO_KEY`, `TUNELO_SERVER`) > `~/.tunelo/config.json`.

## License

MIT
