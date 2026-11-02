# ADR-0011: Một mức cho mọi tài khoản, bỏ gói Free/Pro

- **Ngày:** 2026-11-02
- **Trạng thái:** Đã chốt; thay [ADR-0002](0002-no-commercial-ui-automatic-pro-period.md)
- **Người quyết định:** dattqh (cả hệ sinh thái hoandat bỏ khái niệm gói: mọi người dùng chung tài nguyên như nhau)

## Bối cảnh

ADR-0002 đã giấu gói và giá khỏi web nhưng backend vẫn giữ hai mức `free`/`pro`, dùng thử Pro 30 ngày tự động, nhắc hạn, xin gia hạn, form "quan tâm Pro", trang admin cho dùng thử và form đó, lệnh `set-user-plan`, và cổng `forkPrPublic` chặn fork/pull request với Free. Chủ sản phẩm quyết định không thương mại hoá theo gói: mọi tài khoản dùng cùng một mức.

## Quyết định

1. **Một bộ hạn mức:** `LIMITS` trong [`packages/shared/src/account-limits.ts`](../../packages/shared/src/account-limits.ts) lấy đúng mức Pro cũ: 20 project, 50 resource (tổng trên mọi project sở hữu), workspace team không giới hạn, 10 thành viên mỗi workspace/project, không trần request mock/proxy theo tháng (rate limit theo giây giữ nguyên), thùng rác 30 ngày, log request 30 ngày, 20 webhook inbox mỗi project. Trần kích thước `MAX_RECORD_BYTES`, `MAX_RESOURCE_BYTES` giữ nguyên. Không còn `PlanId`, `limitsFor`, `effectivePlan`.
2. **Tính năng trước đây chỉ Pro mở cho mọi người:** fork, merge, pull request (bỏ `PLAN_FEATURE_UNAVAILABLE`), custom response, object template.
3. **Gỡ hẳn, không để cờ:** dùng thử và job nhắc hạn, xin gia hạn, trang admin dùng thử và quan tâm Pro, form quan tâm Pro (`pro-interest-schema.ts`), lệnh `set-user-plan`, banner "vượt hạn mức sau khi hết dùng thử", dòng "hạn mức mở rộng tới ngày…" ở trang Tài khoản, kiểu thông báo `trial.*`.
4. **Chạm giới hạn vẫn báo lỗi** `403 PLAN_LIMIT_REACHED` (giữ tên mã vì client đã phát hành so khớp nó), câu chữ trung tính, không nhắc nâng cấp hay Pro.
5. **Hợp đồng với client đã phát hành:** web đóng gói trong app di động và PWA cũ bắt buộc có `plan` là `free` hoặc `pro` ở `GET /users/me`, `GET /account/usage` và traffic settings, nên ba câu trả lời này giữ `plan`, luôn là `"pro"` (đánh dấu deprecated trong schema, `billing/legacy-plan-field.ts`). Bỏ `trial` khỏi `/users/me`, bỏ `planExpiresAt` và `overLimits` khỏi `/account/usage` (client cũ chấp nhận thiếu). `GET /feedback/pro-interest/config` giữ làm alias của `GET /feedback/config` vì form góp ý của bản cũ đọc site key Turnstile ở đó.
6. **Route cũ:** API của dùng thử và quan tâm Pro trả `410 GONE` (`http/retired-routes.ts`), không 404. `/pricing` chuyển về `/` bằng 301 (nginx) và `Navigate` (SPA); `/admin/pro-interest`, `/admin/trial-extensions` chuyển về `/admin/feedback`.
7. **Dữ liệu cũ không xoá, không migration:** trường `plan`, `planExpiresAt`, `trialStartedAt`, `trialNotices` trên `users`, collection `trial_extension_requests`, các dòng `pro_interest` trong `feedback` và thông báo `trial.*` đã lưu vẫn nằm đó, không ai đọc. Model tối thiểu `account-deletion/retired-feature-models.ts` giữ lại chỉ để xoá tài khoản vẫn xoá dữ liệu cá nhân trong hai collection cũ. Chuông thông báo chỉ liệt kê kiểu còn gửi.
8. **Dọn project bỏ hoang** (`cleanup:abandoned`, chạy tay, dry run mặc định) áp như nhau cho mọi chủ project, không còn lọc "chủ gói Free".

## Lý do

- Một mức thì không cần dùng thử, hết hạn, nhắc hạn hay trang admin cấp gói; bỏ được cả một nhánh code và một job chạy hằng giờ.
- Giữ `plan: "pro"` thay vì bỏ hẳn trường: bỏ thì app di động đã phát hành coi `/users/me` là lỗi và không đăng nhập được.

## Đánh đổi & hệ quả

- Tên mã lỗi `PLAN_LIMIT_REACHED` và trường `plan` còn chữ "plan" vì hợp đồng API; gỡ khi không còn client cũ.
- Bộ đếm request tháng và cơ chế trần tháng vẫn còn (`LIMITS.mockRequestsPerMonth`/`proxyRequestsPerMonth` là `null`), cùng thông báo `usage.quota` chưa bao giờ phát với `null`. Đặt lại một trần tháng chỉ cần đổi số.
- Thương mại hoá sau này cần ADR mới.
