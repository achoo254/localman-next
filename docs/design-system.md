# Design system

Localman dùng design system riêng, không lấy từ bên thứ ba. Prototype để đối chiếu nằm ở `plans/dattqh/261008-1123-localman-core/prototype/index.html`.

## Token

- **Nguồn duy nhất:** `packages/design-tokens/tokens.css`. Đây là file duy nhất được chứa literal màu (hex, `rgb()`).
- **Màu:** Radix Colors v3 (MIT). Màu chủ đạo violet, màu xám slate, accent phụ plum; success green, warning amber, error red, info blue. Ý nghĩa các bước: 1–2 nền app, 3–5 nền component, 6–8 viền, 9–10 màu đặc, 11 chữ độ tương phản thấp, 12 chữ độ tương phản cao.
- **Nhãn soft** (chữ trên nền tint như badge, method chip): dùng token `*-text`, ở light là step 12 để đạt ≥ 4.5:1.
- **Chữ success/warning ở light** chỉ đặt trên `--c-surface`; trên `--c-bg` chúng chỉ đạt khoảng 4.4:1.
- **Dark mode:** `@media (prefers-color-scheme: dark)` với guard `:root:not([data-theme="light"])`, cùng khối `:root[data-theme="dark"]`. Hai khối phải giống hệt nhau; `check:tokens` kiểm điều này.
- **Font:** Inter cho UI, JetBrains Mono cho code, URL, method và wordmark. Tự host qua `@fontsource`; import theo weight để có đủ subset vietnamese kèm `unicode-range`.
- **Khác:** radius 4/8/12/16/24, motion 150/200/300ms với easing standard, decelerate và accelerate. Khi `prefers-reduced-motion`, mọi duration về 1ms.

## Tailwind

`apps/web/src/styles/global.css` map token vào Tailwind bằng `@theme inline reference` và xoá bảng màu mặc định. Utility trỏ thẳng vào biến token, nên đổi `data-theme` là đổi màu ngay.

- Màu: `bg-surface`, `bg-bg`, `text-fg` (chữ chính), `text-muted` (chữ phụ), `text-primary`, `border-border`, `bg-primary-solid`…
- Khoảng cách: `--spacing` = `--space-1` (4px), nên `p-4` = 16px.
- Nhãn soft: utility `tint-soft` đọc biến `--tone`.
- Nền lưới 100px dùng token `--c-grid`.

## Primitive UI

`apps/web/src/components/ui/`: `button`, `icon-button`, `input`, `select`, `textarea`, `modal`, `modal-footer`, `dropdown-menu`, `badge`, `alert`, `tooltip`, `toast`, `form-field`, `external-link`.

- Nút bo 12px, hover scale 1.03, active 0.97, focus ring 2px offset 2.
- Modal bo 16px, 4 size `sm`/`md`/`lg`/`xl`, fade và trượt từ -20px trong 200ms easing decelerate, footer dính đáy 2 cột.
- Badge chữ mono uppercase. Icon Tabler, nét 1.5 áp chung bằng CSS.
- Modal, dropdown, tooltip và toast dựng trên Radix primitives để có a11y; select dùng `<select>` native.
- `DropdownMenuLabel` (trong `dropdown-menu`) là tiêu đề hoặc ghi chú không bấm được bên trong menu, ví dụ tên tài khoản hay "Chưa có thông báo nào". Không dùng `<p>` thường trong menu vì `role="menu"` chỉ nên chứa menuitem, label và separator.
- `ExternalLink` mở trang của site khác (IdP, `t.me`) qua `openExternal` trong `src/platform/navigation.ts`: trên web là tab mới với `noopener,noreferrer`; click có phím bổ trợ giữ hành vi mặc định của trình duyệt. Muốn trông như nút thì truyền `className={buttonClassName(…)}`.
- `FormField` truyền id, `aria-describedby`, `aria-invalid` và `required` qua context cho Input, Select và Textarea.
- Wordmark `Localman` (`components/brand/wordmark.tsx`): JetBrains Mono đậm, chữ "Local" màu `--c-primary`.
- Khối cấp trang, nút, input và link có `data-id` để trỏ bằng lời, phân cấp tối đa 3 bậc.

## Kiểm tra

`pnpm check:tokens` (`scripts/check-tokens.ts`, logic ở `scripts/check-tokens/`):

- Không có literal màu hay giá trị px cho khoảng cách trong `apps/web` ngoài `tokens.css`. Cho phép 0px/1px/2px. Bỏ qua một dòng bằng comment `check-tokens-ignore: <lý do>`, bắt buộc ghi lý do.
- Hai khối dark trong `tokens.css` phải khớp nhau.
- Các cặp chữ và nền chính ở cả hai theme phải đạt WCAG ≥ 4.5:1. APCA chỉ in ra để tham khảo.
