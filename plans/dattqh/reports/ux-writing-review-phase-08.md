# Rà copy tiếng Việt và token, phase 08 (T8)

Ngày rà: 09/10/2026 (Asia/Saigon). Chỉ đọc, không sửa code. Chuẩn đối chiếu: `docs/ux-writing.md` (viết tắt UXW §n), `docs/design-system.md`, `plans/dattqh/reports/ui-phase-08-landing-spec.md` (viết tắt Spec §n). Trạng thái cờ khi rà: mọi cờ trong `config/features.ts` đều tắt.

Phạm vi: `pages/landing/*`, `content/*`, `components/layout/{public-header,account-menu,app-header,app-footer}.tsx`, `features/subscription/plan-card.tsx`, `pages/account/account-page.tsx`, `pages/docs/*`, `features/feedback/*`, `pages/admin/feedback-inbox-*` (kèm `admin-nav.tsx`), `apps/web/index.html`. Đường dẫn dưới đây tính từ `apps/web/src/` trừ khi ghi khác.

## Kết luận nhanh

Copy phase 08 nhìn chung sạch: không có hex/rgb/px khoảng cách trong className, không dùng "dự án", chính tả "Huỷ/Xoá/tuỳ" đúng, không emoji, mọi hạn mức đọc từ `limitsFor()`/`FREE_LIMITS`, bảng so sánh có ngày "Cập nhật 08/10/2026" và link nguồn, hàng localhost và meter proxy đã ẩn khi cờ tắt, ghi chú "REST và MCP đều tính" đã gắn cờ `mockMcp`. Còn **1 lỗi High** (badge "Sắp mở" trên thẻ giá Pro), **8 lỗi Medium** (phần lớn là cùng một khái niệm nhưng gọi bằng nhiều tên, một số liệu sai nghĩa trong docs, form góp ý chưa nói ra dữ liệu gửi kèm) và một loạt Low.

## High

| # | file:dòng | Câu hiện tại | Câu đề xuất | Lý do |
|---|---|---|---|---|
| H1 | `pages/landing/pricing-table.tsx:46` (test khớp chữ ở `pricing-table.test.tsx:95`) | Badge Pro: "Sắp mở" | "Đang nhận đăng ký" (đúng Spec §7), hoặc bỏ badge | UXW §3: không đặt "Sắp có" vào thẻ giá và không hứa thời điểm ra mắt. "Sắp mở" là cùng một lời hứa về thời điểm, đặt ngay trên thẻ giá. Sửa thì phải đổi cả assertion trong test. |

## Medium

