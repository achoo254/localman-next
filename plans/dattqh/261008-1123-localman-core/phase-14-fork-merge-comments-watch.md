---
phase: 14
title: "Fork, merge, pull request, comment, watch (theo Postman)"
status: in-progress
priority: P2
effort: "XL"
dependencies: [12, 13]
---

# Phase 14: Fork, merge, pull request, comment, watch

## Goal
Làm version control kiểu Postman cho collection và environment (fork, pull changes, merge với 3 tuỳ chọn, giải xung đột, pull request), cùng comment, watch và thông báo.

**Theo gói** (`plan-limits`): comment, watch và thông báo dùng được trong workspace team của gói Free (tối đa 3 thành viên). Fork, merge và pull request (`forkPrPublic`) chỉ có ở Pro.

Nguồn tham chiếu: [Forking elements](https://learning.postman.com/docs/collaborating-in-postman/using-version-control/forking-elements/), [Creating pull requests](https://learning.postman.com/docs/collaborating-in-postman/using-version-control/creating-pull-requests/), [Reviewing pull requests](https://learning.postman.com/docs/collaborating-in-postman/using-version-control/reviewing-pull-requests/), [Comments](https://learning.postman.com/docs/collaborating-in-postman/comments/).

## Ma trận tương đương (mọi dòng là tiêu chí nghiệm thu)

| Tính năng Postman | Localman |
|---|---|
| Fork collection và environment: dialog gồm Label, Workspace, kèm environment (chỉ với collection); Viewer cũng fork được | Có |
| Nhãn fork sửa được; hover xem nguồn, người tạo, ngày tạo; danh sách Forks và số fork | Có |
| Pull changes từ bản gốc (xem diff rồi Pull Changes) | Có |
| Merge changes: "Merge changes", "Merge changes and update source", "Merge changes and delete source"; cần Editor ở bản gốc (và ở fork với 2 tuỳ chọn sau) | Có |
| Giải xung đột: Keep Source / Keep Destination cho từng thay đổi, hoặc "Keep all changes to …" | Có |
| Pull request: tiêu đề, mô tả, reviewer; trạng thái Open/Approved/Declined/Merged; xem diff; comment inline trên từng thay đổi; pull updates trong lúc PR đang mở | Có (chi tiết theo trang Creating/Reviewing PR) |
| Comment toàn cục trên collection, folder, request, example, pull request | Có |
| Comment inline: bôi đen trong query param, path param, header, body hoặc một dòng script | Có |
| Thread, trả lời, reaction, @mention theo `username` (thông báo trong app, Web Push hoặc Telegram tuỳ người được mention chọn; không có email), sửa, xoá (Workspace Admin xoá được nhưng không sửa được), Resolve/Reopen, lọc "Show resolved", Copy link tới comment, Markdown | Có |
| Watch collection: thông báo khi request, biến, script hoặc folder thay đổi; thay đổi do chính mình làm thì không báo; không áp cho workspace cá nhân | Có |

## Files to Create / Modify
- Create `apps/api/src/modules/version-control/`: `fork-model.ts` (`{sourceType, sourceId, forkId, label, createdBy, baseRevisionId}`), `three-way-merge.ts` (merge 3 chiều trên cây collection theo ID của item, dùng base revision lúc fork hoặc lần pull gần nhất), `conflict-model.ts`, `pull-request-model.ts`, `pull-request-review-model.ts`, routes và service
- Create `apps/api/src/modules/comments/`: `comment-model.ts` (`{elementType, elementId, anchor?:{part, path, range}, threadId, body(markdown), reactions, resolvedAt}`), routes, `mention-parser.ts`
- Create `apps/api/src/modules/watch/`: `watch-model.ts` và một hook trong `changelog-service.ts` để phát thông báo
- Create `apps/web/src/features/version-control/` (fork-dialog, merge-dialog, conflict-resolver, diff-viewer dùng chung với phase 12, pull-request pages) và `apps/web/src/features/comments/` (comments-pane, inline-comment-gutter, mention-autocomplete, reactions)

## Tasks & Steps
1. **Merge 3 chiều** chạy theo ID ổn định của item, không theo vị trí:
   - Thay đổi field ở cùng một item và cùng một path ở cả hai phía thì là xung đột. Thêm hoặc xoá item ở hai phía khác nhau thì merge tự động.
   - Thứ tự item merge theo fractional index; trùng thì lấy phía nguồn.
2. Environment merge theo key của biến, chỉ trên giá trị shared.
3. PR:
   - Tạo từ fork tới bản gốc. Reviewer nhận thông báo.
   - Approve hoặc Decline. Merge dùng đúng 3 tuỳ chọn ở trên.
   - Khi bản gốc đổi trong lúc PR mở thì có "Pull updates".
4. Comment inline: anchor gồm phần (params, headers, body, script), path và đoạn ký tự. Nội dung đổi làm anchor lệch thì comment hiện "outdated" như PR diff.
5. Gửi thông báo qua `notification-service` của phase 02 (phase 11 đã bổ sung các loại sự kiện chia sẻ).

## Verification
- Unit: bộ test `three-way-merge` với các ca: hai bên sửa khác field, sửa cùng field (xung đột), một bên xoá còn bên kia sửa (xung đột), cả hai thêm item, sắp lại thứ tự.
- Integration: vòng fork, sửa, PR, approve, merge với cả 3 tuỳ chọn. Giải xung đột Keep Source/Destination cho ra đúng kết quả. Viewer fork được nhưng không merge được vào bản gốc.
- Integration comment: @mention sinh thông báo đúng kênh; resolve/reopen; Admin xoá được nhưng không sửa được comment của người khác.

## Giao việc
**Đợt:** 6 · **Phụ thuộc trước khi bắt đầu:** phase 12 và 13 đã xong (trong đợt 6 chạy sau 13, trước 15 và 16, vì 15 dùng fork còn 16 dùng `three-way-merge` và UI giải xung đột của phase này); phase 02 đã có `notification-service` · **Lệnh cook:** `/ak:cook plans/dattqh/261008-1123-localman-core/phase-14-fork-merge-comments-watch.md`

| # | Việc | Vai trò | Song song | File chính |
|---|---|---|---|---|
| T1 | Đối chiếu ma trận với prototype `prototype/api-client.html`: `modal-fork-*`, `fork-hover-card*`, `modal-merge*`, `modal-conflicts*`, `#/pull-requests`, `#/pull-requests/new` (`pr-new-*`), `#/pull-requests/:id` (`pr-detail-*`), `comment-*`, `comments-*`, `collection-header-fork`, `collection-header-watch`, `right-forks`, `right-prs`. Chốt spec component | ui-ux-designer | với T2, T3 | `prototype/api-client.html` (chỉ đọc) |
| T2 | Viết `three-way-merge` dạng hàm thuần: merge theo ID ổn định, thứ tự theo fractional index (trùng thì lấy phía nguồn), environment merge theo key chỉ trên giá trị shared; bộ test đủ ca: sửa khác field, sửa cùng field, xoá đối sửa, cả hai thêm, sắp lại thứ tự | fullstack-developer | với T1, T3 | `apps/api/src/modules/version-control/three-way-merge.ts` |
| T3 | Làm backend comment: `comment-model` (anchor `{part, path, range}`, thread, reactions, `resolvedAt`), routes, `mention-parser`; anchor lệch thì "outdated"; Workspace Admin xoá được nhưng không sửa; @mention gửi qua `notification-service` | fullstack-developer | với T1, T2 | `apps/api/src/modules/comments/` |
| T4 | Làm fork collection và environment (Label, Workspace, kèm environment khi fork collection; Viewer fork được), sửa nhãn, danh sách và số fork, Pull changes có diff; chặn theo `plan-limits.forkPrPublic` (Pro) | fullstack-developer | với T7 | `apps/api/src/modules/version-control/fork-model.ts`, routes, service |
| T5 | Làm merge 3 tuỳ chọn ("Merge changes", "… and update source", "… and delete source") với kiểm Editor đúng phía, `conflict-model`, Keep Source/Keep Destination từng thay đổi và "Keep all changes to …"; mỗi merge sinh revision | fullstack-developer | với T7 | `apps/api/src/modules/version-control/conflict-model.ts`, service |
| T6 | Làm pull request: `pull-request-model`, `pull-request-review-model`, trạng thái Open/Approved/Declined/Merged, reviewer nhận thông báo, "Pull updates" khi nguồn đổi, comment inline trên diff (dùng module comment của T3) | fullstack-developer | — | `apps/api/src/modules/version-control/pull-request-*.ts` |
| T7 | Làm watch: `watch-model` và hook trong `changelog-service` để báo khi request, biến, script hoặc folder đổi; không báo thay đổi của chính mình; không áp cho workspace cá nhân | fullstack-developer | với T4, T5 | `apps/api/src/modules/watch/`, `apps/api/src/modules/collections/changelog-service.ts` |
| T8 | Làm UI version control: fork-dialog, hover card và sửa nhãn, merge-dialog, conflict-resolver (xuất ra để phase 16 dùng lại), diff-viewer dùng chung phase 12, trang danh sách, tạo và chi tiết PR; nút Fork và Watch trên header collection thuộc task này | fullstack-developer | với T9 | `apps/web/src/features/version-control/` |
| T9 | Làm UI comment: comments-pane, inline-comment-gutter, mention-autocomplete, reactions, "Show resolved", Copy link, render Markdown | fullstack-developer | với T8 | `apps/web/src/features/comments/` |
| T10 | Viết integration test: vòng fork, sửa, PR, approve, merge với cả 3 tuỳ chọn; Keep Source/Destination ra đúng kết quả; Viewer fork được nhưng không merge vào nguồn; @mention đúng kênh; resolve/reopen; Admin xoá mà không sửa được; watch không báo thay đổi của chính mình; Free bị chặn fork/PR | tester | — | test trong `apps/api/src/modules/version-control/`, `comments/`, `watch/` |
| T11 | Deploy bản phase lên staging (cần user xác nhận) | fullstack-developer | — | `deploy/compose.staging.yml` |
| T12 | Review cuối phase, chú trọng mất dữ liệu khi merge | code-reviewer | — | toàn phase |

### Checklist
- [ ] T1 Spec fork, merge, conflict, PR, comment, watch đã chốt theo prototype
- [x] T2 `three-way-merge` có đủ bộ ca xung đột (2026-10-16, đợt B1: `apps/api/src/modules/version-control/three-way-merge.ts`, `collection-merge.ts` sửa cây sau merge)
- [x] T3 Backend comment, anchor inline, outdated, mention, quyền Admin (2026-10-16, đợt A: `apps/api/src/modules/comments/`; anchor lưu offset kèm đoạn chữ đã chọn, outdated khi chỗ đó không còn đúng đoạn chữ, CRLF tính như LF; Viewer comment được; giới hạn `comment` 20/phút mỗi người, 60/phút mỗi collection, mỗi tác giả báo một người tối đa 10 lần/10 phút)
- [x] T4 Fork, nhãn, danh sách fork, Pull changes, chặn theo gói (2026-10-16, đợt B1, collection và environment)
- [x] T5 Merge 3 tuỳ chọn, giải xung đột, revision sau merge (2026-10-16, đợt B1; mục changelog `merge`/`pull`)
- [ ] T6 PR đủ trạng thái, reviewer, Pull updates, comment inline trên diff
- [x] T7 Watch qua changelog (2026-10-16, đợt A: `apps/api/src/modules/watch/`; job `WatchDigestJob` mỗi phút đọc changelog thay vì móc vào từng đường ghi, mỗi người theo dõi nhận một thông báo tổng hợp; chỉ workspace team)
- [ ] T8 UI version control và nút Fork/Watch (Watch xong ở đợt A; fork, nhãn, panel Forks, pull, merge, giải xung đột xong ở đợt B1; còn trang pull request ở B2)
- [x] T9 UI comment đủ thread, reaction, resolve, Markdown (2026-10-16, đợt A: `apps/web/src/features/comments/`, panel Comments ở right rail, comment inline trên vùng chọn của URL/params/headers/body/scripts kèm marker và highlight, gợi ý @mention, Copy link mở đúng thread; cờ web `comments`, cổng server `COMMENTS_ENABLED`)
- [ ] T10 Integration pass
- [ ] T11 Staging đã deploy sau khi user xác nhận (đợt A lên production 2026-10-16, user đồng ý: release `20261016-093326-047ccf396ad0`, cờ `comments` và `COMMENTS_ENABLED=true`, DAST đạt; còn đợt B)
- [ ] T12 Review không còn finding mức high
- [x] Verification: unit `three-way-merge` (khác field, cùng field, xoá đối sửa, cùng thêm, sắp lại thứ tự) pass (2026-10-16)
- [ ] Verification: integration fork, PR, approve, merge 3 tuỳ chọn và Keep Source/Destination pass; Viewer không merge được vào nguồn
- [x] Verification: integration comment (@mention đúng kênh, resolve/reopen, Admin xoá không sửa) pass (2026-10-16: `comment-operations.test.ts`, `comment-limits.test.ts`, `watch-digest.test.ts`; E2E `collection-comments.spec.ts`)
- [ ] Mọi dòng ma trận tương đương có test hoặc kịch bản E2E tương ứng
- [ ] `pnpm lint && pnpm typecheck && pnpm test` sạch
- [ ] `pnpm check:mcp-coverage` pass
