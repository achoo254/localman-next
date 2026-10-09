# Văn phong copy tiếng Việt của Localman

Checklist cho mọi chữ người dùng thấy: landing, nút, lỗi, toast, modal, `aria-label`. Rút từ copy hiện có trong `apps/web` và `prototype/index.html`. Rà theo thứ tự dưới đây trước khi merge.

## 1. Rõ và ngắn

- [ ] Viết câu hoàn chỉnh, mỗi câu một ý. Ví dụ: "Khai báo resource, sinh dữ liệu giả bằng một click và có ngay endpoint CRUD đầy đủ."
- [ ] Gọi người dùng là "bạn", gọi đội làm sản phẩm là "chúng tôi", gọi sản phẩm là "Localman". Tài khoản IdP gọi là "tài khoản hoandat".
- [ ] Không dùng dấu gạch dài (—) để nối ý trong câu; dùng dấu phẩy, hoặc tách thành câu mới. Dấu "·" chỉ dùng để ngăn metadata ("Gói Free · hết hạn 01/11/2026").
- [ ] Tiêu đề, nút và mục menu viết sentence case: "Bắt đầu miễn phí", "Quản lý gói". Badge và eyebrow viết thường trong source, CSS tự in hoa.
- [ ] Bỏ trạng từ rỗng ("rất", "cực kỳ", "dễ dàng") và từ so sánh tuyệt đối ("nhất", "duy nhất") khi không chứng minh được.
- [ ] Không dùng emoji.

## 2. Thuật ngữ

- [ ] Giữ nguyên tiếng Anh: mock, resource, endpoint, project, schema, field, request, response, collection, environment, workspace, template, proxy, tunnel, token, secret, CRUD, Faker.js, MCP, custom response, object template.
- [ ] Không thêm "s" khi đi sau số hoặc trong câu: "3 project", "10 resource mỗi project". Chỉ dùng số nhiều khi làm tên mục điều hướng ("Projects").
- [ ] "project" luôn là đối tượng trong Localman. Đừng dùng "dự án" ở nơi đang đếm hay nói về project, để người đọc không tưởng là hai thứ khác nhau.
- [ ] Tên field, method Faker, path, query, lệnh CLI đặt trong `code` (font mono) và viết đúng như hệ thống nhận: `name.fullName`, `?sortBy=createdAt&order=desc`, `"$mockData"`.
- [ ] Chính tả theo kiểu bỏ dấu đang dùng trong app: "Huỷ", "Xoá", "tuỳ chọn", "thuỷ".

## 3. Không hứa tính năng chưa có

- [ ] Chỉ mô tả cái đã chạy trên production. Mục gắn cờ trong `apps/web/src/config/features.ts` phải ẩn khi cờ tắt, kể cả mục trong thẻ giá, hàng so sánh, meter và ghi chú ("REST và MCP đều tính" chỉ đúng khi Mock MCP đã bật).
- [ ] "Sắp có" chỉ là badge trong khối "Và nhiều hơn". Không đặt "Sắp có" vào bảng so sánh hay thẻ giá, và không hứa thời điểm ra mắt.
- [ ] Không cam kết số đo chưa đo được ("chỉ mất một phút", "41 ms"); dùng "vài phút" hoặc bỏ đi.
- [ ] Hộp thoại và trang xác nhận chỉ hứa điều hệ thống thật sự làm. Chưa có chức năng trả lời qua chuông thì không viết "phản hồi sẽ hiện trong chuông".
- [ ] Gói Pro không ghi giá và không ghi "chưa chốt"; CTA là "Liên hệ".

## 4. Số liệu

- [ ] Hạn mức đọc từ `limitsFor()` trong `@localman/shared`, không gõ tay. `null` viết thành "Không giới hạn … mỗi tháng"; nếu có rate-limit theo giây thì nói rõ ở ghi chú.
- [ ] Số định dạng vi-VN ("10.000"), ngày `dd/mm/yyyy` qua `formatDate`, chu kỳ viết "mỗi tháng".
- [ ] Số của đối thủ chỉ lấy từ nguồn công khai, nằm trong `apps/web/src/content/competitor-facts.ts`, kèm "Cập nhật dd/mm/yyyy" và link nguồn. Chỉ ghi tên, không dùng logo, không dùng tính từ chê bai.
- [ ] Đối thủ có điểm mạnh thì ghi đúng (ví dụ Postman có code mock giữ trạng thái), không cắt cho lợi mình.

## 5. CTA và nút

- [ ] Bắt đầu bằng động từ, tối đa khoảng 4 từ, nói kết quả: "Bắt đầu miễn phí", "Xem cách hoạt động", "Liên hệ", "Gửi", "Sao chép".
- [ ] Một CTA chính cho mỗi khối. Cùng một hành động thì cùng một chữ ở mọi nơi (đăng ký luôn là "Bắt đầu miễn phí"; header được rút còn "Bắt đầu" vì thiếu chỗ).
- [ ] Hộp thoại có cặp "Huỷ" / hành động cụ thể ("Xoá project", "Mời"); không dùng "OK" hay "Đồng ý".
- [ ] Mục mở trang ngoài (IdP, Telegram) có icon ↗ và chữ sr-only "mở ở tab mới".

## 6. Lỗi, trạng thái, form

- [ ] Lỗi nói chuyện gì xảy ra và làm gì tiếp, không đổ lỗi, không lộ mã nội bộ: "Bạn thử đăng nhập quá nhiều lần, vui lòng đợi một phút rồi thử lại."
- [ ] Lỗi giữ dữ liệu đã nhập thì nói ra: "Nội dung vẫn còn đây, hãy thử lại."
- [ ] Trạng thái đang chạy dùng dấu "…": "Đang tải hạn mức…", "Đang gửi…".
- [ ] Toast thành công ở thì hoàn thành: "Đã lồng comments vào posts."
- [ ] Nhãn trường là danh từ ngắn; trường không bắt buộc thêm "(tuỳ chọn)"; hint giải thích vì sao cần dữ liệu đó ("Chỉ dùng để liên hệ về gói Pro.").
- [ ] Form gửi kèm dữ liệu ngầm (trang đang mở, tên tài khoản) thì ghi ra cho người dùng biết.

## 7. A11y trong chữ

- [ ] `aria-label` viết tiếng Việt, gồm hành động và đối tượng: "Chọn users để di chuyển", "Tài khoản {tên}".
- [ ] Link lặp chữ ("Xem ví dụ") phải có phần sr-only để tên không trùng nhau.
- [ ] Dấu tiếng Việt hiển thị đủ với Inter và JetBrains Mono (subset vietnamese).
