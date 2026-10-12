# SAST: gỡ giao diện thương mại, Pro 30 ngày tự động

**Ngày:** 2026-10-12 · **Kết luận SAST:** ĐẠT (0 Critical, 0 High, 0 Medium, 0 Low, 1 Info) · **DAST:** chưa chạy, chờ deploy do user yêu cầu

## Phạm vi

Mọi tệp thêm hoặc sửa của thay đổi (171 tệp `.ts/.tsx/.mjs/.conf/.html`): `apps/api/src/modules/trial/trial-plan.ts` (`autoStartTrial`), `apps/api/src/modules/users/user-sync.ts`, `apps/api/src/modules/billing/plan-guard.ts`, copy thông báo của API, `apps/web/src/**` (gỡ trang giá, hộp thoại gói, dùng thử, form Pro interest; thêm `use-limit-notice.ts`, `turnstile-config-api.ts`), `apps/web/index.html`, `infra/localman/nginx/localman.hoandat.com.conf` (`/pricing` → 302), `e2e/support/user-plan.ts`. Kế hoạch: `plans/dattqh/261012-1105-hide-commercial-ui/plan.md`; quyết định: `docs/decisions/0002-no-commercial-ui-automatic-pro-period.md`.

## Phép đo

| Lớp | Công cụ | Kết quả |
|---|---|---|
| Mẫu mã nguy hiểm | `semgrep` qua `uvx`, `--no-git-ignore`, bộ `p/typescript`, `p/react`, `p/owasp-top-ten`, `p/secrets`, `p/xss`; danh sách tệp đọc bằng vòng `while read` trong bash (đã kiểm: 171 tệp được quét) | 5 cảnh báo `request-host-used` ở nginx dòng 29, 86, 87, 116, 117: các `return 301 https://$host…` và `proxy_set_header Host` có sẵn, đã phân loại false positive ở `security-261012-0855-phase-13-environments-backend-sast.md`; phần sửa (dòng ~291) không bị cảnh báo. 2 lỗi `PartialParsing` ở hai tệp test (`landing-page.test.tsx`, `routes.test.tsx`), không ảnh hưởng mã chạy |
| Secret | `gitleaks dir` trên bản sao các tệp thay đổi (746 KB) | Không có leak |
| Dependency | Không thêm dependency, không đổi lockfile | Không áp dụng |
| Đọc tay (STRIDE) | Xem dưới | 1 Info |

## Không phải lỗi (đã kiểm)

- **Tampering / leo quyền ở `autoStartTrial`:** chỉ chạy phía server với `sub` từ userinfo của IdP, không nhận input của client. Một lệnh `updateOne` có điều kiện `trialStartedAt: null` và không đang Pro (`plan != "pro"` hoặc `planExpiresAt <= now`), nên gọi lặp hay đồng thời chỉ cấp một lần. Pro do admin cấp không hạn (`planExpiresAt: null`) không khớp vì `$lte` với Date không khớp `null` (so sánh theo kiểu BSON); có test `trial-auto-start.test.ts`.
- **Lỗi làm hỏng đăng nhập:** sau review, `autoStartTrial` tự bắt lỗi của lệnh ghi, log cảnh báo và trả `null`, nên đăng nhập không còn bị chuyển về `login_failed` khi lệnh ghi lỗi; lần làm mới phiên sau thử lại (test `let the sign-in through when the write fails`). Lúc làm mới phiên, lỗi của `afterRefresh` vốn đã chỉ được log (`session-refresher.ts`).
- **Open redirect:** `location = /pricing { return 302 /; }` là đích cố định, không lấy từ request. Router SPA dùng `<Navigate to="/" replace />`.
- **XSS:** copy mới không thêm thẻ HTML ngoài `<code>` có sẵn; không thêm `dangerouslySetInnerHTML`; `renderRich` vẫn chỉ nhận chuỗi dịch, tên dự án đi vào qua renderer.
- **Lộ thông tin:** `GET /users/me` vẫn trả `plan`, `planExpiresAt`, `trial` như trước (thông tin của chính người dùng), web chỉ không hiển thị.
- **Endpoint giữ lại:** `POST /users/me/trial` sau khi tự cấp trả 409 `TRIAL_ALREADY_USED`; `POST /users/me/trial/extension` vẫn rate limit 5 lượt mỗi ngày và chỉ tạo yêu cầu chờ admin duyệt.
- **`e2e/support/user-plan.ts`:** `execFile` không qua shell, đối số cố định cộng username sinh trong test, env chỉ `PATH`, `HOME`, `MONGO_URI` của Mongo E2E (cổng 4650); chỉ chạy trong E2E.

## Info

1. **Pro 30 ngày cho mỗi tài khoản mới:** người tạo nhiều tài khoản ở IdP được nhiều lượt Pro. Rủi ro này đã có từ khi dùng thử tự phục vụ; cổng chặn là đăng ký tài khoản ở IdP. Chấp nhận theo quyết định của user (ADR-0002), không sửa.

## Còn mở

- DAST chỉ chạy được sau deploy, mà deploy cần user yêu cầu tường minh: kiểm `/pricing` trả 301, landing và app không còn chữ thương mại, tài khoản Free chưa dùng thử được cấp Pro sau đăng nhập lại (đọc Mongo, chỉ in true/false), chạm giới hạn hiện câu trung tính.

## Chạy lại sau bản sửa của review (13:15)

Bản sửa đổi copy API (nhãn thông báo, câu hết quota, message inbox và proxy), `autoStartTrial` tự bắt lỗi, nginx 302, copy hạn mức web và dọn code chết. semgrep cùng bộ luật trên 178 tệp chỉ ra lại đúng 5 cảnh báo `request-host-used` đã phân loại false positive; gitleaks trên bản sao các tệp thay đổi không có leak. Kết luận SAST giữ nguyên: ĐẠT.
