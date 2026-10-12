# SAST: phase 13 đợt B (Environments) và vá tương đương phase 12 (Collections)

**Ngày:** 2026-10-12 · **Kết luận SAST:** ĐẠT (0 Critical, 0 High, 0 Medium, 0 Low sau khi sửa các finding của review) · **DAST:** chưa chạy, chờ deploy (user đã yêu cầu deploy khi xong)

## Phạm vi

Mọi tệp thêm hoặc sửa của đợt này (danh sách lấy từ `git diff HEAD` và tệp chưa track, trừ phần auth/silent sign-in và Tunelo của session khác): sandbox script (`packages/shared/src/api-client/script-sandbox/**`), biến động và Faker (`dynamic-variables.ts`, `faker-dynamic-variables.ts`, `variable-interpolation.ts`), codec environment Postman, `script-scope-values.ts`; API `apps/api/src/modules/environments/**` (import/export, `createdByName`), `collections/**` (liên kết, changelog, tìm kiếm example), `access/share-service.ts`, `module-loggers.ts`; web `features/environments/**`, `features/variables/**`, `features/collections/**`, `features/sharing/**`, `features/api-client/{workbench,scripts,import-export}/**`; nginx (nếu đổi giới hạn body import).

## Phép đo

| Lớp | Công cụ | Kết quả (lần 1, 15:36) |
|---|---|---|
| Mẫu mã nguy hiểm | `semgrep` qua `uvx`, `--no-git-ignore`, bộ `p/typescript`, `p/react`, `p/owasp-top-ten`, `p/secrets`, `p/xss`, `p/nodejsscan`; 236 tệp | 2 cảnh báo, đều false positive: `node_secret` ở `scope-badge.tsx:25` là hằng `SECRET_MASK = "••••••"` (ký tự che, không phải secret); `node_insecure_random_generator` ở `dynamic-variables.ts:30` là `Math.random` sinh dữ liệu giả cho `$randomInt`/tên mẫu, có từ trước, không dùng cho token (`$guid` dùng `getRandomValues`) |
| Secret | `gitleaks dir` trên bản sao các tệp thay đổi (915 KB) | Không có leak |
| Dependency | Không thêm dependency, lockfile không đổi bởi đợt này | Không áp dụng |

## Đọc tay (STRIDE), kèm hai review độc lập

Review: `code-reviewer-261012-1535-phase-13-slice-b-backend.md` (0 Critical/High, 4 Medium), `code-reviewer-261012-1535-phase-13-slice-b-web.md` (2 High, 6 Medium).

- **Information disclosure, secret:** secret bị giấu với Viewer không vào sandbox, thẻ hover, pane, script hay history; export environment luôn để trống secret và không có giá trị local; server không điền secret bị giấu khi proxy (Vòng 38: proxy gửi tới URL bất kỳ nên điền hộ sẽ làm lộ). `createdByName`, tên mock project và environment liên quan chỉ hiện khi người gọi đọc được; phần tử đã xoá hoặc khác workspace trả `null`.
- **Elevation / IDOR:** import kiểm `addElements` trước khi đọc file; export qua quyền xem environment; liên kết environment phải cùng workspace (400 chung cho "không có" và "không đọc được"); diff đã ẩn chỉ trả cho Editor/Admin; "Set as variable" của Viewer chỉ ghi biến tạm, server vẫn trả 403 nếu bị gọi lách.
- **Tampering, sandbox:** QuickJS vẫn chỉ nhận JSON vào và trả JSON ra, không thêm callback host; giới hạn số tên, độ dài được kiểm ở cả hai phía; bản ghi scope không có prototype nên tên `__proto__` là dữ liệu.
- **Tính toàn vẹn dữ liệu (đã sửa theo review):** H1 lưu thay đổi của script nhầm environment khi đổi environment giữa chừng (chốt đích lúc gửi, có test); H2 Share all/Update all xoá local khi lưu shared lỗi (chỉ reset sau khi shared thành công); giới hạn scope 500 làm hỏng script với scope 700 tên (nâng lên 700, giới hạn tên/giá trị khớp API).
- **Denial of service:** phân trang changelog không còn vòng truy vấn tới ~21 lần mỗi trang (lưu `sessionStartSeq`); body import environment đủ cho dữ liệu hợp lệ tối đa; tải chunk Faker chỉ khi cần, lỗi thì dừng có thông báo.
- **Repudiation:** ghi `sharedEnvironmentId` lỗi được log cảnh báo qua logger module, share vẫn thành công.

## Lần chạy cuối (16:29, sau khi sửa các finding của review)

semgrep cùng bộ luật trên 287 tệp: lại đúng 2 cảnh báo false positive ở trên (`SECRET_MASK`, `Math.random` cho dữ liệu giả), không có cảnh báo mới. gitleaks trên bản sao 1,09 MB: không có leak. nginx không đổi (location `/api/v1/(collections|environments|workspaces)/` đã có trần 16m, đủ cho giới hạn import 10 MiB). Các cổng: lint, typecheck, check:mcp-coverage (167 operation), check:tokens đều sạch; web 1404, API 1259, shared 1638 test pass; E2E 39/39.

## Còn mở

- DAST sau deploy.
