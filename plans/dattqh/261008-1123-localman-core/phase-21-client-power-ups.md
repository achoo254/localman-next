---
phase: 21
title: "Client power-ups: secret local không rời trình duyệt, nối request không cần script, docs tự sinh từ mock"
status: in-progress
priority: P2
effort: "M"
dependencies: [10, 13, 16]
---

# Phase 21: Client power-ups

> **Thứ tự chạy:** sau phase 16. Nguồn: `../reports/competitors/research-261008-1316-api-clients.md` và `research-261008-1316-user-needs.md`. Jev chọn ngày 2026-10-08.

## Goal
| Tiện ích | Jev | Lý do |
|---|---|---|
| **Giá trị local của biến secret không rời trình duyệt** (mã hoá phía client, server không đọc được). Có trang "Dữ liệu của bạn nằm ở đâu" công khai nơi lưu dữ liệu, proxy ghi log gì và telemetry | 0.62 | Riêng tư là nhu cầu số một trong nghiên cứu: người dùng lo Postman sync secret lên cloud |
| **Nối request không cần script:** tham chiếu `{{response "Đăng nhập" "$.token"}}` tới response của request khác, có TTL; hết hạn thì tự gửi lại request nguồn | 0.53 (sát ngưỡng) | Insomnia và Yaak có; Postman phải viết script hoặc dùng Flows |
| **Docs tự sinh từ project mock**, luôn đồng bộ với schema; trang public `https://localman.hoandat.com/docs/<slug>` | 0.54 (sát ngưỡng) | mockapi.io không có docs; docs của Postman mang brand Postman, muốn domain riêng phải trả phí |

## Quyết định (Jev, 24/10/2026)

| Câu hỏi | Chọn | Xác suất (độ tin) |
|---|---|---|
| Vault bắt buộc hay tự bật | **Bắt buộc**: server từ chối giá trị local của biến secret không phải bản mã `lmv1:` | 0,61 (0,22, thấp; áp ở T5, user có thể đổi trước khi T5 làm) |
| Agent qua MCP ghi giá trị local của biến secret | **Từ chối**, lỗi nói rõ secret của user nằm trong vault của trình duyệt | 0,57 (0,14, thấp; áp ở T5) |
| Dẫn xuất khoá | **PBKDF2-SHA256, 600.000 vòng**, WebCrypto, không thêm dependency | 0,97 |
| Giá trị local cũ (server mã hoá) | **Mã hoá lại khi đặt passphrase**: trình duyệt đọc một lần rồi ghi lại dạng `lmv1:` | 0,99 |

## Thiết kế secret phía client
- **Giá trị local** của biến `type=secret` được mã hoá AES-GCM ngay trên trình duyệt (WebCrypto). Khoá lấy từ passphrase do user đặt, qua PBKDF2 hoặc Argon2 (WASM). Server chỉ lưu bản mã. Khoá đã mở khoá nằm trong IndexedDB của thiết bị, không gửi lên server.
- **Lúc gửi request**, trình duyệt giải mã. Gửi thẳng thì giá trị **không bao giờ tới server Localman**. Nếu phải chuyển sang proxy thì hỏi user trước (phase 10, bước 3); proxy chỉ thấy giá trị lúc đang chuyển đi, không lưu và không log.
- **Giá trị shared** của biến secret giữ nguyên thiết kế của phase 13 (mã hoá phía server để chia sẻ được cho team).
- **Quên passphrase** thì mất giá trị local của biến secret. UI cảnh báo trước và có "Xuất bản sao lưu đã mã hoá".

## Files to Create / Modify
- Create `apps/web/src/features/secure-vault/` (`vault-crypto.ts`, `unlock-dialog.tsx`, `backup-export.tsx`). Modify `apps/web/src/features/environments/environment-editor.tsx`, cùng chỗ lưu giá trị local của phase 13: bản mã có tiền tố `lmv1:`.
- Create `apps/web/src/pages/data-transparency-page.tsx`, đối chiếu từng dòng với cấu hình thật trong `apps/api/src/config/data-policy.ts` (một nguồn duy nhất).
- Create `packages/shared/src/response-references.ts` (parse và resolve `{{response …}}`, JSONPath, TTL, phát hiện vòng lặp), modify `variable-resolver.ts` của phase 13 và request preparer của phase 10.
- Create `apps/api/src/modules/docs/` (render docs từ cây resource, schema và ví dụ; có ETag cache) và `apps/web/src/pages/public-docs/`.

## Verification
- Unit:
  - `vault-crypto`: mã hoá rồi giải mã; passphrase sai thì lỗi.
  - Bản mã khác nhau với cùng plaintext (IV ngẫu nhiên).
  - Không có đường code nào gửi plaintext lúc lưu: test chặn mọi PUT có giá trị secret không bắt đầu bằng `lmv1:`.
- `response-references`: nối 3 request; TTL hết hạn thì gửi lại; vòng lặp thì báo lỗi.
- E2E:
  - Đặt secret local, đăng nhập trên thiết bị khác thì không thấy plaintext.
  - Gửi request có secret thì nhận 200; log proxy không có giá trị đó.
  - Docs đổi theo ngay khi đổi schema.

## Liên quan
- **Gửi thẳng từ trình duyệt** đã được user cho phép (2026-10-08) và nằm ở phase 10, bước 3 (Auto: gửi thẳng trước, bị chặn thì qua proxy). Cùng với secret phía client của phase này, keyword **"Secret không rời trình duyệt"** trở thành keyword chính thức (Jev 0.72). Câu chữ phải trung thực: "với request gửi thẳng; nếu phải qua proxy, Localman hỏi bạn trước".

