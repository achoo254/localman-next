# ADR-0009: Agent qua MCP dùng được secret nhưng không bao giờ đọc được giá trị

- **Ngày:** 2026-10-24
- **Trạng thái:** Đã chốt. Phía máy chủ đã làm (24/10/2026, sau cổng `SECRET_VAULT_ENABLED`, tắt mặc định); giao diện web chờ user duyệt prototype. Sửa sau review cùng ngày: secret chỉ đi tới host user cho phép (mục 3, 4, 7). User chọn ngày 24/10/2026 ("về việc kho secret, MCP cho phép sử dụng"); Jev chọn hướng "dùng mà không đọc" với xác suất 1,0 trước hai hướng "agent ghi vào kho" và "agent đọc giá trị" (0,0).
- **Người quyết định:** dattqh. Thay quyết định "agent qua MCP ghi giá trị local của biến secret: từ chối" của plan `plans/dattqh/261008-1123-localman-core/phase-21-client-power-ups.md` ở phần dùng secret; phần ghi vẫn từ chối (mục 5).

## Bối cảnh

- Từ 19/10/2026 (`b23ceab`) agent (gọi không có phiên trình duyệt) không bao giờ nhận lại giá trị secret: environment, global, collection, auth, diff changelog và pull request đều bị che. Lý do: agent bị prompt injection không được làm lộ hay trao secret cho người khác.
- `send_request` nhận request đã điền sẵn (url, header, body); máy chủ không thay `{{biến}}`. Vì agent không đọc được secret, thực tế agent không gửi được request nào cần secret.
- Phase 21 thêm kho secret: giá trị local của biến `type=secret` mã hoá bằng passphrase ngay trên trình duyệt (`lmv1:`), máy chủ không giải mã được. Giá trị shared vẫn mã hoá phía máy chủ (phase 13) để chia sẻ cho team.

## Quyết định

1. **Dùng mà không đọc:** agent gửi request có `{{biến}}` kèm environment (và collection nếu biến của collection); máy chủ thay biến rồi gửi. Giá trị thay vào không bao giờ trả về cho agent, kể cả trong lỗi.
2. **Che trong response:** upstream có thể phản hồi lại giá trị (endpoint echo, lỗi in header). Trước khi trả response cho agent, máy chủ thay mọi chỗ chứa giá trị secret đã điền (header, body, `finalUrl`) bằng dấu che giống phần đọc environment. Log proxy không ghi giá trị đã thay.
3. **Mọi secret cần user bật "Cho agent dùng" cho từng biến, kèm danh sách host** (shared lẫn local; user chọn 24/10/2026 sau review, Jev 0,84). Mỗi người bật cho agent của chính mình (`agent_secret_uses`: người, scope, tên biến, host). Secret chỉ được điền khi host của URL đã điền khớp một host trong danh sách (`api.example.com`, hoặc `*.example.com` cho subdomain); thiếu thì 409 `AGENT_USE_REQUIRED`, sai host thì 409 `AGENT_HOST_NOT_ALLOWED`.
4. **Giá trị trong kho** (chỉ trình duyệt mở được) ngoài điều kiện ở mục 3 còn cần bản cho agent: bật thì trình duyệt (đã mở kho) gửi thêm một bản mã hoá phía máy chủ của đúng giá trị đó; tắt thì máy chủ xoá bản này. Biến đã bật không còn thuộc lời hứa "Secret không rời trình duyệt": giao diện ghi rõ ở công tắc, và trang "Dữ liệu của bạn nằm ở đâu" liệt kê trường hợp này. Đổi giá trị trong kho thì trình duyệt cập nhật luôn bản cho agent.
5. **Chỉ user bật được:** công tắc "Cho agent dùng" và việc ghi giá trị local của biến secret chỉ nhận từ phiên trình duyệt; agent gọi thì bị từ chối, lỗi nói rõ secret nằm trong kho của trình duyệt. Agent bị prompt injection không tự mở quyền cho chính nó.
6. **Quyền:** gửi request vẫn cần `client:send` như hiện nay; thay biến không cần scope mới. Biến chưa bật mà agent tham chiếu thì báo lỗi nêu tên biến và cách bật, không gửi request với chỗ trống.
7. **Không bao giờ tới host của chính Localman:** host mock, host Tunelo và host của app (mọi tenant) không được đưa vào danh sách (400) và không bao giờ nhận secret đã điền, kể cả khi request tới localhost được chuyển qua tunnel: mock lưu lại thứ nó nhận và Tunelo hiện traffic, nơi agent có thể đọc lại. Redirect chỉ được theo khi host mới cũng đạt điều kiện của mọi secret đã điền; không thì trả chính phản hồi 3xx.

## Phương án bị loại

- **Agent đọc được giá trị secret:** đảo quyết định 19/10; agent bị prompt injection có thể làm lộ secret.
- **Agent ghi giá trị vào kho:** máy chủ không có passphrase nên phải lưu bản mã phía máy chủ, giá trị đó nằm ngoài kho mà người dùng vẫn tưởng là trong kho.
- **Chỉ secret shared:** giữ trọn lời hứa của kho nhưng secret cá nhân (token của chính mình) thì agent không bao giờ dùng được; user chọn có công tắc từng biến.
- **Secret shared dùng được ngay, không giới hạn host** (bản đầu của quyết định này): review 24/10 chỉ ra agent tự chọn URL nên có thể gửi secret tới máy chủ của bên thứ ba, hoặc ghi vào mock rồi đọc lại; lớp che không chặn được. Thay bằng mục 3 và 7.
- **Chấp nhận rủi ro và ghi rõ** (Jev 0,01), **bỏ hẳn việc agent dùng secret** (0,02).

## Hệ quả

- Lời hứa "Secret không rời trình duyệt" đúng với mọi biến chưa bật "Cho agent dùng"; câu chữ marketing và trang minh bạch dữ liệu phải nói phần ngoại lệ.
- Che response bắt giá trị nguyên văn và các dạng máy chủ hay kiểu dội lại thường tạo ra (mã hoá URL ở path, query, form; thoát ký tự JSON; mọi kiểu hoa thường). Upstream biến đổi khác (base64, băm, cắt nhỏ) thì không che được; mô tả tool ghi rõ.
- **Rủi ro còn lại:** một host user cho phép mà tự lưu và cho đọc lại dữ liệu (hoặc có open redirect giữ nguyên header) vẫn có thể làm lộ secret qua agent; user nên chỉ cho phép đúng API cần dùng.
- Giá trị local của secret lưu trước khi có vault không được agent dùng; bản cho agent luôn bị che kể cả khi biến thôi là secret, và bị bỏ khi biến thôi là secret.
- Việc cần làm nằm ở plan phase 21 (T5 và T5b).
