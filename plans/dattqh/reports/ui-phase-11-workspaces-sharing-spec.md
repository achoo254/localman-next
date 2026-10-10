# Đặc tả UI phase 11: workspace, chia sẻ, request access

Nguồn: `prototype/api-client.html` (`#/workspace`, `#/workspace/settings`, `#/request-access`, dialog Share, panel thông báo), chụp ngày 10/10/2026. Mọi thứ dưới đây nằm sau cờ `workspaces` (Vòng 30). Chữ người dùng thấy đi qua `t()` cho en, vi và zh-CN. Primitive lấy từ `apps/web/src/components/ui/`.

## 1. Workspace switcher trong header

- Chỉ hiện khi cờ `workspaces` bật và đang ở `/api-client` hoặc `/workspace/*`. Trang mock (`/projects`) không hiện khái niệm workspace.
- Nằm sau nav sản phẩm (Mock API, API Client). Nút gồm icon người hoặc nhóm, tên workspace hiện tại và chevron. `data-id="app-header-workspace"`, `aria-haspopup="menu"`.
- Menu có nhãn nhóm "Workspace". Mỗi workspace một dòng `ws-menu-<id>`, gồm icon (personal hoặc team), tên, dấu ✓ ở workspace hiện tại, và nhãn phụ "Personal" hoặc "Team". Sau đó là vạch ngăn, `ws-menu-create` ("Create workspace", mở dialog nhập tên và mô tả) và `ws-menu-settings` (tới `/workspace/settings`).
- Workspace hiện tại lưu trong `localStorage` (bọc try/catch). Mặc định là workspace cá nhân. Nếu workspace đã lưu không còn trong danh sách thì quay về workspace cá nhân.
- Tạo quá hạn mức gói (Free 1 workspace team) thì hiện thông báo giới hạn gói, dẫn tới `/pricing`, giống các dialog giới hạn đã có.

## 2. `/workspace/settings`

- Tiêu đề "Workspace settings", dưới là tên workspace kèm icon. Bên phải có nút "← Workbench" về `/api-client`.
- Nav dọc bên trái gồm `ws-settings-tab-general` và `ws-settings-tab-members`. Dưới 768px nav chuyển thành hàng ngang.
- **General** (`ws-settings-general`): `ws-settings-name` và mô tả, chỉ Admin sửa được. `ws-settings-delete` chỉ có ở workspace team và chỉ Admin thấy, đi qua `ConfirmModal`. Các công tắc guest và access key thuộc phase 15, không làm.
- **Members** của workspace cá nhân: `ws-settings-members` hiện alert "A personal workspace has no members. Create a team workspace to collaborate." kèm nút `ws-settings-create-team`.
- **Members** của workspace team:
  - Dòng `ws-settings-member-count`: "3/3 members (pending invitations included) · Free plan".
  - Khi đầy chỗ, card "Requires Pro" có nút "View plans" tới `/pricing`, và nút mời bị khoá.
  - Ô "Username or email": `ws-settings-invite-email`. Chọn vai trò `ws-settings-invite-role` (Viewer, Editor mặc định, Admin). Nút `ws-settings-invite`.
  - Nút phụ `ws-settings-invite-link`: "Copy invite link (one use, 7 days)", kèm chú thích cho người chưa có tài khoản. Link chỉ hiện một lần nên copy ngay.
  - Danh sách thành viên `ws-settings-member`: avatar, tên ("(you)" với chính mình), email hoặc username, chọn vai trò `ws-settings-member-role` (khoá với chính mình và với người không phải Admin), nút xoá `ws-settings-member-remove` (xác nhận).
  - Lời mời đang chờ `ws-settings-invite-item`: username, email hoặc "Invite link", vai trò, hạn, nút thu hồi.
  - `<details>` "Permissions by role": bảng đọc từ `WORKSPACE_PERMISSIONS`.
  - `ws-settings-leave` "Leave workspace" (xác nhận). Admin cuối cùng thì báo lỗi `LAST_ADMIN`.
- Lỗi API hiện theo `{ error: { code, message } }` bằng toast hoặc alert như các form hiện có.

## 3. Chấp nhận lời mời workspace: `/workspace-invite/:token`

