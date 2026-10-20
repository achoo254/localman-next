---
title: "Localman Mobile: app iOS/Android kiểu app chat"
description: "Vỏ Capacitor trong apps/mobile bọc một entry mobile của apps/web: danh sách kiểu chat, màn chi tiết toàn màn hình, tab đáy, API client dạng hội thoại và log/inbox theo dòng thời gian."
status: pending
priority: P2
effort: "XL (7 phase: M, L, L, M, L, S, M)"
branch: main
tags: [feature, frontend, mobile, auth, api]
blockedBy: []
blocks: []
created: 2026-10-20
---

# Localman Mobile: app iOS/Android kiểu app chat

## Overview

Thêm app iOS và Android theo quy tắc chung của hệ sinh thái `*-next` (`hoandat-app/docs/ecosystem-architecture.md` §4): một mã React cho mọi nền tảng, native chỉ là lớp vỏ. Cụ thể:

- **Giao diện mobile** là một entry riêng trong chính Vite app `apps/web` (`apps/web/mobile.html` → `apps/web/src/mobile/`), build ra `apps/web/dist-mobile`. Entry này dùng lại API client, hook dữ liệu, i18n, design token và lớp `src/platform` của web, nhưng có điều hướng và màn riêng cho điện thoại.
- **Vỏ native** là `apps/mobile` (Capacitor 8): `capacitor.config.ts` trỏ `webDir` tới `../web/dist-mobile`, cùng project `ios/` và `android/` và các plugin Swift/Kotlin của app. Mẫu đang chạy: `scribe-next/web` (`capacitor.config.ts`, `ios/App/App/HoandatAuthPlugin.swift`, `SessionAuth.swift`, `MainViewController.swift`; tài liệu `scribe-next/docs/ios-app.md`).

Trải nghiệm dùng hai mẫu của app chat:

- **Điều hướng:** danh sách giống danh sách cuộc trò chuyện, chạm vào để mở màn chi tiết toàn màn hình có nút Back và cử chỉ vuốt lùi, thanh tab ở đáy (Dự án, Client, Thông báo, Tài khoản).
- **Nội dung dạng hội thoại:** trong API client, request gửi đi là bong bóng bên phải, response là bong bóng bên trái, ô soạn nằm ở đáy. Log request của mock và webhook inbox hiện theo dòng thời gian và cập nhật trực tiếp.

App chỉ gọi REST `/api/v1` đang có. Thay đổi phía server duy nhất là một đường đăng nhập cho app native (phase 1), vì hiện API chỉ nhận cookie `__Host-lm_session` của trình duyệt.

Prototype để duyệt giao diện: [prototype/mobile-app.html](./prototype/mobile-app.html). Mở thẳng file hoặc qua một server tĩnh.

Bối cảnh: từ 2026-10-19 sản phẩm đang trong đợt marketing và nghiệm thu. Plan này chỉ bắt đầu khi bạn duyệt prototype và cho phép mở scope.

## Phases

| # | Phase | Tier | Status |
|---|-------|------|--------|
| 1 | [Đăng nhập cho app native (session handoff)](./phase-01-mobile-session-handoff-api.md) | M | Pending |
| 2 | [Vỏ Capacitor và entry mobile](./phase-02-capacitor-shell-and-mobile-entry.md) | L | Pending |
| 3 | [Vỏ app: plugin native, đăng nhập, tab, cử chỉ, theme, i18n](./phase-03-app-shell-sign-in-and-tabs.md) | L | Pending |
| 4 | [Tab Dự án: log và inbox theo dòng thời gian](./phase-04-projects-tab-log-and-inbox-timeline.md) | M | Pending |
| 5 | [Tab Client: request dạng hội thoại](./phase-05-client-tab-request-conversation.md) | L | Pending |
| 6 | [Tab Thông báo và Tài khoản](./phase-06-notifications-and-account-tabs.md) | S | Pending |
| 7 | [Bản build, E2E, tài liệu, DAST](./phase-07-store-builds-e2e-and-docs.md) | M | Pending |

Thứ tự: 1 → 2 → 3 → (4, 5, 6 chạy song song được vì mỗi phase giữ thư mục `apps/web/src/mobile/screens/<tab>/` riêng; mọi code native nằm ở phase 2 và 3) → 7. Phase 2 có thể bắt đầu song song với phase 1 vì không phụ thuộc API mới.

## Quyết định chính