| # | file:dòng | Câu hiện tại | Câu đề xuất | Lý do |
|---|---|---|---|---|
| M1 | `pages/docs/quick-start-page.tsx:54-55` | "Gói Free có 3 project và 10 resource." | "Gói Free có 3 project, 10 resource mỗi project." | Sai nghĩa số liệu (UXW §4): đọc thành 10 resource tổng. Landing, thẻ giá, trang tài khoản và bảng so sánh đều viết "mỗi project". |
| M2 | `pages/landing/more-features-section.tsx:68` | "Template riêng cho từng endpoint, dùng biến $mockData, $count và Faker." | Mô tả: "Template riêng cho từng endpoint, dùng biến `"$mockData"`, `"$count"` và Faker." (render biến trong `<code>`, kèm ngoặc kép) | UXW §2: tên biến đặt trong `code` và viết đúng như hệ thống nhận. Spec §10 cũng ghi biến phải nằm trong ngoặc kép (luật whole-string); viết trần là dạy sai cú pháp. Cần đổi `description` sang `ReactNode`. |
| M3 | `pages/landing/relations-demo.tsx:47` | h2 "Quan hệ giữa resources" | "Quan hệ giữa các resource" | UXW §2: không thêm "s" trong câu, số nhiều chỉ dành cho tên mục điều hướng. Spec §1/§9 và plan phase dùng đúng chữ "resources" nên đây là chỗ spec lệch checklist; cần người chốt bên nào thắng (xem Concerns). |
| M4 | `pages/account/account-page.tsx:88`, `components/layout/account-menu.tsx:133`, `features/notifications/notification-settings-page.tsx:28,70,103` | Cùng một trang có 4 tên: nút "Cài đặt thông báo", menu "Kênh thông báo", h1 và tab "Thông báo", tiêu đề khối "Kênh nhận thông báo" | Thống nhất là "Kênh thông báo": nút ở trang tài khoản, h1 và `useAppTitle` của trang | UXW §5: cùng hành động thì cùng chữ. Spec §3.2 đã đổi menu thành "Kênh thông báo" để khỏi nhầm với chuông, nhưng h1 "Thông báo" lại trùng tên chuông. |
| M5 | `features/subscription/manage-subscription-modal.tsx:118,125` (ngoài danh sách file, nhưng dùng chung `PlanCard` với landing) | Nút "Liên hệ nâng cấp"; ghi chú "Bấm Liên hệ nâng cấp để để lại nhu cầu, chúng tôi sẽ liên hệ khi gói Pro sẵn sàng." | Nút "Liên hệ"; ghi chú "Gói Pro chưa mở thanh toán. Bấm Liên hệ để cho chúng tôi biết bạn cần gì." (giống `landing-pricing-note`) | UXW §3 ghi CTA gói Pro là "Liên hệ", UXW §5 yêu cầu cùng hành động cùng chữ; landing đã dùng "Liên hệ". Câu ghi chú còn lỗi lặp từ "để để lại". |
| M6 | `features/feedback/feedback-form-body.tsx:163-167` | Đã đăng nhập: "Góp ý gắn với tài khoản của bạn để chúng tôi dễ xem lỗi." Khách: "Không bắt buộc để lại email." | Đã đăng nhập: "Góp ý gửi kèm tài khoản của bạn và khu vực bạn đang mở (ví dụ Projects), không kèm đường dẫn." Khách: "Góp ý gửi kèm khu vực bạn đang mở (ví dụ trang chủ), không kèm đường dẫn." | UXW §6: form gửi kèm dữ liệu ngầm thì phải ghi ra. Form luôn gửi `source` (`feedback-draft.ts:43-51`) nhưng không câu nào nói. Câu cho khách hiện chỉ lặp lại nhãn "(tuỳ chọn)" và chỉ nhắc email trong khi ô nhận cả Telegram. |
| M7 | `content/competitor-facts.ts:91-98` qua `pages/landing/comparison-section.tsx:91-98` | Link nguồn chỉ có sr-only "(mở ở tab mới)", không có icon ↗ | Thêm `<IconExternalLink size={14} aria-hidden="true" />` sau nhãn nguồn, giống menu tài khoản | UXW §5: mục mở trang ngoài phải có icon ↗ kèm sr-only. Menu tài khoản đã làm đúng; link nguồn của bảng so sánh mới làm một nửa. |
| M8 | `pages/admin/feedback-inbox-page.tsx:37,112`, `pages/admin/admin-nav.tsx:6`, `components/layout/account-menu.tsx:175`, `pages/admin/feedback-inbox-page.tsx:119` | Menu: "Quản trị · Hộp thư góp ý"; h1 và tab: "Quản trị · Góp ý / Liên hệ"; nav: "Góp ý / Liên hệ"; vùng danh sách: "Hộp thư góp ý" | Dùng "Hộp thư góp ý" cho h1, tab ("Quản trị · Hộp thư góp ý") và nav | UXW §5: một đích một tên. Bấm "Hộp thư góp ý" mà mở trang tên khác làm người dùng tưởng đi nhầm chỗ. "Góp ý / Liên hệ" nên chỉ còn là tên form. |

## Low

