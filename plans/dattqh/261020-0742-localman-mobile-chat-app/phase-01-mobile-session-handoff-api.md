---
title: "Phase 1: Đăng nhập cho app native (session handoff)"
status: todo
tier: M
---

# Phase 1: Đăng nhập cho app native (session handoff)

## Context Links

- Red-team: `../reports/red-team-261020-0742-mobile-app-plan.md`
- Scout, mục Auth: `../reports/scout-261020-0737-mobile-app-context.md`
- `apps/api/src/modules/auth/auth-module.ts:135` (`csrfExempt`), `:150-155` (authenticate chỉ đọc cookie)
- `apps/api/src/modules/auth/auth-routes.ts:140-158` (callback xoá session cũ theo cookie rồi tạo session mới)
- `apps/api/src/modules/auth/session-store.ts:46-80` (chỉ lưu SHA-256 của token)
- `apps/api/src/modules/auth/login-transaction.ts`, `token-cipher.ts`, `session-refresher.ts`, `backchannel-logout-route.ts`
- `apps/api/src/http/csrf-guard.ts:24-48`, `apps/api/src/http/require-auth.ts:85-87`
- `apps/api/src/operations/protocol-routes.ts` (`PROTOCOL_ROUTES`)
- `apps/api/src/tenancy/tenant-models.test.ts`
- ADR mới: `docs/decisions/0005-mobile-session-handoff.md` (theo `0000-adr-template.md`)

## Overview

API dashboard hiện chỉ nhận cookie `__Host-lm_session`. Phase này thêm một đường cho app native mà không đưa token IdP xuống điện thoại. Callback về app dùng **link https đã xác minh** (Universal Links trên iOS, App Links trên Android), nên chỉ app do mình ký mới nhận được.

1. App tạo `state` và PKCE, rồi mở `GET /auth/login?client=mobile&state=<s>&code_challenge=<c>` bằng plugin native của vỏ Capacitor (phase 3): `ASWebAuthenticationSession` với callback https trên iOS, Auth Tab (hoặc Custom Tabs) trên Android. Không bao giờ mở trong WebView.
2. Server lưu `client`, `appState` và `codeChallenge` vào login transaction. Luồng mobile luôn tương tác: bỏ qua `prompt=none` và không thử đăng nhập im lặng.
3. Callback OIDC thành công thì server **không** tạo session và **không** đụng cookie session web hiện có. Server mã hoá bộ token IdP bằng `tokenCipher`, lưu vào bản ghi handoff (`codeHash`, `sub`, `sid`, token đã mã hoá, `codeChallenge`, `appState`, hết hạn sau 60 giây), rồi hiện một trang xác nhận do server render: "Mở Localman trên điện thoại với tài khoản <email>?".
4. Người dùng bấm Tiếp tục thì redirect tới `https://<tenant host>/m/auth/callback?code=<h>&state=<s>`. Link này được xác minh qua `/.well-known/apple-app-site-association` và `/.well-known/assetlinks.json`, nên hệ điều hành mở app của mình. Bấm Huỷ thì xoá handoff.
5. App gọi `POST /auth/mobile/token` với `code` và `code_verifier`. Server chạy `findOneAndDelete` theo `codeHash` để mã chỉ dùng được một lần, kiểm tra hạn và PKCE S256, rồi mới tạo session trong `SessionStore` (cờ `client: "mobile"`) và trả token gốc cùng `expiresAt` trong body.
6. Mọi request sau đó gửi `Authorization: Bearer <token>`. Khi có header Bearer, `authenticate` chỉ dùng Bearer và không đọc cookie.
7. `POST /auth/mobile/logout` xoá session theo Bearer và đóng các SSE stream của session đó.
8. Lỗi ở bất kỳ bước nào của luồng mobile đều redirect về `https://<tenant host>/m/auth/callback?error=<code>&state=<s>`, để người dùng không bị kẹt trong trình duyệt.

## Key Insights

