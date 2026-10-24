# ADR-0010: Tool dữ liệu giả kiểu Việt Nam là API công khai, không trạng thái, có cổng và giới hạn theo IP

- **Ngày:** 2026-10-24
- **Trạng thái:** Đã chốt; code đã vào `main`, chưa phát hành (cờ web `vnFakeData` và `PUBLIC_FAKE_DATA_ENABLED` đều tắt)
- **Người quyết định:** dattqh. Mục tiêu do user chốt cho hệ sinh thái `*-next`: tăng người dùng bằng kênh tự phục vụ, chi phí vận hành gần 0, không quảng cáo, không email.

## Bối cảnh

Lập trình viên Việt Nam cần dữ liệu thử nghiệm trông như thật: họ tên có dấu, địa chỉ theo phường và tỉnh, số di động đúng đầu số, số căn cước công dân (CCCD) đúng định dạng. Faker có locale `vi` nhưng dữ liệu của nó yếu (tên ghi ngược thứ tự, đầu số bàn và đầu số đã bỏ, thành phố lẫn tên tiếng Anh) và không có CCCD. Một công cụ miễn đăng nhập, xuất hiện trên công cụ tìm kiếm, là cửa vào cho người chưa biết Localman; lời mời "dùng dữ liệu này làm mock API" dẫn họ tới đăng nhập và tạo resource.

## Quyết định

1. **Bộ sinh thuần dùng chung** (`@localman/shared/vn-fake-data`): người, địa chỉ, số di động, CCCD, công ty; 1 đến 50 bản ghi; `vi` (có dấu) hoặc `en` (không dấu, nhãn tiếng Anh). Không dùng Faker mà dùng một bộ số ngẫu nhiên có seed (mulberry32), nên cùng seed cho cùng dữ liệu ở server và trình duyệt, và trang web không phải tải Faker. Địa chỉ theo bản đồ hai cấp từ 01/07/2025 (34 tỉnh, thành; mỗi nơi một ít phường làm mẫu, không phải danh mục đầy đủ).
2. **Trang công khai `/tools/vn-fake-data`** sinh dữ liệu ngay trên trình duyệt bằng bộ sinh đó, không gọi API: không tốn tài nguyên server, không đụng giới hạn. Trang được prerender (head tiếng Anh) để công cụ tìm kiếm đọc được; danh sách đầu tiên dùng seed và ngày cố định để markup prerender khớp lúc hydrate. Trang và link trên landing đứng sau cờ web `vnFakeData`; nginx phục vụ `tools-vn-fake-data.html` cho path đó và quay về `index.html` khi bản build không có file.
3. **API `GET /api/v1/public/fake-data?type=&count=&locale=&seed=`** cho người dùng code và agent: khai bằng `defineOperation` như mọi API (toolset `public`, `scopes: []`, có MCP tool `generate_fake_data`), vì registry đã cho phép operation công khai. REST không cần đăng nhập; tool MCP thì như mọi tool Localman MCP, cần token MCP (toolset `public` dùng scope `client:read`). `seed` (số nguyên 0 đến 2^32 - 1) tuỳ chọn: cùng seed cho lại cùng bản ghi (ngày sinh tính lùi từ hôm nay), vì server và trình duyệt chạy cùng bộ sinh; không truyền thì server tự bốc seed ngẫu nhiên. Không đọc, không ghi database; chạy trong tenant của Host như mọi route (Host không thuộc tenant nào nhận 421 như ADR-0003). Mỗi câu trả lời có `fake: true` và `notice` ghi rõ đây là dữ liệu giả để thử nghiệm.
4. **Giới hạn 30 lượt mỗi phút cho mỗi địa chỉ IP** (IPv6 tính theo /64, như các giới hạn khác), quá thì 429 `RATE_LIMITED` kèm số giây phải chờ (`Retry-After` qua REST, `details.retryAfterSeconds` cho cả REST lẫn MCP). Đếm trong bộ nhớ trong handler, trước khi sinh dữ liệu: API không lưu gì nên giới hạn cũng không ghi MongoDB (khác `rate_limit_windows` của link công khai), và áp chung cho REST lẫn MCP. 30 lượt mỗi phút, mỗi lượt tối đa 50 bản ghi, đủ cho test và seed dữ liệu, còn gọi dồn thì bị chặn sớm. Bộ đếm giữ tối đa 50.000 địa chỉ theo thứ tự cửa sổ mở (cũng là thứ tự hết hạn); đầy thì bỏ từ đầu các cửa sổ đã hết hạn và dừng ở cửa sổ còn hiệu lực đầu tiên, vẫn đầy thì bỏ một lượt 1% cửa sổ cũ nhất. Nhờ vậy lũ request từ nhiều địa chỉ không làm phình bộ nhớ, và không request nào phải quét cả bộ đếm.
5. **Cổng `PUBLIC_FAKE_DATA_ENABLED`** (mặc định tắt) theo `operations/feature-gates.ts`: tắt thì operation không có route (404) và không có tool MCP. Đây cũng là công tắc rollback khi bị lạm dụng hay RAM vượt ngưỡng. Trang web không cần cổng này.
6. **Faker theo tên field:** field có tên tiếng Việt (`ho_ten`, `sdt`, `dia_chi`…, danh sách `VIETNAMESE_FIELD_WORDS` trong `faker-field-rules.ts`) được sinh bằng locale `vi` của Faker đã vá (`faker-vi-locale.ts`). Riêng Faker `vi` thiếu nhiều phần và rơi về tiếng Anh hoặc bản đồ cũ (`dia_chi` ra "7809 Tô Inlet", `thanh_pho` ra "Haiphong", `tinh` ra "Quảng Bình", `chuc_vu` ra "Dynamic Directives Associate"), nên phần vá lấy dữ liệu đã chọn lọc của `vn-fake-data`: họ trước tên, tên đệm và giới tính ("Nam"/"Nữ") tiếng Việt; số di động theo đầu số đang dùng; địa chỉ là số nhà và tên đường Việt Nam ("12 Lê Lợi", "45/7 Hùng Vương"); thành phố và tỉnh lấy từ 34 tỉnh, thành sau sáp nhập, viết đúng chính tả ("Hải Phòng"); `county` (quận, huyện không còn) là phường mẫu. Chức danh dùng danh sách tiếng Việt "chức vụ + phòng ban" (`vn-job-data.ts`, ví dụ "Trưởng phòng Kế toán") thay vì để `job.*` rơi về Faker tiếng Anh: rơi về tiếng Anh vẫn để bản ghi tiếng Việt mang chức danh tiếng Anh, còn danh sách thì ngắn và không lẫn ngôn ngữ. Faker `vi` được seed từ Faker gốc nên dữ liệu có seed vẫn lặp lại được.

