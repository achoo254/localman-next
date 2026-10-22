# ADR-0004: Tài khoản Tunelo đi qua IdP chung `auth.hoandat.com`

- **Ngày:** 2026-10-08 (chốt khi lập kế hoạch; ghi thành ADR ngày 2026-10-23)
- **Trạng thái:** Đã chốt
- **Người quyết định:** dattqh

## Bối cảnh

Trước CLI 1.7.0, Tunelo không có tài khoản. `tunelo login` mở trang Approve của chính server Tunelo,
và **ai có link cũng bấm duyệt được**: không có bước nào kiểm danh tính. Token cấp ra gắn theo máy
(`deviceId`), không theo người, nên:

- không ai trả lời được câu "tunnel này của ai";
- Localman (cùng monorepo, cùng người dùng) không có cách nào liệt kê tunnel của một người dùng để tự
  điền URL công khai cho họ.

Cùng lúc đó hệ `*-next` đã có IdP chung (auth-next, `auth.hoandat.com`) mà Localman đăng nhập qua.
Người dùng Tunelo và người dùng Localman là cùng một người.

Ràng buộc: CLI 1.6.x đang chạy trên nhiều máy (kể cả máy lab chạy tunnel dài hạn) với token ẩn danh;
không được làm chúng chết đột ngột.

## Quyết định

Tunelo không tự quản tài khoản. CLI đăng nhập ở IdP chung bằng OAuth Device Authorization Grant;
server Tunelo chỉ xác minh access token JWT do IdP ký và gắn tunnel với `sub` của tài khoản. Token
ẩn danh cũ được chạy tiếp trong một thời hạn chuyển tiếp, còn máy chưa đăng nhập vẫn chia sẻ được
danh sách tunnel với Localman qua mã liên kết.

Các phần cụ thể, kèm nơi code sở hữu:

- **Đăng nhập CLI:** `tunelo login` chạy device flow (RFC 8628) với client `tunelo-cli`, scope
  `openid offline_access tunnels:open tunnels:read`, `resource` là Tunelo
  (`packages/tunelo-cli/src/idp-client.ts`, `device-login.ts`, `cli-login-command.ts`). Refresh token
  lưu ở `~/.tunelo/config.json`; access token được làm mới trước mỗi lần mở WebSocket
  (`idp-session.ts`).
- **Xác minh ở server:** `jose` với JWKS từ xa của issuer, kiểm `iss`, `aud`, `typ=at+jwt`, `exp`,
  `sub` và scope (`apps/tunelo-server/src/auth/idp-token-verifier.ts`). Phân luồng JWT / token server
  tự cấp nằm ở `auth/token-authenticator.ts`.
- **Hai scope:** `tunnels:open` để mở tunnel, `tunnels:read` để liệt kê
  (`packages/tunelo-shared/src/constants.ts`, `TUNNEL_SCOPES`). Token thiếu scope bị từ chối bằng
  `TUNELO_AUTH_003`.
- **`GET /api/tunnels`:** trả tunnel HTTP và TCP đang sống của người gọi, trên mọi máy của tài khoản
  (`apps/tunelo-server/src/api/tunnel-list-routes.ts`, `tunnel-directory.ts`). Localman không giữ
  token Tunelo nào: nó đổi phiên của người dùng lấy một token `tunnels:read` ngắn hạn qua token
  exchange (RFC 8693) (`apps/api/src/modules/auth/token-exchange.ts`).
- **Mã liên kết cho máy ẩn danh:** `tunelo link <code>` (`packages/tunelo-cli/src/cli-link-command.ts`,
  `apps/tunelo-server/src/api/link-routes.ts`, `services/device-link-service.ts`). Localman mở yêu
  cầu, máy ẩn danh duyệt bằng token của chính nó, Localman nhận một token **chỉ đọc**
  (`tunnels:read`) thấy đúng tunnel của máy đó. Mã sống 10 phút, khoá sau 5 lần sai.
- **Chế độ và thời hạn chuyển tiếp:** `AUTH_MODE=hybrid` (mặc định) nhận cả JWT tài khoản lẫn token
  ẩn danh, và đóng luồng cấp token ẩn danh mới (`TUNELO_DEVICE_004`). Token ẩn danh bị từ chối từ
  `LEGACY_TOKEN_CUTOFF` trở đi (`TUNELO_AUTH_004`). `AUTH_MODE=legacy` là công tắc rollback: tắt nhánh
  IdP, bỏ cutoff (`apps/tunelo-server/src/config/auth-config.ts`).

