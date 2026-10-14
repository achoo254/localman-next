---
title: "Chia sẻ công khai 15a: public link, guest, access key, nút Run (import)"
description: "Người ngoài workspace xem được collection qua public link hoặc guest link, ứng dụng khác đọc JSON qua access key, và README nhúng được nút Run in Localman để import collection; mọi giá trị nhạy cảm bị che phía server."
status: in-progress
priority: P1
effort: "L (6 phase: 1×S, 4×M, 1×M release)"
branch: ""
tags: [feature, api-client, sharing, security, ui]
blockedBy: []
blocks: []
created: 2026-10-14
---

# Chia sẻ công khai 15a

Đợt 1 của lộ trình trong `reports/brainstorm-261013-2039-post-multi-tenant-roadmap.md`. Tách từ
`261008-1123-localman-core/phase-15-public-sharing.md`: phần không cần fork làm ở đây (15a), phần fork (15b) chờ
phase 14.

## Kết quả mong muốn
Thành viên workspace (Editor trở lên) bấm Share trên một collection và có bốn cách đưa nó ra ngoài:
1. **Public link**: trang chỉ đọc ai cũng mở được, không cần đăng nhập.
2. **Guest link**: người đã đăng nhập mở link thấy cùng trang chỉ đọc đó, kèm nút "Xin quyền chỉnh sửa" đi qua luồng
   access request có sẵn; chỉ khi được duyệt mới có quyền thật trên collection.
3. **API access key**: link JSON (Postman v2.1) chỉ đọc cho script/CI, luôn là bản hiện tại.
4. **Nút Run in Localman**: mã HTML/Markdown dán vào README; bấm thì đăng nhập, chọn workspace, import collection
   (kèm environment nếu có) vào workspace đó.

**Bất biến:** mọi dữ liệu đi qua bốn đường này đều do **một** serializer phía server tạo ra (`publicCollectionTree`,
`publicEnvironment`), không bao giờ là view nội bộ của collection.

## Quyết định đã chốt
| Điểm | Chọn | Ai |
|---|---|---|
| Phạm vi đợt 1 | 15a: public link, guest, access key, nút Run chế độ import, cảnh báo secret; fork (15b) chờ phase 14 | User, 2026-10-14 |
| Gói Free | Free dùng được cả bốn; fork vẫn chỉ Pro (`forkPrPublic`) | User, 2026-10-14 |
| Guest thấy gì | **Bản đã che** (như public link, cần đăng nhập) + nút xin quyền; không cấp element role khi mở link | User, 2026-10-14 (red-team) |
| Body response của example | **Bỏ** khỏi mọi đường công khai; giữ status, header (header nhạy cảm bị che) | User, 2026-10-14 (red-team) |
| Ai được công khai | Chỉ **thành viên workspace** có vai trò Admin/Editor (`WORKSPACE_PERMISSIONS.publishPublic`); người được share lẻ thì không | User, 2026-10-14 (red-team) |
| Công tắc của Admin | `sharing.publicLinksAllowed` (public link, nút Run public), `guestsAllowed`, `accessKeysAllowed`; tắt là link/key/nút đang có **ngừng ngay** (kiểm lúc phục vụ) | User, 2026-10-14 (red-team) |
| Đơn vị công khai | Theo collection (link riêng, thu hồi được), không dùng workspace `public` | AI (kỹ thuật) |
| Nơi che dữ liệu | Server, một serializer ở `packages/shared` | AI (bất biến bảo mật) |
| Hết hạn access key | Kiểm lúc dùng (`lastUsedAt ?? createdAt` + 60 ngày), không job | AI (KISS) |
| Thu hồi | **Xoá document** (link, key, nút); không giữ bản ghi đã thu hồi (MongoDB không làm được unique "khi chưa thu hồi") | AI (red-team) |
| Nút Run | Badge SVG tĩnh (`packages/design-tokens/run-button.svg`) + link mở tab mới; **không** có script nhúng | AI (red-team) |
| Phát hành | Cổng server `PUBLIC_SHARING_ENABLED` (mặc định tắt, chặn mọi operation và MCP tool mới) + cờ web `publicSharing`; cả hai bật cùng lúc khi user xác nhận deploy | AI (red-team) |

