---
phase: 22
title: "Browser extension: gửi request vượt CORS, cùng bộ công cụ cookie, storage, network, performance cho tab đang mở"
status: cancelled
priority: P2
effort: "L"
dependencies: [10]
---

# Phase 22: Browser extension (lõi)

> **Đã huỷ (2026-10-16).** User bỏ browser extension; xem Vòng 39 trong `plan.md`. Nội dung dưới đây chỉ giữ làm hồ sơ.

> Extension là tuỳ chọn; Jev cho 0.55 cho phần gửi request. User bổ sung ngày 2026-10-08: extension còn là **bộ tiện ích cho tab đang mở** (cookie, storage, network, performance), như một phần thưởng cho người cài. Tiện ích mở rộng nằm ở phase 23.

## Goal
Extension dùng chung cho Chrome và Firefox (Manifest V3), làm hai việc:
1. **Đường đi request "Extension"** cho Localman web. Request gửi thẳng từ máy user mà không bị CORS chặn, đặt được header bị cấm và đọc được đủ response. Thứ tự Auto khi đã cài: đích có CORS và không cần header cấm thì **gửi thẳng**; còn lại (không CORS, cần header cấm, hoặc localhost) thì **qua Extension**; extension không làm được thì mới **qua proxy hoặc Tunelo**. Gửi thẳng được thì không cần đi vòng qua extension, mà secret vẫn không rời máy.
2. **Bộ công cụ cho tab đang mở:**
   - **Cookie:** xem, tìm, sửa, thêm, xoá; xuất/nhập JSON; copy dưới dạng header `Cookie`.
   - **Storage:** xem và sửa localStorage, sessionStorage; duyệt và xoá IndexedDB; nút "Xoá dữ liệu site".
   - **Network:** danh sách request của tab kèm header và body, có bộ lọc. Mỗi request có "Gửi sang Localman" (mở thành tab request), "Lưu vào collection", copy dạng cURL, và xuất HAR.
   - **Performance:** Core Web Vitals (LCP, INP, CLS, TTFB), waterfall theo resource timing, long task.

## Quyết định (Jev, 2026-10-08)
| Câu hỏi | Lựa chọn | Xác suất |
|---|---|---|
| Cách bắt network | Panel "Localman" trong DevTools (`chrome.devtools.network`, có body, không có thanh cảnh báo) là chính. Khi DevTools đóng, user có thể chọn bật `chrome.debugger` (Chrome hiện thanh "đang gỡ lỗi") | 0.97 |
| Giao diện | Side panel cho cookie, storage, performance và phần tiện ích; panel DevTools cho network | 0.82 |
| Dữ liệu | **Mặc định ở lại trình duyệt.** Chỉ hai thao tác chủ động gửi lên Localman: "Gửi sang Localman" và "Lưu vào collection". Giá trị cookie, `Authorization` và token được đánh dấu secret và phải xác nhận trước khi gửi | 1.00 |

## Thiết kế
- **Quyền:**
  - Bắt buộc: `storage`, `sidePanel`, `activeTab`, `scripting`, `cookies`, `declarativeNetRequest`.
  - Tuỳ chọn, xin khi user dùng tới: `debugger`, `optional_host_permissions` theo từng domain.
  - Không xin `<all_urls>` lúc cài.
- **Firefox:**
  - Thay side panel bằng `sidebar_action`. Firefox mặc định mở sidebar bên trái; user có thể đổi sang phải.
  - Firefox không có `chrome.debugger`, nên network chỉ bắt được qua panel DevTools. UI ghi rõ giới hạn này.
- **Giao tiếp với Localman web:**
  - `externally_connectable` chỉ nhận `https://localman.hoandat.com`.
  - Mỗi lệnh gửi kèm nonce theo phiên.
  - Trang khác không gọi được extension.
- **Cookie:**
  - Dùng `chrome.cookies` theo URL của tab đang mở; có partitioned cookies (CHIPS) khi trình duyệt hỗ trợ.
  - Sửa cookie `HttpOnly` được vì đi qua API của extension, không phải qua trang. UI có cảnh báo khi sửa loại này.
- **Storage:**
  - Thao tác qua `chrome.scripting.executeScript`, chạy trong world `MAIN` của tab đang mở, và chỉ khi user mở công cụ (nhờ `activeTab`).
  - IndexedDB chỉ đọc danh sách database, store và bản ghi (có phân trang); thao tác xoá phải xác nhận.
- **Performance:**
  - Content script dùng thư viện `web-vitals` cộng `PerformanceObserver` (long task, resource).
  - Có nút "Đo lại", tải lại tab rồi đo.
