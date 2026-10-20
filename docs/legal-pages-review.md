# Văn bản pháp lý công khai: danh sách claim và nguồn

> **Bản nháp — chờ chủ sở hữu duyệt.** Nội dung `/privacy`, `/terms` và `/account/delete` chưa được owner duyệt. Không deploy trước khi owner xác nhận từng dòng dưới đây, trả lời mục "Cần owner quyết định", rồi đặt `LEGAL_EFFECTIVE_DATE` (`apps/web/src/lib/legal.ts`) bằng ngày duyệt và đổi dòng này thành "Đã duyệt ngày …".

Chữ nằm ở `apps/web/src/i18n/messages/{en,vi,zh-CN}/legal*.ts` (English là nguồn) và `account.ts` (`account.delete`). Trang: `apps/web/src/pages/legal/`. Mọi claim chỉ rút từ repo; câu không có nguồn trong repo được đánh dấu **owner** (là cam kết/quy định, không phải sự thật kỹ thuật). Sửa chữ thì sửa bảng này cùng lúc.

Tên miền, tên tài khoản IdP và host Tunelo trong chữ là tham số theo tenant (`GET /api/v1/tenant`, `lib/tenant-info.ts`), không viết cứng.

## Chính sách quyền riêng tư (`legalPrivacy`)

