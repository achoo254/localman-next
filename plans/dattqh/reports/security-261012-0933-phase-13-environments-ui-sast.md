# SAST: phase 13 đợt A, UI environments và nối biến lúc gửi

**Ngày:** 2026-10-12 · **Kết luận SAST:** ĐẠT (0 Critical, 0 High, 0 Medium, 0 Low) · **DAST:** chưa chạy, chờ deploy

## Phạm vi

`apps/web/src/features/environments/*` (24 tệp), `features/sharing/request-edit-button.tsx`, `features/collections/collection-share-dialog.tsx`, `features/api-client/workbench/{send-variables,send-steps,use-send-tab,workbench-tab-types}.ts`, `features/api-client/tabs/*`, `features/workspaces/current-workspace.ts`, `pages/api-client/*`, `e2e/specs/environments-and-variables.spec.ts`. Backend đã có báo cáo riêng: `security-261012-0855-phase-13-environments-backend-sast.md`.

## Phép đo

| Lớp | Công cụ | Kết quả |
|---|---|---|
| Mẫu mã nguy hiểm | `semgrep` qua `uvx`, `--no-git-ignore`, bộ `p/typescript`, `p/react`, `p/owasp-top-ten`, `p/secrets`, `p/xss` (113 luật, 42 tệp, đã xác nhận 24 tệp của `features/environments` trong danh sách quét) | 0 finding, 0 lỗi |
| Secret | `gitleaks dir` trên bản sao phạm vi (139 KB) | Không có leak |
| Dependency | Không thêm dependency (lockfile không đổi bởi phần này) | Không áp dụng |
| Đọc tay | XSS, lộ secret, lưu trữ trình duyệt, history, đường gửi | Không có finding |

Lần chạy đầu quét 0 tệp vì zsh không tách biến danh sách đường dẫn; đã chạy lại bằng mảng trong bash và kiểm số tệp đã quét.

## Không phải lỗi (đã kiểm)

- **XSS:** không có `dangerouslySetInnerHTML`; tên, giá trị, mô tả biến chỉ hiện qua `value` của input hoặc text node; chuỗi dịch không đi qua `renderRich` với dữ liệu người dùng.
- **Secret trên màn hình:** biến `secret` dùng `type="password"`, chỉ hiện khi bấm nút hiện của dòng đó; Viewer chỉ thấy nhãn "Hidden" cho shared value bị giấu (API không gửi giá trị).
- **Lưu trữ trình duyệt:** tab environment và Globals không được lưu vào `localStorage` (`page-storage.ts` chỉ nhận trang collection); giá trị biến chỉ nằm trong cache bộ nhớ của React Query.
- **History:** `recordSend` lưu draft đúng như gõ (`{{token}}`), không lưu giá trị đã điền.
- **Gửi request:** `interpolationScope` giữ cờ `secret`, nên secret của environment vẫn qua hộp thoại hỏi trước khi đi proxy của phase 10; secret bị giấu với người gửi làm request dừng (`SECRET_WITHHELD`) thay vì gửi nguyên `{{name}}` ra ngoài.
- **Khi cờ tắt:** không gọi `/api/v1/workspaces` hay API environment nào (`useCurrentWorkspace(enabled)`), có test `collections-sidebar.test.tsx` kiểm.

## Còn mở

- Phần server điền secret bị giấu khi proxy (đợt B) cần SAST riêng.
- DAST chỉ chạy được sau khi deploy, mà deploy cần user yêu cầu tường minh.

## Chạy lại sau bản sửa của review (09:54)

Bản sửa đổi cả backend (`local-reseal.ts`, `local-values.ts`, `variable-store.ts`, schema) lẫn web, nên SAST chạy lại trên `apps/api/src/modules/environments`, `packages/shared/src/api-client/environments`, `apps/web/src/features/environments`, `use-send-tab.ts`, `send-variables.ts`, `page-storage.ts` và `infra/localman/nginx`: semgrep 122 luật trên 63 tệp chỉ ra lại 5 cảnh báo `request-host-used` đã phân loại là false positive ở báo cáo backend; gitleaks 222 KB không có leak. Finding Low về `limit_req` của báo cáo backend đã sửa (zone `localman_api_large`). Kết luận SAST giữ nguyên: ĐẠT.
