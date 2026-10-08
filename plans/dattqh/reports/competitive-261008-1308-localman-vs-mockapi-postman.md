# Localman so với mockapi.io và Postman: gói Free và tính năng riêng

**Ngày:** 2026-10-08 · **Người quyết:** Jev (`jev-1.13.0`), theo yêu cầu của user · **Plan liên quan:** `../261008-1123-localman-core/plan.md`

## Kết luận
- **Keyword chính:** **"Localhost ngay trên trình duyệt"** (Localhost in the browser). Localman là web app test được API ở `localhost` hay mạng LAN mà không cần cài app desktop: Tunelo được tự nhận theo port. Postman web bắt cài Desktop Agent; mockapi.io không làm được việc này. Jev chọn với xác suất 0.85.
- **Cập nhật 2026-10-08 sau nghiên cứu sâu** (`competitors/research-261008-1316-*.md`): (1) Postman có code mock giữ trạng thái (`pm.state`, beta, soạn trên desktop, cloud từ gói Solo) và từ 3/2026 không giới hạn số lần gọi mock, nên **không được** nói Postman "chỉ có example tĩnh". (2) Hoppscotch web gọi localhost được qua extension hoặc Agent, nên keyword chính phải ghi "không cần app hay extension, chỉ một lệnh Tunelo". (3) Thêm keyword "Mock lai localhost" và "Mock MCP tức thì".
- **Keyword phụ:** **"Live Mock Sync"**. Mock có trạng thái (CRUD, quan hệ, Faker) tự sinh và **giữ đồng bộ** một collection kèm environment chạy được ngay. Sửa schema resource thì request trong collection cập nhật theo. mockapi.io không có API client; mock của Postman chỉ trả các example tĩnh đã lưu. Jev chọn với xác suất 0.90.
- **Gói Free hào phóng hơn cả hai đối thủ ở những điểm họ đang yếu:** nhiều project và resource hơn mockapi.io, có cộng tác (Postman Free giờ chỉ còn 1 user), và thùng rác giữ 30 ngày (Postman Free giữ 1 ngày).

## Gói Free hiện tại của đối thủ

| | mockapi.io Free | Postman Free (từ 2026) | Localman Free (mới) |
|---|---|---|---|
| Số user hoặc thành viên | 1, không cộng tác | **1 user**, không có viewer hay chia sẻ | **1 workspace team tối đa 3 thành viên** (share, comment) |
| Mock | 1 project, 2 resource | Mock trả example; code mock giữ trạng thái (beta, soạn trên desktop, cloud từ Solo) | **3 project, 10 resource**, mock có trạng thái kèm quan hệ |
| Custom response / template | Chỉ gói trả phí | Có (theo example) | **Miễn phí** |
| Request tới mock mỗi tháng | Không công bố | Không thấy trên trang giá | 10.000 |
| Gửi request từ API client | Không có | Không giới hạn số lần chạy | 5.000 request qua proxy mỗi tháng |
| Gọi localhost từ web | Không | Phải cài Desktop Agent | **Có, qua Tunelo, tự nhận tunnel** |
| Khôi phục collection hoặc trash | Không có | 1 ngày | **30 ngày** |
| Fork, PR, public sharing | Không có | Có | Chỉ gói Pro |
| Ngôn ngữ | EN | EN | **VI**, giữ nguyên thuật ngữ EN |

Gói trả phí của đối thủ: mockapi.io $5/tháng ($35/năm) cho 20 project và 50 resource. Postman Solo $9/tháng (1 user); Postman Team $19/user/tháng, khôi phục 90 ngày.

## Quyết định của Jev

| Câu hỏi | Lựa chọn | Xác suất | Ghi chú |
|---|---|---|---|
| Keyword chính | Localhost ngay trên trình duyệt | 0.85 | |
| Keyword phụ (hỏi lại, đã loại keyword chính) | Live Mock Sync | 0.90 | |
| Mock trong gói Free | 3 project, 10 resource, custom response và object template miễn phí | 0.89 | |
| Cộng tác trong gói Free | Tối đa 3 thành viên mỗi workspace: share và comment; fork, PR, public vẫn là Pro | 0.70 | |
| Request tới mock mỗi tháng (Free) | 10.000 | 0.47 | Sát với lựa chọn "không giới hạn tháng" (0.44); đặt trong config |
| Request qua proxy mỗi tháng (Free) | 5.000 | 0.68 | |
| Giữ trash 30 ngày cho Free | Có | 0.80 | |
| Số thành viên mỗi workspace (Pro) | 10 | 0.66 | |
| Request tới mock mỗi tháng (Pro) | Không giới hạn tháng, chỉ có rate-limit | 0.57 | Sát với 100.000 (0.42) |
| Request qua proxy mỗi tháng (Pro) | Không giới hạn tháng, chỉ có rate-limit | 0.51 | Gần như hoà với 50.000 (0.48) |
| Thời gian giữ trash (Pro) | 30 ngày | 0.81 | |

Mọi con số đặt trong `packages/shared/src/plan-limits.ts`. Đổi một chỗ là đổi toàn hệ thống, không phải sửa code ở nơi khác. Các câu có xác suất sát nhau nên được xem lại sau khi có số liệu dùng thật.

## Thay đổi đưa vào plan và prototype
1. `plan-limits` (phase 01, 03, 04, 05, 07, 10, 11, 14): đổi hạn mức như bảng trên. Custom response và object template mở cho Free. Free có 1 workspace team tối đa 3 người.
2. **Phase 16 mới, Live Mock Sync:** liên kết project mock với một collection và environment, đồng bộ một chiều từ mock sang collection, xem diff trước khi áp, cảnh báo khi user đã tự sửa request.
3. Phase 08 (landing): hero dùng keyword chính, khối giới thiệu Live Mock Sync, bảng so sánh có ghi ngày lấy số liệu và nguồn, bảng giá mới.
4. Prototype: cập nhật landing, bảng giá và modal giới hạn ở `index.html`; thêm đồng hồ hạn mức, phân quyền theo gói mới và giao diện Live Mock Sync ở `api-client.html`.

## Rủi ro
- **So sánh trực tiếp với đối thủ:** chỉ nêu số liệu công khai, ghi ngày và link nguồn, và cập nhật khi họ đổi giá. Không dùng logo của họ.
- **Chi phí server khi Free hào phóng hơn:** có rate-limit theo giây cùng hạn mức tháng cho Free. Đồng hồ hạn mức cho user thấy trước khi bị chặn.
- **Keyword chính phụ thuộc Tunelo:** cần làm xong plan Tunelo (API liệt kê tunnel) trước khi quảng bá.

## Nguồn
- [Postman Pricing](https://www.postman.com/pricing/) (đọc ngày 2026-10-08: Free 1 user, khôi phục collection 1 ngày, không có viewer; Team: khôi phục 90 ngày).
- [Postman Free Tier 2026: Limits, Pricing & What Changed](https://agentdeals.dev/vendor/postman) và [Is Postman Free? (2026)](https://costbench.com/software/developer-tools/postman/free-plan/): Free thành 1 user từ tháng 3/2026.
- [Postman Pricing 2026 Details (Apidog)](https://apidog.com/blog/postman-pricing/): nguồn của đối thủ Postman, chỉ dùng để đối chiếu.
- mockapi.io: hạn mức lấy từ bundle công khai (`static/js/main.643af039.js`) và modal "Manage subscription", xem `xia-261008-1123-mockapi-io-anatomy.md`.
- [About the Postman Agent](https://learning.postman.com/docs/getting-started/basics/about-postman-agent/): Cloud Agent không gọi được tài nguyên local, phải dùng Desktop Agent.