- Trình duyệt chỉ cho phép một app nhận callback https khi domain đã khai báo app đó (ký bằng team ID hoặc SHA-256 cert). Nhờ vậy, app độc hại tự mở luồng đăng nhập cũng không nhận được mã. Với custom scheme thì không chặn được, vì IdP có SSO nên luồng chạy hết mà không cần người dùng làm gì.
- Trang xác nhận và việc bỏ `prompt=none` bảo đảm luồng mobile luôn cần một thao tác của người dùng.
- Không thể trả token từ bản ghi chỉ có hash, nên session chỉ được tạo khi đổi mã. Cách này cũng tránh để lại session 30 ngày bị bỏ dở.
- Callback hiện xoá session web theo cookie (`auth-routes.ts:149-154`). Cookie Strict vẫn được gửi vì IdP và Localman cùng site. Vì vậy nhánh mobile phải bỏ qua bước xoá này.
- `POST /auth/mobile/token` không có Bearer và không có Origin, nên phải nằm trong `csrfExempt`. Các request khác mang Bearer và không có cookie session thì được bỏ qua kiểm tra Origin. Lý do: trình duyệt không tự đính kèm header Authorization và dashboard API không bật CORS. Phải có test hồi quy khẳng định dashboard API không trả header CORS. App Capacitor gọi API qua `CapacitorHttp` (request native, không chịu CORS), nên giữ được chính sách này.
- Session mobile có scope `user`, ngang session trình duyệt (`require-auth.ts:85-87`). Nó đọc được secret giống web, và điều này phải ghi trong ADR. Logout ở IdP qua backchannel cũng kết thúc session mobile vì dùng chung `sid`; ADR ghi đây là hành vi mong muốn.
- SSE log stream đi qua `resolveAuth`, nên tự nhận Bearer. Mỗi người dùng tối đa 5 stream; phía app phải đóng stream khi app vào background (phase 4).
- Khi kiểm tra PKCE: `code_challenge` S256 luôn dài đúng 43 ký tự base64url, còn `code_verifier` dài 43–128 ký tự.

## Requirements

- Chỉ chấp nhận đường callback `/m/auth/callback` trên đúng host của tenant; không nhận redirect URI tuỳ ý.
- Mã handoff dùng một lần, TTL 60 giây, lưu dạng hash và gắn tenant (`tenantScopePlugin` sau mọi `schema.index`, trước `mongoose.model`).
- `/auth/mobile/token` dùng `ipRateLimit` (trả JSON 429), không dùng `loginRateLimit` (trả redirect).
- Đăng ký các route mới trong `PROTOCOL_ROUTES`.
- Không log token, mã handoff, `code_verifier` hay token IdP.
- Lỗi JSON theo dạng `{ error: { code, message } }`, với mã mới `MOBILE_HANDOFF_INVALID` và `MOBILE_HANDOFF_EXPIRED`.
- Phục vụ `apple-app-site-association` và `assetlinks.json` theo từng tenant; team ID và cert fingerprint lấy từ env (`MOBILE_IOS_APP_ID`, `MOBILE_ANDROID_CERT_SHA256`). Khi chưa cấu hình env thì trả 404 và luồng mobile tắt.
- Trang xác nhận và trang `/m/auth/callback` (trang dự phòng khi máy chưa cài app) có chuỗi đi qua i18n của server và có thể chặn nhúng bằng `frame-ancestors 'none'`.
- Hành vi cookie web không đổi; mọi test auth hiện có vẫn xanh.

## Architecture

```
App ──ASWebAuthenticationSession──▶ /auth/login?client=mobile&state&code_challenge
                                      └▶ IdP (luôn tương tác) ──▶ /auth/callback
                                            mã hoá token IdP vào handoff, không tạo session
                                            ──▶ trang xác nhận ──Tiếp tục──▶
App ◀── https://<tenant>/m/auth/callback?code&state (Universal/App Link) ◀──┘
App ──POST /auth/mobile/token {code, verifier}──▶ findOneAndDelete, PKCE, tạo session ──▶ token
App ──Authorization: Bearer──▶ /api/v1/*  và  /api/v1/projects/:id/request-logs/stream
```

## Related Code Files

- Sửa: `apps/api/src/modules/auth/auth-routes.ts`, `login-transaction.ts`, `auth-module.ts` (`csrfExempt`, authenticate), `session-model.ts`, `session-store.ts`
- Sửa: `apps/api/src/http/csrf-guard.ts` (predicate Bearer không kèm cookie)
- Sửa: `apps/api/src/operations/protocol-routes.ts`
- Tạo: `apps/api/src/modules/auth/mobile-handoff-model.ts`, `mobile-handoff-routes.ts`, `mobile-confirm-page.ts`, `app-link-association.ts`
- Tạo test: `mobile-handoff.test.ts`, `apps/api/src/http/csrf-guard-bearer.test.ts`, `apps/api/src/http/no-cors.test.ts`
- Sửa: `apps/api/src/tenancy/tenant-models.test.ts`
- Tạo: `docs/decisions/0005-mobile-session-handoff.md`; sửa `docs/system-architecture.md` (mục Auth) và `docs/deployment-guide.md` (env mới)

