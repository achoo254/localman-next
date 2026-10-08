# Localman (next)

Bộ công cụ API cho lập trình viên và DevOps tại `localman.hoandat.com`:

- **Mock API có trạng thái**, tương đương mockapi.io: project, resource lồng nhau, dữ liệu Faker, custom response. Có thêm Mock lai localhost và Mock MCP.
- **API client chạy trên web**, tương đương phần Collections và Environments của Postman (gồm cả chia sẻ). Request mặc định gửi thẳng từ trình duyệt; proxy và Tunelo làm đường dự phòng.
- **Tunelo:** mở tunnel `*.tunnel.hoandat.com` tới localhost (gộp vào repo này).
- **MCP** cho mọi tính năng; đăng nhập một lần qua `auth.hoandat.com`.
- **DevOps toolkit:** test API trong CI bằng một lệnh, mock tạm, tunnel có SSO, giám sát.

Repo đang ở giai đoạn lập kế hoạch. Bắt đầu đọc từ [`plans/dattqh/EXECUTION.md`](plans/dattqh/EXECUTION.md).
