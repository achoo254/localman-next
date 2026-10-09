# Design system

Localman dùng design system riêng, không lấy từ bên thứ ba. Prototype để đối chiếu nằm ở `plans/dattqh/261008-1123-localman-core/prototype/index.html`.

## Token

- **Nguồn duy nhất:** `packages/design-tokens/tokens.css`. Đây là file duy nhất được chứa literal màu (hex, `rgb()`).
- **Màu:** Radix Colors v3 (MIT). Màu chủ đạo violet, màu xám slate, accent phụ plum; success green, warning amber, error red, info blue. Ý nghĩa các bước: 1–2 nền app, 3–5 nền component, 6–8 viền, 9–10 màu đặc, 11 chữ độ tương phản thấp, 12 chữ độ tương phản cao.
- **Nhãn soft** (chữ trên nền tint như badge, method chip): dùng token `*-text`, ở light là step 12 để đạt ≥ 4.5:1.
- **Chữ success/warning ở light** chỉ đặt trên `--c-surface`; trên `--c-bg` chúng chỉ đạt khoảng 4.4:1.
- **Dark mode:** `@media (prefers-color-scheme: dark)` với guard `:root:not([data-theme="light"])`, cùng khối `:root[data-theme="dark"]`. Hai khối phải giống hệt nhau; `check:tokens` kiểm điều này.
- **Font:** Inter cho UI, JetBrains Mono cho code, URL, method và wordmark. Tự host file của `@fontsource`, nhưng khai báo `@font-face` riêng (`styles/fonts-inter.css`, `styles/fonts-jetbrains-mono.css`): chỉ subset latin, latin-ext, vietnamese, và range latin-ext bỏ các chữ tiếng Việt đã có trong subset vietnamese (đ, ơ, ư, ă…). Dùng CSS theo weight của fontsource thì mỗi trang tiếng Việt tải cả hai file, nặng thêm khoảng 36 kB mỗi weight Inter. Font không được nhúng base64 vào CSS (`assetsInlineLimit`).
- **Khác:** radius 4/8/12/16/24, motion 150/200/300ms với easing standard, decelerate và accelerate. Khi `prefers-reduced-motion`, mọi duration về 1ms.

## Tailwind

`apps/web/src/styles/global.css` map token vào Tailwind bằng `@theme inline reference` và xoá bảng màu mặc định. Utility trỏ thẳng vào biến token, nên đổi `data-theme` là đổi màu ngay.

- Màu: `bg-surface`, `bg-bg`, `text-fg` (chữ chính), `text-muted` (chữ phụ), `text-primary`, `border-border`, `bg-primary-solid`…
- Khoảng cách: `--spacing` = `--space-1` (4px), nên `p-4` = 16px. Quy đổi token sang utility:

  | Token | px | Tailwind |
  |---|---|---|
  | `--space-1` | 4 | `1` (`p-1`, `gap-1`) |
  | `--space-2` | 8 | `2` |
  | `--space-3` | 12 | `3` |
  | `--space-4` | 16 | `4` |
  | `--space-5` | 24 | `6` |
  | `--space-6` | 32 | `8` |
  | `--space-7` | 48 | `12` |
  | `--space-8` | 64 | `16` |
  | `--space-9` | 96 | `24` |

  Ví dụ prototype `padding: var(--space-5)` là `p-6`; trạng thái rỗng `var(--space-7) var(--space-5)` là `px-6 py-12`.
- Chữ nhỏ: `text-sm` và `text-xs` dùng line-height 1.55 như body (đặt trong `@theme` của `global.css`).
- Nhãn soft: utility `tint-soft` đọc biến `--tone`.
- Nền lưới 100px dùng token `--c-grid`.

## Primitive UI

`apps/web/src/components/ui/`: `button`, `icon-button`, `input`, `select`, `textarea`, `modal`, `modal-footer`, `confirm-modal`, `card`, `empty-state`, `dropdown-menu`, `badge`, `alert`, `tooltip`, `toast`, `form-field`, `external-link`, `json-editor`, `copy-field`, `code-block`, `tabs`, `switch`, `segmented-control`.

