# ADR-0005: Đăng nhập cho app native bằng session handoff, Bearer session và CORS cho WebView

- **Ngày:** 2026-10-23
- **Trạng thái:** Đã chốt; Jev duyệt ngày 23/10/2026 (app Localman bọc toàn bộ web `apps/web` trong Capacitor)
- **Người quyết định:** dattqh. Thiết kế gốc: plan `plans/dattqh/261020-0742-localman-mobile-chat-app/` (phase 1, đã qua red-team); hướng app: `hoandat-app/plans/dattqh/261023-0620-mobile-apps-all-products/plan.md`.

## Bối cảnh

API dashboard chỉ nhận cookie `__Host-lm_session` (SameSite=Strict, same-origin). App iOS/Android là vỏ Capacitor chạy chính web Localman trong WebView có origin `capacitor://localhost` (iOS) hoặc `https://localhost` (Android), tức khác origin với `https://localman.<domain>`: cookie không đi theo, và trình duyệt chặn đọc response nếu API không trả CORS. App không dùng `CapacitorHttp` vì log request trực tiếp là SSE và `CapacitorHttp` không stream được body; app gọi bằng `fetch` của WebView và đọc SSE bằng `fetch`.

Đăng nhập phải diễn ra trong trình duyệt hệ thống (`ASWebAuthenticationSession` trên iOS, Auth Tab/Custom Tabs trên Android), không bao giờ trong WebView, và không được đưa token IdP xuống điện thoại.

## Quyết định

