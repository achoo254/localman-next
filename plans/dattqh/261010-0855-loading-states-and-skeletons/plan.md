---
title: "Web: loading states, skeletons and pending feedback"
status: completed
created: 2026-10-10
tier: L
---

# Web: loading states, skeletons and pending feedback

## Outcome
Every screen of the Localman web app shows the user what is happening while data loads or changes:
- skeletons in the shape of the coming content;
- a thin progress bar while data refreshes or a page changes;
- a spinner on the button that is saving.

Nothing flashes on fast loads, and the layout does not jump when data arrives.

## Context
- User (2026-10-10): "chưa có các trạng thái state loading, skeleton khi state thay đổi".
- Today about 48 files show a one-line muted "Loading…" text, and lazy pages fall back to `PageLoading` text. Refetches and mutations give little or no sign.

## Decisions (Jev, 2026-10-10)
| Question | Choice | p |
|---|---|---|
| First load | Skeletons shaped like the real content, from one shared `Skeleton` primitive | 1.00 |
| Fast loads | Show only after ~150 ms; once shown, keep ≥ ~300 ms | 1.00 |
| Refetch with data on screen | Keep data visible (dimmed slightly when a filter changed what is shown) + thin progress bar at the top of that panel | 1.00 |
| Page change | Thin progress bar at the top of the window + destination page skeleton | 0.61 |
| Saving actions | Pressed button shows a spinner and is disabled until done; simple toggles and renames update at once and roll back with an error toast | 0.94 |
| Shimmer | Moving shimmer, off under `prefers-reduced-motion` (static muted block) | noul 0.75 |

## Constraints
- Only tokens and mapped Tailwind utilities. Primitives live in `apps/web/src/components/ui/` and are documented in `docs/design-system.md`.
- Screen readers announce loading once: `aria-busy` on the region, one polite status. Skeleton blocks themselves are `aria-hidden`.
- No new UI library. Files stay ≤ 200 lines. Strings go through `t()` in en, zh-CN, vi.

## Phases
1. **Primitives** (first):
   - `Skeleton` (block, text lines, circle) with shimmer and reduced motion.
   - `useDelayedFlag(pending, { delay: 150, minDuration: 300 })`.
   - `PanelProgress` (thin top bar for a panel).
   - `RouteProgress` (window top bar during navigation or lazy chunk loading).
   - `Button` `loading` prop (spinner, disabled, `aria-busy`).
   - Optimistic helper pattern for TanStack Query (`onMutate` / rollback / error toast).
2. **Projects & mock screens**: project list, project detail (header, endpoint card tabs, resource tree canvas, resources card), resource modals (data, import preview), collaborators, magic link, upstream, request log, webhook inbox, callbacks, MCP token settings.
3. **API client & account screens**:
   - API client: workbench restore, tabs, history sidebar, response "sending" state, from-mock modal.
   - Account and notifications.
   - Subscription, pro interest and feedback forms; invite page; docs; `PageLoading` fallback.

## Acceptance criteria
- [x] No remaining one-line "Loading…" text as the only first-load state on any screen listed in phases 2–3. Each uses a content-shaped skeleton.
- [x] Fast loads (< 150 ms) show no indicator. Shown indicators stay ≥ 300 ms. Covered by fake-timer tests.
- [x] Refetch and filter changes keep data and show `PanelProgress`. Navigation shows `RouteProgress`.
- [x] Every create/update/delete/send button shows a spinner while pending. Toggles and renames are optimistic with rollback and an error toast.
- [x] Reduced motion turns the shimmer off. axe shows no serious violations. Each loading region has one polite status.
- [x] `pnpm lint && pnpm typecheck && pnpm test && pnpm e2e` clean (3316 unit, e2e 28). Deployed release `20261010-042012-f3ef7885125b`.
