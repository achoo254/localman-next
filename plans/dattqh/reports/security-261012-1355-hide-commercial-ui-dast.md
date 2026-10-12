# DAST: gỡ giao diện thương mại trên production

**Ngày:** 2026-10-12 · **Release:** `20261012-065240-61c4601aa3c8` (user yêu cầu "chờ CI xanh rồi deploy"; CI của `61c4601` xanh) · **Kết luận DAST:** ĐẠT cho phần kiểm được từ ngoài và phía server; phần giao diện sau đăng nhập chưa kiểm trên prod (xem Giới hạn).

Backup trước deploy: `localman-20261012-135233.archive.gz` trên server. Release trước (để rollback code): `20261012-031014-e9751e0e2a0f-dirty`.

## Nghiệm thu sau deploy (`docs/deployment-guide.md`)

| Kiểm | Kết quả |
|---|---|
| `GET /` | 200; header CSP có 5 hash sha256 (khớp 5 inline script của bản build) |
| `www.localman.hoandat.com` | 404 (tên dành riêng) |
| `POST /internal/audit-events` từ ngoài | 403 |
| `GET /api/v1/openapi.json` | 200 |
| `/healthz` cổng 4000 và 4100 trên server | `{"status":"ok","db":"connected"}` |
| Cổng nội bộ | 4000, 4100, 27018 chỉ nghe `127.0.0.1` |
| `localman-api` | online, restart 26 → 27 (đúng một lần reload của deploy); 200 dòng log cuối không có mức error/fatal |

## DAST

| Kiểm | Kết quả |
|---|---|
| `GET /pricing` | 302, `Location: https://localman.hoandat.com/`, Cloudflare `DYNAMIC` (không cache) |
| `GET /pricing/` | 200 trang SPA, router chuyển về `/` (đã xem trên trình duyệt) |
| Landing (trình duyệt, khách) | Header: Features, Docs, ngôn ngữ, giao diện, Sign in, "Get started now"; câu dưới hero "3 mock projects, 10 resources in total and 5,000 proxy requests per month"; chân trang: Localman home, Docs, Feedback / Contact; tìm trên cây accessibility không có link, nút hay chữ nào nhắc pricing, plan, Pro, trial, upgrade, price |
| HTML prerender của `/` (curl) | Không chứa pricing, free plan, start free, upgrade, credit card, dùng thử |
| Bundle JS chính | Có "Get started now"; chuỗi "Manage plan" còn lại là nhãn nguồn của trang admin Pro interest (chỉ owner), không phải giao diện người dùng |
| Form góp ý | Loại: Feedback, Bug report, Question about limits (không gửi) |
| Endpoint giữ lại, chưa đăng nhập | `GET /users/me`, `/account/usage`, `/admin/trial-extensions`: 401 JSON; `POST /users/me/trial` và `/trial/extension`: 403 `CSRF_REJECTED` (có hoặc không có `Origin`); không lộ stack |
| Tự cấp Pro (đọc thẳng Mongo prod, chỉ in số đếm) | 1 tài khoản: đang Pro có hạn, chưa từng dùng thử, nên không đủ điều kiện (đúng: Pro đang chạy giữ nguyên); 0 lượt tự cấp sau deploy; log không có lỗi `Automatic Pro period not started` |

## Giới hạn của lần DAST này

- Trình duyệt dùng để kiểm chưa đăng nhập, và không đăng nhập thay user: trang tài khoản, menu tài khoản, nhãn ở trang Notification channels và thông báo chạm giới hạn chưa xem trên prod. Các phần này có test (web 1229, API 1222, kể cả test chặn chữ thương mại trong nhãn thông báo) và E2E 36/36.
- Prod chỉ có một tài khoản và tài khoản đó không đủ điều kiện, nên việc tự cấp Pro chưa xảy ra thật trên prod; đã kiểm bằng test tích hợp và E2E (tài khoản mới đăng nhập được cấp, `set-user-plan` đưa về Free).
- Không có máy quét DAST tự động (ZAP, nuclei); các phép thử làm tay bằng curl, trình duyệt và truy vấn Mongo chỉ đọc.
- Còn kiểm số restart của `localman-api` sau 15 phút theo §6 của skill vận hành.
