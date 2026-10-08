---
phase: 23
title: "Extension: tiện ích mở rộng cho tab đang mở"
status: pending
priority: P3
effort: "M"
dependencies: [22]
---

# Phase 23: Tiện ích mở rộng của extension

> Phần "…" trong yêu cầu của user ngày 2026-10-08. Jev chọn 7 trên 8 tiện ích (xác suất > 0.5). Loại: chụp màn hình kèm ghi chú (0.41).

## Tiện ích (mọi dòng là tiêu chí nghiệm thu)

| Tiện ích | Jev | Hành vi | Cơ chế |
|---|---|---|---|
| Cache Storage và service worker | 0.66 | Liệt kê cache cùng các entry, xoá từng cái hoặc tất cả; liệt kê service worker của origin, Unregister, Update | `scripting` (world MAIN) cùng `caches` và `navigator.serviceWorker` |
| Bắt log console | 0.62 | Ghi log và lỗi console của tab (cùng lỗi chưa bắt) kèm stack; đính kèm vào request ("Gửi sang Localman") hoặc comment | Content script hook `console.*` và `error`/`unhandledrejection`, đẩy vào bộ đệm vòng 500 dòng |
| Tạm tắt CORS khi dev | 0.61 | Chỉ cho **tab đang mở** và **một origin đích do user chọn**. Tự tắt sau 30 phút hoặc khi đóng tab. Badge đỏ trên icon trong lúc bật | Rule DNR **phiên** (`tabIds`), thêm `Access-Control-Allow-*` vào response, chỉ khớp origin đã chọn |
| Giả lập thiết bị, user-agent, mạng chậm | 0.60 | Chọn preset thiết bị hoặc user-agent tuỳ chỉnh cho tab; giả lập mạng chậm (Fast 3G, Slow 3G, Offline) | User-agent qua rule DNR; mạng chậm và viewport qua `chrome.debugger` (Emulation và Network.emulateNetworkConditions), có xin quyền. Firefox chỉ có user-agent |
| Sửa header theo rule | 0.59 | Rule thêm, sửa, xoá header request/response và redirect URL theo pattern, giống Requestly. Bật/tắt từng rule; xuất/nhập JSON | Rule DNR động, giới hạn 100 rule |
| Xem JSON đẹp | 0.59 | Tab mở ra một response JSON thì hiển thị dạng cây, có tìm kiếm, JSONPath, copy path và "Mở trong Localman" | Content script nhận `content-type: application/json` và render trong shadow DOM |
| Thay response bằng mock Localman | 0.58 | Chọn pattern URL của trang (ví dụ `https://shop.example.com/api/orders*`) rồi trỏ sang một project mock Localman. Trang đang chạy thật nhận dữ liệu mock mà không phải sửa code | Rule DNR redirect sang `https://{secret}.localman.hoandat.com/...`, cộng "Tạm tắt CORS" cho đúng origin mock nếu cần |

## Ràng buộc chung
- **Không tự gửi dữ liệu lên Localman.** Chỉ hành động gửi có chủ đích (theo phase 22).
- **Mọi rule DNR và trạng thái giả lập** hiện trong một mục "Đang bật" ở side panel, kèm nút "Tắt tất cả".
- **Rule có hạn:** tạm tắt CORS và thay response tự hết hạn theo phiên.
- **Áp rule cho tab:** khi rule hoặc giả lập thay đổi, **không tự tải lại tab** (để không mất dữ liệu form). Thay vào đó hiện thanh "Tải lại tab để áp dụng", kèm công tắc "Tự tải lại" (mặc định tắt). Prototype tự tải lại chỉ để demo cho gọn.

## Files to Create / Modify
- `apps/browser-extension/src/sidepanel/utilities/` (`cache-sw-tab.tsx`, `console-tab.tsx`, `cors-unblock.tsx`, `emulation-tab.tsx`, `header-rules.tsx`, `mock-override.tsx`, `active-rules-bar.tsx`)
- `apps/browser-extension/src/content/` (`console-hook.ts`, `json-viewer.ts`)
- `apps/browser-extension/src/dnr/rule-manager.ts` (cấp id, gắn theo tab và phiên, dọn rule khi đóng tab)

## MCP
Không có MCP tool (`exempt`, Jev 0.77). Tiện ích của extension làm việc với tab đang mở và giữ dữ liệu trong trình duyệt. Riêng thao tác "Gửi sang Localman" tạo request hoặc collection qua API thường, nên agent vẫn thao tác được phần dữ liệu đó bằng toolset `client`.

## Verification
- **E2E:**
  - Tạm tắt CORS: trang mẫu gọi được API khác origin; sau 30 phút (giả lập đồng hồ) hoặc khi đóng tab thì rule bị xoá.
  - Rule sửa header: server echo thấy header mới.
  - Thay response bằng mock: trang mẫu hiển thị dữ liệu từ mock Localman.
  - Bắt console: lỗi của trang mẫu xuất hiện kèm stack.
  - Cache/SW: unregister xong thì service worker biến mất.
  - JSON viewer: hiển thị cây và tìm được key.
- **Bảo mật:** không rule nào còn sót sau khi đóng tab. Tạm tắt CORS chỉ áp đúng tab và origin đã chọn (tab khác vẫn bị chặn).

## Giao việc
**Đợt:** 8 · **Phụ thuộc trước khi bắt đầu:** phase 22 đã xong (khung extension, side panel, "Gửi sang Localman"); "Thay response bằng mock" cần mock runtime của phase 05 · **Lệnh cook:** `/ak:cook plans/dattqh/261008-1123-localman-core/phase-23-extension-utilities.md`

