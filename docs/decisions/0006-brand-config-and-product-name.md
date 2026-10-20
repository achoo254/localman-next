# ADR-0006: Một `brand.config.json` cho tên, màu, icon và định danh app

- **Ngày:** 2026-10-20
- **Trạng thái:** Đã chốt; manifest và icon mới được sinh ra, chưa phục vụ trên web
- **Người quyết định:** dattqh (mẫu brand chung của hệ sinh thái `*-next`, xem `docs/ecosystem-architecture.md` §5 ở thư mục cha và `chat-next/docs/adr/0008-branding-and-naming.md`).

## Bối cảnh

Tên Localman, màu chủ đạo, bundle id `com.hoandat.localman` (app mobile Capacitor sắp làm, `plans/dattqh/261020-0742-localman-mobile-chat-app/`) và mẫu host `localman.{domain}` đang nằm rải rác hoặc chưa có chỗ khai. `chat-next` đã có mẫu: một file cấu hình có schema, một package sinh manifest và icon, một lint chặn tên viết cứng. Repo này còn chứa Tunelo, một sản phẩm khác có tên riêng.

## Quyết định

1. **`brand.config.json` ở gốc repo** (schema `brand.config.schema.json`) giữ: `appName`, `shortName`, `description`, `colors`, `icon`/`iconMaskable`, `appIds`, `urlScheme`, `primaryTenant` (`hoandat.com`, issuer `https://auth.hoandat.com`), và `hostTemplates.web` (`localman.{domain}`). Khác chat-next: chưa có `devOrigins`.
2. **`packages/brand` (`@localman/brand`)** chép có chủ đích từ `chat-next/packages/brand` @a5be0b4, giữ đồng bộ cho tới khi có package dùng chung. Entry `.` an toàn cho trình duyệt và API đã bundle (`brand` nhúng JSON lúc build; helper host `hostsFor`/`allowedOrigins` của chat-next bỏ qua tới khi có nơi gọi); entry `./build` chỉ chạy trên Node (kiểm schema bằng ajv, sinh manifest, vẽ icon bằng Chromium của Playwright).
3. **`pnpm brand:gen`** ghi `packages/brand/generated/`: `web.webmanifest.json`, `capacitor.json`, `tauri.json` và icon PNG/ICO. Chạy lại khi sửa brand; test so file trên đĩa với cấu hình hiện tại.
4. **Màu vẫn chỉ có một nguồn là `packages/design-tokens/tokens.css`.** `colors` trong brand là bản sao (`--c-primary-solid`, `--c-bg` light và dark), một test giữ chúng bằng nhau. SVG icon (`app-icon.svg`, `app-icon-maskable.svg`) có literal màu nên nằm trong `packages/design-tokens` và chỉ dùng màu nút chính.
5. **`pnpm check:brand`** (chạy trong `pnpm lint`) kiểm schema và chặn `appName` đứng nguyên một chuỗi (`"Localman"`) trong code của `apps/` và `packages/` (không tính test). Câu có nhắc tên (mô tả operation, chữ i18n) và định danh như header `X-Localman-*` không bị chặn. Ngoại lệ ghi ngay trên dòng: `check-brand-ignore: <lý do>`. Tunelo không bị kiểm theo tên của nó.
6. **File phục vụ nguyên văn** (`apps/web/public/sw.js`, `apps/web/index.html`) giữ tên dạng chữ; `check:brand` bỏ qua `apps/web/public/` (sửa byte `sw.js` buộc trình duyệt cài lại service worker), còn `apps/web/src/brand-static-files.test.ts` bắt chúng bằng `brand.appName`.
7. **Web chưa phục vụ manifest và icon.** Trước thay đổi này web không có favicon hay manifest; thêm vào là thay đổi người dùng thấy (favicon, gợi ý cài app), nên để quyết định riêng. Icon hiện tại là dấu tạm (chữ L trắng trên nền violet-9), cần duyệt thiết kế trước khi dùng.

## Lý do (tại sao)

- Một nguồn cấu hình cộng generator là cách duy nhất để đổi tên không sót chỗ, và kiểm được bằng lint/CI.
- Nhúng JSON lúc build (thay vì đọc file) vì API chạy dưới dạng bundle esbuild và web là bundle Vite; ajv chỉ cần lúc build.
- Chỉ chặn chuỗi nguyên tên (như chat) để không phải sửa hàng trăm câu mô tả và bản dịch; các câu đó không phải hằng tên sản phẩm.

## Đánh đổi & hệ quả

- Chữ i18n và mô tả operation/MCP vẫn chứa "Localman"; đổi tên sản phẩm phải sửa chúng bằng tay (tìm theo chuỗi).
- Nhãn host `localman` trong tenancy (`localmanDomainOf`, `appDomainOf(host, "localman")`), header `X-Localman-*`, khoá localStorage `localman-theme` là tên runtime, giữ nguyên cho tới khi có kế hoạch đổi riêng.
- Logotype `Wordmark` (`Local` + `man`) là thiết kế chữ, không lấy từ brand.

## Cách thay đổi

- Đổi tên, màu, icon: sửa `brand.config.json` (màu: sửa `tokens.css` trước), chạy `pnpm brand:gen`, build lại.
- Đổi bundle id: cửa hàng ứng dụng coi là app khác; cần kế hoạch chuyển người dùng.
