# Văn bản pháp lý công khai: danh sách claim và nguồn

> **Đã duyệt ngày 20/10/2026** bởi Jev (owner uỷ quyền), cho đăng như trang của chat. `LEGAL_EFFECTIVE_DATE` = 2026-10-20 (`apps/web/src/lib/legal.ts`). Các mục chưa có căn cứ hiện trong hộp "Đang cập nhật" của trang, không viết bịa; xem "Còn thiếu" ở cuối.

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
| P13 | Không quảng cáo, không công cụ phân tích/theo dõi trong app; trang web đếm lượt xem bằng Cloudflare Web Analytics, không cookie | grep `apps/web/src`, `apps/web/index.html`: không có gtag/analytics/posthog/sentry/… (kiểm 2026-10-20). Beacon Web Analytics do Cloudflare tự chèn ở edge, không nằm trong mã; CSP của `infra/localman/nginx/localman.hoandat.com.conf` cho `https://static.cloudflareinsights.com` (quyết định đồng bộ UX hệ sinh thái 26/10/2026; `LEGAL_EFFECTIVE_DATE` thành 2026-10-26) |
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
| P31 | "Máy chủ đặt tại Việt Nam", chỉ hiện cho dịch vụ hoandat.com (`isPrimaryService`) | Jev duyệt 20/10/2026: whois `<SERVER_65_IP>` → VN, iNET; cách lấy IP thật ở đầu `docs/deployment-guide.md` |
| P32 | Email liên hệ `quocdat254@gmail.com` (trên `/privacy`, `/terms`, `/account/delete`) | Jev duyệt 20/10/2026: địa chỉ công khai sẵn trên trang quyền riêng tư của Miu và trang của chat; `SUPPORT_EMAIL` ở `apps/web/src/lib/legal.ts` |
| P33 | Sau khi xoá chỉ giữ mã băm của account ID, để đăng nhập lại được hỏi trước khi tạo tài khoản mới và không được thêm hạn mức mở rộng | ADR-0007 mục 9 (Jev 20/10/2026); `apps/api/src/modules/account-deletion/deleted-account-model.ts` |
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
| T11 | Dịch vụ có thể thay đổi, gián đoạn, ngừng, tính năng có thể bị tắt (đã bỏ câu "như hiện có"/không bảo đảm: thuộc "giới hạn trách nhiệm", đang cập nhật) | cờ tính năng (`infra/localman/released-features`), cổng server ở `docs/deployment-guide.md`; Jev duyệt |
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
| D7 | Đăng nhập lại sau khi xoá được hỏi trước khi tạo tài khoản mới rỗng; giữ mã băm account ID | ADR-0007 mục 9 |
| D8 | Không đăng nhập được: gửi email tới địa chỉ liên hệ kèm username Localman và email tài khoản IdP (hoặc dùng form); không cam kết thời hạn | Jev duyệt 20/10/2026; P32 |
| D9 | Liên hệ: email (P32) hoặc form "Góp ý / Liên hệ" | P32; `system-architecture.md` "Form góp ý / liên hệ" |
| D10 | Modal xoá nêu số project đang chia sẻ và số người mất quyền vào chúng (`sharedProjects`, `projectMembers` của dry run) | ADR-0007 mục 4 (Jev 0.97) |

## Dữ liệu của bạn nằm ở đâu (`dataTransparency`, trang `/your-data`)

Thời gian giữ và các trường log không viết tay: trang đọc `@localman/shared/data-policy`, test của API và web giữ nguồn đó đúng với code (`docs/system-architecture.md`, mục "Chính sách dữ liệu một nguồn"). Nơi lưu và lời mô tả là chữ viết tay; bảng dưới là nguồn của chúng.