- **Mã nguồn:** đặt trong `apps/browser-extension` của monorepo, viết bằng React và dùng chung token màu, primitive UI với `apps/web`. Không có telemetry.

## Files to Create
- `apps/browser-extension/`:
  - `manifest.chrome.json`, `manifest.firefox.json`
  - `src/service-worker.ts`
  - `src/bridge/` (kênh `externally_connectable` cùng nonce)
  - `src/transport/` (gửi request và đặt header bị cấm qua rule DNR theo từng request)
  - `src/sidepanel/` (các tab Cookie, Storage, Performance và Tiện ích)
  - `src/devtools/` (panel Network)
  - `src/content/vitals.ts`
- `apps/web/src/features/request-routing/extension-transport.ts`, cùng màn nhận "Gửi sang Localman" (tạo tab request từ dữ liệu network đã bắt).
- Workflow build và đóng gói cho Chrome Web Store và Firefox AMO. **Việc nộp lên store là thao tác public, phải hỏi user trước.**

## MCP
Không có MCP tool (`exempt`, Jev 0.77). Tiện ích của extension làm việc với tab đang mở và giữ dữ liệu trong trình duyệt. Riêng thao tác "Gửi sang Localman" tạo request hoặc collection qua API thường, nên agent vẫn thao tác được phần dữ liệu đó bằng toolset `client`.

## Verification
- E2E (Playwright load extension đã giải nén):
  - **Gửi request:** đích không có CORS vẫn trả response kèm đủ header; header `Cookie` do user đặt tới được đích; trang lạ gọi extension thì bị từ chối.
  - **Cookie:** sửa giá trị rồi reload tab thì server nhận đúng giá trị mới; xuất rồi nhập lại JSON thì giữ nguyên (round-trip).
  - **Storage:** thấy đúng key và value của trang mẫu; "Xoá dữ liệu site" xoá đúng phạm vi.
  - **Network** (panel DevTools): thấy body của POST JSON. "Gửi sang Localman" tạo request đúng method, URL, header và body; hỏi xác nhận khi có `Authorization`. File HAR xuất ra mở được bằng Chrome.
  - **Performance:** có đủ LCP, CLS và TTFB trên trang mẫu.
- **Bảo mật:**
  - Không có `<all_urls>` trong quyền bắt buộc.
  - Không có request nào tới Localman nếu user chưa bấm hành động gửi (kiểm bằng cách chặn mạng trong test).

## Giao việc
**Đợt:** 8 · **Phụ thuộc trước khi bắt đầu:** phase 10 đã xong (định tuyến Auto và tab request); phase 12 đã xong vì "Lưu vào collection" ghi vào collection; nên làm sau đợt 7 theo thứ tự thực thi. Phase 23 chỉ bắt đầu khi phase này xong · **Lệnh cook:** `/ak:cook plans/dattqh/261008-1123-localman-core/phase-22-browser-extension.md`