| # | file:dòng | Câu hiện tại | Câu đề xuất | Lý do |
|---|---|---|---|---|
| L1 | `features/feedback/feedback-form.tsx:124` | "Góp ý đã tới người vận hành Localman." | "Chúng tôi đã nhận được góp ý của bạn." | UXW §1: gọi đội làm sản phẩm là "chúng tôi". Câu sau đã dùng "Chúng tôi". |
| L2 | `features/feedback/feedback-draft.ts:89`, `features/feedback/feedback-api.ts:41`, `features/feedback/feedback-form.tsx:124` | "Nhập nội dung góp ý.", "Chưa gửi được góp ý…", "Góp ý đã tới…" | "Nhập nội dung.", "Chưa gửi được. Nội dung vẫn còn đây, hãy thử lại.", "Chúng tôi đã nhận được tin của bạn." | Loại "Báo lỗi" hay "Hỏi về gói" cũng bị gọi là "góp ý"; dùng từ trung tính để đúng với mọi loại. |
| L3 | `features/feedback/feedback-api.ts:23,27,31` | "Bạn gửi nhiều lần liên tiếp. Đợi vài phút rồi thử lại." (và hai lỗi xác minh, hợp lệ) | Thêm câu "Nội dung vẫn còn đây." vào cuối | UXW §6: lỗi giữ dữ liệu đã nhập thì nói ra; Spec §12 ghi 429 "giữ nguyên nội dung". Chỉ FALLBACK đang nói. |
| L4 | `features/feedback/feedback-fields.tsx:70`, `features/feedback/feedback-draft.ts:91` | "{n}/2000 ký tự", "Nội dung tối đa 2000 ký tự." | "{n}/2.000 ký tự", "Nội dung tối đa 2.000 ký tự." (qua `formatNumber`) | UXW §4: số định dạng vi-VN. |
| L5 | `pages/admin/feedback-inbox-item.tsx:31,34` | Nút "Đã xử lý" | "Đánh dấu đã xử lý" | UXW §5: nút bắt đầu bằng động từ. Nút cạnh đó đã là "Đánh dấu đã đọc", "Đánh dấu chưa đọc". |
| L6 | `pages/admin/feedback-inbox-page.tsx:78` | `Đã chuyển sang "Đã xử lý".` | `Đã chuyển sang “Đã xử lý”.` | Ngoặc kép thẳng lẫn với ngoặc cong đã dùng ở `live-mock-sync-section.tsx:101`. |
| L7 | `pages/admin/feedback-inbox-page.tsx:114` (cùng mẫu `pro-interest-page.tsx:89`) | Badge "Chỉ owner" | "Chỉ chủ sở hữu" | "owner" không nằm trong danh sách thuật ngữ giữ EN (UXW §2); docs và trang project dùng "chủ project". Trang chỉ owner thấy nên ưu tiên thấp. |
| L8 | `components/layout/app-header.tsx:26`, `components/layout/public-header.tsx:41` | `aria-label="Localman — trang chủ"` | Header công khai: "Localman, về trang chủ"; header đã đăng nhập: "Localman, về Projects" | UXW §1 cấm dấu gạch dài nối ý. Ở header đã đăng nhập, wordmark dẫn tới `/projects` nhưng tên truy cập lại nói "trang chủ". Spec §3.1 ghi "giữ nguyên" nên cần người chốt. |
| L9 | `pages/landing/hero-section.tsx:65`, `pages/docs/quick-start-page.tsx:95`, `pages/docs/custom-responses-page.tsx:37,44` | Lúc "Faker", lúc "Faker.js", lúc "method Faker" | Copy mô tả sản phẩm dùng "Faker.js" (đúng danh sách UXW §2); giữ "Faker" ở tiêu đề h1 vì Spec và SEO đã chốt độ dài | Nhất quán thuật ngữ. |
| L10 | `components/layout/public-header.tsx:69`, `components/layout/app-footer.tsx:23`, `pages/docs/docs-layout.tsx:16`, `pages/docs/docs-content.tsx:33` | Header/footer "Docs"; TOC "Tài liệu"; tab "… · Tài liệu Localman" | Chấp nhận "Docs" làm tên mục điều hướng; đổi tab thành "… · Docs Localman", hoặc đổi cả link thành "Tài liệu" | Hai tên cho một khu vực. Thấp vì cả hai đều dễ hiểu. |
| L11 | `pages/docs/status-codes.tsx:37,53,73,78,90` | "Content-Type: application/json", "POST lên /:res/:id", "bằng limit", "header Retry-After", "X-Localman-Request-Id" viết trần | Bọc bằng `<InlineCode>` như các ô khác của cùng bảng | UXW §2: tên header, path, query đặt trong `code`. |
| L12 | `pages/docs/status-codes.tsx:21-22` | Ô "—" ở cột Mã | `<span aria-hidden="true">—</span><span className="sr-only">Không có</span>` (như `data-modeling-demo.tsx:83-84`) | Trình đọc màn hình đọc "gạch ngang", vô nghĩa. |
| L13 | `pages/docs/quick-start-page.tsx:51` | "bấm nút tạo project" | "bấm Tạo project" | Gọi đúng nhãn nút như các bước khác ("bấm Thêm resource", "bấm Đổi URL mock"). Nhãn thật ở `projects-list.tsx:96`. |
| L14 | `pages/landing/pricing-table.tsx:47` | "Hạn mức lớn hơn cho team và các project chạy thật." | "Hạn mức lớn hơn cho các project chạy thật, nhiều thành viên hơn." | "team" gợi workspace team (phase 11, chưa có). Câu này lấy từ Spec §7 nên cần người chốt. |
| L15 | `pages/landing/more-features-section.tsx:83,91` | "Custom endpoints", "Webhooks" | "Custom endpoint", "Webhook" | UXW §2: số nhiều chỉ dùng cho tên mục điều hướng. Chấp nhận giữ nếu coi đây là tên tính năng. |
| L16 | `pages/landing/hero-section.tsx:100` (chỉ hiện khi bật `apiClient`) | "3 project mock, 10 resource và 5.000 request qua proxy mỗi tháng." | "3 project mock, 10 resource mỗi project, 5.000 request qua proxy mỗi tháng." | "10 resource" thiếu đơn vị, dễ đọc thành "10 resource mỗi tháng". Câu lấy từ Spec §4; sửa trước khi bật cờ. |
| L17 | `pages/account/account-page.tsx:148` (chỉ hiện khi bật `apiClient`) | "Request proxy tháng này" | "Request qua proxy tháng này" | Thẻ giá viết "request qua proxy" (`plan-card.tsx:40`), meter mock viết "Request tới mock tháng này". |
| L18 | `pages/landing/live-mock-sync-section.tsx:44` (chỉ hiện khi bật `liveMockSync`) | "…header hay body bạn đã sửa vẫn được giữ." | Rà lại theo hành vi thật của phase 16 trước khi bật cờ | Spec §5 đã ghi phải rà lại vì phase 16 có bước xem diff trước khi áp. Hiện chưa render nên không phải lỗi. |

