---
title: "Phase 3: Vỏ app: plugin native, đăng nhập, tab, cử chỉ, theme, i18n"
status: todo
tier: L
---

# Phase 3: Vỏ app: plugin native, đăng nhập, tab, cử chỉ, theme, i18n

## Context Links

- Phase 1 (endpoint handoff), phase 2 (vỏ Capacitor, entry mobile, kết quả spike)
- Prototype: `./prototype/mobile-app.html` (màn Đăng nhập, thanh tab)
- Mẫu plugin: `scribe-next/web/ios/App/App/HoandatAuthPlugin.swift` (`ASWebAuthenticationSession`, PKCE, mã lỗi `CANCELLED`), `SessionAuth.swift` (Keychain `AfterFirstUnlockThisDeviceOnly`), `MainViewController.swift` (đăng ký plugin, cử chỉ vuốt)
- `apps/web/src/i18n/` (`i18n-provider.tsx`, `account-locale-sync.ts`, `locale-preference.ts`), `apps/web/src/lib/theme.ts`, `apps/web/src/components/ui/`, `apps/web/src/platform/`
- `apps/api/src/operations/feature-gates.ts`, `packages/shared/src/locales.ts`

## Overview

Dựng mọi thứ mà các tab dùng chung, gồm **toàn bộ code native của app** để phase 4–6 chỉ viết code web:

- Ba plugin tự viết (Swift + Kotlin): đăng nhập qua trình duyệt hệ thống, kho token an toàn, stream SSE.
- Khung điều hướng kiểu app chat: bốn tab, mỗi tab một stack, chuyển cảnh đẩy màn, vuốt lùi, nút back của Android.
- Theme sáng/tối, ba ngôn ngữ, xử lý lỗi, component UI cơ bản theo prototype.

## Key Insights

- **Plugin `LocalmanAuth`** (`signIn`, `signOut`): tạo `state` và PKCE trên native, mở `/auth/login?client=mobile&state&code_challenge` bằng `ASWebAuthenticationSession` với callback `.https(host:path: "/m/auth/callback")` (iOS 17.4+), hoặc Auth Tab của `androidx.browser` với redirect https đã xác minh (dự phòng: Custom Tabs + App Link nhận qua `appUrlOpen`). Kiểm `state`, gọi `POST /auth/mobile/token` với `code_verifier`, lưu token vào kho an toàn rồi trả cho JS. Verifier không rời native. Lỗi trả mã (`CANCELLED`, `STATE_MISMATCH`, `HANDOFF_INVALID`, `HANDOFF_EXPIRED`, `NETWORK`), JS dịch.
- **Plugin `SecureToken`** (`get`, `clear`): iOS Keychain `kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly` như scribe; Android: khoá AES trong AndroidKeyStore mã hoá giá trị trước khi ghi vào SharedPreferences (không dùng `EncryptedSharedPreferences`, thư viện đã ngừng phát triển). JS đọc token một lần khi khởi động, giữ trong bộ nhớ để gắn Bearer qua `CapacitorHttp`; không ghi vào `localStorage` hay `@capacitor/preferences`.
- **Plugin `EventStream`** (`open`, `close`, sự kiện `message`/`error`/`closed`): `CapacitorHttp` không stream body và `EventSource` của WebView không gửi được header Bearer (lại vướng CORS), nên đọc SSE trên native (iOS `URLSession.bytes`, Android `HttpURLConnection` đọc từng dòng), tự gắn Bearer từ kho an toàn, đẩy từng sự kiện lên JS. Lớp platform bọc plugin thành một nguồn có cùng giao diện mà `features/request-log/use-log-stream.ts` đang dùng, để phase 4 tái dùng logic web. Plugin đóng mọi stream khi app vào nền.
- **Điều hướng:** React Router trong entry mobile. Mỗi tab giữ stack riêng; đổi tab thay history bằng stack của tab đích, nên cử chỉ vuốt lùi của WKWebView (theo history) và `backButton` của Android chỉ lùi trong tab hiện tại. Màn hội thoại request ẩn thanh tab, giống app chat. Chuyển cảnh đẩy màn dùng View Transitions API khi WebView hỗ trợ, nếu không thì CSS transform; chỉ animate `transform` và `opacity`.
- **Cảm giác chạm:** `touch-action: manipulation`, viewport không zoom, `viewport-fit=cover` với `env(safe-area-inset-*)`; tắt `-webkit-touch-callout` và chọn chữ trên phần khung (giữ chọn chữ ở nội dung như body response); trạng thái nhấn bằng `:active`. Cuộn chỉ ở vùng nội dung (`overscroll-behavior` trên khung ngoài).
- Tenant được chọn theo Host. Mỗi bản build trỏ tới một host qua `VITE_NATIVE_API_ORIGIN`; v1 không cho người dùng tự đổi tenant.
- Các operation bị feature gate có thể trả 404 trên tenant; app coi chúng là tuỳ chọn và ẩn mục tương ứng.

## Requirements

