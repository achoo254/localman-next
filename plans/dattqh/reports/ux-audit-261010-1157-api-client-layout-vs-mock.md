# Audit bố cục `/api-client` so với prototype

Ngày 10/10/2026. Mock: `plans/dattqh/261008-1123-localman-core/prototype/api-client.html`. App: build local từ commit `785ccfb`, trùng với release prod `20261010-043906-785ccfb66e31`. Trang prod đòi đăng nhập IdP, nên ảnh chụp lấy từ stack E2E (IdP giả). Kiểm ở bốn viewport: 1440, 1024, 768 và 375 px.

Jev quyết hai điểm. Phạm vi là chỉ đưa bố cục của các tính năng đã có về đúng mock, không dựng placeholder cho tính năng chưa có backend (0.93; placeholder 0.07). Request và response xếp dọc như mock (1.0).

## Lệch so với mock và cách đã sửa

| # | Mức | Trước | Sau |
|---|---|---|---|
| 1 | Blocker | Dưới 1024 px, panel response/Tunelo đè chồng lên bảng params (ô grid có `min-h-0`) | Request ở trên, response ở dưới trong một cột cuộn; không còn chồng chữ |
| 2 | Major | Request và response chia đôi màn hình, ô URL chỉ còn 232 px ở 1440 px | Xếp dọc như mock; ô URL rộng 741 px |
| 3 | Major | 375 px: bảng params (`min-w-120`) kéo rộng cả request editor, nên URL và Send bị cắt | Grid `grid-cols-1`; bảng cuộn ngang trong khung riêng |
| 4 | Major | Dưới 1024 px, rail thành dải ngang và sidebar đẩy editor xuống | Dưới 768 px rail và sidebar thành drawer trái có backdrop, mở bằng nút ☰ trên tab bar; đóng bằng Esc, backdrop, hoặc khi mở một request |
| 5 | Major | Header bị bó vào container giữa trang, nav nằm bên phải, không có link Mock API | Workbench có header full-width; nav sản phẩm (Mock API, API Client) nằm cạnh wordmark và có trạng thái active |
| 6 | Minor | URL bar xuống dòng theo viewport, nên ở 768–1023 px khi sidebar mở thì ô URL chỉ còn "http:" | Xuống dòng theo bề rộng thật của editor (container query `@2xl`) |
| 7 | Minor | Đầu sidebar có hai nút Import/Export to, ô lọc History bị bóp còn 93 px | Đầu panel gồm tiêu đề, nút icon Import/Export và "Clear all" như mock; sidebar rộng 288 px |
| 8 | Minor | Nút Send có viền | Send dùng kiểu primary như mock |
| 9 | Polish | Status bar chỉ có chữ | Có vạch ngăn và thanh nhỏ báo hạn mức proxy; vạch ngăn ẩn trên màn hẹp |
| 10 | Minor | 768 px: header tràn, tên tài khoản bị cắt | Dưới 1024 px chỉ hiện avatar |

## Cố ý để lại (tính năng chưa có)

Collections, Environments (bộ chọn env trên tab bar), banner giới hạn workspace, rail phải (comment/fork/PR), Trash, breadcrumb, Save và trạng thái Tunelo trên status bar. Các phần này chờ phase 11–16.

## Kiểm tra

`pnpm lint` sạch (biome 1817 file, check:i18n pass), `pnpm typecheck` sạch, `vitest` toàn repo 444 file / 3317 test pass, `pnpm check:mcp-coverage` exit 0, `pnpm check:tokens` ok. Bộ E2E không chạy lại sau khi sửa vì cổng 46xx đang do stack "ui-review" của một phiên khác giữ. Selector E2E duy nhất liên quan là `sidebar-rail-tunelo`, vẫn còn, và viewport E2E 1280 px không vào chế độ drawer.

Thay đổi chưa commit và chưa deploy.
