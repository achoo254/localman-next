# Localman (next)

Monorepo của bộ công cụ API Localman và Tunelo, chạy tại <https://localman.hoandat.com>. Một app trong hệ sinh thái hoandat, đăng nhập qua IdP `auth-next` (`auth.hoandat.com`).

- **Localman:** mock API có trạng thái (cùng loại với mockapi.io), API client trên web, MCP cho cả Localman lẫn từng mock project, công cụ dữ liệu giả kiểu Việt Nam. Hợp đồng mock runtime: [docs/api-contract.md](docs/api-contract.md).
- **Tunelo:** tunnel tự host đưa dịch vụ localhost ra HTTPS qua subdomain wildcard, gộp vào repo này. CLI: [packages/tunelo-cli/README.md](packages/tunelo-cli/README.md); tài liệu riêng: [docs/tunelo/](docs/tunelo/).
- **App iPhone và Android:** vỏ Capacitor (`apps/mobile`) bọc toàn bộ web app — [docs/mobile-app.md](docs/mobile-app.md).

## Quyết định và ràng buộc

- **Đơn tenant.** Localman và Tunelo chỉ phục vụ host của `hoandat.com` cấu hình trong env, host khác nhận 421. Dữ liệu vẫn mang `tenantId: "primary"`, không migrate ([ADR-0003](docs/decisions/0003-tenant-scoped-data.md), superseded, mục "Sau khi bỏ đa tenant").
- **Chưa thương mại.** Web không hiện giá hay gói; mọi tài khoản tự nhận Pro 30 ngày, backend hạn mức vẫn giữ để bật lại được ([ADR-0002](docs/decisions/0002-no-commercial-ui-automatic-pro-period.md)).
- **Tính năng chỉ hiện khi đã phát hành.** Web bật tính năng bằng cờ build `VITE_FEATURES` ([`apps/web/src/config/feature-flags.ts`](apps/web/src/config/feature-flags.ts)); danh sách cờ đang chạy production là [`infra/localman/released-features`](infra/localman/released-features), file mà [`infra/localman/deploy.sh`](infra/localman/deploy.sh) đọc khi build.
- **Một khai báo cho REST, MCP và OpenAPI.** API nghiệp vụ khai qua operation registry, mỗi operation là một MCP tool hoặc có lý do miễn trừ ([docs/operation-registry.md](docs/operation-registry.md)).
- **Tên sản phẩm ở một file.** Tên, bundle id và mẫu host chỉ khai trong [`brand.config.json`](brand.config.json), mã thương hiệu nằm ở gói dùng chung `@shared-next/brand` ([ADR-0006](docs/decisions/0006-brand-config-and-product-name.md)).
- **MongoDB chạy replica set** vì sinh dữ liệu resource cần transaction nhiều document ([ADR-0001](docs/decisions/0001-resource-data-in-project-transactions.md)); bản dev là service `mongo` trong [`docker-compose.yml`](docker-compose.yml).

## Bắt đầu

Yêu cầu: Node và pnpm theo `engines`/`packageManager` trong [`package.json`](package.json), Docker để chạy MongoDB.

```bash
pnpm install
cp .env.example .env
docker compose up -d mongo
pnpm dev
```

Biến môi trường và giải thích nằm trong [`.env.example`](.env.example); cổng mặc định của api ở `apps/api/src/config/env.ts`.

Lệnh của repo: `scripts` trong [`package.json`](package.json); quy ước chạy test (máy dev chỉ chạy test liên quan, bộ đầy đủ chạy trên CI) và lệnh riêng của Tunelo ở [`CLAUDE.md`](CLAUDE.md). Các bước CI: [`.github/workflows/ci.yml`](.github/workflows/ci.yml) (mỗi push: lint, typecheck, unit/API test, build, E2E smoke); E2E đầy đủ chạy hằng đêm ở [`.github/workflows/e2e-nightly.yml`](.github/workflows/e2e-nightly.yml).

## Tài liệu

- [Kiến trúc hệ thống](docs/system-architecture.md)
- [Hợp đồng mock runtime](docs/api-contract.md)
- [Operation registry](docs/operation-registry.md)
- [Deploy production](docs/deployment-guide.md)
- [App iOS và Android](docs/mobile-app.md)
- [Design system](docs/design-system.md), [UX writing](docs/ux-writing.md), [Đa ngôn ngữ (i18n)](docs/i18n.md)
- Quyết định kiến trúc: [docs/decisions/](docs/decisions/); Tunelo: [docs/decisions/tunelo/](docs/decisions/tunelo/)
- Thứ tự triển khai các phase (bản ghi kế hoạch): [plans/dattqh/EXECUTION.md](plans/dattqh/EXECUTION.md)
