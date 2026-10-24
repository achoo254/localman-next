# ADR-0010: Tool dữ liệu giả kiểu Việt Nam là API công khai, không trạng thái, có cổng và giới hạn theo IP

- **Ngày:** 2026-10-24
- **Trạng thái:** Đã chốt; code đã vào `main`, chưa phát hành (cờ web `vnFakeData` và `PUBLIC_FAKE_DATA_ENABLED` đều tắt)
- **Người quyết định:** dattqh. Mục tiêu do user chốt cho hệ sinh thái `*-next`: tăng người dùng bằng kênh tự phục vụ, chi phí vận hành gần 0, không quảng cáo, không email.

## Bối cảnh

Lập trình viên Việt Nam cần dữ liệu thử nghiệm trông như thật: họ tên có dấu, địa chỉ theo phường và tỉnh, số di động đúng đầu số, số căn cước công dân (CCCD) đúng định dạng. Faker có locale `vi` nhưng dữ liệu của nó yếu (tên ghi ngược thứ tự, đầu số bàn và đầu số đã bỏ, thành phố lẫn tên tiếng Anh) và không có CCCD. Một công cụ miễn đăng nhập, xuất hiện trên công cụ tìm kiếm, là cửa vào cho người chưa biết Localman; lời mời "dùng dữ liệu này làm mock API" dẫn họ tới đăng nhập và tạo resource.

## Quyết định

1. **Bộ sinh thuần dùng chung** (`@localman/shared/vn-fake-data`): người, địa chỉ, số di động, CCCD, công ty; 1 đến 50 bản ghi; `vi` (có dấu) hoặc `en` (không dấu, nhãn tiếng Anh). Không dùng Faker mà dùng một bộ số ngẫu nhiên có seed (mulberry32), nên cùng seed cho cùng dữ liệu ở server và trình duyệt, và trang web không phải tải Faker. Địa chỉ theo bản đồ hai cấp từ 01/07/2025 (34 tỉnh, thành; mỗi nơi một ít phường làm mẫu, không phải danh mục đầy đủ).
2. **Trang công khai `/tools/vn-fake-data`** sinh dữ liệu ngay trên trình duyệt bằng bộ sinh đó, không gọi API: không tốn tài nguyên server, không đụng giới hạn. Trang được prerender (head tiếng Anh) để công cụ tìm kiếm đọc được; danh sách đầu tiên dùng seed và ngày cố định để markup prerender khớp lúc hydrate. Trang và link trên landing đứng sau cờ web `vnFakeData`; nginx phục vụ `tools-vn-fake-data.html` cho path đó và quay về `index.html` khi bản build không có file.
3. **API `GET /api/v1/public/fake-data?type=&count=&locale=`** cho người dùng code và agent: khai bằng `defineOperation` như mọi API (toolset `public`, `scopes: []`, có MCP tool `generate_fake_data`), vì registry đã cho phép operation công khai. Không đọc, không ghi database; chạy trong tenant của Host như mọi route (Host không thuộc tenant nào nhận 421 như ADR-0003). Mỗi câu trả lời có `fake: true` và `notice` ghi rõ đây là dữ liệu giả để thử nghiệm.
4. **Giới hạn 30 lượt mỗi phút cho mỗi địa chỉ IP** (IPv6 tính theo /64, như các giới hạn khác), quá thì 429 `RATE_LIMITED`. Đếm trong bộ nhớ trong handler, trước khi sinh dữ liệu: API không lưu gì nên giới hạn cũng không ghi MongoDB (khác `rate_limit_windows` của link công khai), và áp chung cho REST lẫn MCP. 30 lượt mỗi phút, mỗi lượt tối đa 50 bản ghi, đủ cho test và seed dữ liệu, còn gọi dồn thì bị chặn sớm. Bộ đếm giữ tối đa 50.000 địa chỉ; đầy thì bỏ cửa sổ hết hạn trước, rồi cửa sổ cũ nhất, nên lũ request từ nhiều địa chỉ không làm phình bộ nhớ.
5. **Cổng `PUBLIC_FAKE_DATA_ENABLED`** (mặc định tắt) theo `operations/feature-gates.ts`: tắt thì operation không có route (404) và không có tool MCP. Đây cũng là công tắc rollback khi bị lạm dụng hay RAM vượt ngưỡng. Trang web không cần cổng này.
6. **Faker theo tên field:** field có tên tiếng Việt (`ho_ten`, `sdt`, `dia_chi`…, danh sách `VIETNAMESE_FIELD_WORDS` trong `faker-field-rules.ts`) được sinh bằng locale `vi` của Faker, với tên theo thứ tự họ trước và số di động theo đầu số đang dùng. Faker `vi` được seed từ Faker gốc nên dữ liệu có seed vẫn lặp lại được.

## Vì sao số CCCD giả là an toàn

- Định dạng CCCD là thông tin công khai (Thông tư 07/2016/TT-BCA): 3 chữ số mã tỉnh nơi đăng ký khai sinh, 1 chữ số thế kỷ và giới tính, 2 chữ số cuối năm sinh, 6 chữ số ngẫu nhiên. Biết định dạng không giúp tìm ra ai.
- Sáu chữ số cuối là ngẫu nhiên và không đi kèm dữ liệu thật nào: không tên thật, không ảnh, không địa chỉ thật. Một số trùng với số của người thật chỉ là ngẫu nhiên, và con số đó đứng một mình không định danh được ai.
- Mã số thuế công ty là 10 chữ số ngẫu nhiên, không có chữ số kiểm tra, nên phần lớn không phải mã hợp lệ.
- Giao diện, API và tài liệu đều ghi "dữ liệu giả, chỉ dùng để thử nghiệm" và dặn không dùng để định danh hay đưa vào giấy tờ chính thức.

## Phương án bị loại

- **Route Express viết tay ngoài registry:** không cần, registry đã hỗ trợ operation công khai; khai một lần thì có luôn validate, OpenAPI và MCP tool.
- **Trang web gọi API để sinh dữ liệu:** tốn request và giới hạn cho việc trình duyệt tự làm được; trang sẽ hỏng khi cổng API tắt.
- **Giới hạn bằng `rate_limit_windows` (MongoDB):** mỗi lượt gọi sẽ ghi database, trái với "không ghi DB"; dữ liệu giả không cần giới hạn chính xác qua nhiều process.
- **`express-rate-limit` gắn ở `dashboard-server.ts`:** chỉ chặn REST, không chặn MCP, và tách giới hạn khỏi khai báo operation.
- **Dùng Faker `vi` cho bộ sinh của tool:** thứ tự tên sai, có đầu số bàn và đầu số đã bỏ, không có CCCD, và làm trang web nặng thêm.

## Hệ quả

- Tool là kênh tăng trưởng: đo tỷ lệ lượt dùng dẫn tới đăng nhập; sau 60 ngày dưới 5% thì sửa lời mời (kế hoạch tăng trưởng của hệ sinh thái).
- Giới hạn trong bộ nhớ chỉ đúng cho một process (fork mode như hiện nay) và mất khi khởi động lại; chấp nhận được với dữ liệu giả.
- Danh sách phường là mẫu; thêm phường hay sửa tên chỉ cần sửa `vn-places-data.ts`.
- Phát hành là bước riêng: thêm `vnFakeData` vào `infra/localman/released-features` (trang) và đặt `PUBLIC_FAKE_DATA_ENABLED=true` trong env production (API), rồi deploy.
