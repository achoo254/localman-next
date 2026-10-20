---
title: "Phase 2: Vỏ Capacitor và entry mobile"
status: todo
tier: L
---

# Phase 2: Vỏ Capacitor và entry mobile

## Context Links

- Mẫu Capacitor đang chạy: `scribe-next/web/capacitor.config.ts`, `scribe-next/web/ios/App/App/MainViewController.swift`, `scribe-next/web/src/lib/api.ts` (`isNativeShell`, `apiBase`), `scribe-next/web/scripts/ios-device.sh`, `scribe-next/docs/ios-app.md` (bảng "Cách app hoạt động", "Đã kiểm / còn phải kiểm")
- Quy tắc hệ sinh thái: `hoandat-app/docs/ecosystem-architecture.md` §4
- `apps/web/vite.config.ts` (vendor chunk, loader prerender), `apps/web/index.html`, `apps/web/src/main.tsx`, `apps/web/src/app-providers.tsx`
- `apps/web/src/lib/api-client.ts`, `apps/web/src/lib/api-url.ts`, `apps/web/src/platform/` (lớp platform đã có: clipboard, download, navigation…)
- `scripts/check-tokens.ts`, `scripts/check-i18n.ts` (cả hai quét `apps/web/src` và `apps/web/index.html`)
- `pnpm-workspace.yaml`, `package.json` gốc, `vitest.config.ts`, `.github/workflows/ci.yml`

## Overview

Dựng hai nửa của app và chứng minh các giả định rủi ro nhất trên máy thật trước khi phase 3 dựa vào:

1. **Entry mobile trong `apps/web`:** `apps/web/mobile.html` → `apps/web/src/mobile/main.tsx`, build bằng `vite build --mode mobile` ra `apps/web/dist-mobile`. Dùng lại provider, API client, i18n, Tailwind và token của web.
2. **Vỏ native `apps/mobile`:** package `@localman/mobile` chứa `capacitor.config.ts` (`appId: com.hoandat.localman`, `webDir: ../web/dist-mobile`, `CapacitorHttp` bật), project `ios/` và `android/`, `MainViewController.swift` (iOS) và `MainActivity` (Android).

## Key Insights

- **Một entry riêng, không phải bản build web nguyên trạng.** Web có landing prerender, trang công khai, CodeMirror, sandbox QuickJS: không cần trên điện thoại. Entry riêng chỉ kéo những module nó import; phải kiểm bằng một test bundle (không có QuickJS, CodeMirror, `prerender`). Plugin prerender và loader trong `vite.config.ts` chỉ chạy ở mode web.
- **Gọi API qua `CapacitorHttp`** như scribe: `fetch` trong WebView đi qua request native, không chịu CORS hay chính sách cookie. Ở entry mobile, `api-url.ts` thêm origin của tenant (`VITE_NATIVE_API_ORIGIN`) và `api-client.ts` gắn `Authorization: Bearer` qua lớp platform; nhánh web giữ nguyên hành vi (cookie, đường dẫn tương đối). Scribe ghi lại giới hạn: thân nhị phân chỉ gửi đúng khi là `File`, `keepalive` bị bỏ qua. API của Localman chỉ trao đổi JSON nên không vướng, nhưng phải có test cho điều đó.
- **Plugin và phiên bản:** `apps/web` chỉ phụ thuộc `@capacitor/core`; các plugin chính thức (`@capacitor/app`, `@capacitor/keyboard`, `@capacitor/status-bar`, `@capacitor/preferences`) khai ở `apps/mobile` để `cap sync` tìm thấy. JS gọi chúng qua `registerPlugin` với interface tối thiểu trong `apps/web/src/platform/native/`, nên phiên bản plugin chỉ có một nơi khai. `@capacitor/core` có ở cả hai package với cùng một phiên bản ghim chính xác (`cap doctor` báo khi lệch). Plugin tự viết (phase 3) đăng ký trong `MainViewController`/`MainActivity` như scribe, không thành package npm.
- **Phiên bản:** scribe đang chạy Capacitor 8.5.3 (2026-10). Bước 1 kiểm lại bản mới nhất và changelog trước khi ghim.
- **i18n và token không cần làm gì thêm:** code mobile nằm dưới `apps/web/src` nên `check:i18n`, `check:tokens`, Vitest project của web và Biome đều phủ luôn. Chỉ thêm `apps/web/mobile.html` vào danh sách file HTML mà hai script kiểm.
- **Spike trên máy thật là cổng của phase này** (giống Gate 0 của scribe). Bốn điều phải đúng trước khi làm phase 3:
  1. `CapacitorHttp` gọi `GET /api/v1/users/me` tới staging, JS nhận 401 JSON (không lỗi CORS).
  2. `virtua` `VList` với `reverse`: 1.000 bong bóng cao khác nhau, cuộn và fling đạt tiêu chí "Cuộn ảo" của plan; chèn 50 mục ở đầu với `shift` lệch ≤ 1 px. Không đạt thì thử `@tanstack/react-virtual` với bù vị trí thủ công trước khi đi tiếp.
  3. Bàn phím: chọn cấu hình `@capacitor/keyboard` cho từng nền tảng (iOS: `resize: "none"` và tự dịch ô soạn theo `keyboardWillShow`; Android: kiểm cách WebView co lại khi app ở chế độ edge-to-edge) sao cho đạt tiêu chí "Bàn phím". Ghi cấu hình chọn được vào `docs/mobile-app.md`.
  4. Vuốt lùi: bật `allowsBackForwardNavigationGestures` (iOS) và nghe `backButton` của `@capacitor/app` (Android); kiểm trên hai trang đẩy bằng `history.pushState`.