- Nút bo 12px, hover scale 1.03, active 0.97, focus ring 2px offset 2. Ba size: `sm`, `md` (mặc định) và `lg` (cao 48px, chữ 16px) chỉ cho CTA cấp trang như hero và dải cuối landing.
- Modal bo 16px, 4 size `sm`/`md`/`lg`/`xl`, fade và trượt từ -20px trong 200ms easing decelerate, footer dính đáy 2 cột.
- Badge chữ mono uppercase. Icon Tabler, nét 1.5 áp chung bằng CSS.
- Modal, dropdown, tooltip, toast và tabs dựng trên Radix primitives để có a11y; select dùng `<select>` native.
- `DropdownMenuRadioGroup` / `DropdownMenuRadioItem` (trong `dropdown-menu`) cho menu chọn một trong vài giá trị: `role="menuitemradio"` với `aria-checked`, mục đang chọn có dấu check màu primary. Dùng cho `LanguageSwitcher` (`src/i18n/language-switcher.tsx`, menu ngôn ngữ ở hai header và footer; xem `docs/i18n.md`).
- `DropdownMenuLabel` (trong `dropdown-menu`) là tiêu đề hoặc ghi chú không bấm được bên trong menu, ví dụ tên tài khoản hay "Chưa có thông báo nào". Không dùng `<p>` thường trong menu vì `role="menu"` chỉ nên chứa menuitem, label và separator.
- `ExternalLink` mở trang của site khác (IdP, `t.me`) qua `openExternal` trong `src/platform/navigation.ts`: trên web là tab mới với `noopener,noreferrer`; click có phím bổ trợ giữ hành vi mặc định của trình duyệt. Muốn trông như nút thì truyền `className={buttonClassName(…)}`.
- Thẻ: `cardClassName` / `Card` (`card.tsx`) là bề mặt chung, bo 24px (`rounded-xl`), viền `--c-border`, nền `--c-surface`, `shadow-sm`. Dùng class trên phần tử ngữ nghĩa (`li`, `article`, `section`); padding thẻ là `p-6`. `EmptyState` (`empty-state.tsx`) là thẻ rỗng có ô icon, tiêu đề, mô tả và một hành động.
- `IconButton` là ô vuông 32/36px (`sm`/`md`), lên 40/44px trên màn cảm ứng. Nút chỉ có icon dựng từ `buttonClassName` phải truyền `iconOnly: true` để bỏ `min-h-*` và `px-*` của nút chữ.
- `Modal` nhận `initialFocusRef`: ref của phần tử cần focus khi mở, hoặc `"dialog"` để focus khung (nội dung chỉ đọc như Quản lý gói). Ref còn rỗng (thân modal tải lazy) thì focus khung. Quy ước: form focus ô đầu tiên cần nhập; hộp thoại phá huỷ focus nút "Huỷ". Escape trong một combobox đang mở (`role="combobox"`, `aria-expanded="true"`) chỉ đóng danh sách của nó, không đóng modal.
- `JsonEditor` (`json-editor.tsx`) là ô JSON trên CodeMirror 6: tô màu, khớp ngoặc, undo, kiểm tra khi blur (gạch chân chỗ lỗi, báo "JSON không hợp lệ ở dòng X, cột Y" qua `onValidate`; `validate` thêm kiểm tra ngữ nghĩa, `allowEmpty` cho template tuỳ chọn). Theme chỉ dùng biến token nên theo light/dark; Tab để rời ô, `Ctrl/Cmd+]` để thụt lề. Có tên truy cập qua `label` hoặc `labelledBy`. CodeMirror nặng (chunk `vendor-codemirror` khoảng 331 kB) nên chỉ import trong modal tải lazy, không import từ trang. Trang và component nhẹ đọc hằng qua `@localman/shared/constants` (không zod, không catalog Faker); catalog Faker qua `@localman/shared/faker-catalog`, chỉ dùng trong modal resource.
- `ConfirmModal` là modal `sm` cho thao tác phá huỷ (xoá project, xoá đăng ký): khối cảnh báo nền tint error có icon cảnh báo, footer Huỷ / nút `danger`, mở ra là focus nút Huỷ. `onConfirm` trả Promise; modal chỉ đóng khi thành công, lỗi thì hiện ngay trong modal.
- `Modal` và `ConfirmModal` nhận `onCloseAutoFocus` để chọn nơi trả focus khi đóng, dùng khi phần tử mở modal đã biến mất (dòng vừa bị xoá, project vừa rời). `ConfirmModal` có `confirmDisabled` để khoá nút xác nhận khi chưa biết hậu quả (dry run đang tải).
- `CopyField` (`copy-field.tsx`) là ô chỉ đọc kèm nút sao chép, cho link chỉ hiện một lần (link mời, magic link). Kết quả sao chép được báo qua vùng `aria-live` ngay trong ô, vì toast nằm ngoài dialog Radix và có thể bị ẩn khỏi trình đọc màn hình. `autoCopy` sao chép ngay khi hiện; trình duyệt từ chối (Safari sau `await`) thì hiện gợi ý trung tính, không coi là lỗi.
- `CopyField` nhận `itemLabel` (mặc định `"link"`) để nút và thông báo nói đúng thứ được sao chép: "Sao chép URL", "Đã sao chép token".
- `CodeBlock` (`code-block.tsx`) là snippet chỉ đọc chữ mono kèm nút sao chép (`{data-id}-copy`), dùng ở docs, tab MCP và landing. Dòng dài cuộn ngang trong khối (focus được bằng bàn phím); `wrap` cho xuống dòng mềm, dành cho lệnh shell một dòng, nội dung sao chép không đổi. JSON giữ cuộn ngang.
- `Tabs` (`tabs.tsx`, `@radix-ui/react-tabs`): `Tabs`, `TabsList` (viền dưới `border-border-subtle`, cuộn ngang khi hẹp), `TabsTrigger` (chữ mono 13px, cao tối thiểu 44px, tab đang chọn `text-primary` gạch chân 2px, chỉ đổi màu) và `TabsContent`. Có đủ `tablist`/`tab`/`tabpanel`, ←/→, Home/End. Tab cần sống qua lần đổi tab (token chỉ hiện một lần) thì dùng `forceMount`.
- `Switch` (`switch.tsx`): `role="switch"`, `aria-checked`, rãnh 36×20, vùng chạm 44px trên màn cảm ứng bằng pseudo-element. Chỉ báo trạng thái muốn đổi qua `onCheckedChange`; nơi dùng tự quyết khi nào áp (ví dụ sau khi API thành công). Cần `aria-label` hoặc `aria-labelledby`.
- `SegmentedControl` (`segmented-control.tsx`): chọn một trong vài dạng của cùng một nội dung (ngôn ngữ ví dụ ở docs, định dạng cấu hình MCP). `fieldset` với `legend` sr-only, các nút `aria-pressed`, không dùng role tab vì không có panel riêng. `theme-toggle` giữ dạng nút icon riêng.
- Avatar project (`pages/projects/project-avatar.tsx`) chia chữ cái đầu (bỏ dấu, `đ` thành `d`) thành 7 nhóm, nền là token `--c-viz-*` (bước 11 ở light), chữ `--c-on-tone`; mọi cặp đạt ≥ 4.6:1 ở cả hai theme.
- `FormField` truyền id, `aria-describedby`, `aria-invalid` và `required` qua context cho Input, Select và Textarea. `announceError` gắn `role="alert"` cho lỗi xuất hiện sau một thao tác mà focus không nằm ở ô nhập (ví dụ bấm "Mời").
- Wordmark `Localman` (`components/brand/wordmark.tsx`): JetBrains Mono đậm, chữ "Local" màu `--c-primary`.
- Khối cấp trang, nút, input và link có `data-id` để trỏ bằng lời, phân cấp tối đa 3 bậc.

