---
phase: 6
title: "UI Project detail: canvas cây resource và các modal"
status: completed
priority: P1
effort: "L"
dependencies: [4]
---

# Phase 06: UI Project detail

## Goal
Làm màn `/projects/:id` có tương tác giống nguồn: thẻ API endpoint, canvas SVG cây resource có thanh generator và thao tác lồng, cùng các modal Resource, Data và Delete. Màn này phải đã được duyệt qua prototype.

## Files to Create / Modify
- Create `apps/web/src/pages/project-detail/project-detail-page.tsx`, `api-endpoint-card.tsx` (URL tô màu từng phần: secret, prefix, `:endpoint`, mỗi phần có tooltip; footer gồm New resource, Generate all, Reset all)
- Create `apps/web/src/features/resource-tree/`:
  - `tree-layout.ts`: hàm thuần, đầu vào là cây resource, đầu ra là `{nodes, links, connectors}` với cột 150px, hàng 50px và đường nối gấp khúc giống nguồn.
  - `resource-tree-canvas.tsx`
  - `resource-node.tsx`: tên resource dạng link mở mock URL, cùng thanh generator 106×25.
  - `generator-bar.tsx`: rê chuột hiện giá trị 0–100 tại vị trí con trỏ, click thì gọi generate. Thanh tô theo `count`, animation 200ms.
  - `add-to-root-rail.tsx`
  - `use-tree-connect.ts`: chọn node rồi click connector của node khác để lồng; `canConnect` chặn chính nó, quan hệ cha–con trực tiếp, tên trùng và chu trình.
  - `node-actions.tsx`: Edit, Data, Delete, hiện khi hover hoặc focus.
- Create `apps/web/src/features/resources/resource-form-modal.tsx`, `schema-editor.tsx` (lưới 10 cột), `faker-method-select.tsx` (combobox tìm kiếm trên khoảng 250 method), `object-template-editor.tsx`, `endpoints-editor.tsx`, `resource-data-modal.tsx`, `delete-resource-modal.tsx` (không tạo `requires-subscription-notice.tsx`, vì bước 4 mở template và endpoints cho mọi gói)
- Create `apps/web/src/components/ui/json-editor.tsx` (CodeMirror 6 chế độ JSON, validate khi blur)

## Tasks & Steps
1. Gọi API phase 04 qua TanStack Query, cập nhật lạc quan (optimistic) cho `count` và rollback khi lỗi, như nguồn đang làm.
2. Đặt layout trong container `overflow-x-auto` để cây rộng tự cuộn ngang. Trang không được cuộn ngang ở 375px.
3. Bàn phím (cải thiện so với nguồn, không đổi hành vi):
   - Node focus được bằng Tab.
   - Trên generator bar, ←/→ chỉnh giá trị theo bước 10 và Enter để sinh.
   - Thanh generator có `aria-valuenow`.
4. Modal Resource:
   - Tên resource.
   - Schema gồm `id` và `{parent}Id` bị khoá; dropdown kiểu có thêm "Parent Resource" hoặc "Child Resource" tuỳ ngữ cảnh.
   - Object template và Endpoints mở cho mọi gói, không còn notice "Cần gói trả phí". Khác mockapi.io có chủ đích, vì gói Free của Localman hào phóng hơn.
5. Modal Data: textarea JSON, nút Update chỉ bật khi có thay đổi và JSON hợp lệ.
6. Toast cho các sự kiện "Đã sinh dữ liệu", "Đã reset dữ liệu", "Đã cập nhật dữ liệu".
7. Thông báo prompt: project rỗng vừa mở thì tự hiện modal New resource sau 500ms, giống nguồn.

## Verification
- Unit (vitest) cho `tree-layout` và `canConnect`, dùng các bộ cây mẫu users → posts → comments và likes ở root.
- Component test (Testing Library) cho generator bar, chạy cả bằng chuột lẫn bàn phím.
- So sánh trực quan với prototype `#/projects/demo` ở 375, 768 và 1440px, cả light lẫn dark.
- `pnpm check:tokens` sạch (không có màu hay khoảng cách hardcode ngoài token) và axe-core không có lỗi a11y mức serious.

## Giao việc
**Đợt:** 2 · **Phụ thuộc trước khi bắt đầu:** phase 04 (API resource); phase 05 cho phần test end-to-end · **Lệnh cook:** `/ak:cook plans/dattqh/261008-1123-localman-core/phase-06-project-detail-ui.md`

