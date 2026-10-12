---
phase: 2
title: "Tài khoản và đăng nhập không dùng email"
status: completed
priority: P1
effort: "L"
dependencies: [1]
---

# Phase 02: Tài khoản và đăng nhập không dùng email

## Goal
Làm các trang tương tác của IdP: đăng nhập, đăng ký, consent, duyệt thiết bị và logout. Có email/password, Google và GitHub. Phục hồi tài khoản không dùng email: mã khôi phục, Telegram, hoặc OAuth đã liên kết. Có trang quản lý tài khoản: phiên, thiết bị, ứng dụng đã cấp quyền, Telegram.

> **Cập nhật 2026-10-10: ADR 0004 (repo `hoandat-auth`) thay một phần phase này.** Đăng nhập và đăng ký giờ **chỉ** bằng Google/GitHub. Đã xoá hẳn (code, route, test): email/password, mã khôi phục, quên mật khẩu (cả 3 đường), link đặt lại qua Telegram, khoá đăng nhập theo username/email, đổi mật khẩu và tạo lại mã khôi phục ở `/account`. Telegram chỉ còn để nhận thông báo. Không huỷ được provider cuối cùng còn đăng nhập được. Dữ liệu mật khẩu cũ để nguyên trong MongoDB nhưng không code nào đọc. Nội dung Goal, Files, Tasks và bảng giao việc bên dưới giữ nguyên làm lịch sử của lần làm đầu; nguồn đúng hiện tại là ADR 0004 và `CLAUDE.md` của repo `hoandat-auth`.

Phần này **chuyển từ phase 02 cũ của Localman** sang. Quyết định do Jev chọn, user chốt "không có mail server".

## Files to Create
- `src/accounts/user-model.ts`: `{_id(sub), username (unique, ^[a-z0-9_]{3,30}$), email (unique), emailVerifiedBy:null|'google'|'github', passwordHash?, recoveryCodeHashes[], name, picture, providers:{google?,github?}, telegram?:{chatId, linkedAt}, createdAt, disabledAt?}`
- `src/accounts/password-hasher.ts` (argon2id), `recovery-codes.ts` (8 mã dùng một lần), `account-linking.ts` (chỉ tự liên kết khi email đã xác minh; còn lại phải đăng nhập mật khẩu trước)
- `src/accounts/upstream-google.ts`, `upstream-github.ts` (ban đầu là `arctic`; đổi sang `openid-client` vì `arctic` ngừng được hỗ trợ, Jev 1.00, xem Validation Log của plan)
- `src/telegram/`: `bot-client.ts`, `link-routes.ts` (deep link `t.me/<bot>?start=<code>`, TTL 10 phút, dùng một lần), `webhook-routes.ts` (kiểm header secret token), `reset-link-service.ts` (link reset gửi qua bot, TTL 15 phút)
- `src/interactions/`: `login-page`, `signup-page` (hiện mã khôi phục một lần, có nút tải .txt), `consent-page` (hiện scope bằng lời dễ hiểu), `device-verify-page` (nhập user code, hiện tên thiết bị, nút Cho phép hoặc Từ chối), `forgot-password-page` (3 lựa chọn: mã khôi phục, Telegram, Google/GitHub), `logout-page`. Server render HTML, dùng chung token màu của Localman, wordmark "hoandat · Tài khoản".
- `src/account-portal/`: trang `/account` gồm hồ sơ, đổi mật khẩu, tạo lại mã khôi phục, liên kết hoặc huỷ Google/GitHub/Telegram, danh sách phiên đang mở (thu hồi được), thiết bị Tunelo, và ứng dụng đã cấp quyền gồm client MCP (thu hồi được)
- `src/__tests__/accounts.test.ts`, `interactions.test.ts`

## Tasks & Steps
1. Đăng ký gồm email, username và mật khẩu (tối thiểu 7 ký tự, đúng như Localman đang dùng). Đăng ký xong hiện **mã khôi phục** và bắt user xác nhận đã lưu.
2. Đăng nhập Google/GitHub:
   - Email trùng một tài khoản và email đó đã xác minh thì tự liên kết.
   - Email trùng nhưng chưa xác minh thì bắt đăng nhập mật khẩu trước.
   - Chưa có tài khoản thì tạo mới, đặt `emailVerifiedBy`, và hỏi chọn username.