| # | Việc | Vai trò | Song song | File chính |
|---|---|---|---|---|
| T1 | Đối chiếu với prototype `prototype/extension.html`: side panel (`side-panel`, `sp-tabs`, `cookie-*`, `storage-*`, `idb-*`, `perf-*`), panel DevTools Network (`devtools`, `dt-net`), modal `modal-send`, `modal-save`, `modal-cookie`, thanh `debugger-banner`; và `prototype/api-client.html` (`settings-routing-extension`, badge route "extension"). Chốt spec và phần khác biệt Firefox (sidebar bên trái, không có `chrome.debugger`) | ui-ux-designer | với T2 | `prototype/extension.html` (chỉ đọc) |
| T2 | Dựng `apps/browser-extension`: build React dùng chung token màu và primitive UI với `apps/web`; `manifest.chrome.json` và `manifest.firefox.json` (`sidebar_action`); quyền bắt buộc đúng danh sách, `debugger` và host permission là tuỳ chọn, không có `<all_urls>`; `service-worker.ts` và khung side panel | fullstack-developer | với T1 | `apps/browser-extension/manifest.*.json`, `src/service-worker.ts`, `src/sidepanel/` (khung) |
| T3 | Làm kênh nối với web và đường gửi request: `externally_connectable` chỉ nhận `https://localman.hoandat.com`, nonce theo phiên; `transport` đặt header bị cấm bằng rule DNR theo từng request; phía web `extension-transport` cùng thứ tự Auto (gửi thẳng, rồi extension, rồi proxy hoặc Tunelo) | fullstack-developer | — | `apps/browser-extension/src/bridge/`, `src/transport/`, `apps/web/src/features/request-routing/extension-transport.ts` |
| T4 | Làm tab Cookie (xem, tìm, sửa, thêm, xoá, CHIPS, cảnh báo khi sửa `HttpOnly`, xuất/nhập JSON, copy header `Cookie`) và tab Storage (localStorage, sessionStorage qua `scripting` world `MAIN`, IndexedDB chỉ đọc có phân trang, xoá phải xác nhận, "Xoá dữ liệu site") | fullstack-developer | với T5, T6 | `apps/browser-extension/src/sidepanel/` (tab Cookie, Storage) |
| T5 | Làm tab Performance: content script `web-vitals` cùng `PerformanceObserver` (LCP, INP, CLS, TTFB, long task, resource timing), waterfall, nút "Đo lại" | fullstack-developer | với T4, T6 | `apps/browser-extension/src/content/vitals.ts`, `src/sidepanel/` (tab Performance) |
| T6 | Làm panel DevTools Network: danh sách request kèm header và body, bộ lọc, copy cURL, xuất HAR; chế độ `chrome.debugger` tuỳ chọn khi DevTools đóng (chỉ Chrome) | fullstack-developer | với T4, T5 | `apps/browser-extension/src/devtools/` |
| T7 | Làm "Gửi sang Localman" và "Lưu vào collection": xác nhận khi có cookie, `Authorization` hay token; màn nhận phía web tạo tab request đúng method, URL, header, body | fullstack-developer | — | `apps/browser-extension/src/devtools/` (nút gửi), `apps/web/src/features/request-routing/` (màn nhận) |
| T8 | Viết workflow build và đóng gói zip cho Chrome Web Store và Firefox AMO; xác nhận extension không thêm operation nào thiếu MCP, và các tiện ích được ghi `exempt` kèm lý do (Jev 0.77) nếu có operation phía server | fullstack-developer | với T9 | `.github/workflows/` (build extension), `apps/browser-extension/` (script đóng gói) |
| T9 | Viết E2E Playwright nạp extension giải nén: gửi request tới đích không CORS đủ header, header `Cookie` tới đích, trang lạ gọi extension bị từ chối; cookie sửa và round-trip JSON; storage đúng key và "Xoá dữ liệu site" đúng phạm vi; Network thấy body POST, "Gửi sang Localman" đúng và hỏi khi có `Authorization`, HAR mở được bằng Chrome; Performance có LCP, CLS, TTFB; kiểm bảo mật không có `<all_urls>` và không có request nào tới Localman khi chưa bấm gửi | tester | với T8 | `e2e/specs/browser-extension.spec.ts` |
| T10 | Viết trang hướng dẫn cài extension, quyền xin lúc nào và chính sách dữ liệu (dùng cho trang store) | docs-manager | — | `docs/` (trang extension) |
| T11 | Nộp bản đầu lên Chrome Web Store và Firefox AMO (cần user xác nhận) | fullstack-developer | — | gói zip từ workflow T8 |
| T12 | Review cuối phase, chú trọng quyền, kênh `externally_connectable` và dữ liệu rời trình duyệt | code-reviewer | — | toàn phase |

### Checklist
- [ ] T1 Spec side panel, DevTools panel, khác biệt Firefox đã chốt theo prototype
- [ ] T2 Khung extension, hai manifest, quyền đúng danh sách
- [ ] T3 Bridge có nonce, transport DNR, thứ tự Auto phía web
- [ ] T4 Tab Cookie và Storage
- [ ] T5 Tab Performance
- [ ] T6 Panel DevTools Network, cURL, HAR, chế độ debugger tuỳ chọn
- [ ] T7 "Gửi sang Localman" và "Lưu vào collection" có xác nhận secret
- [ ] T8 Workflow đóng gói Chrome và Firefox
- [ ] T9 E2E và kiểm bảo mật pass
- [ ] T10 Docs extension và chính sách dữ liệu
- [ ] T11 Đã nộp lên Chrome Web Store và Firefox AMO sau khi user xác nhận
- [ ] T12 Review không còn finding mức high
- [ ] Verification: gửi request vượt CORS, header `Cookie`, trang lạ bị từ chối
- [ ] Verification: cookie round-trip, storage đúng phạm vi, Network có body và HAR hợp lệ, Performance đủ LCP/CLS/TTFB
- [ ] Verification: không có `<all_urls>` trong quyền bắt buộc; không có request tới Localman khi chưa bấm gửi
- [ ] `pnpm lint && pnpm typecheck && pnpm test` sạch
- [ ] `pnpm check:mcp-coverage` pass; tiện ích extension được đánh dấu `exempt` kèm lý do, phần "Gửi sang Localman" đi qua operation có sẵn của toolset `client`
