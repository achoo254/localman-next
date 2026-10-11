# Đặc tả UI phase 12 đợt A: collections

Nguồn: `prototype/api-client.html` (`#/workspace` gồm sidebar Collections, tab collection, menu "…"; `#/trash`), chụp ngày 11/10/2026. Phạm vi đợt A theo Vòng 32 của plan. Mọi thứ nằm sau cờ `workspaces` và `apiClient` (dùng hook `useWorkspacesEnabled`). Chữ người dùng thấy đi qua `t()` cho en, vi và zh-CN, không nêu tên đối thủ; vì vậy dòng so sánh với gói Free của đối thủ trên trang trash của prototype bị bỏ. Primitive lấy từ `components/ui`, màu và khoảng cách chỉ dùng token.

Đợt B làm sau, gồm: status tag và tag, Watching và Fork, các tab Comments, PR và Forks, changelog, example, chọn nhiều, bộ lọc của trash, "Hoạt động gần đây".

## 1. Rail và sidebar Collections

- Rail thêm mục `sidebar-rail-collections` đứng đầu (icon xếp lớp, nhãn "Collections"), chỉ hiện khi cờ bật. Mục `sidebar-rail-trash` đặt dưới đáy rail, dẫn tới `/trash`.
- Đầu panel giống History: tiêu đề "Collections", nút icon `sidebar-collections-new` (menu: Blank collection, REST CRUD template, From mock project…) và `sidebar-collections-import` (mở modal Import sẵn có; có thêm lựa chọn "Save as collection" vào workspace hiện tại).
- Hàng search `sidebar-collections-search` (lọc theo tên collection, folder và request; tô đậm phần khớp) và nút sort `sidebar-collections-sort` (Name A–Z, Name Z–A, Recently updated; nhớ bằng localStorage). Collection favorite luôn đứng đầu.
- Cây `sidebar-tree` (role tree, điều hướng bằng phím mũi tên):
  - Mỗi dòng `sidebar-tree-collection|folder|request` gồm chevron, icon, nhãn method có màu cho request, tên rút gọn bằng dấu "…", và hai nút chỉ hiện khi hover hoặc focus: sao `sidebar-tree-star` (chỉ ở collection, `aria-pressed`) và `sidebar-tree-more`.
  - Thụt lề 14px mỗi cấp, theo token.
  - Kéo thả bằng `@dnd-kit`: vạch chèn trước hoặc sau dòng, viền khi thả vào folder. Thả trong cùng collection gọi move; không cho thả một folder vào chính cây con của nó. Có cả cách thao tác bằng bàn phím của dnd-kit.
  - Đổi tên tại chỗ bằng `sidebar-tree-rename-input` (Enter lưu, Esc huỷ).
- Menu "…" của collection: Add request, Add folder, Rename, Duplicate, Share (mở `ShareDialog` của phase 11), Copy link (`/elements/collection/:id`), Move (dialog chọn workspace, gọi move của phase 11), Export, Delete. Các mục Fork, Pull, Merge, PR, Watch và Live Mock Sync chưa hiện (đợt B và các phase sau).
- Menu "…" của folder: Add request, Add folder, Rename, Duplicate, Delete. Menu của request: Rename, Duplicate, Delete.
- Viewer (không có quyền `edit`) không thấy mục sửa. Mục Export vẫn còn.
- Workspace chưa có collection thì hiện empty state "No collections yet", kèm nút New collection và Import.

## 2. Tab collection và tab folder

- Bấm vào collection hoặc folder thì mở một tab riêng: icon xếp lớp, tên, và nhãn trong tab bar.
- Header gồm icon, tên (Admin hoặc Editor sửa tại chỗ được), nút Share và nút "…". Không có status, Watch hay Fork.
- Tab con của collection: `collection-tab-overview`, `-authorization`, `-scripts`, `-variables`. Folder có Overview, Authorization và Scripts.
- **Overview** (`collection-overview`), hai cột ở ≥1024px, xếp dọc ở màn nhỏ:
  - Cột trái là mô tả Markdown (`collection-description`). Nút "Edit" mở textarea (`-description-input`) và nút Save (`-description-save`). Markdown được render an toàn, không dùng HTML thô.
  - Cột phải là meta: người tạo, lần cập nhật cuối, workspace, số request.
- **Authorization:** chọn kiểu auth và các ô tương ứng, dùng lại form auth của request builder (phase 10). Collection không có lựa chọn "Inherit". Ghi chú: "Requests set to Inherit auth from parent use this."
- **Scripts:** hai editor Pre-request và Post-response, dùng lại editor script của phase 10, có ghi chú thứ tự chạy: collection, rồi folder, rồi request.
- **Variables** (chỉ collection): bảng key/value/enabled/secret giống bảng params. Giá trị secret bị che.
- Mọi thay đổi tự lưu (debounce) hoặc lưu bằng Ctrl/Cmd+S. Có trạng thái lưu và báo lỗi.

## 3. Request mở từ collection

- Tab mang `source { collectionId, nodeId }`. Phía trên request head có breadcrumb `request-breadcrumb` dạng "Collection / Folder / Request"; bấm vào một mục thì mở tab của nó.
- Ctrl/Cmd+S lưu draft vào node (PATCH draft), rồi bỏ dấu "unsaved". Tab nháp chưa thuộc collection nào thì Ctrl/Cmd+S mở dialog "Save to collection" (chọn collection và folder, đặt tên). Nút Save cũng có trong request head.
- Auth `inherit`: tab Authorization ghi rõ nguồn đang kế thừa (`auth-inherit-source`: "Inherited from folder Users", có link mở nguồn đó).
- Khi gửi, pre-script chạy theo thứ tự collection, folder, request; post-script cũng theo thứ tự đó. Biến của collection được dùng cho `{{var}}`.

## 4. Xoá collection

- `modal-delete-collection`: collection có request thì người dùng phải gõ đúng `delete` vào `modal-delete-collection-input` thì nút đỏ mới bật. Collection rỗng chỉ cần xác nhận một lần.
- Ghi chú "Moved to Trash, kept 30 days" (lấy số ngày từ `limitsFor(plan).trashDays`).

## 5. Trang `/trash`

- Tiêu đề "Trash" và ghi chú giữ lại `trashDays` ngày rồi tự xoá vĩnh viễn. Không so sánh với đối thủ. Có nút "← Workbench".
- Ô tìm theo tên. Bộ lọc workspace và người xoá thuộc đợt B.
- Bảng `trash-table`, mỗi dòng `trash-item` gồm: tên kèm số mục, loại (Collection), workspace gốc (hoặc "Deleted workspace"), người xoá, ngày xoá, số ngày còn lại (màu cảnh báo khi ≤ 7). Có nút `trash-restore` (mở `modal-restore-workspace` để chọn workspace đích) và `trash-delete-permanently` (`ConfirmModal`, nút danger).
- Màn hẹp chuyển bảng thành danh sách thẻ. Không có mục nào thì hiện empty state.
