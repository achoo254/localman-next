# ADR-0004: Chia sẻ collection ra ngoài workspace, che dữ liệu ở server

- **Ngày:** 2026-10-14
- **Trạng thái:** Đã chốt; code xong sau cổng `PUBLIC_SHARING_ENABLED` (tắt), chờ SAST, deploy và DAST
- **Người quyết định:** dattqh (phạm vi đợt 1, gói Free, guest chỉ xem bản đã che, bỏ body response của example, chỉ thành viên Admin/Editor công khai, ba công tắc của Admin). Plan: `plans/dattqh/261014-0825-public-sharing-links-keys-run/`.

## Bối cảnh

Người dùng cần đưa một collection cho người ngoài workspace: trang chỉ đọc không cần đăng nhập, người đã đăng nhập xem rồi xin quyền, script/CI đọc JSON, và nút "Run in Localman" trong README để import. View nội bộ của collection (`collection-view.ts`) trả giá trị biến `secret` và credential của tab Auth cho mọi người xem, vì `secret` chỉ là cờ che trên UI. Example lưu cả request gốc, header (`Set-Cookie`) và body response, thường chứa token thật. Working tree được nhiều session dùng chung và `deploy.sh` build nguyên working tree.

## Quyết định

1. **Một serializer ở server cho mọi đường ra ngoài:** `publicCollectionTree` và `publicEnvironment` (`packages/shared/src/api-client/redaction/`). Trang public, trang guest, JSON của access key và cây mà nút Run import đều đi qua nó, không bao giờ qua view nội bộ. Che: giá trị biến `secret`; credential gõ thẳng trong Auth của collection, folder, request và request của example; giá trị gõ thẳng của header, query, field form (urlencoded, form-data dạng text) và cặp trong fragment URL có tên nhạy cảm; `user:password@` của URL (mọi dạng: có scheme, `//`, `{{scheme}}://`, không scheme) và URL trong header `Location`/`Content-Location` của example; **toàn bộ body response của example**; environment chỉ giữ shared value của biến không `secret`. Giá trị chỉ gồm `{{var}}` (và từ `Bearer`/`Basic`) giữ nguyên văn; chữ gõ thêm cạnh một `{{var}}` thì bị che cả giá trị.
2. **Body thô, path, script không bị che mà chỉ cảnh báo** (field form có tên thì che như header, vì nó là cặp tên/giá trị chứ không phải nội dung tự do; quyết định sau SAST 2026-10-14) (`findSecretLikeValues`, liệt kê vị trí, không giá trị) trước khi bật hay tạo. Che theo nội dung vừa bỏ sót vừa làm hỏng dữ liệu hợp lệ.
3. **Đơn vị công khai là collection** (link, key, nút riêng, thu hồi được), không dùng workspace `public`.
4. **Guest không nhận vai trò.** Mở guest link chỉ thấy bản đã che kèm nút xin quyền qua access request có sẵn; quyền thật chỉ có khi Editor duyệt.
5. **Chỉ thành viên workspace có vai trò Admin/Editor công khai được** (`WORKSPACE_PERMISSIONS.publishPublic`). Người được share lẻ thì không.
6. **Kiểm lúc phục vụ, không lưu workspace:** mỗi lần dùng kiểm collection còn sống, người tạo còn là Admin/Editor của workspace **hiện tại**, công tắc `publicLinksAllowed`/`guestsAllowed`/`accessKeysAllowed` của workspace đó còn bật. Mọi lý do hỏng trả cùng một lỗi.
7. **Thu hồi là xoá document.** MongoDB không tạo được unique index "khi chưa thu hồi", nên không giữ bản ghi đã thu hồi.
8. **Free dùng được cả bốn đường**; fork và pull request (đợt sau) vẫn theo `forkPrPublic`.
9. **Cổng server `PUBLIC_SHARING_ENABLED`** (mặc định tắt) loại các operation khỏi router và Localman MCP, ngoài cờ web `publicSharing`.

## Lý do (tại sao)

- Một chỗ che thì một chỗ kiểm và test; thêm đường ra mới không thể quên che.
- "Viewer" nội bộ nghĩa là "thấy secret", nên dùng lại vai trò đó cho người ngoài là lộ dữ liệu.
- Kiểm lúc phục vụ làm cho tắt công tắc, hạ vai trò người tạo hay chuyển collection có hiệu lực ngay mà không cần job dọn.
- Cờ web chỉ tắt UI; không có cổng server thì lần deploy kế tiếp của bất kỳ session nào sẽ mở endpoint và MCP tool chưa qua SAST/DAST.

## Đánh đổi & hệ quả

- Biến thường, body, script và path do người dùng viết có thể chứa secret và **được công khai**; UI cảnh báo, không chặn.
- Example công khai mất body response.
- Mỗi lượt đọc công khai tốn thêm vài truy vấn (workspace, vai trò, công tắc). Giới hạn theo IP chạy trước mọi tra cứu để dò id không tốn DB.
- Access key nằm trong query string (giống Postman) nên dễ lọt vào log phía người gọi và log của Cloudflare (proxy trước domain chính); phía Localman che ở access log nginx, tắt error log thường cho `/api/v1/public/` và log của API chỉ ghi route mẫu.
- `linkId` và `buttonId` lưu dạng rõ (UI phải hiện lại URL): ai đọc được database hay bản backup thì mở được link đang bật. Access key thì chỉ lưu hash.
- Script import qua nút Run chạy trong trình duyệt người import với environment của họ: nút public mặc định không nhập script.