| # | Claim | Nguồn |
|---|---|---|
| P1 | Không giữ mật khẩu; thông tin tài khoản đến từ IdP khi đăng nhập và mỗi lần làm mới phiên: account ID (`sub`), username, tên, link ảnh, email, `emailVerified`, chat Telegram đã liên kết | `apps/api/src/modules/users/user-model.ts`; `docs/system-architecture.md` mục "Đăng nhập và phiên" (callback, refresh đọc lại `userinfo`) |
| P2 | Lưu hạn mức đang áp dụng, hạn mức mở rộng tới khi nào, ngôn ngữ giao diện | `user-model.ts` (`plan`, `planExpiresAt`, `trialStartedAt`, `locale`) |
| P3 | Cookie phiên; token đăng nhập mã hoá trên server | `system-architecture.md` "Phiên" (AES-256-GCM); `modules/auth/session-store.ts` |
| P4 | Lưu nội dung người dùng tạo: project, resource, dữ liệu, rule, inbox, callback, collection, request, example, environment, biến (secret mã hoá), comment, fork, PR, tab, lịch sử, cài đặt | các model dưới `apps/api/src/modules/*/*-model.ts`; secret: `system-architecture.md` "Environments và biến" |
| P5 | Log request mock và inbox: thời điểm, method, path, query, status, thời gian, header và body request/response; body cắt 64 KB; Authorization, Cookie, Set-Cookie, X-API-Key và header tự chọn thành `[redacted]` | `system-architecture.md` "Mock runtime", gạch "Log request"; `modules/mock-runtime/request-log-model.ts` |
| P6 | Lịch sử API client: request như đã viết (biến giữ `{{var}}`), status, thời gian, kích thước; không header/body response | `system-architecture.md` "Dữ liệu API client theo user" (`client_history`) |
| P7 | Bộ đếm mock và proxy theo tháng | `modules/billing/usage-counter-model.ts` |
| P8 | Thông báo, cài đặt thông báo, địa chỉ push từng trình duyệt khi bật Web Push | `system-architecture.md` "Thông báo"; `push-subscription-model.ts` |
| P9 | Form góp ý: nội dung, tên, email hoặc Telegram tuỳ chọn, tài khoản nếu đăng nhập | `system-architecture.md` "Form góp ý / liên hệ"; `feedback/contact-message-model.ts` |
| P10 | Máy Tunelo đã liên kết: link token mã hoá, tên máy | `system-architecture.md` "`tunelo_links`"; `tunelo/tunelo-link-model.ts` |
| P11 | Log kỹ thuật: request id, method, route, status, ms; không header, cookie, body, query; proxy ghi thêm `sub` và host đích | `system-architecture.md` "Luồng request của api" (Log request) và "Proxy của API client" (Log) |
| P12 | Rate limit: bộ đếm theo hash IP/tài khoản, hết hạn theo cửa sổ | `apps/api/src/lib/rate-limit-windows.ts` |
| P13 | Không quảng cáo, không công cụ phân tích/theo dõi | grep `apps/web/src`, `apps/web/index.html`: không có gtag/analytics/posthog/sentry/… (kiểm 2026-10-20) |
| P14 | Local storage: ngôn ngữ, theme, trang đang mở, thứ tự sắp xếp, lựa chọn tunnel | `i18n/locale-preference.ts`, `lib/theme.ts`, `features/collections/page-storage.ts`, `use-collection-sort.ts`, `features/api-client/tunelo/auto-tunnel.ts` |
| P15 | Mục đích: chạy tính năng, hạn mức/rate limit/chống lạm dụng, bảo mật và sửa lỗi | suy từ P1–P12 |
| P16 | IdP `auth.hoandat.com` đăng nhập và gửi thông tin tài khoản; là dịch vụ riêng có trang tài khoản riêng | `system-architecture.md` "Đăng nhập và phiên"; repo `auth-next` |
| P17 | Cloudflare: DNS; chuyển lưu lượng web app và dashboard API (`localman` proxied); Turnstile cho form khi chưa đăng nhập; subdomain mock (`*.localman`) không qua Cloudflare | `docs/deployment-guide.md` bảng đầu (DNS); `system-architecture.md` "Form quan tâm gói Pro" (Turnstile cho khách) |
| P18 | Telegram: chỉ khi bật kênh Telegram thì nội dung thông báo gửi qua bot API; mọi lượt gửi form góp ý đẩy trích ≤ 300 ký tự và liên hệ đã che tới chat Telegram của owner | `system-architecture.md` "Thông báo" và "Form góp ý / liên hệ" |
| P19 | Dịch vụ push của trình duyệt chỉ khi bật Web Push | `system-architecture.md` "Thông báo" (Web Push) |
| P20 | Tunelo: chỉ khi dùng cùng Localman, đọc danh sách tunnel và gửi request tới app local qua tunnel | `system-architecture.md` "Đích nội bộ qua tunnel", "Tunnel theo tài khoản Tunelo" |
| P21 | Request proxy, upstream, callback, forward inbox đi tới địa chỉ người dùng đặt | `system-architecture.md` "Proxy của API client", "Mock lai", "Mock callback", "Webhook inbox" |
| P22 | Thời hạn: log mock 7 ngày (hạn mức thường) / 30 ngày (mở rộng), tối đa 20.000 dòng mỗi project | `requestLogDays` trong `packages/shared/src/plan-limits.ts`; `system-architecture.md` "Log request" |
| P23 | Lịch sử API client 90 ngày, 500 mục; thông báo 90 ngày | `system-architecture.md` "Dữ liệu API client theo user", "Thông báo" |
| P24 | Phiên hết sau 30 ngày không dùng, tối đa 90 ngày | `system-architecture.md` "Phiên" |
| P25 | Thùng rác collection 30 ngày | `system-architecture.md` "Collections" (Thùng rác, `trashDays`) |
| P26 | Tin góp ý giữ tới khi owner xoá | `system-architecture.md` "Form góp ý / liên hệ" ("Không có TTL") |
| P27 | Project không hoạt động 90 ngày có thể bị owner xoá khi chủ có hạn mức thường | `system-architecture.md` "Dọn project bỏ hoang" (`cleanup:abandoned`, mặc định 90 ngày, chạy tay) |
| P28 | Backup mỗi đêm, giữ 14 bản trên server, dữ liệu đã xoá còn tối đa 14 ngày | `docs/deployment-guide.md` bảng đầu, dòng Backup (cron 02:45, 14 bản, `/opt/localman/backups`) |
| P29 | Quyền: xuất collection/environment, sửa/xoá, chọn kênh thông báo, xoá tài khoản ở Tài khoản; xoá tài khoản IdP ở trang IdP | `system-architecture.md` (export v2.1, `exportEnvironment`, tuỳ chọn thông báo); ADR-0007; `auth-next/src/account-portal/account-delete-page.ts` (`/account/delete`) |
| P30 | Bảo mật: HTTPS; cookie phiên HttpOnly; token đăng nhập, secret, link token Tunelo mã hoá; token lời mời, access key, MCP token chỉ lưu hash | `system-architecture.md` "Phiên", "Environments và biến", "`tunelo_links`", "Cộng tác viên" (SHA-256), "Chia sẻ công khai" (`collection_access_keys` chỉ SHA-256); `mcp/mcp-token-model.ts` |

## Điều khoản (`legalTerms`)