| # | Claim | Nguồn |
|---|---|---|
| Y1 | Giá trị riêng của biến secret mã hoá trong trình duyệt bằng passphrase; máy chủ chỉ giữ bản mã gắn tên và phạm vi, không mở được; quên passphrase là mất; giá trị lưu trước khi có kho còn mã hoá bằng khoá máy chủ tới lần đầu kho mở | `apps/web/src/features/secure-vault/vault-crypto.ts`, `vault-migration.ts`; `environments/local-vault-rules.ts`; ADR-0009 |
| Y2 | Khoá nằm trong bộ nhớ trình duyệt, không gửi đi | `vault-key-store.ts` (`CryptoKey` không trích xuất được, IndexedDB) |
| Y3 | Request gửi thẳng khi trình duyệt gửi được; khi tự chuyển một request mang secret hay credential sang proxy thì hỏi trước. Không hỏi khi tab đặt Proxy, host luôn cho phép, hay "Send through proxy" sau lần gửi lỗi (nêu ở phần ngoại lệ) | `api-client/routing/route-plan.ts`, `route-hops.ts`, `routed-response-panel.tsx`, `sensitive-parts.ts`, `secret-consent-modal.tsx`; E2E `api-client-routing.spec.ts` |
| Y4 | Request đã điền biến và response của lượt gửi thẳng không tới máy chủ; lịch sử giữ request như đã viết (credential gõ thẳng bị để trống), status, thời gian, kích thước, nơi dừng sau redirect (không query), chỉ khi URL gửi đi đúng như đã viết (không biến, script không đổi) | `workbench/record-send.ts` (`redirectedTo`, `redactDraft`); `history-service.ts`; E2E `secret-vault.spec.ts` kiểm mọi trao đổi với máy chủ |
| Y5 | Tab request lưu như đã viết; credential gõ thẳng được lưu như đã gõ | `api-client/draft-*.ts` (draft không qua `redactDraft`) |
| Y6 | Proxy gửi giúp rồi chuyển response lại, không lưu; request tới ứng dụng trên máy đi qua tunnel Tunelo, web server của tunnel ghi path và query | `proxy-operations.ts` (không ghi DB); `local-target-route.ts`; `infra/tunelo/nginx.conf` (log mặc định `combined`) |
| Y7 | Secret cho agent dùng: bản sao mã hoá bằng khoá máy chủ, chỉ cho host đã liệt kê, không cho agent xem, che trong câu trả lời; giá trị dưới 4 ký tự hay bị API biến đổi có thể lọt | ADR-0009; `agent-secret-destination.ts`, `secret-mask.ts`; mô tả tool `send_request` |
| Y8 | Giá trị dùng chung của secret trong environment và globals mã hoá bằng khoá máy chủ, Viewer không nhận; biến secret của collection lưu nguyên dạng, ai mở được collection đều nhận, chỉ che trên UI và để trống ở export, link công khai, agent | `system-architecture.md` mục "Secret" (`sharedHidden`) và "Import/export Collection v2.1" (`collection-secret-mask.ts`); `collections/collection-model.ts` |
| Y9 | Log request mock gồm request, response, query, header, body; Authorization, Cookie, Set-Cookie, X-API-Key và header tự chọn thành `[redacted]` | như P5 |
| Y10 | Log của máy chủ: chỉ các trường `REQUEST_LOG_FIELDS` (route mock là path với secret bị che); lỗi thêm một dòng ghi lỗi | `apps/api/src/http/request-log.ts`, `mock-runtime/mock-http.ts` (`mockRouteOf`), `http/error-handler.ts`; `http/request-log-policy.test.ts` |
| Y11 | Log của web server phía trước: IP, thời điểm, method, path (query ẩn), status, kích thước, trình duyệt, thời gian; không host, Referer, cookie | `infra/localman/nginx/localman-http.conf` (`log_format localman`); `http/request-log-policy.test.ts` |
| Y12 | Log của proxy: chỉ các trường `PROXY_LOG_FIELDS`; host đích che secret mà trình duyệt điền vào host (`logMask` của envelope) hay máy chủ điền cho agent, và nhãn secret của host mock | `packages/shared/src/api-client/proxy-envelope.ts` (`logMask`); `proxy-operations.ts`, `proxy-log-policy.test.ts` |
| Y13 | Sao lưu hằng đêm toàn bộ cơ sở dữ liệu trên cùng máy chủ | `legalPrivacy.retention` (Backups); `infra/localman/backup-localman-db.sh` |
| Y14 | Không dịch vụ phân tích, theo dõi, báo lỗi; không quảng cáo | như P13; `apps/web/src/lib/no-telemetry.test.ts` quét mã nguồn web, api và packages |

## Quyết định của Jev (20/10/2026)

- Các dòng **owner** ở bảng trên (T3, T4, T9, T12) được duyệt đăng như hiện có; T11 đã bỏ phần trách nhiệm.
- Email liên hệ và đường xoá không cần đăng nhập bằng email (P32, D8); vị trí máy chủ Việt Nam chỉ cho hoandat.com (P31).

## Còn thiếu (hộp "Đang cập nhật" trên trang)

Không có căn cứ trong repo hay quyết định nào, nên trang chỉ liệt kê, không viết nội dung:

1. **Pháp nhân vận hành** (tên, địa chỉ) — `/privacy`, `/terms`.
2. **Độ tuổi tối thiểu** — `/privacy`, `/terms`.
3. **Giới hạn trách nhiệm** — `/terms`.
4. **Luật áp dụng và giải quyết tranh chấp** — `/terms`.
5. **Thời gian giữ log server** (pm2-logrotate chưa ghi số ngày; nginx access log có IP chưa được mô tả) — `/privacy`.

Khi có quyết định: thêm section, bỏ mục tương ứng khỏi `pending` trong `pages/legal/legal-page.tsx`, đổi `LEGAL_EFFECTIVE_DATE`, và thêm dòng nguồn vào bảng trên. Văn bản tránh nhắc gói/giá theo ADR-0002; khi thương mại hoá phải sửa T2, P2, P22, P27.
