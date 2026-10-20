# ADR-0006: Một `brand.config.json` cho tên, màu, icon và định danh app

- **Ngày:** 2026-10-20
- **Trạng thái:** Đã chốt; manifest và icon đã nối vào web nhưng tắt (`"webInstall": false`) tới khi có icon thiết kế
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
7. **Web: manifest và icon nối sẵn trong code, tắt mặc định** (dattqh chốt 20/10/2026). Trước thay đổi này web không có favicon hay manifest; bật lên là thay đổi người dùng thấy (favicon, gợi ý cài app), mà icon hiện tại là dấu tạm (chữ L trắng trên nền violet-9). Vì vậy:
   - Công tắc là trường `webInstall` (boolean, bắt buộc, schema kiểm) trong `brand.config.json`, không phải biến môi trường: brand config là nguồn duy nhất, giá trị nằm trong git và đi theo build. Đang là `false`.
   - Plugin Vite `apps/web/src/config/brand-install-assets.ts` (phỏng theo `chat-next/apps/web/vite-brand.ts`) đọc công tắc lúc build. Bật thì nó chèn sau `<title>` của `index.html` các thẻ favicon ICO + SVG, Apple touch icon, `manifest`, `theme-color`, `apple-mobile-web-app-title`; phục vụ ở dev và emit khi build `manifest.webmanifest` cùng `icon.svg`, `favicon.ico`, PNG trong `packages/brand/generated/icons/`. Tắt thì plugin không có hook nào: `dist` giống hệt từng byte với khi chưa có plugin (đã so danh sách 123 file, sha256 `index.html` và thẻ trong `<head>` trước/sau).
   - `brand-install-assets.test.ts` chạy Vite thật: tắt thì build chỉ ra `index.html` nguyên vẹn; bật (truyền cấu hình có `webInstall: true`, không sửa file) thì có manifest, đủ icon, đủ thẻ, và dev server trả đúng Content-Type. Test cũng khẳng định `brand.config.json` đang tắt, nên bật là một thay đổi có chủ đích.

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
- **Bật manifest và icon trên web** (khi đã có icon thiết kế), trong cùng một thay đổi:
  1. Thay `packages/design-tokens/app-icon.svg` (bo góc, cho favicon và icon "any") và `app-icon-maskable.svg` (tràn viền, hình nằm trong vòng tròn 80% ở giữa) bằng bản thiết kế; chỉ dùng màu nút chính (`--c-primary-solid`, `--c-on-primary`), `brand-config.test.ts` kiểm.
  2. `pnpm brand:gen`, rồi commit `packages/brand/generated/`.
  3. Đặt `"webInstall": true` trong `brand.config.json` và sửa test "is off in brand.config.json…" trong `apps/web/src/config/brand-install-assets.test.ts` thành khẳng định đang bật.
  4. nginx (`infra/localman/nginx/localman-app.inc`): `location /` đã trả file có thật, nhưng `mime.types` của nginx 1.20 không có `webmanifest`; thêm `location = /manifest.webmanifest` với `default_type application/manifest+json` (kèm cache ngắn như `sw.js`). CSP đã có `manifest-src 'self'`.
  5. Kiểm: `pnpm --filter @localman/web build` thấy 8 file mới ở gốc `dist` và 6 thẻ trong `<head>` của `dist/index.html`; Lighthouse/DevTools > Application > Manifest không báo lỗi.
