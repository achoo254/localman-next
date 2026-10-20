---
title: "Phase 7: Bản build, E2E, tài liệu, DAST"
status: todo
tier: M
---

# Phase 7: Bản build, E2E, tài liệu, DAST

## Context Links

- Mẫu build và phát hành iOS: `scribe-next/web/scripts/ios-device.sh`, `ios-release.sh`, `scribe-next/docs/ios-app.md` (mục "Cài lên iPhone", "Phát hành TestFlight / App Store", `PrivacyInfo.xcprivacy`)
- `docs/deployment-guide.md`, `infra/localman/`
- `.github/workflows/ci.yml`, `e2e/playwright.config.ts`, `e2e/support/stack.ts`
- Bảng "Tiêu chí cảm giác native" trong `plan.md`

## Overview

Deploy thay đổi API của phase 1, 4 và 5 lên production, chạy DAST, rồi đưa app tới người thử nội bộ qua TestFlight và Google Play closed testing. Chạy E2E cho entry mobile, đo đủ tiêu chí cảm giác native trên máy thật, và viết tài liệu cho app mobile.

## Key Insights

- **Build native trên máy dev bằng script**, như scribe: iOS `xcodebuild` (Release, Team `AM5C55N339`, ký tự động) rồi `-exportArchive` tải thẳng lên App Store Connect bằng key API; Android `./gradlew bundleRelease` ra AAB, tải lên Play Console (Play App Signing). Không cần dịch vụ build ngoài. Máy dev 16 GB dùng chung: không chạy build iOS và Android cùng lúc, không chạy cùng test web.
- Phát hành bằng tài khoản cá nhân của bạn: Apple Developer ($99/năm) và Google Play ($25 một lần). Tài khoản Play cá nhân tạo sau 2023-11-13 phải có ít nhất 12 người thử opt-in liên tục 14 ngày trong closed testing trước khi được xin lên production. Plan này chỉ đi tới closed testing, nhưng nên bắt đầu đếm 14 ngày ngay khi có bản build đầu tiên.
- Callback https cần App ID của Apple và SHA-256 của chứng chỉ ký Android (Play App Signing). Hai giá trị này đặt vào env `MOBILE_IOS_APP_ID` và `MOBILE_ANDROID_CERT_SHA256` trên server trước khi người thử đăng nhập được. `MOBILE_IOS_APP_ID` = `AM5C55N339.com.hoandat.localman`. SHA-256 của Android lấy trong Play Console sau khi tạo app; bản debug cài qua `adb` dùng chứng chỉ debug, nên staging khai thêm fingerprint đó.
- **E2E hai tầng:** (1) Playwright chạy entry mobile trên khung điện thoại (WebKit và Chromium, bật touch) với cả stack ở cổng 46xx như E2E hiện có, plugin native thay bằng bản giả của lớp platform; (2) checklist trên máy thật cho phần chỉ native mới có: đăng nhập qua trình duyệt hệ thống, App Link, Keychain/Keystore, SSE qua plugin, bàn phím, vuốt lùi, số đo khung hình.
- TestFlight internal không qua duyệt của Apple. Khi xin lên App Store (plan sau), guideline 4.2 sẽ xét app có giá trị riêng ngoài trang web hay không; ghi vào follow-up.

## Requirements

