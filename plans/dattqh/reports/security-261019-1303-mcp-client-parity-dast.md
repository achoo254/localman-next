# DAST: gửi tới localhost qua tunnel, import collection, code snippet trên prod

**Ngày:** 2026-10-19 · **Release:** `20261019-060338-53bacda99e7e` (commit `53bacda`, không `-dirty`, CI xanh run `39203354248`; deploy theo yêu cầu của user) · **Cổng:** `TUNELO_ACCOUNTS_ENABLED=true` · **Kết luận DAST:** ĐẠT (0 Critical, 0 High, 0 Medium; 2 Info) · **SAST:** đạt sau khi sửa (review trước commit: 1 High, 5 Medium đã sửa kèm test).

Đo từ ngoài qua `https://localman.hoandat.com`: phần chưa đăng nhập bằng `curl`, phần có đăng nhập bằng phiên trình duyệt thật của user (Chrome, fetch cùng origin). Tunnel thật: CLI `tunelo` 1.9.0 trên máy dev (đăng nhập cùng tài khoản) mở `https://lmdast4791.tunnel.hoandat.com` tới một server echo cục bộ ở `localhost:4791` (trả method, path, body). Collection thử và ánh xạ thử đã xoá, tunnel và server echo đã tắt sau khi đo; Mongo đọc bằng `prod-mongosh.sh`, chỉ in số đếm.

| # | Ca | Kết quả |
|---|---|---|
| 1 | `POST /client/code-snippets`, `/workspaces/x/collections/import`, `/proxy` chưa đăng nhập | 401 |
| 2 | `send_request` tới `http://localhost:4791/users?x=1` (POST, body `hi`) | 200 qua tunnel của tài khoản, `finalUrl` là URL tunnel, echo nhận đúng method, path, query, body |
| 3 | `127.0.0.1:4791`, `[::1]:4791` | 200 qua cùng tunnel |
| 4 | `localhost:4791/../../admin?q=%2e%2e` | Chuẩn hoá thành `/admin?q=%2e%2e`, vẫn dưới host tunnel |
| 5 | `http://evil@localhost:4791/u` | Userinfo bị bỏ, tới `https://lmdast4791…/u` |
| 6 | Cổng không có tunnel (`localhost:4799`) | 403 `PROXY_TARGET_BLOCKED`, `details.local`, hướng dẫn `tunelo http` |
| 7 | LAN `192.168.1.5`, metadata `169.254.169.254`, `10.0.0.1` | 403 `PROXY_TARGET_BLOCKED` |
| 8 | Hạn mức proxy | Tăng đúng 9 cho 9 lần gửi (gồm lần bị từ chối) |
| 9 | Ánh xạ `localhost:4798` → URL tunnel, gửi tới `localhost:4798/mapped?y=2` | 200 qua ánh xạ |
| 10 | Ánh xạ tới `https://example.com`, tới tên giả dạng `…tunnel.hoandat.com.evil.com` | 400 `VALIDATION_ERROR` |
| 11 | Import Postman v2.1, cURL | 201, `format` đúng |
| 12 | Import JSON hỏng; file environment; workspace không thuộc mình | 400 `IMPORT_FAILED` (`INVALID_JSON`); 400 `IMPORT_NOT_A_COLLECTION`; 404 `NOT_FOUND` |
| 13 | Snippet cURL với `Bearer {{token}}` | 200, `{{token}}` giữ nguyên, không thay giá trị |
| 14 | Snippet Python với URL chứa `'; import os;'` | Chuỗi trong nháy đơn, `'` được escape thành `\'`; không có dòng lệnh chèn thêm |
| 15 | Snippet với target lạ | 400 `VALIDATION_ERROR` |
| 16 | Sau khi dọn: collection thử, ánh xạ thử trong Mongo | 0 / 0 |
| 17 | Server sau đợt đo | `localman-api` online, restarts 44 (không đổi), 0 dòng log mức error/fatal; log proxy có trường `via` cho 6 lần gửi qua tunnel |

## Ghi chú

- **Info:** import lệnh `curl file:///etc/passwd` tạo request lưu URL đó như văn bản (giống dialog import trên web). Không thành SSRF: proxy chỉ nhận URL http(s) (`file:///etc/passwd` gửi qua `/proxy` bị 400 `VALIDATION_ERROR`).
- **Info:** chưa đo trên prod đường của agent không có phiên trình duyệt (token MCP, chỉ đọc máy đã `tunelo link`) vì cần cấp quyền OAuth và liên kết một máy; ca này có trong `local-target-route.test.ts` và E2E trên CI.
