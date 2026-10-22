# App iOS và Android

App mobile của Localman là vỏ Capacitor 8 (`apps/mobile`) bọc **toàn bộ** web app `apps/web`: mọi tính năng của web
có trong app. Quyết định: `hoandat-app/plans/dattqh/261023-0620-mobile-apps-all-products/plan.md` (Jev 23/10/2026).
Đăng nhập và phiên: [ADR 0005](decisions/0005-mobile-session-handoff.md).

## Cách chạy

| Lệnh | Việc |
|---|---|
| `pnpm --filter @localman/mobile build:web` | Build web với `VITE_NATIVE=true` vào `apps/web/dist-native`, cùng danh sách tính năng như prod (`infra/localman/released-features`); `LOCALMAN_API_BASE_URL` đổi host API (mặc định `https://localman.hoandat.com`) |
| `pnpm --filter @localman/mobile exec cap sync` | Chép bản build và plugin vào `ios/`, `android/` |
| `pnpm --filter @localman/mobile open:ios` | Mở Xcode (`DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer` nếu `xcode-select` trỏ Command Line Tools) |

CI (`.github/workflows/mobile.yml`) build APK debug (artifact `localman-debug-apk`) và bản iOS Simulator không ký mỗi
lần đổi web/mobile. Máy dev không cần Android SDK.

## Khác với web

- `VITE_NATIVE=true` là hằng lúc build: bản web bỏ hẳn nhánh native và không tải Capacitor
  (`apps/web/src/platform/native/`).
- Đăng nhập mở `/auth/login?client=mobile` trong trình duyệt hệ thống bằng `@shared-next/capacitor-system-auth`, nhận
  lại link https `/m/auth/callback` đã xác minh, đổi mã kèm PKCE lấy token phiên. Token nằm trong Keychain/Keystore
  (`@aparajita/capacitor-secure-storage`) và đi kèm mọi request dạng `Authorization: Bearer`; không dùng cookie.
- Live log đọc SSE bằng `fetch` (EventSource không gửi được header).
- Link chia sẻ dùng host web (`appPageUrl`), không phải origin của app.
- Đăng xuất chỉ kết thúc phiên của máy này (`POST /auth/mobile/logout`), không đăng xuất IdP trong trình duyệt.
- iOS tối thiểu 17.4 (callback https của `ASWebAuthenticationSession`); entitlement `applinks:` và `webcredentials:`
  cho `localman.hoandat.com` ở `ios/App/App/App.entitlements`. Android khai App Link `/m/auth/callback` trong
  `AndroidManifest.xml`.

## Bật đăng nhập trên prod

Server tắt đăng nhập mobile cho tới khi có `MOBILE_IOS_TEAM_ID` (iOS) và/hoặc `MOBILE_ANDROID_CERT_SHA256` (vân tay
chứng chỉ ký APK/AAB) trong `/opt/localman/.env` (`docs/deployment-guide.md`). Team iOS: `AM5C55N339`.

## Chưa làm

- Icon và màn chờ đang là mặc định của Capacitor (icon web cũng còn là dấu tạm, ADR-0006).
- Push (APNs/FCM), ký bản phát hành Android và tải lên TestFlight (cần app record trên App Store Connect do chủ tài
  khoản tạo).
- Chưa kiểm trên máy thật; APK debug của CI ký bằng khoá debug ngẫu nhiên nên App Link chưa xác minh được với
  `assetlinks.json` của prod.
