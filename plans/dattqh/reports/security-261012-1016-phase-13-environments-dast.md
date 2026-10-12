# DAST: phase 13 đợt A trên production

**Ngày:** 2026-10-12 · **Release:** `20261012-031014-e9751e0e2a0f-dirty` (deploy theo yêu cầu của user, cờ `environments` tắt; hậu tố `-dirty` do thay đổi chưa commit của session Tunelo, nằm ngoài phần build Localman) · **Kết luận DAST:** ĐẠT cho API environments và nginx; UI chưa kiểm trên prod vì cờ tắt.

Backup trước deploy: `localman-20261012-101006.archive.gz` trên server.

## Nghiệm thu sau deploy (`docs/deployment-guide.md`)

| Kiểm | Kết quả |
|---|---|
| `GET /` | 200; CSP có 5 hash sha256 (khớp 5 inline script của bản build) |
| `www.localman.hoandat.com` | 404 (tên dành riêng) |
| `POST /internal/audit-events` từ ngoài | 403 |
| `GET /api/v1/openapi.json` | 200, có đủ 9 đường dẫn mới (`/environments/...`, `/workspaces/{id}/environments|globals|active-environment`, `/collections/{id}/local-values`) |
| Cổng nội bộ | 4000, 4100, 27018 chỉ nghe `127.0.0.1` |
| `localman-api` | online, restart 25 → 26 (đúng một lần reload của deploy), không tăng sau DAST; `.env` được thêm `VARIABLE_ENCRYPTION_KEY` |

## DAST từ ngoài, không đăng nhập (curl từ máy dev qua Cloudflare)

| Kiểm | Kết quả |
|---|---|
| 15 endpoint mới (GET/POST/PATCH/PUT/DELETE, kể cả globals, active, local của collection) | 401 `UNAUTHENTICATED`, JSON, không lộ stack |
| Ghi không có `Origin` / `Origin` lạ | 403 (kiểm Origin chống CSRF) |
| Body 200 KB tới `/environments/{id}/variables` và `/workspaces/{id}/collections` | 401 JSON từ API, không còn 413 HTML của nginx: lỗi giới hạn 128k của collections trên prod đã hết |
| Body 17 MB | 413 của nginx (trần 16m có hiệu lực) |
| 60 request song song tới location mới | 44 × 401, 16 × 429: zone `localman_api_large` hoạt động |

Hai lần chạy đầu của phép đo bị lỗi do script (zsh không tách biến; `xargs -I %` thay cả `%{http_code}`) và cho số sai; đã chạy lại bằng bash, số trên là lần chạy đúng.

## DAST có đăng nhập (Localman MCP, tài khoản của user, workspace cá nhân)

Tạo một environment tạm `dast-20261012`, kiểm, rồi xoá; không đụng dữ liệu khác.

| Kiểm | Kết quả |
|---|---|
| Tạo environment với biến thường, biến secret, tên biến `$where` | 201; `$where` lưu như chuỗi bình thường |
| `list_environments` | Chỉ có số biến, không có giá trị |
| Giá trị local (thường và secret), chọn active | Thành công |
| Hai biến trùng tên | 400 `VALIDATION_ERROR`, chỉ rõ `variables.1.key` |
| Mã hoá khi lưu (đọc thẳng Mongo prod, chỉ in true/false) | Shared value của secret `sealed=true`, định dạng `v1.<kid>.…`, plaintext không có trong document; local của secret `sealed=true`; local của biến thường để thường |
| Đổi kiểu biến (default ↔ secret) | Local của người dùng được seal/mở lại đúng theo kiểu mới |
| IDOR: `get_environment` id lạ | 404 `NOT_FOUND`; `get_active_environment` của workspace lạ trả `null`, không lộ gì |
| Xoá có dry run | Dry run nêu tên và 3 biến; xoá xong không còn environment, local, active, share nào |
| Log `localman-api` (300 dòng) | Không chứa giá trị secret đã dùng; không có log mức error/fatal |

## Giới hạn của lần DAST này

- Chỉ có một tài khoản: việc Viewer không nhận shared value của secret, và Viewer sửa shared bị 403, đã kiểm bằng test tích hợp (hai user) chứ chưa kiểm trên prod.
- UI environments nằm sau cờ `environments` (đang tắt), nên chưa kiểm trên prod; E2E chạy local đạt.
- Không có máy quét DAST tự động (ZAP, nuclei) trên máy; các phép thử ở trên làm tay bằng curl và MCP.
- Còn kiểm số restart của `localman-api` sau 15 phút theo §6 của skill vận hành.
