# DAST: phase 13 đợt B (Environments bật cờ) trên prod

**Ngày:** 2026-10-12 · **Release:** `20261012-105625-1ab618562676` (commit `1ab6185`, không `-dirty`, deploy bởi session auth; backup DB ngay trước: `localman-20261012-175619`) · **Kết luận DAST:** ĐẠT (0 Critical, 0 High, 0 Medium; 1 Low, 2 Info) · **SAST:** đạt (`security-261012-1610-phase-13-slice-b-sast.md`) ⟹ module Environments và vá phase 12 vận hành được.

## Phạm vi và cách đo

Đo từ ngoài qua `https://localman.hoandat.com` (Cloudflare → nginx → API), với tài khoản thật của user qua phiên trình duyệt (Chrome, fetch cùng origin nên có `Origin` và cookie thật) và Localman MCP; dữ liệu Mongo đọc bằng `prod-mongosh.sh`, chỉ in true/false và số đếm. Dữ liệu thử là hai environment tạm `DAST tmp … 1800` với secret giả `dast-*`, đã xoá sau khi đo.

## Kết quả

| # | Kiểm | Kết quả |
|---|---|---|
| 1 | Không đăng nhập: `GET /environments/:id/export`, `GET /environments/:id/collections`, `GET /environments/:id` | 401 `UNAUTHENTICATED` |
| 2 | Không đăng nhập, ghi: `POST /workspaces/:id/environments/import`, `PUT /environments/:id/variables`, kể cả `Origin: https://evil.example` | 403 `CSRF_REJECTED` |
| 3 | Body import 17 MB | nginx 413 (trần 16m) |
| 4 | Đã đăng nhập, body import 11 MB và 15 MB | 413 `PAYLOAD_TOO_LARGE` (giới hạn 10 MiB của operation) |
| 5 | Tạo environment qua MCP (`baseUrl`, secret, `$where`, biến chưa chia sẻ) | Tạo được, 4 biến |
| 6 | Export | 200, `*.postman_environment.json`, `_postman_variable_scope: environment`; secret và biến chưa chia sẻ để trống, kiểu `secret` giữ; chuỗi secret không có trong toàn bộ JSON |
| 7 | Import lại (đổi secret) | 201, 4 biến, secret có giá trị, biến trống vẫn chưa chia sẻ |
| 8 | Import file hỏng (tên biến rỗng) | 400 `INVALID_ENVIRONMENT_FILE`, `details: { issue: "empty_key", index: 0 }` |
| 9 | `GET /environments/:id/collections` | 200 `{ items: [] }` (chưa collection nào liên kết) |
| 10 | Mongo: secret của cả hai environment | `sealed: true`, không có bản rõ; `countDocuments` theo chuỗi secret trên toàn `environments` = 0; `$where` lưu như tên biến thường |
| 11 | Trình duyệt: chọn environment, `GET {{baseUrl}}/api/v1/health` route Proxy | 200 OK, 107 ms, nhãn "Qua Tunelo", tới đúng backend OneDash `localhost:8003` qua tunnel `olj18ttk` |
| 12 | Tooltip `{{baseUrl}}` | Hiện `http://localhost:8003`, nguồn "Environment · DAST tmp environments 1800", thứ tự ưu tiên Global < Collection < Environment < Biến tạm |
| 13 | Post-response `lm.environment.set("dastHealth", …)` | Lưu thành giá trị local `200` của người gửi; biến shared giữ nguyên 4; pane Variables hiện `dastHealth` nhãn LOCAL, secret che `••••••••` |
| 14 | Dọn: xoá 3 environment (dry run trước) | Còn 0 environment, 0 `active_environments`, 0 `local_variable_values` trỏ tới chúng; active environment của workspace về `null` |
| 15 | Log `localman-api` (`api.out-10.log`, `api.err-10.log`) | 0 lần xuất hiện chuỗi secret thử; 0 dòng mức error/fatal từ lúc deploy |
| 16 | Restart `localman-api` | 27 trước deploy, 28 sau (lần reload của deploy, 17:56:48); 18:13:17 (16 phút sau) vẫn 28, `online`, `/healthz` :4000 và :4100 `db: connected` |

GIF luồng trình duyệt: `localman-environments-dast-prod.gif` (thư mục Downloads của user).

## Phát hiện

- **Low, UX: nhãn SHARED cho biến chưa chia sẻ.** Pane Variables hiện biến `unshared` với giá trị "Chưa chia sẻ" nhưng nhãn bên phải vẫn là SHARED. Không ảnh hưởng bảo mật; dễ hiểu nhầm. Đề xuất: nhãn theo nguồn giá trị thực tế (không có giá trị thì không gắn SHARED).
- **Info: 502 thay vì 403 cho body lớn bị chặn CSRF.** Request không có `Origin` hợp lệ mang body 11 MB nhận 502 từ Cloudflare: API trả 403 và đóng kết nối trước khi nginx gửi hết body (`sendfile() failed (32: Broken pipe)` trong error log nginx). Request vẫn bị từ chối, API không khởi động lại (uptime tính từ lần reload 17:56:48); người dùng thật nhận đúng 413 (mục 4). Có ở mọi route ghi, không riêng Environments.
- **Info: route không tồn tại hiện trang lỗi mặc định của React Router.** `/app/client` hiện "Unexpected Application Error! 404 Not Found" kèm lời nhắn "Hey developer". Không lộ stack hay dữ liệu; thiếu route `*` dẫn tới trang 404 của app. Có từ trước, không thuộc đợt này.

## Ghi chú vận hành

- Client MCP mở từ trước deploy báo `Structured content does not match the tool's output schema` cho `create_environment` và `get_environment`: danh sách tool nó giữ là của bản cũ (thiếu `createdBy`, `createdByName`, `createdAt`). Đối chiếu dữ liệu thật với `openapi.json` của release mới: không có trường thừa, `additionalProperties: false` khớp. Client kết nối lại sẽ nhận schema mới; tool `export/import environment` và `list environment collections` cũng chỉ hiện sau khi kết nối lại.
- CSP `script-src` có 5 sha256 vì `index.html` có 5 script inline; release trước (`61c4601`) cũng 5, nên không do Environments. `docs/deployment-guide.md` đã sửa để không ghi cứng số lượng.
- Tunnel `olj18ttk.tunnel.hoandat.com` → `localhost:8003` vẫn mở cho lần đo; user tắt bằng `tunelo kill all` khi không cần.
