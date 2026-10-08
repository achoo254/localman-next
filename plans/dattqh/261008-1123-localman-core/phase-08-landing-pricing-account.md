---
phase: 8
title: "Landing, pricing, account"
status: pending
priority: P2
effort: "M"
dependencies: [3, 6]
---

# Phase 08: Landing, pricing, account

## Goal
Làm landing giới thiệu sản phẩm, có demo tương tác dùng lại canvas cây, bảng giá theo đúng hạn mức, và menu tài khoản. Copy viết tiếng Việt.

## Files to Create / Modify
- Create `apps/web/src/content/competitor-facts.ts`, `apps/web/src/pages/landing/comparison-section.tsx`, `live-mock-sync-section.tsx`, `apps/web/src/pages/landing/landing-page.tsx`, `hero-section.tsx`, `pricing-section.tsx`, `pricing-table.tsx` (dùng `plan-limits` từ shared), `data-modeling-demo.tsx`, `relations-demo.tsx` (dùng `resource-tree-canvas` ở chế độ `demo`, kèm `generated-endpoints-list.tsx`), `more-features-section.tsx`
- Create `apps/web/src/components/layout/app-header.tsx` (wordmark, link Docs, menu tài khoản gồm Quản lý gói, Đổi email, Thông báo (kênh), Mã khôi phục, Đăng xuất) và `app-footer.tsx` (link "Góp ý / Liên hệ" mở form trong app thay cho địa chỉ email). Create `apps/web/src/features/feedback/feedback-form.tsx`; Modify `apps/api/src/modules/feedback/` (nền đã tạo ở phase 03; thêm `type: 'contact'`, lưu vào Mongo kèm trang admin inbox, rồi bot gửi tới Telegram của owner qua `OWNER_TELEGRAM_CHAT_ID`; rate-limit theo IP, có honeypot chống spam). Jev 0.81
- Create `apps/web/src/pages/docs/` hoặc link sang trang docs: Quick start, Code examples, Custom responses (viết lại bằng nội dung của mình)

## Tasks & Steps
1. Bố cục landing giữ khung của nguồn, nhưng **dẫn bằng keyword riêng** (Jev quyết, xem `../reports/competitive-261008-1308-localman-vs-mockapi-postman.md`):
   - **Hero, keyword chính "Localhost ngay trên trình duyệt":** chẳng hạn "Test API localhost ngay trên trình duyệt, không cần cài app hay extension, chỉ một lệnh Tunelo" (Hoppscotch web gọi localhost được qua extension hoặc Agent, nên phải ghi rõ khác biệt), phụ đề nhắc Tunelo tự nhận tunnel. Có 2 CTA: "Bắt đầu miễn phí" dẫn `/signup`, và "Xem cách hoạt động" cuộn xuống demo.
   - **Khối "Secret không rời trình duyệt"** (sau cờ `features.directMode`): request gửi thẳng từ trình duyệt khi đích cho phép; khi phải qua proxy thì hỏi trước. Câu chữ trung thực, link tới trang "Dữ liệu của bạn nằm ở đâu" (phase 21).
   - **Khối "Mock lai localhost"** (sau cờ `features.hybridMock`): sơ đồ route mock và route đi vào tunnel.
   - **Khối keyword phụ "Live Mock Sync":** minh hoạ đổi schema của mock thì collection tự cập nhật (diff trước và sau).
   - **Khối "So sánh":** bảng Localman, mockapi.io và Postman, gồm số user Free, số project/resource, custom response, gọi localhost từ web, mock có trạng thái kèm quan hệ, và thời gian khôi phục. Số liệu kèm "cập nhật ngày …" và link nguồn; chỉ ghi tên đối thủ, không dùng logo. Số liệu nằm trong `apps/web/src/content/competitor-facts.ts` để dễ cập nhật.
   - **2 thẻ giá: Free và Pro.** Hạn mức render từ `plan-limits`. Thẻ Pro **không ghi giá và không ghi "chưa chốt"**, chỉ có nút **"Liên hệ"** mở form quan tâm Pro (phase 03), để đếm được có bao nhiêu người quan tâm (user chốt 2026-10-08). Khi có billing thì thay bằng giá Tháng/Năm. Thẻ Free ghi rõ 3 project, 10 resource, custom response, 3 thành viên, 10.000 request tới mock và 5.000 request qua proxy mỗi tháng, trash 30 ngày.
   - Khối "Mô hình dữ liệu đơn giản" (lưới 8 cột: chữ 3, demo 5) với bảng schema demo.
   - Khối "Quan hệ giữa resources": demo cây, kéo lồng thì list "Endpoint được sinh" cập nhật live, sắp xếp theo độ sâu.
   - Khối "Và nhiều hơn" với các link docs, Custom endpoints và Webhooks gắn badge "Sắp có".
