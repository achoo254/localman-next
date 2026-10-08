# Localman (next)

Bộ công cụ API cho lập trình viên và DevOps tại `localman.hoandat.com`:

- **Mock API có trạng thái**, tương đương mockapi.io: project, resource lồng nhau, dữ liệu Faker, custom response. Có thêm Mock lai localhost và Mock MCP.
- **API client chạy trên web**, tương đương phần Collections và Environments của Postman (gồm cả chia sẻ). Request mặc định gửi thẳng từ trình duyệt; proxy và Tunelo làm đường dự phòng.
- **Tunelo:** mở tunnel `*.tunnel.hoandat.com` tới localhost (gộp vào repo này, xem [`packages/tunelo-cli/README.md`](packages/tunelo-cli/README.md)).
- **MCP** cho mọi tính năng; đăng nhập một lần qua `auth.hoandat.com`.
- **DevOps toolkit:** test API trong CI bằng một lệnh, mock tạm, tunnel có SSO, giám sát.

Thứ tự triển khai và trạng thái từng phase: [`plans/dattqh/EXECUTION.md`](plans/dattqh/EXECUTION.md).

## Bắt đầu

Yêu cầu: Node ≥ 22, pnpm 11, Docker (để chạy MongoDB).

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
| `pnpm typecheck` | `tsc --noEmit` cho từng package và thư mục `scripts/` |
| `pnpm test` | Vitest cho mọi package (mỗi package là một project) |
| `pnpm check:mcp-coverage` | Fail khi có operation thiếu MCP tool mà không ghi lý do miễn trừ |
| `pnpm check:tokens` | Fail khi có màu hoặc khoảng cách hardcode ngoài `tokens.css`, hoặc tương phản không đạt |

Lệnh riêng của Tunelo nằm trong [`CLAUDE.md`](CLAUDE.md#tunelo).

## Tài liệu

- [Kiến trúc hệ thống](docs/system-architecture.md)
- [Operation registry: REST, MCP và OpenAPI từ một khai báo](docs/operation-registry.md)
- [Design system](docs/design-system.md)
- Tunelo: [`docs/tunelo/`](docs/tunelo/), ADR ở [`docs/decisions/tunelo/`](docs/decisions/tunelo/)