- Màn Đăng nhập có một nút chạy `LocalmanAuth.signIn`. Associated Domains (`applinks:<host>`) trong entitlements iOS; intent filter `autoVerify` cho `/m/auth/callback` trong `AndroidManifest.xml`. Callback mang `error` thì hiện thông báo đã dịch.
- API trả 401 thì xoá token (`SecureToken.clear`) và về màn Đăng nhập. Lỗi `{ error: { code, message } }` hiện bằng toast đã dịch.
- Theme mặc định theo hệ thống, chỉnh được ở tab Tài khoản; màu từ `tokens.css`; `@capacitor/status-bar` đổi kiểu chữ theo theme.
- Mọi chuỗi đi qua `t()` của web; locale mặc định lấy từ ngôn ngữ của máy (`navigator.languages`), sau đó đồng bộ với `PUT /users/me/locale` như web (`account-locale-sync.ts`).
- Cỡ chữ theo cài đặt hệ thống (iOS: `-apple-system-body`/Dynamic Type qua CSS; Android: `textZoom` của WebView), vùng chạm tối thiểu 44 pt, nút chỉ có icon có `aria-label`.
- Plugin native không chứa chuỗi hiển thị, không log token, mã handoff hay verifier.
- Đạt các tiêu chí "Chạm", "Chuyển màn", "Vuốt lùi", "Chi tiết vỏ" trong `plan.md`.

## Related Code Files

- Tạo (iOS): `apps/mobile/ios/App/App/LocalmanAuthPlugin.swift`, `SecureTokenPlugin.swift`, `EventStreamPlugin.swift`; sửa `MainViewController.swift`, `App.entitlements`, `Info.plist`
- Tạo (Android): `apps/mobile/android/app/src/main/java/com/hoandat/localman/` `LocalmanAuthPlugin.kt`, `SecureTokenPlugin.kt`, `EventStreamPlugin.kt`; sửa `MainActivity`, `AndroidManifest.xml`
- Tạo: `apps/web/src/platform/native/` (`localman-auth.ts`, `secure-token.ts`, `event-stream.ts`, `app-lifecycle.ts`, `keyboard.ts`) cùng bản web/test giả
- Tạo: `apps/web/src/mobile/` `app-shell/` (`tab-bar.tsx`, `tab-stacks.ts`, `stack-screen.tsx`, `use-back-navigation.ts`), `sign-in/sign-in-screen.tsx`, `session/` (`mobile-session.ts`, `use-mobile-session.ts`), `ui/` (ListRow, Avatar, Badge, MethodChip, ScreenHeader; dùng primitive trong `apps/web/src/components/ui/` trước khi tạo mới)
- Tạo test cạnh từng file (Vitest + Testing Library)

## Implementation Steps

1. Ba plugin trên iOS, đăng ký trong `MainViewController`; Swift test nhỏ cho PKCE và kiểm `state` (theo `-OSSelfTest` của scribe nếu không có target test).
2. Ba plugin trên Android, đăng ký trong `MainActivity`.
3. Lớp `platform/native` với interface có type và bản giả cho test.
4. Luồng phiên: khởi động đọc token, `GET /users/me`; đăng nhập; 401; đăng xuất (`POST /auth/mobile/logout` rồi `SecureToken.clear`).
5. Khung tab và stack, chuyển cảnh, vuốt lùi, `backButton`; badge trên tab (số log mới, thông báo chưa đọc).
6. Theme, i18n, status bar; component UI cơ bản theo prototype.
7. Test: chuyển màn khi chưa hoặc đã đăng nhập, khi gặp 401, khi đổi ngôn ngữ; stack theo tab (đổi tab rồi lùi không sang tab khác); `backButton` ở gốc tab.
8. Đo trên hai máy tham chiếu các tiêu chí của phase; chạy SAST (`/ak:security`) cho plugin native.

## Todo

- [ ] Plugin `LocalmanAuth`, `SecureToken`, `EventStream` trên iOS
- [ ] Ba plugin trên Android
- [ ] Lớp platform native và bản giả
- [ ] Đăng nhập, 401, đăng xuất
- [ ] Tab, stack, chuyển cảnh, vuốt lùi, nút back
- [ ] Theme, i18n, component UI cơ bản
- [ ] Test, số đo, SAST

## Success Criteria

- Trên máy thật (iOS và Android): đăng nhập vào tenant staging, tắt hẳn rồi mở lại app vẫn còn đăng nhập, đăng xuất thì token bị xoá khỏi Keychain/Keystore và session ở server bị thu hồi.
- Tiêu chí "Chạm", "Chuyển màn", "Vuốt lùi", "Chi tiết vỏ" đạt, có số đo.
- `pnpm vitest run apps/web/src/mobile apps/web/src/platform` xanh; `pnpm lint && pnpm typecheck` sạch; CI xanh.

## Risk Assessment

- **App Link chưa được xác minh (Android) hoặc sheet không tự đóng với callback https (iOS):** thử trên máy thật với file association đã deploy lên staging; `adb shell pm get-app-links com.hoandat.localman` để kiểm trạng thái. Trang `/m/auth/callback` có nút "Mở app" làm đường dự phòng (phase 1).
- **Auth Tab chưa có trên Chrome của máy thử:** plugin tự rơi về Custom Tabs + App Link.
- **Cử chỉ vuốt của WKWebView lệch với stack theo tab:** spike ở phase 2 đã kiểm; nếu vẫn lệch thì tắt cử chỉ hệ thống và tự viết cử chỉ kéo từ mép (pointer events, chỉ `transform`), đo lại theo cùng tiêu chí.
- **Token trong bộ nhớ JS:** chỉ bundle của app chạy trong WebView (CSP chặn script lạ, không tải trang ngoài); đăng xuất và 401 xoá cả bộ nhớ lẫn kho an toàn.

## Security Considerations

Không đặt token vào URL. Verifier và `state` tạo và kiểm trên native; callback có `state` sai bị bỏ qua để chặn login CSRF. WebView không bao giờ điều hướng tới trang IdP; link ngoài mở bằng trình duyệt hệ thống. Kho token dùng mức truy cập chỉ trên máy này, không sao lưu sang máy khác.

## Next Steps

Phase 4, 5 và 6 điền nội dung cho từng tab, chỉ bằng code web.
