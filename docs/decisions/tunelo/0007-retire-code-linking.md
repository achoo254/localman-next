# ADR-0007: Bỏ liên kết máy bằng mã; máy chỉ liên kết Localman qua `tunelo login`

- **Ngày:** 2026-11-12
- **Trạng thái:** Đã chốt. Thay phần "Mã liên kết cho máy ẩn danh" và lý do "giữ mã liên kết" của
  [ADR-0004](0004-accounts-via-central-idp.md); phần còn lại của ADR-0004 giữ nguyên.
- **Người quyết định:** dattqh

## Bối cảnh

ADR-0004 giữ một luồng mã liên kết cho máy không gắn tài khoản: Localman mở yêu cầu ở tunelo-server
(`POST /api/links/init`), người dùng gõ mã trên máy ẩn danh (`/approve`), Localman nhận một token chỉ đọc
(`/poll`). Lý do khi đó là có máy cố ý không đăng nhập (máy dùng chung, CI) mà người dùng vẫn muốn thấy
tunnel trong Localman.

Từ ADR-0006, `tunelo` 2.x tự liên kết máy với Localman sau `tunelo login` (`POST /api/links/self` rồi
`POST /tunelo/links/self`). Tunelo 3.0 (chat-next ADR-0013, ADR-0014) lấy tài khoản làm mỏ neo tin cậy:
cài một dòng lệnh, `tunelo login` làm hết việc đăng ký máy, và CLI bỏ lệnh liên kết bằng mã. Phía Localman
còn lại một luồng không có máy nào gọi tới: modal "Liên kết máy", hai operation `client.startTunnelLink` và
`client.pollTunnelLink`, ba route mã ở tunelo-server và model `LinkRequest`.

## Quyết định

Bỏ hẳn liên kết máy bằng mã ở Localman và tunelo-server. Máy chỉ liên kết với Localman qua `tunelo login`
cùng tài khoản; máy không gắn tài khoản (CI, máy dùng chung) không còn dùng được Localman qua tunelo.

- **tunelo-server:** bỏ `POST /api/links/init`, `/approve`, `/poll`, model `LinkRequest`, hàm cấp token mã.
  Giữ `POST|GET /api/links/self`, `GET /api/links`, `DELETE /api/links/self`, `DELETE /api/links/:id`
  (`tunelo logout` gỡ liên kết qua danh sách và thu hồi).
- **Localman API:** bỏ `client.startTunnelLink`, `client.pollTunnelLink`, hạn mức `tuneloLink`; giữ
  `client.listTunnelLinks`, `client.deleteTunnelLink`, `client.setMachineForward` và
  `POST /tunelo/links/self`. Gợi ý lỗi chỉ còn `tunelo login`.
- **Localman web:** Settings > Tunelo thay nút "Liên kết máy" bằng hướng dẫn: chạy lệnh cài ở trang
  "Thêm máy này" của Chat (`https://chat.<domain>/ai/add`), rồi `tunelo login`; máy tự hiện trong danh sách.
- **Dữ liệu:** không xoá gì, không migration. Dòng `tunelo_links` và link token cũ của luồng mã (nguồn
  `pairing`) vẫn liệt kê, dùng và gỡ được tới khi người dùng xoá. Trường `requestId`, `pendingUntil` và
  trạng thái `pending` bỏ khỏi schema; chỉ mục TTL `pendingUntil` đã có trong DB tự dọn dòng chờ còn sót,
  mọi truy vấn chỉ đọc `linked`. Collection `linkrequests` của tunelo-server để nguyên.

## Lý do (tại sao)

- **Không còn ai dùng.** Tunelo 3.0 không có lệnh liên kết bằng mã, nên modal của Localman chỉ hiện một mã
  không máy nào nhập được.
- **Bớt bề mặt tấn công.** `POST /api/links/init` không cần xác thực và chỉ bị giới hạn theo IP; bỏ nó là bỏ
  một đường cấp token mà máy ẩn danh duyệt.
- **Một đường liên kết.** Mọi máy liên kết đều có chủ (`linkedOwnerSub`), đi qua cửa kiểm chuyển tiếp
  localhost và thu hồi theo tài khoản; không phải giữ hai mô hình tin cậy song song.
- **Người dùng chọn bỏ cả bên Localman** (12/11/2026) thay vì giữ lệnh ẩn chỉ cho máy không đăng nhập.

## Đánh đổi & hệ quả

- Được: bớt hai operation, một model, ba route và một modal; hướng dẫn trong Localman khớp cách cài mới.
- Mất: máy CI hay máy dùng chung không đăng nhập không còn đưa tunnel vào Localman. Cách thay thế là dán
  tay URL tunnel trong Settings > Tunelo (ánh xạ thủ công vẫn còn).
- Rollback: deploy lại bản Localman và tunelo-server trước; chỉ máy 2.x còn lệnh liên kết bằng mã.
- Thứ tự deploy: Localman và tunelo-server sau Chat của Tunelo 3.0; Localman cũ gọi `/api/links/init` vào
  tunelo-server mới thì nhận 404 và báo `TUNELO_UNAVAILABLE`, không hỏng dữ liệu.

## Phương án đã cân nhắc

- **Giữ lệnh liên kết ẩn cho máy không đăng nhập:** loại theo quyết định của người dùng; Jev cân hai bên gần
  như ngang (0,52/0,48).
- **Xoá dòng `tunelo_links` và link token cũ:** loại; đã chốt để nguyên, người dùng tự gỡ trong Settings.
