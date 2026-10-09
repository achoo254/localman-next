# Rà bản dịch en / zh-CN (bước 4 của plan i18n)

Ngày 2026-10-09. Phạm vi: `apps/web/src/i18n/messages/{en,zh-CN}/*.ts` và `apps/api/src/i18n/messages/{en,zh-cn}.ts`, đối chiếu `docs/ux-writing.md` §8, §9 và `docs/i18n.md`. Không đổi key, không đổi cấu trúc. Bản `vi` chỉ được kiểm placeholder, thẻ và dạng số nhiều qua `dictionaries.test.ts`, không rà câu chữ.

## Đã sửa

**English: 19 chỗ** (18 web, 1 API)

| Loại | Số chỗ | Ví dụ |
|---|---|---|
| Tự nhiên, ngữ pháp, câu dịch sát tiếng Việt | 13 | "projects that run for real" → "projects in real use"; "Leave it if you'd like a reply" → "Add one if you'd like a reply"; "Couldn't send. Your message is still here, try again." (nối hai câu bằng dấu phẩy) → "…, so you can try again."; "Reload the page to update." → "…to see the latest data."; "Member number {count} needs the Pro plan." → "Member #{count} requires the Pro plan." |
| Nhất quán | 4 | "API Client" → "API client"; "Back to projects" → "Back to Projects" (giống admin và invite); "grey" → "gray" (US English như phần còn lại); nhãn sự kiện ở API khớp với web ("A shared project's mock URL changed") |
| Dấu câu | 2 | `"{name}"` → `“{name}”` như các câu khác; "Sent, thank you" → "Sent. Thank you" |

Không sửa `docs.mcp.toolSummaries`: phần này phải trùng summary trong registry (`scripts/check-mcp-docs`).

**中文: 121 chỗ** (web và `zh-cn.ts` của API)

| Loại | Số chỗ | Nội dung |
|---|---|---|
| Thống nhất "账号" | 15 | Trước đây dùng lẫn 账户 (15 chỗ) và 账号 (18 chỗ); giờ chỉ còn 账号 |
| Thuật ngữ theo §2/§9 | 42 | Danh từ HTTP "请求" → "request", "请求头" → "header"; "root" → "根级" (giống `docs-mcp`); "自定义响应" và "自定义 response" → "Custom response"; "模板" → "template"; "Faker method" → "Faker 方法"; "Owner"/"owner" → "所有者"; `Mock` trong `<code>` và tiêu đề → `mock` |
| Viết hoa thuật ngữ Latin ở đầu câu | 46 | "project 所有者…" → "Project 所有者…", "body 是 JSON…" → "Body 是 JSON…" (cách file đã dùng: "Project 包含", "Prefix 最多"). Tên resource và identifier (`users`, `orders`, `fetch`, `hoandat`) giữ chữ thường |
| Dấu câu toàn角 | 3 | `你在 “List {name}” 中` → `你在“List {name}”中`; thông báo API dùng `“…”` thay `"…"`, bỏ khoảng trắng trước dấu ngoặc toàn角 |
| Khoảng trắng Hán–Latin | 3 | `复制{item}` ra "复制token": đổi item thành "该 URL"/"该 token" và câu lỗi thành "请手动选中并复制{item}。" để `{item}` không bao giờ dính chữ Latin vào chữ Hán. Lời mời ở API không còn "Project 所有者 邀请你" (thừa khoảng trắng khi không có tên người mời) |
| Văn phong | 10 | "按请求删除" → "应本人要求删除"; "MCP 项目" → "MCP 官方" (tránh lẫn với project); "内容最多 {max} 个字符"; "为实际使用中的 project…" |
| Nhất quán với en | 2 | "API client", "返回 Projects" |

Quét lại sau khi sửa: không còn chữ Việt trong bản 中文, không còn chữ Hán dính chữ Latin hay số ngoài thẻ, không còn dấu câu ASCII sát chữ Hán, không có tên đối thủ trong 6 từ điển.

**Test đổi theo câu mới: 10 file.** Web có 7 file: `resource-errors`, `collaborators-limit`, `feedback-form`, `feedback-form-errors`, `pro-interest-page`, `language-switcher`, `primitives-page`. API có 3 file: `notification-locale`, `user-locale`, `owner-alert-locale`.

## Kiểm tra

- `tsc --noEmit`: web 0 lỗi, api 0 lỗi.
- `pnpm check:i18n`: "No competitor names", "No Vietnamese outside the vi dictionary".
- `biome check`: 50 file từ điển và 10 file test, không có diagnostic.
- `pnpm test --maxWorkers=2`: lần đầu 11 test hỏng vì câu đổi (đã sửa test). Lần sau: 240/240 file, 1399/1399 test pass.
- `pnpm --filter @localman/web build`: xong trong 2.63 s, không có warning.

Lighthouse 12.6.0, mobile, chạy trên `vite preview :4173` (preview đã dừng sau khi đo):

| URL | Perf | A11y | Best practices | SEO | FCP | LCP | CLS |
|---|---|---|---|---|---|---|---|
| `/` | 99 | 100 | 96 | 100 | 1.7 s | 1.7 s | 0.019 |
| `/?lang=zh-CN` | 96 | 100 | 96 | 100 | 1.7 s | 1.7 s | 0.107 |

Best practices 96 ở cả hai lần là do `errors-in-console`, vì preview không có API: `/api/v1/users/me` trả 500 và `/favicon.ico` trả 404. Lỗi này không xuất hiện trên production có API.

## Cần user quyết

1. **"request" hay "请求" trong bản 中文.** Tôi làm theo `docs/ux-writing.md` §9 (request giữ tiếng Anh), nên giờ có "每月 10,000 次 mock request". Lập trình viên Trung Quốc thường viết "请求" ở chỗ đếm hạn mức. Khuyến nghị: giữ như hiện tại cho thống nhất với tài liệu. Nếu muốn dùng "请求" thì phải sửa §9 trước, sau đó đổi khoảng 20 chỗ.
2. **CLS 0.107 của `/?lang=zh-CN`** (ngưỡng tốt là ≤ 0.1). Khung `landing-hero-preview` bị xê dịch khi landing đã prerender bằng `en` rồi mới chuyển sang 中文. Đây là chuyện layout chứ không phải từ điển. Hướng sửa: đặt `min-height` cố định cho khung preview, hoặc tải sẵn dictionary trước khi hydrate khi URL có `?lang=`. Điểm Perf vẫn 96, đạt tiêu chí ≥ 90.
3. Các việc còn lại của bước 4 (axe, review, deploy) không nằm trong lượt này.