1. **Bắt đầu:** app tạo `state` (base64url 16–128 ký tự) và PKCE (`code_verifier` 43–128 ký tự, `code_challenge` S256, đúng 43 ký tự), mở `GET /auth/login?client=mobile&state=<s>&code_challenge=<c>&code_challenge_method=S256[&locale=en|zh-CN|vi]` trong trình duyệt hệ thống. Login transaction lưu thêm `mobile: { appState, codeChallenge, locale }`. Luồng mobile luôn tương tác: `prompt=none` bị bỏ, không đặt `lm_sso_tried`, không nhận `recreate`. Tham số sai thì 303 về `/m/auth/callback?error=invalid_request`.
2. **Callback OIDC:** nhánh mobile **không** tạo phiên, **không** xoá hay đặt cookie phiên web (callback web vẫn xoá phiên cũ theo cookie để chống session fixation). Server niêm phong bộ token IdP bằng `TokenCipher` (AAD là hash của mã) vào bản ghi `mobile_handoffs` (`_id` = SHA-256 của mã 32 byte ngẫu nhiên, `sub`, `sid`, `codeChallenge`, `appState`, `confirmed`, TTL) rồi render trang xác nhận "Mở app Localman trên điện thoại này với tài khoản <email>?". Mọi lỗi sau khi đã có transaction mobile (IdP từ chối, IdP sập, userinfo lỗi, tài khoản đã xoá, rate limit lúc bắt đầu) đều 303 về `/m/auth/callback?error=<mã>&state=<s>` thay vì trang web. Callback không tìm thấy transaction (`login_expired`) và rate limit ở callback vẫn về `/?authError=` vì lúc đó chưa biết lượt đó là của app.
3. **Trang xác nhận:** form POST tới `/auth/mobile/confirm` (cùng origin, qua CSRF guard như mọi form). Tiếp tục: đánh dấu `confirmed` rồi 303 tới `/m/auth/callback?code=<mã>&state=<s>`. Huỷ: xoá handoff rồi 303 với `error=access_denied`. Mã đã dùng hay hết hạn: trang 410. Trang có CSP riêng (`default-src 'none'`, style theo nonce, `form-action 'self'`, `frame-ancestors 'none'`), `Referrer-Policy: no-referrer`, `no-store`, chữ qua i18n server (`mobileSignIn` trong `apps/api/src/i18n/messages/`), tên sản phẩm từ `brand.appName`. Trang chờ tối đa 5 phút; sau Tiếp tục, mã chỉ đổi được trong 60 giây.
4. **Callback của app:** `https://<host của tenant>/m/auth/callback` là link https đã xác minh (Universal Links / App Links), nên hệ điều hành chỉ trao nó cho app do mình ký. `GET /m/auth/callback` trên API là trang dự phòng khi không app nào nhận link (chưa cài app), có nút mở lại đúng link đó.
5. **Đổi mã:** `POST /auth/mobile/token` với JSON `{ code, code_verifier }`. Server `findOneAndDelete` theo hash của mã **trước** khi kiểm, nên mã dùng đúng một lần (hai lượt đồng thời chỉ một lượt thành công) và verifier sai làm mất mã. Chưa xác nhận hoặc không tìm thấy: 400 `MOBILE_HANDOFF_INVALID`; quá hạn: 400 `MOBILE_HANDOFF_EXPIRED`; PKCE S256 so khớp constant-time. Thành công: tạo phiên `client: "mobile"` trong `SessionStore`, trả `200 { token, tokenType: "Bearer", expiresAt }` với `Cache-Control: no-store`. Token chỉ nằm trong body của POST, không bao giờ trên URL. Route nằm trong `csrfExempt` (không có Origin, không có cookie, chứng thực bằng mã và verifier) và dùng `ipRateLimit` (JSON 429), cùng mức với login.
6. **Bearer:** phiên lưu trường `client` (`web` mặc định, phiên cũ không có trường này là `web`). Có header `Authorization: Bearer` thì `authenticate` chỉ tìm phiên `mobile` theo token đó và không đọc cookie, nên Bearer sai trả 401 kể cả khi kèm cookie hợp lệ. Cookie chỉ mở phiên `web`: token của app đặt vào cookie, hay cookie web gửi dạng Bearer, đều không dùng được. SSE log trực tiếp đi qua cùng `resolveAuth` nên nhận Bearer như REST.
7. **CSRF:** request có Bearer và **không có header `Cookie` nào** được bỏ qua kiểm Origin. Trình duyệt không tự đính `Authorization`; trang khác origin chỉ đặt được header này sau preflight CORS, mà preflight chỉ qua với hai origin của app; và token không phải credential tự động (ambient), nên request giả mạo không mang được nó. Request Bearer có kèm cookie vẫn bị kiểm Origin như cũ (test `csrf-guard-bearer.test.ts`, `mobile-session.test.ts`).
8. **CORS:** chỉ cho đúng hai origin `capacitor://localhost` và `https://localhost` (`MOBILE_APP_ORIGINS` trong `apps/api/src/http/mobile-cors.ts`, có test), chỉ trên `/api/v1/*` (gồm SSE log) và `/auth/mobile/token`, `/auth/mobile/logout`. Preflight trả 204 với `GET, POST, PUT, PATCH, DELETE`, header `Authorization, Content-Type, Accept, Last-Event-ID`, `Max-Age` 600; response thật có `Access-Control-Allow-Origin` của origin đó, `Vary: Origin`, `Access-Control-Expose-Headers: Retry-After`. **Không bao giờ** có `Access-Control-Allow-Credentials`, nên cookie không bao giờ đi khác origin; phiên cookie vẫn chỉ same-origin. Origin khác (kể cả origin dashboard) không nhận header CORS nào. `/auth/login`, `/auth/logout`, `/auth/mobile/confirm`, `/m/auth/callback` không có CORS.
9. **Đăng xuất app:** `POST /auth/mobile/logout` với Bearer xoá phiên đó, trả 204 (token không còn phiên cũng 204); không có Bearer thì là request cookie và đi qua CSRF guard như mọi request khác. Hook kết thúc phiên của `SessionStore` đóng các SSE stream mở bằng phiên đó (trong process này) và xoá thiết bị Web Push; hook này chạy cho mọi cách kết thúc phiên (đăng xuất web, back-channel, xoá tài khoản). Phiên ở IdP không bị đóng: lần đăng nhập app sau vẫn qua trang xác nhận.
10. **Tệp liên kết app:** `GET /.well-known/apple-app-site-association` (`applinks` cho đúng `/m/auth/callback`, và `webcredentials` cho host, vì `ASWebAuthenticationSession` với callback https chỉ hoàn tất cho app liên kết `webcredentials` với host đó) và `GET /.well-known/assetlinks.json` (`handle_all_urls` và `get_login_creds`). App id là `<MOBILE_IOS_TEAM_ID>.<brand.appIds.ios>`, package là `brand.appIds.android`, fingerprint từ `MOBILE_ANDROID_CERT_SHA256`. Nền tảng nào chưa cấu hình thì tệp đó 404; cả hai chưa cấu hình thì luồng mobile tắt (`/auth/login?client=mobile` về `error=mobile_unavailable`, `/auth/mobile/token` 404). Mỗi host tenant phục vụ cùng nội dung.
11. **nginx** (`infra/localman/nginx/localman-app.inc`): `location = /m/auth/callback` và hai `location =` của `.well-known` proxy tới API (:4000). Không có chúng, `/m/` rơi vào mock runtime (:4100) và `.well-known` rơi vào `index.html` của SPA. Secret project dài 24 ký tự nên `auth` không bao giờ là một mock.

## Phương án bị loại

