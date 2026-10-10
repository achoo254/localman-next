# Nút "Gửi thông báo thử" trên trang kênh thông báo

Trạng thái: DONE. Đã làm thêm hai việc tiếp theo (bản thử gửi lại Telegram cho chat đang bị đánh dấu chặn, và cập nhật docs). Tính năng đã chạy đủ API, MCP, OpenAPI và web. Mọi gate của Localman đều sạch. Lỗi còn lại chỉ nằm ở `@tunelo/server`, phần một session khác đang sửa dở.

## Hợp đồng API

`POST /api/v1/notifications/test` (`notifications.sendTestNotification`, MCP tool `send_test_notification`, toolset `notifications`, scope `notifications:write`).

- Input `{}`, scope `user`. Annotations: `readOnly: false, destructive: false, idempotent: false`. Mỗi lần gọi gửi một tin mới, không ghi đè hay xoá gì.
- Output:
  - `inApp: "sent"`: luôn là `sent`. Nếu lưu vào chuông thất bại thì cả request trả 500.
  - `webPush: "sent" | "skipped" | "failed"`: `sent` khi ít nhất một thiết bị nhận. `skipped` khi server không cấu hình VAPID hoặc không có thiết bị nào thuộc phiên còn sống. `failed` khi mọi thiết bị từ chối, đã mất (404/410), hoặc channel ném lỗi (lỗi được log).
  - `telegram: "sent" | "skipped" | "blocked" | "failed"`: `skipped` khi chưa cấu hình bot, chưa liên kết chat, hoặc đang có `refreshPendingAt`. Chat đã bị đánh dấu `blockedAt` thì được xoá dấu và gửi lại, vì user có thể vừa bấm Start. `blocked` khi Telegram trả 403; khi đó `telegram.blockedAt` được đặt lại như kênh thường làm.
- Gửi tới mọi kênh sẵn sàng, bỏ qua tuỳ chọn theo loại sự kiện. Request chờ từng kênh gửi xong rồi mới trả kết quả.
- Hạn mức: 1 lần / 60 s cho mỗi user. Dùng `takeRateLimitSlot` (collection `rate_limit_windows`, cửa sổ cố định) với scope `notification-test:user`. Vượt hạn mức trả 429 `{ error: { code: "RATE_LIMITED", message } }`.
- Loại `notification.test` (`TEST_NOTIFICATION_TYPE`) nằm trong `NOTIFICATION_TYPES` (các loại chuông lưu được), không nằm trong `NOTIFICATION_EVENT_TYPES`. Vì vậy nó không có dòng trong bảng tuỳ chọn, không có nhãn, và `PUT /notification-preferences` với type này trả 400. Link của nó là `/account/notifications`.
- Chữ hiển thị nằm trong `testNotification.{title,body}` của `apps/api/src/i18n/messages/{en,vi,zh-cn}.ts` và được render theo `locale` của user, đúng như các thông báo khác.

## Giao diện

- `TestNotificationPanel` là một dòng mới ở cuối thẻ "Delivery channels". Nút `Button` (icon `IconSend`) đổi thành "Sending…" và bị khoá (`aria-busy`) trong lúc gửi.
- Khi gửi xong, `TestNotificationSummary` hiện trong một `Alert` info, mỗi kênh một `Badge`:
  - Sent
  - Not set up
  - Not on this server: kênh `available: false`
  - Failed, kèm gợi ý thử lại
  - Bot not started, kèm link `@bot` và gợi ý "bấm Start rồi gửi thử lần nữa"
- Telegram `skipped` giờ chỉ hiện "Not set up" hoặc "Not on this server", vì chat bị chặn không còn bị bỏ qua.
- Lỗi 429 hiện `Alert` warning kèm câu riêng. Các lỗi khác hiện qua `errorMessage`.
- Sau khi gửi thành công, `announceNotificationsChanged()` (`notifications-changed.ts`, một `EventTarget` trong module) khiến `useNotifications` tải lại, nên badge của chuông cập nhật ngay. Trang cập nhật `telegram.activated` theo kết quả: `sent` thì `true` (ẩn nhắc Start), `blocked` thì `false` (hiện nhắc Start).
- Chữ dùng key `notifications.test.*` có đủ en, zh-CN và vi; chỉ dùng token và utility.

## File đã thay đổi

API:

