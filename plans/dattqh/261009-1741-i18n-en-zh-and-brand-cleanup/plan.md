---
title: "Đa ngôn ngữ (English mặc định, 中文, Tiếng Việt) và bỏ tên đối thủ khỏi app"
status: in-progress
created: 2026-10-09
tier: L
---

# Đa ngôn ngữ và bỏ tên đối thủ

## Yêu cầu (user, 2026-10-09)
- Thêm tiếng Anh và tiếng Trung; **mặc định tiếng Anh**. Tiếng Việt giữ lại.
- Bỏ tên mockapi.io và Postman khỏi **toàn bộ app** (trang chủ và mọi trang người dùng thấy).

## Quyết định
- Bỏ hẳn khối "So sánh" trên landing và `apps/web/src/content/competitor-facts.ts`: bỏ tên thì bảng mất ý nghĩa và số liệu không còn nguồn để dẫn. Code comment, plan và báo cáo nội bộ không phải UI nên giữ.
- i18n tự viết, không thêm thư viện (giữ Lighthouse landing ≥ 90): từ điển `en` là nguồn kiểu; `vi` và `zh-CN` phải đủ key (typecheck báo thiếu); số nhiều qua `Intl.PluralRules`, số và ngày qua `Intl`. `en` nằm trong bundle chính, `vi` và `zh-CN` tải lazy khi được chọn.
- Ngôn ngữ mặc định `en`. Chọn ở header/footer, nhớ trong `localStorage` (bọc try/catch); người đã đăng nhập thì lưu vào hồ sơ (`locale` của user) để thông báo trong app, Web Push và Telegram dùng đúng ngôn ngữ. `<html lang>` đổi theo. Landing prerender bằng `en`.
- Tiếng Trung là giản thể (`zh-CN`).
- Thuật ngữ kỹ thuật giữ tiếng Anh ở mọi ngôn ngữ khi `docs/ux-writing.md` quy định (mock, resource, endpoint, project, schema…).

## Phase
| # | Việc | Tier | Phụ thuộc |
|---|---|---|---|
| 1 | Nền i18n web (provider, `t()`, từ điển, chọn ngôn ngữ, lazy load, prerender `en`, test kiểm đủ key) + bỏ khối So sánh và mọi tên đối thủ | M | phase 17 T6/T7 xong (tránh sửa chồng) |
| 2 | Chuyển chuỗi theo khu vực, chạy song song theo sở hữu file: (a) landing + docs + layout + auth; (b) projects + project detail + resources + resource tree; (c) collaborators + subscription + feedback + account + notifications + admin + invite + MCP tab | L | 1 |
| 3 | API: `locale` trên user (operation đổi ngôn ngữ), mẫu thông báo trong app/Web Push/Telegram theo `locale`, mặc định `en` | M | 1 |
| 4 | Rà bản dịch theo `docs/ux-writing.md` (thêm mục en/zh), axe, Lighthouse landing, review, deploy | M | 2, 3 |

## Nghiệm thu
- Mở app lần đầu: toàn bộ giao diện tiếng Anh; đổi sang 中文/Tiếng Việt thì mọi chuỗi người dùng thấy đổi theo, tải lại vẫn giữ.
- Không còn chuỗi tiếng Việt hard-code trong `apps/web/src` ngoài từ điển `vi` (script kiểm trong CI).
- `grep -ri "mockapi\|postman"` trên `apps/web/src` (trừ test và comment) và trên HTML production không còn kết quả.
- Lighthouse landing mobile: Performance và Accessibility ≥ 90.
- `pnpm lint && pnpm typecheck && pnpm test && pnpm check:mcp-coverage && pnpm e2e` sạch.