| # | Việc | Vai trò | Song song | File chính |
|---|---|---|---|---|
| T1 | Đối chiếu bảng tiện ích với prototype `prototype/extension.html`: `utils-nav`, `util-cache` và `sw*`, `console-*`, `util-cors` và `cors-*`, `util-emu` và `emu-*`, `rules-*` và `modal-rule`, `json-viewer` và `json-*`, `util-mock` và `mock-*`, thanh `sp-active`. Ghi rõ bản thật không tự tải lại tab mà hiện "Tải lại tab để áp dụng" (prototype tự tải lại chỉ để demo) | ui-ux-designer | với T2, T5, T6, T7 | `prototype/extension.html` (chỉ đọc) |
| T2 | Viết `rule-manager` (cấp id, gắn theo tab và phiên, hết hạn, dọn rule khi đóng tab, giới hạn 100 rule) và `active-rules-bar` (mục "Đang bật", "Tắt tất cả", thanh "Tải lại tab để áp dụng", công tắc "Tự tải lại" mặc định tắt) | fullstack-developer | với T1, T5, T6, T7 | `apps/browser-extension/src/dnr/rule-manager.ts`, `src/sidepanel/utilities/active-rules-bar.tsx` |
| T3 | Làm "Tạm tắt CORS" (rule phiên theo `tabIds`, chỉ origin đã chọn, tự tắt sau 30 phút hoặc khi đóng tab, badge đỏ) và "Thay response bằng mock" (redirect DNR sang `https://{secret}.localman.hoandat.com/...`, tạm tắt CORS cho origin mock khi cần) | fullstack-developer | với T4 | `apps/browser-extension/src/sidepanel/utilities/cors-unblock.tsx`, `mock-override.tsx` |
| T4 | Làm "Sửa header theo rule" (thêm, sửa, xoá header request/response, redirect, bật/tắt từng rule, xuất/nhập JSON) và "Giả lập thiết bị" (user-agent qua DNR; viewport và mạng chậm qua `chrome.debugger` có xin quyền; Firefox chỉ có user-agent) | fullstack-developer | với T3 | `apps/browser-extension/src/sidepanel/utilities/header-rules.tsx`, `emulation-tab.tsx` |
| T5 | Làm tab Cache Storage và service worker: liệt kê cache và entry, xoá từng cái hoặc tất cả, Unregister và Update service worker | fullstack-developer | với T1, T2, T6, T7 | `apps/browser-extension/src/sidepanel/utilities/cache-sw-tab.tsx` |
| T6 | Làm bắt log console: hook `console.*`, `error`, `unhandledrejection`, bộ đệm vòng 500 dòng kèm stack, đính kèm vào "Gửi sang Localman" hoặc comment | fullstack-developer | với T1, T2, T5, T7 | `apps/browser-extension/src/content/console-hook.ts`, `src/sidepanel/utilities/console-tab.tsx` |
| T7 | Làm xem JSON: content script nhận `content-type: application/json`, render cây trong shadow DOM, tìm kiếm, JSONPath, copy path, "Mở trong Localman" | fullstack-developer | với T1, T2, T5, T6 | `apps/browser-extension/src/content/json-viewer.ts` |
| T8 | Viết E2E: tạm tắt CORS cho phép gọi khác origin và rule bị xoá sau 30 phút (đồng hồ giả) hoặc khi đóng tab; rule sửa header được server echo thấy; trang mẫu nhận dữ liệu từ mock Localman; lỗi console có stack; unregister làm service worker biến mất; JSON viewer hiện cây và tìm được key | tester | với T9 | `e2e/specs/extension-utilities.spec.ts` |
| T9 | Viết test bảo mật: không rule nào còn sau khi đóng tab; tạm tắt CORS chỉ áp đúng tab và origin đã chọn (tab khác vẫn bị chặn); không có request nào tới Localman khi chưa bấm gửi | tester | với T8 | `e2e/specs/extension-utilities-security.spec.ts` |
| T10 | Đóng gói và nộp bản cập nhật lên Chrome Web Store và Firefox AMO (cần user xác nhận) | fullstack-developer | — | gói zip từ workflow của phase 22 |
| T11 | Review cuối phase, chú trọng phạm vi rule DNR và quyền `debugger` | code-reviewer | — | toàn phase |

### Checklist
- [ ] T1 Spec bảy tiện ích và hành vi "Tải lại tab để áp dụng" đã chốt theo prototype
- [ ] T2 `rule-manager` và mục "Đang bật"
- [ ] T3 Tạm tắt CORS và thay response bằng mock
- [ ] T4 Sửa header theo rule và giả lập thiết bị
- [ ] T5 Cache Storage và service worker
- [ ] T6 Bắt log console
- [ ] T7 Xem JSON
- [ ] T8 E2E pass
- [ ] T9 Test bảo mật pass
- [ ] T10 Bản cập nhật đã nộp lên store sau khi user xác nhận
- [ ] T11 Review không còn finding mức high
- [ ] Verification: tạm tắt CORS chạy và tự hết hạn; rule header được echo; mock override hiển thị dữ liệu mock
- [ ] Verification: console có stack; unregister service worker; JSON viewer tìm được key
- [ ] Verification: không còn rule sau khi đóng tab; CORS chỉ áp đúng tab và origin
- [ ] `pnpm lint && pnpm typecheck && pnpm test` sạch
- [ ] `pnpm check:mcp-coverage` pass; mọi tiện ích của phase này được đánh dấu `exempt` kèm lý do
