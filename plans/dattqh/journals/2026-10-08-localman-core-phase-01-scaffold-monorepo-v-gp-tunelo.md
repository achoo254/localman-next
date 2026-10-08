---
title: "Localman core phase 01: scaffold monorepo và gộp Tunelo"
date: 2026-10-08
summary: "Dựng monorepo localman-next, gộp Tunelo giữ lịch sử, design tokens, operation registry; review bắt lỗ hổng CSRF trong router và đã sửa"
---

# Localman core phase 01: scaffold monorepo và gộp Tunelo

## What happened
- Gộp Tunelo vào monorepo bằng `git filter-repo` trên bản clone tạm (cài filter-repo vào scratchpad, không cài toàn máy). Path mới: `apps/tunelo-server`, `packages/tunelo-{cli,shared}`, `{infra,docs,plans,tests,scripts}/tunelo`; 13 tag đổi thành `tunelo-v*`. Không tag nào có `.github/` ở root, nên push tag sẽ không kích hoạt publish npm.
- Sau khi gộp, test Tunelo vẫn 106/106 (đúng bằng baseline ở repo gốc), dù vitest nâng từ 1.6 lên 3.2. Phải sửa tsconfig references (`../shared` giờ trỏ nhầm sang `@localman/shared`), root của build script (`../..`), README của CLI publish lên npm (trước copy từ root README, giờ là README của Localman).
- Dựng `apps/web`, `apps/api`, `packages/{shared,operations,design-tokens}` bằng 2 agent song song, chia rõ file sở hữu; deps cài trước một lần để agent không chạy `pnpm install` đồng thời.
- Review tìm ra lỗi High: router gộp query vào input cho mọi method và nhận body không phải JSON. Một form POST từ `{secret}.localman.hoandat.com` (cùng site với dashboard) sẽ chạy mutation khi phase 02 thêm cookie SameSite=Lax.

## Decision
- Router: GET lấy input từ query, các method khác chỉ từ JSON body; body không phải JSON trả 415. GET phải readOnly; op destructive không được public; `?dryRun` gửi tới op không hỗ trợ trả 400; trùng id, route hoặc tên tool làm server không khởi động.
- Giữ tên tool MCP không có tiền tố toolset (theo phase 17), nên động từ và danh từ phải duy nhất trên toàn registry.
- ZodError do handler tự ném trả 500, không phải 400.
- Token đặt ở `packages/design-tokens/tokens.css` (bước 2 của phase), không đặt ở `apps/web/src/styles`.

## Next steps
- User xác nhận: push nhánh và tag `tunelo-v*` (T4), archive repo `achoo254/tunelo` (T5).
- Chạy `docker compose up -d mongo && pnpm dev` trên máy có Docker.
- Phase 02 cần plan IdP (đợt 0) xong trước. Nên cân nhắc chuyển mock runtime sang domain riêng.
- `ak plan update` báo "plan not found", nên status trong `plan.md` vẫn là `pending`.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.