3. Rate-limit theo IP và theo username/email; khoá 15 phút sau 5 lần sai. Có CSRF cho mọi form. Không bao giờ lộ một email có tồn tại hay không.
4. Trang duyệt thiết bị (device flow của Tunelo): chưa đăng nhập thì bắt đăng nhập trước, sau đó hiện "Cho phép `tunelo` trên máy <tên máy>?".
5. Claim `email_verified` lấy từ `emailVerifiedBy`, không bao giờ là true với email/password thuần.

## Verification
- Unit: mã khôi phục dùng một lần; luật liên kết tài khoản; token reset qua Telegram dùng một lần và hết hạn; webhook Telegram từ chối secret sai.
- Integration (Playwright trên chính IdP): đăng ký, đăng nhập, consent, quay về client. Device flow: duyệt khi đã có phiên thì không hỏi mật khẩu lại. Quên mật khẩu qua cả 3 đường.
- `grep -ri "nodemailer\|smtp" src` không ra kết quả nào.

## Giao việc
**Đợt:** 0 · **Phụ thuộc trước khi bắt đầu:** phase 01 đã xong và staging `auth.hoandat.com` đang chạy; credential Google, GitHub và bot Telegram có ở T1. Code ở repo `hoandat-auth` · **Lệnh cook:** `/ak:cook plans/dattqh/261008-1325-central-auth-idp/phase-02-accounts-and-login.md`

| # | Việc | Vai trò | Song song | File chính |
|---|---|---|---|---|
| T1 | Tạo OAuth app Google, OAuth app GitHub và bot Telegram (BotFather) cho staging; đưa secret vào env trên VPS và đặt webhook Telegram (cần user xác nhận) | fullstack-developer (hạ tầng) | Song song với T2 | `.env.example`, secret trên VPS |
| T2 | Model tài khoản (username `^[a-z0-9_]{3,30}$`, email unique, `emailVerifiedBy`, providers, telegram), băm mật khẩu argon2id, 8 mã khôi phục dùng một lần; nối `findAccount` và lấy `email_verified` từ `emailVerifiedBy` | fullstack-developer | Song song với T1 | `src/accounts/user-model.ts`, `src/accounts/password-hasher.ts`, `src/accounts/recovery-codes.ts`, `src/oidc/claims.ts` |
| T3 | Đăng nhập Google và GitHub bằng `arctic` cùng luật liên kết: email đã xác minh thì tự liên kết, chưa xác minh thì bắt nhập mật khẩu trước, chưa có tài khoản thì tạo mới và hỏi username | fullstack-developer | Song song với T4, T5 (sau T2) | `src/accounts/account-linking.ts`, `src/accounts/upstream-google.ts`, `src/accounts/upstream-github.ts` |
| T4 | Telegram: bot client, deep link liên kết (TTL 10 phút, dùng một lần), webhook kiểm header secret token, link reset mật khẩu gửi qua bot (TTL 15 phút, dùng một lần) | fullstack-developer | Song song với T3, T5 (sau T2) | `src/telegram/bot-client.ts`, `src/telegram/link-routes.ts`, `src/telegram/webhook-routes.ts`, `src/telegram/reset-link-service.ts` |
| T5 | Khung giao diện server render dùng chung: token màu Localman, wordmark "hoandat · Tài khoản", form có CSRF. Đối chiếu `idpShell` trong prototype `../261008-1123-localman-core/prototype/index.html` (màn `#/login`, `#/signup`, `#/idp/account`) | ui-ux-designer | Song song với T3, T4 | `src/interactions/` (phần layout dùng chung) |
| T6 | Trang đăng nhập, đăng ký (mật khẩu tối thiểu 7 ký tự; hiện mã khôi phục một lần, nút tải .txt, bắt xác nhận đã lưu) và logout. Rate-limit theo IP và theo username/email, khoá 15 phút sau 5 lần sai, không lộ email có tồn tại hay không | fullstack-developer | Song song với T7 (sau T2, T5) | `src/interactions/login-page`, `src/interactions/signup-page`, `src/interactions/logout-page` |
| T7 | Trang consent (scope bằng lời dễ hiểu), trang duyệt thiết bị (chưa đăng nhập thì bắt đăng nhập trước, hiện "Cho phép `tunelo` trên máy <tên máy>?", nút Cho phép hoặc Từ chối), trang quên mật khẩu với 3 đường | fullstack-developer | Song song với T6 (sau T3, T4, T5) | `src/interactions/consent-page`, `src/interactions/device-verify-page`, `src/interactions/forgot-password-page` |
| T8 | Trang `/account`: hồ sơ, đổi mật khẩu, tạo lại mã khôi phục, liên kết hoặc huỷ Google/GitHub/Telegram, phiên đang mở, thiết bị Tunelo, ứng dụng đã cấp quyền gồm client MCP; phiên và ứng dụng thu hồi được. Theo prototype `#/idp/account` | fullstack-developer | — (sau T6, T7) | `src/account-portal/` |
| T9 | Unit test: mã khôi phục dùng một lần, luật liên kết tài khoản, token reset qua Telegram dùng một lần và hết hạn, webhook từ chối secret sai | tester | Song song với T10 | `src/__tests__/accounts.test.ts` |
| T10 | Integration Playwright trên IdP: đăng ký, đăng nhập, consent, quay về client; duyệt thiết bị khi đã có phiên thì không hỏi lại mật khẩu; quên mật khẩu qua cả 3 đường | tester | Song song với T9 | `src/__tests__/interactions.test.ts` |
| T11 | Deploy bản phase 02 lên staging để phase 03 và các repo client dùng (cần user xác nhận) | fullstack-developer (hạ tầng) | — | VPS staging |
| T12 | Review cuối phase | code-reviewer | — | toàn phase |

