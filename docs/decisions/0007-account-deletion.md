# ADR-0007: Xoá tài khoản Localman: xoá dữ liệu riêng, ẩn danh nội dung team, chặn khi workspace mất Admin

- **Ngày:** 2026-10-20
- **Trạng thái:** Đã chốt; Jev duyệt ngày 20/10/2026 (owner uỷ quyền). Văn bản pháp lý: `docs/legal-pages-review.md`
- **Người quyết định:** dattqh (yêu cầu: xoá tài khoản đạt chuẩn App Store 5.1.1(v) và chính sách xoá tài khoản của Google Play trước khi Localman mobile ra mắt). Quy tắc workspace theo mặc định Jev đề xuất; owner có thể đổi.

## Bối cảnh

App Store và Google Play đòi người dùng tự xoá được tài khoản và dữ liệu ngay trong app, và Play cần một URL công khai giải thích cách xoá. Localman không giữ mật khẩu: tài khoản đăng nhập nằm ở IdP dùng chung `auth.hoandat.com` (repo `auth-next`, có trang `/account/delete` riêng). Dữ liệu của một user nằm rải trong khoảng 50 model Mongo; nhiều thứ là nội dung chung của team (collection, comment, changelog) mà người khác vẫn cần.

## Quyết định

1. **Một operation:** `users.deleteAccount` (`DELETE /api/v1/users/me`, code ở `apps/api/src/modules/account-deletion/`). `?dryRun=true` trả số lượng và danh sách workspace chặn; xoá thật cần `confirm` bằng đúng username (trim), phiên trình duyệt (`requireSession`), CSRF như mọi route ghi, và tối đa 5 lượt mỗi giờ mỗi tài khoản (`rate_limit_windows`, tính cả lượt bị chặn). Miễn MCP: agent không bao giờ xoá tài khoản thay người.
2. **Chỉ xoá dữ liệu Localman, không đụng IdP.** Trang xoá và modal link tới `{idpOrigin}/account/delete` để người dùng tự xoá tài khoản IdP nếu muốn.
3. **Workspace (mặc định Jev):** user là Admin duy nhất của workspace team còn thành viên đã accept khác thì **chặn** (409 `ACCOUNT_DELETION_BLOCKED`, `details.blockedWorkspaces`), yêu cầu cho người khác làm Admin hoặc gỡ thành viên. Đây cũng chính là luật `LAST_ADMIN` khi rời workspace. Workspace team còn Admin khác: user rời như "Leave workspace", quyền chủ chuyển cho Admin cũ nhất (`handOverOwnership`). Workspace cá nhân và workspace team không còn thành viên nào khác: xoá hẳn, collection bị purge ngay (không qua thùng rác) cùng environment, globals, thành viên và lời mời.
4. **Mock project user sở hữu bị xoá hết** qua `deleteProjectCascade`, kể cả project có collaborator (project không có cơ chế chuyển chủ; Jev duyệt, độ tin 0.97). Dry run trả `sharedProjects` (project có thành viên khác) và `projectMembers` (số người mất quyền vào chúng), modal nêu rõ cả hai. Thành viên trong project của người khác thì rời (xoá dòng `collaborators`, `member_removals`).
5. **Xoá vs ẩn danh theo model:** bảng `ACCOUNT_DATA_POLICY` (`account-data-policy.ts`) là nguồn duy nhất; test `account-data-policy.test.ts` fail khi có model đăng ký mà chưa phân loại. Tóm tắt:
   - **Xoá:** `users`, `sessions`, `push_subscriptions`, `audit_events`, `notifications`, `notification_preferences`, `client_history`, `client_drafts`, `client_settings`, `usage_counters`, `trial_extension_requests`, `feedback` (cả pro-interest và contact có `userSub`), `tunelo_links` (thu hồi ở Tunelo trước, best effort), `local_variable_values`, `active_environments`, `collection_favorites`, `collection_watches`, `element_roles` của user, `access_requests` user gửi, lời mời đang chờ gửi tới user, `collection_links`/`run_buttons`/`collection_access_keys` user tạo (đằng nào cũng ngừng chạy khi người tạo hết vai trò), `run_button_imports`, khoá `owner:<sub>` trong `workspace_locks`.
   - **Ẩn danh** (nội dung team ở lại, `sub` thay bằng `DELETED_USER = "deleted-user"` hoặc bị rút khỏi danh sách; `updatedAt` giữ nguyên): `createdBy`/`updatedBy`/`deletedBy`/`trashEditors` của collection, `updatedBy` của node, `authorId` của revision, `authorId`/`resolvedBy`/`mentions` của comment, `createdBy`/`updatedBy` của environment và globals, `createdBy` của fork, `authorId`/`mergedBy`/`reviewers.userId`/`notified` của pull request, `invitedBy` của thành viên workspace, `grantedBy` của share, `resolvedBy` của access request, `invitedBy`/`createdBy`/`removedBy` của project member/magic link, `decidedBy` của yêu cầu gia hạn.
   - **Đi theo cascade:** mọi thứ của project (resource, record, log request, inbox, callback, outbound job, MCP token, khoá cây) và của workspace bị xoá (node, revision, fork base, comment, watch, share).
   - **Không phải dữ liệu cá nhân:** `login_transactions`, `logout_token_jtis`, `rate_limit_windows` (khoá đã băm, tự hết hạn).
