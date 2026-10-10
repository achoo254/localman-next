# Văn phong copy của Localman

Checklist cho mọi chữ người dùng thấy: landing, nút, lỗi, toast, modal, `aria-label`. Giao diện có ba ngôn ngữ (`docs/i18n.md`): English là nguồn và mặc định, rồi 中文 giản thể và Tiếng Việt. Mục 1–7 là quy tắc chung, viết với ví dụ tiếng Việt rút từ copy hiện có; mục 8 và 9 là phần riêng cho English và 中文. Rà theo thứ tự trước khi merge.

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

- [ ] Chỉ mô tả cái đã chạy trên production. Mục gắn cờ trong `apps/web/src/config/features.ts` phải ẩn khi cờ tắt, kể cả mục trong thẻ giá, meter và ghi chú ("REST và MCP đều tính" chỉ đúng khi Mock MCP đã bật).
- [ ] "Sắp có" chỉ là badge trong khối "Và nhiều hơn". Không đặt "Sắp có" vào thẻ giá, và không hứa thời điểm ra mắt.
- [ ] Không cam kết số đo chưa đo được ("chỉ mất một phút", "41 ms"); dùng "vài phút" hoặc bỏ đi.
- [ ] Hộp thoại và trang xác nhận chỉ hứa điều hệ thống thật sự làm. Chưa có chức năng trả lời qua chuông thì không viết "phản hồi sẽ hiện trong chuông".
- [ ] Gói Pro không ghi giá và không ghi "chưa chốt"; CTA chính là "Dùng thử 30 ngày" (mỗi tài khoản một lần), kèm câu "Chưa mở gói trả phí"; form quan tâm chỉ là link phụ.

## 4. Số liệu

- [ ] Hạn mức đọc từ `limitsFor()` trong `@localman/shared`, không gõ tay. `null` viết thành "Không giới hạn … mỗi tháng"; nếu có rate-limit theo giây thì nói rõ ở ghi chú.
- [ ] Số và ngày định dạng qua `formatNumber` / `formatDate` của `useI18n()` (theo ngôn ngữ đang chọn): vi là "10.000" và `dd/mm/yyyy`, en "10,000" và "Oct 9, 2026", zh-CN "10,000" và "2026年10月9日". Số trong `t()` tự định dạng. Chu kỳ viết "mỗi tháng" / "per month" / "每月".
- [ ] Không nêu tên sản phẩm khác (đối thủ) ở bất kỳ chữ nào người dùng thấy, kể cả title và meta của `index.html`; `pnpm check:i18n` chặn các tên đã biết.

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

- [ ] `aria-label` lấy từ `t()` như mọi chữ khác (theo ngôn ngữ đang chọn), gồm hành động và đối tượng: "Chọn users để di chuyển", "Tài khoản {tên}".
- [ ] Link lặp chữ ("Xem ví dụ") phải có phần sr-only để tên không trùng nhau.
- [ ] Dấu tiếng Việt hiển thị đủ với Inter và JetBrains Mono (subset vietnamese).

## 8. English (nguồn, mặc định)

- [ ] Giọng dev tool: thẳng, ngắn, chủ động, nói với "you". "Declare resources, generate fake data in one click and get full CRUD endpoints right away."
- [ ] Sentence case cho tiêu đề, nút, menu: "Get started free", "Manage plan". Không viết hoa từng chữ.
- [ ] Viết rút gọn tự nhiên khi thân mật (can't, isn't, we'll) trong lỗi và hướng dẫn; tiêu đề và nút không cần.
- [ ] Số nhiều đúng ngữ pháp qua plural (`{ one, other }`): "1 endpoint", "25 endpoints", "3 projects". Không viết "project(s)".
- [ ] Thuật ngữ như mục 2, viết thường trong câu (a mock, the resource, an endpoint), số nhiều thêm "s" bình thường.
- [ ] CTA giữ chung nghĩa với bản Việt: đăng ký luôn là "Get started free" (header hẹp: "Get started"), "See how it works", "Contact", "Sign in", "Sign out", "Try again", "Reset".
- [ ] Trạng thái đang chạy kết thúc bằng "…" ("Loading page…"); toast thành công ở thì quá khứ ("Nested comments into posts.").
- [ ] Lỗi: chuyện gì xảy ra + làm gì tiếp, không xin lỗi dài dòng: "You tried to sign in too many times. Please wait a minute and try again."
- [ ] `aria-label` gồm hành động và đối tượng: "Account {name}", "Language: English".

## 9. 中文（简体）

- [ ] 简体中文，称呼用户为“你”（不用“您”），语气简洁、专业。
- [ ] 中文与英文、数字之间加一个半角空格：“3 个 project”“Free 套餐”“{count} 个 endpoint”。
- [ ] 标点用全角（，。：；？！“”），但代码、路径、命令、占位符保持原样（`<code>`、`{name}`、`?page=1`）。
- [ ] 第 2 节的术语保持英文：mock、resource、endpoint、project、schema、field、request、response、collection、environment、token、secret、CRUD、MCP、Faker.js；套餐名 Free / Pro 不翻译。
- [ ] 数量用量词：“3 个 project”“10 条记录”“每个 resource 5 个工具”；中文没有复数，plural 只需 `{ other }`。
- [ ] 按钮用动词短语，2–6 个字：“免费开始”“联系我们”“重试”“重置”“退出登录”。
- [ ] 进行中状态以“…”结尾（“正在加载页面…”），成功提示用“已…”（“已将 comments 嵌套到 posts。”）。
- [ ] 错误说明发生了什么、下一步怎么做：“你尝试登录的次数过多，请等待一分钟后重试。”