## Không làm (non-goals)
- Fork từ public link, chế độ fork của nút Run, pull request, merge, comment, watch: phase 14 và 15b.
- Workspace `public` (visibility) và trang liệt kê public workspace.
- Public link cho environment hay mock project riêng lẻ (mock đã công khai qua URL có secret).
- Che body, path và script theo nội dung: chỉ **cảnh báo** (heuristic), không che.
- Đổi giới hạn gói khác, đổi tên `forkPrPublic`.

## Phases
| # | Phase | Tier | Phụ thuộc |
|---|---|---|---|
| 01 | [Nền chung: serializer công khai, che credential, phát hiện secret, cổng, cờ](phase-01-shared-redaction-and-flag.md) | S | — |
| 02 | [Public link, trang chỉ đọc, cài đặt chia sẻ của workspace](phase-02-public-link-and-page.md) | M | 01 |
| 03 | [Guest link: xem bản đã che khi đăng nhập, xin quyền](phase-03-guest-access.md) | M | 02 |
| 04 | [Collection Access Key và JSON chỉ đọc](phase-04-collection-access-keys.md) | M | 01, 02 |
| 05 | [Nút Run in Localman, chế độ import](phase-05-run-button-import.md) | M | 01, 02 |
| 06 | [E2E, docs, SAST, deploy, DAST](phase-06-verify-release.md) | M | 02–05 |

Các phase chạy tuần tự (02–05 cùng sửa `share-dialog` và cài đặt workspace). Cài đặt `sharing` của workspace
(cả ba công tắc) làm ở phase 02 nên 03–05 chỉ đọc.

## Acceptance criteria
1. Chưa đăng nhập, `GET /public/c/<linkId>` hiện collection (thư mục, request, example, mô tả, biến) chỉ đọc; link
   sai, đã thu hồi, collection ở thùng rác hay đã xoá, người tạo không còn là Editor của workspace, hoặc
   `publicLinksAllowed` tắt: đều 404 giống nhau.
2. Mọi payload công khai (trang public, trang guest, JSON qua access key, dữ liệu import của nút Run) **không** chứa:
   giá trị biến `secret`; giá trị local; giá trị environment không shared; token/password/API key gõ thẳng trong tab
   Auth (request, folder, collection, request của example); giá trị gõ thẳng của header/query có tên nhạy cảm (gồm
   `set-cookie`); userinfo trong URL; body response của example. Tham chiếu `{{var}}` giữ nguyên văn (kể cả khi cùng
   query với một tham số bị che). Có test cho từng dòng.
3. Guest: Editor bật guest link; người đã đăng nhập mở link thấy bản đã che và nút "Xin quyền chỉnh sửa" (tạo access
   request qua `POST /elements/collection/:id/access-requests`); mở link **không** cấp quyền gì; collection trong
   workspace cá nhân không có nút xin quyền; `guestsAllowed` tắt thì link trả 404 ngay.
4. Access key: chỉ hiện một lần, lưu SHA-256; `GET /api/v1/public/collections/:collectionId?access_key=…` trả v2.1
   đã che; key sai, đã thu hồi, quá 60 ngày không dùng, người tạo không còn là thành viên, hay `accessKeysAllowed` tắt
   đều trả 401 `ACCESS_KEY_INVALID` cùng thông điệp; vượt giới hạn theo IP hoặc theo key trả 429.
5. Nút Run: mã HTML và Markdown copy được; badge hiển thị trên GitHub; bấm mở `/run/<buttonId>`; chưa đăng nhập thì
   thấy bước đăng nhập (không bị đẩy đi ngay); chọn workspace mình là Admin/Editor; bước import liệt kê script và mặc
   định không nhập script với nút public; import tạo collection (và environment nếu có) với dữ liệu đã che; bấm hai
   lần không tạo hai bản; vượt giới hạn trả lỗi rõ ràng.
