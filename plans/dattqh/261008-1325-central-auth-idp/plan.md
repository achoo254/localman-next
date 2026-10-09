---
title: "Xác thực tập trung auth.hoandat.com (OIDC IdP) cho Localman và Tunelo"
description: "Một nơi đăng nhập duy nhất cho mọi sản phẩm cá nhân: IdP OpenID Connect tự host, không dùng email, phục vụ Localman web, Localman MCP, Tunelo CLI và Tunelo web."
status: pending
priority: P1
effort: "L (3 phase: 2×M, 1×L)"
branch: ""
tags: [feature, auth, infra, security]
blockedBy: []
blocks: ["plans/dattqh/261008-1123-localman-core", "plans/dattqh/261008-1156-tunelo-accounts-and-tunnel-list"]
created: 2026-10-08
---

# Xác thực tập trung `auth.hoandat.com`

## Outcome
User đăng nhập **một lần** tại `auth.hoandat.com` là vào được Localman web (`localman.hoandat.com`), Tunelo CLI (`tunelo login`) và trang web của Tunelo (`tunnel.hoandat.com`). Coding agent dùng MCP của Localman cũng xác thực qua đây. Hai domain khác nhau nên dùng **OpenID Connect với redirect**, không dùng cookie chung.

## Quyết định (user yêu cầu 2026-10-08; Jev `jev-1.13.0` quyết)

| Câu hỏi | Lựa chọn | Xác suất |
|---|---|---|
| Kiến trúc | Tự dựng OIDC IdP: Node, MongoDB, một trang đăng nhập | 1.00 |
| Domain | `auth.hoandat.com` (domain trung lập cho mọi sản phẩm cá nhân) | 0.97 |
| Token ẩn danh hiện có của Tunelo | Vẫn chạy; CLI nhắc `tunelo login` để gắn máy vào tài khoản; sau 60 ngày thì token ẩn danh không mở tunnel được nữa | 0.99 |
| Localman liệt kê tunnel | Theo tài khoản qua OIDC là mặc định; giữ `tunelo link <code>` cho máy chưa gắn tài khoản | 0.56 |
| IdP có được dùng dịch vụ gửi mail miễn phí của bên thứ ba không | Jev nói **có** (0.71), nhưng **không áp dụng**, vì trái quy tắc "không có mail server, chuyển sang kênh thông báo" user vừa đặt. Ghi lại thành câu hỏi mở cho user | — |

Các quyết định không dùng email đã có cũng chuyển về IdP (Jev, 2026-10-08):
- Quên mật khẩu: mã khôi phục, link reset qua Telegram, hoặc đăng nhập Google/GitHub đã liên kết.
- Email là tên đăng nhập nhưng "chưa xác minh" nếu không đến từ Google/GitHub.

