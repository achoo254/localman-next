# DAST: phần khép phase 14 (fork kèm environment, diff của PR, `canMerge`) trên prod

**Ngày:** 2026-10-19 · **Release:** `20261019-030839-98267df7b894` (commit `98267df`, không `-dirty`, CI xanh run `39192170304`; deploy bởi phiên `localman-next-65` theo yêu cầu của user) · **Cổng:** `FORKS_ENABLED=true`, cờ web `forks` · **Kết luận DAST:** ĐẠT (0 Critical, 0 High, 0 Medium; 1 Info) · **SAST:** đạt sau khi sửa (review trước commit `18ac1db`: 1 High, 4 Medium đã sửa kèm test).

Đo từ ngoài qua `https://localman.hoandat.com`: phần chưa đăng nhập bằng `curl`; phần có đăng nhập bằng phiên trình duyệt thật của user (Chrome, fetch cùng origin), với dữ liệu thử tạo riêng (workspace team tạm, collection, hai environment, fork, PR) và đã xoá hết sau khi đo. Mongo đọc bằng `prod-mongosh.sh`, chỉ in số đếm.

| # | Ca | Kết quả |
|---|---|---|
| 1 | `GET /pull-requests/:id/changes/:key/diff` và `fork-status` khi chưa đăng nhập (key `r1`, `constructor`, `__proto__`, `..%2F..%2Fusers`) | 401 `UNAUTHENTICATED` |
| 2 | Key chứa `%00` | 400 từ Cloudflare, không tới server |
| 3 | `POST /collections/:id/forks` không có Origin hợp lệ | 403 `CSRF_REJECTED` |
| 4 | Endpoint diff trong OpenAPI production | Có (`/pull-requests/{pullRequestId}/changes/{changeKey}/diff`) |
| 5 | Fork kèm environment của workspace khác | 400 `FORK_ENVIRONMENT_OUTSIDE_WORKSPACE`, không tạo gì |
| 6 | Cùng environment hai lần (khác hoa thường); 6 environment | 400 `VALIDATION_ERROR` |
| 7 | Environment không tồn tại | 404 `NOT_FOUND`, không tạo gì |
| 8 | Fork kèm environment hợp lệ | 201; đúng 1 fork environment, liên kết với nguồn, cùng nhãn; secret chép cho Editor của nguồn; danh sách fork của nguồn chỉ có 1 |
| 9 | `fork-status` của chủ fork | `source.canMerge: true` |
| 10 | Diff của thay đổi trong PR | 200, `before: null` (request thêm mới), `after` đúng URL |
| 11 | Key `constructor`, `__proto__`, `toString`, `collection` (không đổi), `..%2F..` | 404 `PULL_REQUEST_CHANGE_NOT_FOUND` |
| 12 | Key dài 201 ký tự | 400 `VALIDATION_ERROR` |
| 13 | PR không tồn tại, id PR hỏng | 404 `PULL_REQUEST_NOT_FOUND` |
| 14 | Sau khi dọn: PR, liên kết fork, collection, environment, workspace thử trong Mongo | 0 / 0 / 0 / 0 / 0 |
| 15 | Server sau đợt đo | `localman-api` online, restarts 42 (không đổi), 0 dòng log mức error/fatal |

## Ghi chú

- **Info:** chỉ có một tài khoản thật, nên chưa thử trên prod việc người khác đọc diff của PR không thuộc mình; endpoint diff đi qua `requirePullRequest` như mọi endpoint PR (404 khi không mở được nguồn), và `pull-request-diff.test.ts` thử Viewer của nguồn đọc được diff.
