---
title: "Localman phase 10: API client web lên production"
date: 2026-10-09
summary: "Workbench, định tuyến direct/proxy/Tunelo, review fix, deploy"
---

# Localman phase 10: API client web lên production

## What happened
Hoàn tất phase 10 (API client giống Postman): web workbench (tab, nháp đồng bộ server, request builder, script QuickJS trong Web Worker, response viewer, history, import/export, snippet, "Open in API Client"), bộ định tuyến Auto/Direct/Proxy và Tunelo thủ công. Commit `60709fc`, `5c38331`, `3fcd2a5`; release `20261009-202333-3fcd2a50e0c7-dirty` đang chạy.

## Lỗi thật đáng nhớ
- Tunelo qua proxy chắc chắn hỏng trên production: `*.tunnel.inetdev.io.vn` trỏ về chính server .65 nên SSRF guard (chặn địa chỉ của chính server) từ chối. Sửa bằng `TUNNEL_DOMAINS` + miễn chặn cho `<label>.<domain>` https:443, ép Host.
- Auto từng gửi lại POST đã tới đích (lỗi đọc body bị coi là CORS). Giờ chỉ `TypeError` trước response mới fallback; POST/PATCH không bao giờ tự gửi lại, nút "Gửi qua proxy" nhớ origin.
- Proxy dev của Vite khoá `"/api"` nuốt route `/api-client`.
- Chữ cái avatar (aria-hidden) vẫn bị axe tính vào visible text, làm `label-content-name-mismatch` trên nút tài khoản; vẽ bằng CSS `content: attr()`.
- nginx 1.20 không có MIME wasm.
- Lockfile lẫn dependency của phiên khác: dựng lại lockfile trong thư mục tạm từ manifest HEAD + package.json của mình rồi stage blob đó.

## Decision
- 5 operation đổi nơi gửi credential thành MCP-exempt; history che secret literal, giữ `{{var}}`.
- Deploy từ working tree (`-dirty`) vì production đang chạy phần chưa commit của phiên `localman-next-6d`; mọi gate chạy trên chính tree đó.

## Next steps
- T8b tự nhận tunnel (chờ Tunelo accounts), T11 archive repo cũ (cần user xác nhận).
- `tunnel.hoandat.com` chưa có DNS.
- Test tay trên production bằng tài khoản thật (script worker, CORS fallback).

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.
