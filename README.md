# Localman (next)

Monorepo của bộ công cụ API Localman và Tunelo.

## Trạng thái

Đang chạy production tại <https://localman.hoandat.com>:

- **Mock API có trạng thái**, tương đương mockapi.io: project, resource lồng nhau, dữ liệu Faker, custom response. Mock runtime công khai ở `https://{secret}.localman.hoandat.com{prefix}`.
- **Cộng tác:** mời thành viên vào project và magic link.
- **Landing, bảng giá, trang tài khoản và docs người dùng** (`/docs`). Đăng nhập qua `auth.hoandat.com`.

**Tunelo:** tunnel `*.tunnel.hoandat.com` tới localhost, gộp vào repo này (xem [`packages/tunelo-cli/README.md`](packages/tunelo-cli/README.md)).

**Sắp có.** Web ẩn nội dung của tính năng chưa phát hành bằng cờ build `VITE_FEATURES` ([`apps/web/src/config/feature-flags.ts`](apps/web/src/config/feature-flags.ts)); [`infra/localman/deploy.sh`](infra/localman/deploy.sh) mặc định build với danh sách cờ rỗng.

- API client chạy trên web, tương đương Collections và Environments của Postman (cờ `apiClient`; gửi thẳng từ trình duyệt là `directMode`, proxy và Tunelo làm đường dự phòng).
- Live Mock Sync (`liveMockSync`), Mock MCP (`mockMcp`), mock lai localhost (`hybridMock`).
- MCP server cho mọi tính năng: operation registry đã sinh MCP tool descriptor cho mọi operation, chưa có server MCP chạy.
- DevOps toolkit: test API trong CI bằng một lệnh, mock tạm, tunnel có SSO, giám sát.

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