6. Trước khi bật public link, bật guest link, tạo key hay tạo nút Run: hộp cảnh báo liệt kê vị trí (không in giá trị)
   biến thường, script, body request và header example trông giống secret, kèm câu "biến thường được công khai".
7. Mọi operation mới qua `defineOperation`; bật public link, guest link, nút Run public và import nút Run có dry run và
   xác nhận MCP; tắt, thu hồi, xoá là `destructive` có dry run; operation công khai `mcp.exempt`;
   `pnpm check:mcp-coverage` pass. Khi `PUBLIC_SHARING_ENABLED` tắt, mọi operation mới trả 404 và MCP tool không đăng ký.
8. Model mới gắn `tenantScopePlugin`; không lưu `workspaceId` (luôn tra workspace hiện tại của collection, nên chuyển
   collection sang workspace khác thì công tắc của workspace mới có hiệu lực).
9. Access log nginx không chứa `linkId`, `buttonId` hay access key (map `$localman_logged_uri`).
10. UI chỉ dùng token và primitive sẵn có; chữ qua `t()` ở en, zh-CN, vi; 375 px không cuộn ngang (kể cả Share dialog
    đủ tab); axe không có lỗi serious/critical trên trang public, guest, Run.
11. `pnpm lint && pnpm typecheck && pnpm test && pnpm check:mcp-coverage && pnpm check:tokens` sạch; e2e mới pass
    `--repeat-each=3`; SAST đạt; sau deploy DAST đạt.

## Rủi ro
- **Dữ liệu user không đánh dấu secret** (biến thường, body, script, path): chỉ cảnh báo; UI nói rõ cái gì được công
  khai.
- **Dò link/key**: 32 byte ngẫu nhiên; giới hạn theo IP chạy trước mọi tra cứu; nginx `limit_req` cho
  `/api/v1/public/`.
- **Script của collection import qua nút Run** đọc được environment của người import: liệt kê và mặc định không nhập
  với nút public.
- **Working tree dùng chung**: operation mới chỉ chạy khi `PUBLIC_SHARING_ENABLED` bật, nên deploy của session khác
  không phát hành tính năng chưa qua SAST/DAST.

## Validation Log

### Session 1 (2026-10-14)
| Câu hỏi | Chọn | Ảnh hưởng |
|---|---|---|
| Mặc định ba công tắc chia sẻ của workspace đã có | **Bật sẵn** | Khớp phase 02 (mặc định true, document cũ đọc ra true) |
| Phát hành | **Một lần ở phase 06** (một lượt SAST, deploy, DAST) | Khớp phase 06; phase 01–05 chỉ chạy trên local và CI, cổng server tắt |
| Script khi import qua nút Run public | **Mặc định không nhập** (nút team mặc định nhập), có liệt kê | Khớp phase 05 |

### Verification Results
- Claims checked: 11 (các khẳng định mới thêm sau red-team; phần còn lại đã được bốn reviewer kiểm)
- Verified: 11 | Failed: 0 | Unverified: 0
- Tier: Full (6 phase), giới hạn ở khẳng định mới vì `## Red Team Review` đã có bằng chứng
- Đã kiểm: `auth/return-to.ts`, `sharing/request-access-form.tsx`, `config/env.ts`, `.env.production.example`,
  `config/runtime-settings.ts`, `test-support/log-capture.ts`, `e2e/support/stack.ts`, `clientIpBucket`
  (`lib/rate-limit-windows.ts`), `createCollection` (`collection-service.ts:91`), `MAX_IMPORT_BYTES`
  (`import-json.ts:12`), `tree-keys.ts`, `COLLECTIONS_PER_WORKSPACE_MAX` (`collection-store.ts:38`), `shareVariables`
  (`access-permissions.ts:71,87`).

### Whole-Plan Consistency Sweep
Ba quyết định trùng với nội dung đã viết nên không phase nào phải sửa. Rà lại các thuật ngữ đã bỏ (`viaGuestLink`,
`revokedAt`, `run-button.js`, `/api/public/`, `updateSharingSettings`, `joinAsGuest`): chỉ còn trong phần bối cảnh và
bảng red-team, có chủ đích. Không còn mâu thuẫn. Kết luận: **sẵn sàng triển khai**.

