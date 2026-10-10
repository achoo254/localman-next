# Review UI/UX Localman với dữ liệu nặng: từ `/projects` tới chi tiết project

Ngày 2026-10-10 12:02 (Asia/Saigon). Commit `785ccfb` (HEAD `main`). Reviewer: ui-ux-designer.

## Kết luận nhanh

Có 1 lỗi Critical đang chạy trên production: panel MCP (danh sách tool) hiện ở mọi tab của card endpoint, kể cả REST, Upstream, Request log và Inbox. Với 16 resource, panel này cao 2.342px và đẩy cây resource xuống quá màn hình đầu. Hai vấn đề High tiếp theo là hàng nút của node tràn khỏi card, và việc điều hướng cây sâu (chỉ thấy 4/10 cấp ở 1440px, thanh cuộn ngang nằm ngoài viewport). Hiệu năng ổn: cây vẽ xong trong ≤5ms sau khi API trả về. Không trang nào cuộn ngang ở 375px. axe gần như sạch ở cả hai theme.

Các vấn đề theo mức độ: 1 Critical, 2 High, 8 Medium, 6 Low.

## Phương pháp và môi trường

- Stack E2E local (`e2e/support/stack.ts`, port 46xx) chạy qua một script tạm. Script này build web với `VITE_FEATURES=mockMcp,mockPowerUps,apiClient,hybridMock`, đúng như `infra/localman/released-features`. Lưu ý: `stack.ts` của repo chỉ build `apiClient,hybridMock`, nên E2E trong repo không bao giờ thấy lỗi C1.
- Working tree đang có thay đổi chưa commit của session khác (header nav "Mock API / API Client", workbench API Client). Bản build có chứa các thay đổi đó, nhưng chúng không chạm vào trang projects, cây resource hay các modal. Các finding dưới đây không phụ thuộc vào chúng.
- Dữ liệu: user `e2e_uireview_heavy` được đặt `plan: "pro"` trực tiếp trong Mongo test. 7 project được tạo qua REST, đúng spec. `generate_all` chạy cho từng project, số record đã kiểm qua `GET /resources`: Shop 16×25, Deep 10×15, Wide 10×50, VN 5×10, 中文 7×12, Demo 2×10, Empty 0.
- Đã chụp 4 viewport × 2 theme (`localStorage["localman-theme"]`; app có nút đổi theme ở footer, mặc định theo `prefers-color-scheme`). Locale đặt qua `localStorage["localman-locale"]`. vi và zh-CN được chụp cho các trang có tên dài hoặc Unicode. Có 181 ảnh.
- Thư mục ảnh (viết tắt **S/** ở dưới): `/private/tmp/claude-501/-Users-hoandat-inet-gitlab-localman-next/f542bddd-caef-46d9-b236-64cd892c0dfc/scratchpad/ui-review/shots/`
- Số liệu thô nằm ở `.../scratchpad/ui-review/report-*.json` (overflow, chữ bị cắt, canvas, perf, axe).
- Stack đã dừng. `lsof` không còn port 46xx nào mở.

## Số đo chính

| Hạng mục | Kết quả |
|---|---|
| Cuộn ngang cả trang ở 375/768/1280/1440 | Không có ở trang nào (`scrollWidth == clientWidth`) |
| Thời gian vẽ cây (performance.now, 3 lần, local) | Tất cả project: 330–352ms từ lúc điều hướng, chỉ +2–5ms sau khi `/resources` trả về |
| Chọn node rồi vẽ lại | ≤28ms (Shop, 16 node) |
| Số DOM node | Shop 1.002, Deep/Wide 725, Empty 278 |
| Canvas Deep chain | `scrollWidth` 2.764px trong khung 1.070px (1440) hoặc 341px (375) |
| Thanh cuộn ngang của canvas | Ở y=3.557px với viewport 900px (Deep, 1440); y=6.170px ở 375 |
| Zoom/pan/tìm kiếm/thu gọn trong cây | Không có |
| axe WCAG 2.1 AA, 25 trang × 2 theme | 0 lỗi, trừ modal Data (xem M7). Lỗi contrast ở Empty-light chỉ xuất hiện khi modal đang fade-in; chạy lại sau 1,5s thì sạch |

## Critical

### C1. Panel MCP hiện ở mọi tab của card endpoint
- **Màn hình:** chi tiết project, mọi viewport và theme, cả 7 project.
- **Ảnh:** `S/detail-shop-1440-dark-fold.png` (tab REST đang chọn nhưng nội dung MCP vẫn hiện), `S/detail-shop-1440-dark.png` (toàn trang cao 5.150px), `S/tab-upstream-1440-dark.png`, `S/loading-tree-1440.png`.
- **Mô tả:** `endpoint-tabs.tsx` render `<TabsContent value="mcp" forceMount>`. Khi có `forceMount`, Radix không gắn `hidden` cho panel không chọn. Probe DOM cho kết quả: `project-detail-mcp` có `data-state="inactive"`, `hidden=false`, `offsetHeight=2342` ở cả 4 tab còn lại. Hệ quả:
  - REST hiện chồng với MCP.
  - Upstream, Request log và Inbox đều có 2.342px tool list bên dưới.
  - Cây resource bị đẩy xuống y≈2.700px (1440) và trang dài 8.965px ở 375.
  - Trong lúc load, panel MCP báo "Generated tools 0 – No tools yet" trong khi cây đang hiện skeleton, tức là báo rỗng sai (M6).
- **Phương án:**
  - **A.** Thêm `data-[state=inactive]:hidden` vào `TabsContent` của MCP. Giữ được ý đồ "panel vẫn mount để token hiện một lần không mất". Sửa 1 dòng, rủi ro thấp.
  - **B.** Bỏ `forceMount` và đưa token vừa tạo lên state của trang hoặc query cache. Sạch hơn về kiến trúc, nhưng phải sửa nhiều file và có rủi ro làm mất token.
  - **C.** Thêm `hidden` vào chính primitive `TabsContent` khi `forceMount && !active`. Mọi chỗ dùng sau này sẽ an toàn, nhưng đổi hành vi primitive dùng chung.
- **Khuyến nghị:** A ngay (hotfix). Kèm thêm `mockMcp` vào `VITE_FEATURES` của `e2e/support/stack.ts` và một assertion "chỉ một tabpanel hiển thị", để E2E bắt được lỗi này.

## High

### H1. Hàng hành động của node tràn khỏi card
- **Màn hình:** canvas, mọi viewport. Nặng hơn ở vi.
- **Ảnh:** `S/node-actions-1440-dark.png`, `S/node-actions-1440-light.png`, `S/node-actions-1440-dark-vi.png`, `S/node-actions-1440-dark-zh-CN.png`, `S/canvas-shop-375-start.png`.
- **Mô tả:** Card rộng 208px, nhưng hàng Edit/Data/API Client/Delete/`{}` cần 216px (EN) so với 180px khả dụng.
  - "API Client" xuống 2 dòng và lấn qua mép dưới card.
  - "Delete" đè lên viền phải.
  - Nút Export types `{}` nằm ngoài card, sát connector "nest". Người dùng dễ bấm nhầm connector.
  - Ở vi, cả "Dữ liệu" và "API Client" đều xuống dòng.
  - Ở 375/touch, hàng này luôn hiện nên lỗi lộ ra trên mọi node.
- **Phương án:**
  - **A.** Đổi các nút thành icon button 28px có tooltip và `aria-label` (đã có sẵn). Card gọn, không phụ thuộc độ dài bản dịch. Đổi lại, icon phải học, và bản dịch của tooltip vẫn cần.
  - **B.** Giữ 1–2 hành động chính (Data, Edit) và gom phần còn lại (API Client, Export types, Delete) vào menu "⋯" dùng `dropdown-menu` sẵn có. Dễ quét, Delete tách xa nên an toàn hơn. Đổi lại, cần thêm một lần bấm.
  - **C.** Nới node lên khoảng 248px. Đây là cách ít sửa nhất, nhưng làm H2 tệ hơn (cây 4 cấp đã phải cuộn ngang ở 1440).
- **Khuyến nghị:** B. Phương án này giải quyết cả độ dài bản dịch lẫn rủi ro bấm nhầm Delete, và không làm cây rộng thêm.

### H2. Cây sâu khó đọc và khó điều hướng: không zoom/pan, thanh cuộn ngang ở ngoài màn hình
- **Màn hình:** canvas của Deep chain, Shop, 中文; 1440, 768 và 375.
- **Ảnh:** `S/canvas-deep-1440-panel.png`, `S/canvas-deep-1440-scrolled-x.png`, `S/canvas-deep-1440-scrolled-y.png`, `S/canvas-deep-375-start.png`, `S/canvas-shop-1440-panel.png`, `S/detail-zh-tree-1440-light.png`.
- **Mô tả:** Layout đặt mỗi resource một hàng và mỗi cấp một cột 268px, nên cây sâu thành "bậc thang".
  - Ở 1440, khung 1.070px chỉ chứa 4 cấp. Shop (4 cấp) đã phải cuộn ngang (1.156px > 1.070px). Deep chain cần 2.764px, nhưng khoảng 75% diện tích canvas để trống.
  - Thanh cuộn ngang nằm ở đáy canvas (y=3.557px với viewport 900px). macOS lại ẩn thanh cuộn overlay, nên người dùng chuột không biết là có thể cuộn ngang.
  - Khi đã cuộn sang phải, rail "Add to root" và các cấp tổ tiên biến mất, nên mất ngữ cảnh "đang ở nhánh nào".
  - Ở 375, khung chỉ rộng 341px. Mở trang ra là thấy một vùng trống lớn, chỉ có rail.
  - Connector không rối (elbow gọn, không giao nhau) và nhãn không bị cắt với tên ngắn.
- **Phương án:**
  - **A.** Giới hạn chiều cao canvas bằng viewport trừ header, cho canvas tự cuộn dọc. Nhờ vậy thanh cuộn ngang luôn nằm trong màn hình. Thêm nút "Fit / 100%" (scale bằng CSS transform) và kéo-để-pan. Sửa vừa phải và giữ nguyên mô hình canvas. Đổi lại, có cuộn lồng trong cuộn trên mobile.
  - **B.** Thêm chế độ "Outline": danh sách thụt lề (dạng tree view) với cấp thụt khoảng 16px. Tự bật khi viewport <768px hoặc độ sâu >4; người dùng có thể đổi tay. Đọc được cây 10 cấp trên 375 mà không cần cuộn ngang. Đổi lại, phải làm thêm một view và một cách nest khác (menu "Move to…" thay cho connector).
  - **C.** Nén geometry: cột 268→220, node 208→176 khi độ sâu >4. Sửa ít nhất, nhưng chỉ cải thiện khoảng 20%, không giải quyết 10 cấp trên mobile, và còn làm H1 tệ hơn.
- **Khuyến nghị:** A trước, vì nó sửa đúng điểm đau "không thấy và không với tới" trên desktop. B là bước tiếp theo cho mobile. Không chọn C.

## Medium

### M1. Không tìm, không thu gọn được resource trong cây lớn; nhiều tab stop
- **Màn hình:** canvas Shop/Wide/Deep, 1440.
- **Ảnh:** `S/canvas-wide-1440-start.png`, `S/detail-shop-1440-dark.png`.
- **Mô tả:** Gói Pro cho phép tới 50 resource, nhưng cây không có ô tìm kiếm, không thu gọn/mở rộng nhánh, cũng không có breadcrumb vị trí. Wide root xếp 10 gốc theo chiều dọc (1.344px) và chỉ dùng khoảng 25% bề ngang. Riêng cây Wide (10 node) có 91 tab stop, khoảng 9 stop mỗi node, và không có link nhảy qua cây.
- **Phương án:**
  - **A.** Ô "Lọc resource" trên header card: làm nổi các node khớp, làm mờ phần còn lại, rồi `scrollIntoView` tới kết quả đầu. Rẻ và giá trị cao với 50 resource.
  - **B.** Nút thu gọn trên connector "out" của node có con, kèm badge "+n". Giảm chiều cao cây. Đổi lại, phải thêm state và cần layout lại.
  - **C.** Roving tabindex (`role="tree"`, phím mũi tên) để mỗi node chỉ còn 1 tab stop. Lợi lớn về a11y, nhưng sửa lớn trong `use-tree-connect`.
- **Khuyến nghị:** A, cộng thêm một skip link "Bỏ qua cây resource". C để sau.

### M2. Tên dài và Unicode bị cắt mà không có cách xem đầy đủ
- **Màn hình:** `/projects` ở 375 và 768; header chi tiết ở 375/768; node; tiêu đề modal.
- **Ảnh:** `S/projects-375-light.png`, `S/detail-long-vi-375-dark-fold.png`, `S/detail-long-vi-1440-dark.png`, `S/modal-edit-long-375-dark.png`, `S/modal-data-long-375-dark.png`.
- **Mô tả:**
  - h1 "UI test - Tên dự án tiếng Việt…" chỉ hiện 219/708px ở 375; "UI test - 中文项目 混合树" hiện 219/271px.
  - Cả h1 lẫn tên trong project row đều không có `title`.
  - Node cắt tên `customer-relationship-manage…` (174/538px). Hai resource có cùng tiền tố dài sẽ trông giống hệt nhau. `title` của link là "Open {url}", không dùng được trên touch.
  - Tiêu đề modal "Edit resource · opportuniti…" và ô Parent ID trong schema cũng bị cắt.
  - Dấu tiếng Việt và chữ Hán hiển thị đúng; font mono không lỗi glyph.
- **Phương án:**
  - **A.** Cho h1 và tên project trong row xuống tối đa 2 dòng (`line-clamp-2`), không cắt 1 dòng. Đổi lại, chiều cao row thay đổi theo tên.
  - **B.** Giữ 1 dòng nhưng thêm `title` hoặc tooltip có tên đầy đủ. Với node, dùng ellipsis ở giữa (`customer-rel…name-01`) để giữ phần đuôi phân biệt. Layout ổn định, nhưng tooltip không có trên touch.
  - **C.** A cho heading và row, B cho node và tiêu đề modal.
- **Khuyến nghị:** C.

### M3. Prefix dài trong URL mock tràn ra ngoài card ở 375
- **Màn hình:** card API endpoint, project VN, 375.
- **Ảnh:** `S/detail-long-vi-375-dark-fold.png`, `S/endpoint-long-375-en.png`.
- **Mô tả:** Chip `/very/long/prefix/for/layout/checks/v2` có `right=397px` trong khi viewport là 375px. Phần "/v2" bị cắt mất. Trang không cuộn ngang, nên người dùng không thấy phần đó. Ở 1440 thì hiển thị đúng.
- **Phương án:**
  - **A.** Cho chip ngắt dòng ở dấu `/` (`overflow-wrap:anywhere`). Đọc được đủ URL, nhưng chip cao thêm 1–2 dòng.
  - **B.** Rút gọn giữa (`/very/…/checks/v2`) và thêm nút copy URL đầy đủ ngay cạnh. Gọn, nhưng giấu thông tin.
  - **C.** Cuộn ngang trong chip, có mép mờ. Giữ 1 dòng, nhưng khó phát hiện trên mobile.
- **Khuyến nghị:** A, vì URL mock là thứ người dùng cần đọc và copy chính xác.

### M4. Khoá cha (`parentKey`) sinh sai hoặc khó dùng (đã kiểm chứng)
- **Màn hình:** modal Edit (dòng Parent ID), dữ liệu mock, export types.
- **Ảnh:** `S/modal-edit-long-375-dark.png`, `S/modal-data-long-375-dark.png`.
- **Mô tả:** `singular()` trong `packages/shared/src/resource-constants.ts` chỉ áp các luật -ies, -es và -s. Kết quả đo được qua `GET /resources` và `parentKeyOf`:

  | Tên cha | parentKey thực tế | Mong đợi |
  |---|---|---|
  | `quizzes` | `quizzId` | `quizId` |
  | `statuses` | `statuseId` | `statusId` |
  | `analyses` | `analyseId` | `analysisId` |
  | `people` | `peopleId` | `personId` |
  | `series` | `seryId` | `seriesId` |
  | `news` | `newId` | `newsId` |
  | `children` | `childrenId` | `childId` |
  | `indices` | `indiceId` | `indexId` |
  | `buses` | `buseId` | `busId` |
  | `heroes` | `heroeId` | `heroId` |
  | `customer-relationship-…-01` | `customer-relationship-…-01Id` | `customerRelationship…01Id` |

  Các trường hợp đúng: `categories` thành `categoryId`, `addresses` thành `addressId`, `boxes` thành `boxId`, `wishlists` thành `wishlistId`, `courses` thành `courseId`, `data` thành `dataId` (chấp nhận được).

  Khoá có dấu `-` không phải định danh JS. Export TS vẫn đúng vì có quote key, nhưng client phải viết `r["…-01Id"]`.

  `parentKey` được **tính lúc đọc** từ tên cha (record chỉ lưu `parentRecordId`). Vì vậy đổi luật sẽ đổi tên field trả về của project đang tồn tại, kể cả bộ lọc `?xId=`. Đây là breaking change với client của người dùng.
- **Phương án:**
  - **A.** Sửa `singular()` (bảng bất quy tắc nhỏ cộng luật -zzes, -uses, -ses→-sis) và camelCase các tên có `-` cho mọi project. Kết quả đúng ngay, nhưng phá client hiện có. Cần thông báo hoặc migration.
  - **B.** Lưu `parentKey` trên resource lúc tạo hoặc nest (dùng luật mới), cho sửa trong modal Edit, và để resource cũ giữ khoá cũ (backfill bằng giá trị hiện tại). Không phá client cũ và người dùng chủ động được. Đổi lại, phải sửa schema và API (L).
  - **C.** Chỉ cảnh báo trong form khi khoá sinh ra không phải định danh JS. Rẻ, nhưng không sửa gốc.
- **Khuyến nghị:** B. Đây là quyết định về contract API mock, cần Jev duyệt.

### M5. Tên project không nhận `.` hay `·` (đã kiểm chứng)
- **Màn hình:** form tạo/sửa project.
- **Mô tả:** `PROJECT_NAME_PATTERN = /^[\p{L}\p{N}][\p{L}\p{M}\p{N}_ ()-]*$/u`. `POST /projects` với "Shop v2.0" và "Shop · v2" đều trả 400 `VALIDATION_ERROR`; "Shop v2" trả 201. Tên kiểu phiên bản (v2.0) là rất phổ biến. Tên project chỉ để hiển thị; slug MCP đã tự làm sạch.
- **Phương án:**
  - **A.** Cho thêm `.` `·` `,` `&` `+` `'` `:` vào pattern, cập nhật thông báo lỗi ở 3 locale, và kiểm `copy-name` / slug. Đổi lại, phải soát mọi chỗ dùng tên (tên file export, slug).
  - **B.** Giữ regex nhưng hiển thị ký tự cho phép ngay dưới ô nhập, trước khi người dùng submit. Không phải sửa backend, nhưng vẫn chặn nhu cầu thật.
- **Khuyến nghị:** A.

### M6. Trạng thái loading báo sai và nhảy layout
- **Ảnh:** `S/loading-tree-1440.png`, `S/loading-detail-shop-1440.png`, `S/loading-detail-shop-1440-phase2.png`, `S/loading-projects-375.png`.
- **Mô tả:**
  1. Khi `/resources` chậm, cây hiện skeleton (đúng) nhưng panel MCP (lộ ra vì C1) ghi "Generated tools 0 – No tools yet. Add a resource…", tức là báo rỗng sai.
  2. Khi tải nguội và API chậm, skeleton đầu tiên phủ sát mép viewport, không có header, không theo container `max-w-page`, rồi nhảy sang layout căn giữa. Ở 375, góc bo của card bị cắt.
  - Skeleton phase 2 (header, card, cây giả) đúng hình và đẹp.
- **Phương án:**
  - **A.** MCP panel coi "resources đang tải" là loading (dùng `isPending` của query). Đặt skeleton nguội bên trong khung shell, cùng container và cùng header giả.
  - **B.** Chỉ sửa C1. Lỗi 1 sẽ mất khi người dùng ở tab REST, nhưng vẫn còn ở tab MCP.
- **Khuyến nghị:** A.

### M7. Modal Data: chỉ có JSON thô, có 1 lỗi axe serious
- **Ảnh:** `S/modal-data-1440-dark.png`, `S/modal-data-long-375-dark.png`.
- **Mô tả:** Với 25–50 record, modal không có số đếm, tìm theo id hay dạng bảng; dòng dài bị cắt ngang. axe báo `scrollable-region-focusable` (serious) trên `.cm-scroller` (`tabindex="-1"`): người dùng bàn phím không cuộn được vùng này khi editor chưa focus.
- **Phương án:**
  - **A.** Header ghi "50 records", ô "Go to id", nút bật/tắt wrap dòng; sửa lỗi axe bằng cách cho vùng cuộn nhận focus (`tabindex=0` kèm label). Sửa nhỏ.
  - **B.** Thêm tab "Table" chỉ đọc, phân trang. Hợp với dữ liệu lớn, nhưng là thêm một view mới.
- **Khuyến nghị:** A.

### M8. Callbacks trong modal Edit: hai nút lưu song song
- **Ảnh:** `S/modal-edit-callbacks-1440-dark.png`, `S/modal-edit-callbacks-added-1440-dark.png`, `S/modal-edit-1440-dark.png`.
- **Mô tả:** Callbacks nằm cuối một modal rất dài (schema, template, 5 endpoint, rules/chaos). Phần này có nút "Save callbacks" riêng, cạnh nút "Update" ở footer. Ngay UI cũng phải giải thích: "Save callbacks keeps them, the resource button does not". Mô hình hai nút lưu dễ làm mất thay đổi.
- **Phương án:**
  - **A.** Chia modal thành các tab Schema / Endpoints / Callbacks. Tab Callbacks có footer lưu riêng. Ranh giới rõ, modal ngắn lại. Đổi lại, phải dựng lại cấu trúc modal.
  - **B.** Nút "Update" lưu luôn callbacks (gọi tuần tự hai API, báo lỗi theo từng phần). Một nút duy nhất, nhưng phải xử lý trường hợp lưu được một phần.
  - **C.** Giữ như cũ, nhưng chặn đóng modal khi callbacks chưa lưu. Rẻ, nhưng vẫn rối.
- **Khuyến nghị:** A.

## Low

### L1. Project rỗng tự mở modal "New resource" mỗi lần vào trang
- **Ảnh:** `S/detail-empty-1440-dark-fold.png`, `S/detail-empty-1440-light-modal.png`.
- **Mô tả:** `useFirstResourcePrompt` dùng `useRef` theo lần mount, nên modal bật lại mỗi lần vào trang. Người dùng chỉ muốn xem URL hay MCP cũng phải đóng modal trước.
- **Phương án:** A. Chỉ tự mở một lần cho mỗi project (lưu `localStorage`). B. Chỉ tự mở ngay sau khi vừa tạo project.
- **Khuyến nghị:** B.

### L2. Danh sách `/projects` thiếu thông tin và khó phân biệt
- **Ảnh:** `S/projects-1440-dark.png`, `S/projects-375-light.png`.
- **Mô tả:** Card không có số resource, số record hay thời gian cập nhật; project rỗng trông như mọi project khác. Avatar lấy chữ cái đầu nên 6 project "UI test…" đều là "U" cùng màu. Gói Pro cho tới 20 project nhưng danh sách không có tìm kiếm hay sắp xếp.
- **Phương án:** A. Thêm dòng meta "16 resources · 400 records" (API cần trả `resourceCount`). B. Avatar lấy 2 ký tự đầu của từ có nghĩa, màu băm theo id.
- **Khuyến nghị:** A, vì nó giúp tìm project rỗng hoặc nặng nhanh.

### L3. Xác nhận "Generate all" liệt kê từng resource
- **Ảnh:** `S/modal-generate-all-1440-dark.png`.
- **Mô tả:** Modal có 16 dòng "users: 25 → 25 records", sẽ thành 50 dòng ở mức tối đa.
- **Phương án:** A. Tóm tắt "16 resources, 400 → 400 records" và để danh sách chi tiết trong phần thu gọn được. B. Giữ nguyên nhưng giới hạn chiều cao và cho cuộn.
- **Khuyến nghị:** A.

### L4. Tên MCP server bỏ mất ký tự không phải Latin
- **Ảnh:** `S/detail-zh-tree-1440-light.png`.
- **Mô tả:** "UI test - 中文项目 混合树" sinh lệnh `claude mcp add … localman-ui-test`. Hai project chỉ khác nhau ở phần chữ Hán sẽ ra cùng tên, trái với comment "two never collide" trong `mcp-snippets.ts`.
- **Phương án:** A. Gắn hậu tố 4–6 ký tự của id project khi slug bị rút gọn. B. Luôn gắn hậu tố id.
- **Khuyến nghị:** A.

### L5. Hàng tab ở 375 bị cắt mà không có dấu hiệu cuộn
- **Ảnh:** `S/detail-long-vi-375-dark-fold.png`.
- **Mô tả:** "Inbox" bị cắt thành "In…". Danh sách tab cuộn được nhưng không có gợi ý nào cho thấy điều đó.
- **Phương án:** A. Làm mờ mép phải và tự cuộn tab đang chọn vào giữa. B. Dùng `<select>` thay cho tab khi màn hình <400px.
- **Khuyến nghị:** A.

### L6. Canvas Wide root ở 375 vẫn cuộn ngang 11px
- **Ảnh:** `S/canvas-wide-375-start.png`.
- **Mô tả:** Canvas có `scrollWidth` 352px trong khung 341px, dù cây chỉ có một cấp.
- **Phương án:** Giảm `originX`/padding ở màn hẹp, hoặc dùng chế độ Outline từ H2-B.
- **Khuyến nghị:** Giảm `originX`/padding.

## Những điểm đã ổn
- Không trang nào cuộn ngang ngoài ý muốn, ở cả 4 viewport và 3 ngôn ngữ.
- Theme sáng và tối đều đạt tương phản AA theo axe.
- Breadcrumb "Projects / tên" rõ; tab endpoint giữ trạng thái trong `?endpoint=`.
- Connector dạng elbow gọn, không giao nhau, kể cả ở cây 16 node.
- Skeleton của trang chi tiết đúng hình bố cục thật.

## Câu hỏi còn mở cho Jev
1. M4: có chấp nhận đổi contract `parentKey` (phương án B, có lưu trữ) không, hay chỉ áp luật mới cho resource tạo sau?
2. H2: ưu tiên desktop (A: zoom/fit, cuộn trong canvas) hay mobile (B: Outline view) trước?
3. C1: có muốn bổ sung `mockMcp` vào stack E2E của repo trong cùng lần hotfix không? (Đây là thay đổi ngoài `apps/`.)