- Deploy API qua `infra/localman/` như các đợt trước; ghi lại commit và thời điểm.
- DAST trên production cho `/auth/login?client=mobile`, trang xác nhận, `/auth/mobile/token`, `/auth/mobile/logout`, hai file association, Bearer trên `/api/v1` và trên SSE, `lastRequestAt` và `sourceRequestId`. Thử: dùng lại mã, redeem song song, sai verifier, `prompt=none`, redirect lạ, Bearer kèm cookie từ origin lạ, token sai, header CORS, đọc history của người khác qua `sourceRequestId`.
- Người dùng có thể tạo tài khoản ngay trong app (qua IdP), nên khi xin lên App Store bắt buộc có chức năng xoá tài khoản trong app. Ghi việc này thành follow-up cho plan phát hành production; plan này không làm.
- `PrivacyInfo.xcprivacy` của app (dữ liệu thu thập, không tracking) và `ITSAppUsesNonExemptEncryption = false` như scribe; bản Android có mục Data safety tương ứng trong Play Console.
- Bản build người thử trỏ tới production (`VITE_NATIVE_API_ORIGIN=https://localman.hoandat.com`); bản dev trỏ staging.
- Kịch bản Playwright cho entry mobile: đăng nhập (phiên giả qua platform), mở dự án, thấy log mới sau khi gọi mock, gửi request từ tab Client, đăng xuất.
- Checklist máy thật đo đủ bảng "Tiêu chí cảm giác native" (gồm khởi động lạnh ≤ 1,5 s) trên iPhone 15 Pro Max và một máy Android tầm trung, ghi số đo.
- Tài liệu: `docs/mobile-app.md` (chạy local, cấu hình, build, phát hành, plugin native, số đo, đã kiểm / còn phải kiểm trên máy thật), cập nhật `docs/system-architecture.md`, `README.md` (lệnh mới) và `CLAUDE.md` (cây thư mục, lệnh).

## Related Code Files

- Tạo: `apps/mobile/scripts/ios-device.sh`, `ios-release.sh`, `android-release.sh`; `apps/mobile/ios/App/App/PrivacyInfo.xcprivacy`
- Tạo: `e2e/specs/mobile-*.spec.ts` (hoặc project `mobile` trong `e2e/playwright.config.ts`), `docs/mobile-app.md`
- Sửa: `docs/system-architecture.md`, `README.md`, `CLAUDE.md`, `plans/dattqh/EXECUTION.md`

## Implementation Steps

1. Push và chờ CI xanh (`gh run watch`).
2. Deploy API, chạy DAST trên production, ghi kết quả vào thư mục reports.
3. Script build iOS và Android; tạo app trên App Store Connect (`com.hoandat.localman`) và Play Console; đặt hai env association trên server.
4. Chạy Playwright cho entry mobile trên CI; chạy checklist trên hai máy thật.
5. Mời người thử qua TestFlight internal và Play closed testing; thu phản hồi qua tab Tài khoản.
6. Viết tài liệu và cập nhật EXECUTION.md.

## Todo

- [ ] CI xanh
- [ ] Deploy và DAST
- [ ] Script build iOS/Android, app trên hai store, env association
- [ ] E2E Playwright cho entry mobile
- [ ] Checklist máy thật và số đo
- [ ] Người thử nội bộ
- [ ] Tài liệu

## Success Criteria

- DAST không có phát hiện mức cao; nếu có thì sửa rồi chạy lại.
- Bản build cài được trên ít nhất một máy iOS và một máy Android thật; năm bước E2E Playwright đều qua; checklist máy thật đạt mọi tiêu chí cảm giác native.
- Tài liệu đủ để một người khác build app từ đầu.

## Risk Assessment

- **Duyệt TestFlight chậm:** dùng internal testing (không cần duyệt) cho nhóm nhỏ trước.
- **Chưa có tài khoản store hoặc chưa đủ 12 người thử:** bạn mở tài khoản trước khi bắt đầu phase này; trong lúc chờ, cài trực tiếp (iOS qua `ios-device.sh` với provisioning phát triển, Android qua `adb install`) để thử sớm.
- **Guideline 4.2 khi lên production:** ngoài phạm vi plan này; ghi follow-up kèm danh sách giá trị riêng của app.

## Security Considerations

Key API App Store Connect (`.p8`), keystore upload của Android và mật khẩu của nó nằm ngoài repo (quyền 600, bản sao trong tệp access-tokens trên iCloud), không commit. Tài khoản thử dùng cho E2E chỉ có trên staging.

## Next Steps

Phát hành production lên store, xoá tài khoản trong app và push notification là các plan sau, khi có phản hồi của người thử.