## Vì sao số CCCD giả là an toàn

- Định dạng CCCD là thông tin công khai: 3 chữ số mã tỉnh nơi đăng ký khai sinh, 1 chữ số thế kỷ và giới tính, 2 chữ số cuối năm sinh, 6 chữ số ngẫu nhiên. Cấu trúc 12 chữ số này do Thông tư 07/2016/TT-BCA đặt ra; Thông tư 59/2021/TT-BCA (hiệu lực 01/07/2021) thay thế thông tư đó và giữ nguyên cấu trúc; Luật Căn cước 2023 (Luật số 26/2023/QH15, hiệu lực 01/07/2024) giữ số định danh cá nhân 12 chữ số, và thẻ căn cước mới mang đúng số đó. Biết định dạng không giúp tìm ra ai.
- Mã tỉnh trong số CCCD là mã của 63 tỉnh trước sáp nhập (số đã cấp không đổi), độc lập với tỉnh trong địa chỉ (34 tỉnh sau sáp nhập): một người giả có thể mang mã tỉnh Hà Giang và địa chỉ ở Tuyên Quang, như người thật đăng ký khai sinh trước năm 2025.
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
- Giới hạn tính IPv6 theo /64, nên ai xoay vòng nhiều /64 (một khối /48 có 65.536 khối /64) sẽ vượt được giới hạn theo IP. Chấp nhận vì endpoint rẻ (tối đa 50 bản ghi sinh trong bộ nhớ, không I/O) và không trạng thái; bộ đếm có trần nên không phình bộ nhớ, còn lạm dụng kéo dài thì tắt `PUBLIC_FAKE_DATA_ENABLED`.
- Đổi locale Faker cho field tên tiếng Việt là thay đổi người dùng thấy được: resource có field như `ho_ten`, `dia_chi`, `chuc_vu` sinh ra giá trị tiếng Việt thay vì tiếng Anh. Faker `vi` lấy seed bằng một lần rút từ Faker gốc, nên với cùng seed, giá trị của các field đứng sau một field tên tiếng Việt cũng lệch một lần so với trước. Dữ liệu đã lưu không đổi; chỉ lần sinh mới cho kết quả khác.
- Danh sách phường là mẫu; thêm phường hay sửa tên chỉ cần sửa `vn-places-data.ts`.
- Phát hành là bước riêng: thêm `vnFakeData` vào `infra/localman/released-features` (trang) và đặt `PUBLIC_FAKE_DATA_ENABLED=true` trong env production (API), rồi deploy.
