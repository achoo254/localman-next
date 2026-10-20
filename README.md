# Localman (next)

Monorepo của bộ công cụ API Localman và Tunelo.

## Trạng thái

Đang chạy production tại <https://localman.hoandat.com>:

- **Mock API có trạng thái**, tương đương mockapi.io: project, resource lồng nhau, dữ liệu Faker, custom response. Mock runtime công khai ở `https://{secret}.localman.hoandat.com{prefix}`.
- **Mock power-ups:** tạo resource từ JSON/OpenAPI/CSV, xuất type, rules và chaos theo endpoint, gợi ý Faker.
- **Mock MCP** cho mỗi project, **mock lai localhost** (upstream, log request có replay, webhook inbox, mock callback).
- **API client trên web:** collections, environments, workspace và chia sẻ; request đi thẳng từ trình duyệt, qua proxy hoặc qua Tunelo.
- **Localman MCP** tại `/mcp`: mỗi operation của registry là một MCP tool.
- **Cộng tác:** mời thành viên vào project và magic link.
- **Landing, trang tài khoản và docs người dùng** (`/docs`). Đăng nhập qua `auth.hoandat.com`; mỗi domain đã nhận ở IdP là một tenant ([ADR-0003](docs/decisions/0003-tenant-scoped-data.md)).

**Tunelo:** tunnel `*.tunnel.hoandat.com` tới localhost, gộp vào repo này (xem [`packages/tunelo-cli/README.md`](packages/tunelo-cli/README.md)).

**Sắp có.** Web ẩn nội dung của tính năng chưa phát hành bằng cờ build `VITE_FEATURES` ([`apps/web/src/config/feature-flags.ts`](apps/web/src/config/feature-flags.ts)); [`infra/localman/deploy.sh`](infra/localman/deploy.sh) build với các cờ trong [`infra/localman/released-features`](infra/localman/released-features).

- Live Mock Sync (`liveMockSync`): mock luôn đồng bộ với collection và environment.
- Chia sẻ công khai (guest, nút Run, access key), fork, merge và comment.
- DevOps toolkit: Collection Runner và CLI `localman` để test API trong CI bằng một lệnh, mock tạm, tunnel có SSO, giám sát.

Thứ tự triển khai và trạng thái từng phase: [`plans/dattqh/EXECUTION.md`](plans/dattqh/EXECUTION.md).

## Bắt đầu

Yêu cầu: Node ≥ 22.12, pnpm 11, Docker (để chạy MongoDB).

```bash
pnpm install
cp .env.example .env
docker compose up -d mongo     # MongoDB 7, single-node replica set rs0
pnpm dev                       # web :5173, dashboard API :4000, mock runtime :4100
```

Kiểm tra nhanh: `curl localhost:4000/healthz` và `curl localhost:4100/healthz`.

## Lệnh

| Lệnh | Việc |
|---|---|
| `pnpm dev` | Chạy web và api ở chế độ watch |
| `pnpm build` | Build mọi package |
| `pnpm lint` / `pnpm lint:fix` | Biome lint và format cho toàn repo |
| `pnpm typecheck` | `tsc --noEmit` cho từng package, `scripts/` và `e2e/` |
| `pnpm test` | Vitest cho mọi package (mỗi package là một project) |
| `pnpm e2e` | Playwright trên cả stack (MongoDB trong bộ nhớ, IdP giả); lần đầu cần `pnpm exec playwright install chromium` |
| `pnpm check:mcp-coverage` | Fail khi có operation thiếu MCP tool mà không ghi lý do miễn trừ |
| `pnpm check:tokens` | Fail khi có màu hoặc khoảng cách hardcode ngoài `tokens.css`, hoặc tương phản không đạt |
| `pnpm check:i18n` | Fail khi có chữ tiếng Việt ngoài dictionary `vi` (trừ danh sách file chưa chuyển) hoặc tên đối thủ trong web app; chạy kèm `pnpm lint` |

Các bước CI chạy: [`.github/workflows/ci.yml`](.github/workflows/ci.yml). Lệnh riêng của Tunelo nằm trong [`CLAUDE.md`](CLAUDE.md#tunelo).

## Tài liệu

- [Kiến trúc hệ thống](docs/system-architecture.md)
- [Hợp đồng mock runtime](docs/api-contract.md)
- [Operation registry: REST, MCP và OpenAPI từ một khai báo](docs/operation-registry.md)
- [Deploy production](docs/deployment-guide.md)
- [Design system](docs/design-system.md)
- [UX writing](docs/ux-writing.md)
- [Đa ngôn ngữ (i18n)](docs/i18n.md)
- Quyết định kiến trúc: [`docs/decisions/`](docs/decisions/)
- Tunelo: [`docs/tunelo/`](docs/tunelo/), ADR ở [`docs/decisions/tunelo/`](docs/decisions/tunelo/)
- Domain riêng (tenant): Localman và Tunelo phục vụ `localman.<domain>` và `tunnel.<domain>` của mọi domain đã nhận ở IdP, dữ liệu theo `tenantId` (ADR [`0003-tenant-scoped-data`](docs/decisions/0003-tenant-scoped-data.md), mục "Tenants" của [`docs/tunelo/deployment-guide.md`](docs/tunelo/deployment-guide.md)); hướng dẫn cho chủ domain nằm ở repo `auth-next` (`docs/tenant-owner-guide.md`)
