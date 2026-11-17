# ADR-0008: Gỡ đường Localman gọi `localhost` của máy

- **Ngày:** 2026-11-17
- **Trạng thái:** Đã chốt. Thay phần "máy tự liên kết Localman và Localman gửi tới `localhost` của máy" của
  [ADR-0006](0006-cli-moved-to-tunelo-agent.md) và phần "máy chỉ liên kết Localman qua `tunelo login`" của
  [ADR-0007](0007-retire-code-linking.md); phần còn lại của hai ADR giữ nguyên.
- **Người quyết định:** dattqh

## Bối cảnh

Từ ADR-0006, `tunelo` 2.x sau `tunelo login` xin tunelo-server một link token cho máy mình rồi giao cho
Localman. Localman dùng token đó để liệt kê tunnel của máy và gửi request tới `localhost:<cổng>` của máy qua
đường chuyển tiếp trên tunnel máy; tunelo-server là cửa kiểm, máy có công tắc bật tắt, Localman web có công tắc
từng máy, bộ chọn cổng, và `send_request` của MCP có tham số `machine`.

AI Agent chạy trên máy đã tự gọi `localhost`, tự nối MCP và mở trình duyệt được, nên Localman làm trung gian là
thừa. Thứ tính năng còn để lại chỉ là bề mặt cloud → máy: một link token lộ, hay một prompt injection qua MCP
của Localman, là đường tới cổng nội bộ của máy người dùng.

## Quyết định

Gỡ hẳn, không giữ code ngủ, không tương thích ngược (chưa có người dùng ngoài).

- **tunelo-server:** bỏ cửa kiểm và đường chuyển tiếp, route cấp và đọc link token của máy thuộc tài khoản,
  tính năng báo cho máy trong `auth-result`. `GET /api/links` và `DELETE /api/links/:id` chỉ còn cho máy ẩn
  danh với liên kết bằng mã cũ; link token cũ của máy thuộc tài khoản không liệt kê tunnel nào. Header
  `tunelo-*` khách gửi vẫn bị bỏ trước khi tới mọi tunnel (trước đây chỉ tunnel máy bỏ hết).
- **Localman API và MCP:** bỏ operation liệt kê máy, liệt kê cổng, bật tắt từng máy; bỏ tham số `machine` của
  `send_request`, route `POST /tunelo/links/self` và location nginx của nó; tunnel theo cổng không còn nguồn
  `machine`.
- **Localman web:** bỏ công tắc, bộ chọn cổng, hướng dẫn thêm máy; Settings > Tunelo chỉ hiện máy liên kết bằng
  mã còn lại.
- **`@tunelo/shared`, `@tunelo/client`:** bỏ hằng, hàm, header của đường chuyển tiếp và hàm liên kết máy.
- **Giữ:** Localman gọi tunnel công khai của tài khoản (người dùng tự mở tunnel), liên kết bằng mã cũ, nhóm
  MCP và OAuth để `tunelo` trên máy gọi Localman.

## Đánh đổi & hệ quả

- Được: không còn đường nào từ cloud vào `localhost` của máy; bớt một hợp đồng chéo giữa ba repo.
- Mất: `send_request` của agent không còn tự thấy tunnel của tài khoản (token agent không đổi được phiên lấy
  token tài khoản); agent dùng ánh xạ URL tunnel đã lưu, hoặc gửi thẳng tới URL tunnel.
- Dữ liệu cũ: dòng `tunelo_links` nguồn `self` ở Localman và link token tương ứng ở tunelo-server còn nằm
  trong DB tới khi dọn riêng (có sao lưu trước). Localman không liệt kê, không gọi Tunelo bằng chúng; xoá tài
  khoản vẫn thu hồi và xoá.
- Thứ tự deploy: phát hành `tunelo` mới trước (thôi phục vụ chuyển tiếp, thôi tự liên kết), rồi tunelo-server,
  rồi Localman. Máy cũ chưa cập nhật không nhận tính năng từ server mới nên không phục vụ đường chuyển tiếp.
- Rollback: deploy lại bản trước của từng phần theo thứ tự ngược lại.