- Mới: `apps/api/src/modules/notifications/test-notification.ts` (có `retryTelegram`: `$unset telegram.blockedAt` rồi `deliver`), `test-notification-operations.ts`, `test-notification.test.ts`.
- Sửa: `notification-events.ts`, `notification-model.ts`, `notification-texts.ts`, `notification-service.ts` (getter `channels`), `channels/in-app-channel.ts`, `channels/web-push-channel.ts` (`deliver` giờ trả `WebPushDelivery`), `notification-service.test.ts`.
- Sửa: `apps/api/src/operations/registry.ts`, chỉ thêm 1 import và 1 entry.
- Sửa: `apps/api/src/i18n/messages/{en,vi,zh-cn}.ts`, chỉ thêm khối `testNotification`.

Web:

- Mới: `apps/web/src/features/notifications/test-notification-api.ts`, `test-notification-panel.tsx`, `test-notification-summary.tsx`, `notifications-changed.ts`, `test-notification-panel.test.tsx`.
- Sửa: `notification-settings-page.tsx`, `use-notifications.ts`, `notification-bell.test.tsx`, `apps/web/src/i18n/messages/{en,vi,zh-CN}/notifications.ts`.

## Gate

| Gate | Kết quả |
|---|---|
| Test có mục tiêu (api) | 10 file, 63 test pass; `test-notification.test.ts` có 12 test |
| Test có mục tiêu (web) | 11 file, 61 test pass; `test-notification-panel.test.tsx` có 7 test, bell có thêm 1 test |
| `pnpm test --maxWorkers=2` | 276 file: 274 pass, 2 fail. 2074 test: 2063 pass, 11 fail. Cả 11 lỗi đều ở `@tunelo/server` (`request-relay.test.ts`, `ws-handler.test.ts`) |
| `pnpm typecheck` | Dừng ở `@tunelo/server` (TS2345 `KeyStore` → `TokenAuthenticator`, 2 lỗi). Typecheck riêng từng phần đều exit 0: `@localman/web`, `@localman/api`, `@localman/operations`, `@localman/shared`, `scripts`, `e2e` |
| `pnpm lint` | `check:i18n` sạch. `biome check .` chỉ báo `apps/tunelo-server/src/ws-handler.ts` (organizeImports) và `ws-message-guards.ts` (format). Các file tôi sửa: Biome exit 0 |
| `pnpm check:mcp-coverage` | `MCP coverage OK: 59 operation(s), 51 tool(s), 8 exempt.` |
| `pnpm check:tokens` | exit 0 |

## Lệch khỏi danh sách file được giao

`apps/api/src/i18n/messages/{en,vi,zh-cn}.ts` không có trong danh sách. Tôi vẫn thêm khối `testNotification` vào đó (chỉ thêm), vì đề bài trỏ tới đây và `docs/i18n.md` quy định mọi chữ thông báo của server phải nằm trong ba từ điển này. Lúc tôi sửa, ba file này chưa có thay đổi của session khác.

## Việc tiếp theo đã làm (2026-10-10)

1. Bản thử xoá `telegram.blockedAt` rồi gửi lại Telegram. 403 mới đánh dấu chặn lại và trả `blocked`. Vẫn `skipped` khi chưa liên kết chat hoặc đang có `refreshPendingAt`. Mô tả MCP/OpenAPI của operation đã cập nhật theo.
   - Test API mới: chat bị chặn được thử lại, gửi được và mất dấu `blockedAt`; thử lại vẫn bị 403 thì bị đánh dấu chặn lần nữa; `refreshPendingAt` vẫn bị bỏ qua. `test-notification.test.ts` giờ có 15 test.
   - Web: bỏ cách đọc "skipped + linked + chưa kích hoạt = blocked". Callback đổi thành `onTelegramActivated(boolean)`. Gợi ý `blockedWithBot`/`blockedNoBot` ở en, vi, zh-CN đổi thành "bấm Start rồi gửi thử lần nữa".
2. `docs/system-architecture.md`, mục "Thông báo": thêm đoạn **Thông báo thử** (endpoint, MCP tool, enum kết quả, cách thử lại chat bị chặn, `notification.test` không thuộc tuỳ chọn, 1 lần/phút).

Gate cho phần này:

- Test API có mục tiêu (`src/modules/notifications`, `src/i18n`): 7 file, 51 test pass.
- Test web có mục tiêu (`src/features/notifications`, `src/i18n`): 11 file, 61 test pass.
- Typecheck `@localman/api` và `@localman/web`: exit 0.
- `pnpm check:mcp-coverage`: `MCP coverage OK: 59 operation(s), 51 tool(s), 8 exempt.`
- `pnpm check:i18n`: sạch.
- Biome trên các file đã sửa: không có lỗi.

## Câu hỏi còn mở

Không có.
