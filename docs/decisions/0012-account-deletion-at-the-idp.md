# ADR-0012: Xoá tài khoản chỉ ở IdP; Localman dọn theo và chuyển chủ tài sản dùng chung

- **Ngày:** 2026-11-13
- **Trạng thái:** Đã chốt. Thay một phần [ADR-0007](0007-account-deletion.md): bỏ operation `users.deleteAccount`, bỏ quy tắc "chặn", bỏ việc xoá project có thành viên. Bảng xoá/ẩn danh theo model của ADR-0007 vẫn dùng.
- **Người quyết định:** chủ sở hữu (13/11/2026), theo ADR 0018 của `auth-next` (`docs/decisions/0018-account-deletion-fan-out.md`).

## Bối cảnh

Mỗi app từng có luồng xoá riêng; Localman xoá dữ liệu của mình nhưng không đụng IdP, còn xoá ở IdP thì dữ liệu ở Localman nằm lại. Chủ sở hữu chốt: xoá tài khoản chỉ ở `auth.hoandat.com/account`, xoá ngay, app không còn nút, màn hay API xoá; tài sản dùng chung tự chuyển chủ.

## Quyết định

1. **Endpoint nhận:** `POST /internal/account-deleted` (`apps/api/src/modules/account-deletion/account-deleted-route.ts`), server-to-server, nằm sau `location /internal/` của nginx (chỉ IP của server). Body là SET `application/secevent+jwt` ký ES256 bằng khoá IdP (JWKS từ discovery), `typ: secevent+jwt`, `iss` của IdP, `aud` đúng `${PUBLIC_URL}/internal/account-deleted` (một chuỗi, không nhận mảng), `iat` không quá 15 phút, event `urn:hoandat:auth:event:account.deleted`. Không Basic, không secret chung; miễn CSRF; rate limit theo IP như audit.
2. **Trả lời:** chữ ký, `iss`, `aud`, `typ` sai hoặc hết hạn → `401` (IdP thử lại sau khi sửa cấu hình); body không phải SET hoặc event khác → `400`; `sub` không có trong `users` (chưa từng dùng hoặc đã xoá) → `202 {status: "unknown"}`; xoá xong → `202 {status: "deleted"}`. Xoá chạy trong request, trước khi trả lời; lỗi (kể cả `409 ACCOUNT_DELETION_IN_PROGRESS` khi một lượt khác đang chạy) không phải 2xx nên IdP thử lại. Mọi bước idempotent nên lượt giao lại vô hại; không cần lưu `jti`.
3. **Workspace team còn thành viên khác:** người bị xoá rời workspace. Nếu không còn Admin nào khác, thành viên có vai trò cao nhất (admin > editor > viewer), cùng vai trò thì `acceptedAt` sớm nhất, được nâng làm Admin (`account-workspace-heir.ts`, dưới khoá workspace) rồi việc rời workspace chuyển chủ cho Admin cũ nhất như "Leave workspace". Không còn ai thì xoá workspace như trước.
4. **Mock project có thành viên:** chuyển cho thành viên đã accept sớm nhất (`account-projects.ts`, dưới khoá project): `owner` và `quotaSlot` (slot trống thấp nhất của người nhận), `ownerSub`/`quotaSlot` của mọi resource, `owner` của job gửi đi trong hàng đợi; dòng collaborator của người nhận bị xoá. Chuyển cả khi người nhận đã chạm hạn mức (như hand-over workspace): họ chỉ bị chặn tạo thêm. Project không có thành viên, và tombstone còn sót, bị xoá như trước. Đụng unique index slot thì đọc lại và thử lại (`MAX_QUOTA_ATTEMPTS`).
5. **Gỡ luồng xoá ở app:** bỏ `users.deleteAccount` (`DELETE /api/v1/users/me`) và UI (`features/account-deletion/`). `/account` chỉ còn một dòng dẫn tới `{idpOrigin}/account#account-delete` (`idpAccountDeleteUrlOf`); link "Delete account" ở footer trỏ thẳng tới đó. Trang công khai `/account/delete` giữ địa chỉ (store, văn bản pháp lý), nội dung nói cách xoá ở IdP và điều gì xảy ra với dữ liệu Localman.
6. **Log:** không ghi SET hay `sub`; chỉ `_id` của user và số lượng (thay cho việc ghi `sub` ở ADR-0007).
7. **Đăng nhập lại:** giữ `deleted_accounts` (SHA-256 của `sub`): callback từ chối `sub` đã xoá về `/?authError=account_deleted`. IdP không cấp lại `sub` cũ (ADR 0009 của IdP), nên lối "Create a new account" (`recreate=1`) chỉ còn ý nghĩa cho tài khoản đã xoá theo luồng cũ.

## Đánh đổi

- Thành viên được chuyển project/workspace không được hỏi trước và không nhận thông báo; họ thấy project chuyển sang "owner" trong danh sách.
- Xoá chạy đồng bộ trong request: tài khoản rất lớn có thể chậm; nếu IdP hết thời gian chờ thì giao lại, lượt sau tiếp tục từ chỗ dừng.

## Cách vận hành

IdP khai `ACCOUNT_DELETED_URLS` có `https://localman.hoandat.com/internal/account-deleted`. Thử từ ngoài server: `curl -X POST .../internal/account-deleted` nhận 403 (nginx).
