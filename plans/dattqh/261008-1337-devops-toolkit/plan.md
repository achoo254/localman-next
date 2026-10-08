---
title: "Localman DevOps toolkit: test API trong CI bằng 1 lệnh, mock tạm, tunnel có SSO, giám sát"
description: "Mở rộng bộ ba Localman, Tunelo và IdP cho DevOps: CLI chạy collection trong CI cùng mock tạm và tunnel, token máy, tunnel có SSO, đồng bộ biến và secret, cấu hình dạng code, audit log, giám sát."
status: pending
priority: P2
effort: "XL (7 phase: 4×M, 3×L)"
branch: ""
tags: [feature, devops, cli, ci, security]
blockedBy: ["plans/dattqh/261008-1123-localman-core", "plans/dattqh/261008-1156-tunelo-accounts-and-tunnel-list", "plans/dattqh/261008-1325-central-auth-idp"]
blocks: []
created: 2026-10-08
---

# Localman DevOps toolkit

## Outcome
Bộ ba sản phẩm (Localman mock, API client, Tunelo) vốn dành cho lập trình viên. Plan này mở rộng sang **DevOps**: đưa test API, mock và tunnel vào pipeline CI/CD, có danh tính máy, kiểm soát truy cập, audit và giám sát. Code nằm trong monorepo `achoo254/localman-next`.

**Keyword DevOps** (Jev 0.69): **"Test API trong CI bằng 1 lệnh"**. Postman đã có Postman CLI, nên keyword chỉ đứng được nhờ **một lệnh làm cả ba việc**: dựng mock tạm, mở tunnel tới service đang chạy trong job, rồi chạy collection. Ví dụ:

```
localman test --collection "Checkout API" --env ci \
  --mock openapi.yaml --tunnel 3000 --report junit
```

## Quyết định (Jev `jev-1.13.0`, 2026-10-08)

| Tính năng | Jev | Phase |
|---|---|---|
| Mock tạm cho CI/PR (`localman mock up --from openapi.yaml --ttl 2h`) | 0.72 | 03 |
| CLI chạy collection trong CI (exit code, báo cáo JUnit/JSON) | 0.70 | 02 |
| Tunnel có đăng nhập SSO (`auth.hoandat.com`) cộng IP allowlist | 0.70 | 04 |
| Token máy cho CI (service account, PAT có scope và TTL) | 0.69 | 01 |
| Đồng bộ biến với `.env`, GitHub Actions secrets, Doppler/Vault | 0.64 | 05 |
| Audit log | 0.64 | 01 |
| Template GitHub Action và GitLab CI | 0.59 | 02 |
| Cấu hình dạng code `localman.yaml` (push/pull, review trong PR) | 0.58 | 06 |
| Giám sát API theo lịch, báo qua Telegram và Web Push, status page | 0.53 (sát ngưỡng) | 07 |
| Tunnel TCP cho vận hành (DB/SSH tạm thời, có TTL, SSO và audit) | 0.52 (sát ngưỡng) | 04 |
| **Loại:** OpenTelemetry (0.48), xuất sang k6 (0.33) | — | — |
| Tổ chức thành plan riêng, cùng monorepo | 0.61 | — |

**Collection Runner:** plan Localman trước đây đã để Runner ngoài phạm vi phần tương đương Postman (Jev 0.44). Plan này **đưa Runner vào** vì CLI cho CI cần nó (Jev 0.70). Đi kèm là chạy theo file dữ liệu CSV/JSON (scope biến `data`) ở **gói Free**. Postman chỉ có tính năng này ở gói trả phí (theo `../reports/competitors/research-261008-1316-api-clients.md`).

**Không email:** mọi cảnh báo dùng kênh thông báo của Localman phase 02 (trong app, Web Push, Telegram) cùng webhook ra Slack hoặc Discord.

## MCP (user yêu cầu 2026-10-08: mọi tính năng DevOps đều có MCP tool)
Mọi operation trong plan này khai báo qua operation registry (Localman phase 01), nên tự có tool trong các toolset:
- `devops`: runner, chạy collection phía server, lịch sử chạy, mock tạm, đồng bộ biến, config pull/diff/push, monitor, status page.
- `tunnels`: liệt kê tunnel theo workspace, sửa quyền truy cập, đóng tunnel từ xa.
- `admin`: audit log; PAT và service account. Tạo hoặc xoay credential cần `credentials:write`; secret chỉ trả về một lần.

