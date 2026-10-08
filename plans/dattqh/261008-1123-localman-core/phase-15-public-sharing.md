---
phase: 15
title: "Chia sẻ công khai: public workspace, guest, nút Run, access key"
status: pending
priority: P2
effort: "M"
dependencies: [11, 12, 13, 14]
---

# Phase 15: Chia sẻ công khai

## Goal
Hoàn tất phần share của Postman cho người ngoài team: public workspace kèm public link và fork từ public, guest xem qua link, nút nhúng "Run in Localman" (tương đương "Run in Postman"), và link JSON chỉ đọc bằng Collection Access Key.

Nguồn tham chiếu: [Sharing](https://learning.postman.com/docs/collaborating-in-postman/sharing/), [Run in Postman button](https://learning.postman.com/docs/publishing-your-api/run-in-postman/creating-run-button/), [Collection access keys](https://learning.postman.com/docs/collaborating-in-postman/manage-public-elements/#collection-access-keys).

## Ma trận tương đương (mọi dòng là tiêu chí nghiệm thu)

| Tính năng Postman | Localman |
|---|---|
| Public workspace; chuyển collection vào đó để có "Link to collection in public workspace"; ai có link cũng xem và fork được (phải đăng nhập) | Có, trang public xem được khi chưa đăng nhập, fork thì phải đăng nhập |
| Guest: Editor bật "Guests can view collection via link"; guest đăng nhập và nhận vai trò Viewer trên collection; Admin tắt được tính năng guest theo workspace | Có |
| Guest xin quyền Editor | Có (luồng request access của phase 11) |
| Nút Run: chọn visibility Team hoặc Public, kèm environment tuỳ chọn, copy mã nhúng HTML hoặc Markdown | Có: nút "Run in Localman" mở app và fork/import collection kèm environment |
| Share via API: tạo Collection Access Key chỉ đọc; JSON luôn phản ánh trạng thái hiện tại; key hết hạn sau 60 ngày không dùng; user xem và thu hồi key của mình; Admin tắt được tính năng tạo key | Có, endpoint `GET /api/public/collections/:id?access_key=…` |

## Files to Create / Modify
- Create `apps/api/src/modules/public-sharing/`: `public-link-routes.ts`, `guest-access-service.ts`, `run-button-model.ts` (`{collectionId, environmentId?, visibility}`), `collection-access-key-model.ts` (lưu hash của key, `lastUsedAt`, `revokedAt`), `access-key-routes.ts`, kèm job quét key hết hạn
- Create `apps/web/src/pages/public/` (trang xem collection public dạng read-only), `apps/web/src/features/public-sharing/` (run-button-dialog, access-keys-settings, guest-toggle)
- Create `apps/web/public/run-button.js` (script nhúng nhẹ, không phụ thuộc thư viện)

## Tasks & Steps
1. Trang public chỉ đọc, render từ codec v2.1. **Chỉ hiển thị giá trị shared**, không bao giờ hiện local hay secret.
2. Access key: sinh 32 byte ngẫu nhiên, chỉ hiện đúng một lần, lưu hash. Rate-limit theo key.
3. Nút Run: script nhúng mở `localman.hoandat.com/run/:buttonId`. Chưa đăng nhập thì đăng nhập trước, sau đó chọn workspace để fork hoặc import.
4. Cảnh báo lúc share hoặc publish: hiện danh sách biến có giá trị shared trông giống token (dùng regex phát hiện secret) để user gỡ trước khi công khai.

## Verification
- Integration: guest có Viewer chỉ trên collection được share và không thấy phần còn lại của workspace. Key bị thu hồi hoặc hết hạn trả 401. JSON qua access key không chứa secret hay giá trị local.
- E2E: nhúng nút Run vào một trang HTML tĩnh, bấm nút, đăng nhập, collection xuất hiện trong workspace đã chọn.

## Giao việc
**Đợt:** 6 · **Phụ thuộc trước khi bắt đầu:** phase 11, 12, 13 đã xong, và phase 14 đã xong vì fork từ public link và nút Run (chế độ fork) dùng fork của phase 14 · **Lệnh cook:** `/ak:cook plans/dattqh/261008-1123-localman-core/phase-15-public-sharing.md`

| # | Việc | Vai trò | Song song | File chính |
|---|---|---|---|---|
| T1 | Đối chiếu ma trận với prototype `prototype/api-client.html`: `#/public/c/…` (`public-page`, `public-header`, `public-fork`, `public-run`, `public-login`), `#/run/…` (`run-page`, `run-mode-fork`, `run-mode-import`, `run-login-*`, `run-ws-*`), tab `share-run*` và `share-api-key-*` của share dialog, `banner-guest*`, `#/request-access`. Chốt spec component | ui-ux-designer | với T2 | `prototype/api-client.html` (chỉ đọc) |
| T2 | Làm public workspace và public link: trang public read-only render từ codec v2.1, chỉ có giá trị shared; xem được khi chưa đăng nhập, fork thì phải đăng nhập (dùng fork phase 14); chặn theo `plan-limits.forkPrPublic` | fullstack-developer | với T1 | `apps/api/src/modules/public-sharing/public-link-routes.ts` |
| T3 | Làm guest: Editor bật "Guests can view collection via link", guest nhận Viewer chỉ trên collection đó, Admin tắt guest theo workspace, guest xin Editor qua luồng request access của phase 11 | fullstack-developer | — | `apps/api/src/modules/public-sharing/guest-access-service.ts` |
| T4 | Làm Collection Access Key: sinh 32 byte, chỉ hiện một lần, lưu hash, `lastUsedAt`, `revokedAt`, job quét key không dùng 60 ngày, rate-limit theo key, Admin tắt tạo key; endpoint `GET /api/public/collections/:id?access_key=…`; operation tạo key cần scope `credentials:write` | fullstack-developer | với T5 | `apps/api/src/modules/public-sharing/collection-access-key-model.ts`, `access-key-routes.ts` |
| T5 | Làm nút Run: `run-button-model` (`collectionId`, `environmentId?`, visibility Team/Public), trang `/run/:buttonId` (đăng nhập, chọn workspace, fork hoặc import kèm environment), script nhúng không phụ thuộc thư viện, mã nhúng HTML và Markdown | fullstack-developer | với T4 | `apps/api/src/modules/public-sharing/run-button-model.ts`, `apps/web/public/run-button.js` |
| T6 | Làm UI: trang public read-only, run-button-dialog, access-keys-settings, guest-toggle, cảnh báo trước khi share hoặc publish liệt kê biến shared trông giống token (regex phát hiện secret đặt ở `packages/shared`) | fullstack-developer | — | `apps/web/src/pages/public/`, `apps/web/src/features/public-sharing/` |
| T7 | Viết integration test: guest chỉ thấy collection được share; key bị thu hồi hoặc hết hạn trả 401; JSON qua access key và trang public không có secret hay giá trị local | tester | với T8 | test trong `apps/api/src/modules/public-sharing/` |
| T8 | Viết E2E: nhúng nút Run vào trang HTML tĩnh, bấm, đăng nhập, collection xuất hiện trong workspace đã chọn | tester | với T7 | `e2e/specs/public-sharing-run-button.spec.ts` |
| T9 | Deploy bản phase lên staging; trang public và nút Run mở ra internet nên cần duyệt trước (cần user xác nhận) | fullstack-developer | — | `deploy/compose.staging.yml` |
| T10 | Review cuối phase, chú trọng lộ secret và giá trị local | code-reviewer | — | toàn phase |

### Checklist
- [ ] T1 Spec trang public, trang Run, tab share đã chốt theo prototype
- [ ] T2 Public link, trang read-only chỉ giá trị shared, fork cần đăng nhập
- [ ] T3 Guest Viewer, Admin tắt guest, guest xin Editor
- [ ] T4 Access key hash, hiện một lần, hết hạn 60 ngày, thu hồi, rate-limit, scope `credentials:write`
- [ ] T5 Nút Run, trang `/run/:buttonId`, script nhúng, mã HTML/Markdown
- [ ] T6 UI public sharing và cảnh báo secret trước khi publish
- [ ] T7 Integration pass
- [ ] T8 E2E nút Run pass
- [ ] T9 Staging đã deploy sau khi user xác nhận
- [ ] T10 Review không còn finding mức high
- [ ] Verification: guest chỉ có Viewer trên collection được share, không thấy phần còn lại của workspace
- [ ] Verification: key thu hồi hoặc hết hạn trả 401; JSON qua access key không có secret hay local
- [ ] Verification: E2E nút Run trên trang HTML tĩnh pass
- [ ] Mọi dòng ma trận tương đương có test hoặc kịch bản E2E tương ứng
- [ ] `pnpm lint && pnpm typecheck && pnpm test` sạch
- [ ] `pnpm check:mcp-coverage` pass