## Implementation Steps

1. Viết ADR 0005 gồm: phương án đã chọn và phương án bị loại (IdP public client, custom scheme), threat model (app độc hại tự mở luồng, chặn mã, CSRF, login CSRF qua `state`, token trên máy), quyền của session mobile, quan hệ với logout ở IdP.
2. Model handoff gắn plugin tenant và TTL index; cập nhật `tenant-models.test.ts`.
3. Login transaction thêm `client`, `appState`, `codeChallenge`; kiểm tra định dạng; với `client=mobile` thì bỏ qua `prompt=none`.
4. Nhánh callback cho mobile: không xoá session web, mã hoá token vào handoff, render trang xác nhận; khi lỗi thì redirect về callback của app kèm `error`.
5. `POST /auth/mobile/token`: `findOneAndDelete`, kiểm tra hạn và PKCE, tạo session, trả token. Thêm route này vào `csrfExempt`, gắn `ipRateLimit`, đăng ký trong `PROTOCOL_ROUTES`.
6. `authenticate` ưu tiên Bearer; CSRF guard thêm predicate Bearer không kèm cookie.
7. `POST /auth/mobile/logout`: xoá session và đóng các stream của session đó.
8. Phục vụ hai file association theo tenant, lấy giá trị từ env.
9. Viết test cho: luồng đầy đủ; mã hết hạn; dùng lại mã (hai lần redeem đồng thời chỉ một lần thành công); sai verifier; sai tenant; `prompt=none` bị bỏ qua; session web còn nguyên sau khi đăng nhập mobile; Bearer kèm cookie từ origin lạ vẫn bị 403; Bearer sai trả 401; SSE nhận Bearer; dashboard không trả header CORS.
10. Chạy SAST (`/ak:security`) cho module auth khi kết thúc phase. DAST làm sau khi deploy (phase 7).

## Todo

- [ ] ADR 0005
- [ ] Model handoff và test tenant
- [ ] Nhánh login và callback cho mobile, trang xác nhận
- [ ] Endpoint token và logout, csrfExempt, rate limit, PROTOCOL_ROUTES
- [ ] Bearer trong authenticate và CSRF guard
- [ ] File association theo tenant
- [ ] Test và SAST
- [ ] Cập nhật system-architecture và deployment-guide

## Success Criteria

- Các test mới xanh khi chạy riêng: `pnpm vitest run apps/api/src/modules/auth/mobile-handoff.test.ts apps/api/src/http/csrf-guard-bearer.test.ts apps/api/src/http/no-cors.test.ts`.
- Các test auth hiện có (`auth-flow`, `auth-hardening`, `session-lifecycle`, `backchannel-logout`, `silent-sign-in`) vẫn xanh trên CI.
- `pnpm lint && pnpm typecheck` sạch, CI xanh, SAST không có phát hiện mức cao.

## Risk Assessment

- **Sheet đăng nhập trên iOS không tự đóng với callback https (đã có báo cáo):** thử trên máy thật iOS 17.4+ ở phase 3. Nếu lỗi tái hiện, trang `/m/auth/callback` có nút "Mở app" làm đường dự phòng.
- **Máy iOS dưới 17.4:** app đặt deployment target iOS 17.4; ghi rõ trong tài liệu.
- **Nới CSRF quá rộng:** predicate yêu cầu Bearer và không có cookie, có test riêng và test hồi quy không-CORS.
- **Thay đổi auth đụng web:** nhánh mobile tách theo `client`; test hiện có bảo vệ nhánh web.

## Security Considerations

Token chỉ trả một lần trong body của POST, không bao giờ nằm trên URL. Token IdP nằm ở server và được mã hoá. Mã handoff chỉ lưu dạng hash và dùng một lần. Có rate limit, và không log giá trị bí mật.

## Next Steps

Phase 3 dùng các endpoint này. Phase 7 deploy, cấu hình env association, rồi chạy DAST.