- **IdP cấp token cho app như một public client:** token IdP (refresh token) nằm trên điện thoại, phải thêm client và chính sách ở repo `auth-next`, và mỗi app tự lo refresh xoay vòng. Session handoff dùng lại SessionStore, refresh và back-channel logout đang có.
- **Custom URL scheme (`com.hoandat.localman://`):** app nào cũng khai được cùng scheme. Vì IdP có SSO, một app độc hại tự mở luồng đăng nhập sẽ chạy hết mà người dùng không cần làm gì, rồi nhận mã. Link https đã xác minh chỉ mở app đã ký bằng Team ID hay cert của mình.
- **Tạo phiên ngay ở callback và trả token qua URL:** token sẽ nằm trong URL (lịch sử, log), và phiên 30 ngày bị bỏ dở khi người dùng không quay lại app. Bản ghi chỉ có hash cũng không thể trả lại token gốc.
- **`CapacitorHttp` để khỏi cần CORS:** không stream được SSE.

## Threat model

- **App độc hại tự mở luồng:** mã chỉ tới callback https đã xác minh, hệ điều hành trao cho app của mình; app của mình không có verifier của app kia nên mã vô dụng. Trang xác nhận cộng việc bỏ `prompt=none` bắt buộc một thao tác của người dùng, nên SSO không tự hoàn tất.
- **Chặn mã trên đường:** mã một lần, 60 giây sau Tiếp tục, gắn PKCE S256 do app giữ verifier; verifier sai làm mất mã; mã chỉ lưu dạng hash.
- **Link đăng nhập gửi cho nạn nhân dùng máy tính:** nạn nhân phải bấm Tiếp tục trên trang ghi rõ "trên điện thoại này"; mã khi đó chỉ nằm trên URL trong trình duyệt của nạn nhân, trang không tải tài nguyên ngoài và `no-referrer`.
- **Login CSRF:** `state` của app đi suốt luồng và về lại callback; app bỏ mọi callback không khớp `state` đang chờ.
- **CSRF qua Bearer và CORS:** xem quyết định 7 và 8. `https://localhost` có thể là trang bất kỳ chạy trên máy người dùng; nó gửi được request Bearer nhưng không có token, và không bao giờ kèm được cookie (không có `Allow-Credentials`, cookie lại là Strict).
- **Token trên máy:** opaque, không có quyền gì ở IdP, giữ trong Keychain/Keystore (phía app); bị lộ thì đăng xuất app, đăng xuất ở IdP (back-channel theo `sid`) hay hết hạn đều chấm dứt nó.
- **Tenant:** `mobile_handoffs` gắn `tenantScopePlugin`; mã tạo ở host tenant A không đổi được ở host tenant B (test `mobile-handoff.test.ts`).

## Quyền của phiên mobile

Phiên mobile mang scope `user` và `sessionId` giống phiên trình duyệt (`require-auth.ts`), nên làm được mọi việc web làm, kể cả đọc giá trị secret (biến secret, magic link), xoá tài khoản (`requireSession`). Đây là chủ đích: app bọc đúng web. Agent (MCP token) vẫn không có `sessionId` nên vẫn không đọc secret.

## Quan hệ với logout ở IdP

Phiên mobile lưu `sid` của IdP như phiên web, nên logout ở IdP qua back-channel kết thúc cả phiên mobile của cùng phiên IdP. Đó là hành vi mong muốn: người dùng đăng xuất khỏi hệ sinh thái thì app cũng thoát. Ngược lại, đăng xuất trong app chỉ kết thúc phiên Localman của app.

## Lý do (tại sao)

- Không sửa `auth-next`, không có token IdP trên điện thoại, dùng lại toàn bộ cơ chế phiên đang chạy.
- Tách cookie và Bearer theo `client` giữ nguyên mọi giả định của luồng web (SameSite=Strict, kiểm Origin), và mỗi loại credential chỉ mở đúng loại phiên đã cấp nó.
- CORS không credentials là cách nhỏ nhất để WebView đọc được API và stream SSE mà không mở thêm bề mặt CSRF.

## Đánh đổi & hệ quả

- iOS cần 17.4+ (`ASWebAuthenticationSession` với callback https). App phải khai `applinks:` và `webcredentials:` cho **từng** host tenant trong entitlements (Android: `autoVerify` cho từng host); tenant mới cần bản app mới hoặc đi đường web.
- Đóng SSE khi đăng xuất chỉ áp cho stream trong cùng process; nhiều process thì stream ở process khác tự đóng khi client ngắt hoặc ở lần tải lại.
- Lỗi xảy ra trước khi biết lượt đăng nhập là của app (`login_expired` ở callback, rate limit ở callback) vẫn về trang web; app thấy người dùng không quay lại và cho thử lại.
- Biến môi trường mới: `MOBILE_IOS_TEAM_ID`, `MOBILE_ANDROID_CERT_SHA256`. Chưa đặt thì luồng mobile tắt, web không đổi.
