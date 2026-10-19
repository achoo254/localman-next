# DAST: tunnel theo tài khoản Tunelo (`tuneloAccounts`) trên prod

**Ngày:** 2026-10-19 · **Release:** `20261017-162354-0322effc5e7a` (commit `0322eff`, không `-dirty`, CI xanh; deploy 2026-10-17 23:24 theo yêu cầu của user) · **Cổng:** `TUNELO_ACCOUNTS_ENABLED=true` (bản sao `.env.bak-20261017-162347-tunelo-accounts`), cờ web `tuneloAccounts` · **Kết luận DAST:** ĐẠT (0 Critical, 0 High, 0 Medium; 2 Low, 1 Info) · **SAST:** đạt sau khi sửa (`code-reviewer-261017-2130-tunelo-auto-claim-sast.md`).

## Phạm vi và cách đo

Đo từ ngoài qua `https://localman.hoandat.com` với phiên trình duyệt thật của user (Chrome, fetch cùng origin), Tunelo production thật (`https://tunnel.hoandat.com`), CLI `tunelo` 1.9.0 trên máy dev mở tunnel tới một server echo cục bộ (`localhost:4791`, trả `method` và `path`). Dữ liệu Mongo đọc bằng `prod-mongosh.sh`, chỉ in số đếm và tên trường. Token thử là chuỗi giả `dast-fake-token-1019`. Tunnel, server echo và các lượt liên kết thử đã dọn sau khi đo.

## Kết quả

| # | Kiểm | Kết quả |
|---|---|---|
| 1 | Không đăng nhập: `GET /client/local-tunnels`, `GET /client/tunnel-links` | 401 (route có, không phải 404) |
| 2 | Ghi với `Origin: https://evil.example` hoặc không `Origin`: `POST /client/tunnel-links`, `DELETE /client/tunnel-links/:id`, `POST /client/tunnel-links/:id/poll` | 403 `CSRF_REJECTED` |
| 3 | `local-tunnels` theo tài khoản thật | 200, 2 tunnel của tài khoản trên máy khác (`source: account`), `failures: []` |
| 4 | Tunnel ẩn danh của máy chưa liên kết | Không xuất hiện trong danh sách |
| 5 | Gửi `GET http://localhost:4791/users?x=1` (Auto) khi có đúng 1 tunnel tài khoản cho cổng | Tự gửi qua `https://lmdast4791.tunnel.hoandat.com`, badge "Qua Tunelo · Hoans-Mac-mini.local", 200, path và query giữ nguyên |
| 6 | Tắt tunnel rồi gửi lại | "Tunnel của localhost:4791 đã dừng", panel Tunelo mở lại |
| 7 | Bật lại tunnel, bấm nút trong panel một lần | Gửi qua tunnel, 200, có badge |
| 8 | Bearer giả, chọn Proxy, tới localhost (tunnel do router tự tìm) | Hỏi "Gửi qua proxy?" kèm đích; Huỷ thì "Chưa gửi… Chưa có gì được gửi"; đồng ý thì 200 |
| 9 | Input sai: `port=abc`, `port=70000` | 400 |
| 10 | Xoá và poll id không thuộc user | 404 `NOT_FOUND` |
| 11 | 6 lượt bắt đầu liên kết liên tiếp (mỗi lượt poll rồi huỷ) | 5 lượt 200, lượt 6 là 429 `RATE_LIMITED` |
| 12 | Response của bắt đầu và poll | Chỉ `id`, `code`, `expiresAt` và `status`; không có token, `requestId` |
| 13 | Huỷ liên kết đang chờ trên giao diện | Hộp thoại đóng, danh sách liên kết rỗng |
| 14 | Mongo `tunelo_links` sau khi dọn | 0 dòng; chỉ mục `tenantId_1_userSub_1_createdAt_1`, `pendingUntil_1` |
| 15 | Log `localman-api` và nginx | 0 lần xuất hiện token thử; 0 dòng chứa bearer hay token; 0 dòng mức error/fatal từ lúc deploy |
| 16 | Restart `localman-api` | 40 trước deploy, 41 sau (lần reload của deploy); 2026-10-19 08:2x vẫn 41, `online`, `/healthz` :4000 và :4100 `db: connected`; cổng 4000, 4100, 27018 chỉ nghe loopback |

## Không đo được trên prod

- **Hai tunnel cùng cổng thì hỏi chọn:** tài khoản đã chạm hạn mức tunnel của Tunelo (2 tunnel OneDash đang phục vụ hệ thống khác cộng 1 tunnel thử); không tắt tunnel OneDash. Trường hợp này chỉ có E2E với Tunelo giả (`api-client-tunelo-accounts.spec.ts`).
- **Liên kết máy ẩn danh bằng mã:** token ẩn danh của máy thử là loại cũ không gắn máy, Tunelo trả `TUNELO_LINK_004`; luồng đăng nhập ẩn danh bằng thiết bị đã đóng ở `AUTH_MODE=hybrid` nên không tạo được token gắn máy mới. Mở mã, poll, huỷ và giới hạn đã đo (mục 11–13); bước `tunelo link` thành công chỉ có E2E.

## Phát hiện

- **Low, Tunelo CLI 1.9.0: `tunelo link` từ chối máy có phiên tài khoản không dùng được cho server hiện tại.** `cli-link-command.ts` chỉ kiểm `config.session` có hay không, còn `tunelo http` (`resolveCredential`) chỉ dùng phiên khi `acceptsAccountToken(server, session.issuer)`. Máy có phiên cũ của `auth.inetdev.io.vn` (trước khi đổi domain ngày 13/10) mở tunnel bằng token ẩn danh nhưng `tunelo link` lại báo "Not needed: you are signed in". Sửa: dùng cùng điều kiện `acceptsAccountToken` trong `anonymousContext()`, và nhắc `tunelo login` khi phiên thuộc server khác. Máy thử đã được sửa bằng `tunelo login --force --server https://tunnel.hoandat.com`. **Đã sửa** ở commit `e77f2ae`, phát hành `tunelo@1.9.1` ngày 2026-10-19 (tag `tunelo-v1.9.1`, workflow OIDC xanh, `npx tunelo@1.9.1 --version` = 1.9.1).
- **Low, chữ trên giao diện:** thông báo tunnel đã dừng bảo "rồi bấm kiểm tra lại" nhưng nút trong panel ghi "Gửi lại". Sửa: đồng nhất chữ trong `api-client-tunelo*` (en, vi, zh-CN). **Đã sửa** ở commit `e77f2ae`; lên production ở release `20261019-030839-98267df7b894` (2026-10-19, bundle có câu "then click Send again").
- **Info:** ô URL vẽ `http://` thành `http: /` do ligature của font monospace với `//`; giá trị thật đúng. Có từ trước, không thuộc đợt này.
