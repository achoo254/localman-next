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

## Icon và màn chờ

`pnpm brand:gen` vẽ từ `packages/design-tokens/app-icon.svg`, `app-icon-maskable.svg` và `colors` của
`brand.config.json` (code: `scripts/brand/native-assets*.ts`, ADR-0006 mục 8):

| Nơi | File |
|---|---|
| iOS | `AppIcon.appiconset/AppIcon-512@2x.png` (1024, không alpha; iOS tự bo góc), `Splash.imageset` sáng và tối (`luminosity: dark`) |
| Android | `mipmap-*/ic_launcher_{background,foreground,monochrome}.png` cho adaptive icon (`mipmap-anydpi-v26`, monochrome cho icon theo theme Android 13+), `ic_launcher.png`/`ic_launcher_round.png` cho Android 7.x; `drawable[-port\|-land][-night]-*/splash.png`; `values[-night]/brand_colors.xml` cho màn chờ Android 12+ (`styles.xml`, `AppTheme.NoActionBarLaunch`) |
| Play | `docs/store/play/icon-512.png`, `feature-graphic.png` (1024 × 500) |

Icon hiện là **dấu tạm** (chữ L trắng trên nền violet), vẫn dùng cho bản lên cửa hàng. Có icon thiết kế: thay hai SVG
(maskable giữ quy ước `<rect>` nền phủ canvas là phần tử đầu, hình nằm trong vòng tròn 80% ở giữa), `pnpm brand:gen`,
commit, build và nộp bản mới; tải lại hai ảnh Play bằng tay. `scripts/brand/native-assets.test.ts` báo khi file sinh
ra cũ hơn brand. `cap sync` chỉ chép bản build web và plugin, không đụng các file này.

## Ảnh cửa hàng

`pnpm store:screenshots` chụp web app trên khổ điện thoại, giao diện tiếng Việt, với dữ liệu demo trên stack E2E
(`e2e/support/stack.ts`, cổng cố định 46xx; dừng stack E2E khác trước khi chạy), vào `docs/store/screenshots/`:
`ios-6.9` (1320 × 2868), `ios-6.5` (1284 × 2778), `android` (1080 × 1920), PNG không alpha. Spec:
`e2e/store/store-screenshots.spec.ts`; một worker, các khổ chạy lần lượt. Chữ và trường cho hồ sơ cửa hàng:
[store/listing.md](store/listing.md). Host mock của stack (`{secret}.localhost:4610`) được đổi thành host prod
`{secret}.localman.hoandat.com` trên màn hình ngay trước khi chụp (chỉ chữ hiển thị); thanh trên cùng được tô đặc vì
Chromium headless không vẽ `backdrop-blur`.

Bố cục điện thoại cần sửa (ghi lại khi chụp 23/10/2026, chưa sửa):

- `01-mock-api`: cây resource rộng hơn màn hình, resource lồng (`orders` dưới `users`) bị cắt ở mép phải.
- `04-nhat-ky-request`: bảng log chỉ hiện Giờ, Method, Path; Status, Nguồn, thời gian nằm ngoài khung cuộn ngang mà
  không có dấu hiệu cuộn được.
- `03-api-client`: tên tab request đang mở bị cắt mép trái ("iệt kê users"); workspace mặc định tên tiếng Anh
  ("My Workspace") trong giao diện tiếng Việt.

## Chưa làm

- Push (APNs/FCM), ký bản phát hành Android và tải lên TestFlight (cần app record trên App Store Connect do chủ tài
  khoản tạo).
- Chưa kiểm trên máy thật; APK debug của CI ký bằng khoá debug ngẫu nhiên nên App Link chưa xác minh được với
  `assetlinks.json` của prod.
