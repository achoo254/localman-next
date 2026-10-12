# SAST: phase 13 đợt A, backend environments

**Ngày:** 2026-10-12 · **Kết luận SAST:** ĐẠT (0 Critical, 0 High, 0 Medium; 1 Low; 5 false positive) · **DAST:** chưa chạy, chờ deploy

## Phạm vi

`apps/api/src/modules/environments/*` (29 tệp, kể cả test), `packages/shared/src/api-client/environments/*`, `apps/api/src/modules/access/shared-elements.ts`, thay đổi ở `collection-list-service.ts`, `trash-purge.ts`, `workspace-service.ts`, `workspace-crud-operations.ts`, `config/env.ts`, `config/runtime-settings.ts`, `infra/localman/nginx/localman.hoandat.com.conf`. Code chưa commit.

## Phép đo

| Lớp | Công cụ | Kết quả |
|---|---|---|
| `.env` bị track | `git ls-files` + `.gitignore` | Không tệp `.env` thật nào bị track; `.env`, `.env.*` đã ignore |
| Secret | `gitleaks dir` (bản sao phạm vi, 122 KB) | Không có leak |
| Mẫu mã nguy hiểm | `semgrep` 1 lần qua `uvx`, `--no-git-ignore`, bộ `p/typescript`, `p/nodejs`, `p/owasp-top-ten`, `p/secrets`, `p/jwt` (122 luật, 37 tệp, đã xác nhận có 29 tệp mới trong danh sách quét) | 0 finding trên TypeScript; 5 cảnh báo nginx (xem dưới) |
| Dependency | `pnpm audit --prod` | 0 lỗ hổng; module không thêm dependency |
| STRIDE / OWASP | Đọc tay theo `stride-owasp-checklist` | Không có Critical/High/Medium |

Lần chạy semgrep đầu ghi "Scan was limited to files tracked by git"; đã chạy lại với `--no-git-ignore` và kiểm danh sách tệp đã quét để chắc tệp mới có trong đó.

## Finding

| # | Mức | Loại | Vị trí | Mô tả | Khuyến nghị |
|---|---|---|---|---|---|
| 1 | Low | DoS (A05) | `infra/localman/nginx/localman.hoandat.com.conf` location `~ ^/api/v1/(collections\|environments\|workspaces)/` | nginx buffer tới 16m mỗi request trước khi chuyển cho API. API từ chối khách trước khi đọc body (`signedInBeforeBody` trong `dashboard-server.ts`), nhưng nginx vẫn nhận đủ body. Location proxy có `limit_req` theo IP, location này chưa có (giống `/api/v1/client/` hiện tại) | Thêm zone `limit_req` riêng theo IP cho location này khi tinh chỉnh nginx |

## Không phải lỗi (đã kiểm)

- **semgrep `request-host-used`, nginx dòng 29, 86, 87, 116, 117:** các dòng này có từ commit `2edc021` (09/10), không thuộc thay đổi lần này. Tệp không có `default_server`, nên Host lạ không vào các server block này; kẻ tấn công chỉ đổi được subdomain dưới `*.localman.hoandat.com`, mà mock runtime dùng subdomain để tra secret theo thiết kế.
- **IDOR:** mọi operation đi qua `requireEnvironment`, `requireGlobals` (thành viên workspace) hoặc `requireCollection`; giá trị local luôn lọc theo `userId` của phiên.
- **Lộ secret cho Viewer:** `toVariableViews` giấu giá trị shared của secret khi vai trò khác Editor; duplicate của Viewer để trống secret; test `environment-values.test.ts` kiểm cả response lẫn danh sách không chứa plaintext.
- **Secret lúc lưu:** AES-256-GCM qua `TokenCipher` có sẵn, associated data là slot (`shared:<scope>:<variableId>`, `local:<userId>:<scope>:<key>`), giá trị chép sang slot khác không mở được (`secret-cipher.test.ts`).
- **Mass assignment / NoSQL injection:** input qua zod (bỏ khoá lạ), filter Mongo chỉ nhận chuỗi đã kiểm.
- **Tài nguyên:** body limit theo route (3 MiB biến, 6 MiB giá trị local), tối đa 200 environment mỗi workspace (kiểm trong khoá workspace), 500 giá trị local mỗi scope, danh sách đếm biến bằng `$size` thay vì tải giá trị.

## Ghi chú còn mở

- Kiểm trần 500 giá trị local không nằm trong transaction: hai request song song có thể vượt trần một chút (ảnh hưởng nhỏ, chỉ dữ liệu của chính người đó).
- Phần server điền secret bị giấu khi gửi qua proxy (T6) chưa viết; cần SAST riêng khi xong.
- DAST chỉ chạy được sau khi deploy, mà deploy cần user yêu cầu tường minh.