6. **Thứ tự:** kiểm chặn → xoá mọi phiên (cookie hết tác dụng) → quên `sub` ở cache MCP → xoá project → kiểm chặn lại rồi áp workspace → purge collection trong thùng rác mà chỉ user còn quyền khôi phục (workspace gốc đã mất, không ai khác trong `trashEditors`) → xoá dòng riêng → ẩn danh → thu hồi Tunelo → xoá khoá owner → xoá `users` **cuối cùng**. Mọi bước idempotent; bước lỗi để lại dòng `users`, nên đăng nhập lại và xoá lần nữa sẽ làm nốt.
7. **Web:** mục "Delete account" cuối trang `/account`, modal chạy dry run khi mở, liệt kê workspace chặn, đòi gõ username. Xoá xong web gỡ Web Push, trang đã lưu và **cookie gợi ý SSO** (`lm_sso_hint`, đọc được từ JS) rồi tải `/account/delete?deleted=1`; nếu không, silent sign-in sẽ đăng nhập lại ngay bằng phiên IdP còn sống và tạo tài khoản mới rỗng.
8. **URL công khai cho store:** `/account/delete` (trang hướng dẫn, không cần đăng nhập), cùng `/privacy` và `/terms`.

## Lý do (tại sao)

- Chặn khi user là Admin cuối cùng giữ đúng bất biến "workspace team luôn có Admin" mà code đã áp cho việc rời workspace; tự xoá workspace của người khác hay tự chọn người kế nhiệm là quyết định của team, không phải của người đang rời đi.
- Nội dung team (collection, comment, changelog) là của team: xoá theo người viết sẽ phá lịch sử và dữ liệu của người khác. Thay `sub` bằng một giá trị không phải subject của IdP làm tên biến mất (`displayNames` trả rỗng) và để cùng tài khoản IdP đăng nhập lại về sau không lấy lại quyền tác giả.
- Bảng phân loại có test bảo vệ để model mới không lặng lẽ bị bỏ sót.
- Xoá `users` cuối cùng để lượt xoá đứt giữa chừng vẫn chạy lại được.

## Đánh đổi & hệ quả

- Project có collaborator bị xoá luôn với họ (không có chuyển chủ project). Modal cảnh báo số project đang chia sẻ.
- Request đang chạy dở của chính user (tab khác) lúc xoá có thể ghi thêm vài dòng sau bước xoá phiên; request mới thì 401. Không có khoá toàn cục theo user.
- JWT của Localman MCP không thu hồi được: agent còn token (tối đa 15 phút) hoặc còn grant ở IdP sẽ tạo lại một tài khoản rỗng (`ensureUserForSubject`). Đây là "đăng nhập lại", không khôi phục dữ liệu; thu hồi grant ở trang ứng dụng của IdP.
- Đăng nhập lại sau khi xoá tạo tài khoản mới, được tự cấp lại hạn mức mở rộng (trial) và bộ đếm tháng về 0.
- Dữ liệu đã xoá còn trong bản backup hằng đêm tới 14 ngày (`docs/deployment-guide.md`, mục Backup).
- Thông báo người khác đã nhận giữ chữ lúc gửi (có thể có tên user) tới khi hết hạn 90 ngày; tin góp ý gửi khi chưa đăng nhập không gắn được với tài khoản.
- Dữ liệu ở **Tunelo server** (usage log theo `sub`, `web_sessions`) là DB khác, Localman không xoá được; chỉ link token mà Localman giữ được thu hồi.
- Log pino ghi `sub` và số lượng mỗi lượt xoá ("Account deleted") để vận hành đối soát; xoay theo `pm2-logrotate`.

## Quyết định của Jev (20/10/2026) và việc sau

- Giữ quy tắc "chặn" khi user là Admin duy nhất của workspace team còn thành viên; project có collaborator vẫn bị xoá (0.97), modal nêu số project chia sẻ và số người mất quyền.
- **Việc sau (chưa làm, 0.60):** tự xoá dữ liệu Localman khi IdP phát sự kiện `account.deleted` qua `/internal/audit-events` (hiện chỉ được ghi lại). Cần quyết định cách xử lý workspace bị chặn khi người dùng đã xoá tài khoản ở IdP.
- Người không đăng nhập được gửi yêu cầu xoá qua email liên hệ (username + email tài khoản IdP), không cam kết thời hạn; chưa có công cụ admin, người vận hành xoá thủ công.

## Cách thay đổi

- Model mới: thêm một dòng vào `ACCOUNT_DATA_POLICY`; nếu là `deleted`/`anonymized` thì thêm bước ở `account-own-rows.ts` hoặc `account-references.ts` và một dòng vào fixture `testing/own-rows-*.ts` hoặc test ẩn danh.
- Đổi quy tắc workspace: `planWorkspaces` ở `account-workspaces.ts` (và chữ `account.delete.blocked`, `legal.accountDelete.blocked`).