## Token và brand

`pnpm check:tokens` không được chạy ở lượt này (chỉ đọc). Kết quả quét tay trên các file trong phạm vi:

- Không có literal màu (hex, `rgb()`) và không có giá trị px cho khoảng cách trong className. Chữ "px" chỉ xuất hiện trong comment.
- Không có màu ngoài token. Các modifier độ mờ (`bg-primary/6`, `bg-primary/12`, `bg-bg/82`) đều đi trên utility đã map.

| # | file:dòng | Hiện tại | Đề xuất | Mức, lý do |
|---|---|---|---|---|
| T1 | `features/feedback/feedback-form.tsx:119` | `bg-[color-mix(in_srgb,var(--c-success)_12%,var(--c-surface))]` | Tách một khối "đã gửi" dùng chung với `pro-interest-modal.tsx:86` (cùng markup), nền qua `tint-soft` với `[--tone:var(--c-success)]` | Low. Có dùng token nhưng bỏ qua utility đã map, và lặp nguyên khối của form quan tâm Pro. |
| T2 | 18 chỗ trong phạm vi (65 chỗ toàn `apps/web`), ví dụ `pages/landing/pricing-section.tsx:20`, `components/layout/app-footer.tsx:17` | `text-[0.8125rem]` (13px) | Thêm bước chữ vào `@theme` của `global.css` (ví dụ `--text-2xs: 0.8125rem`) rồi dùng `text-2xs` | Low. Không vi phạm `check:tokens` (đơn vị rem) nhưng là giá trị lặp chưa thành token. Thuộc phạm vi dọn chung, không riêng phase 08. |
| T3 | `pages/landing/landing-section.tsx:46,51`, `hero-section.tsx:55`, `landing-page.tsx:71` | `text-[clamp(…)]`, `text-[1.0625rem]`, `tracking-[0.12em]`, `tracking-[-0.02em]` | Giữ như Spec §2 đã chốt; cân nhắc gom thành utility `heading-display` nếu trang khác cần | Low, chỉ ghi nhận. |
| T4 | `pages/admin/feedback-inbox-*.tsx` (`px-5`, `py-7`), `pages/account/account-page.tsx:59` (`gap-5`), `pages/docs/docs-content.tsx:36` (`gap-10`), `pages/landing/generated-endpoints-list.tsx:54,63` (`gap-1.5`, `py-0.5`), `components/layout/account-menu.tsx:112` (`gap-0.5`) | Bước khoảng cách không có trong bảng token (1, 2, 3, 4, 6, 8, 12, 16, 24) | Đưa về bước gần nhất (`px-6`, `py-8`, `gap-6`, `gap-12`, `gap-2`) hoặc ghi vào `design-system.md` là bước phụ được phép | Low. `px-5` của inbox chép từ trang Pro interest nên nên sửa cả hai cùng lúc. |
| T5 | `pages/admin/admin-nav.tsx:22` | `min-h-10` (40px) | Thêm `pointer-coarse:min-h-11` | Low. Vùng chạm dưới 44px trên màn cảm ứng (Spec §15). |

