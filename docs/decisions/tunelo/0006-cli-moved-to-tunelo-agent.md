# ADR-0006: CLI Tunelo chuyển sang tiến trình máy `tunelo` 2.x của chat-next

- **Ngày:** 2026-11-09
- **Trạng thái:** Đã chốt. Thay phần "dùng độc lập qua gói npm" của [ADR-0005](0005-stay-in-localman-monorepo.md); server và thư viện vẫn ở repo này như ADR-0005.
- **Người quyết định:** dattqh

## Bối cảnh

Trên máy người dùng từng có hai chương trình cùng nói chuyện với hệ sinh thái hoandat: CLI Tunelo 1.x (gói npm
`packages/tunelo-cli`: tunnel HTTP/TCP, inspector, portal cục bộ, MCP) và tiến trình nền `hda` của tiện ích Máy của
tôi trong Chat. Mỗi cái đăng nhập riêng, giữ refresh token riêng. Localman không gọi được `localhost` của máy người
dùng, chỉ đi qua tunnel công khai do người dùng tự mở.

## Quyết định

1. **Một tiến trình máy tên `tunelo` 2.x**, code ở chat-next (`apps/agent`), binary Bun một file, ký minisign, phát hành ở
   GitHub Releases của chat-next với tag `tunelo-v2.*`. Nó nhận toàn bộ lệnh của CLI 1.11 và là tiến trình nền của Máy
   của tôi. Quyết định đầy đủ phía máy: chat-next `docs/adr/0014-tunelo-machine-agent.md`.
2. **Gói CLI cũ dừng ở 1.12.0** (`tunelo-v1.12.0`, `tunelo.tgz`): mọi lệnh chuyển cho binary 2.x với cùng tham số và
   mã thoát; chưa có 2.x thì `tunelo update` chạy script cài 2.x rồi hỏi gỡ gói npm. Không phát hành bản 1.x nào nữa,
   không dùng npm registry.
3. **Không còn portal web.** Binary 2.x chỉ giữ inspector request trên `127.0.0.1` và `tunelo watch`. Phía web của Tunelo
   chỉ còn trang của tunelo-server ở `tunnel.hoandat.com` (giới thiệu, cách cài, danh sách tunnel khi đăng nhập).
4. **Thư viện qua git tag.** `@tunelo/client` và `@tunelo/shared` ở lại repo này, phát hành bằng tag
   `tunelo-client-v*` / `tunelo-shared-v*` (không GitHub Release, không registry); chat-next cài từ tag.
5. **Máy tự liên kết với Localman và nhận request tới localhost.** Sau `tunelo login` (client `tunelo-agent` của
   auth-next, một refresh token cho ba tài nguyên), `tunelo` xin tunelo-server một token liên kết cho chính máy mình
   (`POST /api/links/self`, `apps/tunelo-server/src/api/self-link-routes.ts`) rồi giao cho Localman
   (`POST /tunelo/links/self` với scope `machines:write`, `apps/api/src/modules/tunelo/tunnel-self-link-route.ts`).
   Localman dùng token đó gửi request tới `localhost:<port>` của máy qua đường `/.tunelo/forward` của tunnel máy
   (`LOCAL_FORWARD` trong `packages/tunelo-shared/src/constants.ts`). tunelo-server là cửa kiểm: chỉ token liên kết của
   chủ máy qua được, header `tunelo-*` do client gửi bị bỏ, cổng trong danh sách chặn bị từ chối
   (`apps/tunelo-server/src/local-forward-gate.ts`).

## Lý do (tại sao)

- **Một lần đăng nhập, một token trên máy.** Hai chương trình giữ hai refresh token và hai luồng làm mới; gộp lại thì
  token được niêm phong một chỗ (Keychain/DPAPI) và chỉ một tiến trình làm mới.
- **Không cần Node.js trên máy người dùng.** Binary một file cài bằng script, tự cập nhật; gói npm cần Node 20+ và
  tài khoản npm đang không dùng được.
- **Localman cần một đường tới máy mà không mở thêm tunnel công khai.** Tunnel máy đã chạy sẵn cho kênh E2E của Chat;
  thêm đường `/.tunelo/forward` có cửa kiểm ở server rẻ hơn một tunnel thứ hai và không tốn thêm hạn mức.
- **Portal cục bộ đã hỏng từ 1.x** (gọi API server không còn) và trùng với trang `tunnel.hoandat.com`; giữ nó là thêm
  bề mặt tấn công trên loopback mà không ai dùng.
- **Server và thư viện ở lại đây** vì lý do của ADR-0005 (hợp đồng chéo với Localman đổi trong một commit); chỉ phần
  chạy trên máy người dùng chuyển đi.

## Đánh đổi & hệ quả

- Được: một tiến trình, một lần đăng nhập; Localman (web và MCP) gọi được `localhost` của máy chủ tài khoản.
- Mất: đổi giao thức tunnel giờ cần phát hành ở hai repo — tag thư viện ở đây rồi nâng phụ thuộc và phát hành binary ở
  chat-next. Server phải tương thích ngược với binary cũ lẫn CLI 1.x còn chạy.
- **Thứ tự deploy cố định:** tunelo-server có cửa kiểm `/.tunelo/forward` phải chạy trước khi bất kỳ `tunelo` nào bật
  chuyển tiếp; Localman (api + nginx route `/tunelo/links/self`) phải chạy trước khi phát hành binary tự liên kết
  ([deployment-guide](../../tunelo/deployment-guide.md#thứ-tự-deploy-khi-đổi-hợp-đồng-với-tunelo-2x)).
- `releases/latest` của repo này phải luôn là `tunelo-v1.12.0`: CLI 1.11 trở về trước đọc nó để lên 1.12.
- Hợp đồng chéo mới ngoài import: `POST|GET /api/links/self`, header `Tunelo-Access`, `Tunelo-Local-Port`,
  `Tunelo-Forward-Granted`, tính năng `local-forward` trong `auth-result`, mã lỗi `TUNELO_FORWARD_*`.
- Dọn sau nghiệm thu: xoá `packages/tunelo-cli`, `scripts/tunelo/build-client.ts`, `.github/workflows/tunelo-release.yml`
  (release `tunelo-v1.12.0` giữ nguyên).

## Phương án đã cân nhắc

- **Giữ CLI 1.x song song với tiến trình máy:** loại vì hai lần đăng nhập, hai refresh token và hai luồng làm mới tranh nhau.
- **Tunnel riêng thứ hai cho Localman:** loại vì tốn hạn mức và thêm một kết nối thường trực mỗi máy.
- **Đổi JWT của người dùng lấy quyền forward (token exchange):** loại; Localman dùng token liên kết của chủ máy, không client
  nào cần scope truy cập tunnel riêng.
- **Giữ portal web cục bộ:** loại theo quyết định của chủ sản phẩm; trang `tunnel.hoandat.com` đủ dùng.
