# Thứ tự triển khai và giao việc

Repo code: `achoo254/localman-next` (private). File này là mục lục để chạy `/ak:cook` theo đúng thứ tự. Chi tiết việc cần làm nằm ở mục **"Giao việc"** cuối mỗi file phase. Mỗi phase còn có một GitHub issue, và mỗi đợt là một milestone.

## Thư mục local

Mọi repo clone vào cùng một thư mục làm việc trên máy, gọi là `$WORKSPACE` (đặt biến này trong shell, ví dụ `export WORKSPACE=~/code`).

| Thư mục | Repo | Vai trò |
|---|---|---|
| `$WORKSPACE/localman-next` | `achoo254/localman-next` (private) | Monorepo code: Localman web/api, mock runtime, MCP, Tunelo (sau khi gộp), DevOps, extension. Chứa toàn bộ plan |
| `$WORKSPACE/hoandat-auth` | `achoo254/hoandat-auth` (tạo ở đợt 0) | IdP `auth.hoandat.com` |
| `$WORKSPACE/localman` | `achoo254/localman` (repo cũ) | Chỉ đọc để port ở phase 10; archive sau đó |
| `$WORKSPACE/tunelo` | `achoo254/tunelo` (repo cũ) | Nguồn để gộp ở Localman phase 01; archive sau đó |
| `$WORKSPACE/tunelo-import` | — | Bản clone tạm để chạy `git filter-repo` khi gộp Tunelo; xoá sau khi gộp |

## Các plan

| Plan | Thư mục | Số phase |
|---|---|---|
| Localman: mock API, API client, MCP, extension | `261008-1123-localman-core/` | 23 |
| Xác thực tập trung `auth.hoandat.com` | `261008-1325-central-auth-idp/` | 3 |
| Tunelo: tài khoản, API liệt kê tunnel, domain `tunnel.hoandat.com` | `261008-1156-tunelo-accounts-and-tunnel-list/` | 3 |
| DevOps toolkit | `261008-1337-devops-toolkit/` | 7 |

Báo cáo nghiên cứu: `reports/`. Prototype HTML (mở thẳng file): `261008-1123-localman-core/prototype/{index,api-client,devops,extension}.html`.

## Đợt triển khai

Mỗi đợt là một milestone trên GitHub. Một đợt chỉ bắt đầu khi đợt trước đã đóng. Các phase trong cùng đợt chạy theo thứ tự ghi trong bảng, trừ khi mục "Giao việc" của phase ghi là chạy song song được.

| Đợt | Phase | Kết quả cuối đợt |
|---|---|---|
| 0 | IdP 01 → 02 → 03 | `auth.hoandat.com` cấp được token cho Localman, MCP và Tunelo CLI |
| 1 | Localman 01 → 02 | Monorepo có Tunelo đã gộp, operation registry, đăng nhập qua IdP, kênh thông báo |
| 2 | Localman 03 → 04 → 05 → 06 → 07 → 08 → 09 | Bản sao mockapi.io lên staging |
| 3 | Localman 17 → 19 | Nền tảng MCP, Mock MCP tức thì, các tiện ích nâng cao cho mock (power-ups) |
| 4 | Tunelo 01 → 02 → 03 | Tunelo theo tài khoản, `tunnel.hoandat.com`, `tunelo mcp` |
| 5 | Localman 10, 20 | API client có định tuyến gửi thẳng/proxy/Tunelo; mock lai localhost |
| 6 | Localman 11 → 12 → 13 → 14 → 15 → 16 | Tương đương 100% Collections/Environments của Postman, kèm Live Mock Sync |
| 7 | Localman 21 → 18 | Đủ MCP toolset; client power-ups |
| 8 | Localman 22 → 23 | Browser extension |
| 9 | DevOps 01 → 07 | Test API trong CI bằng 1 lệnh, mock tạm, tunnel có SSO, giám sát |

## Issue theo phase

