# IdP: chỉ đăng nhập bằng Google/GitHub (bỏ hẳn mật khẩu)

Repo: `/Users/hoandat/inet-gitlab/hoandat-auth` (chưa commit, chưa deploy). Tier L.
Trạng thái: DONE_WITH_CONCERNS. Mọi cổng đều sạch; phần lo ngại nằm ở dữ liệu tài khoản cũ (mục cuối).

## Kết quả

- Trang đăng nhập `/interaction/:uid` chỉ còn "Đăng nhập với Google", "Đăng nhập với GitHub", một dòng "Lần đầu đăng nhập… sẽ tạo tài khoản mới" và nút huỷ. Không còn form mật khẩu, "Quên mật khẩu?" hay dòng phân cách. Nếu không cấu hình provider nào, trang trả 503 kèm thông báo (`NO_PROVIDER_MESSAGE`, `data-id="upstream-unavailable"`) thay vì một trang trống.
- `prompt=create` vẫn mở trang đăng ký, chỉ có "Đăng ký với Google/GitHub" và link "Đã có tài khoản? Đăng nhập". Luồng tạo tài khoản cho danh tính Google/GitHub chưa ai dùng **đã có sẵn** và tôi đã đọc lại: `decideUpstreamLogin` trả `signup`, người dùng chọn username, rồi `accounts.create` chạy trong `upstream-finish-routes.ts`, sau đó `finishLogin`. Không phải viết luồng mới. Test đã phủ cả hai đường: `prompt-create.test.ts` và `interactions.test.ts` (client MCP).
- Các route sau đã bị **xoá**, không chỉ ẩn, nên trả 404 qua routing bình thường (test `upstream-only-sign-in.test.ts`):
  - `POST /interaction/:uid/login`, `/signup`, `/signup/done`, `/forgot/recovery`, `/forgot/telegram`, `/review/done`
  - `GET /interaction/:uid/signup`, `/forgot`, `/reset/*`, `/reset/review`
  - `POST /account/password`, `/account/recovery-codes`, `/account/recovery-codes/saved`

  `GET /interaction/:uid/login` vẫn giữ để link "Đã có tài khoản? Đăng nhập" hoạt động.
- Trang `/account` bỏ mục mật khẩu và mã khôi phục. Mục "Cách đăng nhập" (Google/GitHub) luôn hiện. Telegram, phiên đang mở, thiết bị Tunelo và ứng dụng đã cấp quyền giữ nguyên. Telegram giờ chỉ dùng để nhận thông báo.
- Chặn huỷ liên kết provider cuối cùng: trước đây `unlinkProvider` coi `passwordHash` cũng là một cách đăng nhập, nên tài khoản có mật khẩu huỷ được provider cuối. Đã sửa ở hai lớp:
  - Lệnh ghi Mongo giờ đòi provider kia vẫn còn liên kết.
  - Route và trang còn đòi provider kia phải đang được bật ở IdP (`usableSignInProviders`). Nhờ vậy không huỷ được Google khi GitHub đã liên kết nhưng GitHub đang tắt ở IdP.
- Liên kết Telegram (link-routes, webhook-routes, link-confirmation) vẫn chạy (unit test và e2e). Chỉ phần đặt lại mật khẩu qua Telegram bị bỏ; nội dung tin nhắn đã đổi thành "thông báo bảo mật".
- Không ghi DB, không có migration. Các trường `passwordHash`, `recoveryCodeHashes`, `recoveryCodesCreatedAt`, `credentialsChangedAt`, `securityReviewPendingSince` đã gỡ khỏi kiểu `AccountDocument`, nên TypeScript chặn mọi chỗ đọc chúng. Cờ rà soát cũ không còn chặn đăng nhập, `/account` hay token exchange (có test cho cả hai). `completeLogin` đã gộp vào `finishLogin`.

## Neo của trang tài khoản

- Hiện có: `#account-email`, **`#account-sign-in`** (thay cho `#account-password`), `#account-apps`.
- Đã bỏ: `#account-password`, `#account-recovery`.
- Việc của Localman: trong `apps/web/src/components/layout/idp-account-items.tsx`, mục "password" đang trỏ `#account-password` (cần đổi sang `#account-sign-in`, và nhãn nên thành kiểu "Cách đăng nhập"), còn mục "recovery" đang trỏ `#account-recovery` (cần bỏ hẳn). Test `app-header.test.tsx` cũng tham chiếu hai neo này. Tôi không sửa gì trong localman-next.

## Loại sự kiện audit đã bỏ

- Loại sự kiện: `login.failed`, `login.locked`, `password.changed`, `password.reset`, `recovery_codes.regenerated`.
- Giá trị `cause`: `password-change`, `password-reset`, `security-review`.
- Handler của Localman (`audit-event-handlers.ts`, chỉ đọc) chỉ xử lý `email.reclaimed`, `method.linked` và `method.unlinked` (Telegram). Các loại khác nó chỉ lưu lại, nên **không có loại nào Localman đang dùng bị xoá**. Hợp đồng SET và `/internal/audit-events` không đổi. Sự kiện cũ còn nằm trong outbox vẫn được gửi nguyên trạng, vì dispatcher không kiểm tra loại sự kiện.