## Canvas cây resource

`features/resource-tree/` (trang `/projects/:projectId`), theo `TREE_GEOMETRY` của prototype:

- Hình học trong `tree-layout.ts` (hàm thuần): thẻ node 208×104, cột 268, hàng 128, gốc (72, 24), connector cách mép trên 22, thanh "Thêm vào root" rộng 32. Đường nối gấp khúc bo góc tối đa 10. Số đo này là toán học SVG/định vị tuyệt đối, không phải class khoảng cách.
- **Lệch spec có chủ đích:** spec phase 06 ghi cột 150px, hàng 50px (số của mockapi.io, nơi node chỉ là tên và thanh generator). Localman giữ hình học của prototype vì prototype là nguồn sự thật UI: node là thẻ có thêm hàng Sửa / Dữ liệu / Xoá, nên cột 150 sẽ làm các thẻ rộng 208 chồng lên nhau. Thanh generator giữ đúng 106×25.
- Thanh generator 106×25 (`generator-bar.tsx`): rê chuột hiện số 0–100 tại con trỏ, click sinh đúng số đó; bàn phím ←/→ (↓/↑) bước 10, Home/End, Enter để sinh, Escape bỏ giá trị chờ; `role="slider"` với `aria-valuenow/min/max`. Fill gradient từ `--c-primary`, chạy 200ms (`--dur-base`), tắt khi `prefers-reduced-motion`. Resource con chưa sinh được khi cha chưa có dữ liệu: nền gạch chéo và `aria-disabled`.
- Nút Sửa / Dữ liệu / Xoá của node hiện khi hover hoặc focus, luôn hiện trên màn cảm ứng. Canvas nằm trong `overflow-x-auto` nên cây rộng cuộn trong thẻ, trang không cuộn ngang ở 375px.
- Chế độ `mode="demo"` (landing, khối "Quan hệ giữa resources"): hình học `DEMO_TREE_GEOMETRY` (node 156×44, cột 200, hàng 60, gốc (64, 12)), node chỉ có tên và hai chấm nối, không link, không thanh generator, không hàng thao tác; `data-id` là `demo-node-{name}` và `demo-node-root`. Thao tác lồng chỉ đổi state phía client, không gọi API. Hai chế độ dùng chung `tree-canvas-frame.tsx` (hint, đường nối, thanh root) và `node-connectors.tsx`.
- Chip URL ở thẻ API endpoint: secret dùng tone `--c-text-muted`, prefix `--c-accent`, `:endpoint` `--c-primary` (utility `tint-soft`), mỗi chip focus được để đọc tooltip.

## Kiểm tra

`pnpm check:tokens` (`scripts/check-tokens.ts`, logic ở `scripts/check-tokens/`):

- Không có literal màu hay giá trị px cho khoảng cách trong `apps/web` ngoài `tokens.css`. Cho phép 0px/1px/2px. Bỏ qua một dòng bằng comment `check-tokens-ignore: <lý do>`, bắt buộc ghi lý do.
- Hai khối dark trong `tokens.css` phải khớp nhau.
- Các cặp chữ và nền chính ở cả hai theme phải đạt WCAG ≥ 4.5:1. APCA chỉ in ra để tham khảo.