- **Stack:** Capacitor 8 bọc entry mobile của `apps/web` (React 19, Vite 7, Tailwind 4, React Router 7, TanStack Query như web). Không có runtime JS thứ hai, không có bộ build thứ hai: lint, typecheck, test của web phủ luôn code mobile.
- **Auth:** dùng session handoff, không cấp token IdP cho điện thoại. Plugin native của app mở `/auth/login?client=mobile` (luôn tương tác) trong trình duyệt hệ thống (`ASWebAuthenticationSession` trên iOS, Auth Tab/Custom Tabs trên Android), không bao giờ trong WebView. Server giữ bộ token IdP đã mã hoá trong một mã dùng một lần, hiện trang xác nhận, rồi trả mã về callback https đã xác minh (Universal Links / App Links), nên chỉ app do mình ký nhận được. App đổi mã kèm PKCE lấy token session opaque, giữ trong Keychain (iOS) / Keystore (Android) và gửi qua `Authorization: Bearer`. Cách này dùng lại SessionStore và refresh IdP hiện có, không phải sửa repo `auth-next`. Ghi ADR 0005.
- **Gọi API:** bật `CapacitorHttp` như scribe, nên `fetch` của entry mobile đi qua request native: không cần CORS, dashboard API giữ nguyên chính sách không CORS. SSE không đi được qua `CapacitorHttp` (không stream body), nên log trực tiếp dùng một plugin native đọc stream và đẩy sự kiện lên JS, gặp lỗi thì quay về polling.
- **Gửi request:** làm như web: thay biến trên máy bằng `@localman/shared/api-client`, gửi qua proxy `client.sendRequest`, rồi tự ghi `client.recordHistory`. Hội thoại theo từng request nhờ trường mới `sourceRequestId`. History không lưu body, nên bong bóng cũ chỉ có status, kích thước và thời gian.
- **UI:** component web dùng Tailwind và `tokens.css` như web (không sinh file token riêng). List dài và dòng thời gian dùng `virtua` (`VList`, `reverse` cho dòng thời gian neo đáy, `shift` khi chèn trang cũ ở đầu); bàn phím qua `@capacitor/keyboard`; vuốt lùi bằng cử chỉ của WKWebView (iOS) và sự kiện back của hệ thống (Android). Bong bóng tự viết.
- **i18n:** entry mobile nằm trong `apps/web` nên dùng đúng dictionary TS của web (`apps/web/src/i18n/messages`), cùng `t()` và cùng `check:i18n`. Plugin native không chứa chuỗi hiển thị: chỉ trả mã lỗi, JS dịch.
- **Bundle id:** `com.hoandat.localman` (quy ước `com.hoandat.<sản-phẩm>` của hệ sinh thái).

## Tiêu chí cảm giác native

Đo trên hai máy tham chiếu: iPhone 15 Pro Max (đang có) và một máy Android tầm trung (Pixel 6a hoặc tương đương), bản build release. Khung hình đo bằng Safari Web Inspector (Timelines) và Chrome DevTools (Performance) qua remote debugging; độ trễ chạm đo bằng Event Timing API (INP) trong bản build có cờ đo.

| Hạng mục | Tiêu chí | Phase |
|---|---|---|
| Cuộn ảo | Dòng thời gian 1.000 mục, cuộn nhanh và fling: ≥ 95% khung hình ≤ 16,7 ms, không thấy ô trống sau khi ngón tay rời màn quá 1 khung. Số dòng gắn vào DOM ≤ số dòng nhìn thấy + 2 × overscan | 2 (spike), 4, 5 |
| Tải trang cũ | Chèn trang cũ ở đầu dòng thời gian: mục đang neo lệch ≤ 1 px | 4, 5 |
| Chạm | INP ≤ 100 ms cho chạm vào dòng, nút, tab; không có trễ 300 ms; có trạng thái nhấn trong khung kế tiếp | 3 |
| Chuyển màn | Chạm dòng → khung đầu của chuyển cảnh ≤ 100 ms, chuyển cảnh xong ≤ 350 ms, ≥ 95% khung ≤ 16,7 ms | 3 |
| Bàn phím | Ô soạn bám mép trên bàn phím (lệch ≤ 1 px khi bàn phím mở xong) và dịch cùng nhịp animation của bàn phím (quay màn 60 fps, ô soạn không trễ quá 1 khung); đang ở đáy thì bong bóng cuối vẫn hiện; đang cuộn lên đọc thì vị trí không nhảy | 2 (spike), 5 |
| Vuốt lùi | iOS: vuốt từ mép trái theo tay, thả quá nửa màn hoặc vuốt nhanh thì lùi, ≥ 95% khung ≤ 16,7 ms. Android: cử chỉ back và nút back lùi trong stack của tab; ở gốc tab khác thì về tab Dự án, ở gốc tab Dự án thì đưa app về nền | 2 (spike), 3 |
| Khởi động | Mở lạnh tới khung có nội dung (skeleton hoặc dữ liệu cache) ≤ 1,5 s | 7 |
| Chi tiết vỏ | Safe area đúng ở tai thỏ và thanh home; trang không nảy cả khối (chỉ vùng cuộn được nảy); không chọn chữ hay menu giữ lâu trên phần khung; status bar đổi theo theme | 3 |

## Ngoài phạm vi

Push notification (server hiện chỉ có Web Push), offline-first, tablet layout, tạo hoặc sửa mock route trên điện thoại, phát hành production lên store. Plan chỉ tới mức internal testing (TestFlight và Play closed testing).

## Success Criteria

