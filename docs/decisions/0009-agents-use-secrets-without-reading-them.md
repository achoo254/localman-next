# ADR-0009: Agent qua MCP dùng được secret nhưng không bao giờ đọc được giá trị

- **Ngày:** 2026-10-24
- **Trạng thái:** Đã chốt. Phía máy chủ đã làm (24/10/2026, sau cổng `SECRET_VAULT_ENABLED`, tắt mặc định); giao diện web chờ user duyệt prototype. User chọn ngày 24/10/2026 ("về việc kho secret, MCP cho phép sử dụng"); Jev chọn hướng "dùng mà không đọc" với xác suất 1,0 trước hai hướng "agent ghi vào kho" và "agent đọc giá trị" (0,0).
- **Người quyết định:** dattqh. Thay quyết định "agent qua MCP ghi giá trị local của biến secret: từ chối" của plan `plans/dattqh/261008-1123-localman-core/phase-21-client-power-ups.md` ở phần dùng secret; phần ghi vẫn từ chối (mục 5).

## Bối cảnh

- Từ 19/10/2026 (`b23ceab`) agent (gọi không có phiên trình duyệt) không bao giờ nhận lại giá trị secret: environment, global, collection, auth, diff changelog và pull request đều bị che. Lý do: agent bị prompt injection không được làm lộ hay trao secret cho người khác.
- `send_request` nhận request đã điền sẵn (url, header, body); máy chủ không thay `{{biến}}`. Vì agent không đọc được secret, thực tế agent không gửi được request nào cần secret.
- Phase 21 thêm kho secret: giá trị local của biến `type=secret` mã hoá bằng passphrase ngay trên trình duyệt (`lmv1:`), máy chủ không giải mã được. Giá trị shared vẫn mã hoá phía máy chủ (phase 13) để chia sẻ cho team.

## Quyết định

1. **Dùng mà không đọc:** agent gửi request có `{{biến}}` kèm environment (và collection nếu biến của collection); máy chủ thay biến rồi gửi. Giá trị thay vào không bao giờ trả về cho agent, kể cả trong lỗi.
2. **Che trong response:** upstream có thể phản hồi lại giá trị (endpoint echo, lỗi in header). Trước khi trả response cho agent, máy chủ thay mọi chỗ chứa giá trị secret đã điền (header, body, `finalUrl`) bằng dấu che giống phần đọc environment. Log proxy không ghi giá trị đã thay.
3. **Giá trị shared** của biến secret dùng được ngay, vì máy chủ giải mã được.
4. **Giá trị trong kho** (chỉ trình duyệt mở được) dùng được chỉ khi user bật **"Cho agent dùng"** cho từng biến. Bật thì trình duyệt (đã mở kho) gửi thêm một bản mã hoá phía máy chủ của đúng giá trị đó; tắt thì máy chủ xoá bản này. Biến đã bật không còn thuộc lời hứa "Secret không rời trình duyệt": giao diện ghi rõ ở công tắc, và trang "Dữ liệu của bạn nằm ở đâu" liệt kê trường hợp này. Đổi giá trị trong kho thì trình duyệt cập nhật luôn bản cho agent.
5. **Chỉ user bật được:** công tắc "Cho agent dùng" và việc ghi giá trị local của biến secret chỉ nhận từ phiên trình duyệt; agent gọi thì bị từ chối, lỗi nói rõ secret nằm trong kho của trình duyệt. Agent bị prompt injection không tự mở quyền cho chính nó.
6. **Quyền:** gửi request vẫn cần `client:send` như hiện nay; thay biến không cần scope mới. Biến chưa bật mà agent tham chiếu thì báo lỗi nêu tên biến và cách bật, không gửi request với chỗ trống.

## Phương án bị loại

- **Agent đọc được giá trị secret:** đảo quyết định 19/10; agent bị prompt injection có thể làm lộ secret.
- **Agent ghi giá trị vào kho:** máy chủ không có passphrase nên phải lưu bản mã phía máy chủ, giá trị đó nằm ngoài kho mà người dùng vẫn tưởng là trong kho.
- **Chỉ secret shared:** giữ trọn lời hứa của kho nhưng secret cá nhân (token của chính mình) thì agent không bao giờ dùng được; user chọn có công tắc từng biến.

## Hệ quả

- Lời hứa "Secret không rời trình duyệt" đúng với mọi biến chưa bật "Cho agent dùng"; câu chữ marketing và trang minh bạch dữ liệu phải nói phần ngoại lệ.
- Che response bắt giá trị nguyên văn và các dạng máy chủ hay kiểu dội lại thường tạo ra (mã hoá URL ở path, query, form; thoát ký tự JSON; mọi kiểu hoa thường). Upstream biến đổi khác (base64, băm, cắt nhỏ) thì không che được; mô tả tool ghi rõ.
- **Rủi ro còn mở (review 24/10, chưa chốt):** agent tự chọn nơi gửi, nên lớp che không ngăn được việc agent gửi secret tới máy chủ của bên thứ ba, hoặc ghi secret vào chỗ lưu (resource của mock, log request) rồi đọc lại ở lần gọi khác. Vì vậy cổng `SECRET_VAULT_ENABLED` chưa được bật cho tới khi user chọn cách xử lý (giới hạn host đích cho từng secret, hay chấp nhận và ghi rõ rủi ro).
- Giá trị local của secret lưu trước khi có vault không được agent dùng; bản cho agent luôn bị che kể cả khi biến thôi là secret, và bị bỏ khi biến thôi là secret.
- Việc cần làm nằm ở plan phase 21 (T5 và T5b).