## Giao việc
**Đợt:** 7 · **Phụ thuộc trước khi bắt đầu:** phase 10 (định tuyến gửi thẳng và hỏi trước khi qua proxy), phase 13 (`variable-resolver`, `environment-editor`, lưu giá trị local) và phase 16 đã xong. Chạy cùng đợt với phase 18; phase 18 chỉ kiểm coverage cuối sau khi phase này merge · **Lệnh cook:** `/ak:cook plans/dattqh/261008-1123-localman-core/phase-21-client-power-ups.md`

| # | Việc | Vai trò | Song song | File chính |
|---|---|---|---|---|
| T1 | Prototype chưa có màn cho phase này (`prototype/index.html` hành động `data-page` chỉ hiện toast "thuộc phase 21"). Bổ sung vào `prototype/api-client.html` dialog mở khoá passphrase, cảnh báo quên passphrase, xuất bản sao lưu, gợi ý `{{response …}}`; bổ sung vào `prototype/index.html` trang "Dữ liệu của bạn nằm ở đâu" và trang docs public; trình user duyệt trước khi code UI (cần user xác nhận) | ui-ux-designer | với T2, T3, T4 | `prototype/api-client.html`, `prototype/index.html` |
| T2 | Viết `vault-crypto`: AES-GCM bằng WebCrypto, khoá từ passphrase qua PBKDF2 hoặc Argon2 (WASM), IV ngẫu nhiên, khoá đã mở lưu trong IndexedDB, bản mã có tiền tố `lmv1:`; unit test round-trip, passphrase sai, cùng plaintext ra bản mã khác nhau | fullstack-developer | với T1, T3, T4 | `apps/web/src/features/secure-vault/vault-crypto.ts` |
| T3 | Viết `response-references`: parse và resolve `{{response "<tên request>" "<JSONPath>"}}`, TTL, tự gửi lại request nguồn khi hết hạn, phát hiện vòng lặp; nối vào `variable-resolver` và request preparer của phase 10; test nối 3 request | fullstack-developer | với T1, T2, T4 | `packages/shared/src/response-references.ts`, `packages/shared/src/variable-resolver.ts` |
| T4 | Làm module docs: render từ cây resource, schema và ví dụ, có ETag cache; operation qua registry cho trang public `/docs/<slug>` | fullstack-developer | với T1, T2, T3 | `apps/api/src/modules/docs/` |
| T5 | Nối vault vào UI: `unlock-dialog`, `backup-export`, `environment-editor` lưu bản mã `lmv1:`; phía server chặn mọi PUT giá trị local của biến secret không bắt đầu bằng `lmv1:`; xác nhận đường proxy (hỏi trước) không lưu và không log giá trị | fullstack-developer | với T6 | `apps/web/src/features/secure-vault/`, `apps/web/src/features/environments/environment-editor.tsx`, `apps/api/src/modules/environments/` |
| T6 | Làm `data-policy` là nguồn duy nhất về nơi lưu dữ liệu, proxy log gì và telemetry; trang `data-transparency-page` render từ đó; câu chữ keyword "Secret không rời trình duyệt" đúng như mục Liên quan | fullstack-developer | với T5 | `apps/api/src/config/data-policy.ts`, `apps/web/src/pages/data-transparency-page.tsx` |
| T7 | Làm trang docs public và gợi ý `{{response …}}` trong editor (mở rộng highlighter của phase 13) | fullstack-developer | — | `apps/web/src/pages/public-docs/`, `apps/web/src/features/variables/variable-highlighter.ts` |
| T8 | Viết E2E: đặt secret local rồi đăng nhập thiết bị khác không thấy plaintext; gửi request có secret nhận 200 và log proxy không chứa giá trị; đổi schema thì docs đổi theo; nối 3 request, TTL hết hạn thì gửi lại, vòng lặp báo lỗi | tester | — | `e2e/specs/client-power-ups.spec.ts` |
| T9 | Deploy staging và bật khối landing "Secret không rời trình duyệt" (cờ `features.directMode`) (cần user xác nhận) | fullstack-developer | — | `deploy/compose.staging.yml`, cấu hình cờ tính năng |
| T10 | Review cuối phase, chú trọng đường code có thể gửi plaintext lên server | code-reviewer | — | toàn phase |

### Checklist
- [ ] T1 Màn vault, chaining, trang dữ liệu, docs public đã thêm vào prototype và user đã duyệt
- [ ] T2 `vault-crypto` có test round-trip, passphrase sai, IV ngẫu nhiên
- [ ] T3 `response-references` có TTL, gửi lại, phát hiện vòng lặp
- [ ] T4 Module docs có ETag và trang public qua registry
- [ ] T5 Vault nối vào environment editor; server chặn PUT thiếu `lmv1:`
- [ ] T6 `data-policy` một nguồn và trang minh bạch dữ liệu
- [ ] T7 Trang docs public và gợi ý `{{response …}}`
- [ ] T8 E2E pass
- [ ] T9 Staging deploy và khối landing bật sau khi user xác nhận
- [ ] T10 Review không còn finding mức high
- [ ] Verification: unit `vault-crypto` (round-trip, passphrase sai, bản mã khác nhau) và test chặn PUT secret thiếu `lmv1:` pass
- [ ] Verification: `response-references` nối 3 request, hết TTL gửi lại, vòng lặp báo lỗi
- [ ] Verification: E2E thiết bị khác không thấy plaintext; log proxy không có giá trị secret; docs đổi theo schema
- [ ] `pnpm lint && pnpm typecheck && pnpm test` sạch
- [ ] `pnpm check:mcp-coverage` pass