## Đã đúng, không cần sửa

- Thẻ giá: không có giá Pro và không có chữ "chưa chốt", CTA "Liên hệ", Free "Bắt đầu miễn phí". Ghi chú có câu về giới hạn tốc độ theo giây (UXW §4). Mục proxy chỉ hiện khi bật `apiClient`.
- Header công khai: rút "Bắt đầu miễn phí" thành "Bắt đầu" dưới 640px bằng `max-sm:hidden`, đúng UXW §5.
- Menu tài khoản đổi "Đổi email" thành "Email", vì IdP chưa có luồng đổi email (comment ở `account-menu.tsx:38-43`). Lệch Spec §3.2 nhưng trung thực hơn; giữ.
- Bảng so sánh: hàng localhost ẩn khi cờ tắt, không có "Sắp có", có "Cập nhật 08/10/2026", nguồn và câu ghi chú về mockapi.io. Ô Postman ghi đúng điểm mạnh (code mock giữ trạng thái).
- Thẻ "Xem ví dụ" có sr-only tên thẻ; hint của canvas demo, badge đếm endpoint và kết quả sao chép đều là live region.
- `index.html`: title và description khớp Spec §14, có test ràng số project với `FREE_LIMITS`.

Status: DONE_WITH_CONCERNS
Summary: Đã rà copy và token của toàn bộ file phase 08 trong phạm vi: 1 High (badge "Sắp mở" trên thẻ giá Pro), 8 Medium (đặt tên không nhất quán, docs ghi sai nghĩa hạn mức resource, form góp ý chưa nói ra dữ liệu gửi kèm, biến template chưa đặt trong code), 18 Low và 5 ghi chú token Low. Không tìm thấy hex/rgb/px khoảng cách trong className.
Concerns:
- Một số mục lệch giữa Spec và `docs/ux-writing.md` (M3 "resources", L8 aria-label có gạch dài, L14 "cho team", L16 câu hero localhost). Cần người chốt bên nào thắng; báo cáo này đề xuất theo `ux-writing.md`.
- H1 và M5 cần sửa cả test (`pricing-table.test.tsx:95`) và một file ngoài danh sách T8 (`manage-subscription-modal.tsx`); M4 chạm `notification-settings-page.tsx`, cũng ngoài danh sách.
- Chưa chạy `pnpm check:tokens` và axe (chỉ đọc, và một agent khác đang sửa landing). Số dòng có thể lệch nếu agent hiệu năng đổi file landing sau lượt rà này.
- `index.html` chưa có `og:image`, `twitter:card` là `summary` và bỏ canonical có ghi lý do. Lệch Spec §14 nhưng hợp lý; cần quyết có làm ảnh OG 1200×630 hay không.
- Ô "Mock ở gói Free" của Postman ("Mock server trả example đã lưu") không trả lời đúng tiêu chí về số lượng. Nếu trang giá Postman có hạn mức số lượt gọi mock thì nên ghi số đó kèm nguồn; lượt này chưa kiểm lại nguồn ngoài.
