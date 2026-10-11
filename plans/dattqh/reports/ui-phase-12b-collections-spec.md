# Đặc tả UI phase 12 đợt B: changelog, tag và status, example, trash có lọc, chọn nhiều

Nguồn: `prototype/api-client.html` (rail phải gồm `right-rail-info` và `right-rail-changelog`, panel Changelog, menu status, Tags trong Overview, example editor, `#/trash` có bộ lọc), chụp ngày 11/10/2026. Đợt B nối tiếp đặc tả đợt A (`ui-phase-12a-collections-spec.md`) và giữ nguyên cờ, primitive, token và i18n. Không nêu tên đối thủ.

Chưa làm: Comments, Pull requests và Forks trên rail phải (phase 14); Watching và Fork trên header; environment liên quan (phase 13).

## 1. Rail phải và panel

- Khi đang mở tab collection, folder hoặc request thuộc collection, cạnh phải workbench có một rail hẹp với `right-rail-info` và `right-rail-changelog`. Bấm vào thì mở panel `right-panel-<k>` rộng khoảng 340px, có nút `right-panel-close`. Bấm lại nút đang mở thì panel đóng.
- Dưới 768px, panel là drawer bên phải có backdrop, giống drawer trái của đợt A.
- **Info:** ID (kèm nút copy), người tạo (tên), lần cập nhật cuối và người cập nhật, workspace, số request.

## 2. Changelog (`right-panel-changelog`)

- Dòng giải thích: các thay đổi của cùng một người trong vòng 5 phút được gom thành một session.
- Mỗi session `changelog-session` là một thẻ: avatar, tên, thời gian, "N changes", rồi danh sách `changelog-change` (mô tả ngắn như "Renamed request A to B" hay "Edited pre-request script of folder Users").
- Mỗi change có ba nút:
  - `changelog-view-diff`: mở hoặc đóng phần diff.
  - `changelog-hide-diff` / `changelog-show-diff`: chỉ Editor thấy; diff đã ẩn chỉ hiện "Diff hidden by an editor".
  - `changelog-restore`: chỉ Editor; mở ConfirmModal "Restore the collection to how it was right after this change? This adds a new change; nothing is lost". Gặp 409 `REVISION_UNAVAILABLE` thì báo rõ.
- **Diff viewer:** so từng dòng giữa JSON trước và sau (đã format), dòng `-` nền error-soft, dòng `+` nền success-soft. Diff dài thì cuộn; dòng dài thì xuống dòng hoặc cuộn ngang trong khung.
- Có phân trang "Load older" (`before=`), skeleton lúc tải, trạng thái rỗng và trạng thái lỗi.
- Restore xong thì làm mới chi tiết collection và các tab đang mở.

## 3. Status và Tags

- Header của tab collection có nút `collection-header-status`: chấm hoặc emoji kèm nhãn ("Stable"…), hoặc "Add status" khi chưa có.
- Menu status `status-menu`: 4 preset `status-menu-preset` (Stable 🟢, In development 🛠️, In review 👀, Deprecated ⛔), dấu ✓ ở mục đang chọn, rồi "Custom status…" (modal `modal-custom-status`: ô tên `modal-custom-status-name` dài 2–64 ký tự, bắt đầu bằng chữ cái, và chọn một emoji) và "Remove status". Viewer chỉ xem.
- Overview có khối Tags `collection-tags` hiện "Tags 3/10": các chip `collection-tags-item` (có nút xoá), ô `collection-tags-input` (Enter để thêm) và nút `collection-tags-add`, kèm dòng gợi ý luật tag. Vi phạm luật thì hiện lỗi ngay dưới ô.
- Tag hiện thêm ở tooltip của dòng collection trong sidebar. Tìm kiếm theo tag thì không làm.

## 4. Example

- Example hiện trong cây sidebar, dưới request cha: icon bookmark, kèm "200 · <tên>".
- **Tạo:** panel response có nút `response-save-example` ("Save as example") khi tab gắn với request trong collection và có response; tên mặc định là "<status> <statusText>". Menu "…" của request có thêm "Add example" (tạo example trống).
- **Mở example:** tab `example-editor` gồm ô tên `example-name`, khối request chỉ đọc (method và URL), ô status `example-status`, bảng header, body `example-body` (editor có highlight theo `bodyLanguage`), nút `example-duplicate` và nút `example-save`, cùng ghi chú về example. Autosave hoặc Ctrl/Cmd+S như tab collection. Viewer chỉ đọc.
- Body vượt `EXAMPLE_BODY_MAX` thì bị cắt khi lưu, có cảnh báo.

## 5. Chọn nhiều và xoá hàng loạt

- Trong cây, Ctrl/Cmd-click chọn hoặc bỏ chọn từng dòng, Shift-click chọn một dải liền kề. Dòng được chọn có nền viz-blue-soft và vạch trái.
- Khi có lựa chọn, đầu cây hiện thanh `sidebar-bulk-bar`: "N selected", nút `sidebar-bulk-clear` và nút danger `sidebar-bulk-delete`.
- Xoá hàng loạt:
  - Lựa chọn gồm node của một collection: gọi bulk-delete của collection đó.
  - Lựa chọn gồm nhiều collection: gọi bulk-trash; nếu có collection chứa request thì phải gõ `delete`.
  - Lựa chọn trộn collection và node, hoặc trải trên nhiều collection: tách thành từng lời gọi theo thứ tự, báo kết quả gộp.
- Esc bỏ chọn. Viewer không chọn nhiều được.

## 6. Trash có lọc

- Thêm `trash-filters`: select `trash-filter-workspace` ("All workspaces" và từng workspace) và `trash-filter-deleted-by` ("Everyone" và danh sách người xoá do API trả về). Ô tìm gọi phía server qua `q`.
- Giữ bộ lọc trong URL query để có thể tải lại hoặc chia sẻ link.

## 7. Hoạt động gần đây và tên người tạo

- Cột meta của Overview hiện "Created by <tên>" và "Last updated <thời gian> by <tên>".
- Khối "Recent activity" `collection-activity` liệt kê tối đa 5 thay đổi gần nhất (avatar, câu mô tả, thời gian), kèm link "Open changelog" mở panel changelog.

## 8. Thông báo import mới

`importWarningText` thêm hai trường hợp, cả ba ngôn ngữ:
- `EXAMPLE_BODY_TRUNCATED` (`max` tính theo byte UTF-8, không đưa vào câu): "An example body was cut to fit the size limit."
- `INVALID_METADATA` ({field}, tên trường được dịch theo ngôn ngữ): "The collection's tags weren't valid and were skipped." hoặc "The collection's status wasn't valid and was skipped."
- `TEXT_TRUNCATED` ({max}): "A value was cut to {max} characters."
