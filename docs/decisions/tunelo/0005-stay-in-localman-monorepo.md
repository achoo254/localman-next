# ADR-0005: Tunelo ở lại monorepo `localman-next`, dùng độc lập qua gói npm

- **Ngày:** 2026-10-26
- **Trạng thái:** Đã chốt
- **Người quyết định:** dattqh

## Bối cảnh

Tunelo dùng được ngoài Localman: bất kỳ dự án nào cần đưa `localhost` ra HTTPS (webhook, demo, box lab
chạy tunnel dài hạn như OneDash staging). Câu hỏi đặt ra là có nên tách Tunelo khỏi `localman-next`
thành repo riêng hay không.

Hiện trạng khi quyết định:

- Tunelo **từng là repo riêng** (`achoo254/tunelo`), được gộp vào monorepo ngày 2026-10-08 (giữ lịch
  sử, tag cũ đổi thành `tunelo-v*`); repo cũ đã xoá khỏi GitHub ngày 2026-10-17.
- CLI phát hành công khai trên npmjs với tên `tunelo` (1.9.1 ngày 2026-10-19). Người dùng cài
  `npm install -g tunelo`, không cần clone repo nào. (Cập nhật 27/10/2026: từ 1.10.0 CLI phát hành ở
  GitHub Releases của repo này, không còn trên npm; xem `docs/tunelo/deployment-guide.md`.)
- Trong monorepo Tunelo đã có thư mục, lệnh build/test/deploy, workflow release (`tunelo-v*`), tài liệu
  và ADR riêng.
- Hai sản phẩm gắn nhau ở ba chỗ:
  - `apps/tunelo-server` dùng `@localman/tenancy` (allowlist host, tenant scope, usage);
  - tài khoản đi qua IdP chung `auth.hoandat.com`, Localman liệt kê tunnel theo tài khoản
    ([ADR-0004](0004-accounts-via-central-idp.md));
  - `apps/api/src/modules/mock-runtime/upstream-tunelo.ts` nhận dạng đúng từng chuỗi lỗi do server
    và CLI Tunelo trả về.

## Quyết định

Giữ Tunelo trong `localman-next`. Dùng ngoài Localman đi qua gói npm `tunelo` và server
`tunnel.hoandat.com`. Ranh giới được giữ bằng `pnpm check:tunelo-boundary` (chạy trong `pnpm lint`):
`packages/tunelo-cli` và `packages/tunelo-shared` không import gói `@localman/*` nào,
`apps/tunelo-server` chỉ import `@localman/tenancy`, và không import tương đối ra ngoài gói của mình.

## Lý do (tại sao)

- **Mục tiêu "dùng cho case khác" đã đạt mà không cần tách repo.** Người dùng tiêu thụ CLI từ npm;
  repo chỉ là nơi phát triển.
- **Hợp đồng chéo đổi được trong một commit.** Chuỗi lỗi relay, scope IdP và API liệt kê tunnel do cả
  hai sản phẩm cùng đọc; tách repo biến mỗi thay đổi thành hai bản phát hành phải khớp phiên bản.
- **Tách phải publish thêm `@localman/tenancy`** (hoặc nhân bản nó) và dựng lại CI riêng. Với một người
  vận hành cùng AI agent, đó là chi phí thường xuyên mà không mở thêm khả năng nào.
- Jev tư vấn (2026-10-26, cùng các sự thật trên): giữ monorepo và củng cố ranh giới 0,93; giữ nay, tách
  khi có người tự host thật 0,06; giữ nguyên không làm gì 0,01; tách lại repo 0,00.

## Đánh đổi & hệ quả

- Được: một CI, một lần review cho thay đổi chạm cả hai bên; dự án khác dùng Tunelo không phải biết
  Localman tồn tại.
- Mất: ai muốn **tự host server** Tunelo phải clone cả monorepo, và server vẫn cần IdP kiểu
  `auth.<domain>` cùng gói tenancy.
- Check ranh giới chỉ nhìn import. Các hợp đồng chéo không đi qua import, phải đổi ở cả hai bên trong
  cùng một commit:
  - chuỗi lỗi relay (`Tunnel not found: <label>`, `Bad Gateway`, `Gateway Timeout`,
    `Local service unavailable`, …) mà Localman nhận dạng trong
    `apps/api/src/modules/mock-runtime/upstream-tunelo.ts`;
  - `GET /api/tunnels` cùng scope `tunnels:read` (`apps/tunelo-server/src/api/tunnel-list-routes.ts`,
    [ADR-0004](0004-accounts-via-central-idp.md)), Localman đọc bằng token đổi ở IdP;
  - luồng `tunelo link <code>` (`apps/tunelo-server/src/api/link-routes.ts`) mà Localman hiện cho máy
    chưa có tài khoản.

## Khi nào xem lại

Tách thành repo riêng khi có một người hoặc dự án thật cần tự host server Tunelo không gắn với
`hoandat.com`. Khi đó làm trước hai việc, vì tách repo một mình không giải quyết được:

1. Gỡ `@localman/tenancy` khỏi `apps/tunelo-server` (đưa phần allowlist host vào `tunelo-server`, hoặc
   publish gói tenancy).
2. Cho phép server chạy với IdP bất kỳ hỗ trợ device flow và JWKS, không giả định `auth.<domain>`.

## Phương án đã cân nhắc

- **Tách lại repo ngay:** loại vì đảo quyết định gộp 2026-10-08 mà không thêm khả năng nào cho người dùng.
- **Giữ nguyên, không thêm check:** loại vì không có gì chặn code Localman lan vào CLI, khiến việc tách
  sau này đắt dần.