## Lý do (tại sao)

- **Vá lỗ duyệt ẩn danh tận gốc.** Trang duyệt nằm ở IdP, nơi bắt buộc đăng nhập; Tunelo không còn
  trang nào cấp quyền cho người lạ.
- **Một danh tính cho cả hệ.** Localman và Tunelo cùng tin một issuer, nên "tunnel của tôi" trong
  Localman chỉ là một lần token exchange, không cần đồng bộ tài khoản hay chia sẻ secret giữa hai
  dịch vụ. Trình duyệt đã có phiên IdP (vừa dùng Localman) thì `tunelo login` chỉ còn một cú bấm.
- **Device flow vì CLI chạy cả trên máy không có trình duyệt tại chỗ** (SSH, box lab). Người dùng
  duyệt mã trên bất kỳ thiết bị nào; CLI không bao giờ thấy mật khẩu.
- **Tách `open` và `read`.** Token Localman cầm chỉ cần đọc; nếu lộ, nó không mở được tunnel dưới tên
  người dùng. Cùng lý do đó token liên kết chỉ có `tunnels:read`.
- **Giữ `tunelo link`** vì có máy cố ý không gắn tài khoản (máy dùng chung, CI) mà người dùng vẫn
  muốn thấy trong Localman.
- **Thời hạn chuyển tiếp thay vì cắt ngay**, vì CLI 1.6.x không tự nâng cấp; người dùng cần thời gian
  để chạy `npm i -g tunelo@latest && tunelo login`.

## Đánh đổi & hệ quả

- **Được:** tunnel có chủ (`ownerSub`), giới hạn số tunnel theo tài khoản (claim `max_tunnels`, mặc
  định 3), Localman tự nhận tunnel của người dùng.
- **Mất: phụ thuộc IdP để đăng nhập và để xác minh lần đầu.** IdP hoặc JWKS không với tới được thì
  không đăng nhập mới được và lượt xác minh trả lỗi có thể thử lại; tunnel đang mở không bị cắt vì chỉ
  xác minh lúc bắt tay.
- **Mất: hai luồng xác thực cùng sống** (JWT và token ẩn danh) cho tới khi cutoff đi qua và code
  legacy bị xoá trong một bản CLI/server lớn tiếp theo.
- **Danh sách tunnel nằm trong bộ nhớ của tiến trình.** `GET /api/tunnels` đọc thẳng registry của
  `TunnelManager` và `TcpPortManager`. Đúng khi server chạy một instance (PM2 fork như hiện nay); khi
  scale ra nhiều instance thì mỗi instance chỉ thấy tunnel của mình, và registry phải chuyển sang kho
  dùng chung (Valkey) trước khi chạy song song. Không làm trước vì chưa cần.
- **Rollback có một bước tay:** server cũ không đọc scope và sẽ coi token liên kết là token đầy đủ
  quyền, nên trước khi quay về bản cũ phải thu hồi các token có scope `tunnels:read`.

## Việc còn mở

- **Ngày `LEGACY_TOKEN_CUTOFF` chưa đặt.** Kế hoạch dự tính khoảng 60 ngày sau khi deploy, nhưng ngày
  cụ thể là quyết định của chủ dự án; biến này hiện để trống (`apps/tunelo-server/.env.example`), tức là
  token ẩn danh chưa có hạn. Khi chốt ngày, cập nhật README của CLI và ADR này.

## Phương án đã cân nhắc

- **Tunelo tự có tài khoản (email, mật khẩu, TOTP, portal riêng).** Đây là mô hình v0.3 đã từng có. Loại
  vì nó nhân đôi việc quản lý danh tính mà IdP chung đã làm, và vẫn không cho Localman biết hai tài
  khoản là cùng một người.
- **Giữ trang Approve của Tunelo nhưng bắt đăng nhập ở đó.** Loại vì vẫn phải có danh tính ở đâu đó;
  dựng lại phía Tunelo thì quay về phương án trên.
- **Localman giữ token `tunelo_…` của người dùng để gọi Tunelo.** Loại vì đó là secret dài hạn đầy đủ
  quyền nằm trong một dịch vụ khác; token exchange cho token ngắn hạn, chỉ đọc, không lưu.
- **Cắt token ẩn danh ngay khi phát hành 1.7.0.** Loại vì làm chết tunnel dài hạn trên các máy chưa kịp
  nâng cấp.