| # | Việc | Vai trò | Song song | File chính |
|---|---|---|---|---|
| T1 | Đối chiếu prototype `prototype/index.html#/projects/demo` (thẻ API endpoint, canvas cây, thanh generator, `openResourceModal`, `openDataModal`, modal Delete) ở light và dark; chốt state, `data-id` và kích thước (cột 150px, hàng 50px, generator 106×25) cho T4–T7 | ui-ux-designer | với T2, T3 | `prototype/index.html` (chỉ đọc) |
| T2 | `tree-layout.ts` (hàm thuần ra `{nodes, links, connectors}`) và logic `canConnect` (chặn chính nó, cha–con trực tiếp, tên trùng, chu trình) kèm unit trên bộ cây users → posts → comments và likes ở root | fullstack-developer | với T1, T3 | `apps/web/src/features/resource-tree/{tree-layout,can-connect}.ts` |
| T3 | `json-editor.tsx` dùng CodeMirror 6 chế độ JSON, validate khi blur | fullstack-developer | với T1, T2 | `apps/web/src/components/ui/json-editor.tsx` |
| T4 | `project-detail-page.tsx`, `api-endpoint-card.tsx` (URL tô màu secret, prefix, `:endpoint` có tooltip; footer New resource, Generate all, Reset all) và hook TanStack Query cho API phase 04; container `overflow-x-auto` | fullstack-developer | — (sau T1) | `apps/web/src/pages/project-detail/*` |
| T5 | Canvas: `resource-tree-canvas`, `resource-node` (tên là link mở mock URL), `generator-bar` (rê chuột hiện 0–100, click để sinh, ←/→ bước 10, Enter, `aria-valuenow`, animation 200ms, optimistic `count` và rollback), `add-to-root-rail`, `use-tree-connect`, `node-actions` (hiện khi hover hoặc focus) | fullstack-developer | với T6 (sau T2) | `apps/web/src/features/resource-tree/*.tsx`, `use-tree-connect.ts` |
| T6 | Modal resource: `resource-form-modal`, `schema-editor` (lưới 10 cột, khoá `id` và `{parent}Id`), `faker-method-select` (combobox tìm trên khoảng 250 method), `object-template-editor`, `endpoints-editor`, `resource-data-modal` (Update chỉ bật khi đổi và JSON hợp lệ), `delete-resource-modal`; không tạo notice "Cần gói trả phí" | fullstack-developer | với T5 (sau T3) | `apps/web/src/features/resources/*` |
| T7 | Ghép trang: nối canvas và modal vào trang, toast "Đã sinh dữ liệu", "Đã reset dữ liệu", "Đã cập nhật dữ liệu", project rỗng tự mở modal New resource sau 500ms, trang không cuộn ngang ở 375px | fullstack-developer | — (sau T4–T6) | `apps/web/src/pages/project-detail/project-detail-page.tsx` |
| T8 | Component test (Testing Library) cho generator bar bằng chuột và bàn phím; test optimistic rollback khi API lỗi | tester | với T9 | `apps/web/src/features/resource-tree/*.test.tsx` |
| T9 | So sánh trực quan với prototype `#/projects/demo` ở 375, 768 và 1440px, light và dark; chạy `pnpm check:tokens` và axe-core | ui-ux-designer | với T8 | `apps/web/src/pages/project-detail/*`, `apps/web/src/features/{resource-tree,resources}/*` |
| T10 | Review cuối phase | code-reviewer | — | toàn phase |

### Checklist
- [x] T1 State, `data-id` và kích thước đã chốt theo prototype — giữ hình học prototype (node 208×104, cột 268, hàng 128, generator 106×25), lệch spec 150/50 có chủ đích, ghi ở `docs/design-system.md`
- [x] T2 `tree-layout` và `canConnect` cùng unit xong
- [x] T3 `json-editor` xong
- [x] T4 Trang và thẻ API endpoint xong
- [x] T5 Canvas, generator bar và thao tác lồng xong
- [x] T6 Các modal resource, data và delete xong
- [x] T7 Trang đã ghép, toast và prompt 500ms chạy đúng
- [x] T8 Component test generator bar pass
- [x] T9 So khớp trực quan và kiểm token, brand xong — đã so khớp trên stack local ở 375/768/1440, light/dark; axe 0 serious
- [x] T10 Review không còn finding chặn
- [x] Verification: unit `tree-layout` và `canConnect` pass trên các bộ cây mẫu
- [x] Verification: generator bar chạy đúng bằng chuột và bàn phím
- [x] Verification: khớp prototype `#/projects/demo` ở 375, 768, 1440px, light và dark
- [x] Verification: `pnpm check:tokens` sạch và axe-core không có lỗi a11y mức serious
- [x] `pnpm lint && pnpm typecheck && pnpm test` sạch
- [x] `pnpm check:mcp-coverage` pass