## File

- **Xoá 19 file nguồn:**
  - `accounts/`: password-hasher, recovery-codes, login-throttle, throttle-policy
  - `http/device-cookie`, `telegram/reset-link-service`, `audit/record-login`, `account-portal/after-password-change`
  - `interactions/`: forgot-password-page, forgot-routes, reset-password-page, reset-review-routes, security-review-{actions,context,page,routes}, signup-{page,routes,rules}
- **Xoá test:** 7 file unit test (brute-force, device-cookie, login-security, r6-stale-reset, review-gate, security-review, throttle), cùng `e2e/forgot-password.spec.ts` và `e2e/support/reset-flows.ts`.
- **Dependency:** gỡ `@node-rs/argon2` khỏi `package.json` và `pnpm-lock.yaml`.
- **Mã nguồn sửa chính:**
  - `interactions/`: login-page, login-handler, interaction-router, interaction-helpers, upstream-{routes,start,pending,finish-routes,pages,account-link}
  - `account-portal/`: account-page, account-routes, account-access-routes, notices, portal-session, revoke-access
  - `accounts/`: user-model, account-repository, account-links, account-tokens, one-time-tokens
  - `audit/audit-events`, `oidc/{claims,interaction-policy,provider,token-exchange}`, `services`, `app`
  - `http/{client-ip,csrf,error-handler}`, `telegram/{link-confirmation,notify}`, `legal/privacy-page`, `static/css/app.css` (bỏ các class không còn dùng)
- **Test mới:** `sign-in-pages.test.ts`, `upstream-only-sign-in.test.ts`, `e2e/account-sign-in.spec.ts`. `revocation.test.ts` viết lại (thu hồi phiên và ứng dụng ở `/account`). Các test khác chuyển sang đăng nhập bằng Google giả: helper `signedInBrowser`, `sharedFakeUpstreams`, và `startTestIdp` luôn bật Google/GitHub giả, trừ khi truyền `withoutUpstreams`.
- **Tài liệu:**
  - ADR mới: `docs/decisions/0004-upstream-only-sign-in.md`.
  - Thêm ghi chú bị thay thế vào ADR 0001, 0002 và 0003.
  - Cập nhật `README.md`, `docs/integration-guide.md` (neo, bảng audit, `prompt=create`), `docs/deployment-guide.md` và `CLAUDE.md` của repo IdP (quy tắc không còn nhắc `checkPassword`, `LoginThrottle` hay `completeLogin`).
- Tổng: 101 file thay đổi, +804/−5411 dòng, cộng 4 file mới. `src/server.ts` không bị đụng; diff +10 dòng hiện có là thay đổi của anh.

## Cổng kiểm tra (chạy tuần tự, đã kiểm tra tải máy trước mỗi lần chạy nặng)

- `pnpm lint` (Biome): 162 file, 0 lỗi, 0 cảnh báo.
- `pnpm typecheck` (`tsc --noEmit`): 0 lỗi.
- `pnpm test` (vitest, 2 worker): 45/45 file, **250 passed, 0 failed**, log không có cảnh báo.
- `pnpm test:e2e` (Playwright, 1 worker): **6 passed, 0 failed**. Dòng log `"e2e IdP ready"` ở mức warn là do code cố ý ghi.
- `pnpm check:tokens`: không có literal màu trong 147 file.
- Server e2e đã tự tắt; cổng 4590/4591 không còn tiến trình nào lắng nghe.

## Câu hỏi mở và lo ngại

1. **Tài khoản cũ chỉ có mật khẩu (không liên kết Google/GitHub) sẽ không đăng nhập được nữa.** Nếu người đó đăng nhập bằng Google/GitHub có email trùng với email chưa xác minh của tài khoản cũ, luật lấy lại email (ADR 0002 mục 9) sẽ tạo **tài khoản mới với `sub` mới**: tài khoản cũ mất email, và dữ liệu Localman gắn với `sub` cũ không đi theo. Tôi giữ nguyên luật này, vì tự liên kết vào một email chưa xác minh sẽ mở lại lỗ hổng chiếm tài khoản trước. Trước khi deploy nên đếm số tài khoản như vậy (chỉ đọc), ví dụ `db.accounts.countDocuments({"providers.google":{$exists:false},"providers.github":{$exists:false}})`, rồi quyết định có cần hỗ trợ thủ công không. Tôi không chạy lệnh này vì không được truy cập production.
2. Env vẫn cho phép khởi động khi không có Google lẫn GitHub; lúc đó trang đăng nhập trả 503. Có nên bắt buộc ít nhất một provider khi `NODE_ENV=production` không? Việc này ngoài phạm vi nên tôi chưa làm.
3. Error handler và nginx vẫn che path `/reset/...`, vì link reset cũ có thể còn trong chat Telegram. Có thể gỡ sau một thời gian.
