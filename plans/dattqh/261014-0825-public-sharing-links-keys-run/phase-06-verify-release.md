---
phase: 6
title: "E2E, docs, SAST, deploy, DAST"
status: in-progress
priority: P1
effort: "M"
dependencies: [2, 3, 4, 5]
---

# Phase 06: E2E, docs, phát hành

## Goal
Chứng minh bốn đường chia sẻ chạy đầu-cuối và không lộ dữ liệu, hoàn tất tài liệu, rồi phát hành lên production khi
user xác nhận.

## Bối cảnh đã kiểm
- Stack e2e hard-code `VITE_FEATURES` và đã lệch `released-features` (thiếu `mockPowerUps`), gọi thẳng `vite build`
  (`e2e/support/stack.ts:93-103,120-126`).
- Giới hạn có thể nâng trong e2e qua `RuntimeSettings` (`apps/api/src/config/runtime-settings.ts:103-131`).

## Files to Create / Modify
- Modify `e2e/support/stack.ts`: cờ web = `infra/localman/released-features` + `publicSharing`; API chạy với
  `PUBLIC_SHARING_ENABLED=true`; nâng `publicLinkPerIp`, `accessKeyPerIp`.
- Create `e2e/specs/public-sharing-link.spec.ts`: chủ collection (thành viên Editor) bật public link; context chưa đăng
  nhập thấy request và example (không body), không thấy token gõ thẳng hay biến secret; Admin tắt
  `publicLinksAllowed` → "không tìm thấy".
- Create `e2e/specs/public-sharing-guest.spec.ts`: người thứ hai mở guest link thấy bản đã che, xin quyền, chủ duyệt,
  người đó mở được collection trong workspace.
- Create `e2e/specs/public-sharing-run-button.spec.ts`: trang HTML tĩnh phục vụ trong test chứa mã nhúng; bấm, đăng
  nhập (IdP giả), chọn workspace, import không kèm script; collection xuất hiện với dữ liệu đã che.
- Docs: `docs/system-architecture.md` (luồng che dữ liệu công khai, cổng `PUBLIC_SHARING_ENABLED`), trang `/docs` cho
  người dùng (cái gì công khai, cái gì bị che) ba ngôn ngữ, `docs/deployment-guide.md` (biến `PUBLIC_SHARING_ENABLED`,
  bật/tắt và rollback), ADR `docs/decisions/0004-public-sharing-redaction.md` (che phía server, công khai theo
  collection, guest không nhận role, Free dùng được, chỉ thành viên công khai được).
- Modify `plans/dattqh/261008-1123-localman-core/phase-15-public-sharing.md`: 15a làm ở plan này, còn lại 15b.
- Modify `infra/localman/released-features` thêm `publicSharing` và `/opt/localman/.env` đặt
  `PUBLIC_SHARING_ENABLED=true` **chỉ khi deploy** (cần user xác nhận).

## Tasks & Steps
1. Ba spec e2e, `--repeat-each=3` ổn định.
2. Cổng: `pnpm lint && pnpm typecheck && pnpm test && pnpm check:mcp-coverage && pnpm check:tokens`, `pnpm e2e`.
3. SAST trên diff của đợt: serializer, xác thực key, `canPublish`/`stillServable`, tenant, rate limit, `returnTo`, map
   che log, render nội dung người dùng, cổng server.
4. Deploy (cần user xác nhận): bật cờ web và cổng server cùng lúc theo skill `localman-ops-prod`; kiểm sau deploy và 15
   phút sau. Rollback: đặt `PUBLIC_SHARING_ENABLED=false` và reload API trước, rồi mới đổi release nếu cần.
5. DAST trên production: lấy dữ liệu nhạy cảm qua trang public, trang guest, JSON access key, import nút Run; dò
   `linkId`/key (429 theo IP); key thu hồi và key quá hạn (401); Host tenant khác không đọc chéo; header bảo mật của
   `/public/c/…`, `/guest/…`, `/run/…`; access log nginx không chứa `linkId`, `buttonId`, `access_key`; badge tải được.

## Verification
- Mọi acceptance criterion của `plan.md` có test hoặc bước DAST tương ứng; ghi kết quả vào `plan.md`.