- [ ] Đăng nhập trên thiết bị thật qua trình duyệt hệ thống; token nằm trong Keychain/Keystore; đăng xuất thu hồi session phía server.
- [ ] Bốn tab chạy đúng như prototype: danh sách dạng chat, mở màn chi tiết toàn màn hình, nút Back và cử chỉ vuốt lùi hoạt động.
- [ ] Mọi tiêu chí ở bảng "Tiêu chí cảm giác native" đạt trên hai máy tham chiếu; số đo ghi vào `docs/mobile-app.md`.
- [ ] Log request nhận trực tiếp qua SSE (plugin native), mở lại app thì tải tiếp theo cursor.
- [ ] Gửi request từ ô soạn đi qua proxy; response hiện thành bong bóng có status, thời gian và kích thước; Gửi lại và Sao chép hoạt động.
- [ ] Ba ngôn ngữ en, zh-CN, vi và theme sáng/tối khớp web.
- [ ] CI xanh: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm check:mcp-coverage`, `pnpm check:tokens`, `pnpm check:i18n`, cùng bước build entry mobile.
- [ ] SAST cho thay đổi auth và plugin native, DAST trên production sau khi deploy đều đạt.

## Lịch sử quyết định

- **2026-10-20, đổi từ Expo sang Capacitor.** Bản đầu của plan (cùng ngày) chọn Expo SDK 58 + React Native, theo [báo cáo nghiên cứu stack Expo](../reports/researcher-261020-0737-expo-mobile-stack.md) (giữ nguyên làm lịch sử). Cùng ngày, hệ sinh thái `*-next` chuẩn hoá: mobile là Capacitor bọc bản build web, desktop là Tauri v2 (`hoandat-app/docs/ecosystem-architecture.md` §4; plan `hoandat-app/plans/dattqh/261020-1342-next-ecosystem-alignment/`, phase 03). Lý do: một mã React cho mọi nền tảng, dùng lại component, hook, i18n và token của web thay vì viết lại bằng React Native; scribe đã chạy được mẫu Capacitor trên iPhone thật (đăng nhập qua trình duyệt hệ thống, Keychain).
- Giữ nguyên: phase 1 (session handoff, độc lập với stack vỏ, đúng contract §3 của tài liệu hệ sinh thái), prototype, mẫu điều hướng kiểu app chat, mục tiêu UX, phạm vi 4 tab, mức phát hành internal testing.
- Thay thế: Expo Router → React Router trong entry mobile với stack theo tab; FlashList → `virtua`; `react-native-keyboard-controller` → `@capacitor/keyboard` + CSS; `StyleSheet` và file token TS sinh ra → Tailwind + `tokens.css`; SecureStore → plugin Keychain/Keystore; AsyncStorage → `@capacitor/preferences` (chỉ dữ liệu không nhạy cảm); jest-expo/RNTL → Vitest + Testing Library của web; EAS → `xcodebuild`/Gradle như scribe; Maestro → Playwright cho entry mobile + checklist đo trên máy thật.
- Bỏ: chuyển dictionary sang package `@localman/i18n-messages`. Quyết định cũ nhằm cho hai app dùng chung một nguồn; nay entry mobile nằm trong `apps/web` nên đã dùng chung sẵn. Nếu vẫn muốn tách package (cho Tauri hoặc app khác sau này), đó là một refactor riêng.
- Rủi ro mới cần theo dõi: App Store guideline 4.2 (app chỉ bọc trang web). Plan chỉ đi tới TestFlight internal (không qua duyệt); plan phát hành production phải chứng minh giá trị riêng của app (push, đăng nhập và lưu phiên native, log trực tiếp).

## Validation Log (2026-10-20)

| Câu hỏi | Quyết định |
|---|---|
| Nền tảng | Ban đầu: app native Expo/React Native. Đổi cùng ngày sang Capacitor bọc giao diện React (xem "Lịch sử quyết định") |
| "Giống app chat" | Cả điều hướng kiểu chat lẫn API client dạng hội thoại |
| Thời điểm | Lập plan và prototype trước, chưa code |
| Callback đăng nhập | Link https đã xác minh, yêu cầu iOS 17.4+ |
| i18n | Ban đầu: chuyển dictionary sang `@localman/i18n-messages`. Nay: entry mobile dùng thẳng dictionary của web, không cần package (xem "Lịch sử quyết định") |
| History theo request | Thêm trường tuỳ chọn `sourceRequestId` |
| Tab Thông báo và store | Giữ 4 tab; phát hành bằng tài khoản cá nhân (Play cần 12 người thử trong 14 ngày) |
| Apple Team ID | `AM5C55N339` (không phải bí mật; hiện công khai trong `apple-app-site-association`) |

Red-team đã sửa: phase 1 thiết kế lại (không thể trả token từ bản ghi chỉ có hash, CSRF guard chặn endpoint đổi mã, đăng nhập mobile xoá session web, app lạ có thể tự mở luồng để lấy session); phase 5 bỏ giả định rằng proxy tự thay biến và ghi history; phase 4 dùng bộ lọc `source=inbox` có sẵn và `lastRequestAt`.

## Reports

- [Red-team](../reports/red-team-261020-0742-mobile-app-plan.md)
- [Scout repo](../reports/scout-261020-0737-mobile-app-context.md)
- [Nghiên cứu stack Expo (lịch sử, đã thay bằng Capacitor)](../reports/researcher-261020-0737-expo-mobile-stack.md)

<!-- slug: localman-mobile-chat-app -->