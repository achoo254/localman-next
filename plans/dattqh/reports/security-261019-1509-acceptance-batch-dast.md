# DAST: agent không đọc secret, scope `client:send`/`client:share`, lối vào góp ý trên prod

**Ngày:** 2026-10-19 · **Release:** `20261019-080937-aaba570994cb` (commit `aaba570`, gồm `b23ceab`; không `-dirty`, CI xanh run `39216536736` và `39218598551`; deploy theo yêu cầu của user) · **Rollback:** `20261019-060338-53bacda99e7e` · **Kết luận DAST:** ĐẠT (0 Critical, 0 High, 0 Medium; 1 Info) · **SAST:** đạt sau khi sửa (review trước commit: 3 Critical, 3 High, 2 Medium, 3 Low đã sửa kèm test).

Đo từ ngoài qua `https://localman.hoandat.com`: phần chưa đăng nhập bằng `curl`, phần giao diện bằng phiên trình duyệt thật của user (Chrome). Không gửi form, không ghi dữ liệu prod.

| # | Ca | Kết quả |
|---|---|---|
| 1 | Trang chủ, `/api/v1/openapi.json` | 200 / 200 |
| 2 | `www.localman.hoandat.com`, đường nội bộ | 404 / 403 |
| 3 | Header `Content-Security-Policy` | Có, đúng theo §Kiểm tra sau deploy |
| 4 | `scopes_supported` trong metadata OAuth của `/mcp` | `mock:read`, `mock:write`, `client:read`, `client:write`, `client:send`; **không** có `client:share`, `credentials:write` (chỉ cấp khi step-up) |
| 5 | `POST /mcp` không token | 401 kèm `WWW-Authenticate` trỏ metadata |
| 6 | Cổng nội bộ 4000/4100 từ ngoài | Bị từ chối |
| 7 | `/healthz` hai server (trên máy) | `db: connected` |
| 8 | `localman-api` sau deploy | online, restarts 44 → 45 (lần activate release), 0 dòng log mức error/fatal |
| 9 | Menu tài khoản trên `/api-client` (trang không có footer) | Có mục "Góp ý / Liên hệ", mở đúng form với tên và email lấy từ tài khoản; đóng không gửi |

## Ghi chú

- **Info:** chưa đo trên prod đường của agent (token MCP không có phiên trình duyệt: che secret ở environment, changelog, diff PR, auth gõ tay; `send_request` cần `client:send`; tool cấp quyền cần `client:share`; `delete_workspace` cần `confirm_token`) vì cần user cấp quyền OAuth cho một client trên tài khoản thật. Các ca này có trong `localman-mcp-client-tools.test.ts`, `localman-mcp-client-scopes.test.ts`, `localman-mcp-changelog-channel.test.ts`, `*agent-secrets*.test.ts` và E2E `agent-mcp-workflow.spec.ts`, đều xanh trên CI.
- Nguồn góp ý mới `api-client` hiện nhãn "API client" trong hộp thư admin; trước bản này người dùng ở workbench không có đường nào tới form góp ý (prod: 0 góp ý từ khi mở).