2. **Không quảng cáo trước khi có tính năng.** Hero "Localhost ngay trên trình duyệt" và khối Live Mock Sync nằm sau cờ `features.apiClient`, `features.liveMockSync` và `features.mockMcp` (khối "Mock MCP tức thì" kèm snippet `claude mcp add`) trong `apps/web/src/config/features.ts`. Chỉ bật khi tính năng tương ứng đã lên production: phase 10 cùng plan Tunelo, phase 16, và phase 17. Trước đó hero hiện thông điệp của phần mock: "Mock REST API có trạng thái, quan hệ và Faker, gói Free 3 project".
3. Hình ảnh nếu có chỉ dùng ảnh giấy phép CC0 (ví dụ Unsplash, Pexels) hoặc minh hoạ tự vẽ; ghi nguồn trong `apps/web/src/content/image-credits.ts`.
4. Thêm SEO cơ bản: title, description, OG tags.

## Verification
- Bảng so sánh render từ `competitor-facts.ts` và có ngày cập nhật. Thẻ giá khớp `plan-limits` (test snapshot).
- Demo quan hệ cập nhật đúng endpoint với 4 cấu hình cây mẫu (tương đương bộ mẫu trong bundle nguồn).
- Lighthouse cho landing: Performance và Accessibility đều ≥ 90.
- Rà copy landing theo checklist văn phong trong `docs/ux-writing.md` (rõ, ngắn, đúng thuật ngữ EN).

## Giao việc
**Đợt:** 2 · **Phụ thuộc trước khi bắt đầu:** phase 03 (`plan-limits` trên UI, form quan tâm Pro, nền module `feedback`), phase 06 (`resource-tree-canvas`); `app-header.tsx` tối thiểu đã có từ phase 02 · **Lệnh cook:** `/ak:cook plans/dattqh/261008-1123-localman-core/phase-08-landing-pricing-account.md`