| Issue | Phase | Milestone |
|---|---|---|
| #1 | [IdP 01] IdP lõi: OIDC, client, key, deploy | Đợt 0 — IdP auth.hoandat.com |
| #2 | [IdP 02] Tài khoản và đăng nhập không dùng email | Đợt 0 — IdP auth.hoandat.com |
| #3 | [IdP 03] Tích hợp Localman, Tunelo, MCP | Đợt 0 — IdP auth.hoandat.com |
| #4 | [Localman 01] Scaffold monorepo và nền tảng brand | Đợt 1 — Monorepo, đăng nhập, thông báo |
| #5 | [Localman 02] Đăng nhập qua auth.hoandat.com và kênh thông báo không dùng email | Đợt 1 — Monorepo, đăng nhập, thông báo |
| #6 | [Localman 03] Projects và giới hạn gói | Đợt 2 — Bản sao mockapi.io |
| #7 | [Localman 04] Resources, schema, sinh dữ liệu | Đợt 2 — Bản sao mockapi.io |
| #8 | [Localman 05] Mock runtime công khai | Đợt 2 — Bản sao mockapi.io |
| #9 | [Localman 06] UI Project detail: canvas cây resource và các modal | Đợt 2 — Bản sao mockapi.io |
| #10 | [Localman 07] Collaboration và magic link | Đợt 2 — Bản sao mockapi.io |
| #11 | [Localman 08] Landing, pricing, account | Đợt 2 — Bản sao mockapi.io |
| #12 | [Localman 09] Hardening, E2E, deploy | Đợt 2 — Bản sao mockapi.io |
| #13 | [Localman 10] API Client: lõi gửi request và proxy | Đợt 5 — API client và mock lai localhost |
| #14 | [Localman 11] Workspace, vai trò và chia sẻ phần tử (theo Postman) | Đợt 6 — Tương đương Postman và Live Mock Sync |
| #15 | [Localman 12] Collections tương đương 100% Postman | Đợt 6 — Tương đương Postman và Live Mock Sync |
| #16 | [Localman 13] Environments và biến tương đương 100% Postman | Đợt 6 — Tương đương Postman và Live Mock Sync |
| #17 | [Localman 14] Fork, merge, pull request, comment, watch (theo Postman) | Đợt 6 — Tương đương Postman và Live Mock Sync |
| #18 | [Localman 15] Chia sẻ công khai: public workspace, guest, nút Run, access key | Đợt 6 — Tương đương Postman và Live Mock Sync |
| #19 | [Localman 16] Live Mock Sync: mock có trạng thái luôn đồng bộ với collection và environment | Đợt 6 — Tương đương Postman và Live Mock Sync |
| #20 | [Localman 17] Nền tảng MCP (toolsets, xác nhận, coverage), Mock MCP tức thì và toolset mock | Đợt 3 — Nền tảng MCP và mock power-ups |
| #21 | [Localman 18] Localman MCP: đủ toolset cho API client, chia sẻ, cộng tác, công khai, đồng bộ và traffic | Đợt 7 — Đủ MCP toolset và client power-ups |
| #22 | [Localman 19] Mock power-ups: Faker thông minh, tạo resource từ JSON/OpenAPI/CSV, xuất type, chaos, response theo điều kiện | Đợt 3 — Nền tảng MCP và mock power-ups |
| #23 | [Localman 20] Mock lai localhost, log request có replay, webhook inbox về localhost, mock callback | Đợt 5 — API client và mock lai localhost |
| #24 | [Localman 21] Client power-ups: secret local không rời trình duyệt, nối request không cần script, docs tự sinh từ mock | Đợt 7 — Đủ MCP toolset và client power-ups |
| #25 | [Localman 22] Browser extension: gửi request vượt CORS, cùng bộ công cụ cookie, storage, network, performance cho tab đang mở | Đợt 8 — Browser extension |
| #26 | [Localman 23] Extension: tiện ích mở rộng cho tab đang mở | Đợt 8 — Browser extension |
| #27 | [Tunelo 01] Server: xác minh token của IdP, tài khoản, scope, API liệt kê tunnel, link-code | Đợt 4 — Tunelo theo tài khoản |
| #28 | [Tunelo 02] CLI: đăng nhập bằng device flow, refresh, link, nhắc token ẩn danh | Đợt 4 — Tunelo theo tài khoản |
| #29 | [Tunelo 03] Docs, ADR, phát hành tunelo-v1.7.0, deploy, ngày chặn token ẩn danh | Đợt 4 — Tunelo theo tài khoản |
| #30 | [DevOps 01] Danh tính máy (service account, PAT có scope) và audit log | Đợt 9 — DevOps toolkit |
| #31 | [DevOps 02] Collection Runner, CLI `localman`, template CI | Đợt 9 — DevOps toolkit |
| #32 | [DevOps 03] Mock tạm cho CI/PR | Đợt 9 — DevOps toolkit |
| #33 | [DevOps 04] Tunelo cho vận hành: tunnel có SSO, IP allowlist, token CI, tunnel TCP có TTL | Đợt 9 — DevOps toolkit |
| #34 | [DevOps 05] Đồng bộ biến và secret: .env, GitHub Actions, Doppler/Vault | Đợt 9 — DevOps toolkit |
| #35 | [DevOps 06] Cấu hình dạng code `localman.yaml` | Đợt 9 — DevOps toolkit |
| #36 | [DevOps 07] Giám sát API theo lịch, cảnh báo, status page | Đợt 9 — DevOps toolkit |

## Cách chạy một phase

```bash
cd $WORKSPACE/localman-next      # với IdP thì cd $WORKSPACE/hoandat-auth
/ak:cook plans/dattqh/<plan-dir>/phase-NN-<tên>.md
```

Mỗi phase xong phải tick đủ checklist trong mục "Giao việc", chạy `pnpm lint && pnpm typecheck && pnpm test` sạch, và từ phase 02 trở đi `pnpm check:mcp-coverage` cũng phải pass. Đóng issue tương ứng bằng commit có `Closes #<số>`.

## Việc cần user xác nhận trước khi chạy
Trong checklist, các việc này được ghi "(cần user xác nhận)":
- tạo repo `hoandat-auth`;
- sửa DNS và TLS trên Cloudflare;
- deploy lên staging hoặc production;
- publish npm (`tunelo`, `localman`);
- nộp extension lên Chrome Web Store và Firefox AMO;
- archive repo `localman` và `tunelo` cũ;
- ngày chặn token ẩn danh của Tunelo.

## Quy ước đã chốt (tóm tắt)
- Mọi quyết định cần hỏi được giao cho model Jev. Bảng xác suất nằm ở mục "Validation Log" trong `plan.md` của từng plan.
- **Không có mail server:** thông báo đi qua kênh trong app, Web Push và Telegram. Gói Pro chỉ có form "Liên hệ" để thu email.
- **Domain:** chỉ dùng `*.hoandat.com` (`localman`, `auth`, `tunnel`).
- **MCP:** mọi tính năng của mock API, API client và DevOps đều có MCP tool, sinh ra từ operation registry.
