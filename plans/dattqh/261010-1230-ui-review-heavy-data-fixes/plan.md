---
title: "Fixes from the heavy-data UI review"
status: in-progress
created: 2026-10-10
tier: L
---

# Fixes from the heavy-data UI review

## Outcome
Every finding of `plans/dattqh/reports/ui-review-heavy-data.md` is fixed as Jev decided, then verified on production with the "UI test - …" projects. The test projects are deleted afterwards (Jev 0.91).

## Decisions (Jev, 2026-10-10)
| Finding | Choice | p |
|---|---|---|
| C1 MCP panel visible under every tab | Hide the inactive force-mounted panel; add `mockMcp` to the e2e build plus an "only one tab panel visible" assertion | 0.85 |
| H1 node actions overflow | Keep Data and Edit visible; API Client, Export types and Delete go into a "⋯" menu | 0.73 |
| H2 deep tree navigation | Canvas height capped to the viewport (inner scroll, scrollbar always visible), Fit/100% zoom, drag-to-pan; outline view later | 0.98 |
| M1 find in tree | Roving tabindex: `role="tree"`, arrow keys, one tab stop per node | 0.48 (filter box 0.40) |
| M2 long names | Headings and list rows wrap to 2 lines; nodes and modal titles middle ellipsis + title tooltip | 0.78 |
| M3 long prefix URL | Wrap the URL at `/` | 0.46 |
| M4 parent key | Store `parentKey` on the resource; new or re-nested resources use the fixed rule (irregular plurals, camelCase for `-`); existing resources keep the old key (computed by the old rule when the field is missing, so no data migration); editable in the Edit modal | 1.00 |
| M5 project name characters | Allow `. · , & + ' :`; update error text in 3 languages; check slug and file-name derivations | 0.90 |
| M6 loading states | MCP panel treats loading resources as loading; cold skeleton inside the app shell | 1.00 |
| M7 data modal | Record count, Go to id, wrap toggle, focusable scroll region | 1.00 |
| M8 callbacks two saves | "Update" also saves callbacks (two calls, partial failure reported) | 0.75 |
| L1 empty project modal | Auto-open only right after the project was created | 0.69 |
| L2 project list meta | Meta line "N resources · M records" (API returns counts) | 0.90 |
| L3 generate all confirmation | Summary with collapsible per-resource list | 0.82 |
| L4 MCP server name | Short id suffix when the slug lost characters or is generic | 0.81 |
| L5 tabs cut on mobile | Fade the right edge and scroll the selected tab into view | 0.52 |
| L6 canvas 11px overflow at 375 | Reduce origin/padding on narrow screens (technical, no Jev question) | — |

## Ownership
- **A** (page and endpoint card): C1, M2 headings, M3, M6, L1, L3, L4, L5.
- **B** (resource tree): H1, H2, M1, M2 node names, L6.
- **C** (API and shared): M4, M5, L2 API.
- **D** (web resources modals and project list): M4 key editing UI, M7, M8, M2 project rows and modal titles, L2 meta line.

## Acceptance
- [x] All findings above fixed with tests (commit `ed99b7a`).
- [x] `pnpm lint && pnpm typecheck && pnpm test && pnpm e2e` clean: 3470 unit, e2e 30/30; clean clone of the commit alone: typecheck 0 errors, web 1010/1010.
- [x] Deployed release `20261010-053905-ed99b7ac67fe`; checked through the production MCP: project counts returned, an old resource keeps `quizzId` and can be switched to `quizId`, "UI test - Shop v2.0 · beta" accepted.
- [ ] Owner reviews the UI with the test projects; then delete them (Jev 0.91) and decide whether to revert the owner's Pro grant (backup `localman-20261010-114356`; preimage `plan: "free"`, no `planExpiresAt`).
