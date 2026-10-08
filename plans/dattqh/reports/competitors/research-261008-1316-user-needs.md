# Nhu cầu chưa được đáp ứng của người dùng Postman và mockapi.io: tín hiệu cho Localman

**Ngày:** 2026-10-08 · **Cụm:** C (voice of the user) · **Phạm vi:** phàn nàn, feature request và lý do chuyển tool, ưu tiên 2025–2026

## Kết luận

1. **Nhu cầu mạnh nhất là được làm việc mà không phải giao dữ liệu cho cloud của vendor.** Có ba biểu hiện: không bắt đăng nhập, secret không rời máy, và gọi được localhost mà không đi vòng qua cloud. Postman Free 2026 thu về 1 user, còn chế độ không đăng nhập thì không có collection lẫn environment. Đây cũng là lý do số 1 khiến người ta chuyển sang Bruno.
2. **Localman có một mâu thuẫn mà đối thủ sẽ khai thác.** Localman là web SaaS, gửi request qua server proxy và đưa localhost qua tunnel Tunelo. Như vậy request, kể cả secret, đều đi qua server của Localman, đúng điều mà người rời Postman đang phàn nàn: *"You're testing a localhost API through someone else's cloud."* ([dev.to/flutwiz, 2026-06-23](https://dev.to/flutwiz/why-i-left-postman-the-real-cost-of-a-cloud-first-api-client-3gfd)). Keyword "Localhost ngay trên trình duyệt" chỉ đứng vững nếu Localman nói rõ: **không cần cài app**, chứ không phải **không qua cloud**. Nên có thêm chế độ gửi thẳng từ trình duyệt khi target cho phép CORS.
3. **Localman đã có sẵn 2 trong 12 nhu cầu** trong bản kế hoạch hiện tại: gói Free cho team 3 người và giao diện tiếng Việt. Hai điểm này cần được đưa lên landing page, không cần build thêm.
4. **Cần sửa lại một nhận định trong báo cáo competitive trước đó.** Báo cáo đó viết "mock của Postman chỉ trả example tĩnh", nhưng điều này không còn đúng hẳn. Postman đã có *code mock server* lưu được state bằng `pm.state`. Tính năng này đang ở bản beta: Local View chạy trong desktop app, Cloud View cũng beta. Ngoài ra, từ tháng 3/2026 mock không còn bị giới hạn lượng dùng trên mọi gói ([Postman docs: mock](https://learning.postman.com/latest-v-12/docs/tests-and-scripts/write-scripts/postman-sandbox-reference/pm-state), [about plans](https://learning.postman.com/docs/billing/about-plans)). Vì vậy "Live Mock Sync" chỉ còn khác biệt ở ba điểm: **không cần viết code**, **chạy trên web không cần desktop**, và **sinh dữ liệu có quan hệ kiểu mockapi.io**.
5. **Bằng chứng về mockapi.io còn mỏng.** Cộng đồng của họ rất nhỏ, chỉ có 21 GitHub Discussions và trang Product Hunt chưa có review nào. Nhu cầu chủ yếu suy ra từ feature request và giới hạn của gói Free.

## Bảng xếp hạng 12 nhu cầu

Cách xếp hạng: độ mạnh của bằng chứng × mức đối thủ đang bỏ ngỏ × mức phù hợp với Localman. "Nguồn ĐL" là số nguồn độc lập; nguồn của vendor không được tính là độc lập. Tier S/M/L/XL là ước lượng khi chưa đọc code Localman.

| # | Nhu cầu → tính năng ứng viên | Nguồn ĐL | Đối thủ đang làm gì | Keyword tiềm năng | Tier | Tin cậy |
|---|---|---|---|---|---|---|
| 1 | **Team nhỏ cộng tác miễn phí** (2–3 người) | 6 | Postman Free chỉ còn 1 user; mockapi.io Free không có collaborator | "thay thế Postman miễn phí cho team" | S (**đã có**) | Cao |
| 2 | **Guest mode có collection và environment**, không bắt đăng nhập | 6 | Postman không đăng nhập thì không lưu được collection hay env; mockapi.io bắt đăng nhập | "Postman không cần đăng nhập" | M | Cao |
| 3 | **Secret không rời trình duyệt**, telemetry minh bạch, nêu rõ dữ liệu nằm ở đâu | 6 | Postman sync lên cloud (us-east-1), không tắt được telemetry, data residency chỉ có ở gói Enterprise EU | "test API bảo mật, không sync cloud" | M | Cao |
| 4 | **Gọi localhost từ web mà không cần cài app**, có chế độ gửi thẳng từ trình duyệt | 4 | Postman web phải cài Desktop Agent (không hỗ trợ Safari); mockapi.io không có client | "Localhost ngay trên trình duyệt" | S–M (Tunelo đã có, còn thiếu direct mode) | Cao về nhu cầu, Trung bình về độ phù hợp |
| 5 | **Giao diện nhẹ và nhanh**, có performance budget | 5 | Electron nặng, phàn nàn về RAM kéo dài từ 2018 đến 2026 | "API client nhẹ" | S–M | Cao |
| 6 | **Import Postman không mất dữ liệu, kể cả script** (`pm.*` shim), export ngược lại được | 4 | Postman export JSON nhưng bị mất mát; Bruno import không chuyển được test script | "import Postman collection" | M (request, env) / L (script) | Trung bình–Cao |
| 7 | **Lưu trữ thân thiện với Git** (export ra file text, sync với repo) | 5 | Postman Free có "Git integration" từ 2026; mockapi.io không có | "lưu collection vào Git" | M (export) / L (sync 2 chiều) | Trung bình–Cao |
| 8 | **Các lỗ hổng mock của mockapi.io**: import OpenAPI, metadata tổng số bản ghi và trang, log request, auth cho mock, công bố rate limit | 2 (ít người dùng) | mockapi.io: custom response chỉ có ở gói trả phí, maintainer gần như im lặng từ 2025 | "mock API có trạng thái", "mockapi miễn phí" | M | Trung bình |
| 9 | **Vẫn chạy khi cloud sập hoặc mất mạng** (PWA, cache local) | 3 | Postman sập theo AWS ngày 2025-10-20 | "test API offline" | L | Trung bình |
| 10 | **Không ép dùng AI, không nag, không đổi UI đột ngột** | 3 | Postman: popup AI không có nút đóng; ép auto-update | (định vị, không phải keyword) | S | Trung bình |
| 11 | **Giao diện tiếng Việt** | 2 (nhu cầu) + kiểm chứng phía cung | Postman chỉ có EN và JA; mockapi.io chỉ có EN | "Postman tiếng Việt" | S (**đã có**) | Trung bình |
| 12 | **Giá minh bạch, thanh toán bằng VND** (VietQR, hoá đơn VAT) | 1–2 | Postman tính theo USD/seat; mockapi.io $5/tháng | "bảng giá VND" | M | **Thấp**: chưa có bằng chứng từ dev VN |

Không vào top 12: chia sẻ request chạy được qua link (Postman Free đã bỏ tính năng chia sẻ, nhưng Hoppscotch đã có share link, button và embed, còn bằng chứng nhu cầu thì mỏng: [Bruno #7758](https://github.com/usebruno/bruno/issues/7758)); keyboard-first ([Bruno #2373](https://github.com/usebruno/bruno/issues/2373), 42 👍), một nhu cầu ngách.

## Bằng chứng từng mục (trích ≤15 từ)

### 1. Team nhỏ cộng tác miễn phí
- Postman docs: *"the Free plan is limited to one user and can't create a team."* ([about plans](https://learning.postman.com/docs/billing/about-plans)). Team Free có nhiều người sẽ bị chuyển sang read-only ([free-and-solo](https://learning.postman.com/docs/administration/free-and-solo)).
- wiradikusuma, HN 2026-02-01: *"Any free alternative that works for small team but not self-hosted?"* ([HN 46844880](https://news.ycombinator.com/item?id=46844880)). Câu này khớp đúng chỗ Localman đứng: hosted và có team free.
- Letmetest, HN 2026-02-24: *"Got the email from Postman saying free plan is ending March 1."* ([HN 47144163](https://news.ycombinator.com/item?id=47144163)). Lưu ý: một commenter cho rằng tài khoản này từng kể chuyện tương tự trước đó.
- John Carter, Cursor forum 2026-04-20: *"starts to feel a bit friction-heavy unless you upgrade"* ([forum](https://forum.cursor.com/t/2026-update-postman-free-plan-limits-and-alternatives/158497)).
- Auden, dev.to 2026-02-05, nói về giới hạn single-user ([bài](https://dev.to/auden/postman-ends-free-team-plans-in-march-2026-here-is-the-free-alternative-i-switched-to-118p)). Ash Inno, dev.to 2026-03-03: *"A five-person team went from paying nothing to paying $1,140 per year."* ([bài](https://dev.to/ashinno/postmans-new-pricing-is-a-trap-here-are-the-alternatives-4839)). Bài này link sang Apidog, có thể bị thiên lệch; con số ghi "per year" là sai, thực tế giá là $19/user/tháng.
- Lưu ý về Ask HN [46942116](https://news.ycombinator.com/item?id=46942116): nhiều người phản hồi tố OP astroturf cho Apidog. Phần lớn các bài "Postman 2026" trên web là của Apidog nên không được tính là nguồn độc lập.

### 2. Không bắt đăng nhập
- HN 2023-10-06, 365 điểm: *"Postman update removes all your stuff if you refuse to create account"* ([HN 37792690](https://news.ycombinator.com/item?id=37792690)).
- Insomnia 8 lặp lại đúng lỗi này: issue *"enshittification / needing an account"* có 278 👍 ([Kong/insomnia#6577](https://github.com/Kong/insomnia/issues/6577), 2023-09-27).
- tobinfekkes, HN 2025-10-20: *"If it stops working locally, what even is the point anymore?"* ([HN 45645172](https://news.ycombinator.com/item?id=45645172)).
- OP trên Tildes 2025-10-29: *"All I want is a simple program that does HTTP requests."* ([Tildes](https://tildes.net/~tech/1qyk/is_there_a_postman_alternative_without_the_bloat)).
- A. Dombrowski, dev.to 2026-08-25, về lightweight client của Postman: *"no collections, no environments, no saved workflow."* ([bài](https://dev.to/akdombrowski/postman-without-an-account-what-still-works-in-2026-49aa)). Docs Postman xác nhận chế độ này chỉ có trên desktop ([using API client](https://learning.postman.com/docs/getting-started/basics/using-api-client/)).
- Lý do đối thủ không làm: mô hình của Postman cần tài khoản để upsell seat. mockapi.io chuyển người chưa đăng nhập về trang login (suy ra từ JS bundle, chưa thử bằng tài khoản thật).
- **Gợi ý cho Localman:** workspace khách lưu trong IndexedDB, đủ collection và env, đến khi cần share hoặc mock public mới yêu cầu "claim" tài khoản.

### 3. Secret và quyền riêng tư
- Insomnia: issue *"Employer REQUIREMENT: Cloud syncs are forbidden."* ([#6624](https://github.com/Kong/insomnia/issues/6624), 2023-10-02).
- will4274, HN 2025-10-21, nói về Postman: *"IT still maintains a wiki page and includes it on the banned software list."* ([HN 45650932](https://news.ycombinator.com/item?id=45650932)).
- CloudSEK (12/2024) tìm thấy hơn 30.000 public workspace của Postman làm lộ token và API key ([CloudSEK](https://cloudsek.com/blog/postman-data-leaks-the-hidden-risks-lurking-in-your-workspaces), [TechRadar](https://www.techradar.com/pro/security/thousands-of-widely-used-public-workspaces-are-leaking-data)).
- Kreya (vendor, 2025-06-13): *"Postman does not offer a way to disabled telemetry."* ([Kreya](https://kreya.app/blog/comparing-privacy-of-popular-api-clients/)). Bài Medium 2025-05 cáo buộc Postman ghi log secret, nhưng **Postman phản bác** và chưa có kiểm chứng độc lập ([community](https://community.postman.com/t/does-postman-log-secrets-and-environment-variables-data-to-postman-cloud/80341)).
- Data residency: Postman chạy ở us-east-1, vùng EU chỉ dành cho Enterprise ([docs](https://learning.postman.com/docs/administration/enterprise/about-eu-data-residency)). Ở Việt Nam, Luật Bảo vệ dữ liệu cá nhân 91/2025/QH15 có hiệu lực từ 2026-01-01 ([KPMG](https://kpmg.com/vn/en/home/insights/2025/06/vietnam-new-personal-data-protection-law.html)). Đây là lực đẩy từ phía quy định; **chưa thấy dev VN lên tiếng trực tiếp về chuyện này**.
- **Gợi ý cho Localman:** secret chỉ lưu ở client, proxy không lưu log body và header, có trang "dữ liệu nằm ở đâu" (server đặt ở VN nếu đúng như vậy). Chế độ direct (mục 4) giúp request có secret không đi qua proxy.

### 4. Localhost mà không cần cài app
- HN 2025-10-20, 537 điểm, 293 comment: *"Postman which I thought worked locally on my computer, is down"* ([HN 45645172](https://news.ycombinator.com/item?id=45645172)).
- rcarmo, HN 2025-10-21: một dev tool phải chạy được *"(including fully offline against localhost)"* ([HN](https://news.ycombinator.com/item?id=45653174)).
- FlutWiz, dev.to 2026-06-23: *"why does testing an API running on my own machine require a cloud account?"* ([bài](https://dev.to/flutwiz/why-i-left-postman-the-real-cost-of-a-cloud-first-api-client-3gfd)).
- Client chạy trên web nào cũng vướng CORS. Issue Hoppscotch [#1376](https://github.com/hoppscotch/hoppscotch/issues/1376), về lỗi CORS mà người mới gặp, mở từ 2020 và đến 2026-10 vẫn còn người hỏi. Postman web cần Desktop Agent, mà agent này không hỗ trợ Safari ([docs](https://learning.postman.com/docs/getting-started/basics/about-postman-agent)).
- **Rủi ro đã nêu ở Kết luận #2:** tunnel đưa traffic localhost đi qua server của Localman.

### 5. Giao diện nhẹ và nhanh
- duxup, HN 2025-10-20: *"Postman grew into a monster that bloated with features"* ([HN 45645360](https://news.ycombinator.com/item?id=45645360)).
- teaganga, HN 2025-10-21: *"postman is slow, eats a ton of memory"* ([HN 45656481](https://news.ycombinator.com/item?id=45656481)). hoechst: *"still using postman v9 from 2022, which is pre-bloat"* ([HN 45656484](https://news.ycombinator.com/item?id=45656484)).
- GitHub: [#7294](https://github.com/postmanlabs/postman-app-support/issues/7294) (80 👍, 212 comment, về RAM và CPU), [#4687](https://github.com/postmanlabs/postman-app-support/issues/4687) (*"Eating too much RAM"*, vẫn mở), [#14307](https://github.com/postmanlabs/postman-app-support/issues/14307) (2026-09-18, AI chat *"causing my computer to lag terribly"*).
- **Gợi ý cho Localman:** đặt performance budget đo được (bundle, TTI) và công bố con số. Không dùng chữ "nhẹ" làm khẩu hiệu nếu không có số đi kèm.

### 6. Import Postman không mất dữ liệu
- FlutWiz 2026-06-23: *"every export I've done has lost something"* (OAuth flow, binary body, header).
- Tildes 2025-10-29: hobbes64 nói import của Bruno **không chuyển được JS test script** của Postman (diễn giải, không trích nguyên văn). vignarajj trên Medium: *"my test scripts do not run smoothly"* ([Medium](https://medium.com/@vignarajj/why-i-switched-to-bruno-for-api-testing-a-developers-journey-c610b5cdea59)).
- Maintainer Restfox, HN 2025-10-21, dùng đúng điểm này để quảng bá: *"postman import is well tested ... export back to Postman collections"* ([HN 45653340](https://news.ycombinator.com/item?id=45653340)).
- Ngược lại, Joodi (dev.to 2026-07-15) thấy migrate dễ khi không có script ([bài](https://dev.to/joodi/i-switched-from-postman-to-bruno-58io)). Vậy nỗi đau tập trung ở script và auth.

### 7. Lưu trữ thân thiện với Git
- Bruno lên HN với 1.538 điểm, tiêu đề *"Fast and Git-friendly open-source API client"* ([HN 39653718](https://news.ycombinator.com/item?id=39653718), 2024-03).
- JLCarveth, HN 2026-02-09: *"requests stored as plaintext files, so you can easily track it with git"* ([HN 46945319](https://news.ycombinator.com/item?id=46945319)). teunlao, HN 2025-10-21: *"Bruno + git has been perfect for our team."*
- Hoppscotch [#870](https://github.com/hoppscotch/hoppscotch/issues/870) *"Sync Collections with Git repo"* là issue mở có nhiều 👍 nhất (107).
- Phía Postman: gói Free 2026 có ghi "Git integration" ([free-and-solo](https://learning.postman.com/docs/administration/free-and-solo)), nên khoảng trống đang hẹp lại. FlutWiz còn muốn tránh cả format riêng `.bru`. Vì vậy Localman nên export ra OpenAPI hoặc `.http`, vốn là format mở.

### 8. Các lỗ hổng của mockapi.io (GitHub Discussions, [mockapi-io/docs](https://github.com/mockapi-io/docs/discussions))
- [#3](https://github.com/mockapi-io/docs/discussions/3) (2023, có người +1 vào 2025-02): *"create a project by importing an Open API spec"*. Maintainer trả lời "will need to think", đến nay chưa làm.
- [#8](https://github.com/mockapi-io/docs/discussions/8): *"adding total number of the data, and also total pagination"*. Có thể làm được bằng custom response, nhưng tính năng này chỉ có ở gói trả phí ([freetier.co](https://freetier.co/directory/products/mockapiio), kiểm tra 2026-06-12).
- [#16](https://github.com/mockapi-io/docs/discussions/16): *"Isn't there a way to see the log of the requests?"*. [#4](https://github.com/mockapi-io/docs/discussions/4): *"restrict put and delete requests from everyone accept the creator"*. [#21](https://github.com/mockapi-io/docs/discussions/21) (2025-12-31) hỏi về rate limit, chưa có trả lời. [#18](https://github.com/mockapi-io/docs/discussions/18)/[#20](https://github.com/mockapi-io/docs/discussions/20) xin đổi tên resource.
- mockapi.io tự định vị là *"meant to be used as a prototyping/testing/learning tool"* ([wiki](https://github.com/mockapi-io/docs/wiki)). Gói Free có 1 project, 2 resource; gói Pro $5/tháng hoặc $35/năm (giá kiểm tra trong JS bundle). Có khoảng 52.900 kết quả code search trên GitHub nhắc đến "mockapi.io", phần lớn là bài tập của học viên, trong đó có repo bài tập của người Việt ("Tạo database trên mockapi.io"). Có thể đây là tệp người dùng sinh viên và bootcamp.
- Các client khác cũng thiếu mock: Hoppscotch [#1598](https://github.com/hoppscotch/hoppscotch/issues/1598) (32 👍, nay đã có mock trả example), [#5980](https://github.com/hoppscotch/hoppscotch/issues/5980) (dynamic body, 2026); Bruno [#3071](https://github.com/usebruno/bruno/issues/3071) *"Missing Mock Server Feature"*.

### 9. Chạy khi cloud sập hoặc mất mạng
- Sự cố Postman 2025-10-20 (thread HN ở mục 4). ReptileMan còn đề xuất có luật buộc *"making all cloud functionality optional"*. Hoppscotch [#267](https://github.com/hoppscotch/hoppscotch/issues/267) xin bản offline (30 👍).
- Với một web SaaS, chạy offline thật sự (PWA và hàng đợi) tốn công, tier L. Chỉ nên làm sau khi đã có guest mode local-first (mục 2), vì phần lớn nền móng dùng chung.

### 10. Không ép dùng AI, không nag
- Postman [#13835](https://github.com/postmanlabs/postman-app-support/issues/13835) (2025-10-21, 17 👍): *"it immediately shoved an AI thing into my face that I couldn't close"*. camsteffen 2025-12-11: *"Very obnoxious. Will be switching to"* Bruno.
- [#6999](https://github.com/postmanlabs/postman-app-support/issues/6999) (72 👍, mở từ 2019): *"Postman updates even when Auto updates are turned off"*. neya, HN 2025-10-21, chuyển tool vì bị ép auto-update.
- Vòng lặp mất niềm tin, theo stavros trên HN: *"Let's see how long it takes for one of these programs to break the cycle."* ([HN 45651669](https://news.ycombinator.com/item?id=45651669)). Cam kết công khai về dữ liệu và giá sẽ tạo được niềm tin; đây là việc tier S.

### 11. Giao diện tiếng Việt
- Bruno [#322](https://github.com/usebruno/bruno/issues/322) "i18n" là issue mở có nhiều 👍 nhất của Bruno (56): *"Bruno currently only supports English Locale."* [#4292](https://github.com/usebruno/bruno/issues/4292) (2025-03-20): *"I am from Vietnam"*, xin bản tiếng Việt. Người Việt đã tự mở PR dịch docs Bruno ([#8024](https://github.com/usebruno/bruno/issues/8024), [#8076](https://github.com/usebruno/bruno/issues/8076), tháng 5/2026).
- Postman chỉ bản địa hoá tiếng Nhật, từ 2023-12 ([BusinessWire](https://www.businesswire.com/news/home/20231211943255/en)). **Hoppscotch đã có `vi.json`**, nên tiếng Việt không còn là điểm khác biệt tuyệt đối.

### 12. Giá minh bạch và thanh toán VND
- Postman Team $19/user/tháng, thu bằng thẻ hoặc direct debit (direct debit chỉ có ở Mỹ) ([billing](https://learning.postman.com/docs/billing/billing)). Phí chuyển đổi ngoại tệ khi thanh toán bằng thẻ là khoảng 1–4% tuỳ ngân hàng ([VIB](https://www.vib.com.vn/vn/cam-nang/the-tin-dung/tien-ich-the/the-visa-thanh-toan-quoc-te-duoc-khong)).
- **Không tìm thấy dev VN nào than phiền trực tiếp về chuyện thanh toán Postman hay mockapi.io.** Nhu cầu này là suy luận. Hoá đơn VAT cho công ty là luận điểm mạnh hơn VietQR, nhưng cũng chưa có bằng chứng.

## Đối thủ thật sự cho nhóm nhu cầu này (ngoài phạm vi được giao nhưng cần biết)

Bruno là đích đến phổ biến nhất trong mọi thread nhưng chỉ chạy trên desktop và không có mock. **Hoppscotch** gần Localman nhất: chạy trên web, không bắt đăng nhập (lưu local storage), có `vi.json`, có share link và embed, có mock dạng example, và secret env không bao giờ được sync ([docs](https://docs.hoppscotch.io/llms-full.txt)). Những gì Hoppscotch chưa có là: **mock có trạng thái với dữ liệu sinh tự động có quan hệ**, và **gọi localhost mà không cần extension hay agent**. Đây đúng là hai keyword của Localman, nên định vị hiện tại vẫn hợp lý. Nhưng các luận điểm "không login" và "tiếng Việt" thì không còn là độc quyền của Localman.

## Giới hạn của nghiên cứu

- **Không đọc được Reddit:** WebFetch bị chặn, PullPush bị rate-limit. Chỉ thấy tiêu đề các thread 2026 như "Was tired from Postman. Made one!" (r/coolgithubprojects, 70 điểm), "Postman EU alternative built by me" (r/BuyFromEU), "Recon – A local API client because Postman lost the plot". Các tiêu đề này ủng hộ mục 2, 3 và 5 nhưng không được tính là nguồn.
- **Không đọc được G2/Capterra** (HTTP 403). Trang Product Hunt của mockapi.io chưa có review nào.
- **Không tìm thấy thảo luận nào của dev VN** (Viblo render phía client và không có kết quả liên quan; nhóm Facebook J2TEAM không được index). Mục 11–12 vì thế yếu về phía nhu cầu.
- Không đo search volume, nên cột keyword chỉ mang tính định tính.
- Tier effort là giả định, chưa đối chiếu với code prototype.

## Câu hỏi chưa giải quyết

1. Server và proxy của Localman đặt ở đâu (VN hay nước ngoài)? Câu trả lời quyết định luận điểm data residency ở mục 3.
2. Proxy có ghi log header hoặc body không? Nếu có, mục 3 sẽ phản tác dụng.
3. Localman có chấp nhận làm guest mode local-first (mục 2) không? Việc này đổi kiến trúc lưu trữ từ server-first sang client-first, cần quyết định trước khi chốt schema.
4. Báo cáo competitive trước đó cần cập nhật câu về mock của Postman (Kết luận #4).

Status: DONE_WITH_CONCERNS
Summary: Top 12 nhu cầu được xếp hạng kèm bằng chứng. Nhu cầu mạnh nhất là không đăng nhập, secret không rời máy và localhost không qua cloud; Localman đã có team free và tiếng Việt, nhưng mô hình proxy/tunnel đi ngược nhu cầu privacy nếu không có direct mode.
Concerns/Blockers: Không đọc được Reddit, G2, Capterra và cộng đồng dev VN; bằng chứng cho mục 8, 11, 12 còn mỏng. Báo cáo competitive trước có một nhận định đã lỗi thời về mock của Postman.