## Red Team Review
Bốn reviewer (Security Adversary, Failure Mode Analyst, Assumption Destroyer, Scope & Complexity Critic), 40 phát
hiện, gộp còn 15, cả 15 chấp nhận; user chốt 3 điểm sản phẩm (2026-10-14).

| # | Phát hiện | Mức | Xử lý |
|---|---|---|---|
| 1 | Guest là Viewer nên đọc dữ liệu thô (`collection-view.ts:139-143`), changelog, duplicate | Critical | User chọn guest xem bản đã che, không cấp role (phase 03 viết lại) |
| 2 | Example (request gốc, header, body response) và userinfo URL không bị che; `set-cookie` lọt | Critical | Che example request/header, bỏ body (user chọn), che userinfo (phase 01) |
| 3 | `buildUrlWithParams` của shared mã hoá lại query, vỡ `{{var}}` và đổi lịch sử | Critical | Chuyển nguyên `urlWithParams`/`queryPairs` của web sang shared, test tổ hợp (phase 01) |
| 4 | Cờ chỉ ở web; API và MCP lên prod ở lần deploy kế tiếp của bất kỳ session nào | Critical | Cổng `PUBLIC_SHARING_ENABLED` (phase 01), bật ở phase 06, rollback = tắt cổng |
| 5 | Unique "khi chưa thu hồi" không tạo được trên MongoDB | Critical | Thu hồi = xoá; bắt duplicate key khi bật song song (phase 02, 04, 05) |
| 6 | MCP xác nhận đặt ngược; destructive thiếu `dryRun`; operation cài đặt trùng `sharing.updateWorkspace` | High | Đổi chiều; cài đặt qua `sharing.updateWorkspace` (phase 02–05) |
| 7 | Không có công tắc cho public link/nút Run; người được share lẻ công khai được; người tạo mất quyền vẫn phục vụ | High | User chọn chỉ thành viên Editor+, ba công tắc, kiểm lúc phục vụ (phase 02) |
| 8 | Model lưu `workspaceId` nên sai sau khi chuyển collection; workspace cá nhân | High | Không lưu `workspaceId`; xin quyền ẩn ở workspace cá nhân |
| 9 | linkId/buttonId trên path bị ghi vào access log nginx | High | Map che log + test (phase 02); guest dùng POST body |
| 10 | Rate limit theo key không chặn dò, còn khuếch đại ghi DB; `/api/` không `limit_req` | Medium | IP trước, key sau khi khớp; zone nginx; giới hạn trong `RuntimeSettings` |
| 11 | Import nút Run: không giới hạn byte, không idempotent, environment cũ, thùng rác; environment import không nhận dữ liệu server | Medium | Giới hạn sau khi che, khoá idempotency, kiểm lại mỗi lần, tách `createEnvironmentFromVariables` (phase 05) |
| 12 | Trang Run bị đẩy đi đăng nhập ngay; silent sign-in trên trang công khai | Medium | Chỉ gọi API khi đã đăng nhập, `redirectOnUnauthorized: false`; ghi rõ silent sign-in |
| 13 | Script không tin cậy nhập bằng một cú bấm | Medium | Liệt kê, mặc định không nhập với nút public (phase 05) |
| 14 | `CollectionTree` cần ~20 prop sidebar; Share dialog 5 tab ở 375 px | Medium | Cây chỉ đọc riêng nhận `ImportedItem[]`; test 375 px |
| 15 | Mâu thuẫn và sai lệch: `run-button.js` vs SVG, path `/api/v1`, `hasBlankedSecrets`, phụ thuộc, AC6 thiếu tab key, `api-contract.md` hai chủ, helper token trùng, cờ e2e hard-code | Medium | Sửa từng chỗ (mọi phase) |

### Whole-Plan Consistency Sweep
Đã rà lại `plan.md` và sáu phase sau khi áp dụng: bỏ mọi chỗ nhắc `viaGuestLink`, `revokedAt`, `workspaceId` trong
model mới, `run-button.js`, `CollectionTree` cho trang public, `/api/public/...`, `workspaces.updateSharingSettings`;
phase 02 sở hữu cài đặt `sharing` và `docs/api-contract.md`; phase 06 chỉ thêm phần kiến trúc và docs người dùng.
Không còn mâu thuẫn đã biết.