Các tool `config_push`, `env_sync_github`, `close_tunnel` và `delete_*` bắt buộc dry-run kèm `confirm_token`. Mở tunnel trên máy user dùng MCP local `tunelo mcp` (plan Tunelo, phase 02). Mỗi phase dưới đây đều kiểm `pnpm check:mcp-coverage`.

**Tool `run_collection`** chạy runner **phía server**: dùng chung worker với monitor của phase 07, request đi qua proxy, có tính hạn mức. Agent nhờ vậy chạy được test mà không cần máy CI.

## Phases

| # | Phase | Tier | Phụ thuộc |
|---|---|---|---|
| 01 | [Danh tính máy (service account, PAT có scope) và audit log](phase-01-machine-identity-and-audit.md) | M | IdP, Localman 11 |
| 02 | [Collection Runner, CLI `localman`, template CI](phase-02-runner-cli-and-ci-templates.md) | L | 01, Localman 12, 13 |
| 03 | [Mock tạm cho CI/PR](phase-03-ephemeral-mocks.md) | M | 01, 02, Localman 19 |
| 04 | [Tunelo cho vận hành: tunnel có SSO, IP allowlist, token CI, tunnel TCP có TTL](phase-04-tunelo-ops.md) | L | 01, plan Tunelo |
| 05 | [Đồng bộ biến và secret: `.env`, GitHub Actions, Doppler/Vault](phase-05-env-and-secrets-sync.md) | M | 01, 02, Localman 13 |
| 06 | [Cấu hình dạng code `localman.yaml`](phase-06-config-as-code.md) | L | 02, 03, 05 |
| 07 | [Giám sát API theo lịch, cảnh báo, status page](phase-07-api-monitors.md) | M | 02 |

## Acceptance
1. Trong một GitHub Action mẫu, chạy **một lệnh** `localman test … --mock … --tunnel …` thì dựng được mock tạm, mở tunnel tới service trong job, chạy collection, xuất JUnit, trả exit code ≠ 0 khi có assert sai, rồi tự dọn mock và tunnel.
2. Token máy chỉ làm được đúng scope của nó, có TTL, xoay vòng được, và mọi lần dùng đều ghi audit.
3. Tunnel bật SSO thì người chưa đăng nhập `auth.hoandat.com` hoặc không thuộc danh sách cho phép không mở được.
4. Không có email ở đâu; cảnh báo đi qua Telegram, Web Push hoặc webhook Slack/Discord.
5. Test, lint và E2E của các phase đều pass.

## Rủi ro
| Rủi ro | Giảm thiểu |
|---|---|
| Runner, mock tạm và monitor làm tăng tải server | Hạn mức theo gói (`plan-limits`: `ciRunsPerMonth`, `ephemeralMocks`, `monitors`, `monitorIntervalMin`); runner chạy **trong CLI** trên máy CI là chính, server chỉ ghi kết quả |
| Lộ token máy trong log CI | Token có tiền tố nhận dạng được (`lmk_`, `tlk_`) để secret scanner bắt; CLI che token khi in; TTL mặc định 24 giờ |
| Tunnel TCP mở DB ra internet | Bắt buộc bật SSO hoặc IP allowlist cho TCP; TTL tối đa 8 giờ; có audit |
| Phạm vi lớn với một người làm | Mỗi phase giao được độc lập; 07 và phần TCP của 04 có thể lùi vì Jev cho sát ngưỡng |

## Câu hỏi mở
- **Gói Pro:** runner, mock tạm và monitor **không giới hạn theo tháng**, chỉ có rate-limit. Cách này giống quyết định của Jev cho mock và proxy (`null` trong `plan-limits`). Trên UI, gói Pro hiện "Liên hệ" và mở form quan tâm Pro (Localman phase 03) để đếm nhu cầu, trong đó có nhu cầu DevOps/CI.
- **Gói Free:** số tạm trong prototype (300 lượt chạy CI/tháng, 3 mock tạm, 3 monitor, lịch tối thiểu 15 phút) sẽ được chốt với Jev khi bắt đầu phase 02, dựa trên số liệu tải thật. Lúc chốt cũng xem số người quan tâm Pro theo nhu cầu "DevOps/CI".