| # | Claim | Nguồn |
|---|---|---|
| T1 | Đăng nhập bằng tài khoản IdP, không giữ mật khẩu; AI agent được cấp quyền hành động với quyền của user | P1; `system-architecture.md` "Localman MCP" (tool chạy dưới quyền user của token) |
| T2 | Localman miễn phí; hạn mức và mức dùng ở trang Tài khoản; có thể có hạn mức mở rộng một thời gian; hết thì không xoá gì, chỉ chặn mục mới vượt hạn mức | ADR-0002; `system-architecture.md` "Dùng thử Pro" ("Sau khi hết hạn") |
| T3 | "Hạn mức có thể thay đổi" | **owner** |
| T4 | Người dùng giữ quyền với nội dung; Localman chỉ xử lý để chạy tính năng | **owner** (khớp P15) |
| T5 | Ai biết URL mock gọi được mock API, kể cả thành viên đã gỡ; đổi URL để chặn | `system-architecture.md` "Projects" (Phân quyền, `rotateProjectSecret`) |
| T6 | Public link đọc được bởi ai có link; giá trị secret bị bỏ | ADR-0004 |
| T7 | Người được mời xem/sửa theo vai trò | `system-architecture.md` "Workspace, vai trò", "Cộng tác viên" |
| T8 | Có rate limit, hạn mức tháng, chặn mạng nội bộ và cổng mail | `system-architecture.md` "Proxy của API client" (SSRF, cổng 25/465/587) |
| T9 | Cấm vượt giới hạn, làm quá tải, tấn công | **owner** |
| T10 | Project không hoạt động 90 ngày, thùng rác 30 ngày | P25, P27 |
| T11 | Dịch vụ "như hiện có", có thể thay đổi/ngừng, không bảo đảm | **owner** |
| T12 | Xoá tài khoản bất cứ lúc nào; có thể khoá tài khoản vi phạm | ADR-0007; khoá tài khoản: **owner** (Localman chưa có chức năng khoá) |

## Trang xoá tài khoản (`legal.accountDelete`) và modal (`account.delete`)

| # | Claim | Nguồn |
|---|---|---|
| D1 | Các bước: đăng nhập, menu tài khoản → "Account and limits", mục "Delete account", gõ username | `components/layout/account-menu.tsx`; `features/account-deletion/` |
| D2 | Danh sách bị xoá (project kèm dữ liệu kể cả với người được chia sẻ, workspace cá nhân và workspace chỉ có mình, lịch sử, tab, cài đặt, thông báo, Web Push, bộ đếm, máy Tunelo thu hồi ở Tunelo, tin góp ý khi đăng nhập, mọi phiên) | ADR-0007 mục 4–5; `apps/api/src/modules/account-deletion/` và test cùng thư mục |
| D3 | Workspace team còn người khác: rời workspace, nội dung ở lại nhưng gỡ tên | ADR-0007 mục 3, 5 (ẩn danh) |
| D4 | Chặn khi là Admin duy nhất của workspace có thành viên khác | ADR-0007 mục 3 |
| D5 | Backup 14 ngày; thông báo người khác đã nhận giữ chữ tới 90 ngày; tin góp ý khi chưa đăng nhập không gắn được tài khoản | P28, P23; ADR-0007 "Đánh đổi" |
| D6 | Tài khoản IdP không bị xoá, link tới trang xoá của IdP | ADR-0007 mục 2 |
| D7 | Đăng nhập lại sau khi xoá tạo tài khoản mới rỗng | ADR-0007 "Đánh đổi" |
| D8 | Không đăng nhập được thì gửi yêu cầu qua "Góp ý / Liên hệ" | kênh có sẵn ("Form góp ý / liên hệ"); việc owner xử lý yêu cầu là **owner** |
| D9 | Liên hệ: Localman không có email liên hệ, dùng form | `system-architecture.md` "Form góp ý / liên hệ" ("Thay cho địa chỉ email liên hệ") |

## Cần owner quyết định trước khi deploy

1. **Người vận hành:** tên pháp lý (cá nhân/công ty) và địa chỉ đứng tên chính sách. Văn bản hiện chỉ nói "người vận hành Localman".
2. **Vị trí máy chủ** (server `.65`): quốc gia đặt máy. Repo không ghi.
3. **Thời gian giữ log pm2/nginx:** repo chỉ nói `pm2-logrotate` xoay log, không ghi số ngày; nginx access log (có IP) không được mô tả. Nếu có, cần thêm vào P11/P28.
4. **Độ tuổi tối thiểu** và **luật áp dụng / giải quyết tranh chấp**: không có trong repo nên chưa viết.
5. **Kênh liên hệ chính thức:** chỉ có form góp ý (không email). Store thường yêu cầu email hoặc URL hỗ trợ; cân nhắc thêm email.
6. Các dòng **owner** ở bảng Điều khoản (T3, T4, T9, T11, T12).
7. Quy tắc workspace/project khi xoá tài khoản và sự kiện `account.deleted` của IdP: xem "Câu hỏi mở" của ADR-0007.
8. Văn bản đang nói "Localman miễn phí" và tránh nhắc gói/giá theo ADR-0002; khi thương mại hoá phải sửa T2, P2, P22, P27.