## Implementation Log (2026-10-14)

Phase 01–05 xong trên working tree (chưa commit), cổng `PUBLIC_SHARING_ENABLED` tắt; phase 06 còn deploy và DAST (cần user
xác nhận deploy).

### Lệch so với plan (có lý do)
| Điểm | Plan | Làm | Lý do |
|---|---|---|---|
| Công tắc workspace | thêm vào `sharing.updateWorkspace` hoặc tách | tách `sharing.getWorkspaceSharing` / `sharing.updateWorkspaceSharing` (`PATCH /workspaces/:id/sharing`) | annotation `destructive` không đổi theo input; tắt là destructive có dry run |
| Environment cho nút Run | tạo `createEnvironmentFromVariables` | dùng `createEnvironment` có sẵn (đã nhận `VariableInput[]`, kiểm quyền người gọi) | không có lõi nào cần tách |
| Xác nhận MCP khi tạo nút Run | chỉ khi public | luôn `requiresConfirmation` | cờ là tĩnh theo operation |
| Tạo access key | không nêu dry run | có `dryRun` để trả `warnings` | UI cảnh báo trước khi tạo, cùng nguồn với server |
| Share dialog | tab Public, guest, keys, run riêng | 5 tab ngắn: People, Link, Public (public + guest), Keys, Run | vừa 375 px |
| Che field form | chỉ cảnh báo body | che field urlencoded/form-data text có tên nhạy cảm | SAST H1: là cặp tên/giá trị như header; ghi vào ADR 0004 |
| e2e rate limit | nâng `publicLinkPerIp`, `accessKeyPerIp` | giữ mặc định | API không đọc giới hạn từ env; 9 lượt e2e không chạm ngưỡng |

### SAST (code-reviewer độc lập, 2026-10-14)
Không có Critical. Đã sửa: H1 field form có tên nhạy cảm; H2 chữ gõ cạnh `{{var}}`; M1 cặp trong fragment URL; M2 userinfo
không scheme, `//`, `{{scheme}}://`; M3 quét đủ request của example; M4 `$set` theo từng công tắc; M5 error log `crit`
cho `/api/v1/public/`; M6 cảnh báo environment của nút Run; L1 thêm tên nhạy cảm (`session`, `jwt`…); L2 URL trong
`Location`; L3 đổi link khi người tạo hết quyền; L5 khoá idempotency gắn nút và workspace, không xoá claim khi đã tạo
collection; L6 map/location nginx không phân biệt hoa thường. Mỗi mục có test hồi quy.
Chấp nhận, chưa sửa: L4 tạo song song có thể vượt trần 10 key/20 nút; L7 router/MCP mặc định đủ registry nếu không
truyền `operations` (`main.ts` truyền danh sách đã lọc); L8 `linkId`/`buttonId` lưu rõ; L9 `;` làm phân cách query;
Cloudflare thấy URL có access key (ADR 0004).

### Kiểm tra
- `pnpm lint` sạch (biome + check:i18n); `pnpm typecheck` sạch; `pnpm check:mcp-coverage` exit 0; `pnpm check:tokens` exit 0.
- `vitest run --maxWorkers=2` toàn repo: 681 file, 4869 test pass.
- e2e mới (`public-sharing-link`, `-guest`, `-run-button`) `--repeat-each=3`: 9/9 pass; gồm axe (không serious/critical)
  trên trang public, guest, Run và Share dialog 5 tab không cuộn ngang ở 375 px.
- `pnpm e2e` toàn bộ: 43/43 pass, stack dùng cờ của `released-features` + `publicSharing` và `PUBLIC_SHARING_ENABLED=true`.
- Còn lại (phase 06): commit, deploy (bật cờ web và cổng server cùng lúc), kiểm sau deploy và 15 phút sau, DAST trên
  production. Kết luận vận hành chỉ đưa ra khi cả SAST và DAST đạt.
