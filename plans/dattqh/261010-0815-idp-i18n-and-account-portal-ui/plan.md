---
title: "IdP: English, Chinese and a clearer account portal"
status: completed
created: 2026-10-10
tier: L
repos: [hoandat-auth, localman-next]
---

# IdP: English, Chinese and a clearer account portal

## Outcome
Every page of `auth.hoandat.com` is in English, Simplified Chinese and Vietnamese. A visitor coming from Localman sees the language they already use there. The account portal at `/account` groups its sections so each one is easy to find. Each revoke action names exactly what it removes.

## Context
- User request (2026-10-10): "trang auth chưa có 2 ngôn ngữ mới. ui trang auth cũng hơi đơn giản khó phân biệt các hạng mục".
- Today every IdP page is Vietnamese only (`<html lang="vi">`, hard-coded strings). Localman uses English as source and default, plus `zh-CN` and `vi`.
- `/account` stacks six sections in one narrow card with identical headings, and every revoke button reads "Thu hồi".

## Decisions (Jev, 2026-10-10)
| Question | Choice | p |
|---|---|---|
| Language source | `ui_locales` from the app, then a language cookie set by a switcher on every page, then `Accept-Language`, then English | 0.98 |
| Default language | English | 0.90 |
| Portal layout | One wider page with three headed groups: Account (profile, sign-in methods), Security (open sessions, Tunelo devices), Connections (authorized apps, Telegram). Each section is a card with an icon, a one-line description, a count and an empty state | 0.98 |
| Revoke actions | Buttons say what they do ("Sign out this browser", "Sign out device", "Remove app access"); a badge marks the current session; red only for removing an app; removing app access and "sign out every other session" ask for confirmation on their own page | 1.00 |
| Sign-in context | Sign-in and consent pages name the app asking ("Sign in to continue to Localman") and show Google/GitHub logos on the buttons | noul 0.73 |

## Constraints
- No client-side JavaScript. The switcher is a link or form that hits a small endpoint. That endpoint sets the cookie and redirects back, and it accepts only same-origin relative return paths.
- Colors come only from `static/css/tokens.css`. No inline style or script (CSP).
- Every rule in `hoandat-auth/CLAUDE.md` applies.
- Competitor names never appear. Provider logos are the official Google and GitHub marks, used only on their own sign-in buttons.

## Non-goals
- Telegram bot messages and audit texts keep their current language.
- No new sign-in method and no change to OIDC contracts, apart from honouring `ui_locales`.

## Acceptance criteria
- [x] All IdP pages render in `en`, `zh-CN`, `vi`. `<html lang>` matches the page language, and dates are formatted for that locale.
- [x] Language is picked in this order: `ui_locales`, then cookie, then `Accept-Language`, then English. The switcher works on every page without JavaScript, and its return path cannot redirect off-site.
- [x] Localman passes its current language as `ui_locales` when it starts sign-in.
- [x] `/account` shows three groups and six cards, each with an icon, description, count and empty state, and works at phone width.
- [x] Revoke buttons are labelled by effect. Removing app access and signing out other sessions go through a confirmation page that keeps CSRF and the recent-login check.
- [x] Sign-in and consent pages name the requesting app and show provider logos.
- [x] `pnpm lint && pnpm typecheck && pnpm test && pnpm test:e2e && pnpm check:tokens` are clean in `hoandat-auth`, and Localman's affected tests pass.
- [x] Deployed to `auth.hoandat.com` (hoandat-auth `239e3a6`) and checked live: pages answer in en/zh-CN/vi by Accept-Language, discovery lists `ui_locales_supported`, `/lang` refuses an off-site return path. Localman `037aa55` sends `ui_locales` (release `20261010-012949-8179213cb602`).