Làm theo trang `/invite/:token` của project: preview (tên workspace, vai trò, người mời, hạn), các trạng thái không hợp lệ (NOT_INVITEE, EMAIL_NOT_VERIFIED, MEMBER_LIMIT, hết hạn, đã dùng) và nút Accept. Accept xong thì đặt workspace đó làm hiện tại rồi về `/api-client`.

## 4. Dialog Share (component, phase 12 gắn vào collection)

- `ShareDialog({ elementType, elementId, elementName, open, onOpenChange })`, tiêu đề `Share "<name>"`.
- Tab "People" và tab "Link". Tab Run và API thuộc phase 15, không làm. Environment chỉ có tab People.
- **People**:
  - Ô `share-people-email`, chọn vai trò `share-people-role` (Viewer mặc định, Editor), nút `share-people-invite`, phản hồi tra cứu `share-people-match`.
  - "Include environment" (`share-people-include-env`), chỉ có với collection: select "No environment" hoặc danh sách environment. Phase 13 cung cấp danh sách; trước đó component nhận prop `environments` rỗng và ẩn ô này.
  - Phần tử trong workspace cá nhân: alert `PERSONAL_WORKSPACE` "Move it to a team workspace to share it", ô nhập bị khoá.
- **Manage access** (`share-access-*`):
  - Dòng đầu "Everyone in <workspace>", ghi "By workspace role", nhãn WORKSPACE.
  - Sau đó mỗi người được chia sẻ một dòng `share-access-item`: avatar, tên, email, chọn vai trò, nút xoá.
  - Lời mời theo email chưa có tài khoản ghi "Invited by email, no account yet".
  - Không có quyền `manageRoles` thì danh sách chỉ đọc.
- **Link**: `share-link-input` chỉ đọc, chứa `<origin>/elements/<type>/<id>` (cùng đường dẫn API dùng trong link thông báo), kèm nút `share-copy-link`. Ghi chú: "Only people with access can open the link; others see Request access."

## 5. Mở link phần tử: `/elements/:type/:id`

- Gọi `GET /elements/:type/:id`. Thành công thì hiện tên phần tử và vai trò. Phase 12 sẽ chuyển việc này sang mở collection trong workbench.
- 404 thì hiện trang Request access.

## 6. Trang Request access (`request-access-page`)

- Card giữa trang, tiêu đề "You don't have access" có icon khoá.
- **Khác prototype:** không hiện tên phần tử, workspace hay người duyệt. API trả 404 cho người không có quyền để không lộ sự tồn tại của phần tử (yêu cầu của phase 11).
- Hai radio card: `request-access-viewer` ("View, send requests, fork, export") và `request-access-editor` ("Edit the collection, shared values, merge"). `?role=editor` chọn sẵn Editor.
- Ô lời nhắn `request-access-message` (tối đa 500 ký tự) và nút primary full-width `request-access-submit`.
- Sau khi gửi (API luôn trả 202): "Request sent. If you can be given access, its editors will be notified." kèm nút `request-access-back`.
- `ALREADY_HAS_ACCESS` (409) thì báo rằng người dùng đã có quyền.

## 7. Panel thông báo

- Thông báo loại `access.requested` có `accessRequest: { id, status }`. Khi `status: "pending"` thì hiện hai nút `notifications-approve` (primary, sm) và `notifications-deny` (secondary, sm). Khi đã xử lý thì thay hai nút bằng nhãn "Approved" hoặc "Declined".
- Nút Approve gửi `{ role }` lấy từ `accessRequest.role` mà người duyệt đang thấy. Nếu API trả 409 `REQUEST_CHANGED` thì báo "The request changed" và tải lại để hiện vai trò mới.
- Lỗi 403 hoặc 409 (`ALREADY_RESOLVED`, `WORKSPACE_MISSING`) thì hiện toast và làm mới danh sách.
- Link của thông báo `access.requested` là `/access-requests/:id`: trang chi tiết (`GET /access-requests/:id`) gồm người xin, phần tử, vai trò, lời nhắn, trạng thái, kèm hai nút Approve và Deny khi còn chờ. Người không phải Editor của phần tử nhận 404.
- Các loại `workspace.invitation`, `element.shared` và `access.resolved` hiển thị như thông báo thường, theo `title`, `body` và `link`.
- Trang cài đặt thông báo ẩn 4 loại sự kiện mới khi cờ `workspaces` tắt.