### Checklist
- [x] T1 OAuth app Google (project `hoandat-auth`, đã publish production), GitHub (OAuth App id 3916221) và bot Telegram `@auth_hoandat_bot` đã tạo và bật trên .65 ngày 2026-10-09; secret nằm trong `.env` trên server và thư mục iCloud `auth-hoandat`, không commit
- [x] T2 Model tài khoản, argon2id, mã khôi phục và claim `email_verified` đúng luật (argon2id và mã khôi phục đã gỡ theo ADR 0004)
- [x] T3 Đăng nhập Google/GitHub và 3 nhánh liên kết chạy đúng
- [x] T4 Liên kết Telegram, webhook và link reset qua bot chạy đúng TTL, dùng một lần (link reset đã gỡ theo ADR 0004; Telegram chỉ còn thông báo)
- [x] T5 Layout server render khớp prototype IdP, `pnpm check:tokens` sạch
- [x] T6 Đăng nhập, đăng ký, logout có CSRF, rate-limit và khoá tạm (theo ADR 0004 chỉ còn nút Google/GitHub; khoá tạm đã gỡ cùng mật khẩu)
- [x] T7 Consent, duyệt thiết bị và quên mật khẩu (3 đường) chạy đúng (quên mật khẩu đã gỡ theo ADR 0004)
- [x] T8 Trang `/account` đủ mục, thu hồi được phiên và ứng dụng (mục mật khẩu và mã khôi phục đã gỡ theo ADR 0004; thêm mục "Cách đăng nhập" `#account-sign-in`)
- [x] T9 Unit test pass
- [x] T10 Playwright pass
- [x] T11 Bản phase 02 đã chạy trên .65 (production duy nhất)
- [x] T12 Review không còn finding mức high
- [x] Verification: unit và Playwright pass; `grep -ri "nodemailer\|smtp" src` không ra kết quả nào
- [x] lint/typecheck/test sạch: `pnpm lint` (Biome), `tsc --noEmit`, `pnpm test`
- [x] `pnpm check:mcp-coverage`: N/A (repo `hoandat-auth` không dùng operation registry của Localman)