**Thư viện:** [`oidc-provider`](https://github.com/panva/node-oidc-provider) của panva. Thư viện này được OpenID Foundation chứng nhận, hỗ trợ sẵn Device Authorization Grant (RFC 8628), PKCE, Dynamic Client Registration, revocation, introspection, RP-initiated logout và resource indicators (RFC 8707, cần cho audience riêng của Tunelo và Localman MCP). Chọn thư viện có chứng nhận thay vì tự viết giao thức là quyết định kỹ thuật, AI tự quyết.

## Kiến trúc

```
auth.hoandat.com  (repo riêng `achoo254/hoandat-auth`, tạo khi bắt đầu plan này, Express 5 + oidc-provider + Mongo)
├─ /.well-known/openid-configuration, /jwks, /authorize, /token, /userinfo, /device, /token/revocation, /token/introspection, /reg (đường dẫn thật lấy từ discovery)
├─ UI: đăng nhập (email/password, Google, GitHub), đăng ký, mã khôi phục, liên kết Telegram, quản lý phiên và ứng dụng đã cấp quyền
└─ Client:
   ├─ localman-web     confidential, Authorization Code + PKCE, scope openid profile email
   ├─ localman-mcp     resource server; client MCP đăng ký động (DCR) hoặc dùng Client ID Metadata Document
   ├─ tunelo-cli       public, Device Authorization Grant, audience tunelo, scope tunnels:open tunnels:read
   └─ tunelo-web       confidential, cho trang web và trang approve của Tunelo
```

Access token là JWT ngắn hạn (15 phút), ký bằng ES256, có `aud` theo từng resource. Refresh token xoay vòng. Mỗi app tự xác minh token bằng JWKS, không gọi IdP ở mỗi request.

## Phases

| # | Phase | Tier | Phụ thuộc |
|---|---|---|---|
| 01 | [IdP lõi: OIDC, client, key, deploy](phase-01-idp-core.md) | M | — |
| 02 | [Tài khoản và đăng nhập không dùng email](phase-02-accounts-and-login.md) | L | 01 |
| 03 | [Tích hợp Localman, Tunelo, MCP](phase-03-integrations.md) | M | 02 |

**Thứ tự với các plan khác:** plan này chạy **trước** phase 02 của Localman và **trước** plan Tunelo. Localman phase 02 thu gọn lại thành "OIDC client và thông báo".

## Acceptance
1. Đăng nhập tại `auth.hoandat.com` một lần rồi mở `localman.hoandat.com` thì vào thẳng, không hỏi lại. Chạy `tunelo login` thì trình duyệt chỉ hỏi "Cho phép thiết bị này?" vì đã có phiên. Đăng xuất ở IdP thì cả hai app mất phiên (RP-initiated cùng back-channel logout).
2. Không có route nào gửi email; không có cấu hình SMTP.
3. Trang approve của Tunelo **bắt buộc đăng nhập** (vá lỗ hiện tại: ai có link cũng duyệt được).
4. Token của Localman không dùng được cho Tunelo và ngược lại, nhờ kiểm `aud`.
5. Bộ kiểm conformance của OpenID (profile Basic OP và Config OP) pass trên staging. `pnpm test` và lint sạch.

## Rủi ro
| Rủi ro | Giảm thiểu |
|---|---|
| IdP sập thì mọi app không đăng nhập được | App vẫn xác minh JWT bằng JWKS đã cache (phiên đang có vẫn chạy); healthcheck và restart tự động; backup Mongo hằng ngày |
| Lộ khoá ký | Key nằm trong file secret trên VPS (không commit), xoay vòng bằng JWKS nhiều key; ghi ADR |
| Chiếm tài khoản qua email chưa xác minh | Chỉ tự liên kết provider với email đã xác minh; lời mời của app không dựa vào email chưa xác minh |
| Thêm một dịch vụ phải vận hành | Một container nhỏ dùng chung Mongo và Docker Compose với Localman; chung quy trình deploy |

## Rollback
Lúc chuyển: Localman chưa có user thật nên đổi thẳng. Tunelo giữ đường token ẩn danh trong 60 ngày (grandfather), nên nếu IdP lỗi thì tắt nhánh OIDC bằng cờ `AUTH_MODE=legacy` và CLI cũ vẫn chạy.

## Validation Log

### Vòng 1: khi cook phase 01–02 (2026-10-08, Jev `jev-1.13.0`)
- Bỏ `arctic` (npm đánh dấu ngừng hỗ trợ từ 07/2026), dùng `openid-client` cho Google/GitHub (1.00).
- Phiên có refresh token trượt 30 ngày theo lần dùng, trần 90 ngày kể từ lúc đăng nhập (0.78).
- Email chưa xác minh bị chiếm trước: đăng nhập Google/GitHub có email đã xác minh lấy lại email đó; tài khoản chiếm trước vẫn dùng được bằng username (0.95).
- Đổi mật khẩu ở `/account`: đăng xuất mọi phiên trình duyệt khác, kèm ô "đăng xuất mọi thiết bị và ứng dụng" bật sẵn (0.80). Đặt lại mật khẩu thì luôn thu hồi tất cả.
- Sau mỗi lần đặt lại mật khẩu: trang rà soát bảo mật bắt buộc, chỉ vào được bằng mật khẩu mới, liệt kê mọi phương thức đã liên kết kèm nút gỡ (0.93).
- Refresh token của `localman-web` gắn với phiên IdP, không xin `offline_access`: đăng xuất ở IdP tự huỷ grant, không phụ thuộc back-channel của Localman (0.94).
- Audit có thêm `grant.created` khi duyệt thiết bị Tunelo và khi consent client MCP bên thứ ba (0.96).
- Review bảo mật 4 vòng; quy tắc cuối: mọi token một lần gắn tài khoản mang `securityVersion` và kênh cấp, ghi có điều kiện theo version (ADR 0002 mục 10 trong repo `hoandat-auth`).

### Vòng 2: hạ tầng đợt 0 (2026-10-09)
- User chỉ định server `.65` cho cả IdP và DB. Jev chọn chạy theo quy ước sẵn có của server (1.00): pm2 ở `/var/www/hoandat-auth`, nginx một file cho mỗi hostname, mongod native dùng chung với database `auth` và user `auth` chỉ có `readWrite`. Không dựng replica set Docker mới; chuyển mongod sang replica set để ở phase Localman đầu tiên cần transaction.
- Mật khẩu user `root` cũ của Mongo không còn lưu ở đâu. Theo yêu cầu của user, tạo admin mới `hoandat_admin` (role root) bằng cách restart mongod tạm tắt auth, chỉ nghe 127.0.0.1, gián đoạn khoảng 5 giây; trước đó backup `admin.system.users`. User `root` cũ giữ nguyên. Thông tin admin lưu ở file server ngoài repo.
- DNS `auth.hoandat.com` tạo qua MCP Cloudflare (proxied; zone SSL "full", origin dùng chứng chỉ tự ký chung của server). API token Cloudflare trong file token đã hết hiệu lực.
- Bot Telegram `@auth_hoandat_bot` do user tạo; đã bật webhook có secret. Google/GitHub chờ user tạo OAuth app.
- Backup database `auth` hằng ngày 02:30, giữ 14 ngày.
- 2026-10-09: chặn MongoDB 27017 từ Internet theo yêu cầu của user. iptables (lưu ở `/etc/sysconfig/iptables`, đã backup) chỉ còn cho `127.0.0.1`, chính server `103.72.98.65`, mạng Docker `172.16.0.0/12` và hai IP mạng công ty `123.25.21.12`, `103.57.222.248`; mọi nguồn khác bị DROP. Trước đó log cho thấy nhiều IP lạ quét và thử đăng nhập. Rule cũ cho `113.190.138.121` truy cập mọi cổng vẫn giữ nguyên.

## Câu hỏi mở
- Nếu sau này muốn có xác minh email hoặc reset mật khẩu qua email, có thể cắm một dịch vụ gửi mail miễn phí (ví dụ Brevo, Resend) vào IdP mà không đổi app nào. Jev nghiêng về có (0.71), nhưng plan giữ quy tắc "không gửi mail" cho tới khi user đồng ý.