| # | Việc | Vai trò | Song song | File chính |
|---|---|---|---|---|
| T1 | Đối chiếu prototype `prototype/index.html#/` (landing), `#/account` và form góp ý (`openFeedback`); chốt bố cục, copy tiếng Việt và state theo cờ tính năng; ảnh nếu có chỉ dùng ảnh CC0 | ui-ux-designer | với T2, T3 | `prototype/index.html` (chỉ đọc) |
| T2 | `config/features.ts` (cờ `apiClient`, `liveMockSync`, `mockMcp`, `directMode`, `hybridMock`, mặc định tắt), `content/competitor-facts.ts` (có ngày cập nhật và link nguồn), `hero-section` (hai thông điệp theo cờ), `comparison-section`, `live-mock-sync-section`, `pricing-section` và `pricing-table` (render từ `plan-limits`; thẻ Pro chỉ có nút "Liên hệ" mở form quan tâm Pro) | fullstack-developer | với T3 | `apps/web/src/config/features.ts`, `apps/web/src/content/competitor-facts.ts`, `apps/web/src/pages/landing/{hero,comparison,live-mock-sync,pricing}-section.tsx`, `pricing-table.tsx` |
| T3 | `data-modeling-demo` (lưới 8 cột, bảng schema demo), `relations-demo` dùng `resource-tree-canvas` chế độ `demo` cùng `generated-endpoints-list` (sắp theo độ sâu, cập nhật live khi kéo lồng), `more-features-section` (Custom endpoints và Webhooks gắn badge "Sắp có") | fullstack-developer | với T2 | `apps/web/src/pages/landing/{data-modeling-demo,relations-demo,generated-endpoints-list,more-features-section}.tsx`, `apps/web/src/features/resource-tree/resource-tree-canvas.tsx` |
| T4 | Ghép `landing-page.tsx` theo thứ tự khối ở bước 1, SEO (title, description, OG tags); mở rộng `app-header.tsx` của phase 02 với link Docs và menu Quản lý gói, Đổi email, Thông báo (kênh), Mã khôi phục, Đăng xuất | fullstack-developer | — (sau T2, T3) | `apps/web/src/pages/landing/landing-page.tsx`, `apps/web/src/components/layout/app-header.tsx` |
| T5 | Form góp ý: thêm `type: 'contact'` vào module `feedback` (Telegram về owner, rate-limit IP, honeypot), trang admin inbox, `feedback-form.tsx`, `app-footer.tsx` có link "Góp ý / Liên hệ" | fullstack-developer | với T4, T6 | `apps/api/src/modules/feedback/*`, `apps/web/src/features/feedback/feedback-form.tsx`, `apps/web/src/components/layout/app-footer.tsx`, `apps/web/src/pages/admin/feedback-inbox-page.tsx` |
| T6 | Viết trang docs Quick start, Code examples và Custom responses bằng nội dung của mình (không chép copy của nguồn) | docs-manager | với T4, T5 | `apps/web/src/pages/docs/*` |
| T7 | Test snapshot thẻ giá khớp `plan-limits`; bảng so sánh render từ `competitor-facts.ts` có ngày cập nhật; relations demo đúng endpoint với 4 cấu hình cây mẫu; chạy Lighthouse cho landing | tester | với T8 | `apps/web/src/pages/landing/*.test.tsx` |
| T8 | Rà copy landing theo `docs/ux-writing.md`, chạy `pnpm check:tokens` và axe-core trên các file mới; sửa vi phạm | ui-ux-designer | với T7 | `apps/web/src/pages/landing/*`, `apps/web/src/components/layout/*` |
| T9 | Review cuối phase, kiểm không quảng cáo keyword khi cờ chưa bật | code-reviewer | — | toàn phase |

### Checklist
- [ ] T1 Bố cục, copy và state landing đã chốt theo prototype
- [ ] T2 Cờ tính năng, hero, so sánh, Live Mock Sync và bảng giá xong
- [ ] T3 Các demo và khối "Và nhiều hơn" xong
- [ ] T4 Landing đã ghép, SEO và header đầy đủ
- [ ] T5 Form góp ý, inbox admin và footer xong
- [ ] T6 Ba trang docs xong
- [ ] T7 Snapshot, demo và Lighthouse đạt
- [ ] T8 Copy, token và brand không còn vi phạm high
- [ ] T9 Review không còn finding chặn
- [ ] Verification: bảng so sánh render từ `competitor-facts.ts` và có ngày cập nhật; thẻ giá khớp `plan-limits` (snapshot)
- [ ] Verification: relations demo cập nhật đúng endpoint với 4 cấu hình cây mẫu
- [ ] Verification: Lighthouse landing có Performance và Accessibility ≥ 90
- [ ] Verification: copy landing đã rà theo `docs/ux-writing.md`
- [ ] `pnpm lint && pnpm typecheck && pnpm test` sạch
- [ ] `pnpm check:mcp-coverage` pass