- **Test:** code mobile dùng Vitest + Testing Library (jsdom) như web. Các tiêu chí khung hình và bàn phím không đo được trong jsdom, nên đo trên máy thật theo checklist.

## Requirements

- `pnpm --filter @localman/web dev:mobile` mở entry mobile trên trình duyệt desktop ở khung điện thoại (dev nhanh); `pnpm --filter @localman/mobile ios` / `android` build entry, `cap sync` rồi mở trên Simulator/Emulator.
- `pnpm lint`, `pnpm typecheck` gốc phủ code mobile (TS strict, cấm `any`, cấm `!`). Biome không quét `apps/mobile/ios` và `apps/mobile/android`.
- CI thêm bước `pnpm --filter @localman/web build:mobile` và test bundle mobile. Không build native trong CI ở plan này; build native chạy trên máy dev bằng script (phase 7).
- Không có literal màu hay px ngoài `tokens.css`, kể cả trong `mobile.html`.
- `capacitor.config.ts` và project native không chứa secret. Origin của tenant lấy từ `VITE_NATIVE_API_ORIGIN` (không phải secret); thiếu biến này thì build mobile dừng với lỗi rõ ràng.
- Deployment target iOS 17.4 (callback https của `ASWebAuthenticationSession`); Android minSdk theo mặc định của Capacitor đang dùng.
- Thư mục build native (`ios/App/build`, `android/app/build`, `Pods`, `DerivedData`) có trong `.gitignore`.

## Related Code Files

- Tạo: `apps/web/mobile.html`, `apps/web/src/mobile/main.tsx`, `apps/web/src/mobile/mobile-app.tsx` (khung rỗng để spike)
- Tạo: `apps/web/src/platform/native-shell.ts` (`isNativeShell()`), `apps/web/src/platform/native/` (interface plugin qua `registerPlugin`)
- Sửa: `apps/web/vite.config.ts` (mode `mobile`: input `mobile.html`, `outDir: dist-mobile`, bỏ plugin prerender), `apps/web/package.json` (`@capacitor/core`, `virtua`, script `dev:mobile`, `build:mobile`), `apps/web/src/lib/api-url.ts`, `apps/web/src/lib/api-client.ts` và test
- Tạo: `apps/web/src/mobile/mobile-bundle.test.ts` (kiểm bundle không chứa QuickJS, CodeMirror, prerender)
- Tạo: `apps/mobile/` (`package.json` tên `@localman/mobile`, `capacitor.config.ts`, `ios/`, `android/`, `.gitignore`, `ios/App/App/MainViewController.swift`, Android `MainActivity`)
- Sửa: `scripts/check-tokens.ts`, `scripts/check-i18n.ts` (thêm `apps/web/mobile.html`), `biome.json` (bỏ qua thư mục native), `.github/workflows/ci.yml`
- Sửa: `docs/design-system.md` (mục mobile: cùng token, safe area)

## Implementation Steps

1. Kiểm bản Capacitor mới nhất; tạo `apps/mobile` bằng `npx cap init` rồi `cap add ios`, `cap add android`; ghim phiên bản.
2. Thêm mode `mobile` cho Vite và entry rỗng; build ra `dist-mobile`; `cap sync`; mở trên Simulator và Emulator.
3. `isNativeShell()`, nhánh native của `api-url.ts` và `api-client.ts` cùng test cho cả hai nhánh.
4. Spike 1–4 ở mục Key Insights trên iPhone 15 Pro Max và một máy Android tầm trung; ghi số đo vào báo cáo `plans/dattqh/reports/`.
5. Test bundle mobile; thêm `mobile.html` vào hai script kiểm; cập nhật Biome và CI; push rồi theo dõi bằng `gh run watch`.

## Todo

- [ ] `apps/mobile` với iOS và Android chạy được entry mobile
- [ ] Mode `mobile` của Vite và test bundle
- [ ] Nhánh native của API client (Bearer, origin) và test
- [ ] Spike: CapacitorHttp, cuộn ảo, bàn phím, vuốt lùi, có số đo
- [ ] Script kiểm token/i18n phủ `mobile.html`, CI xanh

## Success Criteria

- Bốn spike đạt trên hai máy tham chiếu, có số đo trong báo cáo.
- `pnpm --filter @localman/web build:mobile` thành công trong CI; test bundle xanh.
- `pnpm lint && pnpm typecheck` sạch ở gốc; `pnpm check:tokens` và `pnpm check:i18n` xanh; build web (`pnpm --filter @localman/web build`) không đổi output.

## Risk Assessment

- **Cuộn ảo hay bàn phím không đạt trên WebView:** spike làm trước mọi màn thật. Không đạt sau khi đã thử thư viện dự phòng thì dừng và báo lại, vì đó là giả định nền của việc chọn Capacitor.
- **Mode mobile làm vỡ build web:** mode web giữ nguyên cấu hình; so output `dist/` trước và sau.
- **Lệch phiên bản `@capacitor/core` giữa hai package:** ghim chính xác, chạy `npx cap doctor` trong script build native.
- **Android WebView cũ trên máy người thử:** đặt phiên bản WebView tối thiểu theo Capacitor đang dùng và ghi trong tài liệu.

## Security Considerations

Không secret trong config hay project native. Entry mobile có CSP riêng (chỉ script của bundle, `connect-src` là origin tenant). `CapacitorHttp` gửi token trong header, không bao giờ trên URL.

## Next Steps

Phase 3 dựng plugin native và vỏ app trên khung này.
